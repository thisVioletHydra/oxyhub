import type { PunishCache, RuleCacheEntry, RuleItem } from './types.ts';

import { cachePath, originDir, painRoomDir, root } from './paths.ts';

import crypto from 'node:crypto';
import fsPromises from 'node:fs/promises';
import path from 'node:path';

const HASH_IMPORT = /from ['"](#(?:plugin-types|utils\/[^'"]+))['"]/g;

function specToPath(spec: string) {
  if (spec === '#plugin-types') {
    return path.join(originDir, 'plugin-types.ts');
  }

  return path.join(originDir, 'utils', `${spec.slice('#utils/'.length)}.ts`);
}

async function exists(filePath: string) {
  try {
    await fsPromises.access(filePath);

    return true;
  }
  catch {
    return false;
  }
}

async function collectRuleFiles(id: string) {
  const files: string[] = [];
  const seen = new Set<string>();
  const queue = [path.join(originDir, 'rules', id, 'index.ts')];

  for (const name of ['dirty.ts', 'whip.ts', 'gag.ts']) {
    queue.push(path.join(painRoomDir, id, name));
  }

  while (queue.length > 0) {
    const filePath = queue.pop();
    if (!filePath || seen.has(filePath) || !(await exists(filePath))) {
      continue;
    }
    seen.add(filePath);
    files.push(filePath);
    const source = await fsPromises.readFile(filePath, 'utf8');
    for (const match of source.matchAll(HASH_IMPORT)) {
      queue.push(specToPath(match[1]));
    }
  }

  return files.sort();
}

export async function fingerprint(rule: RuleItem): Promise<RuleCacheEntry> {
  const hash = crypto.createHash('sha256');
  const files = await collectRuleFiles(rule.id);
  let mtime = 0;

  hash.update(JSON.stringify(rule.options ?? null));
  hash.update('\0');

  for (const filePath of files) {
    const rel = filePath.startsWith(root) ? filePath.slice(root.length + 1) : filePath;
    const buf = await fsPromises.readFile(filePath);
    const stats = await fsPromises.stat(filePath);
    mtime = Math.max(mtime, stats.mtimeMs);
    hash.update(rel);
    hash.update('\0');
    hash.update(buf);
    hash.update('\0');
  }

  return {
    hash: hash.digest('hex'),
    mtime,
    passedAt: new Date().toISOString(),
  };
}

export async function isStale(rule: RuleItem, entry: RuleCacheEntry | undefined) {
  if (entry === null || entry === undefined) {
    return true;
  }
  const current = await fingerprint(rule);
  if (entry.hash) {
    return entry.hash !== current.hash;
  }

  return current.mtime > entry.mtime;
}

function emptyCache(): PunishCache {
  return { rules: {} };
}

export async function loadCache(): Promise<PunishCache> {
  if (!(await exists(cachePath))) {
    return emptyCache();
  }
  try {
    const payload = JSON.parse(await fsPromises.readFile(cachePath, 'utf8')) as {
      rules?: Record<string, RuleCacheEntry>;
      passed?: unknown;
    };
    if (payload.rules && typeof payload.rules === 'object' && !Array.isArray(payload.rules)) {
      return { rules: payload.rules };
    }
    if (!Array.isArray(payload.passed)) {
      return emptyCache();
    }
    const rules: Record<string, RuleCacheEntry> = {};
    for (const id of payload.passed) {
      if (typeof id !== 'string') {
        continue;
      }
      rules[id] = await fingerprint({ id, options: undefined });
    }
    const migrated = { rules };
    await saveCache(migrated);

    return migrated;
  }
  catch {
    return emptyCache();
  }
}

export async function saveCache(cache: PunishCache) {
  await fsPromises.mkdir(path.dirname(cachePath), { recursive: true });
  await fsPromises.writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`);
}

export async function markPassed(cache: PunishCache, rule: RuleItem) {
  cache.rules[rule.id] = await fingerprint(rule);
  await saveCache(cache);
}

export async function staleRules(rules: RuleItem[], cache: PunishCache) {
  const flags = await Promise.all(
    rules.map(rule => isStale(rule, cache.rules[rule.id])),
  );
  return rules.filter((_, index) => flags[index]);
}

export async function refreshCacheAfterOriginWrite(
  cache: PunishCache,
  rules: RuleItem[],
  keepPassed: Set<string>,
) {
  const next: Record<string, RuleCacheEntry> = {};
  for (const rule of rules) {
    const current = await fingerprint(rule);
    const previous = cache.rules[rule.id];
    if (keepPassed.has(rule.id)) {
      next[rule.id] = current;
      continue;
    }
    if (previous?.hash === current.hash) {
      next[rule.id] = {
        ...current,
        passedAt: previous.passedAt,
      };
    }
  }
  cache.rules = next;
  await saveCache(cache);
}
