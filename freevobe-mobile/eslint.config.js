// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // `.expo` innehåller filer som Expo genererar själv (rutter, typer) – de ska inte lintas.
    ignores: ['dist/*', 'dist-ios/*', 'dist-android/*', '.expo/*'],
  },
  {
    // Expo-paketen vidareexporterar sina typer med `export *`, vilket eslint-plugin-import inte
    // följer med standardresolvern. Med TypeScript-resolvern hittas de riktiga exporterna (t.ex.
    // Notifications.AndroidImportance) i stället för att felaktigt flaggas som saknade.
    settings: {
      'import/resolver': {
        typescript: { alwaysTryTypes: true, project: './tsconfig.json' },
        node: true,
      },
    },
  },
]);
