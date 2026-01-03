-- Test: Try to create a VerificationCode with null userId
-- This will only work if the constraint was properly removed

-- First, get or create a test signup session
INSERT INTO signup_sessions (
    id, email, "expiresAt", "createdAt", "updatedAt"
) VALUES (
    'test-session-' || gen_random_uuid()::text,
    'test@example.com',
    NOW() + INTERVAL '24 hours',
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING
RETURNING id;

-- Try to create a verification code with null userId
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
) 
SELECT 
    gen_random_uuid()::text,
    NULL,  -- userId is null
    s.id,  -- sessionId is set
    'EMAIL',
    '123456',
    'test@example.com',
    NOW() + INTERVAL '15 minutes',
    0,
    NOW()
FROM signup_sessions s
WHERE s.email = 'test@example.com'
LIMIT 1
RETURNING id, "userId", "sessionId", type;

-- Clean up test data
DELETE FROM "VerificationCode" WHERE code = '123456' AND "contactInfo" = 'test@example.com';
DELETE FROM signup_sessions WHERE email = 'test@example.com';

