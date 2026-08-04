BEGIN;

CREATE TABLE IF NOT EXISTS lead_statuses (
  status_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name text NOT NULL,
  stage_order integer NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  is_closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS lead_statuses_tenant_order_idx ON lead_statuses (tenant_id, stage_order);

CREATE TABLE IF NOT EXISTS lead_status_history (
  status_history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(lead_id) ON DELETE CASCADE,
  from_status text NOT NULL DEFAULT '',
  to_status text NOT NULL,
  changed_by_user_id uuid REFERENCES app_users(user_id) ON DELETE SET NULL,
  change_reason text NOT NULL DEFAULT '',
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_status_history_lead_idx ON lead_status_history (tenant_id, lead_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS lead_community_options (
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(lead_id) ON DELETE CASCADE,
  facility_key text NOT NULL REFERENCES facilities(facility_key),
  option_status text NOT NULL DEFAULT 'potential_match',
  match_score numeric(5,2),
  is_excluded boolean NOT NULL DEFAULT false,
  exclusion_reason text NOT NULL DEFAULT '',
  referred_at timestamptz,
  selected_at timestamptz,
  declined_at timestamptz,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, lead_id, facility_key)
);

CREATE INDEX IF NOT EXISTS lead_community_options_status_idx ON lead_community_options (tenant_id, option_status);
CREATE INDEX IF NOT EXISTS lead_community_options_facility_idx ON lead_community_options (facility_key);

CREATE TABLE IF NOT EXISTS facility_pricing_updates (
  pricing_update_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  facility_key text NOT NULL REFERENCES facilities(facility_key) ON DELETE CASCADE,
  care_category text NOT NULL DEFAULT '',
  min_monthly_cost numeric(12,2),
  max_monthly_cost numeric(12,2),
  currency text NOT NULL DEFAULT 'USD',
  effective_date date,
  source_type text NOT NULL DEFAULT '',
  source_url text NOT NULL DEFAULT '',
  source_note text NOT NULL DEFAULT '',
  parser_version text NOT NULL DEFAULT '',
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS facility_pricing_updates_facility_idx ON facility_pricing_updates (facility_key, checked_at DESC);

CREATE TABLE IF NOT EXISTS facility_availability_updates (
  availability_update_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  facility_key text NOT NULL REFERENCES facilities(facility_key) ON DELETE CASCADE,
  vacancy_status text NOT NULL,
  available_beds integer,
  care_category text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  source_type text NOT NULL DEFAULT '',
  source_url text NOT NULL DEFAULT '',
  source_note text NOT NULL DEFAULT '',
  parser_version text NOT NULL DEFAULT '',
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS facility_availability_updates_facility_idx ON facility_availability_updates (facility_key, checked_at DESC);
CREATE INDEX IF NOT EXISTS facility_availability_updates_status_idx ON facility_availability_updates (vacancy_status, checked_at DESC);

CREATE TABLE IF NOT EXISTS tours (
  tour_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(lead_id) ON DELETE CASCADE,
  facility_key text NOT NULL REFERENCES facilities(facility_key),
  scheduled_at timestamptz,
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  attendee_notes text NOT NULL DEFAULT '',
  feedback text NOT NULL DEFAULT '',
  next_step text NOT NULL DEFAULT '',
  created_by_user_id uuid REFERENCES app_users(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tours_tenant_lead_idx ON tours (tenant_id, lead_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS tours_facility_idx ON tours (facility_key, scheduled_at DESC);

CREATE TABLE IF NOT EXISTS task_types (
  task_type_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type_id uuid REFERENCES task_types(task_type_id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_rule text NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS custom_fields (
  custom_field_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  field_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_required boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entity_type, field_key)
);

CREATE INDEX IF NOT EXISTS custom_fields_tenant_entity_idx ON custom_fields (tenant_id, entity_type, display_order);

CREATE TABLE IF NOT EXISTS custom_field_values (
  custom_field_value_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  custom_field_id uuid NOT NULL REFERENCES custom_fields(custom_field_id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  value jsonb NOT NULL DEFAULT 'null'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, custom_field_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS custom_field_values_entity_idx ON custom_field_values (tenant_id, entity_type, entity_id);

CREATE TABLE IF NOT EXISTS email_templates (
  email_template_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name text NOT NULL,
  template_type text NOT NULL DEFAULT 'email',
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  placeholders jsonb NOT NULL DEFAULT '[]'::jsonb,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_shared boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_by_user_id uuid REFERENCES app_users(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS report_definitions (
  report_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name text NOT NULL,
  record_type text NOT NULL,
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  grouping jsonb NOT NULL DEFAULT '[]'::jsonb,
  schedule jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_shared boolean NOT NULL DEFAULT false,
  created_by_user_id uuid REFERENCES app_users(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS workflow_definitions (
  workflow_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_type text NOT NULL,
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  workflow_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  workflow_id uuid REFERENCES workflow_definitions(workflow_id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text NOT NULL DEFAULT '',
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workflow_runs_tenant_created_idx ON workflow_runs (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS invoices (
  invoice_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(lead_id) ON DELETE SET NULL,
  facility_key text REFERENCES facilities(facility_key),
  invoice_number text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  sent_at timestamptz,
  due_date date,
  external_invoice_url text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS invoice_items (
  invoice_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  payment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  payment_method text NOT NULL DEFAULT '',
  external_payment_id text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signature_templates (
  signature_template_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name text NOT NULL,
  source_document_uri text NOT NULL DEFAULT '',
  sender_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  recipient_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS signature_requests (
  signature_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  signature_template_id uuid REFERENCES signature_templates(signature_template_id) ON DELETE SET NULL,
  lead_id uuid REFERENCES leads(lead_id) ON DELETE SET NULL,
  facility_key text REFERENCES facilities(facility_key),
  status text NOT NULL DEFAULT 'draft',
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  signed_document_uri text NOT NULL DEFAULT '',
  sent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO lead_statuses (tenant_id, name, stage_order, color, is_closed)
SELECT tenant_id, status_name, stage_order, color, is_closed
FROM tenants
CROSS JOIN (VALUES
  ('New', 10, '#2563eb', false),
  ('Contacted', 20, '#0891b2', false),
  ('Assessment', 30, '#7c3aed', false),
  ('Touring', 40, '#ca8a04', false),
  ('Application', 50, '#ea580c', false),
  ('Move-in', 60, '#16a34a', true),
  ('Closed', 70, '#64748b', true)
) AS seed(status_name, stage_order, color, is_closed)
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO task_types (tenant_id, name, color)
SELECT tenant_id, task_type_name, color
FROM tenants
CROSS JOIN (VALUES
  ('Call', '#2563eb'),
  ('Email', '#0891b2'),
  ('Tour', '#ca8a04'),
  ('Document', '#7c3aed'),
  ('Follow-up', '#16a34a')
) AS seed(task_type_name, color)
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('002_placement_workflow_schema')
ON CONFLICT (version) DO NOTHING;

COMMIT;
