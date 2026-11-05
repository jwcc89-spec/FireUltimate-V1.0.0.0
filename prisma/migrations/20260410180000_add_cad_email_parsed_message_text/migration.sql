-- Batch H: store message-rule pipeline output per ingested CAD email
ALTER TABLE "CadEmailIngest" ADD COLUMN "parsedMessageText" TEXT NOT NULL DEFAULT '';
