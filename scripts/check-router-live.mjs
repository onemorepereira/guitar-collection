// Before a frontend deploy: the live CloudFront URL router must match the one in
// frontend-infrastructure.yaml, or a new route could go live without the function
// that serves it. Usage: node scripts/check-router-live.mjs <function-name>
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractRouter } from './router-extract.mjs';

const name = process.argv[2];
if (!name) {
  console.error('usage: node scripts/check-router-live.mjs <function-name>');
  process.exit(2);
}

const dir = mkdtempSync(join(tmpdir(), 'router-'));
const liveFile = join(dir, 'live.js');
try {
  try {
    execFileSync('aws', ['cloudfront', 'get-function', '--name', name, '--stage', 'LIVE', liveFile], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
  } catch (error) {
    const stderr = String(error.stderr || '');
    if (stderr.includes('NoSuchFunctionExists')) {
      console.log(`[i] URL router ${name} doesn't exist yet (first rollout): skipping the drift check.`);
      process.exit(0);
    }
    console.error(`[X] Could not read the live URL router ${name}:\n${stderr}`);
    process.exit(1);
  }
  const live = extractRouter(readFileSync(liveFile, 'utf8'));
  const repo = extractRouter(readFileSync('frontend-infrastructure.yaml', 'utf8'));
  if (live !== repo) {
    console.error(
      `[X] The live URL router (${name}) differs from frontend-infrastructure.yaml.\n` +
        '    Run `make plan-frontend-infra` and `make deploy-frontend-infra` first.'
    );
    process.exit(1);
  }
  console.log(`[✓] Live URL router ${name} matches the template.`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
