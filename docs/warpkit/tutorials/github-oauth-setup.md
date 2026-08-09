# GitHub OAuth Setup

Sign-in with GitHub uses `src/server/auth.ts`'s `github` social provider (better-auth). Each
deployed domain (and localhost) needs its own GitHub OAuth App, because the callback URL is
matched exactly — an app registered for `https://example.com/api/auth/callback/github` will not
accept a login started from `http://localhost:3000`.

## Why this needs a wizard, not a CLI flag

GitHub has no REST API or `gh` CLI command to create an OAuth App — only GitHub *Apps* support
the scriptable manifest-based creation flow; OAuth Apps are web-UI-only to register. `gh api`
can't reach an endpoint that doesn't exist.

`make github.oauth.setup` automates everything around that one manual step:

1. Builds a pre-filled `https://github.com/settings/applications/new` URL (name, homepage,
   callback URL all filled in from `config.ts`) and opens it in your browser.
2. You click "Register application", then "Generate a new client secret" — GitHub's UI, no way
   around it.
3. Paste the Client ID and secret back into the terminal prompt.
4. The script writes `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `VITE_GITHUB_CLIENT_ID` into
   the right env file.

## Usage

```bash
make github.oauth.setup ENV=local   # -> .env, callback http://localhost:3000/api/auth/callback/github
make github.oauth.setup ENV=prod    # -> .env.production, callback https://<config.domainName>/api/auth/callback/github
```

`ENV` defaults to `local` if omitted. Run both once per domain you deploy to — a fresh clone
scaffolded to a new domain needs its own pair of apps, not a reused one.

After `ENV=prod`: the change only lands in the local `.env.production` file. Ship it with
`make deploy.env` and restart the app service so `auth.ts` picks up the new credentials.

## Why per-domain, not one shared app

A single OAuth App's callback URL list can technically hold multiple URLs, but keeping prod and
local as separate apps means a leaked/rotated local dev secret never touches the production app,
and GitHub's "third-party access" screen for users shows the real app name/domain instead of a
shared one covering unrelated environments.

## Scopes

`auth.ts` requests `user:email` (login identity) and `repo` (deploy/git-integration features that
read the user's repos). If a downstream project doesn't need repo access, drop `repo` from the
`scope` array in `auth.ts` before running the wizard — GitHub shows requested scopes on the
consent screen but doesn't let you change them per-login after the app is registered.
