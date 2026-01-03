-- Test: Verify that VerificationCode can be created with null userId
-- This should work if the constraint was properly removed

-- First, check if we have a signup session to test with
SELECT id, email FROM signup_sessions LIMIT 1;

-- Try to create a verification code with null userId and valid sessionId
-- (This will only work if the constraint was removed)
INSERT INTO "VerificationCode" (
    id,
    "userId",
    "sessionId",
    type,
    code,
    "contactInfo",
    "expiresAt",
    attempts,
    "createdAt"
) VALUES (
    gen_random_uuid()::text,
    NULL,  -- userId is null
    (SELECT id FROM signup_sessions LIMIT 1),  -- sessionId is set
    'EMAIL',
    '123456',
    'test@example.com',
    NOW() + INTERVAL '15 minutes',
    0,
    NOW()
) RETURNING id, "userId", "sessionId", type;

-- Clean up test data
DELETE FROM "VerificationCode" WHERE code = '123456' AND "contactInfo" = 'test@example.com';

