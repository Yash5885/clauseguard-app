export default [
  { ignores: ['node_modules/**', 'coverage/**'] },
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs' },
    rules: { 'no-unreachable': 'error', 'no-constant-condition': 'error', 'no-dupe-keys': 'error' },
  },
];
