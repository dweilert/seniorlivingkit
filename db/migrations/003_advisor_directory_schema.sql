BEGIN;

CREATE TABLE IF NOT EXISTS advisor_sources (
  source_id text PRIMARY KEY,
  name text NOT NULL,
  source_owner text NOT NULL,
  source_system text NOT NULL,
  source_url text NOT NULL,
  source_description text NOT NULL DEFAULT '',
  parsing_notes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS advisor_source_runs (
  run_id text PRIMARY KEY,
  source_id text NOT NULL REFERENCES advisor_sources(source_id),
  generated_at timestamptz NOT NULL,
  selected_records integer NOT NULL DEFAULT 0,
  selected_records_sha256 text,
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS advisor_records (
  advisor_record_key text PRIMARY KEY,
  source_id text NOT NULL REFERENCES advisor_sources(source_id),
  source_run_id text REFERENCES advisor_source_runs(run_id),
  source_record_id text NOT NULL DEFAULT '',
  source_record_index integer,
  name text NOT NULL,
  agency text NOT NULL DEFAULT '',
  certified_since date,
  locations jsonb NOT NULL DEFAULT '[]'::jsonb,
  location text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  zip text NOT NULL DEFAULT '',
  main_industry text NOT NULL DEFAULT '',
  website_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  phone_numbers jsonb NOT NULL DEFAULT '[]'::jsonb,
  emails jsonb NOT NULL DEFAULT '[]'::jsonb,
  certifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text NOT NULL DEFAULT '',
  operational_approach text NOT NULL DEFAULT '',
  profile_image_url text NOT NULL DEFAULT '',
  detail_url text NOT NULL DEFAULT '',
  source_page_url text NOT NULL DEFAULT '',
  source_url text NOT NULL DEFAULT '',
  raw_card_text text NOT NULL DEFAULT '',
  raw_record jsonb NOT NULL DEFAULT '{}'::jsonb,
  collected_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  search_text tsvector GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(name, '') || ' ' ||
      coalesce(agency, '') || ' ' ||
      coalesce(location, '') || ' ' ||
      coalesce(city, '') || ' ' ||
      coalesce(state, '') || ' ' ||
      coalesce(zip, '') || ' ' ||
      coalesce(main_industry, '') || ' ' ||
      coalesce(summary, '') || ' ' ||
      coalesce(operational_approach, '')
    )
  ) STORED
);

CREATE INDEX IF NOT EXISTS advisor_records_source_idx ON advisor_records (source_id);
CREATE INDEX IF NOT EXISTS advisor_records_name_idx ON advisor_records (name);
CREATE INDEX IF NOT EXISTS advisor_records_state_city_idx ON advisor_records (state, city);
CREATE INDEX IF NOT EXISTS advisor_records_agency_idx ON advisor_records (agency);
CREATE INDEX IF NOT EXISTS advisor_records_main_industry_idx ON advisor_records (main_industry);
CREATE INDEX IF NOT EXISTS advisor_records_search_idx ON advisor_records USING gin (search_text);
CREATE INDEX IF NOT EXISTS advisor_records_name_trgm_idx ON advisor_records USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS advisor_records_agency_trgm_idx ON advisor_records USING gin (agency gin_trgm_ops);

CREATE TABLE IF NOT EXISTS advisor_record_matches (
  match_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  left_advisor_record_key text NOT NULL REFERENCES advisor_records(advisor_record_key) ON DELETE CASCADE,
  right_advisor_record_key text NOT NULL REFERENCES advisor_records(advisor_record_key) ON DELETE CASCADE,
  match_method text NOT NULL,
  match_score numeric(5,2) NOT NULL DEFAULT 0,
  match_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT advisor_record_matches_not_self CHECK (left_advisor_record_key <> right_advisor_record_key),
  UNIQUE (left_advisor_record_key, right_advisor_record_key, match_method)
);

CREATE INDEX IF NOT EXISTS advisor_record_matches_left_idx ON advisor_record_matches (left_advisor_record_key);
CREATE INDEX IF NOT EXISTS advisor_record_matches_right_idx ON advisor_record_matches (right_advisor_record_key);

INSERT INTO schema_migrations (version)
VALUES ('003_advisor_directory_schema')
ON CONFLICT (version) DO NOTHING;

COMMIT;
