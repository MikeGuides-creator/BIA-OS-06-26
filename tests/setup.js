import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { afterAll } from 'vitest';
import { definedFunctions, invokedFunctions, APP_FILE } from './helpers/loadApp.js';

const outputDir = path.resolve(import.meta.dirname, '..', '.coverage');

afterAll(() => {
  if (definedFunctions.size === 0) return;

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, `functions-${crypto.randomUUID()}.json`),
    JSON.stringify({
      appFile: APP_FILE,
      defined: [...definedFunctions],
      invoked: [...invokedFunctions]
    })
  );
});
