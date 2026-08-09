// Fails if package.json has any non-exact version specifier (^, ~, >, *,
// workspace:, or an npm dist-tag like "latest"). Exact pins are a deliberate
// choice here (see docs/runmist/runmist-warpkit-prompt.md's publishing
// notes): a caret survives a botched lockfile merge conflict silently,
// while an exact pin makes `git diff package.json` itself the audit trail
// for when a version actually changed. Written after "beasties": "^0.4.3"
// and "mdast": "^3.0.0" sat undetected across 3 repos with zero enforcement
// behind the documented rule.
const EXACT_VERSION = /^\d+\.\d+\.\d+/;

const pkg = await Bun.file('package.json').json();

const violations: string[] = [];
for (const section of [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies'
]) {
  const deps = pkg[section] as Record<string, string> | undefined;
  if (!deps) continue;
  for (const [name, version] of Object.entries(deps)) {
    if (!EXACT_VERSION.test(version)) {
      violations.push(`${section}.${name} = "${version}"`);
    }
  }
}

if (violations.length > 0) {
  console.error('Non-exact version specifier(s) in package.json:');
  for (const v of violations) console.error(`  ${v}`);
  console.error('Pin an exact version (no ^, ~, >, *, workspace:, or tags).');
  process.exit(1);
}
