import { fileURLToPath } from 'node:url';
import type { Config } from 'stylelint';

export default {
  extends: fileURLToPath(import.meta.resolve('stylelint-config-standard')),
  rules: {
    'function-no-unknown': true,
  },
} satisfies Config;
