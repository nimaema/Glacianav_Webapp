BEGIN;
-- Published versions are immutable in ordinary use. A managed, transactional
-- questionnaire removal may delete them only after explicitly setting this
-- transaction-local guard in the application service.
CREATE OR REPLACE FUNCTION questionnaire_immutable_version() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF TG_OP = 'DELETE' AND current_setting('questionnaire.allow_version_delete', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Published questionnaire versions are immutable';
END $$;
COMMIT;
