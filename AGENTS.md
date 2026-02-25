# Rift - Agent Instructions

## Cursor Cloud specific instructions

### Overview
Rift is a Next.js 16 escrow/secure transaction platform. See `README.md` for full feature list and test flow.

### Services
| Service | How to run | Notes |
|---------|-----------|-------|
| PostgreSQL | `sudo docker start rift-postgres` | Required. Container already exists from setup. Runs on port 5432. |
| Next.js dev server | `npm run dev` | Runs on port 3000 with `next dev -H 0.0.0.0`. |

### Key commands
- **Lint:** `npm run lint` (pre-existing lint errors in codebase; ~1300 errors, mostly `@typescript-eslint/no-explicit-any`)
- **Unit tests:** `npx vitest run tests/unit` (1 pre-existing failure in `ledger-constraints.test.ts`)
- **All tests:** `npm test` (integration/e2e tests require a running database)
- **Build:** `npm run build`
- **Prisma generate:** `npx prisma generate`
- **Prisma schema sync:** `npx prisma db push` (use `--accept-data-loss` on fresh DB)

### Non-obvious caveats
- **Database env vars:** Prisma uses `PRISMA_DATABASE_URL` (pooled connection) and `DATABASE_URL` (direct). Both must be valid PostgreSQL URLs. If injected secrets point to a remote DB, override them for local dev: `export DATABASE_URL="postgresql://rift:password@localhost:5432/rift" PRISMA_DATABASE_URL="postgresql://rift:password@localhost:5432/rift"`
- **Prisma migrations are broken:** The migration history has issues (`prisma migrate dev` fails with shadow DB errors). Use `npx prisma db push` instead to sync the schema.
- **postinstall script:** `npm install` runs `scripts/fix-prisma-default.js` which patches the Prisma client. Always run `npx prisma generate` after install if the generated client is stale.
- **Docker daemon:** Must be started manually: `sudo dockerd &>/tmp/dockerd.log &` — then wait 2-3 seconds before running docker commands. Docker requires `fuse-overlayfs` storage driver and `iptables-legacy` in this nested container environment.
- **Phone verification bug:** In dev mode, the signup flow displays verification codes on screen, but the phone verification step may reject the displayed codes. The demo account (`demo@trusthold.com` / `demo123`) can be used as a workaround to test authenticated features.
- **Demo account seeding:** Run `npm run seed:demo` to create a demo user (requires DB connection).
