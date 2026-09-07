import recommended from './src/origin/config.ts';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';

const root = path.dirname(url.fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const json = `${JSON.stringify(recommended, null, 2)}\n`;

await fsPromises.mkdir(dist, { recursive: true });
await fsPromises.writeFile(path.join(dist, 'recommended.json'), json);
await fsPromises.writeFile(
  path.join(dist, 'config.js'),
  `export default ${JSON.stringify(recommended)};\n`,
);
await fsPromises.writeFile(
  path.join(dist, 'config.d.ts'),
  `import type { OxlintConfig } from 'oxlint';\n\ndeclare const recommended: OxlintConfig;\nexport default recommended;\n`,
);
