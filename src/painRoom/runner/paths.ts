import process from 'node:process';
import path from 'node:path';
import url from 'node:url';

export const root = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '../../..');
export const originDir = path.join(root, 'src/origin');
export const painRoomDir = path.join(root, 'src/painRoom');
export const arthouseDir = path.join(root, 'src/arthouse');
export const snapDir = path.join(arthouseDir, 'snap');
export const seedsDir = path.join(arthouseDir, 'seeds');
export const statePath = path.join(arthouseDir, 'state.json');
export const configPath = path.join(arthouseDir, '.punish.oxlintrc.json');
export const cachePath = path.join(painRoomDir, '.punish-cache.json');
export const oxlintBin = path.join(root, 'node_modules/.bin/oxlint');
export const prefix = 'oxyhub';

export const once = process.argv.includes('--once');
export const fresh = process.argv.includes('--fresh');
export const promote = process.argv.includes('--promote');

export function ruleWorker(pluginRoot: string, id: string) {
  return path.join(pluginRoot, 'rules', id, 'index.ts');
}

export function ruleWorkerRel(id: string) {
  return `src/arthouse/rules/${id}/index.ts`;
}
