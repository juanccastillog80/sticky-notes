import js from '@eslint/js';
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  // `.wayfinder/` holds local, git-ignored planning artifacts.
  globalIgnores(['dist', 'coverage', '.wayfinder', 'public/mockServiceWorker.js']),
  {
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      reactHooks.configs.flat['recommended-latest'],
      comments.recommended,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // `modified` counts a whole `switch` once.
      complexity: ['error', { max: 10, variant: 'modified' }],
      // Every eslint-disable must say why: `// eslint-disable-line rule -- reason`.
      '@eslint-community/eslint-comments/require-description': 'error',
    },
  },
  prettier,
]);
