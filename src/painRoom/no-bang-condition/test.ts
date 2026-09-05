import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';
import noBangCondition from '#rules/no-bang-condition';

RuleTester.describe = describe;
RuleTester.it = it;

const dir = dirname(fileURLToPath(import.meta.url));

function readSeed(name: 'dirty' | 'whip' | 'gag') {
  return readFileSync(join(dir, `${name}.ts`), 'utf8');
}

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
      code: readSeed('gag'),
    },
  ],
  invalid: [
    {
      name: 'pathetic bang gets the whip',
      code: readSeed('dirty'),
      output: readSeed('whip'),
      errors: [{ messageId: 'noBangCondition' }],
    },
  ],
});
