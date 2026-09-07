import type { RuleItem } from './types.ts';

import { copyPluginTree, rewriteHashToRelative, rewriteRelativeToHash } from './copy.ts';
import { emptyDir, exists, writeJson } from './fs.ts';
import { log } from './log.ts';
import {
  arthouseDir,
  cachePath,
  configPath,
  fresh,
  originDir,
  painRoomDir,
  prefix,
  seedsDir,
  snapDir,
  statePath,
} from './paths.ts';

import lintConfig from '../../../oxlint.config.ts';
import fsPromises from 'node:fs/promises';
import path from 'node:path';

export async function wipeArthouse() {
  await fsPromises.rm(arthouseDir, { recursive: true, force: true });
}

export async function wipeCache() {
  await fsPromises.rm(cachePath, { force: true });
}

async function painRoomRuleDirs() {
  const entries = await fsPromises.readdir(painRoomDir, { withFileTypes: true });
  const ids: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (await exists(path.join(painRoomDir, entry.name, 'dirty.ts'))) {
      ids.push(entry.name);
    }
  }
  return ids;
}

export async function copySeeds() {
  await emptyDir(seedsDir);
  for (const id of await painRoomRuleDirs()) {
    const from = path.join(painRoomDir, id);
    const to = path.join(seedsDir, id);
    await fsPromises.mkdir(to, { recursive: true });
    for (const name of ['dirty.ts', 'whip.ts', 'gag.ts']) {
      const src = path.join(from, name);
      if (await exists(src)) {
        await fsPromises.copyFile(src, path.join(to, name));
      }
    }
  }
}

export async function snapshot() {
  await emptyDir(snapDir);
  await copyPluginTree(arthouseDir, snapDir, source => source);
  await fsPromises.writeFile(path.join(snapDir, '.ok'), `${Date.now()}\n`);
}

export async function restoreSnap() {
  await copyPluginTree(snapDir, arthouseDir, source => source);
  await copySeeds();
}

export async function copyOriginToArthouse() {
  await emptyDir(arthouseDir);
  await copyPluginTree(originDir, arthouseDir, rewriteHashToRelative);
  await copySeeds();
}

export async function promoteArthouseToOrigin() {
  await copyPluginTree(arthouseDir, originDir, rewriteRelativeToHash);
}

export async function readState() {
  if (!(await exists(statePath))) {
    return null;
  }
  try {
    return JSON.parse(await fsPromises.readFile(statePath, 'utf8')) as {
      index: number;
      ruleId: string;
    };
  }
  catch {
    return null;
  }
}

export async function writeState(index: number, ruleId: string) {
  await writeJson(statePath, {
    index,
    ruleId,
    updatedAt: new Date().toISOString(),
  });
}

export async function writeArthouseTsconfig() {
  await writeJson(path.join(arthouseDir, 'tsconfig.json'), {
    extends: '../../tsconfig.json',
    compilerOptions: {
      noEmit: true,
    },
    include: ['./**/*.ts'],
    exclude: ['dist', 'snap', 'seeds'],
  });
}

export async function writePunishConfig(rule: RuleItem) {
  const key = `${prefix}/${rule.id}`;
  await writeJson(configPath, {
    plugins: [],
    jsPlugins: ['./dist/index.js'],
    ignorePatterns: ['**/seeds/**', '**/snap/**', '**/dist/**'],
    rules: {
      [key]: rule.options === undefined ? 'error' : ['error', rule.options],
    },
  });
}

type LintRulesConfig = {
  extends?: Array<{ rules?: Record<string, unknown> }>;
  rules?: Record<string, unknown>;
};

function flattenRules(config: LintRulesConfig) {
  const merged: Record<string, unknown> = {};

  for (const ext of config.extends ?? []) {
    Object.assign(merged, ext.rules ?? {});
  }
  Object.assign(merged, config.rules ?? {});

  return merged;
}

export async function listRules(): Promise<RuleItem[]> {
  const oxlintRules = flattenRules(lintConfig);
  const seeded = new Set(await painRoomRuleDirs());
  const rulesDir = path.join(originDir, 'rules');
  const fromFiles = new Set<string>();
  const entries = await fsPromises.readdir(rulesDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && await exists(path.join(rulesDir, entry.name, 'index.ts'))) {
      fromFiles.add(entry.name);
    }
  }
  const rules: RuleItem[] = [];
  const seen = new Set<string>();

  for (const [key, setting] of Object.entries(oxlintRules)) {
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

export async function includeInProgress(queue: RuleItem[], all: RuleItem[]) {
  if (fresh) {
    return queue;
  }
  const state = await readState();
  if (!(await exists(path.join(snapDir, '.ok'))) || state?.ruleId === undefined) {
    return queue;
  }
  if (queue.some(rule => rule.id === state.ruleId)) {
    return queue;
  }
  const current = all.find(rule => rule.id === state.ruleId);
  if (current === null || current === undefined) {
    return queue;
  }

  return [current, ...queue];
}

export async function prepareWorkspace(queue: RuleItem[]) {
  const snapOk = await exists(path.join(snapDir, '.ok'));
  const state = await readState();

  if (!fresh && snapOk && state !== null && state !== undefined) {
    await restoreSnap();
    let index = queue.findIndex(rule => rule.id === state.ruleId);
    if (index < 0) {
      index = 0;
    }
    const current = queue[index];
    const where = queue.length === 0
      ? 'done'
      : `${index + 1}/${queue.length}${current === undefined ? '' : `  ${prefix}/${current.id}`}`;
    log(`resume · ${where}`);

    return { index, mode: 'resume' as const };
  }

  if (queue.length === 0) {
    log('cache hit · all rules fresh');

    return { index: 0, mode: 'skip' as const };
  }

  await copyOriginToArthouse();
  await snapshot();

  return { index: 0, mode: 'fresh' as const };
}
