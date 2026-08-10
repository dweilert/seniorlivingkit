import react from "@vitejs/plugin-react";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { defineConfig } from "vite";
import { capture, psqlArgs, run } from "../../scripts/db-utils.mjs";
import { harvestFacilityWebsite } from "../../scripts/website-contact-harvester.mjs";

const root = resolve(import.meta.dirname, "..", "..");
const dataRoot = resolve(root, "data");
const maxBodyBytes = 8 * 1024 * 1024;

function safeJoin(base, pathname) {
  const requested = normalize(pathname);
  const file = join(base, requested);
  return file.startsWith(base) ? file : null;
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function mockBusinessCardExtraction(body) {
  const filename = String(body.filename || "");
  const looksFacility = /community|facility|senior|living|care|home/i.test(filename);

  return {
    extracted_at: new Date().toISOString(),
    mode: "mock",
    confidence: 0.82,
    image: {
      filename,
      mime_type: body.mimeType || "",
      bytes: Number(body.bytes || 0)
    },
    contact: looksFacility
      ? {
          name: "Jordan Miller",
          title: "Community Relations Director",
          company: "Sample Senior Living Community",
          phone: "(512) 555-0160",
          email: "jordan.miller@example.com",
          website: "https://example.com",
          address: "1000 Wellness Way, Austin, TX 78746"
        }
      : {
          name: "Renee Ellis",
          title: "Family Contact",
          company: "",
          phone: "(512) 555-0198",
          email: "renee.ellis@example.com",
          website: "",
          address: "Austin, TX"
        },
    parsing_notes: [
      "Local prototype endpoint; no real OCR was performed.",
      "Production should store the uploaded image and call an OCR/contact extraction service.",
      "Human review should confirm extracted contact fields before saving to CRM."
    ]
  };
}

async function geocodeAddress(body) {
  const address = String(body.address || "").trim();
  if (!address) throw new Error("Address is required");

  const params = new URLSearchParams({
    address,
    benchmark: "Public_AR_Current",
    format: "json"
  });
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Census geocoder request failed: ${response.status}`);

  const payload = await response.json();
  const match = payload.result?.addressMatches?.[0];
  if (!match?.coordinates) {
    return {
      matched: false,
      input_address: address,
      provider: "US Census Geocoder",
      provider_url: "https://geocoding.geo.census.gov/geocoder/",
      benchmark: "Public_AR_Current"
    };
  }

  return {
    matched: true,
    input_address: address,
    matched_address: match.matchedAddress,
    latitude: Number(match.coordinates.y),
    longitude: Number(match.coordinates.x),
    provider: "US Census Geocoder",
    provider_url: "https://geocoding.geo.census.gov/geocoder/",
    benchmark: "Public_AR_Current"
  };
}

async function scrapeFacilityWebsite(body) {
  return harvestFacilityWebsite({
    facilityKey: body.facilityKey,
    websiteUrl: body.websiteUrl,
    maxPages: Number(body.maxPages || 4)
  });
}

function sqlLiteral(value) {
  return `'${String(value ?? "").replaceAll("'", "''")}'`;
}

function numberParam(params, key) {
  const value = params.get(key);
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function queryJson(sql) {
  const output = await capture("docker", psqlArgs(["-At", "-c", sql]));
  return JSON.parse(output.trim() || "null");
}

function preferencesFromRows(rows = []) {
  const priority = {};
  const excluded = {};
  const favorite = {};
  const notes = {};
  for (const row of rows) {
    if (row.priority > 0) priority[row.facility_key] = row.priority;
    if (row.is_excluded) excluded[row.facility_key] = true;
    if (row.is_favorite) favorite[row.facility_key] = true;
    if (row.notes) notes[row.facility_key] = row.notes;
  }
  return { priority, excluded, favorite, notes, records: rows };
}

async function facilityPreferences() {
  const result = await queryJson(`
    WITH context AS (
      SELECT tenant.tenant_id, app_user.user_id
      FROM tenants tenant
      JOIN tenant_users tenant_user ON tenant_user.tenant_id = tenant.tenant_id
      JOIN app_users app_user ON app_user.user_id = tenant_user.user_id
      WHERE tenant.slug = 'local-demo'
        AND app_user.email = 'local-demo-user@example.com'
      LIMIT 1
    )
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'facility_key', preference.facility_key,
      'priority', preference.priority,
      'is_excluded', preference.is_excluded,
      'is_favorite', preference.is_favorite,
      'notes', preference.notes,
      'updated_at', preference.updated_at
    ) ORDER BY preference.updated_at DESC), '[]'::jsonb)
    FROM facility_user_preferences preference
    JOIN context ON context.tenant_id = preference.tenant_id
      AND context.user_id = preference.user_id
  `);
  return preferencesFromRows(result);
}

async function saveFacilityPreference(body) {
  const facilityKey = String(body.facilityKey || "").trim();
  if (!facilityKey) throw new Error("facilityKey is required");
  const priority = clampNumber(Number(body.priority || 0), 0, 9);
  const isExcluded = Boolean(body.isExcluded);
  const isFavorite = Boolean(body.isFavorite);
  const notes = String(body.notes || "").trim();

  if (!priority && !isExcluded && !isFavorite && !notes) {
    await queryJson(`
      WITH context AS (
        SELECT tenant.tenant_id, app_user.user_id
        FROM tenants tenant
        JOIN tenant_users tenant_user ON tenant_user.tenant_id = tenant.tenant_id
        JOIN app_users app_user ON app_user.user_id = tenant_user.user_id
        WHERE tenant.slug = 'local-demo'
          AND app_user.email = 'local-demo-user@example.com'
        LIMIT 1
      ),
      deleted AS (
        DELETE FROM facility_user_preferences preference
        USING context
        WHERE preference.tenant_id = context.tenant_id
          AND preference.user_id = context.user_id
          AND preference.facility_key = ${sqlLiteral(facilityKey)}
        RETURNING preference.facility_key
      )
      SELECT jsonb_build_object('deleted', (SELECT count(*) FROM deleted))
    `);
    return facilityPreferences();
  }

  await queryJson(`
    WITH context AS (
      SELECT tenant.tenant_id, app_user.user_id
      FROM tenants tenant
      JOIN tenant_users tenant_user ON tenant_user.tenant_id = tenant.tenant_id
      JOIN app_users app_user ON app_user.user_id = tenant_user.user_id
      WHERE tenant.slug = 'local-demo'
        AND app_user.email = 'local-demo-user@example.com'
      LIMIT 1
    ),
    upserted AS (
      INSERT INTO facility_user_preferences (
        tenant_id,
        user_id,
        facility_key,
        priority,
        is_excluded,
        is_favorite,
        notes,
        updated_at
      )
      SELECT
        context.tenant_id,
        context.user_id,
        ${sqlLiteral(facilityKey)},
        ${priority},
        ${isExcluded},
        ${isFavorite},
        ${sqlLiteral(notes)},
        now()
      FROM context
      JOIN facilities facility ON facility.facility_key = ${sqlLiteral(facilityKey)}
      ON CONFLICT (tenant_id, user_id, facility_key) DO UPDATE SET
        priority = excluded.priority,
        is_excluded = excluded.is_excluded,
        is_favorite = excluded.is_favorite,
        notes = excluded.notes,
        updated_at = now()
      RETURNING facility_key
    )
    SELECT jsonb_build_object('saved', (SELECT count(*) FROM upserted))
  `);
  return facilityPreferences();
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

async function facilitySearch(params) {
  const query = String(params.get("q") || "").trim();
  const state = String(params.get("state") || "").trim();
  const category = String(params.get("category") || "").trim();
  const care = String(params.get("care") || "").trim();
  const zip = String(params.get("zip") || "").trim();
  const minBeds = numberParam(params, "minBeds");
  const maxBeds = numberParam(params, "maxBeds");
  const latitude = numberParam(params, "latitude");
  const longitude = numberParam(params, "longitude");
  const miles = numberParam(params, "miles");
  const limit = Math.min(Math.max(Number(params.get("limit") || 5000), 1), 50000);
  const conditions = ["facility.is_active = true"];
  const orderTerms = [];

  if (query) {
    const term = `%${query}%`;
    conditions.push(`(
      facility.facility_name ILIKE ${sqlLiteral(term)}
      OR facility.address ILIKE ${sqlLiteral(term)}
      OR facility.city ILIKE ${sqlLiteral(term)}
      OR facility.county ILIKE ${sqlLiteral(term)}
      OR facility.zip ILIKE ${sqlLiteral(term)}
      OR facility.program_type ILIKE ${sqlLiteral(term)}
      OR facility.care_category ILIKE ${sqlLiteral(term)}
    )`);
  }
  if (state) conditions.push(`facility.state = ${sqlLiteral(state)}`);
  if (category) conditions.push(`facility.care_category = ${sqlLiteral(category)}`);
  if (care) conditions.push(`facility.program_type = ${sqlLiteral(care)}`);
  if (zip) conditions.push(`facility.zip LIKE ${sqlLiteral(`${zip}%`)}`);
  if (minBeds != null) conditions.push(`facility.capacity >= ${minBeds}`);
  if (maxBeds != null) conditions.push(`facility.capacity <= ${maxBeds}`);
  if (latitude != null && longitude != null && miles != null) {
    const meters = Math.max(miles, 0) * 1609.344;
    conditions.push(`facility.geog IS NOT NULL`);
    conditions.push(`ST_DWithin(facility.geog, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography, ${meters})`);
    orderTerms.push(`ST_Distance(facility.geog, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography)`);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const orderBy = [...orderTerms, "facility.state", "facility.city", "facility.facility_name"].join(", ");

  return queryJson(`
    WITH filtered AS (
      SELECT
        facility.*,
        source.name AS source_name,
        contact.website_url,
        ${latitude != null && longitude != null ? `CASE
          WHEN facility.geog IS NOT NULL
          THEN round((ST_Distance(facility.geog, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography) / 1609.344)::numeric, 2)
          ELSE NULL
        END` : "NULL::numeric"} AS distance_miles
      FROM facilities facility
      JOIN facility_sources source ON source.source_id = facility.source_id
      LEFT JOIN LATERAL (
        SELECT website_url
        FROM facility_contacts contact
        WHERE contact.facility_key = facility.facility_key
          AND contact.website_url <> ''
        ORDER BY contact.checked_at DESC NULLS LAST, contact.updated_at DESC
        LIMIT 1
      ) contact ON true
      ${where}
      ORDER BY ${orderBy}
      LIMIT ${limit}
    )
    SELECT jsonb_build_object(
      'records', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'facility_key', facility_key,
          'facility_name', facility_name,
          'care_category', care_category,
          'program_type', program_type,
          'address', address,
          'city', city,
          'county', county,
          'state', state,
          'zip', zip,
          'phone', phone,
          'fax', fax,
          'capacity', capacity,
          'licensee', licensee,
          'administrator', administrator,
          'facility_status', facility_status,
          'is_active', is_active,
          'latitude', latitude,
          'longitude', longitude,
          'source_id', source_id,
          'source_name', source_name,
          'source_facility_id', source_facility_id,
          'source_url', source_url,
          'source_owner', source_owner,
          'source_detail', source_detail,
          'website_url', coalesce(website_url, ''),
          'distance_miles', distance_miles
        ))
        FROM filtered
      ), '[]'::jsonb),
      'total_matching', (SELECT count(*) FROM facilities facility ${where}),
      'total_active', (SELECT count(*) FROM facilities WHERE is_active = true),
      'limit', ${limit},
      'states', (
        SELECT coalesce(jsonb_agg(state_row.state ORDER BY state_row.state), '[]'::jsonb)
        FROM (SELECT DISTINCT state FROM facilities WHERE is_active = true AND state <> '') state_row
      ),
      'care_options', (
        SELECT coalesce(jsonb_agg(care_row.program_type ORDER BY care_row.program_type), '[]'::jsonb)
        FROM (SELECT DISTINCT program_type FROM facilities WHERE is_active = true AND program_type <> '') care_row
      ),
      'categories', (
        SELECT coalesce(jsonb_agg(category_row.care_category ORDER BY category_row.care_category), '[]'::jsonb)
        FROM (SELECT DISTINCT care_category FROM facilities WHERE is_active = true AND care_category <> '') category_row
      )
    )
  `);
}

async function advisorSummary() {
  return queryJson(`
    SELECT jsonb_build_object(
      'total_records', (SELECT count(*) FROM advisor_records),
      'seniorplace_records', (SELECT count(*) FROM advisor_records WHERE source_id = 'seniorplace-advisor-directory'),
      'csa_locator_records', (SELECT count(*) FROM advisor_records WHERE source_id = 'society-certified-senior-advisors-locator'),
      'matched_records', (SELECT count(DISTINCT left_advisor_record_key) FROM advisor_record_matches),
      'with_email', (SELECT count(*) FROM advisor_records WHERE jsonb_array_length(emails) > 0),
      'with_phone', (SELECT count(*) FROM advisor_records WHERE jsonb_array_length(phone_numbers) > 0),
      'top_industries', (
        SELECT coalesce(jsonb_agg(row_to_json(industry_row)), '[]'::jsonb)
        FROM (
          SELECT main_industry, count(*)::int AS count
          FROM advisor_records
          WHERE source_id = 'society-certified-senior-advisors-locator'
            AND main_industry <> ''
          GROUP BY main_industry
          ORDER BY count(*) DESC, main_industry
          LIMIT 8
        ) industry_row
      )
    )
  `);
}

async function advisorSearch(params) {
  const query = String(params.get("q") || "").trim();
  const source = String(params.get("source") || "").trim();
  const state = String(params.get("state") || "").trim();
  const industry = String(params.get("industry") || "").trim();
  const limit = Math.min(Math.max(Number(params.get("limit") || 80), 1), 250);
  const conditions = [];
  if (query) {
    const term = `%${query}%`;
    conditions.push(`(name ILIKE ${sqlLiteral(term)} OR agency ILIKE ${sqlLiteral(term)} OR summary ILIKE ${sqlLiteral(term)} OR operational_approach ILIKE ${sqlLiteral(term)} OR main_industry ILIKE ${sqlLiteral(term)})`);
  }
  if (source) conditions.push(`source_id = ${sqlLiteral(source)}`);
  if (state) conditions.push(`state = ${sqlLiteral(state)}`);
  if (industry) conditions.push(`main_industry = ${sqlLiteral(industry)}`);
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return queryJson(`
    WITH filtered AS (
      SELECT *
      FROM advisor_records
      ${where}
      ORDER BY
        CASE WHEN source_id = 'seniorplace-advisor-directory' THEN 0 ELSE 1 END,
        name
      LIMIT ${limit}
    )
    SELECT jsonb_build_object(
      'records', coalesce(jsonb_agg(jsonb_build_object(
        'advisor_record_key', f.advisor_record_key,
        'source_id', f.source_id,
        'source_record_id', f.source_record_id,
        'name', f.name,
        'agency', f.agency,
        'certified_since', f.certified_since,
        'locations', f.locations,
        'location', f.location,
        'city', f.city,
        'state', f.state,
        'zip', f.zip,
        'main_industry', f.main_industry,
        'website_urls', f.website_urls,
        'phone_numbers', f.phone_numbers,
        'emails', f.emails,
        'certifications', f.certifications,
        'summary', f.summary,
        'operational_approach', f.operational_approach,
        'detail_url', f.detail_url,
        'source_page_url', f.source_page_url,
        'source_url', f.source_url,
        'match_count', (
          SELECT count(*)::int
          FROM advisor_record_matches m
          WHERE m.left_advisor_record_key = f.advisor_record_key
             OR m.right_advisor_record_key = f.advisor_record_key
        )
      )), '[]'::jsonb),
      'total_matching', (SELECT count(*) FROM advisor_records ${where}),
      'limit', ${limit},
      'states', (
        SELECT coalesce(jsonb_agg(state_row.state ORDER BY state_row.state), '[]'::jsonb)
        FROM (SELECT DISTINCT state FROM advisor_records WHERE state <> '') state_row
      ),
      'industries', (
        SELECT coalesce(jsonb_agg(industry_row.main_industry ORDER BY industry_row.main_industry), '[]'::jsonb)
        FROM (SELECT DISTINCT main_industry FROM advisor_records WHERE main_industry <> '') industry_row
      )
    )
    FROM filtered f
  `);
}

async function crmState() {
  return queryJson(`
    WITH tenant AS (
      SELECT tenant_id
      FROM tenants
      WHERE slug = 'local-demo'
      LIMIT 1
    ),
    lead_rows AS (
      SELECT
        lead.*,
        coalesce((
          SELECT jsonb_agg(link.facility_key ORDER BY link.priority, link.created_at)
          FROM lead_facilities link
          WHERE link.tenant_id = lead.tenant_id
            AND link.lead_id = lead.lead_id
        ), '[]'::jsonb) AS linked_facilities
      FROM leads lead
      JOIN tenant ON tenant.tenant_id = lead.tenant_id
    ),
    people_rows AS (
      SELECT person.*
      FROM people person
      JOIN tenant ON tenant.tenant_id = person.tenant_id
    ),
    relationship_rows AS (
      SELECT
        relationship.*,
        from_person.external_key AS from_external_key,
        to_person.external_key AS to_external_key
      FROM person_relationships relationship
      JOIN tenant ON tenant.tenant_id = relationship.tenant_id
      JOIN people from_person ON from_person.person_id = relationship.from_person_id
      JOIN people to_person ON to_person.person_id = relationship.to_person_id
    ),
    communication_rows AS (
      SELECT
        communication.*,
        lead.external_key AS lead_external_key
      FROM communications communication
      JOIN tenant ON tenant.tenant_id = communication.tenant_id
      LEFT JOIN leads lead ON lead.lead_id = communication.lead_id
    )
    SELECT jsonb_build_object(
      'leads', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', coalesce(external_key, lead_id::text),
          'name', display_name,
          'relationship', relationship_summary,
          'phone', phone,
          'email', coalesce(email::text, ''),
          'status', status,
          'urgency', urgency,
          'budget', budget,
          'careNeeds', care_needs,
          'preferredArea', preferred_area,
          'assignedTo', assigned_to_label,
          'nextStep', next_step,
          'source', source,
          'linkedFacilities', linked_facilities
        ) ORDER BY created_at, display_name)
        FROM lead_rows
      ), '[]'::jsonb),
      'communications', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', coalesce(external_key, communication_id::text),
          'leadId', coalesce(lead_external_key, ''),
          'facilityKey', coalesce(facility_key, ''),
          'direction', direction,
          'channel', channel,
          'date', to_char(occurred_at AT TIME ZONE 'America/Chicago', 'Mon FMDD, YYYY FMHH12:MI AM'),
          'timestamp', occurred_at,
          'subject', subject,
          'body', body,
          'context', context
        ) ORDER BY occurred_at)
        FROM communication_rows
      ), '[]'::jsonb),
      'people', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', coalesce(external_key, person_id::text),
          'name', full_name,
          'type', person_type,
          'age', age,
          'phone', phone,
          'email', coalesce(email::text, ''),
          'city', city,
          'state', state,
          'zip', zip,
          'latitude', latitude,
          'longitude', longitude,
          'notes', notes
        ) ORDER BY created_at, full_name)
        FROM people_rows
      ), '[]'::jsonb),
      'relationships', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', coalesce(external_key, relationship_id::text),
          'from', from_external_key,
          'to', to_external_key,
          'type', relationship_type,
          'label', label,
          'strength', strength,
          'notes', notes
        ) ORDER BY created_at)
        FROM relationship_rows
      ), '[]'::jsonb),
      'loaded_at', now()
    )
  `);
}

async function saveCrmState(body) {
  if (!Array.isArray(body.leads) || !Array.isArray(body.communications) || !Array.isArray(body.people) || !Array.isArray(body.relationships)) {
    throw new Error("CRM state must include leads, communications, people, and relationships arrays");
  }

  const tmpRoot = resolve(root, "tmp", "db-import");
  await mkdir(tmpRoot, { recursive: true });
  const filename = `crm-state-${Date.now()}-${Math.random().toString(16).slice(2)}.json`;
  const hostPath = resolve(tmpRoot, filename);
  await writeFile(hostPath, JSON.stringify(body, null, 2));
  await run("node", ["scripts/db-seed-crm-sample.mjs", `--input=tmp/db-import/${filename}`], {
    spawnOptions: { cwd: root }
  });
  return { saved: true, saved_at: new Date().toISOString() };
}

function facilityPrototypeApi() {
  const contentTypes = new Map([
    [".json", "application/json; charset=utf-8"],
    [".csv", "text/csv; charset=utf-8"]
  ]);

  return {
    name: "facility-prototype-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || "/", "http://127.0.0.1");
        if (req.method === "POST" && url.pathname === "/api/business-card/ocr") {
          try {
            const result = mockBusinessCardExtraction(await readJsonBody(req));
            res.writeHead(200, {
              "cache-control": "no-store",
              "content-type": "application/json; charset=utf-8"
            });
            res.end(JSON.stringify(result));
          } catch (error) {
            res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: error.message }));
          }
          return;
        }

        if (req.method === "POST" && url.pathname === "/api/geocode/address") {
          try {
            const result = await geocodeAddress(await readJsonBody(req));
            res.writeHead(200, {
              "cache-control": "no-store",
              "content-type": "application/json; charset=utf-8"
            });
            res.end(JSON.stringify(result));
          } catch (error) {
            res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: error.message }));
          }
          return;
        }

        if (req.method === "POST" && url.pathname === "/api/facility/contact-info") {
          try {
            const result = await scrapeFacilityWebsite(await readJsonBody(req));
            res.writeHead(200, {
              "cache-control": "no-store",
              "content-type": "application/json; charset=utf-8"
            });
            res.end(JSON.stringify(result));
          } catch (error) {
            res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: error.message }));
          }
          return;
        }

        if (req.method === "GET" && url.pathname === "/api/facilities/search") {
          try {
            const result = await facilitySearch(url.searchParams);
            res.writeHead(200, {
              "cache-control": "no-store",
              "content-type": "application/json; charset=utf-8"
            });
            res.end(JSON.stringify(result));
          } catch (error) {
            res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: error.message }));
          }
          return;
        }

        if (req.method === "GET" && url.pathname === "/api/facility-preferences") {
          try {
            const result = await facilityPreferences();
            res.writeHead(200, {
              "cache-control": "no-store",
              "content-type": "application/json; charset=utf-8"
            });
            res.end(JSON.stringify(result));
          } catch (error) {
            res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: error.message }));
          }
          return;
        }

        if (req.method === "PUT" && url.pathname === "/api/facility-preferences") {
          try {
            const result = await saveFacilityPreference(await readJsonBody(req));
            res.writeHead(200, {
              "cache-control": "no-store",
              "content-type": "application/json; charset=utf-8"
            });
            res.end(JSON.stringify(result));
          } catch (error) {
            res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: error.message }));
          }
          return;
        }

        if (req.method === "GET" && url.pathname === "/api/advisors/summary") {
          try {
            const result = await advisorSummary();
            res.writeHead(200, {
              "cache-control": "no-store",
              "content-type": "application/json; charset=utf-8"
            });
            res.end(JSON.stringify(result));
          } catch (error) {
            res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: error.message }));
          }
          return;
        }

        if (req.method === "GET" && url.pathname === "/api/advisors/search") {
          try {
            const result = await advisorSearch(url.searchParams);
            res.writeHead(200, {
              "cache-control": "no-store",
              "content-type": "application/json; charset=utf-8"
            });
            res.end(JSON.stringify(result));
          } catch (error) {
            res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: error.message }));
          }
          return;
        }

        if (req.method === "GET" && url.pathname === "/api/crm/state") {
          try {
            const result = await crmState();
            res.writeHead(200, {
              "cache-control": "no-store",
              "content-type": "application/json; charset=utf-8"
            });
            res.end(JSON.stringify(result));
          } catch (error) {
            res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: error.message }));
          }
          return;
        }

        if (req.method === "PUT" && url.pathname === "/api/crm/state") {
          try {
            const result = await saveCrmState(await readJsonBody(req));
            res.writeHead(200, {
              "cache-control": "no-store",
              "content-type": "application/json; charset=utf-8"
            });
            res.end(JSON.stringify(result));
          } catch (error) {
            res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: error.message }));
          }
          return;
        }

        if (req.method === "GET" && url.pathname.startsWith("/data/")) {
          const file = safeJoin(dataRoot, url.pathname.replace(/^\/data/, ""));
          if (!file) {
            res.writeHead(403);
            res.end("Forbidden");
            return;
          }
          try {
            const body = await readFile(file);
            res.writeHead(200, {
              "cache-control": "no-store",
              "content-type": contentTypes.get(extname(file)) || "application/octet-stream"
            });
            res.end(body);
          } catch {
            res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
            res.end("Not found");
          }
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), facilityPrototypeApi()],
  root: import.meta.dirname,
  server: {
    host: "127.0.0.1",
    port: Number(process.env.PORT || 3200)
  }
});
