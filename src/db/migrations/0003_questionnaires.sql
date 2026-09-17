BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname='notification_kind') THEN
    ALTER TYPE notification_kind ADD VALUE IF NOT EXISTS 'questionnaire_submitted';
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS questionnaires (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL, title text NOT NULL, description text NOT NULL DEFAULT '',
  draft jsonb NOT NULL, draft_revision integer NOT NULL DEFAULT 1, published_version integer,
  archived boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS questionnaire_versions (
  id uuid PRIMARY KEY, questionnaire_id uuid NOT NULL REFERENCES questionnaires(id), number integer NOT NULL,
  definition jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(questionnaire_id,number), UNIQUE(id,questionnaire_id)
);
CREATE TABLE IF NOT EXISTS questionnaire_access (
  questionnaire_id uuid NOT NULL REFERENCES questionnaires(id), profile_id uuid NOT NULL,
  role text NOT NULL CHECK(role IN ('editor','sender','analyst')), PRIMARY KEY(questionnaire_id,profile_id)
);
CREATE TABLE IF NOT EXISTS questionnaire_campaigns (
  id uuid PRIMARY KEY, questionnaire_id uuid NOT NULL REFERENCES questionnaires(id), version_id uuid NOT NULL,
  name text NOT NULL, state text NOT NULL DEFAULT 'open' CHECK(state IN ('open','closed')), closes_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(version_id,questionnaire_id) REFERENCES questionnaire_versions(id,questionnaire_id), UNIQUE(id,version_id)
);
CREATE TABLE IF NOT EXISTS questionnaire_invitations (
  id uuid PRIMARY KEY, campaign_id uuid NOT NULL REFERENCES questionnaire_campaigns(id), name text NOT NULL, email text NOT NULL,
  contact_id text, customer_id text, customer_name text, segment text, token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'invited' CHECK(status IN ('invited','started','submitted','declined','revoked')),
  delivery text NOT NULL DEFAULT 'manual', created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz,
  last_reminder_at timestamptz, started_at timestamptz, submitted_at timestamptz, UNIQUE(campaign_id,email)
);
CREATE TABLE IF NOT EXISTS questionnaire_responses (
  id uuid PRIMARY KEY, invitation_id uuid NOT NULL UNIQUE REFERENCES questionnaire_invitations(id), version_id uuid NOT NULL REFERENCES questionnaire_versions(id),
  answers jsonb NOT NULL DEFAULT '{}', states jsonb NOT NULL DEFAULT '{}', revision integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted')), page integer NOT NULL DEFAULT 0,
  annotation text NOT NULL DEFAULT '', receipt uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), submitted_at timestamptz
);
CREATE TABLE IF NOT EXISTS questionnaire_response_revisions (
  id uuid PRIMARY KEY, response_id uuid NOT NULL REFERENCES questionnaire_responses(id), revision integer NOT NULL,
  answers jsonb NOT NULL, states jsonb NOT NULL, submitted_at timestamptz NOT NULL DEFAULT now(), UNIQUE(response_id,revision)
);
CREATE TABLE IF NOT EXISTS questionnaire_sessions (
  token_hash text PRIMARY KEY, invitation_id uuid NOT NULL REFERENCES questionnaire_invitations(id),
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS questionnaire_assets (
  id uuid PRIMARY KEY, invitation_id uuid NOT NULL REFERENCES questionnaire_invitations(id), question_id text NOT NULL,
  name text NOT NULL, mime text NOT NULL, size integer NOT NULL, storage_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS questionnaire_events (
  id uuid PRIMARY KEY, questionnaire_id uuid NOT NULL REFERENCES questionnaires(id), actor text NOT NULL, kind text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS questionnaire_outbox (
  id uuid PRIMARY KEY, invitation_id uuid NOT NULL REFERENCES questionnaire_invitations(id), payload text NOT NULL,
  status text NOT NULL DEFAULT 'queued', attempts integer NOT NULL DEFAULT 0, scheduled_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz, provider_id text, error text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS questionnaire_webhooks (id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE questionnaire_outbox ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'invitation';
ALTER TABLE questionnaire_webhooks ADD COLUMN IF NOT EXISTS provider_id text;
ALTER TABLE questionnaire_webhooks ADD COLUMN IF NOT EXISTS delivery text;
ALTER TABLE questionnaire_webhooks ADD COLUMN IF NOT EXISTS processed boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS questionnaire_rate_limits (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS questionnaire_owner_idx ON questionnaires(owner_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS questionnaire_invitation_campaign_idx ON questionnaire_invitations(campaign_id,status);
CREATE INDEX IF NOT EXISTS questionnaire_response_version_idx ON questionnaire_responses(version_id,status);
CREATE INDEX IF NOT EXISTS questionnaire_outbox_due_idx ON questionnaire_outbox(status,scheduled_at);
CREATE INDEX IF NOT EXISTS questionnaire_asset_invitation_idx ON questionnaire_assets(invitation_id);
CREATE INDEX IF NOT EXISTS questionnaire_session_invitation_idx ON questionnaire_sessions(invitation_id);
-- These tables are server-managed. Supabase anon/authenticated API clients receive no policies.
ALTER TABLE questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_response_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION questionnaire_immutable_version() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  RAISE EXCEPTION 'Published questionnaire versions are immutable';
END $$;
DROP TRIGGER IF EXISTS questionnaire_version_immutable ON questionnaire_versions;
CREATE TRIGGER questionnaire_version_immutable BEFORE UPDATE OR DELETE ON questionnaire_versions
  FOR EACH ROW EXECUTE FUNCTION questionnaire_immutable_version();
CREATE OR REPLACE FUNCTION questionnaire_response_version_matches() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM questionnaire_invitations i JOIN questionnaire_campaigns c ON c.id=i.campaign_id WHERE i.id=NEW.invitation_id AND c.version_id=NEW.version_id) THEN
    RAISE EXCEPTION 'Response version does not match its invitation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS questionnaire_response_version_check ON questionnaire_responses;
CREATE TRIGGER questionnaire_response_version_check BEFORE INSERT OR UPDATE OF invitation_id,version_id ON questionnaire_responses
  FOR EACH ROW EXECUTE FUNCTION questionnaire_response_version_matches();
COMMIT;
