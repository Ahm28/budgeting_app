# Budgeting App

A personal budgeting web app. This project starts as a Next.js monolith with a versioned HTTP API boundary, PostgreSQL, and Prisma.

## Stack

- Next.js App Router and TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma ORM

## Local setup

Requirements: Node.js 22.12 or later and a PostgreSQL database.

1. Install dependencies with `npm install`.
2. Set `DATABASE_URL`, `APP_ACCESS_KEY`, and `AUTH_SECRET` in `.env`. Use a long random value for `APP_ACCESS_KEY` and a different random value of at least 32 bytes for `AUTH_SECRET`.
3. Generate Prisma Client with `npm run db:generate`.
4. Start the development server with `npm run dev`.

## Database migrations

`prisma/schema.prisma` is the source of truth for the database structure. Make schema changes there, then create a reviewable migration without applying it:

```sh
npm run db:migration:create -- --name add_accounts
```

Review the generated SQL under `prisma/migrations/` before applying it. To apply pending migrations to the local development database, run `npm run db:migrate:dev` manually. To apply committed migrations in a deployment environment, run `npm run db:migrate:deploy`. Check migration history with `npm run db:migrate:status`.

Do not edit migrations that have already been applied. Make a new schema change and create a new migration instead. `npm run db:generate` refreshes Prisma Client after schema changes; `npm run db:studio` opens Prisma Studio.

The initial migration for the current master data is in `prisma/migrations/20261010000000_master_data_init/`. It creates the account and category tables. It assumes the target schema is empty; if your local database already contains application tables, do not apply this baseline as-is. No migration has been applied to your local database.

The cash flow table is added by `prisma/migrations/20261011000000_cash_flow/`. Review this SQL and apply pending migrations manually before using transaction endpoints.

Account-to-account transfers are added by `prisma/migrations/20261011010000_account_transfers/`. Review and apply this migration after the cash flow migration.

Budget periods and category allocations are added by `prisma/migrations/20261012000000_budgets/`. It also adds the optional budget source category to transactions; existing expenses without one are treated as using their recorded category.

## API boundary

Versioned API routes live under `src/app/api/v1`. The starter health endpoint is `GET /api/v1/health`.

Master data endpoints:

- `GET` / `POST` `/api/v1/categories`
- `PATCH` / `DELETE` `/api/v1/categories/:id`
- `GET` / `POST` `/api/v1/accounts`
- `PATCH` / `DELETE` `/api/v1/accounts/:id`
- `GET` / `POST` `/api/v1/transactions`
- `PATCH` / `DELETE` `/api/v1/transactions/:id`
- `GET` / `POST` `/api/v1/transfers`
- `PATCH` / `DELETE` `/api/v1/transfers/:id`
- `GET` / `POST` `/api/v1/budget-periods`
- `GET` / `PATCH` / `DELETE` `/api/v1/budget-periods/:id`
- `PUT` `/api/v1/budget-periods/:id/allocations`
- `GET` `/api/v1/dashboard?periodId=:id`

Categories have separate `INCOME` and `EXPENSE` types. Accounts store an opening balance and minimum held balance. Deleting a master-data item archives it so future transaction history can keep its reference; archived items can be restored from the interface.

Cash flow entries use the transaction date, a positive amount, one account, and a category that determines whether the entry is income or expense. For expenses, the budget source category can differ from the recorded category. Transfers move funds between two different accounts and are excluded from income and expense totals. Current account balances are calculated from the opening balance plus income, minus expenses and transfers out, plus transfers in. The cash flow screen can be filtered by calendar month; this same month is used for both entries and transfers.

Budget periods have user-selected start and end dates and cannot overlap. Each period has a manually entered allocation for expense categories. Expenses use their budget source category when calculating usage; past-period balances are not carried forward automatically.

Frontend requests should use `src/lib/api/client.ts`. Set `NEXT_PUBLIC_API_BASE_URL` to `/api/v1` for this monolith. A separately hosted API can use its root URL there, provided it keeps the same API contract and its authentication/CORS settings are configured for the frontend origin.

## Authentication

The app uses one access-key input. The configured `APP_ACCESS_KEY` is checked on the server and is never stored in the database. Successful login creates a signed, HTTP-only cookie that expires after 30 minutes; sessions do not refresh automatically. `AUTH_SECRET` signs and verifies that cookie. Set both values in the deployment environment as well as local `.env`.

## Search indexing

The app sends `noindex` metadata. `robots.txt` allows crawlers to read that metadata; these settings discourage search indexing but do not restrict access to the app.
