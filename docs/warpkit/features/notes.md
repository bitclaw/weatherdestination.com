# Notes

Reference CRUD feature at `/dashboard/notes`. Simple per-user note management.

## Purpose

Notes is a reference implementation showing the simple form CRUD pattern (inline form, list view, minimal UI chrome). Use it as a template for features that don't need table sorting, filtering, or bulk actions.

Notes demonstrates:
- Per-user SQLite migration + schema
- `createServerFn` queries and mutations
- `withWriteLock` + `logUserEvent` together
- `checkEntitlement` for plan limits
- Feature barrel (`index.ts`) exporting queryOptions and mutations
- Integration tests with `makeTestDb()`

## Key files

```
src/features/notes/
├── index.ts                    -- barrel
├── notes.constants.ts          -- Zod schemas, types
├── server/
│   ├── notes.queries.ts        -- listNotes, getNote
│   ├── notes.mutations.ts      -- createNote, updateNote, deleteNote
│   ├── notes.server.ts         -- DB logic (listNotesFromDb, etc.)
│   └── notes-crud.test.ts      -- 8 integration tests
└── pages/
    └── index.tsx               -- NotesList page component
```

Migration: `src/lib/db/migrations/*_create_notes.ts`

## Plan limit

`config.stripe.limits[plan].maxNotes` controls how many notes a user on each plan can create. `-1` = unlimited.

## Using as a template

To build a new feature, copy the notes feature structure and replace `note`/`notes` with your entity name. Keep the test file -- it documents all the expected behaviors.
