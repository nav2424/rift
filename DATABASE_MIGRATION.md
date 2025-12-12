# Database Migration Guide: SQLite → PostgreSQL

## Why Migrate?

SQLite is not suitable for production deployments, especially on serverless platforms like Vercel, because:
- **Ephemeral file system**: Files can be deleted between deployments
- **No shared storage**: Multiple serverless instances can't access the same file
- **Path resolution issues**: Relative paths may not work correctly in production
- **Concurrency limitations**: SQLite doesn't handle high concurrency well

PostgreSQL is the recommended database for production deployments.

## Quick Setup Options

### Option 1: Vercel Postgres (Recommended for Vercel deployments)

1. **Create a Vercel Postgres database**:
   - Go to your Vercel project dashboard
   - Navigate to **Storage** → **Create Database** → **Postgres**
   - Follow the setup wizard

2. **Get your connection string**:
   - Vercel will automatically add `POSTGRES_PRISMA_URL` and `POSTGRES_URL_NON_POOLING` to your environment variables
   - Use `POSTGRES_PRISMA_URL` for Prisma (includes connection pooling)

3. **Update your environment variables**:
   - In Vercel dashboard: **Settings** → **Environment Variables**
   - Set `DATABASE_URL` to the value of `POSTGRES_PRISMA_URL`
   - Or use `POSTGRES_PRISMA_URL` directly (you'll need to update the schema)

### Option 2: Supabase (Free tier available)

1. **Create a Supabase project**:
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Wait for the database to be provisioned

2. **Get your connection string**:
   - Go to **Settings** → **Database**
   - Copy the **Connection string** (URI format)
   - Format: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

3. **Update your environment variables**:
   - Add `DATABASE_URL` with the connection string
   - For connection pooling, use the **Connection Pooling** string instead

### Option 3: Railway

1. **Create a Railway project**:
   - Go to [railway.app](https://railway.app)
   - Create a new project → **New** → **Database** → **PostgreSQL**

2. **Get your connection string**:
   - Click on the PostgreSQL service
   - Go to **Variables** tab
   - Copy the `DATABASE_URL` value

3. **Update your environment variables**:
   - Add `DATABASE_URL` to your Vercel project (or wherever you're deploying)

### Option 4: Neon (Serverless Postgres)

1. **Create a Neon project**:
   - Go to [neon.tech](https://neon.tech)
   - Create a new project

2. **Get your connection string**:
   - Copy the connection string from the dashboard
   - Use the pooled connection string for better performance

3. **Update your environment variables**:
   - Add `DATABASE_URL` with the connection string

## Migration Steps

### 1. Update Environment Variables

**For Vercel:**
- Go to your project → **Settings** → **Environment Variables**
- Add or update `DATABASE_URL` with your PostgreSQL connection string
- Make sure to set it for **Production**, **Preview**, and **Development** environments

**For local development:**
- Update your `.env.local` file:
  ```env
  DATABASE_URL="postgresql://user:password@localhost:5432/rift?schema=public"
  ```

### 2. Install PostgreSQL (for local development)

If you want to run PostgreSQL locally:

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
createdb rift
```

**Docker (recommended):**
```bash
docker run --name rift-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=rift -p 5432:5432 -d postgres:15
```

### 3. Run Database Migrations

**Important**: Before running migrations, make sure you have:
- Updated `prisma/schema.prisma` to use `provider = "postgresql"` ✅ (already done)
- Set the correct `DATABASE_URL` environment variable

**Generate a new migration:**
```bash
npx prisma migrate dev --name migrate_to_postgresql
```

This will:
- Create a new migration file
- Apply it to your database
- Generate the Prisma Client

**For production:**
```bash
npx prisma migrate deploy
```

Or if using Vercel, migrations run automatically during build if you have `prisma generate` in your build script (which you do).

### 4. Verify the Migration

1. **Check your database**:
   ```bash
   npx prisma studio
   ```
   This opens Prisma Studio where you can view your data

2. **Test a query**:
   ```bash
   npx prisma db execute --stdin
   ```
   Then type: `SELECT COUNT(*) FROM "User";`

### 5. Deploy to Production

1. **Push your changes**:
   ```bash
   git add .
   git commit -m "Migrate from SQLite to PostgreSQL"
   git push
   ```

2. **Vercel will automatically**:
   - Run `prisma generate` during build
   - Use your `DATABASE_URL` environment variable
   - Connect to your PostgreSQL database

3. **Run migrations in production**:
   - If migrations don't run automatically, you can run them manually:
     ```bash
     npx prisma migrate deploy
     ```
   - Or use Vercel's CLI:
     ```bash
     vercel env pull .env.production
     npx prisma migrate deploy
     ```

## Troubleshooting

### Error: "Unable to open the database file"
- ✅ **Fixed**: This was caused by using SQLite in production
- Make sure `DATABASE_URL` is set correctly in your production environment

### Error: "Connection refused" or "Can't reach database server"
- Check that your PostgreSQL database is running
- Verify the connection string is correct
- Check firewall/network settings if using a managed service

### Error: "Relation does not exist"
- Run migrations: `npx prisma migrate deploy`
- Make sure migrations have been applied to your production database

### Error: "Password authentication failed"
- Verify your database password in the connection string
- Check if your database user has the correct permissions

### Migration fails in production
- Make sure `DATABASE_URL` is set in your production environment
- Check that your database allows connections from your deployment platform
- For Vercel, ensure the database is in the same region or allows external connections

## Connection String Format

PostgreSQL connection strings follow this format:
```
postgresql://[user]:[password]@[host]:[port]/[database]?[parameters]
```

Example:
```
postgresql://postgres:mypassword@db.abc123.supabase.co:5432/postgres?schema=public
```

For connection pooling (recommended for serverless):
```
postgresql://postgres:mypassword@db.abc123.supabase.co:6543/postgres?pgbouncer=true&schema=public
```

## Next Steps

1. ✅ Schema updated to PostgreSQL
2. ✅ Prisma client improved with better error handling
3. ⏳ Set up PostgreSQL database (choose one of the options above)
4. ⏳ Update `DATABASE_URL` environment variable
5. ⏳ Run migrations
6. ⏳ Deploy and test

## Rollback Plan

If you need to rollback to SQLite temporarily:
1. Change `provider = "sqlite"` in `prisma/schema.prisma`
2. Set `DATABASE_URL="file:./dev.db"` in your `.env.local`
3. Run `npx prisma migrate dev`
4. **Note**: This is only for local development. SQLite should never be used in production.

## Support

If you encounter issues:
1. Check Prisma logs: `npx prisma migrate dev --verbose`
2. Check database connection: `npx prisma db pull` (tests connection)
3. Review Prisma documentation: [prisma.io/docs](https://www.prisma.io/docs)

