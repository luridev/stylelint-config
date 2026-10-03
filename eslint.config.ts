import { createProtoConfig } from '@protoapps/eslint-config';

export default createProtoConfig(
  { tsconfigRootDir: import.meta.dirname },
  { ignores: ['dist/**', 'test/fixtures/**'] },
  {
    files: ['test/contract.test.ts', 'test/types.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': 'off',
    },
  },
  {
    files: ['src/index.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', {
        patterns: [{ group: ['./**', '../**'], allowTypeImports: true }],
      }],
    },
  },
);
