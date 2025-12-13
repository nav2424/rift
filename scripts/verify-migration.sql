-- Script to verify database state before running migration
-- Run this to check if required enums exist

-- Check if EscrowStatus exists
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EscrowStatus') 
        THEN 'EscrowStatus enum EXISTS'
        ELSE 'EscrowStatus enum DOES NOT EXIST - Run baseline migration first!'
    END as escrow_status_check;

-- Check if DisputeStatus exists
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DisputeStatus') 
        THEN 'DisputeStatus enum EXISTS'
        ELSE 'DisputeStatus enum DOES NOT EXIST - Run baseline migration first!'
    END as dispute_status_check;

-- List all existing EscrowStatus values (if enum exists)
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EscrowStatus')
        THEN string_agg(enumlabel, ', ' ORDER BY enumsortorder)
        ELSE 'Enum does not exist'
    END as existing_escrow_status_values
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'EscrowStatus' LIMIT 1);
