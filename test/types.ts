import { createProtoConfig } from '../src/index.js';
import type { Config } from 'stylelint';
import type { BaselineAvailability, BaselineOptions, BemException, BemOptions, ProtoConfigOptions } from '../src/index.js';

const available: BaselineAvailability = 2024;
const baseline: BaselineOptions = { available };
const exception: BemException = { files: '**/theme.css', ignoreBlocks: ['tok-*', /^vendor-/] };
const bem: BemOptions = { exceptions: [exception] };

const config: Config = {
  ignoreFiles: ['dist/**'],
  referenceFiles: ['reference.css'],
  languageOptions: { syntax: { units: { length: ['custom-unit'] } } },
  overrides: [{ name: 'Native integration', files: '**/*.html', customSyntax: 'postcss-html' }],
};

const options = { baseline, bem, config } satisfies ProtoConfigOptions;

createProtoConfig();
createProtoConfig({ baseline });
createProtoConfig({ bem });
createProtoConfig({ config });
createProtoConfig(options);

// @ts-expect-error Unknown package option.
createProtoConfig({ unknown: true });
// @ts-expect-error Removed property allowlist.
createProtoConfig({ baseline: { ignoreProperties: ['resize'] } });
// @ts-expect-error A numeric year is not a string.
createProtoConfig({ baseline: { available: '2024' } });
// @ts-expect-error A BEM exception requires a file scope.
createProtoConfig({ bem: { exceptions: [{ ignoreBlocks: ['tok-*'] }] } });
// @ts-expect-error Native Config is an object.
createProtoConfig({ config: 'standard' });
