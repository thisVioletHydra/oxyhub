import recommended from './config.ts';
import fsPromises from 'node:fs/promises';

const json = `${JSON.stringify(recommended, null, 2)}\n`;

await fsPromises.mkdir(new URL('../../dist', import.meta.url), { recursive: true });
await fsPromises.writeFile(new URL('../../dist/recommended.json', import.meta.url), json);
await fsPromises.writeFile(
  new URL('../../dist/config.js', import.meta.url),
  `export default ${JSON.stringify(recommended)};\n`,
);
await fsPromises.writeFile(
  new URL('../../dist/config.d.ts', import.meta.url),
  `import type { OxlintConfig } from 'oxlint';\n\ndeclare const recommended: OxlintConfig;\nexport default recommended;\n`,
);
