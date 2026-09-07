import { defineConfig } from 'oxlint';

import oxyhub from '@oxyhub/oxlint-plugin/config';

export default defineConfig({
  extends: [oxyhub],
  ignorePatterns: [
    'dist/**',
    'node_modules/**',
    'src/painRoom/**/dirty.ts',
    'src/painRoom/**/whip.ts',
    'src/painRoom/**/gag.ts',
    'src/arthouse/dist/**',
    'src/arthouse/snap/**',
    'src/arthouse/seeds/**',
  ],
  rules: {
    'oxyhub/prefer-object-arrow-method': 'off',
  },
});
