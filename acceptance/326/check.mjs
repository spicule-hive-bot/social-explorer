// Acceptance check for issue #326: the production image must run as a non-root user.
//
// Static verification, run as `node acceptance/326/check.mjs` from the repository root (the spec's
// command). Exit 0 = pass. No Docker needed: the workflow in .github/workflows/images.yml builds
// the image and asserts `docker run --rm <image> id -u` is not 0; this script checks that the
// Dockerfile, that workflow step and the compose volume handling are all in place.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};

// Resolve the repository root whether the process is started from the repo root, the spec
// directory or anywhere inside it.
let root = dirname(fileURLToPath(import.meta.url));
while (root !== '/' && !existsSync(join(root, 'ex-accell-ui', 'Dockerfile'))) {
  root = dirname(root);
}

// C1: the runtime (final) stage of ex-accell-ui/Dockerfile sets a non-root USER.
const dockerfile = readFileSync(join(root, 'ex-accell-ui', 'Dockerfile'), 'utf8');
const stages = dockerfile.split(/^FROM\b/m).filter((stage) => stage.trim().length > 0);
const runtimeStage = stages[stages.length - 1];
check(
  runtimeStage.includes('WORKDIR /app'),
  'runtime stage not found in ex-accell-ui/Dockerfile',
);
const userDirectives = [...runtimeStage.matchAll(/^USER\s+(\S+)/gm)].map((m) => m[1]);
check(userDirectives.length > 0, 'runtime stage of ex-accell-ui/Dockerfile declares no USER');
const runtimeUser = userDirectives[userDirectives.length - 1] ?? '';
check(
  userDirectives.length > 0 && runtimeUser.toLowerCase() !== 'root' && runtimeUser !== '0',
  `runtime stage of ex-accell-ui/Dockerfile runs as "${runtimeUser || 'root'}" (expected a non-root user)`,
);
const userIndex = runtimeStage.search(/^USER/m);
const cmdIndex = runtimeStage.search(/^CMD/m);
check(cmdIndex > -1 && userIndex > -1 && userIndex < cmdIndex, 'USER must apply to the runtime CMD');

// C2: the Images workflow runs the built UI image and fails when the runtime user is root.
const imagesYml = readFileSync(join(root, '.github/workflows/images.yml'), 'utf8');
const uiBuildIndex = imagesYml.indexOf('Build UI image');
check(uiBuildIndex > -1, 'images.yml has no "Build UI image" step');
const afterUiBuild = imagesYml.slice(uiBuildIndex);
check(
  /id -u/.test(afterUiBuild) && /uid"\s*=\s*"0"|= "0"/.test(afterUiBuild) && /exit 1/.test(afterUiBuild),
  'images.yml does not run the built UI image and fail when `id -u` reports uid 0',
);

// A top-level compose key starts a line with two spaces followed by a name and a colon. The next
// such key (or end of file) ends the block. Two-space indentation is matched exactly with ^, so a
// deeper key like `      ui-init:` (a depends_on reference) never starts a block.
const composeBlock = (text, key) => {
  const start = text.search(new RegExp(`^  ${key}:$`, 'm'));
  if (start === -1) return '';
  const rest = text.slice(start + 2);
  const next = rest.search(/^  \S/m);
  return next === -1 ? rest : rest.slice(0, next);
};

// C3: compose hands the ${DATA_DIR} volumes to uid 1000 before ui starts, and the docs say so.
const compose = readFileSync(join(root, 'docker-compose.yml'), 'utf8');
const uiInitBlock = composeBlock(compose, 'ui-init');
check(uiInitBlock !== '', 'docker-compose.yml has no ui-init one-shot service');
check(
  /user: "0:0"/.test(uiInitBlock) && /chown.*1000:1000/.test(uiInitBlock) && uiInitBlock.includes('/data/ipfs') && uiInitBlock.includes('/data/packages'),
  'ui-init does not chown /data/ipfs and /data/packages to 1000:1000',
);
const uiServiceBlock = composeBlock(compose, 'ui');
check(
  /ui-init:\s*\n\s*condition: service_completed_successfully/.test(uiServiceBlock),
  'the ui service does not wait for ui-init (service_completed_successfully)',
);
const deploymentDoc = readFileSync(join(root, 'docs-site/guide/deployment.md'), 'utf8');
check(
  deploymentDoc.includes('ui-init') && deploymentDoc.includes('chown -R 1000:1000'),
  'docs-site/guide/deployment.md does not document the UI non-root user and ui-init',
);

// C4: the demo start and resume path is untouched — demo.sh serves the app with `vite dev`, not
// the production image, so this change cannot break the Demo start and resume check.
const demoSh = readFileSync(join(root, 'ex-accell-ui/scripts/demo.sh'), 'utf8');
check(demoSh.includes('vite dev'), 'demo.sh no longer serves the app with `vite dev`');

if (failures.length > 0) {
  console.error('acceptance/326 failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('acceptance/326 passed: production UI image runs as a non-root user with the volume handover in place.');
