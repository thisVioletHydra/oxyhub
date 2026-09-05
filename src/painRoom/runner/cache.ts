import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { cachePath, originDir, painRoomDir, root } from './paths.ts';
import type { PunishCache, RuleCacheEntry, RuleItem } from './types.ts';

const HASH_IMPORT = /from ['"](#(?:plugin-types|utils\/[^'"]+))['"]/g;

function specToPath(spec: string) {
  if (spec === '#plugin-types') {
    return join(originDir, 'plugin-types.ts');
  }
  return join(originDir, 'utils', `${spec.slice('#utils/'.length)}.ts`);
}

function collectRuleFiles(id: string) {
  const files: string[] = [];
  const seen = new Set<string>();
  const queue = [join(originDir, 'rules', id, 'index.ts')];

  for (const name of ['dirty.ts', 'whip.ts', 'gag.ts']) {
    queue.push(join(painRoomDir, id, name));
  }

  while (queue.length > 0) {
    const path = queue.pop();
    if (!path || seen.has(path) || !existsSync(path)) {
      continue;
    }
    seen.add(path);
    files.push(path);
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(HASH_IMPORT)) {
      queue.push(specToPath(match[1]));
    }
  }

  return files.sort();
}

export function fingerprint(rule: RuleItem): RuleCacheEntry {
  const hash = createHash('sha256');
  const files = collectRuleFiles(rule.id);
  let mtime = 0;

  hash.update(JSON.stringify(rule.options ?? null));
  hash.update('\0');

  for (const path of files) {
    const rel = path.startsWith(root) ? path.slice(root.length + 1) : path;
    const buf = readFileSync(path);
    mtime = Math.max(mtime, statSync(path).mtimeMs);
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

export function isStale(rule: RuleItem, entry: RuleCacheEntry | undefined) {
  if (!entry) {
    return true;
  }
  const current = fingerprint(rule);
  if (entry.hash) {
    return entry.hash !== current.hash;
  }
  return current.mtime > entry.mtime;
}

function emptyCache(): PunishCache {
  return { rules: {} };
}

export function loadCache(): PunishCache {
  if (!existsSync(cachePath)) {
    return emptyCache();
  }
  try {
    const payload = JSON.parse(readFileSync(cachePath, 'utf8')) as {
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
      rules[id] = fingerprint({ id, options: undefined });
    }
    const migrated = { rules };
    saveCache(migrated);
    return migrated;
  }
  catch {
    return emptyCache();
  }
}

export function saveCache(cache: PunishCache) {
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, `${JSON.stringify(cache, null, 2)}\n`);
}

export function markPassed(cache: PunishCache, rule: RuleItem) {
  cache.rules[rule.id] = fingerprint(rule);
  saveCache(cache);
}

export function staleRules(rules: RuleItem[], cache: PunishCache) {
  return rules.filter(rule => isStale(rule, cache.rules[rule.id]));
}

export function refreshCacheAfterOriginWrite(
  cache: PunishCache,
  rules: RuleItem[],
  keepPassed: Set<string>,
) {
  const next: Record<string, RuleCacheEntry> = {};
  for (const rule of rules) {
    const current = fingerprint(rule);
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
  saveCache(cache);
}
