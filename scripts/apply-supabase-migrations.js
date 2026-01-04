#!/usr/bin/env node

/**
 * Apply Supabase migrations from terminal
 * 
 * This script applies the Supabase migrations (separate from Prisma migrations)
 * to your Supabase database using the DATABASE_URL connection string.
 * 
 * Usage:
 *   node scripts/apply-supabase-migrations.js
 * 
 * Requirements:
 *   - DATABASE_URL environment variable must be set
 *   - psql command-line tool must be installed
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Migration files to run in order
const MIGRATIONS = [
  '002_upgrade_messaging_schema.sql',
  '005_phase4_disputes.sql',
  '006_phase5_risk_engine.sql',
  '007_phase6_chargeback_defense.sql',
];

function getDatabaseUrl() {
  // Try multiple ways to get the database URL
  const databaseUrl = 
    process.env.DATABASE_URL || 
    process.env.POSTGRES_URL || 
    process.env.PRISMA_DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ Error: DATABASE_URL environment variable is not set');
    console.error('\nPlease set DATABASE_URL in your environment:');
    console.error('  export DATABASE_URL="postgresql://user:password@host:port/database"');
    console.error('\nOr create a .env file with:');
    console.error('  DATABASE_URL=postgresql://user:password@host:port/database');
    process.exit(1);
  }

  return databaseUrl;
}

function checkPsqlInstalled() {
  try {
    execSync('which psql', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

function runMigration(migrationFile, databaseUrl) {
  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  const migrationPath = path.join(migrationsDir, migrationFile);

  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`);
    return false;
  }

  console.log(`\n📄 Applying: ${migrationFile}...`);

  try {
    // Use psql to execute the SQL file
    // -f flag reads SQL from file (more reliable than -c for complex SQL)
    // -v ON_ERROR_STOP=1 stops on errors
    // --single-transaction ensures all-or-nothing execution
    const command = `psql "${databaseUrl}" -v ON_ERROR_STOP=1 --single-transaction -f "${migrationPath}"`;
    
    execSync(command, {
      stdio: 'inherit',
      env: process.env,
    });

    console.log(`✅ Successfully applied: ${migrationFile}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to apply ${migrationFile}:`);
    if (error.stdout) console.error(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
    return false;
  }
}

function main() {
  console.log('🚀 Applying Supabase Migrations\n');

  // Check if psql is installed
  if (!checkPsqlInstalled()) {
    console.error('❌ Error: psql (PostgreSQL client) is not installed');
    console.error('\nTo install psql:');
    console.error('  macOS: brew install postgresql');
    console.error('  Ubuntu/Debian: sudo apt-get install postgresql-client');
    console.error('  Windows: Install PostgreSQL from https://www.postgresql.org/download/');
    process.exit(1);
  }

  // Get database URL
  const databaseUrl = getDatabaseUrl();
  console.log('✅ Found DATABASE_URL');
  console.log(`   Connection: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`); // Hide password

  // Apply migrations
  let successCount = 0;
  let failCount = 0;

  for (const migration of MIGRATIONS) {
    if (runMigration(migration, databaseUrl)) {
      successCount++;
    } else {
      failCount++;
      console.error(`\n⚠️  Stopping after failure. Fix the error and run again to continue.`);
      break;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Migration Summary:');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log('='.repeat(50));

  if (failCount > 0) {
    console.error('\n❌ Some migrations failed. Please fix the errors and run again.');
    process.exit(1);
  } else {
    console.log('\n✅ All migrations applied successfully!');
    console.log('\nNext steps:');
    console.log('  1. Verify tables in Supabase Dashboard → Table Editor');
    console.log('  2. Restart your application');
    console.log('  3. Test the features that use these tables');
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { runMigration, MIGRATIONS };

