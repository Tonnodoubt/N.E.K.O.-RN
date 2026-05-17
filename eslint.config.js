// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const nativeConfig = require('eslint-config-universe/flat/native');

module.exports = defineConfig([
  ...nativeConfig,
  {
    // React Native uses the automatic JSX runtime.
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
    },
  },
  {
    ignores: ['dist/*'],
  },
]);
