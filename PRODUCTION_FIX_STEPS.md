# Step-by-Step: Fix Production Database Error

## The Problem
Your production app is trying to use SQLite, which doesn't work on Vercel's serverless platform. You're getting "Unable to open the database file" errors.

## The Solution
Switch to PostgreSQL. Since you're on Vercel, we'll use **Vercel Postgres** (easiest option).

---

## STEP-BY-STEP INSTRUCTIONS

### STEP 1: Create Vercel Postgres Database

1. **Go to Vercel Dashboard**
   - Open https://vercel.com/dashboard
   - Log in if needed

2. **Navigate to Your Project**
   - Click on your project (the one with `www.joinrift.co`)

3. **Go to Storage Tab**
   - In your project dashboard, click the **"Storage"** tab (or **"Data"** tab)
   - If you don't see it, look for **"Storage"** in the left sidebar

4. **Create Postgres Database**
   - Click **"Create Database"** button
   - Select **"Postgres"** from the options
   - Choose a name (e.g., "rift-db" or "rift-postgres")
   - Select a region (choose closest to your users, or default is fine)
   - Click **"Create"**

5. **Wait for Setup**
   - Vercel will provision your database (takes 1-2 minutes)
   - You'll see a success message when it's ready

---

### STEP 2: Get Your Database Connection String

1. **After Database is Created**
   - You'll see your database in the Storage list
   - Click on it to open the database details

2. **Find Environment Variables**
   - Vercel automatically creates these environment variables:
     - `POSTGRES_URL` - Direct connection (for migrations)
     - `POSTGRES_PRISMA_URL` - Connection with pooling (for Prisma)
     - `POSTGRES_URL_NON_POOLING` - Non-pooled connection

3. **Copy the Prisma URL**
   - Look for `POSTGRES_PRISMA_URL`
   - Click the **eye icon** or **"Show"** to reveal it
   - **Copy the entire connection string** (it looks like: `postgres://...`)

---

### STEP 3: Set DATABASE_URL in Vercel

1. **Go to Project Settings**
   - In your Vercel project, click **"Settings"** (top navigation)
   - Click **"Environment Variables"** in the left sidebar

2. **Add DATABASE_URL**
   - Click **"Add New"** button
   - **Key**: `DATABASE_URL`
   - **Value**: Paste the `POSTGRES_PRISMA_URL` you copied in Step 2
   - **Environment**: Select **"Production"** (and optionally "Preview" and "Development")
   - Click **"Save"**

3. **Verify It's Added**
   - You should see `DATABASE_URL` in your environment variables list
   - Make sure it's set for **Production** environment

---

### STEP 4: Run Database Migrations

You need to create the database tables. You have two options:

#### Option A: Using Vercel CLI (Recommended)

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Link Your Project** (if not already linked):
   ```bash
   cd /Users/arnavsaluja/Rift
   vercel link
   ```
   - Select your project when prompted
   - Use default settings

4. **Pull Environment Variables**:
   ```bash
   vercel env pull .env.production
   ```
   This downloads your production environment variables locally

5. **Run Migrations**:
   ```bash
   npx prisma migrate deploy
   ```
   This will create all your database tables

#### Option B: Using Prisma Studio (Alternative)

1. **Pull Environment Variables** (same as above):
   ```bash
   vercel env pull .env.production
   ```

2. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```

3. **Create Migration**:
   ```bash
   npx prisma migrate dev --name init_postgres
   ```

4. **Deploy Migration**:
   ```bash
   npx prisma migrate deploy
   ```

---

### STEP 5: Verify Everything Works

1. **Check Database Tables**:
   ```bash
   npx prisma studio
   ```
   - This opens a browser window
   - You should see your tables: User, EscrowTransaction, etc.
   - If tables are empty, that's fine - they're just created

2. **Test Your Production Site**:
   - Go to https://www.joinrift.co/api/auth/custom-signup
   - Try creating a test account
   - The error should be gone!

---

### STEP 6: Deploy Your Code Changes

The schema has already been updated to use PostgreSQL. You need to commit and push:

1. **Check What Changed**:
   ```bash
   cd /Users/arnavsaluja/Rift
   git status
   ```

2. **Stage Changes**:
   ```bash
   git add prisma/schema.prisma lib/prisma.ts README.md DATABASE_MIGRATION.md
   ```

3. **Commit**:
   ```bash
   git commit -m "Migrate from SQLite to PostgreSQL for production"
   ```

4. **Push**:
   ```bash
   git push
   ```

5. **Vercel Will Auto-Deploy**:
   - Vercel will detect the push
   - It will run `prisma generate` during build (already in your package.json)
   - Your site will redeploy with PostgreSQL support

---

## TROUBLESHOOTING

### "Connection refused" or "Can't reach database"
- Make sure `DATABASE_URL` is set correctly in Vercel
- Verify you used `POSTGRES_PRISMA_URL` (not `POSTGRES_URL`)
- Check that the database is in the same Vercel project

### "Relation does not exist" error
- You need to run migrations: `npx prisma migrate deploy`
- Make sure you pulled environment variables first: `vercel env pull .env.production`

### Migrations fail
- Check that `DATABASE_URL` is correct
- Try using `POSTGRES_URL_NON_POOLING` instead (for migrations only)
- Then switch back to `POSTGRES_PRISMA_URL` for the app

### Still getting SQLite errors
- Make sure you committed and pushed the schema changes
- Check that Vercel redeployed after your push
- Clear Vercel's build cache if needed (Settings → General → Clear Build Cache)

---

## QUICK CHECKLIST

- [ ] Created Vercel Postgres database
- [ ] Copied `POSTGRES_PRISMA_URL` connection string
- [ ] Added `DATABASE_URL` environment variable in Vercel (Production)
- [ ] Pulled environment variables locally: `vercel env pull .env.production`
- [ ] Ran migrations: `npx prisma migrate deploy`
- [ ] Committed and pushed code changes
- [ ] Verified Vercel redeployed successfully
- [ ] Tested signup on production site

---

## WHAT HAPPENS NEXT

Once you complete these steps:
1. ✅ Your production database will be PostgreSQL (not SQLite)
2. ✅ The "Unable to open database file" error will be fixed
3. ✅ Your app will work correctly on Vercel
4. ✅ Multiple serverless instances can share the same database
5. ✅ Your data will persist between deployments

---

## NEED HELP?

If you get stuck:
1. Check the error message in Vercel's deployment logs
2. Verify your `DATABASE_URL` format (should start with `postgres://`)
3. Make sure migrations ran successfully
4. Check Vercel's database dashboard to see if tables were created

