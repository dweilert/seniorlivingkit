BEGIN;

CREATE TABLE IF NOT EXISTS assessment_templates (
  assessment_template_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name text NOT NULL,
  assessment_type text NOT NULL DEFAULT 'client_needs',
  description text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name, version)
);

CREATE TABLE IF NOT EXISTS assessment_template_sections (
  assessment_template_section_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_template_id uuid NOT NULL REFERENCES assessment_templates(assessment_template_id) ON DELETE CASCADE,
  section_key text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_template_id, section_key)
);

CREATE TABLE IF NOT EXISTS assessment_questions (
  assessment_question_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_template_section_id uuid NOT NULL REFERENCES assessment_template_sections(assessment_template_section_id) ON DELETE CASCADE,
  question_key text NOT NULL,
  label text NOT NULL,
  help_text text NOT NULL DEFAULT '',
  response_type text NOT NULL DEFAULT 'text',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  scoring jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_required boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_template_section_id, question_key)
);

CREATE TABLE IF NOT EXISTS lead_assessments (
  lead_assessment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(lead_id) ON DELETE CASCADE,
  assessment_template_id uuid REFERENCES assessment_templates(assessment_template_id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  score numeric(8,2),
  summary text NOT NULL DEFAULT '',
  completed_at timestamptz,
  completed_by_user_id uuid REFERENCES app_users(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_assessments_tenant_lead_idx ON lead_assessments (tenant_id, lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS assessment_answers (
  assessment_answer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  lead_assessment_id uuid NOT NULL REFERENCES lead_assessments(lead_assessment_id) ON DELETE CASCADE,
  assessment_question_id uuid REFERENCES assessment_questions(assessment_question_id) ON DELETE SET NULL,
  question_key text NOT NULL,
  value jsonb NOT NULL DEFAULT 'null'::jsonb,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, lead_assessment_id, question_key)
);

CREATE TABLE IF NOT EXISTS form_templates (
  form_template_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name text NOT NULL,
  form_type text NOT NULL,
  description text NOT NULL DEFAULT '',
  schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_printable boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS form_submissions (
  form_submission_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  form_template_id uuid REFERENCES form_templates(form_template_id) ON DELETE SET NULL,
  lead_id uuid REFERENCES leads(lead_id) ON DELETE CASCADE,
  facility_key text REFERENCES facilities(facility_key) ON DELETE SET NULL,
  person_id uuid REFERENCES people(person_id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  submitted_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  submitted_by_user_id uuid REFERENCES app_users(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS form_submissions_lead_idx ON form_submissions (tenant_id, lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS form_submissions_facility_idx ON form_submissions (tenant_id, facility_key, created_at DESC);

CREATE TABLE IF NOT EXISTS entity_files (
  file_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  file_name text NOT NULL,
  content_type text NOT NULL DEFAULT '',
  byte_size bigint,
  storage_uri text NOT NULL,
  source_type text NOT NULL DEFAULT 'upload',
  extracted_text text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by_user_id uuid REFERENCES app_users(user_id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entity_files_entity_idx ON entity_files (tenant_id, entity_type, entity_id, uploaded_at DESC);

CREATE TABLE IF NOT EXISTS facility_profiles (
  facility_key text PRIMARY KEY REFERENCES facilities(facility_key) ON DELETE CASCADE,
  profile_status text NOT NULL DEFAULT 'unverified',
  care_levels text[] NOT NULL DEFAULT '{}',
  amenities jsonb NOT NULL DEFAULT '[]'::jsonb,
  services jsonb NOT NULL DEFAULT '[]'::jsonb,
  room_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  accepted_payment_types text[] NOT NULL DEFAULT '{}',
  admission_requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  pet_policy text NOT NULL DEFAULT '',
  meal_program text NOT NULL DEFAULT '',
  transportation text NOT NULL DEFAULT '',
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  profile_source text NOT NULL DEFAULT '',
  confidence numeric(5,2),
  reviewed_at timestamptz,
  reviewed_by_user_id uuid REFERENCES app_users(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_report_packages (
  report_package_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(lead_id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  report_type text NOT NULL DEFAULT 'community_comparison',
  status text NOT NULL DEFAULT 'draft',
  cover_note text NOT NULL DEFAULT '',
  generated_uri text NOT NULL DEFAULT '',
  sent_at timestamptz,
  created_by_user_id uuid REFERENCES app_users(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_report_packages_lead_idx ON community_report_packages (tenant_id, lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS community_report_items (
  report_package_id uuid NOT NULL REFERENCES community_report_packages(report_package_id) ON DELETE CASCADE,
  facility_key text NOT NULL REFERENCES facilities(facility_key) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  recommendation_label text NOT NULL DEFAULT '',
  strengths text[] NOT NULL DEFAULT '{}',
  concerns text[] NOT NULL DEFAULT '{}',
  fit_score numeric(5,2),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (report_package_id, facility_key)
);

CREATE TABLE IF NOT EXISTS communication_threads (
  communication_thread_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(lead_id) ON DELETE CASCADE,
  person_id uuid REFERENCES people(person_id) ON DELETE SET NULL,
  facility_key text REFERENCES facilities(facility_key) ON DELETE SET NULL,
  subject text NOT NULL DEFAULT '',
  channel text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  last_activity_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS communication_threads_lead_idx ON communication_threads (tenant_id, lead_id, last_activity_at DESC);

ALTER TABLE communications ADD COLUMN IF NOT EXISTS communication_thread_id uuid REFERENCES communication_threads(communication_thread_id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS calendar_events (
  calendar_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  title text NOT NULL,
  event_type text NOT NULL DEFAULT 'general',
  lead_id uuid REFERENCES leads(lead_id) ON DELETE CASCADE,
  person_id uuid REFERENCES people(person_id) ON DELETE SET NULL,
  facility_key text REFERENCES facilities(facility_key) ON DELETE SET NULL,
  task_id uuid REFERENCES tasks(task_id) ON DELETE SET NULL,
  tour_id uuid REFERENCES tours(tour_id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  timezone text NOT NULL DEFAULT 'America/Chicago',
  location text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'scheduled',
  external_calendar_id text NOT NULL DEFAULT '',
  external_event_id text NOT NULL DEFAULT '',
  created_by_user_id uuid REFERENCES app_users(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS calendar_events_tenant_start_idx ON calendar_events (tenant_id, starts_at);
CREATE INDEX IF NOT EXISTS calendar_events_lead_idx ON calendar_events (tenant_id, lead_id, starts_at);

INSERT INTO schema_migrations (version)
VALUES ('005_screen_driven_product_model')
ON CONFLICT (version) DO NOTHING;

COMMIT;
