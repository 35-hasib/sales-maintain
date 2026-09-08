# SalesMaintain

A full-stack **web + Android** app for a marketing officer / broker who sells products between two
dealers (a **Seller Dealer** and a **Buyer Dealer**) and needs to track the money flow between them —
including partial payments and cash the officer temporarily holds in hand.

The UI is fully localized in **Bengali (Bangla)** and formats money in **Taka (৳)** with Bengali
digits. Each officer only sees **their own book** — data is scoped per officer throughout the app.

```
SalesMaintain
├── api/                      # Vercel serverless entry (imports the backend Express app)
├── backend/                  # Node.js + Express + Prisma REST API (PostgreSQL)
├── frontend/                 # React + TypeScript + Vite + Tailwind web app
├── frontend-native-expo/     # React Native (Expo) Android app
├── link-view-app/            # unused Expo boilerplate (not part of the product)
├── scripts/                  # local PostgreSQL cluster helper (scripts/localpg.sh)
├── sql/                      # plain-SQL schema (alternative to Prisma migrations)
└── .github/workflows/        # CI (db-backup.yml)
```

## Features

- **Dealer management** — CRUD; dealer detail page shows their transactions as **seller** and as
  **buyer** with a running balance summary (owed to them / owed by them / net). Search (debounced)
  and pagination.
- **Transactions** — create a deal (seller, buyer, amount, product, date, optional photos); list
  with filters (dealer, status, date range); detail page with collections and disbursements shown
  chronologically with running totals and the current officer-held balance. Metadata is editable.
- **Collections** (মালামাল বাবদ আদায় — money received from the buyer) — payment method
  (cash/bank/mobile banking/other), note, date and photos. **Over-collection is allowed but warned.**
- **Disbursements** (পরিশোধ — money paid to the seller) — same shape as collections. Hard
  validation: you cannot disburse more than the currently held amount
  (`total_collected − total_disbursed`) for that transaction.
- **Editing** — transactions, collections and disbursements can be corrected/edited via `PUT`; there
  is no delete/void — the audit trail is preserved and edits are the correction mechanism.
- **Ledger / History** — a single chronological feed of every collection & disbursement, filterable
  by dealer and date range, **exportable to CSV** (filtered view or full ledger via `?all=1`).
- **Officer Dashboard** — 3 KPI cards (cash in hand, due from buyers, due to sellers) with
  click-through **per-dealer breakdown modals**, the list of unsettled transactions, and the recent
  activity feed.
- **Photo attachments** — Cloudinary-hosted photos on transactions, collections and disbursements
  with a thumbnail gallery and zoomable lightbox, both on web and mobile.
- **Officer management** — admins create/edit/delete officers (no public self-registration).
- **Role isolation** — each officer only sees their own dealers/transactions/money (`officer_id` /
  `owner_officer_id` scoping on every route). Admins manage officers only — they are **blocked from
  business routes**.

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Node.js 18+, Express 4, ESM |
| Database | PostgreSQL 13+, ORM via **Prisma 5** |
| Auth | email/password, **JWT** (`jsonwebtoken`), `bcryptjs`, **zod** validation |
| Money handling | `decimal.js-light` — money as `NUMERIC(14,2)` strings, never floats |
| Web frontend | React 18, React Router 6, TypeScript 5, **Vite** 5, Tailwind CSS 3 |
| Mobile | React Native 0.74, **Expo 51**, React Navigation 6, AsyncStorage, expo-image-picker |
| Image hosting | Cloudinary (client-side signed direct upload; secret stays server-side) |
| Deploy | Vercel (web + serverless API), EAS Build (Android), Neon (Postgres) |
| CI/CD | GitHub Actions (weekly DB backup) |

## Money model

- Money is stored as `NUMERIC(14,2)` and passed between DB and API as **strings** — never floats.
- A transaction reaches **`settled`** when: `total_collected = total_amount` **and**
  `total_disbursed = total_amount`.
- Derived values (`total_collected`, `total_disbursed`, `officer_held_balance`,
  `amount_due_from_buyer`, `amount_due_to_seller`, `status`, plus joined dealer names) are computed
  by the `transaction_summary` **PostgreSQL VIEW** — a single source of truth used by every
  list/dashboard screen.
- The officer-held balance per transaction = `collected − disbursed`.
- A database **trigger** keeps `transactions.status` in sync automatically after every
  collection/disbursement insert or update, and refreshes `updated_at`.

> **Note (v1):** disbursements are validated **per transaction** — the officer can only pay a
> seller from cash collected on *that* transaction. Cross-transaction float sharing is a
> future enhancement.

## Database schema

Schema and migrations live in `backend/prisma/migrations/`. A summary of the tables:

- `officers` — app users (`role` defaults to `officer`; `admin` can create officers)
- `dealers` — sellers and buyers share this table; `owner_officer_id` scopes each officer's book
- `transactions` — a deal between two dealers (`seller_dealer_id`, `buyer_dealer_id`,
  `officer_id`, `total_amount`, `product_description`, `transaction_date`, `status`, `photos TEXT[]`)
- `collections` — money received from the buyer (`amount`, `collected_at`, `payment_method`,
  `note`, `photos`, `recorded_by`)
- `disbursements` — money paid to the seller (same shape as collections)
- `ledger_entries` — single combined audit / activity feed for every collection and disbursement
  (`entry_type`, `reference_id`, `dealer_id`, `amount`, `occurred_at`, `recorded_by`)
- `transaction_summary` — a **PostgreSQL VIEW** computing all derived money values per transaction

Money-changing operations (recording/editing a collection or disbursement) run inside a Prisma
**DB transaction** together with the `ledger_entries` insert, and rely on the DB status trigger.
Indexes cover `transactions.seller/buyer/officer_id`, `collections/disbursements.transaction_id`,
`ledger_entries (transaction_id, dealer_id, occurred_at)` and `dealers.owner_officer_id`.

## Authentication & roles

- Login (`POST /api/auth/login`) returns a **JWT** (payload `{ id, email, role, name }`, default
  expiry `7d` via `JWT_EXPIRES_IN`).
- Middleware: `authRequired` (verifies `Authorization: Bearer <token>`), `requireRole(...)`
  (used for admin-only officer management), and `officerOnly` (blocks admins from business routes).
- Web stores the token in `localStorage`; the mobile app stores it in **AsyncStorage**
  (`salesmaintain_token`).
- No public registration — only admins create officers.

## Prerequisites

- Node.js 18+
- PostgreSQL 13+ (a running server you can connect to)

For local development without system Postgres, `scripts/localpg.sh` manages a private cluster in
`.localpg/` (`start | stop | status`).

## Getting started (backend)

```bash
cd backend
cp .env.example .env      # then edit DATABASE_URL, JWT_SECRET (+ Cloudinary vars, optional)
npm install
npx prisma migrate deploy # applies schema + the transaction_summary view/trigger
npm run seed              # sample officers, dealers and transactions
npm run dev               # starts API on http://localhost:4000
```

Seed logins (printed by the seed script):

| Email | Password | Role |
|-------|----------|------|
| admin@salesmaintain.test | admin123 | admin |
| officer@salesmaintain.test | officer123 | officer |

`prisma migrate deploy` applies the existing migrations and also creates the `transaction_summary`
view and the status trigger (they live in `20260902000000_init/migration.sql`).

## Getting started (frontend)

```bash
cd frontend
npm install
npm run dev   # starts Vite on http://localhost:5173 (proxies /api -> localhost:4000)
```

Open http://localhost:5173 and sign in with one of the seeded accounts.

## Quick start (both servers, optional)

From the **project root** you can install everything and run both dev servers with one command:

```bash
npm run install:all   # installs backend + frontend deps
# configure backend/.env, then:
npm run setup:db      # run migrations + seed
npm install           # installs the root concurrently helper
npm run dev           # starts API (:4000) and web (:5173) together
```

## Scripts

**Root** (`package.json`)

| Script | Command |
|---|---|
| `install:all` | installs backend + frontend deps |
| `setup:db` | `migrate:deploy` + `seed` |
| `dev:backend` | runs the backend dev server |
| `dev:frontend` | runs the frontend dev server |
| `dev` | runs both concurrently (labels `api`, `web`) |

**Backend** (`backend/package.json`)

| Script | Command |
|---|---|
| `dev` | `node --watch src/server.js` |
| `build` | `npx prisma generate` |
| `start` | `prisma migrate deploy` + `node src/server.js` |
| `migrate` | `prisma migrate dev` |
| `migrate:deploy` | `prisma migrate deploy` |
| `seed` | `node prisma/seed.js` (`--force` to reseed) |
| `db:push` | `prisma db push` |

**Frontend** (`frontend/package.json`): `dev`, `build` (`tsc -b && vite build`), `preview`.
**Mobile** (`frontend-native-expo/package.json`): `start`, `android` (`expo run:android`), `ios`, `web`.

## Environment variables

### Backend (`backend/.env`, see `.env.example`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (local: `localhost:5543`; Neon **pooled** in prod) |
| `JWT_SECRET` | Long random string used to sign tokens |
| `JWT_EXPIRES_IN` | Token lifetime (default `7d`) |
| `PORT` | API port (default `4000`) |
| `CORS_ORIGIN` | Comma-separated allowed origins (default `http://localhost:5173`) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary signing secret (**keep server-side only**) |

### Web frontend

- `VITE_API_BASE` — optional; when empty, requests go to same-origin `/api` (local dev uses the
  Vite proxy to `:4000`). **Do not set it in production.**

### Mobile (`frontend-native-expo/.env`)

- `EXPO_PUBLIC_API_BASE` — baked into the JS bundle at build time
  (e.g. `https://sales-maintain-iis1.vercel.app`). Set it **before** running `eas build`.

## API overview

All business routes use `officerOnly` (bearer token required); officer management uses
`requireRole("admin")`.

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/health` | DB connectivity check (used by the Vercel warm-up cron) | none |
| POST | `/api/auth/login` | Login → JWT + officer | none |
| GET | `/api/auth/me` | Current officer | bearer |
| GET / POST | `/api/auth/` | List (paginated) / create officers | admin |
| PUT / DELETE | `/api/auth/:id` | Update / delete officer | admin |
| GET / POST | `/api/dealers` | List (search, paginated) / create dealer | officer |
| GET / PUT / DELETE | `/api/dealers/:id` | Dealer detail (as-seller + as-buyer + balance summary) / update / delete | officer |
| GET / POST | `/api/transactions` | List (filters: `dealerId`, `status`, `dateFrom`, `dateTo`, pagination) / create | officer |
| GET / PUT | `/api/transactions/:id` | Detail (collections + disbursements with running totals) / edit metadata | officer |
| POST | `/api/collections` | Record a collection (returns warning on overpay) | officer |
| PUT | `/api/collections/:id` | Edit a collection entry | officer |
| POST | `/api/disbursements` | Record a disbursement (validated ≤ held balance) | officer |
| PUT | `/api/disbursements/:id` | Edit a disbursement entry | officer |
| GET | `/api/ledger` | Combined feed (filters: `dealerId`, `dateFrom`, `dateTo`, `transactionId`) | bearer |
| GET | `/api/ledger/export` | CSV export (`?all=1` = full ledger, else uses filters) | bearer |
| GET | `/api/dashboard` | Float held, due from buyers, due to sellers, recent activity, unsettled transactions | officer |
| GET | `/api/dashboard/breakdown` | Per-dealer breakdown (`?type=held\|buyers\|sellers`) | officer |
| POST | `/api/upload/signature` | Cloudinary signed upload payload (secret stays server-side) | officer |

All endpoints except `/health` and `/api/auth/login` require an `Authorization: Bearer <token>` header.

## Deployment overview

| Service | Platform | URL example |
|---|---|---|
| Database | Neon (free Postgres) | `postgresql://...@ep-xxx.aws.neon.tech/salesmaintain` |
| Backend API | Vercel (serverless function) | `https://sales-maintain-iis1.vercel.app/api/...` |
| Frontend (web) | Vercel (static) | `https://sales-maintain-iis1.vercel.app` |
| Frontend (mobile) | Google Play (EAS Build) | `com.salesmaintain.mobile` |

```
┌────────────────────────┐      DATABASE_URL      ┌────────────┐
│        Vercel          │ ───────── (external) ──│    Neon    │
│ ┌────────┐  ┌────────┐ │                        │ PostgreSQL │
│ │  Web   │  │  API   │ │                        └────────────┘
│ │  app   │  │(server)│ │
│ └────────┘  └────────┘ │
└────────────────────────┘
```

> **100% free, no payment info anywhere:** Neon gives free Postgres (no card), Vercel hosts both
> the web app and the API serverless function (no card). Only the Google Play account ($25 one-time) costs money.

## Deploying everything to Vercel (backend + frontend, free)

Both the frontend and backend deploy from the **same repo** to the **same Vercel project**, so the
web app and API share one domain. `vercel.json`:
- `installCommand` — installs root + backend deps, runs `prisma generate` and `prisma migrate deploy`
- `buildCommand` — builds the frontend into `frontend/dist`
- region `sin1` (Singapore); `/api/(.*)` served through the `api/index.js` serverless Express
  function (`maxDuration: 10`); other routes rewritten to `index.html` (React Router SPA behavior)
- a **cron** hits `/api/health` every 5 minutes to keep the function/DB connection warm

### Step 1 — Create a free PostgreSQL on Neon

1. Go to [neon.tech](https://neon.tech) → **Sign up** → **Create project** (no card needed).
2. Choose region **Singapore** (closest to Bangladesh) → make sure **Postgres 16** is selected.
3. Copy the **pooled connection string** (like `postgresql://...-pooler.aws.neon.tech/salesmaintain`) — save it for later.

### Step 2 — Deploy on Vercel

1. **Push the repo to GitHub** (make sure `api/index.js` and `vercel.json` are at the repo root).

2. On [vercel.com](https://vercel.com), click **Add New** → **Project** and import the repo.

3. In **Settings → Environment Variables**, add (all applied to **Production**):

   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | Your **Neon** pooled connection string |
   | `JWT_SECRET` | A long random string |
   | `JWT_EXPIRES_IN` | `7d` (default) |
   | `CORS_ORIGIN` | Leave empty (same-origin in production) |
   | `CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name |
   | `CLOUDINARY_API_KEY` | Your Cloudinary API key |
   | `CLOUDINARY_API_SECRET` | Your Cloudinary API secret |

   > Do **not** set `VITE_API_BASE` — the frontend calls `/api` on the same domain.

4. Click **Deploy** — `vercel.json` installs backend deps, runs Prisma migrations/generate, builds
   the frontend into `frontend/dist`, serves `/api/*` through the serverless Express function, and
   rewrites all other routes to `index.html`.

### Verifying the API

- `https://sales-maintain-iis1.vercel.app/api/health` → `{ "ok": true }`
- Dashboard at `https://sales-maintain-iis1.vercel.app/api/dashboard`

### How it works

- `api/index.js` imports `createApp()` from the backend and exposes it as a Vercel serverless function.
- The frontend's `VITE_API_BASE` stays **empty** → requests go to `/api/*` on the same domain.
- Locally, Vite's dev proxy routes `/api` to `localhost:4000`, so development is unchanged.
- Pushing to GitHub auto-redeploys both the web app and the API.

## Applying the schema with plain psql (no Prisma)

If you prefer not to use Prisma Migrate, the full schema (tables + `transaction_summary` view +
status trigger) is also provided as a single file in `sql/schema.sql`:

```bash
psql "$DATABASE_URL" -f sql/schema.sql
```

## Project layout

```
api/
  index.js                    # Vercel serverless entry (imports createApp)
backend/
  prisma/
    schema.prisma             # Prisma models (matches the SQL schema)
    migrations/               # SQL migrations incl. the view + trigger
    seed.js                   # sample data
  src/
    app.js                    # Express app factory (routes, CORS, error handling)
    middleware/auth.js        # JWT sign/verify, role guards (officerOnly, requireRole)
    routes/                   # auth, dealers, transactions, collections, disbursements,
                              #   ledger, dashboard, upload
    services/                 # moneyMovement (DB txns), responseCache (TTL), cloudinary
    money.js                  # decimal money helpers (string-safe)
    serializers.js            # Decimal -> "0.00" serialization
frontend/
  src/
    pages/                    # Login, Dashboard, Dealers, DealerDetail, Transactions,
                              #   TransactionDetail, NewTransaction, Ledger, Officers
    components/               # Layout, shared UI, PhotoUpload/Gallery/Lightbox
    lib/                      # api client, format helpers (৳ Taka), types, cloudinary
    context/AuthContext.tsx
frontend-native-expo/         # React Native (Expo) Android app — mirrors the web app
  src/
    screens/                  # Login, Dashboard, Transactions, TransactionDetail,
                              #   NewTransaction, Dealers, DealerDetail, Ledger, Officers
    components/               # Themed UI, PhotoPicker/Gallery/Lightbox
    lib/                      # api, cache (AsyncStorage), types, format, cloudinary
scripts/
  localpg.sh                  # private PostgreSQL cluster helper (.localpg/)
sql/
  schema.sql                  # plain-SQL schema (alternative to Prisma migrations)
.github/workflows/db-backup.yml  # weekly PostgreSQL dump + commit
```

## CI/CD — database backups

`.github/workflows/db-backup.yml` runs **weekly** (Sunday 06:00 UTC, also manually via
`workflow_dispatch`): it installs `postgresql-client-18`, runs `pg_dump --no-owner` against the
`DATABASE_URL` GitHub secret, and commits `backups/salesmaintain-<date>.sql` to the repo.

## Deploying the mobile app (Android — Free via Expo)

The `frontend-native-expo/` directory is a React Native **Expo** app that mirrors the web app
(mobile-optimized screens, AsyncStorage caching, connection-error retry). Build and distribute using
**EAS Build** (Expo Application Services) — **free for Android** (30 builds/month).

`eas.json` defines three profiles (each already sets `EXPO_PUBLIC_API_BASE` to
`https://sales-maintain-iis1.vercel.app`):
- `development` — dev client (internal)
- `preview` — **APK** for direct install (internal)
- `production` — **AAB** for Google Play (submitted via a Google service account, `internal` track)

### Cost

| Item | Cost |
|------|------|
| Expo account | Free |
| EAS Build (Android) | Free (30 builds/month) |
| EAS Submit | Free |
| Google Play Store | $25 one-time (only if publishing to Play Store) |
| Direct APK install | **$0** — no store needed |

### Quick start (direct APK — $0)

```bash
# 1. Install EAS CLI
npm install -g eas-cli

# 2. Create account at expo.dev/signup, then login
eas login

# 3. Go to project and initialize
cd frontend-native-expo
eas init

# 5. Point the app at your backend (already done in .env)
echo "EXPO_PUBLIC_API_BASE=https://sales-maintain-iis1.vercel.app" > .env

# 6. Build APK (free, ~10-15 min in cloud)
eas build --platform android --profile preview
```

When it's done you get a **download URL**. Open it on your Android phone → download → install.

> Users need to enable "Install from unknown sources" on their Android settings.

### Publishing to Google Play Store ($25 one-time)

1. Create a [Google Play Developer account](https://play.google.com/console) ($25 one-time fee).
2. Build AAB for the store:
   ```bash
   eas build --platform android --profile production
   ```
3. Submit to Play Store:
   ```bash
   eas submit --platform android --profile production
   ```
   Or manually upload the `.aab` file in [Play Console](https://play.google.com/console)
   → your app → Production → Create new release.

### Updating the app

**New build** (native changes):
```bash
eas build --platform android --profile production
eas submit --platform android --profile production
```

**OTA update** (JS-only changes, no rebuild needed):
```bash
eas update --branch production --message "Bug fix"
```

### Environment variables

| Variable | Where | Value |
|----------|-------|-------|
| `EXPO_PUBLIC_API_BASE` | `frontend-native-expo/.env` (also per-profile in `eas.json`) | Backend URL (e.g. `https://sales-maintain-iis1.vercel.app`) |

> `EXPO_PUBLIC_*` vars are baked into the JS bundle at build time.
> Set them **before** running `eas build`.

## Currency formatting

Money displays as Taka (৳) with Indian/Bengali digit grouping, e.g. **৳1,25,000.00** with Bengali
digits (see `frontend/src/lib/format.ts` and `frontend-native-expo/src/lib/format.ts`). Bengali
names render cleanly via the **Noto Sans Bengali** font loaded in `frontend/index.html`.

## Notes & caveats

- **No reverse/void feature.** Earlier versions had a commission feature and a void/reversal flow;
  both were removed in migrations `20260902020000_remove_commission` and
  `20260902040000_remove_void`. Corrections are done by **editing** collections/disbursements.
- **No automated tests** are configured in this repo.
- Keep `CLOUDINARY_API_SECRET` and `JWT_SECRET` out of the repo — set them via environment
  variables / Vercel secrets / GitHub secrets.
- `link-view-app/` is an unused `create-expo-app` boilerplate and not part of the product.