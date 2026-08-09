---
title: "Why Per-User SQLite Is the Right Architecture for B2C SaaS"
description: "One SQLite database per user gives you isolation, performance, and simplicity: without any of the complexity of multi-tenant schemas."
published: "2025-01-10"
authors: ["Team"]
category: "engineering"
---

# Why Per-User SQLite

Most B2C SaaS apps use a single shared database with a `user_id` column on every table. It works, but it comes with trade-offs: you need row-level security, complex queries, and careful indexing to avoid one user's data leaking into another's queries.

Per-user SQLite flips this model on its head.

## How It Works

Each user gets their own SQLite file at `data/users/{userId}/user.db`. When the user logs in, their database is opened and migrations are run if needed. All queries for that user's data hit their own isolated file.

```
data/
  meta.db          ← shared: users, sessions, subscriptions
  users/
    abc123/
      user.db      ← user A's data
    def456/
      user.db      ← user B's data
```

## The Benefits

### True isolation

No `WHERE user_id = ?` required. Every query runs against a database that only contains that user's data. Cross-user data leaks are architecturally impossible.

### Performance

SQLite is [extremely fast](https://www.sqlite.org/speed.html) for single-user workloads. WAL mode allows concurrent reads. With per-user files, you get a dedicated cache per user: no contention from other users' queries warming cold pages.

### Simple backups

Want to backup or export a user's data? Copy one file. Done.

### Easy migrations

Migrations run lazily when a user's database is first opened. You can add columns, create tables, and evolve the schema without coordinating a global migration run.

## The Trade-offs

This pattern works best when:
- Each user's data is mostly independent
- You don't need complex cross-user queries (leaderboards, recommendations)
- Your app handles hundreds to tens of thousands of users

If you're building social features where users interact heavily, a shared database may be more appropriate.

## Getting Started

Your per-user migrations live in `src/db/user-migrations.ts`. Add a new entry to the `USER_MIGRATIONS` array for each schema change:

```ts
{
  id: '002_add_tags',
  run: (db) => {
    db.run(`ALTER TABLE example_items ADD COLUMN tags TEXT`)
  }
}
```

Migrations are idempotent and run in order. The framework tracks which ones have been applied in a `_warpkit_migrations` table inside each user's database.
