import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = Number(process.env.PORT || 4273);
const server = spawn("npm", ["run", "dev:facility-app", "--", "--port", String(port), "--strictPort"], {
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"]
});

try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Facility app server did not start")), 5000);
    server.stdout.on("data", (chunk) => {
      if (String(chunk).includes(`:${port}`) || String(chunk).includes(`http://127.0.0.1:${port}/`)) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.stderr.on("data", (chunk) => reject(new Error(String(chunk))));
    server.on("error", reject);
  });

  const pageResponse = await fetch(`http://127.0.0.1:${port}/`);
  const html = await pageResponse.text();
  assert.equal(pageResponse.status, 200);
  assert.match(html, /Facility CRM/);
  assert.match(html, /id="root"/);
  assert.match(html, /\/src\/main\.jsx/);

  const scriptResponse = await fetch(`http://127.0.0.1:${port}/src/App.jsx`);
  const script = await scriptResponse.text();
  assert.equal(scriptResponse.status, 200);
  assert.match(script, /combined-facilities-active\.json/);
  assert.match(script, /\/api\/facilities\/search\?limit=50000/);
  assert.match(script, /MAX_RENDERED_ROWS = 300/);
  assert.match(script, /DEFAULT_PIN_LIMIT = 300/);
  assert.match(script, /tile\.openstreetmap\.org/);
  assert.match(script, /onWheel/);
  assert.match(script, /onPointerDown/);
  assert.match(script, /onPointerMove/);
  assert.match(script, /setPanOffset/);
  assert.match(script, /id: "mapPreviewPanel"/);
  assert.match(script, /data-facility-key/);
  assert.match(script, /list\.scrollTo/);
  assert.match(script, /id: "pinLimitFilter"/);
  assert.match(script, /id: "categoryFilter"/);
  assert.match(script, /55\+ community/);
  assert.match(script, /Independent living/);
  assert.match(script, /Memory care/);
  assert.match(script, /Skilled nursing/);
  assert.match(script, /id: "distanceAddressFilter"/);
  assert.match(script, /id: "distanceMilesFilter"/);
  assert.match(script, /id: "geocodeDistanceButton"/);
  assert.match(script, /id: "zipFilter"/);
  assert.match(script, /id: "minBedsFilter"/);
  assert.match(script, /id: "maxBedsFilter"/);
  assert.match(script, /id: "costMinFilter"/);
  assert.match(script, /id: "costMaxFilter"/);
  assert.match(script, /\/api\/geocode\/address/);
  assert.match(script, /facility-directory-preferences-v3/);
  assert.match(script, /\/api\/facility-preferences/);
  assert.match(script, /id: "facilityPreferenceStatus"/);
  assert.match(script, /facility-directory-crm-state-v3/);
  assert.match(script, /\/api\/crm\/state/);
  assert.match(script, /id: "crmSaveStatus"/);
  assert.match(script, /facility-directory-website-contacts-v1/);
  assert.match(script, /id: "websiteContactCard"/);
  assert.match(script, /id: "facilityWebsiteInput"/);
  assert.match(script, /id: "saveFacilityWebsiteButton"/);
  assert.match(script, /id: "checkFacilityContactsButton"/);
  assert.match(script, /id: "websiteFetchedPages"/);
  assert.match(script, /id: "websiteContactEvidence"/);
  assert.match(script, /id: "websiteParserRules"/);
  assert.match(script, /\/api\/facility\/contact-info/);
  assert.match(script, /id: "addLeadButton"/);
  assert.match(script, /id: "linkSelectedFacilityButton"/);
  assert.match(script, /id: "leadSearchInput"/);
  assert.match(script, /id: "leadStatusFilter"/);
  assert.match(script, /id: "communicationFacilityKey"/);
  assert.match(script, /Prospect only/);
  assert.match(script, /stageOffset/);
  assert.match(script, /id: "peopleNetworkPanel"/);
  assert.match(script, /id: "relationshipGraph"/);
  assert.match(script, /id: "addPersonButton"/);
  assert.match(script, /id: "selectedPersonFilter"/);
  assert.match(script, /id: "relationshipLevelsFilter"/);
  assert.match(script, /id: "relationshipMilesFilter"/);
  assert.match(script, /id: "relationshipYearsFilter"/);
  assert.match(script, /id: "addRelationshipButton"/);
  assert.match(script, /id: "relationshipBreadcrumbs"/);
  assert.match(script, /id: "relationshipBackButton"/);
  assert.match(script, /id: "relationshipHoverPanel"/);
  assert.match(script, /id: "selectedPersonCard"/);
  assert.match(script, /id: "selectedRelationshipList"/);
  assert.match(script, /id: "advisorsView"/);
  assert.match(script, /id: "advisorSearchInput"/);
  assert.match(script, /\/api\/advisors\/summary/);
  assert.match(script, /\/api\/advisors\/search/);
  assert.match(script, /personTrail/);
  assert.match(script, /hoveredPersonId/);
  assert.match(script, /PERSON_TYPE_COLORS/);

  const dataResponse = await fetch(`http://127.0.0.1:${port}/data/facilities/combined-facilities-active.json`);
  const data = await dataResponse.json();
  assert.equal(dataResponse.status, 200);
  assert.equal(data.export_type, "active");
  assert.ok(data.record_count > 8000);
  assert.ok(data.records.every((record) => record.is_active));

  const facilitySearchResponse = await fetch(`http://127.0.0.1:${port}/api/facilities/search?state=TX&q=Austin&limit=25`);
  const facilitySearch = await facilitySearchResponse.json();
  assert.equal(facilitySearchResponse.status, 200);
  assert.ok(facilitySearch.total_matching > 0);
  assert.ok(facilitySearch.records.length > 0);
  assert.ok(facilitySearch.records.every((record) => record.state === "TX"));
  assert.ok(facilitySearch.states.includes("TX"));
  const preferenceFacilityKey = facilitySearch.records[0].facility_key;

  const facilityPreferencesResponse = await fetch(`http://127.0.0.1:${port}/api/facility-preferences`);
  const facilityPreferences = await facilityPreferencesResponse.json();
  assert.equal(facilityPreferencesResponse.status, 200);
  assert.ok(facilityPreferences.priority);
  assert.ok(facilityPreferences.excluded);
  assert.ok(facilityPreferences.favorite);

  const savePreferenceResponse = await fetch(`http://127.0.0.1:${port}/api/facility-preferences`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      facilityKey: preferenceFacilityKey,
      priority: 3,
      isExcluded: true,
      isFavorite: true,
      notes: "Smoke test preference"
    })
  });
  const savedPreference = await savePreferenceResponse.json();
  assert.equal(savePreferenceResponse.status, 200);
  assert.equal(savedPreference.priority[preferenceFacilityKey], 3);
  assert.equal(savedPreference.excluded[preferenceFacilityKey], true);
  assert.equal(savedPreference.favorite[preferenceFacilityKey], true);

  const clearPreferenceResponse = await fetch(`http://127.0.0.1:${port}/api/facility-preferences`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ facilityKey: preferenceFacilityKey, priority: 0, isExcluded: false, isFavorite: false, notes: "" })
  });
  const clearedPreference = await clearPreferenceResponse.json();
  assert.equal(clearPreferenceResponse.status, 200);
  assert.equal(clearedPreference.priority[preferenceFacilityKey], undefined);
  assert.equal(clearedPreference.excluded[preferenceFacilityKey], undefined);
  assert.equal(clearedPreference.favorite[preferenceFacilityKey], undefined);

  const ocrResponse = await fetch(`http://127.0.0.1:${port}/api/business-card/ocr`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      filename: "sample-senior-living-card.jpg",
      mimeType: "image/jpeg",
      bytes: 1234,
      imageDataUrl: "data:image/jpeg;base64,AA=="
    })
  });
  const ocr = await ocrResponse.json();
  assert.equal(ocrResponse.status, 200);
  assert.equal(ocr.mode, "mock");
  assert.equal(ocr.contact.name, "Jordan Miller");
  assert.match(ocr.contact.title, /Community Relations/);

  const advisorSummaryResponse = await fetch(`http://127.0.0.1:${port}/api/advisors/summary`);
  const advisorSummary = await advisorSummaryResponse.json();
  assert.equal(advisorSummaryResponse.status, 200);
  assert.equal(advisorSummary.total_records, 3239);
  assert.equal(advisorSummary.seniorplace_records, 308);
  assert.equal(advisorSummary.csa_locator_records, 2931);

  const advisorSearchResponse = await fetch(`http://127.0.0.1:${port}/api/advisors/search?q=Amy%20McCabe&limit=5`);
  const advisorSearch = await advisorSearchResponse.json();
  assert.equal(advisorSearchResponse.status, 200);
  assert.ok(advisorSearch.records.some((record) => record.name === "Amy McCabe"));

  const crmStateResponse = await fetch(`http://127.0.0.1:${port}/api/crm/state`);
  const crmState = await crmStateResponse.json();
  assert.equal(crmStateResponse.status, 200);
  assert.ok(crmState.leads.some((lead) => lead.id === "lead-001"));
  assert.ok(crmState.people.some((person) => person.id === "person-margaret"));
  assert.ok(crmState.relationships.some((relationship) => relationship.id === "rel-001"));

  const crmSaveResponse = await fetch(`http://127.0.0.1:${port}/api/crm/state`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(crmState)
  });
  const crmSave = await crmSaveResponse.json();
  assert.equal(crmSaveResponse.status, 200);
  assert.equal(crmSave.saved, true);

  console.log("Facility app smoke checks passed.");
} finally {
  server.kill("SIGTERM");
}
