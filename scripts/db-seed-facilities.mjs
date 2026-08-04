import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { psqlArgs, run } from "./db-utils.mjs";

const root = resolve(import.meta.dirname, "..");
const inputPath = resolve(root, process.argv.find((arg) => arg.startsWith("--input="))?.slice("--input=".length) || "data/facilities/combined-facilities-all.json");
const tmpDir = resolve(root, "tmp", "db-import");
const tsvPath = resolve(tmpDir, "facilities.tsv");
const sqlPath = resolve(tmpDir, "seed-facilities.sql");

const sourceInfo = {
  "tx-hhsc-assisted-living": {
    name: "Texas HHSC Assisted Living Facilities",
    jurisdiction: "TX",
    source_owner: "Texas Health and Human Services Commission",
    source_system: "ArcGIS FeatureServer",
    source_url: "https://services1.arcgis.com/jI1j5lArZnrgFYSc/ArcGIS/rest/services/Assisted_Living/FeatureServer/0",
    source_description: "Public map layer for assisted living facilities regulated by Texas HHSC."
  },
  "ca-cdss-rcfe": {
    name: "California CDSS Residential Care Facilities for the Elderly",
    jurisdiction: "CA",
    source_owner: "California Department of Social Services",
    source_system: "CKAN datastore",
    source_url: "https://lab.data.ca.gov/dataset/community-care-licensing-facilities/6b2f5818-f60d-40b5-bc2a-94f995f9f8b0",
    source_description: "Public open-data table for California Residential Care Facilities for the Elderly."
  },
  "cms-nursing-home-provider-info": {
    name: "CMS Nursing Home Provider Information",
    jurisdiction: "US",
    source_owner: "Centers for Medicare & Medicaid Services",
    source_system: "CMS Provider Data API",
    source_url: "https://data.cms.gov/provider-data/dataset/4pq5-n9py",
    source_description: "National CMS Provider Data Catalog table for currently active nursing homes/skilled nursing facilities."
  },
  "hud-section-202-properties": {
    name: "HUD Section 202 Properties",
    jurisdiction: "US",
    source_owner: "U.S. Department of Housing and Urban Development",
    source_system: "ArcGIS FeatureServer",
    source_url: "https://catalog.data.gov/dataset/section-202-properties-5a638",
    source_description: "HUD assisted multifamily properties that primarily serve elderly residents."
  }
};

function csvValue(value) {
  if (value == null) return "\\N";
  const normalized = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${normalized.replaceAll("\"", "\"\"")}"`;
}

function row(record) {
  return [
    record.facility_key,
    record.facility_name,
    record.source_facility_id,
    record.care_category,
    record.program_type,
    record.county,
    record.address,
    record.city,
    record.state,
    record.zip,
    record.phone,
    record.fax,
    record.capacity,
    record.licensee,
    record.administrator,
    record.facility_status,
    Boolean(record.is_active),
    record.latitude,
    record.longitude,
    record.source_id,
    record.source_name,
    record.source_url,
    record.source_owner,
    record.source_detail || {},
    record
  ].map(csvValue).join("\t");
}

const payload = JSON.parse(await readFile(inputPath, "utf8"));
const records = payload.records || [];
if (!records.length) throw new Error(`No records found in ${inputPath}`);

await mkdir(tmpDir, { recursive: true });
await writeFile(tsvPath, `${records.map(row).join("\n")}\n`);

const sourceRows = Object.entries(sourceInfo).map(([sourceId, source]) => [
  sourceId,
  source.name,
  source.jurisdiction,
  source.source_owner,
  source.source_system,
  source.source_url,
  source.source_description
].map(csvValue).join("\t")).join("\n");
await writeFile(resolve(tmpDir, "facility-sources.tsv"), `${sourceRows}\n`);

await writeFile(sqlPath, String.raw`
BEGIN;

CREATE TEMP TABLE import_facility_sources (
  source_id text,
  name text,
  jurisdiction text,
  source_owner text,
  source_system text,
  source_url text,
  source_description text
);

\copy import_facility_sources FROM '/workspace/tmp/db-import/facility-sources.tsv' WITH (FORMAT csv, DELIMITER E'\t', QUOTE '"', ESCAPE '"', NULL '\N')

INSERT INTO facility_sources (
  source_id,
  name,
  jurisdiction,
  source_owner,
  source_system,
  source_url,
  source_description
)
SELECT
  source_id,
  name,
  jurisdiction,
  source_owner,
  source_system,
  source_url,
  source_description
FROM import_facility_sources
ON CONFLICT (source_id) DO UPDATE SET
  name = excluded.name,
  jurisdiction = excluded.jurisdiction,
  source_owner = excluded.source_owner,
  source_system = excluded.source_system,
  source_url = excluded.source_url,
  source_description = excluded.source_description,
  updated_at = now();

CREATE TEMP TABLE import_facilities (
  facility_key text,
  facility_name text,
  source_facility_id text,
  care_category text,
  program_type text,
  county text,
  address text,
  city text,
  state text,
  zip text,
  phone text,
  fax text,
  capacity integer,
  licensee text,
  administrator text,
  facility_status text,
  is_active boolean,
  latitude double precision,
  longitude double precision,
  source_id text,
  source_name text,
  source_url text,
  source_owner text,
  source_detail jsonb,
  raw_record jsonb
);

\copy import_facilities FROM '/workspace/tmp/db-import/facilities.tsv' WITH (FORMAT csv, DELIMITER E'\t', QUOTE '"', ESCAPE '"', NULL '\N')

INSERT INTO facilities (
  facility_key,
  facility_name,
  source_facility_id,
  care_category,
  program_type,
  county,
  address,
  city,
  state,
  zip,
  phone,
  fax,
  capacity,
  licensee,
  administrator,
  facility_status,
  is_active,
  latitude,
  longitude,
  geog,
  source_id,
  source_url,
  source_owner,
  source_detail,
  raw_record,
  last_seen_at,
  updated_at
)
SELECT
  facility_key,
  facility_name,
  coalesce(source_facility_id, ''),
  care_category,
  coalesce(program_type, ''),
  coalesce(county, ''),
  coalesce(address, ''),
  coalesce(city, ''),
  coalesce(state, ''),
  coalesce(zip, ''),
  coalesce(phone, ''),
  coalesce(fax, ''),
  capacity,
  coalesce(licensee, ''),
  coalesce(administrator, ''),
  coalesce(facility_status, ''),
  coalesce(is_active, true),
  latitude,
  longitude,
  CASE
    WHEN latitude IS NOT NULL AND longitude IS NOT NULL
    THEN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
    ELSE NULL
  END,
  source_id,
  coalesce(source_url, ''),
  coalesce(source_owner, ''),
  coalesce(source_detail, '{}'::jsonb),
  coalesce(raw_record, '{}'::jsonb),
  now(),
  now()
FROM import_facilities
ON CONFLICT (facility_key) DO UPDATE SET
  facility_name = excluded.facility_name,
  source_facility_id = excluded.source_facility_id,
  care_category = excluded.care_category,
  program_type = excluded.program_type,
  county = excluded.county,
  address = excluded.address,
  city = excluded.city,
  state = excluded.state,
  zip = excluded.zip,
  phone = excluded.phone,
  fax = excluded.fax,
  capacity = excluded.capacity,
  licensee = excluded.licensee,
  administrator = excluded.administrator,
  facility_status = excluded.facility_status,
  is_active = excluded.is_active,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  geog = excluded.geog,
  source_id = excluded.source_id,
  source_url = excluded.source_url,
  source_owner = excluded.source_owner,
  source_detail = excluded.source_detail,
  raw_record = excluded.raw_record,
  last_seen_at = now(),
  updated_at = now();

COMMIT;
`);

await run("docker", psqlArgs(["-f", "/workspace/tmp/db-import/seed-facilities.sql"]));
console.log(`Seeded ${records.length} facilities from ${inputPath}.`);
