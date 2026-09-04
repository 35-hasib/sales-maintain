# SalesMaintain

A full-stack web app for a marketing officer / broker who sells products between two dealers
(a **Seller Dealer** and a **Buyer Dealer**) and needs to track the money flow between them —
including partial payments and cash the officer temporarily holds.

## Stack

- **Backend**: Node.js + Express, REST API
- **Database**: PostgreSQL, ORM via **Prisma**
- **Frontend**: React + TypeScript + Tailwind CSS
- **Auth**: email/password + JWT (officer role; schema ready for more roles)

## Features

- **Dealer management** — CRUD for dealers; dealer detail page shows their transactions as
  seller and as buyer, plus a running balance summary (owed to them / owed by them).
- **Transactions** — create a deal (seller, buyer, amount, product, date);
  list with filters (dealer, status, date range); detail page with collections, disbursements,
  running totals and the current officer-held balance.
- **Collections** (money received from buyer) — overpayments are **allowed but warned**.
- **Disbursements** (money paid to seller) — hard validation: you cannot pay out more than the
  currently held amount (`collected − already disbursed`) for that transaction.
- **Void / Reversal** — every money record is **immutable**: instead of deleting, you void a
  collection/disbursement, which adds an offsetting reversal entry (full or partial) and marks the
  original as voided. Both a per-row *Void* button and a manual *Adjustment* (partial reversal) are supported.
- **Officer Dashboard** — total cash held (float), total due from buyers, total owed to sellers,
  recent combined activity feed, and the list of open transactions.
- **Ledger / History** — a single chronological feed of every collection, disbursement and
  reversal, filterable by dealer and date range, **exportable to CSV** (filtered view or full ledger).
- **Officer management** — admins create new officers (no public self-registration).

## Money model

- Money is stored as `NUMERIC(14,2)` and shelled between the DB and API as **strings** — never floats.
- A transaction reaches **`settled`** when: `total_collected = total_amount` **and**
  `total_disbursed = total_amount`.
- Derived values (`total_collected`, `total_disbursed`, `officer_held_balance`,
  `amount_due_from_buyer`, `amount_due_to_seller`, `status`) are computed by
  the `transaction_summary` **view** — a single source of truth used by every list/dashboard screen.
- The officer-held balance per transaction = `collected − disbursed`.
  Reversal/voided entries are excluded from the sums via signed offsets.

> **Note (v1):** disbursements are validated **per transaction** — the officer can only pay a
> seller from cash collected on *that* transaction. Cross-transaction float sharing is a
> future enhancement.

## Database schema

The schema/migrations live in `backend/prisma/migrations/`. A summary of the tables:

- `dealers` — sellers and buyers share this table
- `officers` — app users (`role` defaults to `officer`; `admin` can create officers)
- `transactions` — a deal between two dealers (amount, product, date)
- `collections` — money received from the buyer
- `disbursements` — money paid to the seller
- `ledger_entries` — single combined audit / activity feed (collection, disbursement, void)
- `transaction_summary` — a **PostgreSQL VIEW** computing all derived money values per transaction

Money-changing operations (creating a collection/disbursement, voiding) run inside a Prisma
**DB transaction** together with the `ledger_entries` insert and rely on the DB status trigger.

## Prerequisites

- Node.js 18+
- PostgreSQL 13+ (a running server you can connect to)

## Getting started (backend)

```bash
cd backend
cp .env.example .env      # then edit DATABASE_URL, JWT_SECRET
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

`prisma migrate deploy` applies the existing migration and also creates the `transaction_summary`
view and the status-trigger (they live in the migration `20260902000000_init/migration.sql`).

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
npm run install:all   # install backend + frontend deps
# configure backend/.env, then:
npm run setup:db      # run migrations + seed
npm install           # for the root concurrently helper
npm run dev           # starts API (:4000) and web (:5173) together
```

## Deployment overview

| Service | Platform | URL example |
|---------|----------|-------------|
| Database | Neon (free Postgres) | `postgresql://...@ep-xxx.aws.neon.tech/salesmaintain` |
| Backend API | Vercel (serverless function) | `https://salesmaintain.vercel.app/api/...` |
| Frontend (web) | Vercel (static) | `https://salesmaintain.vercel.app` |
| Frontend (mobile) | Google Play (EAS Build) | `com.salesmaintain.mobile` |

```
┌───────────────────────┐      DATABASE_URL     ┌────────────┐
│        Vercel         │ ──────── (external) ──│    Neon    │
│ ┌───────┐  ┌────────┐ │                       │ PostgreSQL │
│ │  Web  │  │  API   │ │                       └────────────┘
│ │ app   │  │(server)│ │
│ └───────┘  └────────┘ │
└───────────────────────┘
```

> **100% free, no payment info anywhere:** Neon gives free Postgres (no card), Vercel hosts both
> the web app and the API serverless function (no card). Only the Google Play account ($25 one-time) costs money.

## Deploying everything to Vercel (backend + frontend, free)

Both the frontend and backend deploy from the **same repo** to the **same Vercel project**,
so the web app and API share one domain (`https://salesmaintain.vercel.app`). No CORS setup needed.

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

4. Click **Deploy**. `vercel.json` handles everything:
   - installs backend deps and runs `prisma generate` (install step)
   - builds the frontend into `frontend/dist` (build step)
   - serves `/api/*` through `api/index.js` (serverless Express) 
   - rewrites other routes to `index.html` (React Router)

### Step 3 — Run database migrations once

Vercel has no "start" step, so migrations run once from your computer:

```bash
cd backend
DATABASE_URL="<your-neon-pooled-url>" npx prisma migrate deploy
DATABASE_URL="<your-neon-pooled-url>" npx prisma db seed
```

> **Why pooled (PGBouncer):** serverless functions open many short-lived connections.
> Use Neon's **pooled** connection string so Prisma doesn't exhaust the DB's connection limit.

After that, open `https://salesmaintain.vercel.app` and log in with the seeded admin account.

### Verifying the API

- `https://salesmaintain.vercel.app/api/health` → `{ "ok": true }`
- Dashboard at `https://salesmaintain.vercel.app/api/dashboard`

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

## Environment variables (`backend/.env`)

- `DATABASE_URL` — Postgres connection string, e.g. `postgresql://user:pass@localhost:5432/salesmaintain?schema=public`
- `JWT_SECRET` — long random string used to sign tokens
- `JWT_EXPIRES_IN` — token lifetime (default `7d`)
- `PORT` — API port (default `4000`)
- `CORS_ORIGIN` — comma-separated allowed origins (default `http://localhost:5173`)

## API overview

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | login, returns JWT + officer |
| GET / POST | `/api/auth/` | list / create officers (admin) |
| GET / POST | `/api/dealers` | list / create dealers |
| GET / PUT / DELETE | `/api/dealers/:id` | dealer detail / update / delete |
| GET / POST | `/api/transactions` | list (filters) / create transaction |
| GET | `/api/transactions/:id` | detail with collections & disbursements + running totals |
| POST | `/api/collections` | record a collection |
| POST | `/api/collections/:id/void` | full or partial reversal of a collection |
| POST | `/api/disbursements` | record a disbursement |
| POST | `/api/disbursements/:id/void` | full or partial reversal of a disbursement |
| GET | `/api/ledger` | combined chronological feed (filter by `dealerId`, `dateFrom`, `dateTo`) |
| GET | `/api/ledger/export` | CSV export (`?all=1` for full ledger, else uses filters) |
| GET | `/api/dashboard` | float, outstanding totals, recent activity, open transactions |

All endpoints (except `/api/auth/login` and `/health`) require an `Authorization: Bearer <token>` header.

## Project layout

```
backend/
  prisma/
    schema.prisma          # Prisma models (matches the SQL schema)
    migrations/            # SQL migrations incl. the view + trigger
    seed.js                # sample data
  src/
    routes/                # auth, dealers, transactions, collections, disbursements, ledger, dashboard
    services/moneyMovement.js  # collections/disbursements/void inside DB transactions
    middleware/auth.js     # JWT + role guards
    money.js               # decimal money helpers
frontend/
  src/
    pages/                 # Dashboard, Dealers, DealerDetail, Transactions, TransactionDetail,
                           # NewTransaction, Ledger, Officers, Login
    components/            # Layout, shared UI
    lib/                   # api client, format helpers (৳ Taka), types
    context/AuthContext.tsx
```

## Deploying the mobile app (Android — Free via Expo)

The `frontend-native-expo/` directory is a React Native Expo app. Build and distribute
using **EAS Build** (Expo Application Services) — **free for Android** (30 builds/month).

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

# 5. Set your backend URL
echo "EXPO_PUBLIC_API_BASE=https://salesmaintain-api.onrender.com" > .env

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
| `EXPO_PUBLIC_API_BASE` | `frontend-native-expo/.env` | Backend URL (e.g. `https://salesmaintain-api.onrender.com`) |

> `EXPO_PUBLIC_*` vars are baked into the JS bundle at build time.
> Set them **before** running `eas build`.

## Currency formatting

Money displays as Taka (৳) with Indian/Bengali digit grouping, e.g. **৳1,25,000.00** (see
`frontend/src/lib/format.ts`). Bengali names render cleanly via the **Noto Sans Bengali** font
loaded in `frontend/index.html`.
