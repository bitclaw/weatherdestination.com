# shadcn-admin Porting Tracker

Live reference: https://shadcn-admin.netlify.app/

shadcn-admin sidebar sections: Dashboard, Tasks, Apps, Chats, Users | Auth, Errors, Settings, Help Center

---

## Done

### Shared infrastructure
- [x] **DataTable** (`src/components/data-table/`) , column-header, faceted-filter, pagination, toolbar, view-options, types
- [x] **CommandMenu ⌘K** (`src/components/command-menu.tsx`)
- [x] **App sidebar layout** (`src/components/layout/`) , app-sidebar, header, main, nav-group, nav-user, sidebar-data, types
- [x] **shadcn UI primitives** , sidebar.tsx, confirm-dialog.tsx, scroll-area.tsx, sheet.tsx, and others

### Features
- [x] **Users / Admin page** (`src/features/admin/`) , DataTable with Status/Role/Plan faceted filters, row actions, Add/Edit/Ban/Invite dialogs, better-auth admin plugin
- [x] **Settings pages** (`src/pages/settings/`, routes `_app.settings.*`) , profile, account, appearance, notifications, display; sidebar-nav + content-section layout

### Error pages (partial)
- [x] **General error** (`src/pages/error-pages/error.tsx`)
- [x] **Not-found** (`src/pages/error-pages/not-found.tsx`)

### Dashboard charts
- [x] **Stat cards** (Revenue, Subscriptions, Active Users, Growth)
- [x] **MRR bar chart** (`src/pages/dashboard/mrr-chart.tsx`) , recharts BarChart
- [x] **Subscriber growth chart** (`src/pages/dashboard/subscriber-growth-chart.tsx`)
- [x] **Plan distribution** (`src/pages/dashboard/plan-distribution.tsx`)
- [x] **Recent Payments panel** (`src/pages/dashboard/recent-payments.tsx`)

### Notes page (ported from shadcn-admin's Tasks)
- [x] **Real per-user SQLite feature** (`src/features/notes/`) , migration, server functions, tests
- [x] **Simple form CRUD reference pattern** (create + edit + pin + delete)
- [x] **Route** `_app.dashboard.notes.tsx` + `_app.dashboard.notes.index.tsx`

### Chats page
- [x] **Real AI assistant** (`src/features/ai-chat/`) , OpenRouter streaming (cloud) + Chrome built-in LLM (local, no API key)
- [x] **Per-user SQLite** , conversations + chat_messages tables, 7 tests
- [x] **Two-panel layout** , conversations sidebar + streaming chat panel
- [x] **SSE endpoint** `src/routes/api/v1/ai-chat.ts` , @tanstack/ai + openRouterText, auth-gated, rate limited
- [x] **Auto-title** conversation from first message; delete with cascade
- [x] **Route** `_app.chat.tsx` + `_app.chat.index.tsx` + `_app.chat.$id.tsx`
- [x] **Config** `config.ai.model` (default `openrouter/auto`) + `OPENROUTER_API_KEY` env

### Apps page
- [x] **Card grid** (`src/features/apps/`) , 13 integrations, filter by connected, sort A-Z
- [x] **Brand icons** (`src/assets/brand-icons/`) , 16 SVG icon components

---

## Not Done

### Error pages (missing variants)
shadcn-admin has 5 error pages; warpkit has 2. Missing:
- 403 Forbidden (`forbidden.tsx`)
- 503 Maintenance (`maintenance-error.tsx`)
- 401 Unauthorized (`unauthorized-error.tsx`)

**Effort:** tiny. Mostly copy + adapt styling.

### Help Center
shadcn-admin ships it as `<ComingSoon />` placeholder , no real content.
**Effort:** skip (no real implementation to port).

### Auth pages (sign-in, sign-up, OTP, forgot-password)
shadcn-admin uses Clerk. Warpkit already has better-auth with OTP/magic-link , covers this.
**Effort:** skip (already solved differently).

---

## Priority order (recommendation)

1. **Error pages** , 3 missing variants, ~30 min each

---

## Warpkit gotchas (accumulated)

| Gotcha | Detail |
|--------|--------|
| Radix package | `radix-ui` (combined), NOT `@radix-ui/react-*` individual packages |
| Icons | `lucide-react` only, NOT `@radix-ui/react-icons` |
| useTheme | `@/hooks/use-theme` , `{ theme, setTheme, mounted, toggleTheme, resolvedTheme }` |
| FormField | `@/components/ui/form-field` uses `@tanstack/react-form`, not react-hook-form |
| DataTableToolbar | prop is `filters`, not `facetedFilters` |
| Biome: module augmentation | needs `// biome-ignore lint/style/useConsistentTypeDefinitions` (interface, not type) |
| Biome: array index keys | precompute keys outside JSX maps |
| Layout routes | any route with children must be bare `<Outlet />`, page content in `.index.tsx` |
