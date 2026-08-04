# Local Database

The local development database uses PostgreSQL with PostGIS in Docker. This
keeps development close to the intended AWS/Postgres production target while
remaining fully local.

## Services

`compose.yaml` defines one service:

- `db`: `postgis/postgis:16-3.4`

The database persists in the named Docker volume
`seniorlivingkit_pgdata`. The repo `data/`, `db/`, and `tmp/` folders are mounted
into the container so migrations and seed files can run through `psql`.

Default connection:

```bash
DATABASE_URL=postgres://seniorlivingkit:seniorlivingkit_dev@127.0.0.1:54321/seniorlivingkit
```

## Commands

Start and fully initialize:

```bash
npm run db:setup
```

Run pieces individually:

```bash
npm run db:up
npm run db:wait
npm run db:migrate
npm run db:seed:facilities
npm run db:seed:advisors
npm run db:seed:crm
npm run db:shell
```

Stop without deleting data:

```bash
npm run db:down
```

Delete the local database volume only when you intentionally want a clean local
database:

```bash
docker compose down -v
```

## Current Seed

`npm run db:seed:facilities` imports:

```text
data/facilities/combined-facilities-all.json
```

It upserts:

- `facility_sources`
- `facilities`

Facilities with coordinates get a PostGIS `geog` point for radius search.

`npm run db:seed:advisors` imports:

```text
data/advisor-directory/seniorplace-advisors-show-all-full-2026-08-03.json
data/advisor-directory/csa-locator-all.json
```

It upserts:

- `advisor_sources`
- `advisor_source_runs`
- `advisor_records`
- `advisor_record_matches`

`npm run db:seed:crm` imports the sample CRM state from
`apps/facility-directory-prototype/crm-data.js` unless `--input=` points to a
saved state payload. It upserts by stable external keys so repeated local runs
do not duplicate the same people, relationships, leads, or communications.

Useful checks:

```sql
select count(*) from facilities;
select care_category, count(*) from facilities group by care_category order by count(*) desc;
select source_id, count(*) from facilities group by source_id order by count(*) desc;
select count(*) from advisor_records;
select count(*) from people person join tenants tenant on tenant.tenant_id = person.tenant_id where tenant.slug = 'local-demo';
select facility_name, city, state
from facilities
where is_active
  and geog is not null
order by geog <-> ST_SetSRID(ST_MakePoint(-97.7431, 30.2672), 4326)::geography
limit 10;
```

## Schema Direction

The first migration creates the production-shaped foundation:

- tenant/user/role membership
- source-aware facilities and source runs
- PostGIS facility geography
- people and person relationships
- leads and lead/person/facility links
- communications and tasks
- facility contact enrichment
- referral sources
- integrations and integration events
- audit log

Every tenant-owned CRM table includes `tenant_id` from the start. Public facility
records remain global, with tenant-specific preferences and lead/facility links
stored separately.

## Health Checks

Run file/data checks without needing Docker:

```bash
npm run health
```

Run database-backed checks after `npm run db:setup`:

```bash
npm run health:db
```
