ALTER TABLE "messages" 
ALTER COLUMN "htmlEmbed" TYPE BYTEA 
USING decode("htmlEmbed", 'base64');