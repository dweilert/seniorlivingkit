import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const FACILITY_SOURCES = {
  "tx-hhsc-assisted-living": {
    id: "tx-hhsc-assisted-living",
    name: "Texas HHSC Assisted Living Facilities",
    jurisdiction: "TX",
    careCategory: "assisted_living",
    sourceOwner: "Texas Health and Human Services Commission",
    sourceSystem: "ArcGIS FeatureServer",
    sourceUrl: "https://services1.arcgis.com/jI1j5lArZnrgFYSc/ArcGIS/rest/services/Assisted_Living/FeatureServer/0",
    endpointUrl: "https://services1.arcgis.com/jI1j5lArZnrgFYSc/ArcGIS/rest/services/Assisted_Living/FeatureServer/0/query",
    sourceDescription: "Public map layer for assisted living facilities regulated by Texas HHSC.",
    exportNamePrefix: "texas-assisted-living",
    activeStatuses: [],
    defaultCenter: {
      id: "austin-tx",
      label: "Austin, TX",
      latitude: 30.2672,
      longitude: -97.7431
    },
    fields: [
      "FacName",
      "FacID",
      "ProgTyp",
      "County",
      "Address",
      "City",
      "State",
      "Zipcode",
      "X",
      "Y",
      "Phone",
      "Fax",
      "TotCap"
    ],
    parsingNotes: [
      "ArcGIS records are paginated with resultOffset/resultRecordCount and ordered by OBJECTID.",
      "Facility attributes are read from feature.attributes; geometry is not requested because X/Y fields are already present.",
      "State values of TEXAS or blank are normalized to TX.",
      "Capacity is parsed from TotCap as a number when present.",
      "Distance is computed with the Haversine formula from the configured center point.",
      "Records are sorted by computed distance, then facility name, before applying the limit."
    ]
  },
  "ca-cdss-rcfe": {
    id: "ca-cdss-rcfe",
    name: "California CDSS Residential Care Facilities for the Elderly",
    jurisdiction: "CA",
    careCategory: "assisted_living",
    sourceOwner: "California Department of Social Services",
    sourceSystem: "CKAN datastore",
    sourceUrl: "https://lab.data.ca.gov/dataset/community-care-licensing-facilities/6b2f5818-f60d-40b5-bc2a-94f995f9f8b0",
    endpointUrl: "https://data.ca.gov/api/action/datastore_search",
    resourceId: "6b2f5818-f60d-40b5-bc2a-94f995f9f8b0",
    sourceDescription: "Public open-data table for California Residential Care Facilities for the Elderly.",
    exportNamePrefix: "california-rcfe",
    activeStatuses: ["LICENSED", "ON PROBATION"],
    defaultCenter: {
      id: "california",
      label: "California",
      latitude: null,
      longitude: null
    },
    parsingNotes: [
      "CKAN datastore records are paginated with offset/limit against the resource ID.",
      "Residential Care Facilities for the Elderly are treated as assisted living facilities.",
      "Facility number is preserved as source_facility_id and used for stable facility_key generation.",
      "The source does not currently expose latitude/longitude; optional Census Geocoder enrichment can fill coordinates.",
      "Licensee, administrator, status, license dates, regional office, and file date are preserved as source-supplied fields.",
      "Records are sorted by facility name, then source facility ID, before applying the limit."
    ]
  },
  "cms-nursing-home-provider-info": {
    id: "cms-nursing-home-provider-info",
    name: "CMS Nursing Home Provider Information",
    jurisdiction: "US",
    careCategory: "skilled_nursing",
    sourceOwner: "Centers for Medicare & Medicaid Services",
    sourceSystem: "CMS Provider Data API",
    sourceUrl: "https://data.cms.gov/provider-data/dataset/4pq5-n9py",
    endpointUrl: "https://data.cms.gov/provider-data/api/1/datastore/query/4pq5-n9py/0",
    datasetId: "4pq5-n9py",
    sourceDescription: "National CMS Provider Data Catalog table for currently active nursing homes/skilled nursing facilities, including address, phone, certified beds, ownership, and Five-Star ratings.",
    exportNamePrefix: "cms-nursing-home-provider-info",
    activeStatuses: [],
    defaultCenter: {
      id: "united-states",
      label: "United States",
      latitude: null,
      longitude: null
    },
    parsingNotes: [
      "CMS Provider Data records are paginated with offset and limit from the Provider Data API datastore endpoint.",
      "CMS Certification Number (CCN) is preserved as source_facility_id and used for stable facility_key generation.",
      "Number of Certified Beds is parsed as numeric capacity.",
      "Latitude/longitude are source-supplied CMS geocoded coordinates when available.",
      "Overall, health inspection, staffing, and quality-measure ratings are preserved in source_detail.",
      "Records are sorted by state, city, then provider name before applying the limit."
    ]
  },
  "hud-section-202-properties": {
    id: "hud-section-202-properties",
    name: "HUD Section 202 Properties",
    jurisdiction: "US",
    careCategory: "age_55_plus",
    sourceOwner: "U.S. Department of Housing and Urban Development",
    sourceSystem: "ArcGIS FeatureServer",
    sourceUrl: "https://catalog.data.gov/dataset/section-202-properties-5a638",
    endpointUrl: "https://services.arcgis.com/VTyQ9soqVukalItT/arcgis/rest/services/HUD_Section_202_Properties/FeatureServer/0/query",
    sourceDescription: "HUD assisted multifamily properties that primarily serve elderly residents.",
    exportNamePrefix: "hud-section-202-properties",
    activeStatuses: [],
    defaultCenter: {
      id: "united-states",
      label: "United States",
      latitude: null,
      longitude: null
    },
    fields: [
      "PROPERTY_ID",
      "PROPERTY_NAME_TEXT",
      "ADDRESS_LINE1_TEXT",
      "ADDRESS_LINE2_TEXT",
      "PLACED_BASE_CITY_NAME_TEXT",
      "STD_ADDR",
      "STD_CITY",
      "STD_ST",
      "STD_ZIP5",
      "CURCNTY_NM",
      "TOTAL_ASSISTED_UNIT_COUNT",
      "TOTAL_UNIT_COUNT",
      "PROPERTY_ON_SITE_PHONE_NUMBER",
      "PROPERTY_CATEGORY_NAME",
      "CLIENT_GROUP_NAME",
      "CLIENT_GROUP_TYPE",
      "HAS_ACTIVE_ASSISTANCE_IND",
      "HAS_ACTIVE_FINANCING_IND",
      "PRIMARY_FINANCING_TYPE",
      "IS_ASSISTED_LIVING_IND",
      "IS_NURSING_HOME_IND",
      "PROGRAM_TYPE1",
      "PROGRAM_TYPE2",
      "MGMT_AGENT_ORG_NAME",
      "MGMT_CONTACT_FULL_NAME",
      "MGMT_CONTACT_INDV_TITLE_TEXT",
      "MGMT_CONTACT_MAIN_PHN_NBR",
      "MGMT_CONTACT_EMAIL_TEXT",
      "LAT",
      "LON",
      "LAST_UPDT_DTTM"
    ],
    parsingNotes: [
      "ArcGIS records are paginated with resultOffset/resultRecordCount and ordered by OBJECTID.",
      "HUD Section 202 properties are normalized as age_55_plus because this source identifies elderly-serving assisted multifamily housing, not licensed care services.",
      "PROPERTY_ID is preserved as source_facility_id and used for stable facility_key generation.",
      "TOTAL_UNIT_COUNT is mapped to capacity; TOTAL_ASSISTED_UNIT_COUNT is preserved in source_detail.",
      "LAT/LON are HUD source-supplied geocoded coordinates.",
      "Management organization, manager contact name, phone, and email are preserved in source_detail as source-supplied contact metadata."
    ]
  }
};

const DEFAULT_LIMIT = 300;
const DEFAULT_OUT_DIR = resolve(root, "data", "facilities");
const ALL_RECORDS = "all";
const CENSUS_BATCH_SIZE = 10000;
const CENSUS_BATCH_URL = "https://geocoding.geo.census.gov/geocoder/locations/addressbatch";
const CENSUS_BENCHMARK = "Public_AR_Current";

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function compactHash(value) {
  return sha256(value).slice(0, 16);
}

function normalizeText(value) {
  return value == null ? "" : String(value).trim();
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
}

function normalizeState(value, fallback = "") {
  const state = normalizeText(value).toUpperCase();
  if (!state || state === "TEXAS") return fallback || "TX";
  return state;
}

function activeStatus(source, status) {
  if (!source.activeStatuses?.length) return true;
  return source.activeStatuses.includes(normalizeText(status).toUpperCase());
}

function toNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function geocodeAddressKey(record) {
  return sha256([
    normalizeText(record.address).toUpperCase(),
    normalizeText(record.city).toUpperCase(),
    normalizeText(record.state).toUpperCase(),
    normalizeText(record.zip)
  ].join("|"));
}

function censusBatchCsv(records) {
  return `${records.map((record) => [
    csvEscape(record.facility_key),
    csvEscape(record.address),
    csvEscape(record.city),
    csvEscape(record.state),
    csvEscape(record.zip)
  ].join(",")).join("\n")}\n`;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      if (quoted && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function parseCensusBatchResponse(text) {
  const matches = new Map();
  const lines = text.split(/\r?\n/).filter(Boolean);

  for (const line of lines) {
    const columns = parseCsvLine(line);
    const [facilityKey, inputAddress, matchStatus, matchType, matchedAddress, coordinates] = columns;
    const [longitude, latitude] = normalizeText(coordinates).split(",").map((value) => toNumber(value));
    matches.set(facilityKey, {
      facility_key: facilityKey,
      input_address: inputAddress,
      match_status: normalizeText(matchStatus),
      match_type: normalizeText(matchType),
      matched_address: normalizeText(matchedAddress),
      latitude,
      longitude,
      raw_columns: columns
    });
  }

  return matches;
}

async function readJsonIfExists(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function fetchCensusBatch(records, { fetchImpl = globalThis.fetch } = {}) {
  const csv = censusBatchCsv(records);
  const form = new FormData();
  form.append("benchmark", CENSUS_BENCHMARK);
  form.append("addressFile", new Blob([csv], { type: "text/csv" }), "addresses.csv");

  const response = await fetchImpl(CENSUS_BATCH_URL, {
    method: "POST",
    body: form
  });
  if (!response.ok) throw new Error(`Census geocoder request failed: ${response.status} ${response.statusText}`);

  return parseCensusBatchResponse(await response.text());
}

export async function enrichWithCensusGeocodes(records, options = {}) {
  const cachePath = resolve(options.cachePath ?? resolve(options.outDir ?? DEFAULT_OUT_DIR, "geocoding", "census-cache.json"));
  const cache = await readJsonIfExists(cachePath, {});
  const geocodeLimit = options.geocodeLimit ?? Number.POSITIVE_INFINITY;
  const eligible = records.filter((record) => (
    (record.latitude == null || record.longitude == null)
    && record.address
    && record.city
    && record.state
  ));
  const uncached = [];
  let cacheHits = 0;

  for (const record of eligible) {
    const cached = cache[geocodeAddressKey(record)];
    if (cached) cacheHits += 1;
    else if (uncached.length < geocodeLimit) uncached.push(record);
  }

  const fetchedMatches = new Map();
  for (let offset = 0; offset < uncached.length; offset += CENSUS_BATCH_SIZE) {
    const chunk = uncached.slice(offset, offset + CENSUS_BATCH_SIZE);
    const matches = await fetchCensusBatch(chunk, options);
    for (const [key, match] of matches) fetchedMatches.set(key, match);
  }

  for (const record of uncached) {
    const match = fetchedMatches.get(record.facility_key);
    cache[geocodeAddressKey(record)] = {
      geocode_source: "US Census Geocoder",
      geocode_source_url: CENSUS_BATCH_URL,
      geocode_benchmark: CENSUS_BENCHMARK,
      geocode_retrieved_at: options.retrievedAt ?? new Date().toISOString(),
      geocode_match_status: match?.match_status || "No_Match",
      geocode_match_type: match?.match_type || "",
      geocode_matched_address: match?.matched_address || "",
      latitude: match?.latitude ?? null,
      longitude: match?.longitude ?? null
    };
  }

  const enriched = records.map((record) => {
    if (record.latitude != null && record.longitude != null) {
      return {
        ...record,
        geocode_source: "source",
        geocode_source_url: record.source_url,
        geocode_benchmark: "",
        geocode_retrieved_at: "",
        geocode_match_status: "Source coordinate",
        geocode_match_type: "",
        geocode_matched_address: ""
      };
    }

    const cached = cache[geocodeAddressKey(record)];
    if (!cached || cached.latitude == null || cached.longitude == null) {
      return {
        ...record,
        geocode_source: cached?.geocode_source || "",
        geocode_source_url: cached?.geocode_source_url || "",
        geocode_benchmark: cached?.geocode_benchmark || "",
        geocode_retrieved_at: cached?.geocode_retrieved_at || "",
        geocode_match_status: cached?.geocode_match_status || "",
        geocode_match_type: cached?.geocode_match_type || "",
        geocode_matched_address: cached?.geocode_matched_address || ""
      };
    }

    return {
      ...record,
      latitude: cached.latitude,
      longitude: cached.longitude,
      distance_miles_from_center: null,
      geocode_source: cached.geocode_source,
      geocode_source_url: cached.geocode_source_url,
      geocode_benchmark: cached.geocode_benchmark,
      geocode_retrieved_at: cached.geocode_retrieved_at,
      geocode_match_status: cached.geocode_match_status,
      geocode_match_type: cached.geocode_match_type,
      geocode_matched_address: cached.geocode_matched_address
    };
  });

  const matchedRecords = enriched.filter((record) => record.geocode_source === "US Census Geocoder" && record.latitude != null && record.longitude != null).length;
  const report = {
    provider: "US Census Geocoder",
    provider_url: CENSUS_BATCH_URL,
    benchmark: CENSUS_BENCHMARK,
    cache_path: cachePath,
    eligible_records: eligible.length,
    cache_hits: cacheHits,
    requested_records: uncached.length,
    matched_records: matchedRecords,
    unmatched_records: eligible.length - matchedRecords,
    parsing_notes: [
      "Submitted Census batch CSV as Unique ID, Street address, City, State, ZIP.",
      "Parsed Census output coordinates from the longitude,latitude column.",
      "Cached results by normalized address hash so daily runs do not resubmit unchanged addresses.",
      "Census coordinates are interpolated from MAF/TIGER address ranges and may not identify the exact building footprint."
    ]
  };

  await writeJson(cachePath, cache);
  return { records: enriched, report };
}

function normalizeKeyPart(value) {
  return normalizeText(value)
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
}

function facilityKey(source, attributes) {
  const sourceFacilityId = normalizeKeyPart(attributes.FacID);
  if (sourceFacilityId) return `${source.id}:${sourceFacilityId}`;

  const fallback = [
    attributes.FacName,
    attributes.Address,
    attributes.City,
    attributes.Zipcode
  ].map(normalizeKeyPart).filter(Boolean).join("|");

  return `${source.id}:derived-${compactHash(fallback)}`;
}

function keyedFacilityKey(source, idValue, fallbackParts) {
  const sourceFacilityId = normalizeKeyPart(idValue);
  if (sourceFacilityId) return `${source.id}:${sourceFacilityId}`;

  const fallback = fallbackParts.map(normalizeKeyPart).filter(Boolean).join("|");
  return `${source.id}:derived-${compactHash(fallback)}`;
}

function haversineMiles(from, to) {
  if (!Number.isFinite(from.latitude) || !Number.isFinite(from.longitude)) return null;
  if (!Number.isFinite(to.latitude) || !Number.isFinite(to.longitude)) return null;

  const radiusMiles = 3958.8;
  const radians = (degrees) => degrees * Math.PI / 180;
  const deltaLat = radians(to.latitude - from.latitude);
  const deltaLon = radians(to.longitude - from.longitude);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(deltaLon / 2) ** 2;

  return 2 * radiusMiles * Math.asin(Math.sqrt(a));
}

function arcgisQueryUrl(source, offset, pageSize) {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: source.fields.join(","),
    returnGeometry: "false",
    f: "json",
    resultOffset: String(offset),
    resultRecordCount: String(pageSize),
    orderByFields: "OBJECTID"
  });

  return `${source.endpointUrl}?${params.toString()}`;
}

export async function fetchArcgisFeatures(source, { fetchImpl = globalThis.fetch, pageSize = 1000 } = {}) {
  const features = [];
  const pages = [];

  for (let offset = 0; ; offset += pageSize) {
    const url = arcgisQueryUrl(source, offset, pageSize);
    const response = await fetchImpl(url);
    if (!response.ok) throw new Error(`Source request failed: ${response.status} ${response.statusText}`);

    const page = await response.json();
    if (page.error) throw new Error(`Source returned an error: ${JSON.stringify(page.error)}`);

    const pageFeatures = page.features ?? [];
    pages.push({
      offset,
      returned: pageFeatures.length,
      exceededTransferLimit: Boolean(page.exceededTransferLimit)
    });
    features.push(...pageFeatures);

    if (pageFeatures.length < pageSize) break;
  }

  return { features, pages };
}

function ckanQueryUrl(source, offset, pageSize) {
  const params = new URLSearchParams({
    resource_id: source.resourceId,
    limit: String(pageSize),
    offset: String(offset)
  });

  return `${source.endpointUrl}?${params.toString()}`;
}

export async function fetchCkanRecords(source, { fetchImpl = globalThis.fetch, pageSize = 5000 } = {}) {
  const records = [];
  const pages = [];
  let total = null;

  for (let offset = 0; ; offset += pageSize) {
    const url = ckanQueryUrl(source, offset, pageSize);
    const response = await fetchImpl(url);
    if (!response.ok) throw new Error(`Source request failed: ${response.status} ${response.statusText}`);

    const page = await response.json();
    if (!page.success) throw new Error(`Source returned an error: ${JSON.stringify(page.error ?? page)}`);

    const pageRecords = page.result?.records ?? [];
    total = page.result?.total ?? total;
    pages.push({
      offset,
      returned: pageRecords.length,
      total
    });
    records.push(...pageRecords);

    if (pageRecords.length < pageSize || records.length >= total) break;
  }

  return { features: records, pages };
}

function cmsQueryUrl(source, offset, pageSize) {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(pageSize),
    count: "true",
    results: "true",
    format: "json",
    rowIds: "false"
  });

  return `${source.endpointUrl}?${params.toString()}`;
}

export async function fetchCmsProviderData(source, { fetchImpl = globalThis.fetch, pageSize = 1500, maxRecords = null } = {}) {
  const records = [];
  const pages = [];
  let total = null;

  for (let offset = 0; ; offset += pageSize) {
    const remaining = maxRecords == null ? pageSize : Math.max(maxRecords - records.length, 0);
    if (remaining === 0) break;
    const requestSize = Math.min(pageSize, remaining);
    const url = cmsQueryUrl(source, offset, requestSize);
    const response = await fetchImpl(url);
    if (!response.ok) throw new Error(`Source request failed: ${response.status} ${response.statusText}`);

    const page = await response.json();
    const pageRecords = page.results ?? [];
    total = page.count ?? total;
    pages.push({
      offset,
      returned: pageRecords.length,
      total
    });
    records.push(...pageRecords);

    if (pageRecords.length < requestSize || (total != null && records.length >= total) || (maxRecords != null && records.length >= maxRecords)) break;
  }

  return { features: records, pages };
}

export function normalizeTexasAssistedLiving(features, { source, center }) {
  return features
    .map((feature) => feature.attributes ?? feature)
    .map((attributes) => {
      const latitude = toNumber(attributes.Y);
      const longitude = toNumber(attributes.X);
      const distance = haversineMiles(center, { latitude, longitude });

      return {
        facility_key: facilityKey(source, attributes),
        facility_name: normalizeText(attributes.FacName),
        source_facility_id: normalizeText(attributes.FacID),
        care_category: source.careCategory,
        program_type: normalizeText(attributes.ProgTyp),
        county: normalizeText(attributes.County).toUpperCase(),
        address: normalizeText(attributes.Address),
        city: normalizeText(attributes.City).toUpperCase(),
        state: normalizeState(attributes.State, source.jurisdiction),
        zip: normalizeText(attributes.Zipcode),
        phone: normalizeText(attributes.Phone),
        fax: normalizeText(attributes.Fax),
        capacity: toNumber(attributes.TotCap),
        licensee: "",
        administrator: "",
        facility_status: "",
        license_first_date: "",
        closed_date: "",
        regional_office: "",
        source_file_date: "",
        is_active: activeStatus(source, ""),
        latitude,
        longitude,
        distance_miles_from_center: distance == null ? null : Number(distance.toFixed(1)),
        source_id: source.id,
        source_name: source.name,
        source_url: source.sourceUrl,
        source_owner: source.sourceOwner
      };
    })
    .filter((record) => record.facility_name)
    .sort((a, b) => {
      const distanceA = a.distance_miles_from_center ?? Number.POSITIVE_INFINITY;
      const distanceB = b.distance_miles_from_center ?? Number.POSITIVE_INFINITY;
      return distanceA - distanceB || a.facility_name.localeCompare(b.facility_name);
    });
}

export function normalizeCaliforniaRcfe(records, { source, center }) {
  return records
    .map((record) => record.attributes ?? record)
    .map((attributes) => {
      const latitude = null;
      const longitude = null;
      const distance = haversineMiles(center, { latitude, longitude });
      const sourceFacilityId = normalizeText(attributes.facility_number);
      const facilityStatus = normalizeText(attributes.facility_status);

      return {
        facility_key: keyedFacilityKey(source, sourceFacilityId, [
          attributes.facility_name,
          attributes.facility_address,
          attributes.facility_city,
          attributes.facility_zip
        ]),
        facility_name: normalizeText(attributes.facility_name),
        source_facility_id: sourceFacilityId,
        care_category: source.careCategory,
        program_type: normalizeText(attributes.facility_type),
        county: normalizeText(attributes.county_name).toUpperCase(),
        address: normalizeText(attributes.facility_address),
        city: normalizeText(attributes.facility_city).toUpperCase(),
        state: normalizeState(attributes.facility_state, source.jurisdiction),
        zip: normalizeText(attributes.facility_zip),
        phone: normalizeText(attributes.facility_telephone_number),
        fax: "",
        capacity: toNumber(attributes.facility_capacity),
        licensee: normalizeText(attributes.licensee),
        administrator: normalizeText(attributes.facility_administrator),
        facility_status: facilityStatus,
        license_first_date: normalizeText(attributes.license_first_date),
        closed_date: normalizeText(attributes.closed_date),
        regional_office: normalizeText(attributes.regional_office),
        source_file_date: normalizeText(attributes.file_date),
        is_active: activeStatus(source, facilityStatus),
        latitude,
        longitude,
        distance_miles_from_center: distance == null ? null : Number(distance.toFixed(1)),
        source_id: source.id,
        source_name: source.name,
        source_url: source.sourceUrl,
        source_owner: source.sourceOwner
      };
    })
    .filter((record) => record.facility_name)
    .sort((a, b) => a.facility_name.localeCompare(b.facility_name) || a.source_facility_id.localeCompare(b.source_facility_id));
}

export function normalizeCmsNursingHomes(records, { source, center }) {
  return records
    .map((record) => record.attributes ?? record)
    .map((attributes) => {
      const latitude = toNumber(attributes.latitude);
      const longitude = toNumber(attributes.longitude);
      const distance = haversineMiles(center, { latitude, longitude });
      const sourceFacilityId = normalizeText(attributes.cms_certification_number_ccn);

      return {
        facility_key: keyedFacilityKey(source, sourceFacilityId, [
          attributes.provider_name,
          attributes.provider_address,
          attributes.citytown,
          attributes.zip_code
        ]),
        facility_name: normalizeText(attributes.provider_name),
        source_facility_id: sourceFacilityId,
        care_category: source.careCategory,
        program_type: normalizeText(attributes.provider_type) || "Nursing Home",
        county: normalizeText(attributes.countyparish).toUpperCase(),
        address: normalizeText(attributes.provider_address),
        city: normalizeText(attributes.citytown).toUpperCase(),
        state: normalizeState(attributes.state, ""),
        zip: normalizeText(attributes.zip_code),
        phone: normalizeText(attributes.telephone_number),
        fax: "",
        capacity: toNumber(attributes.number_of_certified_beds),
        licensee: normalizeText(attributes.legal_business_name),
        administrator: "",
        facility_status: "ACTIVE",
        license_first_date: normalizeText(attributes.date_first_approved_to_provide_medicare_and_medicaid_services),
        closed_date: "",
        regional_office: normalizeText(attributes.cms_region),
        source_file_date: normalizeText(attributes.processing_date),
        is_active: true,
        latitude,
        longitude,
        distance_miles_from_center: distance == null ? null : Number(distance.toFixed(1)),
        source_id: source.id,
        source_name: source.name,
        source_url: source.sourceUrl,
        source_owner: source.sourceOwner,
        source_detail: {
          ownership_type: normalizeText(attributes.ownership_type),
          average_residents_per_day: toNumber(attributes.average_number_of_residents_per_day),
          continuing_care_retirement_community: normalizeText(attributes.continuing_care_retirement_community),
          special_focus_status: normalizeText(attributes.special_focus_status),
          abuse_icon: normalizeText(attributes.abuse_icon),
          overall_rating: toNumber(attributes.overall_rating),
          health_inspection_rating: toNumber(attributes.health_inspection_rating),
          qm_rating: toNumber(attributes.qm_rating),
          longstay_qm_rating: toNumber(attributes.longstay_qm_rating),
          shortstay_qm_rating: toNumber(attributes.shortstay_qm_rating),
          staffing_rating: toNumber(attributes.staffing_rating),
          chain_name: normalizeText(attributes.chain_name),
          chain_id: normalizeText(attributes.chain_id),
          total_number_of_penalties: toNumber(attributes.total_number_of_penalties),
          geocoding_footnote: normalizeText(attributes.geocoding_footnote)
        }
      };
    })
    .filter((record) => record.facility_name)
    .sort((a, b) => a.state.localeCompare(b.state)
      || a.city.localeCompare(b.city)
      || a.facility_name.localeCompare(b.facility_name)
    || a.source_facility_id.localeCompare(b.source_facility_id));
}

export function normalizeHudSection202(records, { source, center }) {
  return records
    .map((record) => record.attributes ?? record)
    .map((attributes) => {
      const latitude = toNumber(attributes.LAT);
      const longitude = toNumber(attributes.LON);
      const distance = haversineMiles(center, { latitude, longitude });
      const sourceFacilityId = normalizeText(attributes.PROPERTY_ID);
      const city = normalizeText(attributes.STD_CITY) || normalizeText(attributes.PLACED_BASE_CITY_NAME_TEXT);
      const status = normalizeText(attributes.HAS_ACTIVE_ASSISTANCE_IND) === "Y" ? "ACTIVE ASSISTANCE" : "SOURCE LISTED";

      return {
        facility_key: keyedFacilityKey(source, sourceFacilityId, [
          attributes.PROPERTY_NAME_TEXT,
          attributes.ADDRESS_LINE1_TEXT,
          city,
          attributes.STD_ZIP5
        ]),
        facility_name: normalizeText(attributes.PROPERTY_NAME_TEXT),
        source_facility_id: sourceFacilityId,
        care_category: source.careCategory,
        program_type: normalizeText(attributes.PROGRAM_TYPE1) || normalizeText(attributes.PROPERTY_CATEGORY_NAME) || "HUD Section 202",
        county: normalizeText(attributes.CURCNTY_NM).toUpperCase(),
        address: normalizeText(attributes.STD_ADDR) || normalizeText(attributes.ADDRESS_LINE1_TEXT),
        city: city.toUpperCase(),
        state: normalizeState(attributes.STD_ST, ""),
        zip: normalizeText(attributes.STD_ZIP5),
        phone: normalizeText(attributes.PROPERTY_ON_SITE_PHONE_NUMBER) || normalizeText(attributes.MGMT_CONTACT_MAIN_PHN_NBR),
        fax: "",
        capacity: toNumber(attributes.TOTAL_UNIT_COUNT),
        licensee: normalizeText(attributes.MGMT_AGENT_ORG_NAME),
        administrator: normalizeText(attributes.MGMT_CONTACT_FULL_NAME),
        facility_status: status,
        license_first_date: "",
        closed_date: "",
        regional_office: "",
        source_file_date: normalizeText(attributes.LAST_UPDT_DTTM),
        is_active: true,
        latitude,
        longitude,
        distance_miles_from_center: distance == null ? null : Number(distance.toFixed(1)),
        source_id: source.id,
        source_name: source.name,
        source_url: source.sourceUrl,
        source_owner: source.sourceOwner,
        source_detail: {
          property_category: normalizeText(attributes.PROPERTY_CATEGORY_NAME),
          client_group_name: normalizeText(attributes.CLIENT_GROUP_NAME),
          client_group_type: normalizeText(attributes.CLIENT_GROUP_TYPE),
          total_assisted_units: toNumber(attributes.TOTAL_ASSISTED_UNIT_COUNT),
          has_active_assistance: normalizeText(attributes.HAS_ACTIVE_ASSISTANCE_IND),
          has_active_financing: normalizeText(attributes.HAS_ACTIVE_FINANCING_IND),
          primary_financing_type: normalizeText(attributes.PRIMARY_FINANCING_TYPE),
          is_assisted_living: normalizeText(attributes.IS_ASSISTED_LIVING_IND),
          is_nursing_home: normalizeText(attributes.IS_NURSING_HOME_IND),
          program_type_2: normalizeText(attributes.PROGRAM_TYPE2),
          management_agent: normalizeText(attributes.MGMT_AGENT_ORG_NAME),
          management_contact_name: normalizeText(attributes.MGMT_CONTACT_FULL_NAME),
          management_contact_title: normalizeText(attributes.MGMT_CONTACT_INDV_TITLE_TEXT),
          management_contact_phone: normalizeText(attributes.MGMT_CONTACT_MAIN_PHN_NBR),
          management_contact_email: normalizeText(attributes.MGMT_CONTACT_EMAIL_TEXT)
        }
      };
    })
    .filter((record) => record.facility_name)
    .sort((a, b) => a.state.localeCompare(b.state)
      || a.city.localeCompare(b.city)
      || a.facility_name.localeCompare(b.facility_name)
      || a.source_facility_id.localeCompare(b.source_facility_id));
}

export function validateRecords(records) {
  const duplicateKeys = new Map();
  const seenKeys = new Map();
  let missingSourceFacilityId = 0;
  let missingAddress = 0;
  let missingPhone = 0;
  let missingCapacity = 0;
  let missingCoordinates = 0;

  for (const record of records) {
    if (!record.source_facility_id) missingSourceFacilityId += 1;
    if (!record.address || !record.city || !record.state || !record.zip) missingAddress += 1;
    if (!record.phone) missingPhone += 1;
    if (record.capacity == null) missingCapacity += 1;
    if (record.latitude == null || record.longitude == null) missingCoordinates += 1;

    const count = (seenKeys.get(record.facility_key) ?? 0) + 1;
    seenKeys.set(record.facility_key, count);
    if (count > 1) duplicateKeys.set(record.facility_key, count);
  }

  const warnings = [];
  if (missingSourceFacilityId) warnings.push(`${missingSourceFacilityId} records are missing a source facility ID.`);
  if (missingAddress) warnings.push(`${missingAddress} records are missing part of their address.`);
  if (missingPhone) warnings.push(`${missingPhone} records are missing phone numbers.`);
  if (missingCapacity) warnings.push(`${missingCapacity} records are missing capacity.`);
  if (missingCoordinates) warnings.push(`${missingCoordinates} records are missing coordinates.`);
  if (duplicateKeys.size) warnings.push(`${duplicateKeys.size} duplicate facility keys were detected.`);

  return {
    warnings,
    missing_source_facility_id: missingSourceFacilityId,
    missing_address: missingAddress,
    missing_phone: missingPhone,
    missing_capacity: missingCapacity,
    missing_coordinates: missingCoordinates,
    duplicate_facility_keys: Object.fromEntries(duplicateKeys)
  };
}

export function summarizeRecords(records) {
  const statusCounts = {};
  let activeRecords = 0;
  let inactiveRecords = 0;

  for (const record of records) {
    const status = record.facility_status || "UNKNOWN";
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
    if (record.is_active) activeRecords += 1;
    else inactiveRecords += 1;
  }

  return {
    active_records: activeRecords,
    inactive_records: inactiveRecords,
    status_counts: Object.fromEntries(Object.entries(statusCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])))
  };
}

function toCsv(records) {
  if (records.length === 0) return "";

  const columns = Object.keys(records[0]);
  const escape = (value) => {
    const normalized = value && typeof value === "object" ? JSON.stringify(value) : value;
    return `"${String(normalized ?? "").replaceAll("\"", "\"\"")}"`;
  };
  return `${columns.join(",")}\n${records.map((record) => columns.map((column) => escape(record[column])).join(",")).join("\n")}\n`;
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function readInputFeatures(path) {
  const data = JSON.parse(await readFile(path, "utf8"));
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.features)) return data.features;
  if (Array.isArray(data.records)) return data.records;
  throw new Error(`Input file does not contain features or records: ${path}`);
}

export async function collectFacilities(options = {}) {
  const source = FACILITY_SOURCES[options.sourceId ?? "tx-hhsc-assisted-living"];
  if (!source) throw new Error(`Unknown facility source: ${options.sourceId}`);

  const limit = options.limit ?? DEFAULT_LIMIT;
  const center = options.center ?? source.defaultCenter;
  const outDir = resolve(options.outDir ?? DEFAULT_OUT_DIR);
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();
  const runId = retrievedAt.replaceAll(":", "").replaceAll(".", "");
  const runDir = resolve(outDir, "runs", source.id, runId);
  const exportStem = `${source.exportNamePrefix}-${limit}`;

  const raw = options.inputPath
    ? { features: await readInputFeatures(resolve(options.inputPath)), pages: [], inputPath: resolve(options.inputPath) }
    : source.sourceSystem === "CKAN datastore"
      ? await fetchCkanRecords(source, options)
      : source.sourceSystem === "CMS Provider Data API"
        ? await fetchCmsProviderData(source, {
            ...options,
            maxRecords: limit === ALL_RECORDS ? null : limit
          })
      : await fetchArcgisFeatures(source, options);

  const normalizedAll = source.id === "ca-cdss-rcfe"
    ? normalizeCaliforniaRcfe(raw.features, { source, center })
    : source.id === "cms-nursing-home-provider-info"
      ? normalizeCmsNursingHomes(raw.features, { source, center })
      : source.id === "hud-section-202-properties"
        ? normalizeHudSection202(raw.features, { source, center })
        : normalizeTexasAssistedLiving(raw.features, { source, center });
  let selected = limit === ALL_RECORDS ? normalizedAll : normalizedAll.slice(0, limit);
  let geocoding = null;

  if (options.geocode === "census") {
    const enriched = await enrichWithCensusGeocodes(selected, {
      ...options,
      outDir,
      retrievedAt
    });
    selected = enriched.records;
    geocoding = enriched.report;
  }

  const validation = validateRecords(selected);
  const summary = summarizeRecords(selected);
  const parsingNotes = [
    ...source.parsingNotes,
    ...(geocoding ? geocoding.parsing_notes : [])
  ];
  const recordHash = sha256(stableJson(selected));
  const sourceSnapshot = {
    source,
    center,
    retrievedAt,
    totalSourceRecords: raw.features.length,
    normalizedRecords: normalizedAll.length,
    selectedRecords: selected.length,
    summary,
    validation,
    geocoding,
    parsingNotes
  };
  const exportPayload = {
    generated_at: retrievedAt,
    run_id: runId,
    source: {
      id: source.id,
      name: source.name,
      owner: source.sourceOwner,
      system: source.sourceSystem,
      url: source.sourceUrl,
      description: source.sourceDescription
    },
    center,
    record_count: selected.length,
    total_source_records: raw.features.length,
    summary,
    validation,
    geocoding,
    parsing_notes: parsingNotes,
    records: selected
  };
  const manifest = {
    run_id: runId,
    generated_at: retrievedAt,
    source_id: source.id,
    source_url: source.sourceUrl,
    source_owner: source.sourceOwner,
    source_system: source.sourceSystem,
    center,
    limit,
    total_source_records: raw.features.length,
    normalized_records: normalizedAll.length,
    selected_records: selected.length,
    ...summary,
    selected_records_sha256: recordHash,
    validation,
    geocoding,
    pages: raw.pages,
    input_path: raw.inputPath,
    outputs: {
      latest_json: resolve(outDir, `${exportStem}.json`),
      latest_csv: resolve(outDir, `${exportStem}.csv`),
      run_manifest: resolve(runDir, "manifest.json"),
      run_raw: resolve(runDir, "raw-source.json"),
      run_geocoding: geocoding ? resolve(runDir, "geocoding-report.json") : null,
      run_normalized_json: resolve(runDir, "normalized-records.json"),
      run_normalized_csv: resolve(runDir, "normalized-records.csv")
    },
    parsing_notes: parsingNotes
  };

  await writeJson(resolve(runDir, "source-snapshot.json"), sourceSnapshot);
  await writeJson(resolve(runDir, "raw-source.json"), { retrieved_at: retrievedAt, source, pages: raw.pages, features: raw.features });
  if (geocoding) await writeJson(resolve(runDir, "geocoding-report.json"), geocoding);
  await writeJson(resolve(runDir, "normalized-records.json"), exportPayload);
  await writeFile(resolve(runDir, "normalized-records.csv"), toCsv(selected));
  await writeJson(resolve(runDir, "manifest.json"), manifest);

  await writeJson(resolve(outDir, `${exportStem}.json`), exportPayload);
  await writeFile(resolve(outDir, `${exportStem}.csv`), toCsv(selected));
  await writeJson(resolve(outDir, `${source.id}-latest-manifest.json`), manifest);

  return manifest;
}

function parseArgs(argv) {
  const options = {};

  for (const arg of argv) {
    const [key, value] = arg.startsWith("--") ? arg.slice(2).split("=", 2) : [arg, undefined];
    if (key === "list-sources") options.listSources = true;
    else if (key === "source") options.sourceId = value;
    else if (key === "limit") options.limit = value === ALL_RECORDS ? ALL_RECORDS : Number(value);
    else if (key === "out-dir") options.outDir = value;
    else if (key === "input") options.inputPath = value;
    else if (key === "geocode") {
      if (value !== "census") throw new Error(`Unsupported geocoder: ${value}`);
      options.geocode = value;
    } else if (key === "geocode-limit") {
      options.geocodeLimit = Number(value);
    } else if (key === "geocode-cache") {
      options.cachePath = value;
    }
    else if (key === "center") {
      if (value !== "austin-tx") throw new Error(`Unsupported center: ${value}`);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (
    options.limit != null
    && options.limit !== ALL_RECORDS
    && (!Number.isInteger(options.limit) || options.limit < 1)
  ) {
    throw new Error("--limit must be a positive integer or all");
  }
  if (
    options.geocodeLimit != null
    && (!Number.isInteger(options.geocodeLimit) || options.geocodeLimit < 0)
  ) {
    throw new Error("--geocode-limit must be a non-negative integer");
  }

  return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const options = parseArgs(process.argv.slice(2));
  if (options.listSources) {
    console.log(JSON.stringify(Object.values(FACILITY_SOURCES).map((source) => ({
      id: source.id,
      name: source.name,
      jurisdiction: source.jurisdiction,
      care_category: source.careCategory,
      source_owner: source.sourceOwner,
      source_system: source.sourceSystem,
      source_url: source.sourceUrl
    })), null, 2));
    process.exit(0);
  }

  const manifest = await collectFacilities(options);
  console.log(JSON.stringify({
    run_id: manifest.run_id,
    source_id: manifest.source_id,
    selected_records: manifest.selected_records,
    selected_records_sha256: manifest.selected_records_sha256,
    validation_warnings: manifest.validation.warnings,
    latest_json: manifest.outputs.latest_json,
    latest_csv: manifest.outputs.latest_csv,
    run_manifest: manifest.outputs.run_manifest
  }, null, 2));
}
