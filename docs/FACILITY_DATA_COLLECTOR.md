# Facility Data Collector

This collector is the first step toward a source-aware senior living facility
database. It is intentionally dependency-free Node.js so it can run locally now
and later inside AWS without changing the core extraction logic.

## Current Sources

Source ID: `tx-hhsc-assisted-living`

Owner: Texas Health and Human Services Commission

System: ArcGIS FeatureServer

URL:
https://services1.arcgis.com/jI1j5lArZnrgFYSc/ArcGIS/rest/services/Assisted_Living/FeatureServer/0

The source exposes public assisted-living facility records with facility name,
facility ID, program type, address, city, county, ZIP, phone, fax, capacity, and
coordinates.

Source ID: `ca-cdss-rcfe`

Owner: California Department of Social Services

System: CKAN datastore

URL:
https://lab.data.ca.gov/dataset/community-care-licensing-facilities/6b2f5818-f60d-40b5-bc2a-94f995f9f8b0

The source exposes public Residential Care Facilities for the Elderly records
with facility name, facility number, type, address, city, county, ZIP, phone,
capacity, licensee, administrator, license dates, regional office, status, and
file date. It does not currently expose coordinates.

Source ID: `cms-nursing-home-provider-info`

Owner: Centers for Medicare & Medicaid Services

System: CMS Provider Data API

URL:
https://data.cms.gov/provider-data/dataset/4pq5-n9py

The source exposes a national nursing-home / skilled-nursing provider table with CMS Certification
Number, provider name, address, phone, county, ownership type, certified beds,
resident census, provider type, legal business name, first Medicare/Medicaid
approval date, chain details, CCRC flag, Five-Star ratings, penalty fields,
source-supplied coordinates, and processing date.

Source ID: `hud-section-202-properties`

Owner: U.S. Department of Housing and Urban Development

System: ArcGIS FeatureServer

URL:
https://catalog.data.gov/dataset/section-202-properties-5a638

The source exposes HUD assisted multifamily properties that primarily serve
elderly residents, including property name, address, phone, total units,
assisted units, HUD program/category fields, management organization/contact
fields, and source-supplied geocoded coordinates. These records are normalized
as `care_category=age_55_plus`; they are elderly-serving housing properties,
not licensed assisted-living or skilled-nursing records.

Source ID: `society-certified-senior-advisors-locator`

Owner: Society of Certified Senior Advisors

System: GeoDirectory WordPress public search

URL:
https://portal.csa.us/locator/

The source exposes public Certified Senior Advisor locator records. These are
advisor/credential records, not facility records. Current listing cards expose
CSA name, certified-since date, location, main industry, and profile URL. Use
this source for credential verification and cross-match it to richer advisor
contact sources such as SeniorPlace advisor profiles.

## Run Locally

```bash
npm run collect:facilities
```

Useful options:

```bash
npm run collect:facilities:list
npm run export:facilities
npm run collect:facilities -- --source=tx-hhsc-assisted-living --limit=300 --center=austin-tx
npm run collect:facilities -- --source=tx-hhsc-assisted-living --limit=all
npm run collect:facilities -- --source=ca-cdss-rcfe --limit=all
npm run collect:facilities -- --source=ca-cdss-rcfe --limit=all --geocode=census
npm run collect:facilities -- --source=cms-nursing-home-provider-info --limit=all
npm run collect:facilities -- --source=hud-section-202-properties --limit=all
npm run collect:contacts -- --facility-key=example:facility --website-url=https://example.com
npm run collect:csa-locator -- --pages=3 --limit=all
npm run collect:csa-locator -- --pages=all --limit=all
npm run collect:csa-locator -- --input-raw=data/advisor-directory/runs/society-certified-senior-advisors-locator/<run-id>/raw-source.json --limit=all
npm run collect:facilities -- --input=test/fixtures/tx-assisted-living-sample.json --limit=2
```

Container build/run:

```bash
docker build -f Dockerfile.collector -t facility-collector .
docker run --rm -v "$PWD/data:/app/data" facility-collector --source=tx-hhsc-assisted-living --limit=300
```

## Local Test Checklist

Run these before moving collector changes toward AWS:

```bash
npm run verify
npm run collect:facilities:list
node scripts/facility-collector.mjs --input=test/fixtures/tx-assisted-living-sample.json --limit=2 --out-dir=/tmp/facility-collector-fixture-test
node scripts/facility-collector.mjs --source=tx-hhsc-assisted-living --limit=25 --out-dir=/tmp/facility-collector-live-test
node scripts/facility-collector.mjs --source=tx-hhsc-assisted-living --limit=all --out-dir=/tmp/facility-collector-full-test
node scripts/facility-collector.mjs --source=ca-cdss-rcfe --limit=25 --out-dir=/tmp/facility-collector-ca-live-test
node scripts/facility-collector.mjs --source=ca-cdss-rcfe --limit=all --out-dir=/tmp/facility-collector-ca-full-test
node scripts/facility-collector.mjs --source=cms-nursing-home-provider-info --limit=25 --out-dir=/tmp/facility-collector-cms-live-test
node scripts/facility-collector.mjs --source=cms-nursing-home-provider-info --limit=all --out-dir=/tmp/facility-collector-cms-full-test
node scripts/facility-collector.mjs --source=hud-section-202-properties --limit=25 --out-dir=/tmp/facility-collector-hud-live-test
node scripts/facility-collector.mjs --source=hud-section-202-properties --limit=all --out-dir=/tmp/facility-collector-hud-full-test
node scripts/csa-locator-collector.mjs --input=test/fixtures/csa-locator-search-page-sample.html --limit=1 --out-dir=/tmp/csa-locator-fixture-test
node scripts/csa-locator-collector.mjs --pages=3 --limit=all --out-dir=/tmp/csa-locator-live-test
node scripts/facility-exporter.mjs --in-dir=data/facilities --out-dir=/tmp/facility-export-test
docker build -f Dockerfile.collector -t facility-collector:local .
docker run --rm -v /tmp/facility-collector-docker-fixture:/app/data facility-collector:local --input=test/fixtures/tx-assisted-living-sample.json --limit=2 --out-dir=/app/data
docker run --rm -v /tmp/facility-collector-docker-live:/app/data facility-collector:local --source=tx-hhsc-assisted-living --limit=10 --out-dir=/app/data
```

Expected current Texas full-source behavior:

- 2,013 normalized records
- 2,013 unique facility keys
- CSV line count of 2,014 including the header
- validation warning for records missing phone numbers

Expected current California full-source behavior:

- 12,522 normalized records
- 12,522 unique facility keys
- CSV line count of 12,523 including the header
- status counts include licensed, closed, pending, and on-probation records
- validation warning because the source does not expose coordinates

Expected current CMS nursing-home behavior:

- approximately 14,693 current records in the Provider Information table
- records are normalized as `care_category=skilled_nursing`
- CMS `count` is preserved in page metadata for live runs
- records include source-supplied latitude/longitude when CMS has geocoded them
- certified beds are mapped to normalized `capacity`
- Five-Star ratings, ownership, CCRC flag, chain, and penalty fields are
  preserved in `source_detail`

Expected current HUD Section 202 behavior:

- approximately 11,012 active elderly-housing properties
- records are normalized as `care_category=age_55_plus`
- source-supplied latitude/longitude are preserved
- total units are mapped to normalized `capacity`
- assisted units, HUD category/program fields, management organization, manager
  contact, manager phone, and manager email are preserved in `source_detail`

Expected current CSA Locator behavior:

- approximately 147 public search result pages
- approximately 20 listing cards per page
- fields include advisor name, certified-since date, location, main industry,
  source profile URL, source page URL, source post ID when present, and parser
  provenance
- profile pages sampled during research do not consistently expose email,
  phone, or company fields, so this source should be treated as credential
  verification rather than contact enrichment

California coordinates can be enriched with the no-cost U.S. Census Geocoder:

```bash
npm run collect:facilities -- --source=ca-cdss-rcfe --limit=all --geocode=census
```

The Census batch geocoder accepts `Unique ID, Street address, City, State, ZIP`
CSV files and currently allows up to 10,000 records per batch file. The
collector chunks larger inputs, caches results in
`data/facilities/geocoding/census-cache.json`, and records geocoding provenance
on each enriched record:

- `geocode_source`
- `geocode_source_url`
- `geocode_benchmark`
- `geocode_retrieved_at`
- `geocode_match_status`
- `geocode_match_type`
- `geocode_matched_address`

Use Census as the default no-cost enrichment provider for U.S. facility
addresses. Public OpenStreetMap Nominatim is not the default because recurring
bulk geocoding is discouraged, repeat scripts are tightly rate-limited, and
results must be cached with attribution and ODbL obligations.

## Outputs

Latest exports:

- `data/facilities/texas-assisted-living-all.json`
- `data/facilities/texas-assisted-living-all.csv`
- `data/facilities/california-rcfe-all.json`
- `data/facilities/california-rcfe-all.csv`
- `data/facilities/cms-nursing-home-provider-info-all.json`
- `data/facilities/cms-nursing-home-provider-info-all.csv`
- `data/facilities/hud-section-202-properties-all.json`
- `data/facilities/hud-section-202-properties-all.csv`
- `data/facilities/combined-facilities-all.json`
- `data/facilities/combined-facilities-all.csv`
- `data/facilities/combined-facilities-active.json`
- `data/facilities/combined-facilities-active.csv`
- `data/facilities/combined-facilities-manifest.json`
- `data/facilities/tx-hhsc-assisted-living-latest-manifest.json`

The combined active export is the best first feed for a web/mobile app. The
combined all export preserves inactive/closed/pending records for audit,
research, and admin workflows.

Each run also writes an immutable run folder:

```text
data/facilities/runs/<source-id>/<run-id>/
  manifest.json
  raw-source.json
  source-snapshot.json
  normalized-records.json
  normalized-records.csv
```

Website contact enrichment writes separate run output because facility websites
are secondary enrichment sources rather than licensing authority sources:

```text
data/facilities/contact-enrichment/<run-id>/
  manifest.json
  contact-enrichment-results.json

data/facilities/contact-enrichment/latest-contact-enrichment.json
```

The website harvester stores the requested URL, final URL after redirects,
parser version, pages fetched, HTTP status, content type, HTML checksum,
emails, phones, contact links, extraction rules, evidence snippets, parsing
notes, and failures. That is the repeatable "how we got this info" record for
daily refreshes and manual rechecks from the app.

CSA Locator advisor exports write to `data/advisor-directory/`:

```text
data/advisor-directory/csa-locator-all.json
data/advisor-directory/csa-locator-all.csv
data/advisor-directory/society-certified-senior-advisors-locator-latest-manifest.json
data/advisor-directory/runs/society-certified-senior-advisors-locator/<run-id>/
  manifest.json
  raw-source.json
  normalized-records.json
  normalized-records.csv
```

The manifest preserves:

- source URL and owner
- source system
- run timestamp
- row counts
- active/inactive counts
- source status counts
- parsing notes
- selected-record checksum
- validation warnings
- output file paths

## Parsing Notes

The Texas collector currently applies these rules:

- ArcGIS records are paginated with `resultOffset` and `resultRecordCount`.
- Attributes are read from `feature.attributes`.
- Geometry is not requested because `X` and `Y` fields are already exposed.
- `TEXAS` and blank state values normalize to `TX`.
- `TotCap` is parsed as numeric capacity when possible.
- Distance is computed from central Austin using the Haversine formula.
- Records are sorted by distance and facility name before the configured limit
  is applied.
- A stable `facility_key` is generated from source ID plus source facility ID.
  When a source facility ID is missing, the fallback key hashes facility name,
  address, city, and ZIP.
- `is_active` is derived per source. Texas records are treated as active because
  the current Texas source does not expose a status field. California records are
  active when status is `LICENSED` or `ON PROBATION`; `CLOSED` and `PENDING` are
  preserved but marked inactive.
- Optional Census geocoding is an enrichment stage, not a source replacement.
  Coordinates from Census are interpolated from MAF/TIGER address ranges, so they
  should be treated as map placement coordinates rather than exact building
  footprints.

## Validation

Every run reports validation counts and warnings in the manifest:

- missing source facility ID
- missing address fields
- missing phone
- missing capacity
- missing coordinates
- duplicate facility keys

The selected-record checksum excludes run timestamps, so daily runs can compare
whether the actual selected facility data changed.

## Website Contact Enrichment

Known facility website URLs can be checked locally:

```bash
npm run collect:contacts -- --facility-key=tx-hhsc-assisted-living:000745 --website-url=https://example.com
```

The current harvester is intentionally shallow:

- fetches the submitted homepage with redirects enabled
- parses title, `mailto:` links, email-looking text, `tel:` links, U.S.
  phone-looking text, JSON-LD `email` and `telephone` fields, and contact-like
  links
- follows a small number of same-host links whose URL or text looks like
  contact, about, team, tour, sales, marketing, or admissions
- stores parser rules and evidence snippets so later refreshes do not need to
  rediscover how a value was extracted

Difficulty level:

- Contact extraction from a known facility website is moderate. It can be
  reliable enough for review workflows when the source URL, final URL, parser
  version, page checksums, and evidence snippets are retained.
- Official website discovery is harder. Licensing sources usually do not
  include websites, so the system needs a separate discovery source or search
  provider, confidence scoring, and human review before assigning a website to a
  facility.
- JavaScript-heavy pages, image-only phone numbers, PDF brochures, form-only
  contact flows, franchise/corporate landing pages, and bot protections will
  need either a browser-based crawler, OCR/PDF parsing, or manual review.
- Production should respect robots.txt, rate-limit by domain, cache raw HTML in
  S3, and avoid collecting personal data beyond business contact information
  needed for the CRM workflow.

## AWS Recommendation

For production, use a containerized batch collector rather than a web-server job.

Recommended target:

- Language: TypeScript/Node.js.
- Packaging: Docker image in Amazon ECR.
- Scheduler: Amazon EventBridge Scheduler, daily or on demand.
- Runtime: AWS ECS Fargate task for normal runs.
- Raw storage: Amazon S3, partitioned by `source_id/run_date/run_id`.
- Normalized store: Amazon RDS PostgreSQL with PostGIS, or Aurora PostgreSQL
  Serverless v2 if usage is bursty.
- App access: responsive web app reads from API/database views, with active
  facilities as the default view and inactive records available to admin users.
- Search: PostgreSQL full-text/trigram first; OpenSearch only after search needs
  outgrow Postgres.
- Secrets/config: AWS Secrets Manager and SSM Parameter Store.
- Observability: CloudWatch Logs, metrics for source count, normalized count,
  changed count, failed source count, and run duration.
- Orchestration: Step Functions once multiple states/sources need retries,
  branching, manual review, or enrichment stages.

Why Node/TypeScript:

- This project already uses Node.
- ArcGIS, Socrata, CKAN, CSV, and JSON sources are straightforward with native
  HTTP and streaming parsers.
- The same code can run locally, in CI, in Lambda, or in a Fargate container.
- TypeScript will help keep each state's source adapter honest as schemas vary.

Use Lambda only for lightweight API/CSV sources. Use ECS Fargate for the general
collector because some states will involve larger files, slower portals, PDFs, or
headless browser extraction.
