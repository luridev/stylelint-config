import assert from 'node:assert/strict';
import { existsSync, realpathSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { URL, fileURLToPath } from 'node:url';

const root = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const output = join(root, 'dist');

assert.equal(dirname(output), root);

if (existsSync(output)) {
  assert.equal(realpathSync(output), output, 'Refusing to remove a linked output directory.');
}

rmSync(output, { recursive: true, force: true });
