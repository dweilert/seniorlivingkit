# Senior Living Data CRM Project Ledger

Last updated: 2026-08-09

This file is the durable checkpoint for the senior living facility intelligence
and CRM prototype. It exists so the current state can be recovered without
reading the chat history.

## Product Direction

This is a new web application, separate from the Senior Living Kit marketing
site. The intended product combines:

- source-aware senior living facility directory
- map search with filters, prioritization, and exclusion
- CRM lead pipeline
- people directory and relationship graph
- communication tracking with prospects, families, advisors, and facilities
- advisor/referral-source intelligence
- facility website/contact enrichment with parsing evidence
- future integrations for accounting, email marketing, communications, and OCR

The app must support desktop, tablet, and mobile views.

## Local Architecture

Current local stack:

- React/Vite prototype: `apps/facility-directory-prototype/`
- Local database: PostgreSQL/PostGIS in Docker through `compose.yaml`
- Database migrations: `db/migrations/`
- Data collectors and importers: `scripts/`
- Generated/source data snapshots: `data/`
- Saved product and source research: `docs/`

Current local prototype URL:

```text
http://127.0.0.1:3201/
```

Use `3200` when available. Use another port when `3200` is already occupied:

```bash
npm run dev:facility-app -- --host 127.0.0.1 --port 3201 --strictPort
```

## Database

The local database runs in Docker:

```bash
npm run db:setup
```

This runs:

```text
db:up -> db:wait -> db:migrate -> db:seed:facilities -> db:seed:advisors -> db:seed:crm
```

Default local connection:

```text
postgres://seniorlivingkit:seniorlivingkit_dev@127.0.0.1:54321/seniorlivingkit
```

Core migrations:

- `001_initial_schema.sql`: tenant, users, facilities, CRM core, contacts,
  integrations, audit log
- `002_placement_workflow_schema.sql`: placement workflow, statuses, community
  options, tours, pricing, availability, tasks, templates, invoices, signatures
- `003_advisor_directory_schema.sql`: advisor sources, runs, records, matches
- `004_crm_prototype_persistence.sql`: prototype CRM external keys and fields
  needed for idempotent UI round-trips
- `005_screen_driven_product_model.sql`: screenshot-driven model additions for
  assessments, forms, files, facility profiles, comparison packages,
  communication threads, and calendar events

## Screenshot Review

Reference screenshots from `/Users/bob/@senior` were reviewed and summarized in:

- `docs/SENIOR_APP_SCREEN_REVIEW.md`
- `docs/SCREEN_AND_DATA_BACKLOG.md`

Those notes should drive the next frontend/data-model work. The key finding is
that the target app should center on a client workspace with tabs for overview,
people, assessment, communities, activity, tasks, and files, backed by a richer
community option and assessment model.

## Current Data Inventory

Generated source snapshots are local-only for now. The current plan is to keep
the local backup as the recovery point and move durable raw/generated snapshots
to S3 later. Git should keep source code, schemas, manifests, and smaller curated
files, but not large generated JSON snapshots.

Facility data files:

- `data/facilities/combined-facilities-all.json`: 40,240 records
- `data/facilities/combined-facilities-active.json`: 35,680 active records

Facility sources currently collected:

- Texas HHSC assisted living: 2,013 records
- California CDSS RCFE: 12,522 records
- CMS nursing homes/skilled nursing: 14,693 records
- HUD Section 202 elderly housing: 11,012 records

Advisor data files:

- `data/advisor-directory/seniorplace-advisors-show-all-full-2026-08-03.json`:
  308 SeniorPlace advisor records extracted from authenticated directory view
- `data/advisor-directory/csa-locator-all.json`: 2,931 official CSA Locator
  records
- Database advisor matches: 28 SeniorPlace-to-CSA matches

CRM sample data:

- 13 people
- 12 person relationships
- 4 leads
- 4 lead/facility links
- 4 communications

## API Endpoints In The Prototype

Vite local API routes in `apps/facility-directory-prototype/vite.config.mjs`:

- `GET /api/facilities/search`
- `POST /api/geocode/address`
- `POST /api/facility/contact-info`
- `GET /api/crm/state`
- `PUT /api/crm/state`
- `GET /api/advisors/summary`
- `GET /api/advisors/search`
- `POST /api/business-card/ocr`

The directory view loads facilities from Postgres first:

```text
/api/facilities/search?limit=50000
```

It falls back to:

```text
data/facilities/combined-facilities-active.json
```

The CRM view loads and saves through `/api/crm/state`. Browser storage is now a
fallback draft, not the intended source of truth.

## Collector Commands

List facility sources:

```bash
npm run collect:facilities:list
```

Collect facilities:

```bash
npm run collect:facilities -- --source=tx-hhsc-assisted-living --limit=all
npm run collect:facilities -- --source=ca-cdss-rcfe --limit=all
npm run collect:facilities -- --source=cms-nursing-home-provider-info --limit=all
npm run collect:facilities -- --source=hud-section-202-properties --limit=all
```

Export combined facilities:

```bash
npm run export:facilities
```

Collect CSA Locator advisors:

```bash
npm run collect:csa-locator -- --limit=all
```

Harvest a known facility website for contact info:

```bash
npm run collect:contacts -- --facility-key=example:facility --website-url=https://example.com
```

Seed database tables:

```bash
npm run db:seed:facilities
npm run db:seed:advisors
npm run db:seed:crm
```

## Verification

Fast local checks:

```bash
npm run health
npm run test
npm run verify
```

Database-backed checks:

```bash
npm run db:setup
npm run health:db
npm run test:facility-app
```

Known passing checks as of this ledger update:

- `npm run test`
- `npm run db:migrate`
- `npm run db:seed:crm`
- `npm run test:facility-app`
- `npm run verify`

## Current Limitations

- Public sources do not yet cover all independent living, memory care, 55+
  private communities, and assisted living nationally.
- Cost filters exist in the UI, but current public facility sources do not
  include pricing.
- Facility website discovery is not automated at scale yet. Known website URLs
  can be saved and checked on demand.
- OCR is mocked locally. Production should store uploaded images, run server-side
  OCR/contact extraction, and require user review before save.
- Tenant/user security is modeled in the database but not enforced in a real
  application server yet.
- The Vite local API is a prototype adapter. Production should move these routes
  into a proper backend service.

## Next Best Work

1. Add persistent tenant/user facility preferences for priority and exclusion,
   replacing browser-only preference storage.
2. Move facility filtering fully server-side, including selected facility lookup,
   pagination, map window bounds, and radius search.
3. Add website discovery/enrichment jobs for facility records and store parser
   evidence in `facility_contacts`.
4. Add authentication and tenant scoping before exposing the app beyond local
   development.
5. Convert the Vite prototype API into an application backend suitable for AWS.
