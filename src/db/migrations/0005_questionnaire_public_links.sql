BEGIN;
ALTER TABLE questionnaire_campaigns ADD COLUMN IF NOT EXISTS public_token text;
CREATE UNIQUE INDEX IF NOT EXISTS questionnaire_public_token_idx ON questionnaire_campaigns(public_token) WHERE public_token IS NOT NULL;
ALTER TABLE questionnaire_invitations ADD COLUMN IF NOT EXISTS public_link_token text;
COMMIT;
