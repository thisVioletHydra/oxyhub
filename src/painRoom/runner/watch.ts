import type { WhipReport } from './types.ts';

import { parseTscDiagnostics, reasonOf } from './diagnostics.ts';
import { exists } from './fs.ts';
import { ansi, fileLink, hitLink, log, paint, spinner } from './log.ts';
import { arthouseDir, once, originDir, root } from './paths.ts';
import { run } from './run.ts';
import { snapshot, writeArthouseTsconfig } from './workspace.ts';

import fs from 'node:fs';
import path from 'node:path';

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

export async function waitForHands(paths: string[]) {
  const targets: string[] = [];
  for (const filePath of paths) {
    if (await exists(filePath)) {
      targets.push(filePath);
    }
  }
  if (targets.length === 0 && await exists(arthouseDir)) {
    targets.push(arthouseDir);
  }

  return new Promise<void>((resolve) => {
    let armed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const watchers: Array<ReturnType<typeof fs.watch>> = [];
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
      watchers.push(fs.watch(target, { recursive: true }, (_event, filename) => {
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
      if (!(await exists(path.join(arthouseDir, 'index.ts')))) {
        return;
      }
      await writeArthouseTsconfig();
    }
    spinner.start(`punish  tsc ${kind}`);
    const tsconfig = kind === 'origin'
      ? path.join(root, 'tsconfig.json')
      : path.join(arthouseDir, 'tsconfig.json');
    const report = await runTsc(tsconfig);
    spinner.stop();
    if (report.kind === 'clean') {
      log('  tsc clean');
      if (kind === 'arthouse') {
        await snapshot();
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
      ? path.join(root, report.diagnostics[0].filename)
      : kind === 'origin'
        ? originDir
        : arthouseDir;
    await waitForHands([
      hitAbs,
      kind === 'origin' ? originDir : arthouseDir,
    ]);
  }
}
