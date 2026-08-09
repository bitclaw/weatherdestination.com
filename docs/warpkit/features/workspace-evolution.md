# Scaling Beyond Per-User: Workspaces and Multi-Session

Warpkit ships per-user SQLite as the default. This covers most simple SaaS apps. Two distinct problems arise when you outgrow it.

## Problem A: Multiple workspaces per identity

One email, N isolated projects. Example: a user has a "Personal" workspace and a "Acme Corp" workspace, each with separate data.

**Migration path:**

1. Add a `workspaces` table to the shared Drizzle DB (id, name, owner)
2. Add a `workspace_members` table (workspaceId, userId, role)
3. Give each workspace its own SQLite DB: `getWorkspaceDb(workspaceId, dbPath)`
4. Replace `requireUser()` with `requireWorkspaceMembership(workspaceId)` -- queries shared DB for membership, returns `{ db, role }`
5. Move billing to workspace level (subscription tied to workspaceId, not userId)
6. Every server function receives `workspaceId` as an explicit input param

## Problem B: Multiple simultaneous identities

Multiple email logins in one browser session, with fast switching. Example: a freelancer logged in as both `alice@personal.com` and `alice@client.com`.

**Solution already built in:**

Better Auth's `multiSession` plugin is configured in `src/server/auth.ts`. Users can be logged in as N emails simultaneously and switch without re-auth.

## Combining both

With Problem A (workspaces) and Problem B (multi-session), each identity has its own workspace list. The session switcher UI spans both dimensions: switch identity, then switch workspace within that identity.

## What NOT to do

`org_members` alone solves neither problem. It handles team access within one identity but does not provide:
- Workspace isolation (separate SQLite DBs)
- Identity switching (multiple email sessions)

## When to evolve

Stay on per-user until you have a concrete user need for one of these patterns. Both add significant complexity. The per-user model covers the majority of B2C SaaS apps.
