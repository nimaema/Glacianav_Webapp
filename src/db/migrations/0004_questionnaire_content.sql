BEGIN;
CREATE TABLE IF NOT EXISTS questionnaire_media (
  id uuid PRIMARY KEY,
  questionnaire_id uuid NOT NULL REFERENCES questionnaires(id),
  name text NOT NULL, mime text NOT NULL, size integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE questionnaire_media ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS questionnaire_media_owner_idx ON questionnaire_media(questionnaire_id);
ALTER TABLE questionnaire_invitations ADD COLUMN IF NOT EXISTS name_question_id text;
ALTER TABLE questionnaire_invitations DROP CONSTRAINT IF EXISTS questionnaire_invitations_campaign_id_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS questionnaire_invitation_email_idx ON questionnaire_invitations(campaign_id,email) WHERE email <> '';
-- Decode the known serialization defect without removing or replacing content.
UPDATE questionnaires SET draft=(draft #>> '{}')::jsonb
WHERE jsonb_typeof(draft)='string' AND jsonb_typeof((draft #>> '{}')::jsonb)='object';
COMMIT;
