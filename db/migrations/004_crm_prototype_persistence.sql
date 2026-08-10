BEGIN;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS external_key text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS relationship_summary text NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email citext;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to_label text NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS leads_tenant_external_key_idx
  ON leads (tenant_id, external_key)
  WHERE external_key IS NOT NULL;

ALTER TABLE person_relationships ADD COLUMN IF NOT EXISTS external_key text;

CREATE UNIQUE INDEX IF NOT EXISTS person_relationships_tenant_external_key_idx
  ON person_relationships (tenant_id, external_key)
  WHERE external_key IS NOT NULL;

ALTER TABLE communications ADD COLUMN IF NOT EXISTS external_key text;
ALTER TABLE communications ADD COLUMN IF NOT EXISTS context text NOT NULL DEFAULT '';
ALTER TABLE communications ADD COLUMN IF NOT EXISTS raw_record jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS communications_tenant_external_key_idx
  ON communications (tenant_id, external_key)
  WHERE external_key IS NOT NULL;

COMMIT;
