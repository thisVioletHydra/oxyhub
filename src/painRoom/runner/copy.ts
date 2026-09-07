import type { FileKind } from './types.ts';

import { exists, writeFileDeep } from './fs.ts';

import fsPromises from 'node:fs/promises';
import path from 'node:path';

async function listTsFiles(dir: string, base = dir): Promise<string[]> {
  if (!(await exists(dir))) {
    return [];
  }
  const out: string[] = [];
  const entries = await fsPromises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...await listTsFiles(full, base));
      continue;
    }
    if (entry.name.endsWith('.ts')) {
      out.push(path.relative(base, full));
    }
  }

  return out;
}

export async function listPluginTs(dir: string) {
  const out: string[] = [];
  for (const name of ['index.ts', 'plugin-types.ts']) {
    if (await exists(path.join(dir, name))) {
      out.push(name);
    }
  }
  for (const folder of ['rules', 'layout', 'imports']) {
    const full = path.join(dir, folder);
    if (await exists(full)) {
      out.push(...await listTsFiles(full, dir));
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
  if (rel.startsWith('layout/') || rel.startsWith('layout\\')) {
    return 'layout';
  }
  if (rel.startsWith('imports/') || rel.startsWith('imports\\')) {
    return 'imports';
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
    ["from '#layout/", "from '../../layout/"],
    ["from '#imports/", "from '../../imports/"],
  ],
  layout: [
    ["from '#plugin-types'", "from '../plugin-types'"],
    ["from '#layout/", "from './"],
    ["from '#imports/", "from '../imports/"],
  ],
  imports: [
    ["from '#plugin-types'", "from '../plugin-types'"],
    ["from '#imports/", "from './"],
    ["from '#layout/", "from '../layout/"],
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
    ["from '../../layout/", "from '#layout/"],
    ["from '../../imports/", "from '#imports/"],
  ],
  layout: [
    ["from '../plugin-types'", "from '#plugin-types'"],
    ["from './", "from '#layout/"],
    ["from '../imports/", "from '#imports/"],
  ],
  imports: [
    ["from '../plugin-types'", "from '#plugin-types'"],
    ["from './", "from '#imports/"],
    ["from '../layout/", "from '#layout/"],
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

export function rewriteHashToRelative(source: string, kind: FileKind) {
  return applyRewrites(source, toRelative[kind]);
}

export function rewriteRelativeToHash(source: string, kind: FileKind) {
  return applyRewrites(source, toHash[kind]);
}

export async function copyPluginTree(
  fromDir: string,
  toDir: string,
  rewrite: (source: string, kind: FileKind) => string,
) {
  await fsPromises.mkdir(toDir, { recursive: true });
  for (const rel of await listPluginTs(fromDir)) {
    const source = await fsPromises.readFile(path.join(fromDir, rel), 'utf8');
    await writeFileDeep(path.join(toDir, rel), rewrite(source, fileKind(rel)));
  }
}
