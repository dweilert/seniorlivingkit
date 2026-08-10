import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { psqlArgs, run } from "./db-utils.mjs";

const root = resolve(import.meta.dirname, "..");
const tmpDir = resolve(root, "tmp", "db-import");
const seniorPlacePath = resolve(root, process.argv.find((arg) => arg.startsWith("--seniorplace="))?.slice("--seniorplace=".length) || "data/advisor-directory/seniorplace-advisors-show-all-full-2026-08-03.json");
const csaLocatorPath = resolve(root, process.argv.find((arg) => arg.startsWith("--csa-locator="))?.slice("--csa-locator=".length) || "data/advisor-directory/csa-locator-all.json");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function csvValue(value) {
  if (value == null) return "\\N";
  const normalized = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${normalized.replaceAll("\"", "\"\"")}"`;
}

function normalizeText(value) {
  return String(value || "").replaceAll(/\s+/g, " ").trim();
}

function normalizeName(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\b(csa|csa\(r\)|cprs|cdp|mba|mpa|rcfe|lmsw|ccm|calm|lald)\b/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const stateNames = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia"
};

const stateNameValues = new Set(Object.values(stateNames).map((state) => state.toLowerCase()));

function stateToken(value) {
  const text = normalizeText(value);
  const twoLetter = text.match(/,\s*([A-Z]{2})\b/)?.[1] || "";
  if (twoLetter) return stateNames[twoLetter] || twoLetter;
  const afterComma = normalizeText(text.split(",").at(-1) || "").replace(/\b\d{5}(?:-\d{4})?\b/g, "").trim();
  if (stateNameValues.has(afterComma.toLowerCase())) return afterComma;
  return "";
}

function primaryLocation(record) {
  return normalizeText(record.location || record.locations?.[0] || "");
}

function advisorRecordKey(sourceId, stableValue) {
  return `${sourceId}:${sha256(stableValue).slice(0, 16)}`;
}

const seniorPlace = JSON.parse(await readFile(seniorPlacePath, "utf8"));
const csaLocator = JSON.parse(await readFile(csaLocatorPath, "utf8"));

const sources = [
  {
    source_id: "seniorplace-advisor-directory",
    name: "SeniorPlace Advisor Directory",
    source_owner: "SeniorPlace",
    source_system: "Authenticated advisor directory page",
    source_url: seniorPlace.source_url || "https://app.seniorplace.com/advisor-directory",
    source_description: "Advisor directory profiles visible to the authenticated SeniorPlace account.",
    parsing_notes: [
      "Browser extraction captured visible advisor card fields from the authenticated advisor directory.",
      "Records preserve raw card text and source record index for audit.",
      "This source is contact/profile enrichment, not official credential verification."
    ]
  },
  {
    source_id: "society-certified-senior-advisors-locator",
    name: "Society of Certified Senior Advisors CSA Locator",
    source_owner: "Society of Certified Senior Advisors",
    source_system: "GeoDirectory WordPress public search",
    source_url: csaLocator.source?.url || "https://portal.csa.us/locator/",
    source_description: "Public CSA Locator records used for Certified Senior Advisor credential verification.",
    parsing_notes: csaLocator.parsing_notes || []
  }
];

const sourceRuns = [
  {
    run_id: `seniorplace-advisor-directory:${seniorPlace.collected_at || "2026-08-03"}`,
    source_id: "seniorplace-advisor-directory",
    generated_at: seniorPlace.collected_at || "2026-08-03T00:00:00.000Z",
    selected_records: seniorPlace.record_count || seniorPlace.count || seniorPlace.records.length,
    selected_records_sha256: sha256(JSON.stringify(seniorPlace.records)),
    manifest: {
      source_url: seniorPlace.source_url,
      collected_at: seniorPlace.collected_at,
      extraction_note: seniorPlace.extraction_note || "",
      fields: seniorPlace.fields || []
    }
  },
  {
    run_id: csaLocator.run_id,
    source_id: "society-certified-senior-advisors-locator",
    generated_at: csaLocator.generated_at,
    selected_records: csaLocator.record_count,
    selected_records_sha256: csaLocator.selected_records_sha256,
    manifest: {
      detected_total_pages: csaLocator.detected_total_pages,
      fetched_pages: csaLocator.fetched_pages,
      total_parsed_records: csaLocator.total_parsed_records,
      source: csaLocator.source
    }
  }
];

const seniorPlaceRecords = seniorPlace.records.map((record) => {
  const sourceId = "seniorplace-advisor-directory";
  const locations = record.locations || [];
  const location = primaryLocation(record);
  const key = advisorRecordKey(sourceId, `${record.source_record_index}|${record.name}|${record.emails?.join("|") || ""}|${location}`);
  return {
    advisor_record_key: key,
    source_id: sourceId,
    source_run_id: sourceRuns[0].run_id,
    source_record_id: String(record.source_record_index || ""),
    source_record_index: record.source_record_index,
    name: normalizeText(record.name),
    agency: normalizeText(record.agency),
    certified_since: null,
    locations,
    location,
    city: normalizeText(location.split(",")[0] || ""),
    state: stateToken(location),
    zip: location.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1] || "",
    main_industry: "",
    website_urls: record.website_urls || [],
    phone_numbers: record.phone_numbers || [],
    emails: record.emails || [],
    certifications: record.certifications || [],
    summary: normalizeText(record.summary),
    operational_approach: normalizeText(record.operational_approach),
    profile_image_url: normalizeText(record.profile_image_url),
    detail_url: "",
    source_page_url: seniorPlace.source_url || "https://app.seniorplace.com/advisor-directory",
    source_url: seniorPlace.source_url || "https://app.seniorplace.com/advisor-directory",
    raw_card_text: record.raw_card_text || "",
    raw_record: record,
    collected_at: seniorPlace.collected_at || null,
    match_name: normalizeName(record.name),
    match_state: stateToken(location)
  };
});

const csaRecords = csaLocator.records.map((record) => ({
  advisor_record_key: record.advisor_key,
  source_id: record.source_id,
  source_run_id: csaLocator.run_id,
  source_record_id: String(record.source_record_id || ""),
  source_record_index: null,
  name: normalizeText(record.name),
  agency: "",
  certified_since: record.certified_since || null,
  locations: record.location ? [record.location] : [],
  location: normalizeText(record.location),
  city: normalizeText(record.city),
  state: normalizeText(record.state),
  zip: normalizeText(record.zip),
  main_industry: normalizeText(record.main_industry),
  website_urls: [],
  phone_numbers: [],
  emails: [],
  certifications: ["Certified Senior Advisor"],
  summary: "",
  operational_approach: "",
  profile_image_url: "",
  detail_url: normalizeText(record.detail_url),
  source_page_url: normalizeText(record.source_page_url),
  source_url: csaLocator.source?.url || "https://portal.csa.us/locator/",
  raw_card_text: record.raw_card_text || "",
  raw_record: record,
  collected_at: record.collected_at || csaLocator.generated_at,
  match_name: normalizeName(record.name),
  match_state: normalizeText(record.state)
}));

const records = [...seniorPlaceRecords, ...csaRecords];

const matches = [];
for (const seniorRecord of seniorPlaceRecords) {
  for (const csaRecord of csaRecords) {
    if (!seniorRecord.match_name || !csaRecord.match_name) continue;
    if (seniorRecord.match_name !== csaRecord.match_name) continue;
    const sameState = seniorRecord.match_state && csaRecord.match_state && seniorRecord.match_state.toLowerCase() === csaRecord.match_state.toLowerCase();
    matches.push({
      left_advisor_record_key: seniorRecord.advisor_record_key,
      right_advisor_record_key: csaRecord.advisor_record_key,
      match_method: sameState ? "normalized_name_and_state" : "normalized_name",
      match_score: sameState ? 95 : 82,
      match_notes: sameState
        ? "SeniorPlace and CSA Locator records have the same normalized name and state."
        : "SeniorPlace and CSA Locator records have the same normalized name; state was missing or different."
    });
  }
}

await mkdir(tmpDir, { recursive: true });

await writeFile(resolve(tmpDir, "advisor-sources.tsv"), `${sources.map((source) => [
  source.source_id,
  source.name,
  source.source_owner,
  source.source_system,
  source.source_url,
  source.source_description,
  source.parsing_notes
].map(csvValue).join("\t")).join("\n")}\n`);

await writeFile(resolve(tmpDir, "advisor-source-runs.tsv"), `${sourceRuns.map((runRecord) => [
  runRecord.run_id,
  runRecord.source_id,
  runRecord.generated_at,
  runRecord.selected_records,
  runRecord.selected_records_sha256,
  runRecord.manifest
].map(csvValue).join("\t")).join("\n")}\n`);

await writeFile(resolve(tmpDir, "advisor-records.tsv"), `${records.map((record) => [
  record.advisor_record_key,
  record.source_id,
  record.source_run_id,
  record.source_record_id,
  record.source_record_index,
  record.name,
  record.agency,
  record.certified_since,
  record.locations,
  record.location,
  record.city,
  record.state,
  record.zip,
  record.main_industry,
  record.website_urls,
  record.phone_numbers,
  record.emails,
  record.certifications,
  record.summary,
  record.operational_approach,
  record.profile_image_url,
  record.detail_url,
  record.source_page_url,
  record.source_url,
  record.raw_card_text,
  record.raw_record,
  record.collected_at
].map(csvValue).join("\t")).join("\n")}\n`);

await writeFile(resolve(tmpDir, "advisor-matches.tsv"), `${matches.map((match) => [
  match.left_advisor_record_key,
  match.right_advisor_record_key,
  match.match_method,
  match.match_score,
  match.match_notes
].map(csvValue).join("\t")).join("\n")}\n`);

const sqlPath = resolve(tmpDir, "seed-advisors.sql");
await writeFile(sqlPath, String.raw`
BEGIN;

CREATE TEMP TABLE import_advisor_sources (
  source_id text,
  name text,
  source_owner text,
  source_system text,
  source_url text,
  source_description text,
  parsing_notes jsonb
);

\copy import_advisor_sources FROM '/workspace/tmp/db-import/advisor-sources.tsv' WITH (FORMAT csv, DELIMITER E'\t', QUOTE '"', ESCAPE '"', NULL '\N')

INSERT INTO advisor_sources (
  source_id,
  name,
  source_owner,
  source_system,
  source_url,
  source_description,
  parsing_notes
)
SELECT
  source_id,
  name,
  source_owner,
  source_system,
  source_url,
  source_description,
  ARRAY(SELECT jsonb_array_elements_text(coalesce(parsing_notes, '[]'::jsonb)))
FROM import_advisor_sources
ON CONFLICT (source_id) DO UPDATE SET
  name = excluded.name,
  source_owner = excluded.source_owner,
  source_system = excluded.source_system,
  source_url = excluded.source_url,
  source_description = excluded.source_description,
  parsing_notes = excluded.parsing_notes,
  updated_at = now();

CREATE TEMP TABLE import_advisor_source_runs (
  run_id text,
  source_id text,
  generated_at timestamptz,
  selected_records integer,
  selected_records_sha256 text,
  manifest jsonb
);

\copy import_advisor_source_runs FROM '/workspace/tmp/db-import/advisor-source-runs.tsv' WITH (FORMAT csv, DELIMITER E'\t', QUOTE '"', ESCAPE '"', NULL '\N')

INSERT INTO advisor_source_runs (
  run_id,
  source_id,
  generated_at,
  selected_records,
  selected_records_sha256,
  manifest
)
SELECT run_id, source_id, generated_at, selected_records, selected_records_sha256, coalesce(manifest, '{}'::jsonb)
FROM import_advisor_source_runs
ON CONFLICT (run_id) DO UPDATE SET
  source_id = excluded.source_id,
  generated_at = excluded.generated_at,
  selected_records = excluded.selected_records,
  selected_records_sha256 = excluded.selected_records_sha256,
  manifest = excluded.manifest;

CREATE TEMP TABLE import_advisor_records (
  advisor_record_key text,
  source_id text,
  source_run_id text,
  source_record_id text,
  source_record_index integer,
  name text,
  agency text,
  certified_since date,
  locations jsonb,
  location text,
  city text,
  state text,
  zip text,
  main_industry text,
  website_urls jsonb,
  phone_numbers jsonb,
  emails jsonb,
  certifications jsonb,
  summary text,
  operational_approach text,
  profile_image_url text,
  detail_url text,
  source_page_url text,
  source_url text,
  raw_card_text text,
  raw_record jsonb,
  collected_at timestamptz
);

\copy import_advisor_records FROM '/workspace/tmp/db-import/advisor-records.tsv' WITH (FORMAT csv, DELIMITER E'\t', QUOTE '"', ESCAPE '"', NULL '\N')

INSERT INTO advisor_records (
  advisor_record_key,
  source_id,
  source_run_id,
  source_record_id,
  source_record_index,
  name,
  agency,
  certified_since,
  locations,
  location,
  city,
  state,
  zip,
  main_industry,
  website_urls,
  phone_numbers,
  emails,
  certifications,
  summary,
  operational_approach,
  profile_image_url,
  detail_url,
  source_page_url,
  source_url,
  raw_card_text,
  raw_record,
  collected_at,
  last_seen_at,
  updated_at
)
SELECT
  advisor_record_key,
  source_id,
  source_run_id,
  coalesce(source_record_id, ''),
  source_record_index,
  name,
  coalesce(agency, ''),
  certified_since,
  coalesce(locations, '[]'::jsonb),
  coalesce(location, ''),
  coalesce(city, ''),
  coalesce(state, ''),
  coalesce(zip, ''),
  coalesce(main_industry, ''),
  coalesce(website_urls, '[]'::jsonb),
  coalesce(phone_numbers, '[]'::jsonb),
  coalesce(emails, '[]'::jsonb),
  coalesce(certifications, '[]'::jsonb),
  coalesce(summary, ''),
  coalesce(operational_approach, ''),
  coalesce(profile_image_url, ''),
  coalesce(detail_url, ''),
  coalesce(source_page_url, ''),
  coalesce(source_url, ''),
  coalesce(raw_card_text, ''),
  coalesce(raw_record, '{}'::jsonb),
  collected_at,
  now(),
  now()
FROM import_advisor_records
ON CONFLICT (advisor_record_key) DO UPDATE SET
  source_id = excluded.source_id,
  source_run_id = excluded.source_run_id,
  source_record_id = excluded.source_record_id,
  source_record_index = excluded.source_record_index,
  name = excluded.name,
  agency = excluded.agency,
  certified_since = excluded.certified_since,
  locations = excluded.locations,
  location = excluded.location,
  city = excluded.city,
  state = excluded.state,
  zip = excluded.zip,
  main_industry = excluded.main_industry,
  website_urls = excluded.website_urls,
  phone_numbers = excluded.phone_numbers,
  emails = excluded.emails,
  certifications = excluded.certifications,
  summary = excluded.summary,
  operational_approach = excluded.operational_approach,
  profile_image_url = excluded.profile_image_url,
  detail_url = excluded.detail_url,
  source_page_url = excluded.source_page_url,
  source_url = excluded.source_url,
  raw_card_text = excluded.raw_card_text,
  raw_record = excluded.raw_record,
  collected_at = excluded.collected_at,
  last_seen_at = now(),
  updated_at = now();

CREATE TEMP TABLE import_advisor_matches (
  left_advisor_record_key text,
  right_advisor_record_key text,
  match_method text,
  match_score numeric(5,2),
  match_notes text
);

\copy import_advisor_matches FROM '/workspace/tmp/db-import/advisor-matches.tsv' WITH (FORMAT csv, DELIMITER E'\t', QUOTE '"', ESCAPE '"', NULL '\N')

DELETE FROM advisor_record_matches existing
USING advisor_records left_record, advisor_records right_record
WHERE existing.left_advisor_record_key = left_record.advisor_record_key
  AND existing.right_advisor_record_key = right_record.advisor_record_key
  AND left_record.source_id = 'seniorplace-advisor-directory'
  AND right_record.source_id = 'society-certified-senior-advisors-locator'
  AND existing.match_method IN ('normalized_name', 'normalized_name_and_state');

INSERT INTO advisor_record_matches (
  left_advisor_record_key,
  right_advisor_record_key,
  match_method,
  match_score,
  match_notes
)
SELECT
  left_advisor_record_key,
  right_advisor_record_key,
  match_method,
  match_score,
  coalesce(match_notes, '')
FROM import_advisor_matches
ON CONFLICT (left_advisor_record_key, right_advisor_record_key, match_method) DO UPDATE SET
  match_score = excluded.match_score,
  match_notes = excluded.match_notes,
  updated_at = now();

COMMIT;
`);

await run("docker", psqlArgs(["-f", "/workspace/tmp/db-import/seed-advisors.sql"]));

console.log(JSON.stringify({
  seniorplace_records: seniorPlaceRecords.length,
  csa_locator_records: csaRecords.length,
  total_records: records.length,
  matches: matches.length,
  sql_path: sqlPath
}, null, 2));
