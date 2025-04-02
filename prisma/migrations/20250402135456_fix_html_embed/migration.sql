-- Remove double quotes from htmlEmbed

UPDATE "Message" 
SET
  "htmlEmbed" = REPLACE("htmlEmbed", '"', '')
WHERE "htmlEmbed" IS NOT NULL;