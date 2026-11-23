-- Split CAD incident automation into create and update.
-- Existing departments that already create incidents keep updates on.
ALTER TABLE "CadParsingSettings" ADD COLUMN "enableIncidentUpdate" BOOLEAN NOT NULL DEFAULT false;

UPDATE "CadParsingSettings"
SET "enableIncidentUpdate" = "enableIncidentCreation";
