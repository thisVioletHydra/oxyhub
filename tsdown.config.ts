import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: 'src/origin/index.ts',
  format: ['esm'],
  dts: true,
  fixedExtension: false,
});
