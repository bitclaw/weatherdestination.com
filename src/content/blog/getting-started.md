---
title: "Getting Started with Your SaaS Template"
description: "Everything you need to know to go from clone to production in under an hour."
published: "2025-01-15"
authors: ["Team"]
category: "tutorial"
---

# Getting Started

Welcome! This guide walks you through the steps to launch your SaaS with warpkit.

## 1. Clone and install

```bash
git clone <your-repo>
cd your-app
bun install
```

## 2. Configure your app

Open `config.ts` at the project root. This is the single file you edit to brand your product:

```ts
const config = {
  appName: 'My App',
  domainName: 'myapp.com',
  // ...
}
```

Update the app name, domain, and Stripe plan details here.

## 3. Set up environment variables

Copy `.env.example` to `.env.local` and fill in:

- `DATABASE_PATH`: path to your SQLite metadata database
- `BETTER_AUTH_SECRET`: random secret for sessions
- `STRIPE_SECRET_KEY`: from your Stripe dashboard
- `STRIPE_WEBHOOK_SECRET`: from your Stripe webhook endpoint
- `RESEND_API_KEY`: for transactional email

## 4. Run migrations

```bash
bun db:migrate
```

This creates your metadata database with users, sessions, and subscription tables.

## 5. Start the dev server

```bash
bun dev
```

Visit `http://localhost:3000`. You should see the landing page.

## 6. Replace the example feature

Open `src/features/notes/`: this is your reference implementation of a simple CRUD feature. Replace `notes` with your domain entities, add your own migrations to `src/lib/db/migrations/` (registered in `src/lib/db/user-migrations.ts`), and update the routes at `src/routes/_app.dashboard.notes.*.tsx`.

That's it. Ship your features, not infrastructure.
