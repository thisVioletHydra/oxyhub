import { existsSync, readFileSync, watch } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RuleTester } from 'oxlint/plugins-dev';

import { ansi, fileLink, hitLink, log, paint, spinner } from './log.ts';
import {
  arthouseDir,
  configPath,
  once,
  originDir,
  oxlintBin,
  prefix,
  root,
  ruleWorker,
  seedsDir,
} from './paths.ts';
import { run } from './run.ts';
import type { Diagnostic, RuleItem, WhipReport } from './types.ts';
import {
  copySeeds,
  listPluginTs,
  snapshot,
  writeArthouseTsconfig,
  writePunishConfig,
} from './workspace.ts';

function parseDiagnostics(stdout: string) {
  const trimmed = stdout.trim();
  const start = trimmed.indexOf('{');
  if (start < 0) {
    return null;
  }
  try {
    const payload = JSON.parse(trimmed.slice(start)) as { diagnostics?: Diagnostic[] };
    return Array.isArray(payload.diagnostics) ? payload.diagnostics : [];
  }
  catch {
    return null;
  }
}

function oxyhubOnly(diagnostics: Diagnostic[]) {
  return diagnostics.filter(item => String(item.code ?? '').startsWith(`${prefix}(`));
}

function reasonOf(report: WhipReport) {
  if (report.kind === 'crash') {
    return 'plugin crash';
  }
  const first = report.diagnostics[0];
  if (!first) {
    return 'error leftover';
  }
  const severity = first.severity === 'warning' ? 'warning' : 'error';
  const code = String(first.code ?? 'leftover').replace(/^oxyhub\((.+)\)$/, '$1');
  return `${severity} ${code}`;
}

function parseTscDiagnostics(stdout: string, stderr: string) {
  const diagnostics: Diagnostic[] = [];
  const header = /^(.+)\((\d+),(\d+)\): error TS(\d+): (.*)$/;
  let current: Diagnostic | null = null;

  for (const line of `${stdout}\n${stderr}`.split('\n')) {
    const match = header.exec(line);
    if (match) {
      if (current) {
        diagnostics.push(current);
      }
      const file = match[1].trim().replaceAll('\\', '/');
      current = {
        message: match[5],
        code: `TS${match[4]}`,
        severity: 'error',
        filename: file.startsWith(root) ? relative(root, file) : file,
        labels: [{ span: { line: Number(match[2]), column: Number(match[3]) } }],
      };
      continue;
    }
    if (current && /^\s{2}\S/.test(line)) {
      current.message = `${current.message ?? ''} ${line.trim()}`.trim();
    }
  }

  if (current) {
    diagnostics.push(current);
  }
  return diagnostics;
}

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

async function runSeeds(id: string): Promise<WhipReport> {
  const seedRoot = join(seedsDir, id);
  if (!existsSync(join(seedRoot, 'dirty.ts'))) {
    return { kind: 'clean', diagnostics: [], stderr: '' };
  }

  const rulePath = ruleWorker(arthouseDir, id);
  if (!existsSync(rulePath)) {
    return { kind: 'crash', diagnostics: [], stderr: 'missing worker' };
  }

  const imported = await import(pathToFileURL(rulePath).href) as { default: unknown };
  const dirty = readFileSync(join(seedRoot, 'dirty.ts'), 'utf8');
  const whipPath = join(seedRoot, 'whip.ts');
  const gagPath = join(seedRoot, 'gag.ts');
  const valid = existsSync(gagPath)
    ? [{ name: 'gag', code: readFileSync(gagPath, 'utf8') }]
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
        output: existsSync(whipPath) ? readFileSync(whipPath, 'utf8') : null,
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

async function runOxlint(rule: RuleItem, fix: boolean): Promise<WhipReport> {
  writePunishConfig(rule);
  const files = listPluginTs(arthouseDir).map(rel => join('src/arthouse', rel));
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

async function runTsc(tsconfigPath: string): Promise<WhipReport> {
  const result = await run('pnpm', [
    'exec',
    'tsc',
    '--noEmit',
    '--pretty',
    'false',
    '-p',
    tsconfigPath,
  ]);
  if (result.status === 0) {
    return { kind: 'clean', diagnostics: [], stderr: '' };
  }
  const diagnostics = parseTscDiagnostics(result.stdout, result.stderr);
  if (diagnostics.length === 0) {
    return {
      kind: 'crash',
      diagnostics: [],
      stderr: result.stderr || result.stdout,
    };
  }
  return { kind: 'dirty', diagnostics, stderr: result.stderr || result.stdout };
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

export function printBlocker(
  title: string,
  report: WhipReport,
  workerPath: string,
  blockerNo?: number,
  total?: number,
) {
  spinner.stop();
  const hit = report.diagnostics[0];
  const numbered = blockerNo !== undefined && total !== undefined
    ? ` ${paint(ansi.bold + ansi.yellow, `#${blockerNo}`)}${paint(ansi.dim, `/${total}`)}`
    : '';
  const lines = [
    '',
    `${paint(ansi.bold + ansi.red, 'BLOCKER')}${numbered}  ${title}`,
    `  ${paint(ansi.dim, 'reason')}   ${paint(ansi.yellow, reasonOf(report))}`,
    `  ${paint(ansi.dim, 'leftover')} ${paint(ansi.yellow, String(report.diagnostics.length))}`,
  ];
  if (hit?.filename) {
    lines.push(`  ${paint(ansi.dim, 'hit')}      ${hitLink(hit)}`);
  }
  if (hit?.message) {
    lines.push(`  ${paint(ansi.dim, 'error')}    ${paint(ansi.yellow, hit.message)}`);
  }
  for (const extra of report.diagnostics.slice(1, 6)) {
    lines.push(`  ${paint(ansi.dim, 'also')}     ${extra.filename ? hitLink(extra) : extra.code ?? 'leftover'}`);
    if (extra.message) {
      lines.push(`           ${paint(ansi.yellow, extra.message)}`);
    }
  }
  if (report.diagnostics.length > 6) {
    lines.push(`  ${paint(ansi.dim, 'also')}     +${report.diagnostics.length - 6} more`);
  }
  lines.push(`  ${paint(ansi.dim, 'worker')}   ${fileLink(workerPath)}`);
  lines.push(
    title === 'tsc'
      ? `  ${paint(ansi.magenta, 'зову тебя.')} это tsc. правь hit. очередь стоит.`
      : `  ${paint(ansi.magenta, 'зову тебя.')} правь worker, не жертву. очередь стоит.`,
  );
  if (!once) {
    const paused = blockerNo !== undefined
      ? `watcher paused · blocker #${blockerNo}`
      : 'watcher paused · tsc';
    lines.push(`  ${paint(ansi.cyan, paused)}`);
  }
  process.stderr.write(`${lines.join('\n')}\n\n`);
}

export function waitForHands(paths: string[]) {
  const targets = paths.filter(existsSync);
  if (targets.length === 0 && existsSync(arthouseDir)) {
    targets.push(arthouseDir);
  }

  return new Promise<void>((resolve) => {
    let armed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const watchers: Array<ReturnType<typeof watch>> = [];
    const arm = setTimeout(() => {
      armed = true;
    }, 800);

    const finish = () => {
      clearTimeout(arm);
      for (const watcher of watchers) {
        watcher.close();
      }
      resolve();
    };

    const onChange = (filename: string | null) => {
      if (!armed) {
        return;
      }
      if (filename && (filename.includes('dist') || filename.includes('snap') || filename.includes('seeds'))) {
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(finish, 400);
    };

    for (const target of targets) {
      watchers.push(watch(target, { recursive: true }, (_event, filename) => {
        onChange(filename);
      }));
    }
  });
}

export function waitUntilSigint() {
  spinner.start('watching  Ctrl+C leaves');
  return new Promise<void>(() => {});
}

export async function blockUntilTypesGreen(kind: 'origin' | 'arthouse') {
  while (true) {
    if (kind === 'arthouse') {
      if (!existsSync(join(arthouseDir, 'index.ts'))) {
        return;
      }
      writeArthouseTsconfig();
    }
    spinner.start(`punish  tsc ${kind}`);
    const tsconfig = kind === 'origin'
      ? join(root, 'tsconfig.json')
      : join(arthouseDir, 'tsconfig.json');
    const report = await runTsc(tsconfig);
    spinner.stop();
    if (report.kind === 'clean') {
      log('  tsc clean');
      if (kind === 'arthouse') {
        snapshot();
      }
      return;
    }
    if (report.kind === 'crash') {
      log('  tsc crash');
      log((report.stderr || '').slice(0, 400));
    }
    const hitFile = report.diagnostics[0]?.filename ?? (kind === 'origin' ? 'src/origin' : 'src/arthouse');
    printBlocker('tsc', report, hitFile);
    if (once) {
      process.exit(1);
    }
    const hitAbs = report.diagnostics[0]?.filename
      ? join(root, report.diagnostics[0].filename)
      : kind === 'origin'
        ? originDir
        : arthouseDir;
    await waitForHands([
      hitAbs,
      kind === 'origin' ? originDir : arthouseDir,
    ]);
  }
}
