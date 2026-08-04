BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenants (
  tenant_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug citext NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_users (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  full_name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_users (
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
  role text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS facility_sources (
  source_id text PRIMARY KEY,
  name text NOT NULL,
  jurisdiction text NOT NULL,
  source_owner text NOT NULL,
  source_system text NOT NULL,
  source_url text NOT NULL,
  source_description text NOT NULL DEFAULT '',
  active_statuses text[] NOT NULL DEFAULT '{}',
  parsing_notes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS facility_source_runs (
  run_id text PRIMARY KEY,
  source_id text NOT NULL REFERENCES facility_sources(source_id),
  generated_at timestamptz NOT NULL,
  selected_records integer NOT NULL DEFAULT 0,
  active_records integer NOT NULL DEFAULT 0,
  inactive_records integer NOT NULL DEFAULT 0,
  selected_records_sha256 text,
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS facilities (
  facility_key text PRIMARY KEY,
  facility_name text NOT NULL,
  care_category text NOT NULL,
  program_type text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  county text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  zip text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  fax text NOT NULL DEFAULT '',
  capacity integer,
  licensee text NOT NULL DEFAULT '',
  administrator text NOT NULL DEFAULT '',
  facility_status text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  latitude double precision,
  longitude double precision,
  geog geography(Point, 4326),
  source_id text NOT NULL REFERENCES facility_sources(source_id),
  source_facility_id text NOT NULL DEFAULT '',
  source_url text NOT NULL DEFAULT '',
  source_owner text NOT NULL DEFAULT '',
  source_detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_record jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_run_id text,
  last_seen_run_id text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  search_text tsvector GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(facility_name, '') || ' ' ||
      coalesce(address, '') || ' ' ||
      coalesce(city, '') || ' ' ||
      coalesce(state, '') || ' ' ||
      coalesce(zip, '') || ' ' ||
      coalesce(program_type, '') || ' ' ||
      coalesce(care_category, '')
    )
  ) STORED,
  CONSTRAINT facilities_lat_lon_pair CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
  )
);

CREATE INDEX IF NOT EXISTS facilities_active_category_idx ON facilities (is_active, care_category);
CREATE INDEX IF NOT EXISTS facilities_state_city_idx ON facilities (state, city);
CREATE INDEX IF NOT EXISTS facilities_source_idx ON facilities (source_id);
CREATE INDEX IF NOT EXISTS facilities_geog_idx ON facilities USING gist (geog);
CREATE INDEX IF NOT EXISTS facilities_search_idx ON facilities USING gin (search_text);
CREATE INDEX IF NOT EXISTS facilities_name_trgm_idx ON facilities USING gin (facility_name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS people (
  person_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  external_key text,
  full_name text NOT NULL,
  person_type text NOT NULL,
  age integer,
  phone text NOT NULL DEFAULT '',
  email citext,
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  zip text NOT NULL DEFAULT '',
  latitude double precision,
  longitude double precision,
  geog geography(Point, 4326),
  notes text NOT NULL DEFAULT '',
  communication_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, external_key)
);

CREATE INDEX IF NOT EXISTS people_tenant_name_idx ON people (tenant_id, full_name);
CREATE INDEX IF NOT EXISTS people_tenant_type_idx ON people (tenant_id, person_type);
CREATE INDEX IF NOT EXISTS people_geog_idx ON people USING gist (geog);

CREATE TABLE IF NOT EXISTS person_relationships (
  relationship_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  from_person_id uuid NOT NULL REFERENCES people(person_id) ON DELETE CASCADE,
  to_person_id uuid NOT NULL REFERENCES people(person_id) ON DELETE CASCADE,
  relationship_type text NOT NULL,
  label text NOT NULL DEFAULT '',
  strength text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT person_relationships_not_self CHECK (from_person_id <> to_person_id)
);

CREATE INDEX IF NOT EXISTS person_relationships_tenant_from_idx ON person_relationships (tenant_id, from_person_id);
CREATE INDEX IF NOT EXISTS person_relationships_tenant_to_idx ON person_relationships (tenant_id, to_person_id);

CREATE TABLE IF NOT EXISTS leads (
  lead_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  resident_person_id uuid REFERENCES people(person_id),
  status text NOT NULL DEFAULT 'New',
  urgency text NOT NULL DEFAULT '',
  budget text NOT NULL DEFAULT '',
  care_needs text NOT NULL DEFAULT '',
  preferred_area text NOT NULL DEFAULT '',
  assigned_user_id uuid REFERENCES app_users(user_id),
  next_step text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_tenant_status_idx ON leads (tenant_id, status);
CREATE INDEX IF NOT EXISTS leads_tenant_assigned_idx ON leads (tenant_id, assigned_user_id);

CREATE TABLE IF NOT EXISTS lead_people (
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(lead_id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES people(person_id) ON DELETE CASCADE,
  role text NOT NULL,
  is_decision_maker boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, lead_id, person_id)
);

CREATE TABLE IF NOT EXISTS lead_facilities (
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(lead_id) ON DELETE CASCADE,
  facility_key text NOT NULL REFERENCES facilities(facility_key),
  priority integer NOT NULL DEFAULT 0,
  is_excluded boolean NOT NULL DEFAULT false,
  fit_notes text NOT NULL DEFAULT '',
  tour_status text NOT NULL DEFAULT '',
  availability_status text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, lead_id, facility_key)
);

CREATE TABLE IF NOT EXISTS communications (
  communication_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(lead_id) ON DELETE SET NULL,
  person_id uuid REFERENCES people(person_id) ON DELETE SET NULL,
  facility_key text REFERENCES facilities(facility_key),
  direction text NOT NULL,
  channel text NOT NULL,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES app_users(user_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS communications_tenant_lead_idx ON communications (tenant_id, lead_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS communications_tenant_person_idx ON communications (tenant_id, person_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS communications_tenant_facility_idx ON communications (tenant_id, facility_key, occurred_at DESC);

CREATE TABLE IF NOT EXISTS tasks (
  task_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(lead_id) ON DELETE CASCADE,
  person_id uuid REFERENCES people(person_id) ON DELETE SET NULL,
  facility_key text REFERENCES facilities(facility_key),
  assigned_user_id uuid REFERENCES app_users(user_id),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_tenant_status_due_idx ON tasks (tenant_id, status, due_at);

CREATE TABLE IF NOT EXISTS facility_contacts (
  contact_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_key text NOT NULL REFERENCES facilities(facility_key) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  website_url text NOT NULL DEFAULT '',
  final_url text NOT NULL DEFAULT '',
  checked_at timestamptz,
  parser_version text NOT NULL DEFAULT '',
  emails text[] NOT NULL DEFAULT '{}',
  phones text[] NOT NULL DEFAULT '{}',
  contact_links text[] NOT NULL DEFAULT '{}',
  fetched_pages jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  parser_rules text[] NOT NULL DEFAULT '{}',
  parsing_notes text[] NOT NULL DEFAULT '{}',
  source_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS facility_contacts_facility_idx ON facility_contacts (facility_key, checked_at DESC);

CREATE TABLE IF NOT EXISTS referral_sources (
  referral_source_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name text NOT NULL,
  source_type text NOT NULL,
  organization text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email citext,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integrations (
  integration_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  provider text NOT NULL,
  mode text NOT NULL DEFAULT 'one_way',
  status text NOT NULL DEFAULT 'disabled',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);

CREATE TABLE IF NOT EXISTS integration_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  integration_id uuid REFERENCES integrations(integration_id) ON DELETE SET NULL,
  event_type text NOT NULL,
  external_id text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'received',
  error text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS integration_events_tenant_created_idx ON integration_events (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_log (
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(tenant_id) ON DELETE SET NULL,
  user_id uuid REFERENCES app_users(user_id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_tenant_created_idx ON audit_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log (entity_type, entity_id);

INSERT INTO tenants (name, slug, settings)
VALUES ('Local Demo Tenant', 'local-demo', '{"environment":"local"}')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('001_initial_schema')
ON CONFLICT (version) DO NOTHING;

COMMIT;
