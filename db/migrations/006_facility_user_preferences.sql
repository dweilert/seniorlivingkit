BEGIN;

CREATE TABLE IF NOT EXISTS facility_user_preferences (
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
  facility_key text NOT NULL REFERENCES facilities(facility_key) ON DELETE CASCADE,
  priority integer NOT NULL DEFAULT 0,
  is_excluded boolean NOT NULL DEFAULT false,
  is_favorite boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id, facility_key),
  CONSTRAINT facility_user_preferences_priority_range CHECK (priority BETWEEN 0 AND 9)
);

CREATE INDEX IF NOT EXISTS facility_user_preferences_tenant_user_idx
  ON facility_user_preferences (tenant_id, user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS facility_user_preferences_facility_idx
  ON facility_user_preferences (facility_key);

INSERT INTO app_users (email, full_name)
VALUES ('local-demo-user@example.com', 'Local Demo User')
ON CONFLICT (email) DO UPDATE SET
  full_name = excluded.full_name,
  updated_at = now();

INSERT INTO tenant_users (tenant_id, user_id, role)
SELECT tenant.tenant_id, app_user.user_id, 'admin'
FROM tenants tenant
CROSS JOIN app_users app_user
WHERE tenant.slug = 'local-demo'
  AND app_user.email = 'local-demo-user@example.com'
ON CONFLICT (tenant_id, user_id) DO UPDATE SET
  role = excluded.role;

INSERT INTO schema_migrations (version)
VALUES ('006_facility_user_preferences')
ON CONFLICT (version) DO NOTHING;

COMMIT;
