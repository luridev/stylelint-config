import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import spawn from 'cross-spawn';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const scratch = mkdtempSync(join(tmpdir(), 'protoapps-stylelint-'));
const consumer = join(scratch, 'consumer');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !['NODE_PATH', 'NODE_OPTIONS'].includes(key.toUpperCase())));

function run(command: string, args: Array<string>, cwd = root) {
  const result = spawn.sync(command, args, { cwd, env, encoding: 'utf8', windowsHide: true });

  assert.ifError(result.error);
  assert.equal(result.status, 0, `${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);

  return result.stdout;
}

function version(name: string): string {
  const manifest = JSON.parse(readFileSync(require.resolve(`${name}/package.json`), 'utf8')) as { version: string };

  return manifest.version;
}

function write(name: string, content: string) {
  const target = join(consumer, name);

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

try {
  assert.ok(relative(root, scratch).startsWith('..'), 'consumer must be outside the workspace');
  run('npm', ['run', 'build']);
  const packed = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', scratch])) as Array<{ filename: string }>;
  const archive = join(scratch, packed[0].filename);

  run('npm', ['exec', '--no', '--', 'publint', archive, '--strict']);
  write('package.json', JSON.stringify({ name: 'packed-stylelint-consumer', private: true, type: 'module' }));
  run('npm', ['install', '--install-strategy=nested', '--ignore-scripts', '--no-audit', '--no-fund', archive, `stylelint@${version('stylelint')}`], consumer);
  run('npm', ['ls', '--all'], consumer);
  const installed = realpathSync(join(consumer, 'node_modules/@protoapps/stylelint-config'));

  assert.ok(installed.startsWith(realpathSync(consumer)), 'must import a real tarball installation');

  write('stylelint.config.mjs', `import { createProtoConfig } from '@protoapps/stylelint-config';
export default createProtoConfig({
  config: { ignoreFiles: ['custom-output/**'] },
});
`);

  write('src/Valid.css', '.Valid { color: #ffffff; }\n');
  write('src/Valid.vue', '<style scoped>.Valid { color: v-bind(color); }</style>\n');
  write('custom-output/Bad.css', '.bad { nonexistent-property: 1; }\n');

  write('check-ignores.mjs', `import assert from 'node:assert/strict';
import { join, relative } from 'node:path';
import stylelint from 'stylelint';
const root = import.meta.dirname;
const result = await stylelint.lint({
  files: join(root, '**/*.{css,vue}').replaceAll('\\\\', '/'),
  configFile: join(root, process.argv[2]),
  cwd: process.cwd(),
  cacheLocation: join(root, '.verification-cache'),
});
assert.equal(result.errored, false, JSON.stringify(result.results.flatMap(item => item.warnings)));
assert.deepEqual(result.results.filter(item => !item.ignored).map(item => relative(root, item.source).replaceAll('\\\\', '/')).sort(),
  ['src/Valid.css', 'src/Valid.vue']);
console.log('Consumer-relative ignoreFiles and CSS/Vue smoke: passed.');
`);

  run(process.execPath, [join(consumer, 'check-ignores.mjs'), 'stylelint.config.mjs'], scratch);
  run(process.execPath, ['node_modules/stylelint/bin/stylelint.mjs', '**/*.{css,vue}'], consumer);

  run('npm', ['install', '--install-strategy=nested', '--ignore-scripts', '--no-audit', '--no-fund', `typescript@${version('typescript')}`, `@types/node@${version('@types/node')}`], consumer);
  renameSync(join(consumer, 'stylelint.config.mjs'), join(consumer, 'stylelint.config.ts'));

  write('types.ts', `import { createProtoConfig } from '@protoapps/stylelint-config';
import type { BaselineAvailability, BaselineOptions, BemException, BemOptions, ProtoConfigOptions } from '@protoapps/stylelint-config';
import type { Config } from 'stylelint';
const available: BaselineAvailability = 'newly';
const baseline: BaselineOptions = { available };
const exception: BemException = { files: '**/theme.css', ignoreBlocks: ['tok-*'] };
const bem: BemOptions = { exceptions: [exception] };
const options: ProtoConfigOptions = { baseline, bem, config: { ignoreFiles: ['dist/**'] } };
export const config: Config = createProtoConfig(options);
`);

  write('tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ES2023', module: 'NodeNext', strict: true, noEmit: true }, include: ['stylelint.config.ts', 'types.ts'] }));
  run(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], consumer);
  run(process.execPath, ['node_modules/stylelint/bin/stylelint.mjs', '**/*.{css,vue}'], consumer);
  process.stdout.write('Tarball import, declarations, TS config loader, nested dependencies and CSS/Vue CLI: passed.\n');
} finally {
  assert.ok(scratch.startsWith(join(tmpdir(), 'protoapps-stylelint-')));
  rmSync(scratch, { recursive: true, force: true });
}
