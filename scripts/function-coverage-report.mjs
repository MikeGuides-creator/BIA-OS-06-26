/**
 * Aggregates the per-worker function-coverage files written by tests/setup.js
 * and prints how much of the application's global API the suite exercises.
 *
 * Usage: npm run coverage
 */
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const coverageDir = path.join(repoRoot, '.coverage');

if (!fs.existsSync(coverageDir)) {
  console.error('No coverage data found. Run "npm test" first.');
  process.exit(1);
}

const defined = new Set();
const invoked = new Set();
let appFile = 'unknown';

for (const entry of fs.readdirSync(coverageDir)) {
  if (!entry.endsWith('.json')) continue;

  const data = JSON.parse(fs.readFileSync(path.join(coverageDir, entry), 'utf8'));
  appFile = data.appFile || appFile;
  data.defined.forEach(name => defined.add(name));
  data.invoked.forEach(name => invoked.add(name));
}

const uncovered = [...defined].filter(name => !invoked.has(name)).sort();
const percentage = defined.size === 0 ? 0 : Math.round((invoked.size / defined.size) * 100);

console.log(`App file: ${appFile}`);
console.log(`Global functions defined: ${defined.size}`);
console.log(`Global functions exercised by tests: ${invoked.size} (${percentage}%)`);
console.log('');
console.log(`Not exercised (${uncovered.length}):`);
for (const name of uncovered) console.log(`  ${name}`);
