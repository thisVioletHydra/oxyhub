import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import noBangCondition from '#rules/no-bang-condition';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';

RuleTester.describe = describe;
RuleTester.it = it;

const dir = path.dirname(url.fileURLToPath(import.meta.url));

async function readSeed(name: 'dirty' | 'whip' | 'gag') {
  return fsPromises.readFile(path.join(dir, `${name}.ts`), 'utf8');
}

const gag = await readSeed('gag');
const dirty = await readSeed('dirty');
const whip = await readSeed('whip');

const tester = new RuleTester({
  languageOptions: {
    parserOptions: {
      lang: 'ts',
    },
  },
});

tester.run('no-bang-condition', noBangCondition as never, {
  valid: [
    {
      name: 'weak boolean stays gagged',
      code: gag,
    },
  ],
  invalid: [
    {
      name: 'pathetic bang gets the whip',
      code: dirty,
      output: whip,
      errors: [{ messageId: 'noBangCondition' }],
    },
  ],
});
