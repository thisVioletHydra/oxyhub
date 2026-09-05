import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
export const originDir = join(root, 'src/origin');
export const painRoomDir = join(root, 'src/painRoom');
export const arthouseDir = join(root, 'src/arthouse');
export const snapDir = join(arthouseDir, 'snap');
export const seedsDir = join(arthouseDir, 'seeds');
export const statePath = join(arthouseDir, 'state.json');
export const configPath = join(arthouseDir, '.punish.oxlintrc.json');
export const cachePath = join(painRoomDir, '.punish-cache.json');
export const oxlintBin = join(root, 'node_modules/.bin/oxlint');
export const prefix = 'oxyhub';

export const once = process.argv.includes('--once');
export const fresh = process.argv.includes('--fresh');
export const promote = process.argv.includes('--promote');

export function ruleWorker(pluginRoot: string, id: string) {
  return join(pluginRoot, 'rules', id, 'index.ts');
}

export function ruleWorkerRel(id: string) {
  return `src/arthouse/rules/${id}/index.ts`;
}
