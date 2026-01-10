#!/bin/bash
# Script to apply the archive fields migration to production database

echo "🔧 Applying Archive Fields Migration"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL environment variable not set"
    echo ""
    echo "To set it, either:"
    echo "1. Pull from Vercel: vercel env pull .env.production"
    echo "   Then: source .env.production"
    echo ""
    echo "2. Or set manually:"
    echo "   export DATABASE_URL='postgresql://postgres:PASSWORD@db.zosvdbzroydrwwlwlzvi.supabase.co:5432/postgres'"
    exit 1
fi

echo "✅ DATABASE_URL is set"
echo "📦 Running Prisma migrate deploy..."
echo ""

npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration applied successfully!"
    echo ""
    echo "To verify, run:"
    echo "  npx prisma studio"
    echo "Or check in Supabase SQL Editor:"
    echo "  SELECT column_name FROM information_schema.columns WHERE table_name = 'EscrowTransaction' AND column_name LIKE '%Archived%';"
else
    echo ""
    echo "❌ Migration failed. Check the error above."
    exit 1
fi
