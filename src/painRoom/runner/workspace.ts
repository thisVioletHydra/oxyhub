import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { log } from './log.ts';
import {
  arthouseDir,
  cachePath,
  configPath,
  fresh,
  originDir,
  painRoomDir,
  prefix,
  root,
  seedsDir,
  snapDir,
  statePath,
} from './paths.ts';
import type { FileKind, RuleItem } from './types.ts';

function writeFileDeep(path: string, contents: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function writeJson(path: string, value: unknown) {
  writeFileDeep(path, `${JSON.stringify(value, null, 2)}\n`);
}

function emptyDir(dir: string) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
  mkdirSync(dir, { recursive: true });
}

function listTsFiles(dir: string, base = dir): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...listTsFiles(full, base));
      continue;
    }
    if (name.endsWith('.ts')) {
      out.push(relative(base, full));
    }
  }
  return out;
}

export function listPluginTs(dir: string) {
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
  if (rel.startsWith('rules/') || rel.startsWith('rules\\')) {
    return 'rule';
  }
  if (rel.startsWith('utils/') || rel.startsWith('utils\\')) {
    return 'util';
  }
  return 'other';
}

const toRelative: Record<FileKind, Array<[string, string]>> = {
  index: [
    ["from '#plugin-types'", "from './plugin-types'"],
    ["from '#rules/", "from './rules/"],
  ],
  rule: [
    ["from '#plugin-types'", "from '../../plugin-types'"],
    ["from '#utils/", "from '../../utils/"],
  ],
  util: [
    ["from '#plugin-types'", "from '../plugin-types'"],
  ],
  other: [],
};

const toHash: Record<FileKind, Array<[string, string]>> = {
  index: [
    ["from './plugin-types'", "from '#plugin-types'"],
    ["from './rules/", "from '#rules/"],
  ],
  rule: [
    ["from '../../plugin-types'", "from '#plugin-types'"],
    ["from '../../utils/", "from '#utils/"],
  ],
  util: [
    ["from '../plugin-types'", "from '#plugin-types'"],
  ],
  other: [],
};

function applyRewrites(source: string, table: Array<[string, string]>) {
  let next = source;
  for (const [from, to] of table) {
    next = next.replaceAll(from, to);
  }
  return next;
}

function rewriteHashToRelative(source: string, kind: FileKind) {
  return applyRewrites(source, toRelative[kind]);
}

function rewriteRelativeToHash(source: string, kind: FileKind) {
  return applyRewrites(source, toHash[kind]);
}

function copyPluginTree(
  fromDir: string,
  toDir: string,
  rewrite: (source: string, kind: FileKind) => string,
) {
  mkdirSync(toDir, { recursive: true });
  for (const rel of listPluginTs(fromDir)) {
    const source = readFileSync(join(fromDir, rel), 'utf8');
    writeFileDeep(join(toDir, rel), rewrite(source, fileKind(rel)));
  }
}

export function wipeArthouse() {
  if (existsSync(arthouseDir)) {
    rmSync(arthouseDir, { recursive: true, force: true });
  }
}

export function wipeCache() {
  if (existsSync(cachePath)) {
    rmSync(cachePath);
  }
}

function painRoomRuleDirs() {
  return readdirSync(painRoomDir).filter((name) => {
    const full = join(painRoomDir, name);
    return statSync(full).isDirectory() && existsSync(join(full, 'dirty.ts'));
  });
}

export function copySeeds() {
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

export function snapshot() {
  emptyDir(snapDir);
  copyPluginTree(arthouseDir, snapDir, source => source);
  writeFileSync(join(snapDir, '.ok'), `${Date.now()}\n`);
}

export function restoreSnap() {
  copyPluginTree(snapDir, arthouseDir, source => source);
  copySeeds();
}

export function copyOriginToArthouse() {
  emptyDir(arthouseDir);
  copyPluginTree(originDir, arthouseDir, rewriteHashToRelative);
  copySeeds();
}

export function promoteArthouseToOrigin() {
  copyPluginTree(arthouseDir, originDir, rewriteRelativeToHash);
}

export function readState() {
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

export function writeState(index: number, ruleId: string) {
  writeJson(statePath, {
    index,
    ruleId,
    updatedAt: new Date().toISOString(),
  });
}

export function writeArthouseTsconfig() {
  writeJson(join(arthouseDir, 'tsconfig.json'), {
    extends: '../../tsconfig.json',
    compilerOptions: {
      noEmit: true,
    },
    include: ['./**/*.ts'],
    exclude: ['dist', 'snap', 'seeds'],
  });
}

export function writePunishConfig(rule: RuleItem) {
  const key = `${prefix}/${rule.id}`;
  writeJson(configPath, {
    plugins: [],
    jsPlugins: ['./dist/index.mjs'],
    ignorePatterns: ['**/seeds/**', '**/snap/**', '**/dist/**'],
    rules: {
      [key]: rule.options === undefined ? 'error' : ['error', rule.options],
    },
  });
}

export function listRules(): RuleItem[] {
  const oxlintConfig = JSON.parse(readFileSync(join(root, '.oxlintrc.json'), 'utf8')) as {
    rules?: Record<string, unknown>;
  };
  const seeded = new Set(painRoomRuleDirs());
  const rulesDir = join(originDir, 'rules');
  const fromFiles = new Set(
    readdirSync(rulesDir).filter((name) => {
      const full = join(rulesDir, name);
      return statSync(full).isDirectory() && existsSync(join(full, 'index.ts'));
    }),
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

export function includeInProgress(queue: RuleItem[], all: RuleItem[]) {
  if (fresh) {
    return queue;
  }
  const state = readState();
  if (!existsSync(join(snapDir, '.ok')) || !state?.ruleId) {
    return queue;
  }
  if (queue.some(rule => rule.id === state.ruleId)) {
    return queue;
  }
  const current = all.find(rule => rule.id === state.ruleId);
  if (!current) {
    return queue;
  }
  return [current, ...queue];
}

export function prepareWorkspace(queue: RuleItem[]) {
  const snapOk = existsSync(join(snapDir, '.ok'));
  const state = readState();

  if (!fresh && snapOk && state) {
    restoreSnap();
    let index = queue.findIndex(rule => rule.id === state.ruleId);
    if (index < 0) {
      index = 0;
    }
    const current = queue[index];
    const where = queue.length === 0
      ? 'done'
      : `${index + 1}/${queue.length}${current ? `  ${prefix}/${current.id}` : ''}`;
    log(`resume · ${where}`);
    return { index, mode: 'resume' as const };
  }

  if (queue.length === 0) {
    log('cache hit · all rules fresh');
    return { index: 0, mode: 'skip' as const };
  }

  copyOriginToArthouse();
  snapshot();
  return { index: 0, mode: 'fresh' as const };
}
