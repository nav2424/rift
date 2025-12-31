# 🔴 Get Correct Database Password

## Error
Authentication failed - the password `i1eTjEwbrXB3rvsL` is incorrect.

## Fix: Get Your Database Password from Supabase

1. **Go to Supabase Dashboard**
   - https://supabase.com/dashboard/project/zosvdbzroydrwwlwlzvi/settings/database

2. **Find Database Password**
   - Scroll to "Database password" section
   - Click **"Reveal"** or **"Show"** button
   - Copy the password (it will be different from `i1eTjEwbrXB3rvsL`)

3. **Get Connection String**
   - Scroll to "Connection string" section
   - Click **"URI"** tab
   - Copy the ENTIRE connection string (it includes the correct password)
   - It should look like:
     ```
     postgresql://postgres.zosvdbzroydrwwlwlzvi:CORRECT_PASSWORD@aws-1-ca-central-1.pooler.supabase.com:6543/postgres
     ```

4. **Update .env file**
   - Open `.env`
   - Replace the `DATABASE_URL=` line with the connection string you copied
   - Save the file

5. **Test connection**
   ```bash
   npx prisma db pull
   ```
   This should work without authentication errors.

6. **Restart dev server**
   ```bash
   rm -rf .next
   npm run dev
   ```

## Why This Happened
The password `i1eTjEwbrXB3rvsL` was either:
- An old password that was reset
- A password from a different Supabase project
- Not the actual database password

The connection string from Supabase dashboard will have the CORRECT password.
