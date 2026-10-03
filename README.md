# @protoapps/stylelint-config

Shared Stylelint config for Protoapps CSS and Vue projects.

## Installation

```sh
npm install --save-dev @protoapps/stylelint-config stylelint@^17.15.0
```

Requires Node `^22.22.2 || ^24.15.0 || >=26.0.0`.

For `stylelint.config.ts`, TypeScript must also be installed.

## Usage

```ts
import { createProtoConfig } from '@protoapps/stylelint-config';

export default createProtoConfig();
```

## Baseline

CSS compatibility defaults to Baseline Widely Available.

```ts
export default createProtoConfig({
  baseline: {
    available: 'newly',
  },
});
```

`available` accepts `widely`, `newly`, or a numeric Baseline year.

## BEM exceptions

Use BEM exceptions for third-party class namespaces:

```ts
export default createProtoConfig({
  bem: {
    exceptions: [
      {
        files: ['src/integrations/Theme.css'],
        ignoreBlocks: ['tok-*', /^vendor-/],
      },
    ],
  },
});
```

The shared BEM grammar remains enabled for all other classes in the matched files.

## Stylelint config

Pass project-specific Stylelint configuration through `config`:

```ts
export default createProtoConfig({
  config: {
    ignoreFiles: ['dist/**'],
    rules: {
      'comment-empty-line-before': null,
    },
  },
});
```

`config` uses the native Stylelint `Config` type, including `overrides`, plugins, custom syntax and other Stylelint options.

Generated-file ignores belong to the consumer.

## Astro

Astro integration stays in the consumer:

```ts
export default createProtoConfig({
  config: {
    ignoreFiles: ['dist/**', '.astro/**'],
    overrides: [
      {
        files: ['**/*.astro'],
        extends: ['stylelint-config-html/astro'],
      },
    ],
  },
});
```

Install `stylelint-config-html`, `postcss-html` and `postcss` in the Astro project.
