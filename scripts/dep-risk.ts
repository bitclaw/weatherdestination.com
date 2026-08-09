// Analyzes the risk of bumping one dependency to a specific version, before
// you actually do it. Automates the manual check that caught a real bug:
// bumping @tanstack/react-start alone (without also bumping
// @tanstack/react-router) would have put two different versions of
// react-router in the tree - one used directly in every route file, one
// nested inside react-start's own dependency tree - and TanStack Router
// must be a singleton (shared route context) for that to work correctly.
//
// Usage: bun run scripts/dep-risk.ts <package> <target-version>
// Example: bun run scripts/dep-risk.ts @tanstack/react-start 1.168.26
import { $ } from 'bun';

const [pkgName, targetVersion] = process.argv.slice(2);
if (!pkgName || !targetVersion) {
  console.error(
    'Usage: bun run scripts/dep-risk.ts <package> <target-version>'
  );
  process.exit(1);
}

const ourPkg = await Bun.file('package.json').json();
const findCurrent = (): { section: string; version: string } | null => {
  for (const section of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies'
  ]) {
    const version = ourPkg[section]?.[pkgName];
    if (version) return { section, version };
  }
  return null;
};

const current = findCurrent();
if (!current) {
  console.error(`${pkgName} is not a dependency of this project.`);
  process.exit(1);
}

console.info(`\n${pkgName}: ${current.version} -> ${targetVersion}\n`);

if (current.version === targetVersion) {
  console.info('Already at this version. Nothing to do.');
  process.exit(0);
}

const npmView = async (spec: string, field: string) => {
  const result = await $`npm view ${spec} ${field} --json`.quiet().nothrow();
  if (result.exitCode !== 0) return null;
  const text = result.stdout.toString().trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text.replace(/^"|"$/g, '');
  }
};

const deprecated = await npmView(`${pkgName}@${targetVersion}`, 'deprecated');
if (deprecated) {
  console.info(`⚠️  DEPRECATED: ${deprecated}\n`);
}

// How far behind is the target version, and is it even still current?
const allVersions: string[] | null = await npmView(pkgName, 'versions');
if (allVersions) {
  const stable = allVersions.filter(v => !v.includes('-'));
  const targetIdx = stable.indexOf(targetVersion);
  const latest = stable.at(-1);
  if (targetIdx === -1) {
    console.info(`⚠️  ${targetVersion} is not a published stable version.`);
  } else if (latest && latest !== targetVersion) {
    const behind = stable.length - 1 - targetIdx;
    console.info(
      `Target is ${behind} stable release(s) behind latest (${latest}).`
    );
  } else {
    console.info('Target is the latest stable release.');
  }
}

// Cross-check every dependency the target version pins against what we
// already have installed for that same package elsewhere in our tree - this
// is the check that would have caught the react-router mismatch.
const targetDeps: Record<string, string> | null = await npmView(
  `${pkgName}@${targetVersion}`,
  'dependencies'
);
if (targetDeps) {
  const conflicts: string[] = [];
  for (const [depName, depVersion] of Object.entries(targetDeps)) {
    const oursForDep = findCurrentByName(ourPkg, depName);
    if (oursForDep && oursForDep.version !== depVersion) {
      conflicts.push(
        `  ${depName}: we have ${oursForDep.version}, target wants ${depVersion}`
      );
    }
  }
  if (conflicts.length > 0) {
    console.info(
      `\n⚠️  ${targetVersion} was published expecting different versions of packages we also depend on directly:`
    );
    for (const line of conflicts) console.info(line);
    console.info(
      '  These need a coordinated bump together, or this package can end up\n  duplicated in the tree at two versions - risky for anything needing\n  singleton behavior (shared context/state).'
    );
  } else {
    console.info('\nNo conflicting nested dependency versions detected.');
  }
}

// Peer dependency ranges - looser, but still worth checking against what we
// actually have pinned.
const targetPeers: Record<string, string> | null = await npmView(
  `${pkgName}@${targetVersion}`,
  'peerDependencies'
);
if (targetPeers) {
  const peerIssues: string[] = [];
  for (const [peerName, range] of Object.entries(targetPeers)) {
    const oursForPeer = findCurrentByName(ourPkg, peerName);
    if (!oursForPeer) continue;
    const ranges = range.split('||').map(r => r.trim());
    const satisfiesAny = ranges.some(r =>
      Bun.semver.satisfies(oursForPeer.version, r)
    );
    if (!satisfiesAny) {
      peerIssues.push(
        `  ${peerName}: we have ${oursForPeer.version}, target requires ${range}`
      );
    }
  }
  if (peerIssues.length > 0) {
    console.info('\n⚠️  Peer dependency range violations:');
    for (const line of peerIssues) console.info(line);
  } else if (Object.keys(targetPeers).length > 0) {
    console.info('All peer dependency ranges satisfied.');
  }
}

console.info('');

function findCurrentByName(
  pkgJson: Record<string, unknown>,
  name: string
): { section: string; version: string } | null {
  for (const section of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies'
  ]) {
    const version = (pkgJson[section] as Record<string, string> | undefined)?.[
      name
    ];
    if (version) return { section, version };
  }
  return null;
}
