import { fileURLToPath } from 'node:url';
import type { Config } from 'stylelint';
import type { BaselineAvailability, BemException, ProtoConfigOptions } from './types.js';

function resolvePackage(name: string): string {
  return fileURLToPath(import.meta.resolve(name));
}

function asArray<T>(value: T | Array<T> | undefined): Array<T> {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function bemRule(ignoreBlocks: BemException['ignoreBlocks']) {
  return [true, {
    separators: { element: '__', modifier: '_', modifierValue: '_' },
    patterns: {
      block: 'PASCAL_CASE',
      element: 'CAMEL_CASE',
      modifierName: 'CAMEL_CASE',
      modifierValue: 'CAMEL_CASE_NUMERIC',
    },
    ignoreBlocks: [
      /^[A-Z][A-Za-z0-9]*-(?:enter|leave)-(?:from|active|to)$/,
      ...ignoreBlocks,
    ],
  }];
}

function baselineRule(available: BaselineAvailability = 'widely') {
  if (available !== 'widely' && available !== 'newly'
    && (typeof available !== 'number' || !Number.isFinite(available) || !Number.isInteger(available) || available <= 0)) {
    throw new TypeError('baseline.available must be widely, newly, or a finite positive integer year.');
  }

  return [true, { available }];
}

export function createProtoConfig({ baseline, bem, config = {} }: ProtoConfigOptions = {}): Config {
  return {
    reportDescriptionlessDisables: true,
    reportInvalidScopeDisables: true,
    reportNeedlessDisables: true,
    ...config,
    extends: [
      fileURLToPath(new URL('./base.js', import.meta.url)),
      resolvePackage('stylelint-config-standard-vue'),
      ...asArray(config.extends),
    ],
    plugins: [
      resolvePackage('@morev/stylelint-plugin'),
      resolvePackage('stylelint-declaration-block-no-ignored-properties'),
      resolvePackage('stylelint-plugin-use-baseline'),
      ...asArray(config.plugins),
    ],
    rules: {
      'selector-class-pattern': null,
      '@morev/bem/selector-pattern': bemRule([]),
      'color-hex-length': 'long',
      'custom-property-empty-line-before': null,
      'selector-no-invalid': true,
      'selector-no-unmatchable': true,
      'selector-no-deprecated': true,
      'no-unknown-animations': true,
      'plugin/declaration-block-no-ignored-properties': true,
      'plugin/use-baseline': baselineRule(baseline?.available),
      ...config.rules,
    },
    overrides: [{
      files: ['**/*.vue'],
      customSyntax: resolvePackage('postcss-html'),
    }, ...(bem?.exceptions ?? []).map(({ files, ignoreBlocks }) => ({
      files,
      rules: { '@morev/bem/selector-pattern': bemRule(ignoreBlocks) },
    })), ...(config.overrides ?? [])],
  };
}

export type { BaselineAvailability, BaselineOptions, BemException, BemOptions, ProtoConfigOptions } from './types.js';
