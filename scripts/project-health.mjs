import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { capture, psqlArgs } from "./db-utils.mjs";

const root = resolve(import.meta.dirname, "..");
const includeDb = process.argv.includes("--db");

async function readJson(path) {
  return JSON.parse(await readFile(resolve(root, path), "utf8"));
}

async function assertFile(path, pattern = null) {
  const body = await readFile(resolve(root, path), "utf8");
  if (pattern) assert.match(body, pattern, path);
  return body;
}

const requiredFiles = [
  "compose.yaml",
  "Dockerfile.collector",
  "db/migrations/001_initial_schema.sql",
  "db/migrations/002_placement_workflow_schema.sql",
  "db/migrations/003_advisor_directory_schema.sql",
  "db/migrations/004_crm_prototype_persistence.sql",
  "db/migrations/005_screen_driven_product_model.sql",
  "db/migrations/006_facility_user_preferences.sql",
  "scripts/facility-collector.mjs",
  "scripts/facility-exporter.mjs",
  "scripts/csa-locator-collector.mjs",
  "scripts/website-contact-harvester.mjs",
  "scripts/db-migrate.mjs",
  "scripts/db-seed-facilities.mjs",
  "scripts/db-seed-advisors.mjs",
  "scripts/db-seed-crm-sample.mjs",
  "scripts/facility-app-smoke.mjs",
  "apps/facility-directory-prototype/src/App.jsx",
  "apps/facility-directory-prototype/vite.config.mjs",
  "docs/PROJECT_LEDGER.md",
  "docs/SENIOR_APP_SCREEN_REVIEW.md",
  "docs/SCREEN_AND_DATA_BACKLOG.md",
  "docs/PRODUCT_ISSUE_REGISTER.md",
  "docs/LOCAL_DATABASE.md",
  "docs/FACILITY_DATA_COLLECTOR.md",
  "docs/FACILITY_APP_DATA_MODEL.md",
  "docs/SENIOR_LIVING_CRM_REQUIREMENTS.md",
  "docs/SENIORPLACE_DOCS_REVIEW.md",
  "docs/INTEGRATIONS_RESEARCH.md"
];

for (const path of requiredFiles) {
  await assertFile(path);
}

const packageJson = await readJson("package.json");
for (const scriptName of [
  "collect:facilities",
  "collect:csa-locator",
  "collect:contacts",
  "db:setup",
  "db:seed:facilities",
  "db:seed:advisors",
  "db:seed:crm",
  "dev:facility-app",
  "test:facility-app",
  "verify"
]) {
  assert.ok(packageJson.scripts?.[scriptName], `Missing package script: ${scriptName}`);
}

await assertFile("apps/facility-directory-prototype/src/App.jsx", /const FACILITY_API_URL = "\/api\/facilities\/search"/);
await assertFile("apps/facility-directory-prototype/src/App.jsx", /FACILITY_PAGE_SIZE = 500/);
await assertFile("apps/facility-directory-prototype/src/App.jsx", /id="facilityPagination"/);
await assertFile("apps/facility-directory-prototype/src/App.jsx", /\/api\/crm\/state/);
await assertFile("apps/facility-directory-prototype/src/App.jsx", /\/api\/advisors\/search/);
await assertFile("apps/facility-directory-prototype/vite.config.mjs", /function facilitySearch/);
await assertFile("apps/facility-directory-prototype/vite.config.mjs", /function crmState/);
await assertFile("apps/facility-directory-prototype/vite.config.mjs", /function advisorSearch/);

const combinedAll = await readJson("data/facilities/combined-facilities-all.json");
const combinedActive = await readJson("data/facilities/combined-facilities-active.json");
const csaLocator = await readJson("data/advisor-directory/csa-locator-all.json");
const seniorPlace = await readJson("data/advisor-directory/seniorplace-advisors-show-all-full-2026-08-03.json");

assert.equal(combinedAll.record_count, 40240, "Unexpected combined all facility count");
assert.equal(combinedActive.record_count, 35680, "Unexpected active facility count");
assert.equal(csaLocator.record_count, 2931, "Unexpected CSA locator advisor count");
assert.equal(seniorPlace.record_count || seniorPlace.records?.length, 308, "Unexpected SeniorPlace advisor count");

const result = {
  files_checked: requiredFiles.length,
  scripts_checked: 10,
  facility_records_all: combinedAll.record_count,
  facility_records_active: combinedActive.record_count,
  csa_locator_records: csaLocator.record_count,
  seniorplace_advisor_records: seniorPlace.record_count || seniorPlace.records?.length
};

if (includeDb) {
  const output = await capture("docker", psqlArgs(["-At", "-c", `
    SELECT jsonb_build_object(
      'facilities', (SELECT count(*) FROM facilities),
      'active_facilities', (SELECT count(*) FROM facilities WHERE is_active),
      'advisor_records', (SELECT count(*) FROM advisor_records),
      'crm_people', (SELECT count(*) FROM people person JOIN tenants tenant ON tenant.tenant_id = person.tenant_id WHERE tenant.slug = 'local-demo'),
      'crm_relationships', (SELECT count(*) FROM person_relationships relationship JOIN tenants tenant ON tenant.tenant_id = relationship.tenant_id WHERE tenant.slug = 'local-demo'),
      'crm_leads', (SELECT count(*) FROM leads lead JOIN tenants tenant ON tenant.tenant_id = lead.tenant_id WHERE tenant.slug = 'local-demo'),
      'crm_communications', (SELECT count(*) FROM communications communication JOIN tenants tenant ON tenant.tenant_id = communication.tenant_id WHERE tenant.slug = 'local-demo')
    )
  `]));
  result.database = JSON.parse(output.trim());
  assert.equal(result.database.facilities, 40240, "Unexpected DB facility count");
  assert.equal(result.database.active_facilities, 35680, "Unexpected DB active facility count");
  assert.equal(result.database.advisor_records, 3239, "Unexpected DB advisor count");
  assert.equal(result.database.crm_people, 13, "Unexpected DB CRM people count");
  assert.equal(result.database.crm_relationships, 12, "Unexpected DB relationship count");
  assert.equal(result.database.crm_leads, 4, "Unexpected DB lead count");
  assert.equal(result.database.crm_communications, 4, "Unexpected DB communication count");
}

console.log(JSON.stringify(result, null, 2));
