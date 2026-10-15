import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

// Apps Script services. Pure modules must not touch these so they stay unit-testable.
const APPS_SCRIPT_GLOBALS = [
  'SpreadsheetApp',
  'CalendarApp',
  'Calendar',
  'Utilities',
  'Session',
  'PropertiesService',
  'LockService',
  'ScriptApp',
  'Logger',
  'HtmlService',
  'Browser',
];

const noNetwork = {
  name: 'UrlFetchApp',
  message: 'No network calls: all data stays in the user’s Google account (see docs/SPEC.md §1).',
};

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-restricted-globals': ['error', noNetwork],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/core/**', 'src/content/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        noNetwork,
        ...APPS_SCRIPT_GLOBALS.map((name) => ({
          name,
          message: 'core/ and content/ must stay pure. Move Apps Script calls into src/gas/.',
        })),
      ],
    },
  },
  prettier,
);
