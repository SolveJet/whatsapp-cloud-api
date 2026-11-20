import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist', 'coverage', 'node_modules'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
  {
    // Render script: Node globals plus browser globals used inside page.evaluate.
    files: ['docs/assets/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', URL: 'readonly', window: 'readonly', document: 'readonly' },
    },
  },
  eslintConfigPrettier,
);
