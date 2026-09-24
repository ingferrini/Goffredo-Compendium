export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'packs/**']
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        game: 'readonly',
        Hooks: 'readonly',
        ui: 'readonly',
        URL: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', {argsIgnorePattern: '^_'}]
    }
  }
];
