-- Add PAID enum value to EscrowStatus if it doesn't exist
DO $$ 
DECLARE
    enum_type_oid OID;
BEGIN
    -- Check if EscrowStatus enum exists
    SELECT oid INTO enum_type_oid FROM pg_type WHERE typname = 'EscrowStatus';
    
    -- Only proceed if the enum exists
    IF enum_type_oid IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PAID' AND enumtypid = enum_type_oid) THEN
            ALTER TYPE "EscrowStatus" ADD VALUE 'PAID';
            RAISE NOTICE 'Added PAID to EscrowStatus enum';
        ELSE
            RAISE NOTICE 'PAID already exists in EscrowStatus enum';
        END IF;
    ELSE
        RAISE NOTICE 'EscrowStatus enum does not exist';
    END IF;
END $$;

