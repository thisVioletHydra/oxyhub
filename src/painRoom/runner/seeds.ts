import type { WhipReport } from './types.ts';

import { exists } from './fs.ts';
import { arthouseDir, prefix, ruleWorker, seedsDir } from './paths.ts';

import fsPromises from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import { RuleTester } from 'oxlint/plugins-dev';

export async function runSeeds(id: string): Promise<WhipReport> {
  const seedRoot = path.join(seedsDir, id);
  if (!(await exists(path.join(seedRoot, 'dirty.ts')))) {
    return { kind: 'clean', diagnostics: [], stderr: '' };
  }

  const rulePath = ruleWorker(arthouseDir, id);
  if (!(await exists(rulePath))) {
    return { kind: 'crash', diagnostics: [], stderr: 'missing worker' };
  }

  const imported = await import(url.pathToFileURL(rulePath).href) as { default: unknown };
  const dirty = await fsPromises.readFile(path.join(seedRoot, 'dirty.ts'), 'utf8');
  const whipPath = path.join(seedRoot, 'whip.ts');
  const gagPath = path.join(seedRoot, 'gag.ts');
  const valid = await exists(gagPath)
    ? [{ name: 'gag', code: await fsPromises.readFile(gagPath, 'utf8') }]
    : [];

  RuleTester.describe = ((_name: string, fn: () => void) => {
    fn();
  }) as typeof RuleTester.describe;
  RuleTester.it = ((_name: string, fn: () => void) => {
    fn();
  }) as typeof RuleTester.it;

  const tester = new RuleTester({
    languageOptions: {
      parserOptions: {
        lang: 'ts',
      },
    },
  });

  try {
    tester.run(id, imported.default as never, {
      valid,
      invalid: [{
        name: 'dirty',
        code: dirty,
        output: await exists(whipPath) ? await fsPromises.readFile(whipPath, 'utf8') : null,
        errors: 1,
      }],
    });

    return { kind: 'clean', diagnostics: [], stderr: '' };
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      kind: 'dirty',
      diagnostics: [{ severity: 'error', code: `${prefix}(${id})`, message }],
      stderr: message,
    };
  }
}
