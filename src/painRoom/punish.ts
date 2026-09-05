import { createHash } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  watch,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { RuleTester } from 'oxlint/plugins-dev';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const originDir = join(root, 'src/origin');
const painRoomDir = join(root, 'src/painRoom');
const arthouseDir = join(root, 'src/arthouse');
const snapDir = join(arthouseDir, 'snap');
const seedsDir = join(arthouseDir, 'seeds');
const statePath = join(arthouseDir, 'state.json');
const configPath = join(arthouseDir, '.punish.oxlintrc.json');
const cachePath = join(painRoomDir, '.punish-cache.json');
const oxlintBin = join(root, 'node_modules/.bin/oxlint');
const prefix = 'oxyhub';
const once = process.argv.includes('--once');
const fresh = process.argv.includes('--fresh');
const tty = process.stderr.isTTY === true;

const ansi = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  underline: '\x1b[4m',
  hide: '\x1b[?25l',
  show: '\x1b[?25h',
  clearLine: '\r\x1b[2K',
};

const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

type RuleItem = {
  id: string;
  options: object | undefined;
};

type Diagnostic = {
  message?: string;
  code?: string;
  severity?: string;
  filename?: string;
  labels?: Array<{ span?: { line?: number; column?: number } }>;
};

type WhipReport = {
  kind: 'clean' | 'dirty' | 'crash';
  diagnostics: Diagnostic[];
  stderr: string;
};

type PunishCache = {
  treeHash: string;
  passed: string[];
};

type FileKind = 'index' | 'rule' | 'util' | 'other';

let currentChild: ChildProcess | null = null;

function paint(color: string, text: string) {
  return `${color}${text}${ansi.reset}`;
}

function fileLink(relPath: string, line?: number) {
  const abs = join(root, relPath);
  const shown = line ? `${relPath}:${line}` : relPath;
  const label = paint(`${ansi.bold}${ansi.magenta}${ansi.underline}`, shown);
  if (!tty) {
    return line ? `${abs}:${line}` : abs;
  }
  const href = line ? `${pathToFileURL(abs).href}#${line}` : pathToFileURL(abs).href;
  return `\x1b]8;;${href}\x1b\\${label}\x1b]8;;\x1b\\`;
}

function hitLink(diagnostic: Diagnostic) {
  const file = diagnostic.filename;
  if (!file) {
    return '';
  }
  const line = diagnostic.labels?.[0]?.span?.line;
  return fileLink(file, line);
}

function log(message: string) {
  spinner.stop();
  process.stderr.write(`${message}\n`);
}

const spinner = {
  timer: null as ReturnType<typeof setInterval> | null,
  frame: 0,
  text: '',
  start(text: string) {
    this.text = text;
    if (!tty) {
      return;
    }
    this.stopTimer();
    process.stderr.write(ansi.hide);
    this.timer = setInterval(() => this.render(), 80);
    this.render();
  },
  render() {
    const frame = frames[this.frame++ % frames.length];
    process.stderr.write(`${ansi.clearLine}${paint(ansi.magenta, frame)} ${this.text}`);
  },
  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },
  stop() {
    this.stopTimer();
    if (tty) {
      process.stderr.write(`${ansi.clearLine}${ansi.show}`);
    }
  },
};

function die(code = 130) {
  spinner.stop();
  currentChild?.kill('SIGINT');
  process.exit(code);
}

function run(command: string, args: string[], cwd = root) {
  return new Promise<{ status: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    currentChild = child;
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', (error: Error) => {
      if (currentChild === child) {
        currentChild = null;
      }
      reject(error);
    });
    child.on('close', (code: number | null) => {
      if (currentChild === child) {
        currentChild = null;
      }
      resolve({
        status: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

function listTsFiles(dir: string, base = dir): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...listTsFiles(full, base));
      continue;
    }
    if (name.endsWith('.ts')) {
      out.push(relative(base, full));
    }
  }
  return out;
}

function listPluginTs(dir: string) {
  const out: string[] = [];
  for (const name of ['index.ts', 'plugin-types.ts']) {
    if (existsSync(join(dir, name))) {
      out.push(name);
    }
  }
  for (const folder of ['rules', 'utils']) {
    const full = join(dir, folder);
    if (existsSync(full)) {
      out.push(...listTsFiles(full, dir));
    }
  }
  return out;
}

function fileKind(rel: string): FileKind {
  if (rel === 'index.ts') {
    return 'index';
  }
  if (rel.startsWith(`rules/`) || rel.startsWith('rules\\')) {
    return 'rule';
  }
  if (rel.startsWith(`utils/`) || rel.startsWith('utils\\')) {
    return 'util';
  }
  return 'other';
}

function rewriteHashToRelative(source: string, kind: FileKind) {
  if (kind === 'index') {
    return source
      .replaceAll("from '#plugin-types'", "from './plugin-types'")
      .replaceAll("from '#rules/", "from './rules/");
  }
  if (kind === 'rule') {
    return source
      .replaceAll("from '#plugin-types'", "from '../plugin-types'")
      .replaceAll("from '#utils/", "from '../utils/");
  }
  if (kind === 'util') {
    return source.replaceAll("from '#plugin-types'", "from '../plugin-types'");
  }
  return source;
}

function rewriteRelativeToHash(source: string, kind: FileKind) {
  if (kind === 'index') {
    return source
      .replaceAll("from './plugin-types'", "from '#plugin-types'")
      .replaceAll("from './rules/", "from '#rules/");
  }
  if (kind === 'rule') {
    return source
      .replaceAll("from '../plugin-types'", "from '#plugin-types'")
      .replaceAll("from '../utils/", "from '#utils/");
  }
  if (kind === 'util') {
    return source.replaceAll("from '../plugin-types'", "from '#plugin-types'");
  }
  return source;
}

function writeFileDeep(path: string, contents: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function copyPluginTree(fromDir: string, toDir: string, rewrite: (source: string, kind: FileKind) => string) {
  mkdirSync(toDir, { recursive: true });
  for (const rel of listPluginTs(fromDir)) {
    const kind = fileKind(rel);
    const source = readFileSync(join(fromDir, rel), 'utf8');
    writeFileDeep(join(toDir, rel), rewrite(source, kind));
  }
}

function emptyDir(dir: string) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
  mkdirSync(dir, { recursive: true });
}

function wipeArthouse() {
  if (existsSync(arthouseDir)) {
    rmSync(arthouseDir, { recursive: true, force: true });
  }
}

function wipeCache() {
  if (existsSync(cachePath)) {
    rmSync(cachePath);
  }
}

function originTreeHash() {
  const hash = createHash('sha256');
  const parts: Array<[string, Buffer | string]> = [
    ['.oxlintrc.json', readFileSync(join(root, '.oxlintrc.json'))],
    ...listPluginTs(originDir)
      .sort()
      .map((rel): [string, Buffer] => [rel, readFileSync(join(originDir, rel))]),
  ];
  for (const [name, buf] of parts) {
    hash.update(name);
    hash.update('\0');
    hash.update(buf);
    hash.update('\0');
  }
  return hash.digest('hex');
}

function loadCache(): PunishCache {
  if (!existsSync(cachePath)) {
    return { treeHash: '', passed: [] };
  }
  try {
    const payload = JSON.parse(readFileSync(cachePath, 'utf8')) as PunishCache;
    return {
      treeHash: typeof payload.treeHash === 'string' ? payload.treeHash : '',
      passed: Array.isArray(payload.passed) ? payload.passed.filter(id => typeof id === 'string') : [],
    };
  }
  catch {
    return { treeHash: '', passed: [] };
  }
}

function saveCache(treeHash: string, passed: string[]) {
  writeFileSync(cachePath, `${JSON.stringify({
    treeHash,
    passed,
    updatedAt: new Date().toISOString(),
  }, null, 2)}\n`);
}

function markPassed(treeHash: string, passed: string[], id: string) {
  if (!passed.includes(id)) {
    passed.push(id);
  }
  saveCache(treeHash, passed);
}

function painRoomRuleDirs() {
  return readdirSync(painRoomDir).filter(name => {
    const full = join(painRoomDir, name);
    return statSync(full).isDirectory() && existsSync(join(full, 'dirty.ts'));
  });
}

function copySeeds() {
  emptyDir(seedsDir);
  for (const id of painRoomRuleDirs()) {
    const from = join(painRoomDir, id);
    const to = join(seedsDir, id);
    mkdirSync(to, { recursive: true });
    for (const name of ['dirty.ts', 'whip.ts', 'gag.ts']) {
      const src = join(from, name);
      if (existsSync(src)) {
        writeFileSync(join(to, name), readFileSync(src));
      }
    }
  }
}

function snapshot() {
  emptyDir(snapDir);
  copyPluginTree(arthouseDir, snapDir, source => source);
  writeFileSync(join(snapDir, '.ok'), `${Date.now()}\n`);
}

function restoreSnap() {
  copyPluginTree(snapDir, arthouseDir, source => source);
  copySeeds();
}

function copyOriginToArthouse() {
  emptyDir(arthouseDir);
  copyPluginTree(originDir, arthouseDir, rewriteHashToRelative);
  copySeeds();
}

function promoteArthouseToOrigin() {
  copyPluginTree(arthouseDir, originDir, rewriteRelativeToHash);
}

function readState() {
  if (!existsSync(statePath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(statePath, 'utf8')) as { index: number; ruleId: string };
  }
  catch {
    return null;
  }
}

function writeState(index: number, ruleId: string) {
  writeFileSync(statePath, `${JSON.stringify({ index, ruleId, updatedAt: new Date().toISOString() }, null, 2)}\n`);
}

function listRules(): RuleItem[] {
  const oxlintConfig = JSON.parse(readFileSync(join(root, '.oxlintrc.json'), 'utf8')) as {
    rules?: Record<string, unknown>;
  };
  const seeded = new Set(painRoomRuleDirs());
  const fromFiles = new Set(
    readdirSync(join(originDir, 'rules'))
      .filter(name => name.endsWith('.ts'))
      .map(name => name.slice(0, -3)),
  );
  const rules: RuleItem[] = [];
  const seen = new Set<string>();

  for (const [key, setting] of Object.entries(oxlintConfig.rules ?? {})) {
    if (!key.startsWith(`${prefix}/`)) {
      continue;
    }
    const id = key.slice(prefix.length + 1);
    if (!fromFiles.has(id)) {
      continue;
    }
    seen.add(id);
    if (setting === 'off') {
      continue;
    }
    rules.push({
      id,
      options: Array.isArray(setting) ? setting[1] as object : undefined,
    });
  }

  for (const id of [...seeded].sort()) {
    if (seen.has(id) || !fromFiles.has(id)) {
      continue;
    }
    rules.push({ id, options: undefined });
  }

  return rules;
}

function writePunishConfig(rule: RuleItem) {
  const key = `${prefix}/${rule.id}`;
  const value = rule.options === undefined ? 'error' : ['error', rule.options];
  writeFileSync(configPath, `${JSON.stringify({
    plugins: [],
    jsPlugins: ['./dist/index.mjs'],
    ignorePatterns: ['**/seeds/**', '**/snap/**', '**/dist/**'],
    rules: {
      [key]: value,
    },
  }, null, 2)}\n`);
}

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

async function buildRootDist() {
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
  const result = await run('pnpm', [
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
  if (result.status !== 0) {
    return result;
  }
  return result;
}

async function runSeeds(id: string): Promise<WhipReport> {
  const seedRoot = join(seedsDir, id);
  if (!existsSync(join(seedRoot, 'dirty.ts'))) {
    return { kind: 'clean', diagnostics: [], stderr: '' };
  }

  const rulePath = join(arthouseDir, 'rules', `${id}.ts`);
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
  const failedLoad = /Failed to load JS plugin|Failed to parse oxlint|No files found to lint/i.test(`${result.stdout}\n${result.stderr}`);
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

async function whip(rule: RuleItem, label: string, pluginEntry: string): Promise<WhipReport> {
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
    log(`  oxlint crash`);
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

function parseTscDiagnostics(stdout: string, stderr: string) {
  const diagnostics: Diagnostic[] = [];
  const pattern = /^(.+)\((\d+),(\d+)\): error TS(\d+): (.+)$/gm;
  for (const match of `${stdout}\n${stderr}`.matchAll(pattern)) {
    const file = match[1].trim().replaceAll('\\', '/');
    const rel = file.startsWith(root) ? relative(root, file) : file;
    diagnostics.push({
      message: match[5],
      code: `TS${match[4]}`,
      severity: 'error',
      filename: rel,
      labels: [{ span: { line: Number(match[2]), column: Number(match[3]) } }],
    });
  }
  return diagnostics;
}

function writeArthouseTsconfig() {
  writeFileDeep(join(arthouseDir, 'tsconfig.json'), `${JSON.stringify({
    extends: '../../tsconfig.json',
    compilerOptions: {
      noEmit: true,
    },
    include: ['./**/*.ts'],
    exclude: ['dist', 'snap', 'seeds'],
  }, null, 2)}\n`);
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

function printBlocker(
  title: string,
  report: WhipReport,
  workerPath: string,
  blockerNo?: number,
  total?: number,
) {
  spinner.stop();
  const reason = reasonOf(report);
  const hit = report.diagnostics[0];
  const numbered = blockerNo !== undefined && total !== undefined
    ? ` ${paint(ansi.bold + ansi.yellow, `#${blockerNo}`)}${paint(ansi.dim, `/${total}`)}`
    : '';
  const lines = [
    '',
    `${paint(ansi.bold + ansi.red, 'BLOCKER')}${numbered}  ${title}`,
    `  ${paint(ansi.dim, 'reason')}   ${paint(ansi.yellow, reason)}`,
    `  ${paint(ansi.dim, 'leftover')} ${paint(ansi.yellow, String(report.diagnostics.length))}`,
  ];
  if (hit?.filename) {
    lines.push(`  ${paint(ansi.dim, 'hit')}      ${hitLink(hit)}`);
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

async function blockUntilTypesGreen(kind: 'origin' | 'arthouse') {
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

function waitForHands(paths: string[]) {
  const targets = paths.filter(existsSync);
  if (targets.length === 0 && existsSync(arthouseDir)) {
    targets.push(arthouseDir);
  }

  return new Promise<void>(resolve => {
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
      timer = setTimeout(() => {
        finish();
      }, 400);
    };

    for (const target of targets) {
      watchers.push(watch(target, { recursive: true }, (_event, filename) => {
        onChange(filename);
      }));
    }
  });
}

function waitUntilSigint() {
  spinner.start('watching  Ctrl+C leaves');
  return new Promise<void>(() => {});
}

function prepareWorkspace(rules: RuleItem[], passed: string[], hashOk: boolean) {
  const snapOk = existsSync(join(snapDir, '.ok'));
  const state = readState();

  if (!fresh && snapOk && state) {
    restoreSnap();
    const index = Math.min(Math.max(state.index, 0), rules.length);
    const where = `${Math.min(index + 1, rules.length)}/${rules.length}${state.ruleId ? `  ${prefix}/${state.ruleId}` : ''}`;
    if (hashOk) {
      log(`resume · ${where}`);
    }
    else {
      log(`origin changed · keep snap · resume ${where}`);
    }
    return { index, mode: 'resume' as const };
  }

  if (hashOk && passed.length === rules.length && rules.length > 0) {
    log(`cache hit · ${rules.length}/${rules.length} · skip`);
    return { index: rules.length, mode: 'skip' as const };
  }

  copyOriginToArthouse();
  snapshot();
  if (passed.length > 0) {
    log(`no snap · requeue 1/${rules.length}`);
  }
  return { index: 0, mode: 'fresh' as const };
}

async function main() {
  process.on('SIGINT', () => die(130));
  process.on('SIGTERM', () => die(130));

  if (fresh) {
    wipeArthouse();
    wipeCache();
    log('punish --fresh · cache dropped');
  }

  const rules = listRules();
  log(`punish ${once ? 'once' : 'watch'} · ${rules.length} rules`);
  if (process.argv.includes('--promote')) {
    if (!existsSync(join(arthouseDir, 'index.ts'))) {
      log('no arthouse. nothing to promote.');
      process.exit(1);
    }
    await blockUntilTypesGreen('arthouse');
    promoteArthouseToOrigin();
    await buildRootDist();
    saveCache(originTreeHash(), rules.map(rule => rule.id));
    wipeArthouse();
    log('origin updated from arthouse.');
    return;
  }
  if (rules.length === 0) {
    log('queue empty. add src/painRoom/<rule-id>/dirty.ts');
    process.exit(0);
  }

  await blockUntilTypesGreen('origin');

  const treeHash = originTreeHash();
  const cache = loadCache();
  const hashOk = cache.treeHash === treeHash;
  const passed = hashOk ? [...cache.passed] : [];

  spinner.start(`punish  stage arthouse`);
  const stage = prepareWorkspace(rules, passed, hashOk);
  spinner.stop();
  let index = stage.index;
  if (stage.mode === 'fresh') {
    passed.length = 0;
    saveCache(treeHash, []);
  }
  else if (stage.mode === 'resume' && hashOk === false) {
    saveCache(treeHash, []);
  }

  if (stage.mode === 'skip') {
    if (!once) {
      await waitUntilSigint();
    }
    return;
  }

  await blockUntilTypesGreen('arthouse');
  let pluginEntry = 'src/origin/index.ts';

  while (index < rules.length) {
    const rule = rules[index];
    const blockerNo = index + 1;
    const label = `${blockerNo}/${rules.length}  ${prefix}/${rule.id}`;
    writeState(index, rule.id);
    const report = await whip(rule, label, pluginEntry);
    if (report.kind === 'clean') {
      snapshot();
      markPassed(treeHash, passed, rule.id);
      pluginEntry = 'src/origin/index.ts';
      index += 1;
      continue;
    }

    printBlocker(
      `${prefix}/${rule.id}`,
      report,
      `src/arthouse/rules/${rule.id}.ts`,
      blockerNo,
      rules.length,
    );

    if (once) {
      process.exit(1);
    }

    await waitForHands([
      join(arthouseDir, 'rules', `${rule.id}.ts`),
      join(painRoomDir, rule.id),
    ]);
    await blockUntilTypesGreen('arthouse');
    copySeeds();
    pluginEntry = 'src/arthouse/index.ts';
  }

  await blockUntilTypesGreen('arthouse');
  saveCache(treeHash, rules.map(rule => rule.id));

  if (!once) {
    spinner.start('punish  promote origin');
    promoteArthouseToOrigin();
    spinner.stop();
    await buildRootDist();
    saveCache(originTreeHash(), rules.map(rule => rule.id));
    wipeArthouse();
    log(`${paint(ansi.cyan, 'queue empty.')} origin updated.`);
    await waitUntilSigint();
    return;
  }
  wipeArthouse();
  spinner.stop();
  log(`${paint(ansi.cyan, 'queue empty.')} origin untouched.`);
}

main().catch(error => {
  spinner.stop();
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
