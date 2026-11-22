#!/usr/bin/env node
// Acceptance spec for spiculedata/social-explorer#347: "Engagement analysis loads its filtered
// data twice after the first load".
//
// Command specs run in this directory, so the script works outwards from here: the repository root
// under test is two levels up (the base checkout on one side of base-check.yml, the PR checkout on
// the other). The Vitest case lives beside this script (check.test.ts) rather than in the tree, so
// the SAME assertions run against base and head; the script copies it into the web app's test
// directory, runs it with the app's own Vitest, and removes it again. The case mounts the
// engagement-analysis page with the database service mocked and counts the requests each endpoint
// receives — no server, no database, synthetic data only.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const specDir = dirname(fileURLToPath(import.meta.url));
const ui = join(specDir, '..', '..', 'ex-accell-ui');
const testFile = join(ui, 'src/routes/text-analytics/engagement-analysis/acceptance-347.test.ts');

if (!existsSync(join(ui, 'node_modules'))) {
  console.error('[acceptance/347] installing the web app dependencies');
  const install = spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: ui, stdio: 'inherit' });
  if (install.status !== 0) {
    console.error('[acceptance/347] npm ci failed');
    process.exit(1);
  }
}

copyFileSync(join(specDir, 'check.test.ts'), testFile);
let code = 1;
try {
  const vitestBin = join(ui, 'node_modules', '.bin', 'vitest');
  const run = spawnSync(vitestBin, ['run', 'src/routes/text-analytics/engagement-analysis/acceptance-347.test.ts'], {
    cwd: ui,
    stdio: 'inherit'
  });
  code = run.status ?? 1;
} finally {
  rmSync(testFile, { force: true });
}
console.log(code === 0 ? '[acceptance/347] pass' : '[acceptance/347] fail');
process.exit(code);
