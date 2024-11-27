-- This script toggles the private channel permission (bit 1)

UPDATE "ServerChannelPermissions"
SET permissions = CASE WHEN permissions & 1 = 1 THEN permissions & ~1 ELSE permissions | 1 END;