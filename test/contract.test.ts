import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import stylelint from 'stylelint';
import { createProtoConfig } from '../dist/index.js';
import type { Config, Rule } from 'stylelint';

const bemRule = '@morev/bem/selector-pattern';
const baselineRule = 'plugin/use-baseline';

async function warnings(code: string, filename = 'Sample.css', config: Config = createProtoConfig()) {
  const result = await stylelint.lint({
    code,
    codeFilename: join(process.cwd(), filename),
    config,
    cacheLocation: join(process.cwd(), 'node_modules/.cache/contract-stylelint'),
  });

  assert.deepEqual(result.results.flatMap((item) => item.invalidOptionWarnings), []);
  assert.deepEqual(result.results.flatMap((item) => item.parseErrors), []);

  return result.results.flatMap((item) => item.warnings);
}

void test('Baseline options map to rule settings and invalid years are rejected', () => {
  assert.deepEqual(createProtoConfig().rules?.[baselineRule], [true, { available: 'widely' }]);

  for (const available of ['newly', 2024] as const) {
    assert.deepEqual(createProtoConfig({ baseline: { available } }).rules?.[baselineRule], [true, { available }]);
  }

  for (const available of [0, -1, 2024.5, NaN, Infinity, -Infinity, '2024']) {
    assert.throws(
      () => Reflect.apply(createProtoConfig, undefined, [{ baseline: { available } }]),
      /finite positive integer year/u,
    );
  }
});

void test('Vue composition permits v-bind while keeping function validation enabled', async () => {
  assert.deepEqual(await warnings('<style scoped>.Card { color: v-bind(color); }</style>', 'Card.vue'), []);
  const errors = await warnings('<style scoped>.Card { color: mystery(red); }</style>', 'Card.vue');
  assert.ok(errors.some((item) => item.rule === 'function-no-unknown'));
});

void test('BEM policy enforces casing and entity grammar with Vue transition exceptions', async () => {
  const valid = ['Card', 'Card__item_size_2', 'Card-enter-active', 'Card-leave-to'];
  assert.deepEqual(await warnings(valid.map((name) => `.${name} { color: red; }`).join('\n\n')), []);

  for (const name of ['card', 'Card__Title', 'Card_Active', 'Card_size_very-large']) {
    const errors = await warnings(`.${name} { color: red; }`);
    assert.deepEqual(errors.map((item) => item.rule), [bemRule], name);
  }
});

void test('BEM exceptions preserve policy, isolate scopes and replace overlapping exceptions', async () => {
  const config = createProtoConfig({
    bem: { exceptions: [
      { files: ['**/theme.css'], ignoreBlocks: ['tok-*'] },
      { files: '**/overlap.css', ignoreBlocks: ['tok-*'] },
      { files: '**/overlap.css', ignoreBlocks: [/^vendor-/] },
    ] },
  });

  for (const [filename, name, allowed] of [
    ['theme.css', 'tok-string', true],
    ['other.css', 'tok-string', false],
    ['overlap.css', 'tok-string', false],
    ['overlap.css', 'vendor-icon', true],
    ['overlap.css', 'Card__Title', false],
    ['overlap.css', 'Card-enter-active', true],
  ] as const) {
    const errors = await warnings(`.${name} { color: red; }`, filename, config);
    assert.equal(errors.some((item) => item.rule === bemRule), !allowed, `${filename}: ${name}`);
  }
});

void test('consumer extends keep internal presets and root rules replace complete settings', async () => {
  const extension = fileURLToPath(new URL('./fixtures/native/preset.cjs', import.meta.url));

  for (const extensions of [extension, [extension]]) {
    const config = createProtoConfig({
      baseline: { available: 2024 },
      config: {
        extends: extensions,
        rules: {
          [baselineRule]: [true, { available: 'newly' }],
          'function-no-unknown': [true, { ignoreFunctions: ['custom'] }],
        },
      },
    });

    const resolved = await stylelint.resolveConfig('Sample.vue', { config });
    assert.ok(resolved?.rules !== undefined);
    assert.deepEqual(resolved.rules['color-named'], ['never']);
    assert.deepEqual(resolved.rules['color-hex-length'], ['long']);
    assert.deepEqual(resolved.rules[baselineRule], [true, { available: 'newly' }]);
    assert.deepEqual(resolved.rules['function-no-unknown'], [true, { ignoreFunctions: ['custom'] }]);
  }
});

void test('native consumer overrides follow internal Vue and generated BEM overrides', async () => {
  const config = createProtoConfig({
    bem: { exceptions: [{ files: ['**/*.vue'], ignoreBlocks: ['tok-*'] }] },
    config: {
      rules: { [bemRule]: null },
      overrides: [{ name: 'Final consumer policy', files: '**/Local.vue', rules: { [bemRule]: null } }],
    },
  });

  assert.deepEqual(await warnings('<style>.any-name { color: v-bind(color); }</style>', 'Local.vue', config), []);
  assert.deepEqual(await warnings('<style>.tok-string { color: v-bind(color); }</style>', 'Other.vue', config), []);
  assert.ok((await warnings('<style>.any-name { color: red; }</style>', 'Other.vue', config)).some((item) => item.rule === bemRule));
  assert.equal(config.overrides?.at(-1)?.name, 'Final consumer policy');
});

void test('native root and named override fields reach Stylelint alongside package plugins', async () => {
  const ruleName = 'contract/marker';

  const rule: Rule = Object.assign(
    (): ReturnType<Rule> => (root, result) => {
      stylelint.utils.report({ ruleName, result, node: root, message: 'Consumer plugin executed', index: 0, endIndex: 1 });
    },
    { ruleName, messages: { rejected: 'Consumer plugin executed' } },
  );

  const plugin = stylelint.createPlugin(ruleName, rule);

  const fields: Config = {
    referenceFiles: [fileURLToPath(new URL('./fixtures/native/reference.css', import.meta.url))],
    languageOptions: { syntax: { units: { length: ['contract-unit'] } } },
    customSyntax: fileURLToPath(import.meta.resolve('postcss-html')),
    rules: { [ruleName]: true },
  };

  for (const config of [
    createProtoConfig({ config: { ...fields, plugins: plugin } }),
    createProtoConfig({ config: { overrides: [{ ...fields, name: 'Native integration', files: '**/*.html', plugins: [plugin] }] } }),
  ]) {
    const errors = await warnings('<style>.bad-name {\n  width: 1contract-unit;\n  animation: referenced 1s;\n}</style>', 'Sample.html', config);
    assert.deepEqual(errors.map((item) => item.rule).sort(), [bemRule, ruleName].sort());
  }
});

void test('consumer ignoreFiles and other native root fields pass through unchanged', async () => {
  for (const ignoreFiles of ['custom-output/**', ['custom-output/**']]) {
    const config = createProtoConfig({ config: { ignoreFiles, defaultSeverity: 'warning' } });
    const result = await stylelint.lint({ code: '.bad-name { color: red; }', codeFilename: join(process.cwd(), 'custom-output/Bad.css'), config });
    assert.equal(result.results[0].ignored, true);
    const errors = await warnings('.bad-name { color: red; }', 'Sample.css', config);
    assert.equal(errors.find((item) => item.rule === bemRule)?.severity, 'warning');
  }
});
