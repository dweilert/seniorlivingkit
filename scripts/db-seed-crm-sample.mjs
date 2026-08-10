import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { SAMPLE_COMMUNICATIONS, SAMPLE_LEADS, SAMPLE_PEOPLE, SAMPLE_RELATIONSHIPS } from "../apps/facility-directory-prototype/crm-data.js";
import { psqlArgs, run } from "./db-utils.mjs";

const root = resolve(import.meta.dirname, "..");
const inputArg = process.argv.find((arg) => arg.startsWith("--input="));
const inputPath = inputArg ? resolve(root, inputArg.slice("--input=".length)) : "";
const tmpDir = resolve(root, "tmp", "db-import");

function csvValue(value) {
  if (value == null || value === "") return "\\N";
  const normalized = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${normalized.replaceAll("\"", "\"\"")}"`;
}

function asInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeDate(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function stateFromInput(input) {
  return {
    leads: Array.isArray(input?.leads) ? input.leads : SAMPLE_LEADS,
    communications: Array.isArray(input?.communications) ? input.communications : SAMPLE_COMMUNICATIONS,
    people: Array.isArray(input?.people) ? input.people : SAMPLE_PEOPLE,
    relationships: Array.isArray(input?.relationships) ? input.relationships : SAMPLE_RELATIONSHIPS
  };
}

const input = inputPath ? JSON.parse(await readFile(inputPath, "utf8")) : null;
const state = stateFromInput(input);

await mkdir(tmpDir, { recursive: true });

await writeFile(resolve(tmpDir, "crm-people.tsv"), `${state.people.map((person) => [
  person.id,
  person.name,
  person.type,
  asInteger(person.age),
  person.phone,
  person.email,
  person.city,
  person.state,
  person.zip,
  asNumber(person.latitude),
  asNumber(person.longitude),
  person.notes
].map(csvValue).join("\t")).join("\n")}\n`);

await writeFile(resolve(tmpDir, "crm-relationships.tsv"), `${state.relationships.map((relationship) => [
  relationship.id || `${relationship.from}:${relationship.to}:${relationship.type}:${relationship.label}`,
  relationship.from,
  relationship.to,
  relationship.type,
  relationship.label,
  relationship.strength,
  relationship.notes
].map(csvValue).join("\t")).join("\n")}\n`);

await writeFile(resolve(tmpDir, "crm-leads.tsv"), `${state.leads.map((lead) => [
  lead.id,
  lead.name,
  lead.relationship,
  lead.phone,
  lead.email,
  lead.status,
  lead.urgency,
  lead.budget,
  lead.careNeeds,
  lead.preferredArea,
  lead.assignedTo,
  lead.nextStep,
  lead.source
].map(csvValue).join("\t")).join("\n")}\n`);

const leadFacilities = state.leads.flatMap((lead) => (lead.linkedFacilities || []).map((facilityKey, index) => ({
  leadId: lead.id,
  facilityKey,
  priority: index + 1
})));
await writeFile(resolve(tmpDir, "crm-lead-facilities.tsv"), `${leadFacilities.map((item) => [
  item.leadId,
  item.facilityKey,
  item.priority
].map(csvValue).join("\t")).join("\n")}\n`);

await writeFile(resolve(tmpDir, "crm-communications.tsv"), `${state.communications.map((communication) => [
  communication.id,
  communication.leadId,
  communication.facilityKey,
  communication.direction,
  communication.channel,
  communication.subject,
  communication.body,
  normalizeDate(communication.date || communication.timestamp),
  communication.context,
  communication
].map(csvValue).join("\t")).join("\n")}\n`);

await writeFile(resolve(tmpDir, "seed-crm-sample.sql"), String.raw`
BEGIN;

INSERT INTO tenants (name, slug, settings)
VALUES ('Local Demo', 'local-demo', '{"purpose":"local prototype CRM persistence"}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  name = excluded.name,
  settings = tenants.settings || excluded.settings,
  updated_at = now();

CREATE TEMP TABLE import_crm_people (
  external_key text,
  full_name text,
  person_type text,
  age integer,
  phone text,
  email citext,
  city text,
  state text,
  zip text,
  latitude double precision,
  longitude double precision,
  notes text
);

\copy import_crm_people FROM '/workspace/tmp/db-import/crm-people.tsv' WITH (FORMAT csv, DELIMITER E'\t', QUOTE '"', ESCAPE '"', NULL '\N')

INSERT INTO people (
  tenant_id,
  external_key,
  full_name,
  person_type,
  age,
  phone,
  email,
  city,
  state,
  zip,
  latitude,
  longitude,
  geog,
  notes,
  updated_at
)
SELECT
  tenant.tenant_id,
  person.external_key,
  coalesce(person.full_name, 'Unnamed person'),
  coalesce(person.person_type, 'Family'),
  person.age,
  coalesce(person.phone, ''),
  person.email,
  coalesce(person.city, ''),
  coalesce(person.state, ''),
  coalesce(person.zip, ''),
  person.latitude,
  person.longitude,
  CASE
    WHEN person.latitude IS NOT NULL AND person.longitude IS NOT NULL
    THEN ST_SetSRID(ST_MakePoint(person.longitude, person.latitude), 4326)::geography
    ELSE NULL
  END,
  coalesce(person.notes, ''),
  now()
FROM import_crm_people person
CROSS JOIN tenants tenant
WHERE tenant.slug = 'local-demo'
ON CONFLICT (tenant_id, external_key) WHERE external_key IS NOT NULL DO UPDATE SET
  full_name = excluded.full_name,
  person_type = excluded.person_type,
  age = excluded.age,
  phone = excluded.phone,
  email = excluded.email,
  city = excluded.city,
  state = excluded.state,
  zip = excluded.zip,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  geog = excluded.geog,
  notes = excluded.notes,
  updated_at = now();

CREATE TEMP TABLE import_crm_relationships (
  external_key text,
  from_external_key text,
  to_external_key text,
  relationship_type text,
  label text,
  strength text,
  notes text
);

\copy import_crm_relationships FROM '/workspace/tmp/db-import/crm-relationships.tsv' WITH (FORMAT csv, DELIMITER E'\t', QUOTE '"', ESCAPE '"', NULL '\N')

INSERT INTO person_relationships (
  tenant_id,
  external_key,
  from_person_id,
  to_person_id,
  relationship_type,
  label,
  strength,
  notes,
  updated_at
)
SELECT
  tenant.tenant_id,
  relationship.external_key,
  from_person.person_id,
  to_person.person_id,
  coalesce(relationship.relationship_type, 'Family'),
  coalesce(relationship.label, ''),
  coalesce(relationship.strength, ''),
  coalesce(relationship.notes, ''),
  now()
FROM import_crm_relationships relationship
CROSS JOIN tenants tenant
JOIN people from_person
  ON from_person.tenant_id = tenant.tenant_id
 AND from_person.external_key = relationship.from_external_key
JOIN people to_person
  ON to_person.tenant_id = tenant.tenant_id
 AND to_person.external_key = relationship.to_external_key
WHERE tenant.slug = 'local-demo'
ON CONFLICT (tenant_id, external_key) WHERE external_key IS NOT NULL DO UPDATE SET
  from_person_id = excluded.from_person_id,
  to_person_id = excluded.to_person_id,
  relationship_type = excluded.relationship_type,
  label = excluded.label,
  strength = excluded.strength,
  notes = excluded.notes,
  updated_at = now();

CREATE TEMP TABLE import_crm_leads (
  external_key text,
  display_name text,
  relationship_summary text,
  phone text,
  email citext,
  status text,
  urgency text,
  budget text,
  care_needs text,
  preferred_area text,
  assigned_to_label text,
  next_step text,
  source text
);

\copy import_crm_leads FROM '/workspace/tmp/db-import/crm-leads.tsv' WITH (FORMAT csv, DELIMITER E'\t', QUOTE '"', ESCAPE '"', NULL '\N')

INSERT INTO leads (
  tenant_id,
  external_key,
  resident_person_id,
  display_name,
  relationship_summary,
  phone,
  email,
  status,
  urgency,
  budget,
  care_needs,
  preferred_area,
  assigned_to_label,
  next_step,
  source,
  updated_at
)
SELECT
  tenant.tenant_id,
  lead.external_key,
  resident.person_id,
  coalesce(lead.display_name, 'Unnamed lead'),
  coalesce(lead.relationship_summary, ''),
  coalesce(lead.phone, ''),
  lead.email,
  coalesce(lead.status, 'New'),
  coalesce(lead.urgency, ''),
  coalesce(lead.budget, ''),
  coalesce(lead.care_needs, ''),
  coalesce(lead.preferred_area, ''),
  coalesce(lead.assigned_to_label, ''),
  coalesce(lead.next_step, ''),
  coalesce(lead.source, 'prototype'),
  now()
FROM import_crm_leads lead
CROSS JOIN tenants tenant
LEFT JOIN people resident
  ON resident.tenant_id = tenant.tenant_id
 AND lower(resident.full_name) = lower(lead.display_name)
 AND resident.person_type = 'Resident'
WHERE tenant.slug = 'local-demo'
ON CONFLICT (tenant_id, external_key) WHERE external_key IS NOT NULL DO UPDATE SET
  resident_person_id = excluded.resident_person_id,
  display_name = excluded.display_name,
  relationship_summary = excluded.relationship_summary,
  phone = excluded.phone,
  email = excluded.email,
  status = excluded.status,
  urgency = excluded.urgency,
  budget = excluded.budget,
  care_needs = excluded.care_needs,
  preferred_area = excluded.preferred_area,
  assigned_to_label = excluded.assigned_to_label,
  next_step = excluded.next_step,
  source = excluded.source,
  updated_at = now();

CREATE TEMP TABLE import_crm_lead_facilities (
  lead_external_key text,
  facility_key text,
  priority integer
);

\copy import_crm_lead_facilities FROM '/workspace/tmp/db-import/crm-lead-facilities.tsv' WITH (FORMAT csv, DELIMITER E'\t', QUOTE '"', ESCAPE '"', NULL '\N')

DELETE FROM lead_facilities existing
USING leads lead, tenants tenant
WHERE existing.tenant_id = tenant.tenant_id
  AND existing.lead_id = lead.lead_id
  AND lead.tenant_id = tenant.tenant_id
  AND tenant.slug = 'local-demo'
  AND lead.external_key IN (SELECT lead_external_key FROM import_crm_lead_facilities);

INSERT INTO lead_facilities (
  tenant_id,
  lead_id,
  facility_key,
  priority,
  updated_at
)
SELECT
  tenant.tenant_id,
  lead.lead_id,
  facility.facility_key,
  coalesce(imported.priority, 0),
  now()
FROM import_crm_lead_facilities imported
CROSS JOIN tenants tenant
JOIN leads lead
  ON lead.tenant_id = tenant.tenant_id
 AND lead.external_key = imported.lead_external_key
JOIN facilities facility
  ON facility.facility_key = imported.facility_key
WHERE tenant.slug = 'local-demo'
ON CONFLICT (tenant_id, lead_id, facility_key) DO UPDATE SET
  priority = excluded.priority,
  updated_at = now();

CREATE TEMP TABLE import_crm_communications (
  external_key text,
  lead_external_key text,
  facility_key text,
  direction text,
  channel text,
  subject text,
  body text,
  occurred_at timestamptz,
  context text,
  raw_record jsonb
);

\copy import_crm_communications FROM '/workspace/tmp/db-import/crm-communications.tsv' WITH (FORMAT csv, DELIMITER E'\t', QUOTE '"', ESCAPE '"', NULL '\N')

INSERT INTO communications (
  tenant_id,
  external_key,
  lead_id,
  facility_key,
  direction,
  channel,
  subject,
  body,
  occurred_at,
  context,
  raw_record
)
SELECT
  tenant.tenant_id,
  communication.external_key,
  lead.lead_id,
  facility.facility_key,
  coalesce(communication.direction, 'Internal'),
  coalesce(communication.channel, 'Note'),
  coalesce(communication.subject, ''),
  coalesce(communication.body, ''),
  coalesce(communication.occurred_at, now()),
  coalesce(communication.context, ''),
  coalesce(communication.raw_record, '{}'::jsonb)
FROM import_crm_communications communication
CROSS JOIN tenants tenant
LEFT JOIN leads lead
  ON lead.tenant_id = tenant.tenant_id
 AND lead.external_key = communication.lead_external_key
LEFT JOIN facilities facility
  ON facility.facility_key = communication.facility_key
WHERE tenant.slug = 'local-demo'
ON CONFLICT (tenant_id, external_key) WHERE external_key IS NOT NULL DO UPDATE SET
  lead_id = excluded.lead_id,
  facility_key = excluded.facility_key,
  direction = excluded.direction,
  channel = excluded.channel,
  subject = excluded.subject,
  body = excluded.body,
  occurred_at = excluded.occurred_at,
  context = excluded.context,
  raw_record = excluded.raw_record;

COMMIT;
`);

await run("docker", psqlArgs(["-f", "/workspace/tmp/db-import/seed-crm-sample.sql"]));

console.log(JSON.stringify({
  people: state.people.length,
  relationships: state.relationships.length,
  leads: state.leads.length,
  lead_facilities: leadFacilities.length,
  communications: state.communications.length,
  input: inputPath || "built-in sample CRM data"
}, null, 2));
