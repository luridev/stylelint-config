import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRunner, lintPackage, packPackage, withTemporaryDirectory } from '@protoapps/package-verifier';

type PackageManifest = {
  version: string;
  exports: Record<string, { types: string; default: string }>;
  dependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
};

type PackageLock = {
  packages: Record<string, unknown>;
};

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const runner = createRunner({ cwd: root, output: 'inherit', timeout: 600_000 });

function version(name: string): string {
  const manifest = JSON.parse(readFileSync(require.resolve(`${name}/package.json`), 'utf8')) as Pick<PackageManifest, 'version'>;

  return manifest.version;
}

await withTemporaryDirectory(async (scratch) => {
  const consumer = join(scratch, 'consumer');

  function write(name: string, content: string) {
    const target = join(consumer, name);

    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }

  assert.ok(relative(root, scratch).startsWith('..'), 'consumer must be outside the workspace');

  const { path: archive } = await packPackage({ cwd: root, destination: scratch, runner });
  await lintPackage(archive);
  write('package.json', JSON.stringify({ name: 'packed-stylelint-consumer', private: true, type: 'module' }));
  runner.npm(['install', '--install-strategy=nested', '--ignore-scripts', '--no-audit', '--no-fund', archive, `stylelint@${version('stylelint')}`], { cwd: consumer });
  runner.npm(['ls', '--all'], { cwd: consumer });
  const installed = realpathSync(join(consumer, 'node_modules/@protoapps/stylelint-config'));

  assert.ok(installed.startsWith(realpathSync(consumer)), 'must import a real tarball installation');
  const manifest = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8')) as PackageManifest;
  const localManifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as PackageManifest;

  assert.deepEqual(manifest.exports, { '.': { types: './dist/index.d.ts', default: './dist/index.js' } });
  assert.deepEqual(manifest.dependencies, localManifest.dependencies);
  assert.deepEqual(manifest.peerDependencies, { stylelint: localManifest.peerDependencies.stylelint });
  assert.deepEqual(manifest.optionalDependencies ?? {}, {});
  assert.deepEqual(manifest.peerDependenciesMeta ?? {}, {});
  const lock = JSON.parse(readFileSync(join(consumer, 'package-lock.json'), 'utf8')) as PackageLock;

  for (const name of ['@protoapps/package-verifier', '@protoapps/eslint-config', 'eslint', '@vitest/eslint-plugin', 'vitest', 'jiti', 'typescript']) {
    assert.ok(!Object.keys(lock.packages).some((path) => path.endsWith(`node_modules/${name}`)),
      `Unexpected runtime dependency: ${name}`);
  }

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

  runner.node([join(consumer, 'check-ignores.mjs'), 'stylelint.config.mjs'], { cwd: scratch });
  runner.node(['node_modules/stylelint/bin/stylelint.mjs', '**/*.{css,vue}'], { cwd: consumer });

  runner.npm(['install', '--install-strategy=nested', '--ignore-scripts', '--no-audit', '--no-fund', `typescript@${version('typescript')}`, `@types/node@${version('@types/node')}`], { cwd: consumer });
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
  runner.node(['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], { cwd: consumer });
  runner.node(['node_modules/stylelint/bin/stylelint.mjs', '**/*.{css,vue}'], { cwd: consumer });
  process.stdout.write('Tarball import, declarations, TS config loader, nested dependencies and CSS/Vue CLI: passed.\n');
}, { prefix: 'protoapps-stylelint-' });
