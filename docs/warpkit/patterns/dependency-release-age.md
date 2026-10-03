# Dependency release age

`bunfig.toml` refuses to install any npm version published less than
**3 days** ago (`minimumReleaseAge = 259200`). This doc is the policy for
that gate: why it exists, what may skip it, and how to ship an urgent
security fix that is newer than the window.

Same policy in every repo that uses it: warpkit, warpkit-postgres,
warpkit.dev, weatherdestination.com, runmist. Set 2026-10-01.

## Why 3 days

The gate protects against a hijacked maintainer account publishing a
malicious version. The large npm incidents (the September 2025 chalk/debug
hijack, the Shai-Hulud worm) were detected and pulled within hours to about
a day. Three days covers that with margin.

Longer costs real security: a fix is blocked for the whole window. With
the old 7-day gate, the TanStack Start XSS fix (CVE-2026-102989,
`@tanstack/react-start` 1.168.60, published 2026-09-30) would have stayed
blocked until 2026-10-07.

The gate only affects resolving new versions. Versions already in
`bun.lock` install normally, including on a cold CI install.

## What may be excluded

`minimumReleaseAgeExcludes` lists **first-party packages only**
(`@bitclaw/*`, `@runmist/*`): we publish them ourselves, so the hijack the
gate defends against doesn't apply, and we often need them minutes after
publishing.

Never add a third-party package. An exclude covers every future version of
that package, not the one release you checked. Until 2026-10-01 the repos
permanently excluded `better-auth`, `@better-auth/*`, `better-call`,
`@better-fetch/fetch`, `typescript` and `@types/node`; the auth stack is
exactly where a hijacked release would hurt most. They were removed.

Adding a new first-party package: add it to the list, then `bun add`.

## Urgent security fix newer than 3 days

Decide first whether it can wait for the window. Weigh how exposed the app
is (does the exploit need a logged-in victim, how many users, is a
mitigation available). If it can't wait:

1. Check the release's origin before trusting it:
   - `npm view <pkg>@<version> _npmUser` should be the project's CI
     (for example `GitHub Actions <npm-oidc-no-reply@github.com>`), not a
     personal account.
   - `npm view <pkg>@<version> dist.attestations` should show SLSA
     provenance.
   - The version matches the vendor's advisory.
2. Bump the versions in `package.json`.
3. Install once with the gate lowered on the command line, not in
   `bunfig.toml`. Lower it only to just below the age of the newest
   package you need, not to 0:
   ```bash
   # fix set published ~66h ago: 230000s (~64h) admits it,
   # rejects anything newer
   bun install --minimum-release-age=230000
   ```
   The flag applies to the whole install, not just the bumped packages.
   With `=0`, the TanStack upgrade on 2026-10-03 also pulled in an
   unrelated transitive `exsolve` release that was 2 hours old; the
   narrower value kept the older one. The new versions land in
   `bun.lock`; `bunfig.toml` stays unchanged, so nothing else gets a free
   pass later. Check `git diff bun.lock` and the publish time
   (`npm view <pkg> time`) of every version it adds: only the packages
   you meant to bump (and their own dependencies) should be newer than
   3 days.
4. `make fix && make ci`, commit, deploy.

Transitive dependencies count too: a fix release often pins sibling
packages published the same day (the TanStack fix needed about 15
`@tanstack/*` packages plus `@tanstack/react-store`, which was only found
on the first failed install). The command-line override handles all of
them at once, which an exclude list can't do cleanly.
