CREATE TABLE IF NOT EXISTS app_users (
  id text PRIMARY KEY,
  username varchar(30) NOT NULL,
  email varchar(120) NOT NULL,
  password_hash text NOT NULL,
  role varchar(10) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'guest')),
  default_color varchar(7) NOT NULL DEFAULT '#ff5d43',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS app_users_username_lower_idx ON app_users (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_lower_idx ON app_users (lower(email));

CREATE TABLE IF NOT EXISTS board_snapshots (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL,
  saved_by varchar(30) NOT NULL,
  kind varchar(20) NOT NULL DEFAULT 'manual',
  schema_version integer NOT NULL DEFAULT 1,
  payload jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS board_snapshots_created_at_idx ON board_snapshots (created_at DESC);

CREATE TABLE IF NOT EXISTS activity_runs (
  id text PRIMARY KEY,
  started_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT activity_runs_entries_array CHECK (jsonb_typeof(entries) = 'array')
);

CREATE INDEX IF NOT EXISTS activity_runs_started_at_idx ON activity_runs (started_at DESC);
