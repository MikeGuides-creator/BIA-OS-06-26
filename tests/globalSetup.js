import fs from 'node:fs';
import path from 'node:path';

export default function setup() {
  fs.rmSync(path.resolve(import.meta.dirname, '..', '.coverage'), {
    recursive: true,
    force: true
  });
}
