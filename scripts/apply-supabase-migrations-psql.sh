#!/bin/bash

# Apply Supabase migrations from terminal using psql
# 
# Usage:
#   ./scripts/apply-supabase-migrations-psql.sh
# 
# Or:
#   bash scripts/apply-supabase-migrations-psql.sh
#
# Requirements:
#   - DATABASE_URL environment variable must be set
#   - psql command-line tool must be installed

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Migration files to run in order
MIGRATIONS=(
  "002_upgrade_messaging_schema.sql"
  "005_phase4_disputes.sql"
  "006_phase5_risk_engine.sql"
  "007_phase6_chargeback_defense.sql"
)

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
MIGRATIONS_DIR="$PROJECT_DIR/supabase/migrations"

echo -e "${BLUE}🚀 Applying Supabase Migrations${NC}\n"

# Check if psql is installed
if ! command -v psql &> /dev/null; then
  echo -e "${RED}❌ Error: psql (PostgreSQL client) is not installed${NC}"
  echo ""
  echo "To install psql:"
  echo "  macOS: brew install postgresql"
  echo "  Ubuntu/Debian: sudo apt-get install postgresql-client"
  echo "  Windows: Install PostgreSQL from https://www.postgresql.org/download/"
  exit 1
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}❌ Error: DATABASE_URL environment variable is not set${NC}"
  echo ""
  echo "Please set DATABASE_URL in your environment:"
  echo "  export DATABASE_URL=\"postgresql://user:password@host:port/database\""
  echo ""
  echo "Or if using .env file, source it first:"
  echo "  source .env.local  # or .env"
  exit 1
fi

# Mask password in URL for display
DISPLAY_URL=$(echo "$DATABASE_URL" | sed 's/:[^:@]*@/:****@/')
echo -e "${GREEN}✅ Found DATABASE_URL${NC}"
echo "   Connection: $DISPLAY_URL"
echo ""

# Check if migrations directory exists
if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo -e "${RED}❌ Error: Migrations directory not found: $MIGRATIONS_DIR${NC}"
  exit 1
fi

# Apply migrations
SUCCESS_COUNT=0
FAIL_COUNT=0

for migration in "${MIGRATIONS[@]}"; do
  MIGRATION_PATH="$MIGRATIONS_DIR/$migration"
  
  if [ ! -f "$MIGRATION_PATH" ]; then
    echo -e "${RED}❌ Migration file not found: $MIGRATION_PATH${NC}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    continue
  fi
  
  echo -e "${BLUE}📄 Applying: $migration...${NC}"
  
  if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f "$MIGRATION_PATH"; then
    echo -e "${GREEN}✅ Successfully applied: $migration${NC}"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  else
    echo -e "${RED}❌ Failed to apply: $migration${NC}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    echo -e "${YELLOW}⚠️  Stopping after failure. Fix the error and run again to continue.${NC}"
    break
  fi
done

# Summary
echo ""
echo "=================================================="
echo "📊 Migration Summary:"
echo -e "   ${GREEN}✅ Successful: $SUCCESS_COUNT${NC}"
echo -e "   ${RED}❌ Failed: $FAIL_COUNT${NC}"
echo "=================================================="
echo ""

if [ $FAIL_COUNT -gt 0 ]; then
  echo -e "${RED}❌ Some migrations failed. Please fix the errors and run again.${NC}"
  exit 1
else
  echo -e "${GREEN}✅ All migrations applied successfully!${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Verify tables in Supabase Dashboard → Table Editor"
  echo "  2. Restart your application"
  echo "  3. Test the features that use these tables"
  exit 0
fi

