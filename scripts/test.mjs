import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { collectFacilities, enrichWithCensusGeocodes } from "./facility-collector.mjs";
import { exportCombinedFacilities } from "./facility-exporter.mjs";
import { harvestFacilityWebsite, parseContactPage } from "./website-contact-harvester.mjs";
import { collectCsaLocator, detectTotalPages, parseCsaSearchPage } from "./csa-locator-collector.mjs";

const publicDir = resolve(import.meta.dirname, "..", "public");
const root = resolve(import.meta.dirname, "..");
const home = await readFile(resolve(publicDir, "index.html"), "utf8");
const styles = await readFile(resolve(publicDir, "styles.css"), "utf8");
const form = await readFile(resolve(publicDir, "get-started.html"), "utf8");
const formScript = await readFile(resolve(publicDir, "forms.js"), "utf8");
const prototypeDir = resolve(root, "apps", "facility-directory-prototype");
const prototypeHtml = await readFile(resolve(prototypeDir, "index.html"), "utf8");
const prototypeStyles = await readFile(resolve(prototypeDir, "styles.css"), "utf8");
const prototypeApp = await readFile(resolve(prototypeDir, "src", "App.jsx"), "utf8");
const prototypeEntry = await readFile(resolve(prototypeDir, "src", "main.jsx"), "utf8");
const prototypeViteConfig = await readFile(resolve(prototypeDir, "vite.config.mjs"), "utf8");
const prototypeCrmData = await readFile(resolve(prototypeDir, "crm-data.js"), "utf8");
const projectLedger = await readFile(resolve(root, "docs", "PROJECT_LEDGER.md"), "utf8");
const seniorAppScreenReview = await readFile(resolve(root, "docs", "SENIOR_APP_SCREEN_REVIEW.md"), "utf8");
const screenAndDataBacklog = await readFile(resolve(root, "docs", "SCREEN_AND_DATA_BACKLOG.md"), "utf8");
const productIssueRegister = await readFile(resolve(root, "docs", "PRODUCT_ISSUE_REGISTER.md"), "utf8");
const screenDrivenMigration = await readFile(resolve(root, "db", "migrations", "005_screen_driven_product_model.sql"), "utf8");
const facilityPreferenceMigration = await readFile(resolve(root, "db", "migrations", "006_facility_user_preferences.sql"), "utf8");
const healthScript = await readFile(resolve(root, "scripts", "project-health.mjs"), "utf8");
const csaLocatorFixture = await readFile(resolve(root, "test", "fixtures", "csa-locator-search-page-sample.html"), "utf8");

assert.match(home, /Guiding You Home\./);
assert.match(home, /Which Senior Living Option Is Right for You\?/);
assert.match(home, /assets\/images\/wordmark-light\.webp/);
assert.match(home, /use\.typekit\.net\/ik\//);
assert.match(styles, /assets\/images\/home-hero\.jpg/);
assert.match(styles, /--heading-font: "adonis-web"/);
assert.match(styles, /--body-font: "futura-pt"/);
assert.match(form, /data-mock-form/);
assert.match(formScript, /not sent to a production provider/);
assert.doesNotMatch(formScript, /mailchimp|twilio|amazonaws|execute-api/i);

for (const route of ["about", "services", "process", "blog", "contact", "team", "get-started"]) {
  const page = await readFile(resolve(publicDir, `${route}.html`), "utf8");
  assert.match(page, /Senior Living Kit/);
  assert.doesNotMatch(page, /\.html/);
}

assert.match(prototypeHtml, /Facility CRM/);
assert.match(prototypeHtml, /viewport/);
assert.match(prototypeHtml, /id="root"/);
assert.match(prototypeHtml, /src="\/src\/main\.jsx"/);
assert.match(prototypeStyles, /@media \(max-width: 760px\)/);
assert.match(prototypeStyles, /\[hidden\]/);
assert.match(prototypeStyles, /grid-template-columns: minmax\(230px, 280px\)/);
assert.match(prototypeStyles, /\.map-pin/);
assert.match(prototypeStyles, /\.map-tile/);
assert.match(prototypeStyles, /cursor: grab/);
assert.match(prototypeStyles, /touch-action: none/);
assert.match(prototypeStyles, /\.pipeline-board/);
assert.match(prototypeStyles, /\.input-with-icon/);
assert.match(prototypeStyles, /\.advisors-workspace/);
assert.match(prototypeStyles, /\.advisor-row/);
assert.match(prototypeEntry, /createRoot/);
assert.match(prototypeApp, /combined-facilities-active\.json/);
assert.match(prototypeApp, /const FACILITY_API_URL = "\/api\/facilities\/search"/);
assert.match(prototypeApp, /const FACILITY_PAGE_SIZE = 500/);
assert.match(prototypeApp, /MAX_RENDERED_ROWS = 300/);
assert.match(prototypeApp, /DEFAULT_PIN_LIMIT = 300/);
assert.match(prototypeApp, /tile\.openstreetmap\.org/);
assert.match(prototypeApp, /zoomForBounds/);
assert.match(prototypeApp, /onWheel/);
assert.match(prototypeApp, /onPointerDown/);
assert.match(prototypeApp, /onPointerMove/);
assert.match(prototypeApp, /setPanOffset/);
assert.match(prototypeApp, /event\.preventDefault/);
assert.match(prototypeApp, /id="mapPreviewPanel"/);
assert.match(prototypeApp, /id="mapPreviewName"/);
assert.match(prototypeApp, /data-facility-key/);
assert.match(prototypeApp, /list\.scrollTo/);
assert.doesNotMatch(prototypeApp, /scrollIntoView/);
assert.match(prototypeApp, /id="pinLimitFilter"/);
assert.match(prototypeApp, /id="categoryFilter"/);
assert.match(prototypeApp, /55\+ community/);
assert.match(prototypeApp, /Independent living/);
assert.match(prototypeApp, /Memory care/);
assert.match(prototypeApp, /Skilled nursing/);
assert.match(prototypeApp, /id="distanceAddressFilter"/);
assert.match(prototypeApp, /id="distanceMilesFilter"/);
assert.match(prototypeApp, /id="geocodeDistanceButton"/);
assert.match(prototypeApp, /id="zipFilter"/);
assert.match(prototypeApp, /id="minBedsFilter"/);
assert.match(prototypeApp, /id="maxBedsFilter"/);
assert.match(prototypeApp, /id="costMinFilter"/);
assert.match(prototypeApp, /id="costMaxFilter"/);
assert.match(prototypeApp, /\/api\/geocode\/address/);
assert.match(prototypeApp, /facility-directory-preferences-v3/);
assert.match(prototypeApp, /\/api\/facility-preferences/);
assert.match(prototypeApp, /id="facilityPreferenceStatus"/);
assert.match(prototypeApp, /FACILITY_PAGE_SIZE/);
assert.match(prototypeApp, /facilitySearchUrl/);
assert.match(prototypeApp, /mergeFacilities/);
assert.match(prototypeApp, /id="facilityPagination"/);
assert.match(prototypeApp, /Favorites/);
assert.match(prototypeApp, /facility-directory-crm-state-v3/);
assert.match(prototypeApp, /\/api\/crm\/state/);
assert.match(prototypeApp, /id="crmSaveStatus"/);
assert.match(prototypeApp, /\/api\/business-card\/ocr/);
assert.match(prototypeApp, /facility-directory-website-contacts-v1/);
assert.match(prototypeApp, /id="websiteContactCard"/);
assert.match(prototypeApp, /id="facilityWebsiteInput"/);
assert.match(prototypeApp, /id="saveFacilityWebsiteButton"/);
assert.match(prototypeApp, /id="checkFacilityContactsButton"/);
assert.match(prototypeApp, /id="websiteFetchedPages"/);
assert.match(prototypeApp, /id="websiteContactEvidence"/);
assert.match(prototypeApp, /id="websiteParserRules"/);
assert.match(prototypeApp, /id="websiteParsingNotes"/);
assert.match(prototypeApp, /\/api\/facility\/contact-info/);
assert.match(prototypeApp, /Apply to selected lead/);
assert.match(prototypeApp, /id="addLeadButton"/);
assert.match(prototypeApp, /id="linkSelectedFacilityButton"/);
assert.match(prototypeApp, /stageOffset/);
assert.match(prototypeApp, /Facility links/);
assert.match(prototypeApp, /id="leadSearchInput"/);
assert.match(prototypeApp, /id="leadStatusFilter"/);
assert.match(prototypeApp, /id="leadFilterCount"/);
assert.match(prototypeApp, /id="crmView"/);
assert.match(prototypeApp, /CLIENT_WORKSPACE_TABS/);
assert.match(prototypeApp, /id="clientWorkspaceShell"/);
assert.match(prototypeApp, /id="clientWorkspaceTabs"/);
assert.match(prototypeApp, /id="clientOverviewPanel"/);
assert.match(prototypeApp, /id="clientAssessmentPanel"/);
assert.match(prototypeApp, /id="clientCommunitiesPanel"/);
assert.match(prototypeApp, /id="clientActivityPanel"/);
assert.match(prototypeApp, /id="clientTasksPanel"/);
assert.match(prototypeApp, /id="clientFilesPanel"/);
assert.match(prototypeApp, /id="pipelineBoard"/);
assert.match(prototypeApp, /id="communicationForm"/);
assert.match(prototypeApp, /id="communicationFacilityKey"/);
assert.match(prototypeApp, /Prospect only/);
assert.match(prototypeApp, /id="cardScanForm"/);
assert.match(prototypeApp, /accept="image\/\*"/);
assert.match(prototypeApp, /capture="environment"/);
assert.match(prototypeApp, /id="peopleNetworkPanel"/);
assert.match(prototypeApp, /id="relationshipGraph"/);
assert.match(prototypeApp, /id="addPersonButton"/);
assert.match(prototypeApp, /id="selectedPersonFilter"/);
assert.match(prototypeApp, /id="relationshipLevelsFilter"/);
assert.match(prototypeApp, /id="relationshipMilesFilter"/);
assert.match(prototypeApp, /id="relationshipYearsFilter"/);
assert.match(prototypeApp, /id="relationshipTargetInput"/);
assert.match(prototypeApp, /id="addRelationshipButton"/);
assert.match(prototypeApp, /id="relationshipBreadcrumbs"/);
assert.match(prototypeApp, /id="relationshipBackButton"/);
assert.match(prototypeApp, /id="relationshipHoverPanel"/);
assert.match(prototypeApp, /id="selectedPersonCard"/);
assert.match(prototypeApp, /id="selectedRelationshipList"/);
assert.match(prototypeApp, /id="advisorsView"/);
assert.match(prototypeApp, /\/api\/advisors\/summary/);
assert.match(prototypeApp, /\/api\/advisors\/search/);
assert.match(prototypeApp, /id="advisorSearchInput"/);
assert.match(prototypeApp, /relationshipGraph/);
assert.match(prototypeApp, /personTrail/);
assert.match(prototypeApp, /hoveredPersonId/);
assert.match(prototypeApp, /PERSON_TYPE_COLORS/);
assert.match(prototypeViteConfig, /\/api\/business-card\/ocr/);
assert.match(prototypeViteConfig, /\/api\/geocode\/address/);
assert.match(prototypeViteConfig, /\/api\/facility\/contact-info/);
assert.match(prototypeViteConfig, /\/api\/facilities\/search/);
assert.match(prototypeViteConfig, /\/api\/facility-preferences/);
assert.match(prototypeViteConfig, /facilityPreferences/);
assert.match(prototypeViteConfig, /facilitySearch/);
assert.match(prototypeViteConfig, /pageSize/);
assert.match(prototypeViteConfig, /OFFSET/);
assert.match(prototypeViteConfig, /north/);
assert.match(prototypeViteConfig, /keys/);
assert.match(prototypeViteConfig, /has_more/);
assert.match(prototypeViteConfig, /\/api\/advisors\/summary/);
assert.match(prototypeViteConfig, /\/api\/advisors\/search/);
assert.match(prototypeViteConfig, /\/api\/crm\/state/);
assert.match(prototypeViteConfig, /saveCrmState/);
assert.match(prototypeViteConfig, /advisorSummary/);
assert.match(prototypeViteConfig, /harvestFacilityWebsite/);
assert.match(prototypeViteConfig, /geocoding\.geo\.census\.gov/);
assert.match(prototypeViteConfig, /\/data\//);
assert.match(prototypeCrmData, /PIPELINE_STAGES/);
assert.match(prototypeCrmData, /SAMPLE_COMMUNICATIONS/);
assert.match(prototypeCrmData, /SAMPLE_PEOPLE/);
assert.match(prototypeCrmData, /SAMPLE_RELATIONSHIPS/);
assert.match(prototypeCrmData, /Dr\. Priya Shah/);
assert.match(prototypeCrmData, /Facility contact/);
assert.match(projectLedger, /Current Data Inventory/);
assert.match(projectLedger, /40,240 records/);
assert.match(projectLedger, /35,680 active records/);
assert.match(projectLedger, /\/api\/facilities\/search/);
assert.match(projectLedger, /\/api\/crm\/state/);
assert.match(projectLedger, /\/api\/facility-preferences/);
assert.match(projectLedger, /server-side page/);
assert.match(projectLedger, /npm run health:db/);
assert.match(projectLedger, /005_screen_driven_product_model/);
assert.match(projectLedger, /006_facility_user_preferences/);
assert.match(seniorAppScreenReview, /\/Users\/bob\/@senior/);
assert.match(seniorAppScreenReview, /Client Workspace/);
assert.match(seniorAppScreenReview, /Community Comparison/);
assert.match(screenAndDataBacklog, /Client Workspace/);
assert.match(screenAndDataBacklog, /assessment_templates/);
assert.match(productIssueRegister, /CRM-001/);
assert.match(productIssueRegister, /Client workspace shell prototype complete/);
assert.match(productIssueRegister, /COM-001/);
assert.match(productIssueRegister, /ASM-001/);
assert.match(productIssueRegister, /DAT-001/);
assert.match(productIssueRegister, /DAT-002/);
assert.match(productIssueRegister, /SEC-001/);
assert.match(screenDrivenMigration, /CREATE TABLE IF NOT EXISTS assessment_templates/);
assert.match(screenDrivenMigration, /CREATE TABLE IF NOT EXISTS entity_files/);
assert.match(screenDrivenMigration, /CREATE TABLE IF NOT EXISTS community_report_packages/);
assert.match(screenDrivenMigration, /CREATE TABLE IF NOT EXISTS communication_threads/);
assert.match(facilityPreferenceMigration, /CREATE TABLE IF NOT EXISTS facility_user_preferences/);
assert.match(facilityPreferenceMigration, /is_favorite/);
assert.match(healthScript, /combined-facilities-all\.json/);
assert.match(healthScript, /Unexpected DB facility count/);

assert.equal(detectTotalPages(csaLocatorFixture), 147);
const parsedCsaLocator = parseCsaSearchPage(csaLocatorFixture, "https://portal.csa.us/search/?geodir_search=1&stype=gd_place&s=");
assert.equal(parsedCsaLocator.length, 2);
assert.equal(parsedCsaLocator[0].name, "ANDREW FORSTADT");
assert.equal(parsedCsaLocator[0].source_record_id, "92477");
assert.equal(parsedCsaLocator[0].certified_since, "2025-10-06");
assert.equal(parsedCsaLocator[0].location, "CHERRY HILL, New Jersey");
assert.equal(parsedCsaLocator[0].city, "CHERRY HILL");
assert.equal(parsedCsaLocator[0].state, "New Jersey");
assert.equal(parsedCsaLocator[0].main_industry, "Senior Housing, Placement");
assert.equal(parsedCsaLocator[0].detail_url, "https://portal.csa.us/csa-search/andrew-forstadt/");
assert.match(parsedCsaLocator[0].advisor_key, /^society-certified-senior-advisors-locator:[a-f0-9]{16}$/);
assert.equal(parsedCsaLocator[1].zip, "95008");

const csaCollectorOutDir = await mkdtemp(resolve(tmpdir(), "csa-locator-collector-"));
try {
  const csaManifest = await collectCsaLocator({
    inputPath: resolve(root, "test", "fixtures", "csa-locator-search-page-sample.html"),
    outDir: csaCollectorOutDir,
    limit: 1,
    collectedAt: "2026-08-03T12:00:00.000Z"
  });
  assert.equal(csaManifest.source_id, "society-certified-senior-advisors-locator");
  assert.equal(csaManifest.detected_total_pages, 147);
  assert.equal(csaManifest.fetched_pages, 1);
  assert.equal(csaManifest.total_parsed_records, 2);
  assert.equal(csaManifest.selected_records, 1);
  assert.match(csaManifest.selected_records_sha256, /^[a-f0-9]{64}$/);

  const csaCollected = JSON.parse(await readFile(resolve(csaCollectorOutDir, "csa-locator-1.json"), "utf8"));
  assert.equal(csaCollected.record_count, 1);
  assert.equal(csaCollected.records[0].name, "ANDREW FORSTADT");
  assert.equal(csaCollected.records[0].collected_at, "2026-08-03T12:00:00.000Z");
} finally {
  await rm(csaCollectorOutDir, { recursive: true, force: true });
}

const collectorOutDir = await mkdtemp(resolve(tmpdir(), "facility-collector-"));
try {
  const manifest = await collectFacilities({
    inputPath: resolve(root, "test", "fixtures", "tx-assisted-living-sample.json"),
    outDir: collectorOutDir,
    limit: 2,
    retrievedAt: "2026-08-02T12:00:00.000Z"
  });

  assert.equal(manifest.source_id, "tx-hhsc-assisted-living");
  assert.equal(manifest.total_source_records, 3);
  assert.equal(manifest.normalized_records, 2);
  assert.equal(manifest.selected_records, 2);
  assert.match(manifest.selected_records_sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(manifest.validation.warnings, []);
  assert.ok(manifest.parsing_notes.some((note) => note.includes("Haversine")));

  const collected = JSON.parse(await readFile(resolve(collectorOutDir, "texas-assisted-living-2.json"), "utf8"));
  assert.equal(collected.records[0].facility_key, "tx-hhsc-assisted-living:000745");
  assert.equal(collected.records[0].facility_name, "BROOKDALE WESTLAKE HILLS");
  assert.equal(collected.records[0].state, "TX");
  assert.equal(collected.records[0].capacity, 36);
  assert.equal(collected.records[0].is_active, true);
  assert.equal(collected.records[0].source_id, "tx-hhsc-assisted-living");
  assert.ok(collected.records[0].distance_miles_from_center < collected.records[1].distance_miles_from_center);
  assert.ok(collected.parsing_notes.some((note) => note.includes("State values")));

  const csv = await readFile(resolve(collectorOutDir, "texas-assisted-living-2.csv"), "utf8");
  assert.match(csv, /facility_key,facility_name,source_facility_id,care_category/);
  assert.match(csv, /BROOKDALE WESTLAKE HILLS/);

  const latestManifest = JSON.parse(
    await readFile(resolve(collectorOutDir, "tx-hhsc-assisted-living-latest-manifest.json"), "utf8")
  );
  assert.equal(latestManifest.run_id, manifest.run_id);

  const caManifest = await collectFacilities({
    sourceId: "ca-cdss-rcfe",
    inputPath: resolve(root, "test", "fixtures", "ca-rcfe-sample.json"),
    outDir: collectorOutDir,
    limit: 2,
    retrievedAt: "2026-08-02T12:05:00.000Z"
  });

  assert.equal(caManifest.source_id, "ca-cdss-rcfe");
  assert.equal(caManifest.total_source_records, 2);
  assert.equal(caManifest.selected_records, 2);
  assert.equal(caManifest.active_records, 2);
  assert.deepEqual(caManifest.status_counts, { LICENSED: 2 });
  assert.deepEqual(caManifest.validation.warnings, ["2 records are missing coordinates."]);

  const caCollected = JSON.parse(await readFile(resolve(collectorOutDir, "california-rcfe-2.json"), "utf8"));
  assert.equal(caCollected.records[0].facility_key, "ca-cdss-rcfe:15601302");
  assert.equal(caCollected.records[0].facility_name, "ACACIA CREEK - UNION CITY");
  assert.equal(caCollected.records[0].state, "CA");
  assert.equal(caCollected.records[0].capacity, 376);
  assert.equal(caCollected.records[0].licensee, "MASONIC HOMES CAL & ACACIA CREEK, MASONIC SEN LIV");
  assert.equal(caCollected.records[0].facility_status, "LICENSED");
  assert.equal(caCollected.records[0].is_active, true);
  assert.equal(caCollected.records[0].latitude, null);
  assert.equal(caCollected.records[0].source_id, "ca-cdss-rcfe");

  const geocodeCachePath = resolve(collectorOutDir, "geocoding", "test-census-cache.json");
  const geocoded = await enrichWithCensusGeocodes(caCollected.records, {
    cachePath: geocodeCachePath,
    retrievedAt: "2026-08-02T12:07:00.000Z",
    fetchImpl: async () => new Response([
      "\"ca-cdss-rcfe:15601302\",\"34400 MISSION BLVD, UNION CITY, CA, 94587\",\"Match\",\"Exact\",\"34400 MISSION BLVD, UNION CITY, CA, 94587\",\"-122.01666,37.59082\",\"123\",\"L\"",
      "\"ca-cdss-rcfe:216801686\",\"101 GOLF COURSE DR, ROHNERT PARK, CA, 94928\",\"No_Match\",\"\",\"\",\"\",\"\",\"\""
    ].join("\n"), { status: 200 })
  });
  assert.equal(geocoded.report.provider, "US Census Geocoder");
  assert.equal(geocoded.report.eligible_records, 2);
  assert.equal(geocoded.report.requested_records, 2);
  assert.equal(geocoded.report.matched_records, 1);
  assert.equal(geocoded.records[0].latitude, 37.59082);
  assert.equal(geocoded.records[0].longitude, -122.01666);
  assert.equal(geocoded.records[0].geocode_source, "US Census Geocoder");
  assert.equal(geocoded.records[0].geocode_match_status, "Match");
  assert.equal(geocoded.records[1].latitude, null);

  const cachedGeocoded = await enrichWithCensusGeocodes(caCollected.records, {
    cachePath: geocodeCachePath,
    fetchImpl: async () => {
      throw new Error("cache should satisfy the second enrichment run");
    }
  });
  assert.equal(cachedGeocoded.report.cache_hits, 2);
  assert.equal(cachedGeocoded.report.requested_records, 0);
  assert.equal(cachedGeocoded.records[0].latitude, 37.59082);

  const cmsManifest = await collectFacilities({
    sourceId: "cms-nursing-home-provider-info",
    inputPath: resolve(root, "test", "fixtures", "cms-nursing-home-provider-info-sample.json"),
    outDir: collectorOutDir,
    limit: 2,
    retrievedAt: "2026-08-02T12:08:00.000Z"
  });

  assert.equal(cmsManifest.source_id, "cms-nursing-home-provider-info");
  assert.equal(cmsManifest.total_source_records, 2);
  assert.equal(cmsManifest.selected_records, 2);
  assert.equal(cmsManifest.active_records, 2);
  assert.deepEqual(cmsManifest.validation.warnings, []);

  const cmsCollected = JSON.parse(await readFile(resolve(collectorOutDir, "cms-nursing-home-provider-info-2.json"), "utf8"));
  assert.equal(cmsCollected.records[0].facility_key, "cms-nursing-home-provider-info:015009");
  assert.equal(cmsCollected.records[0].facility_name, "BURNS NURSING HOME, INC.");
  assert.equal(cmsCollected.records[0].care_category, "skilled_nursing");
  assert.equal(cmsCollected.records[0].program_type, "Medicare and Medicaid");
  assert.equal(cmsCollected.records[0].capacity, 57);
  assert.equal(cmsCollected.records[0].latitude, 34.5149);
  assert.equal(cmsCollected.records[0].longitude, -87.736);
  assert.equal(cmsCollected.records[0].source_detail.overall_rating, 2);
  assert.equal(cmsCollected.records[1].source_detail.chain_name, "PRIME HEALTH CARE ENTERPRISES");

  const parsedContacts = parseContactPage(`
    <html><head><title>Oak View Senior Living</title>
    <script type="application/ld+json">{"@type":"LocalBusiness","email":"info@oakview.example","telephone":"(512) 555-1010"}</script>
    </head><body>
    <a href="mailto:sales@oakview.example">Email sales</a>
    <a href="tel:+15125550111">Call admissions</a>
    <a href="/contact-us">Contact us</a>
    Main office (512) 555-1012
    </body></html>
  `, "https://oakview.example/");
  assert.equal(parsedContacts.title, "Oak View Senior Living");
  assert.ok(parsedContacts.emails.includes("sales@oakview.example"));
  assert.ok(parsedContacts.emails.includes("info@oakview.example"));
  assert.ok(parsedContacts.phones.includes("+15125550111"));
  assert.ok(parsedContacts.phones.includes("(512) 555-1010"));
  assert.ok(parsedContacts.contact_links.includes("https://oakview.example/contact-us"));
  assert.ok(parsedContacts.evidence.some((item) => item.rule === "json_ld_email"));

  const harvestedContacts = await harvestFacilityWebsite({
    facilityKey: "test:oakview",
    websiteUrl: "https://oakview.example",
    checkedAt: "2026-08-02T12:09:00.000Z",
    maxPages: 3,
    fetchImpl: async (url) => {
      const pageUrl = String(url);
      const body = pageUrl.endsWith("/contact-us")
        ? "<html><head><title>Contact Oak View</title></head><body>Admissions: admissions@oakview.example (512) 555-2020</body></html>"
        : "<html><head><title>Oak View</title></head><body><a href=\"/contact-us\">Contact admissions</a> Main: (512) 555-1000</body></html>";
      return new Response(body, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" }
      });
    }
  });
  assert.equal(harvestedContacts.facility_key, "test:oakview");
  assert.equal(harvestedContacts.parser_version, "website-contact-harvester-v1");
  assert.equal(harvestedContacts.fetched_pages.length, 2);
  assert.ok(harvestedContacts.emails.includes("admissions@oakview.example"));
  assert.ok(harvestedContacts.phones.includes("(512) 555-2020"));
  assert.ok(harvestedContacts.parser_rules.some((rule) => rule.includes("Store evidence snippets")));

  const hudManifest = await collectFacilities({
    sourceId: "hud-section-202-properties",
    inputPath: resolve(root, "test", "fixtures", "hud-section-202-sample.json"),
    outDir: collectorOutDir,
    limit: 1,
    retrievedAt: "2026-08-02T12:09:30.000Z"
  });
  assert.equal(hudManifest.source_id, "hud-section-202-properties");
  assert.equal(hudManifest.selected_records, 1);
  assert.equal(hudManifest.active_records, 1);

  const hudCollected = JSON.parse(await readFile(resolve(collectorOutDir, "hud-section-202-properties-1.json"), "utf8"));
  assert.equal(hudCollected.records[0].facility_key, "hud-section-202-properties:800000040");
  assert.equal(hudCollected.records[0].facility_name, "Ken-Ton Presbyterian Village");
  assert.equal(hudCollected.records[0].care_category, "age_55_plus");
  assert.equal(hudCollected.records[0].program_type, "202/8 NC");
  assert.equal(hudCollected.records[0].capacity, 151);
  assert.equal(hudCollected.records[0].state, "NY");
  assert.equal(hudCollected.records[0].latitude, 42.985513);
  assert.equal(hudCollected.records[0].source_detail.management_contact_email, "drine@beechwoodcare.org");

  const combinedManifest = await exportCombinedFacilities({
    inDir: collectorOutDir,
    outDir: collectorOutDir,
    generatedAt: "2026-08-02T12:10:00.000Z"
  });

  assert.equal(combinedManifest.all_records, 7);
  assert.equal(combinedManifest.active_records, 7);
  assert.match(combinedManifest.all_records_sha256, /^[a-f0-9]{64}$/);
  assert.equal(combinedManifest.source_exports.length, 4);

  const combinedAll = JSON.parse(await readFile(resolve(collectorOutDir, "combined-facilities-all.json"), "utf8"));
  assert.equal(combinedAll.record_count, 7);
  assert.deepEqual(
    new Set(combinedAll.records.map((record) => record.facility_key)),
    new Set([
      "ca-cdss-rcfe:15601302",
      "ca-cdss-rcfe:216801686",
      "cms-nursing-home-provider-info:015009",
      "cms-nursing-home-provider-info:015010",
      "hud-section-202-properties:800000040",
      "tx-hhsc-assisted-living:000745",
      "tx-hhsc-assisted-living:110472"
    ])
  );

  const combinedActiveCsv = await readFile(resolve(collectorOutDir, "combined-facilities-active.csv"), "utf8");
  assert.match(combinedActiveCsv, /ACACIA CREEK - UNION CITY/);
  assert.match(combinedActiveCsv, /BURNS NURSING HOME/);
  assert.match(combinedActiveCsv, /Ken-Ton Presbyterian Village/);
  assert.match(combinedActiveCsv, /BROOKDALE WESTLAKE HILLS/);

  const relocatedOutDir = await mkdtemp(resolve(tmpdir(), "facility-export-relocated-"));
  try {
    await writeFile(
      resolve(relocatedOutDir, "tx-hhsc-assisted-living-latest-manifest.json"),
      JSON.stringify({
        ...latestManifest,
        outputs: {
          ...latestManifest.outputs,
          latest_json: "/host/path/that/does/not/exist/texas-assisted-living-2.json"
        }
      })
    );
    await writeFile(
      resolve(relocatedOutDir, "ca-cdss-rcfe-latest-manifest.json"),
      JSON.stringify({
        ...caManifest,
        outputs: {
          ...caManifest.outputs,
          latest_json: "/host/path/that/does/not/exist/california-rcfe-2.json"
        }
      })
    );
    await writeFile(
      resolve(relocatedOutDir, "cms-nursing-home-provider-info-latest-manifest.json"),
      JSON.stringify({
        ...cmsManifest,
        outputs: {
          ...cmsManifest.outputs,
          latest_json: "/host/path/that/does/not/exist/cms-nursing-home-provider-info-2.json"
        }
      })
    );
    await writeFile(
      resolve(relocatedOutDir, "hud-section-202-properties-latest-manifest.json"),
      JSON.stringify({
        ...hudManifest,
        outputs: {
          ...hudManifest.outputs,
          latest_json: "/host/path/that/does/not/exist/hud-section-202-properties-1.json"
        }
      })
    );
    await writeFile(
      resolve(relocatedOutDir, "texas-assisted-living-2.json"),
      await readFile(resolve(collectorOutDir, "texas-assisted-living-2.json"), "utf8")
    );
    await writeFile(
      resolve(relocatedOutDir, "california-rcfe-2.json"),
      await readFile(resolve(collectorOutDir, "california-rcfe-2.json"), "utf8")
    );
    await writeFile(
      resolve(relocatedOutDir, "cms-nursing-home-provider-info-2.json"),
      await readFile(resolve(collectorOutDir, "cms-nursing-home-provider-info-2.json"), "utf8")
    );
    await writeFile(
      resolve(relocatedOutDir, "hud-section-202-properties-1.json"),
      await readFile(resolve(collectorOutDir, "hud-section-202-properties-1.json"), "utf8")
    );

    const relocatedCombined = await exportCombinedFacilities({
      inDir: relocatedOutDir,
      outDir: relocatedOutDir,
      generatedAt: "2026-08-02T12:15:00.000Z"
    });
    assert.equal(relocatedCombined.all_records, 7);
  } finally {
    await rm(relocatedOutDir, { recursive: true, force: true });
  }
} finally {
  await rm(collectorOutDir, { recursive: true, force: true });
}

console.log("Unit checks passed.");
