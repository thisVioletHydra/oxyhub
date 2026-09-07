import type { RuleItem, WhipReport } from './types.ts';

import { listPluginTs } from './copy.ts';
import { oxyhubOnly, parseDiagnostics } from './diagnostics.ts';
import { log, spinner } from './log.ts';
import { arthouseDir, configPath, oxlintBin } from './paths.ts';
import { run } from './run.ts';
import { runSeeds } from './seeds.ts';
import { writePunishConfig } from './workspace.ts';

import path from 'node:path';

export {
  blockUntilTypesGreen,
  printBlocker,
  waitForHands,
  waitUntilSigint,
} from './watch.ts';

export async function buildRootDist() {
  spinner.start('punish  build dist');
  const result = await run('pnpm', ['build']);
  spinner.stop();
  if (result.status !== 0) {
    log('dist build failed');
    log((result.stderr || result.stdout).slice(0, 800));
    process.exit(1);
  }
  log('dist rebuilt. restart oxc LSP.');
}

async function buildPlugin(entry: string) {
  return run('pnpm', [
    'exec',
    'tsdown',
    entry,
    '--no-config',
    '-d',
    'src/arthouse/dist',
    '-f',
    'esm',
    '--logLevel',
    'error',
    '--no-dts',
  ]);
}

async function runOxlint(rule: RuleItem, fix: boolean): Promise<WhipReport> {
  await writePunishConfig(rule);
  const files = (await listPluginTs(arthouseDir)).map(rel => path.join('src/arthouse', rel));
  if (files.length === 0) {
    return { kind: 'crash', diagnostics: [], stderr: 'arthouse has no plugin files' };
  }

  const result = await run(oxlintBin, [
    ...(fix ? ['--fix'] : []),
    '--format',
    'json',
    '--disable-nested-config',
    '--no-ignore',
    ...files,
    '-c',
    configPath,
  ]);
  const parsed = parseDiagnostics(result.stdout);
  const failedLoad = /Failed to load JS plugin|Failed to parse oxlint|No files found to lint/i.test(
    `${result.stdout}\n${result.stderr}`,
  );
  if (parsed === null || failedLoad || (result.status !== 0 && result.status !== 1)) {
    return {
      kind: 'crash',
      diagnostics: [],
      stderr: result.stderr || result.stdout,
    };
  }

  const filesMatch = /"number_of_files":\s*(\d+)/.exec(result.stdout);
  const fileCount = filesMatch ? Number(filesMatch[1]) : -1;
  if (fileCount === 0) {
    return {
      kind: 'crash',
      diagnostics: [],
      stderr: 'oxlint saw 0 files in arthouse',
    };
  }

  const diagnostics = oxyhubOnly(parsed);
  if (diagnostics.length === 0) {
    return { kind: 'clean', diagnostics, stderr: result.stderr };
  }

  return { kind: 'dirty', diagnostics, stderr: result.stderr };
}

export async function whip(rule: RuleItem, label: string, pluginEntry: string): Promise<WhipReport> {
  log(`── ${label} ──`);
  spinner.start(`${label}  seeds`);
  const seeded = await runSeeds(rule.id);
  spinner.stop();
  if (seeded.kind !== 'clean') {
    log(`  seeds ${seeded.kind}`);
    return seeded;
  }

  spinner.start(`${label}  bundle`);
  const bundled = await buildPlugin(pluginEntry);
  if (bundled.status !== 0) {
    return { kind: 'crash', diagnostics: [], stderr: bundled.stderr || bundled.stdout };
  }

  spinner.start(`${label}  check`);
  const found = await runOxlint(rule, false);
  spinner.stop();
  if (found.kind === 'crash') {
    log('  oxlint crash');
    log(found.stderr.slice(0, 400));
    return found;
  }
  if (found.kind !== 'dirty') {
    log('  oxlint clean');
    return found;
  }

  spinner.start(`${label}  --fix`);
  const fixed = await runOxlint(rule, true);
  spinner.stop();
  log(`  ${found.diagnostics.length} hits · --fix ${fixed.kind} · ${fixed.diagnostics.length} leftover`);

  return fixed;
}
