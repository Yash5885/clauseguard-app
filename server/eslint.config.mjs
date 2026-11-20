export default [
  { ignores: ['node_modules/**', 'coverage/**'] },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: Object.fromEntries(
        [
          'process',
          'console',
          'Buffer',
          '__dirname',
          '__filename',
          'setTimeout',
          'clearTimeout',
          'setImmediate',
          'URL',
          'describe',
          'test',
          'expect',
          'jest',
          'beforeAll',
          'afterAll',
          'beforeEach',
          'afterEach',
        ].map((name) => [name, 'readonly']),
      ),
    },
    rules: {
      'no-unreachable': 'error',
      'no-constant-condition': 'error',
      'no-dupe-keys': 'error',
      'no-undef': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
];
