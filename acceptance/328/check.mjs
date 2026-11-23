#!/usr/bin/env node
/**
 * Acceptance check for issue 328: the GDELT map popup must escape every event field and wire its buttons
 * through event delegation, because the production CSP (script-src 'self') blocks inline event handlers.
 *
 * Runs the popup, map-component and CSP unit tests, then scans the app source (never the tests) for the
 * forbidden patterns: an inline onclick calling a window global, or the globals themselves. Red on the base
 * branch (the popup is built with onclick="window.filterByCountry(...)"), green on the fixed head.
 *
 * Synthetic data only: the hostile strings live inside the test files, never from collected content.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');
const ui = join(repo, 'ex-accell-ui');

const testFiles = [
  'src/lib/utils/gdeltMarkers.test.ts',
  'src/lib/components/gdelt/GdeltMap.test.ts',
  'src/lib/server/csp.test.ts'
];

/** Anything that looks like an inline handler calling a window global, or one of the removed globals. */
const FORBIDDEN = [
  /onclick\s*=\s*["']window\./i,
  /window\.filterByCountry/,
  /window\.showEventMentions/
];

function run(cmd, args, cwd) {
  return spawnSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

// The acceptance callers build and start nothing else, so install the web app's dependencies when missing.
if (!existsSync(join(ui, 'node_modules', 'vitest'))) {
  const install = run('npm', ['--prefix', ui, 'ci', '--no-audit', '--no-fund'], repo);
  if (install.status !== 0) {
    console.error('npm ci failed');
    process.exit(install.status ?? 1);
  }
}

// C1 (the escaping test), C2 (the delegation and no-globals tests) and C3 (the CSP configuration test).
const vitest = run(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...testFiles], ui);
if (vitest.status !== 0) {
  console.error('the popup, map-component or CSP tests failed');
  process.exit(vitest.status ?? 1);
}

// C2 + C3: no app source may carry an inline handler or a window global for the popup buttons.
const offenders = [];
function scan(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules') continue;
      scan(full);
    } else if (/\.(ts|svelte|js)$/.test(entry) && !/\.(test|spec)\./.test(entry)) {
      const source = readFileSync(full, 'utf8');
      for (const pattern of FORBIDDEN) {
        if (pattern.test(source)) offenders.push(`${full} matches ${pattern}`);
      }
    }
  }
}
scan(join(ui, 'src'));

if (offenders.length > 0) {
  console.error('inline popup handlers or window globals found:\n' + offenders.join('\n'));
  process.exit(1);
}
console.log('popup tests pass and no inline handler or window global remains');
