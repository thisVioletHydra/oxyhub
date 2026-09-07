import {
  loadCache,
  markPassed,
  refreshCacheAfterOriginWrite,
  saveCache,
  staleRules,
} from './runner/cache.ts';
import { ansi, die, log, paint, spinner } from './runner/log.ts';
import { arthouseDir, once, painRoomDir, prefix, promote, ruleWorker, ruleWorkerRel } from './runner/paths.ts';
import {  blockUntilTypesGreen,  buildRootDist,  printBlocker,  waitForHands,  waitUntilSigint,  whip,} from './runner/whip.ts';
import {
  copySeeds,
  includeInProgress,
  listRules,
  prepareWorkspace,
  promoteArthouseToOrigin,
  snapshot,
  wipeArthouse,
  wipeCache,
  writeState,
} from './runner/workspace.ts';

import process from 'node:process';
import fsPromises from 'node:fs/promises';
import path from 'node:path';

async function main() {
  process.on('SIGINT', () => die(130));
  process.on('SIGTERM', () => die(130));

  if (process.argv.includes('--fresh')) {
    await wipeArthouse();
    await wipeCache();
    log('punish --fresh · cache dropped');
  }

  const rules = await listRules();
  log(`punish ${once ? 'once' : 'watch'} · ${rules.length} rules`);

  const cache = await loadCache();
  const whipped = new Set<string>();

  if (promote) {
    try {
      await fsPromises.access(path.join(arthouseDir, 'index.ts'));
    }
    catch {
      log('no arthouse. nothing to promote.');
      process.exit(1);
    }
    await blockUntilTypesGreen('arthouse');
    await promoteArthouseToOrigin();
    await buildRootDist();
    await refreshCacheAfterOriginWrite(cache, rules, new Set(rules.map(rule => rule.id)));
    await wipeArthouse();
    log('origin updated from arthouse.');

    return;
  }

  if (rules.length === 0) {
    log('queue empty. add src/painRoom/<rule-id>/dirty.ts');
    process.exit(0);
  }

  await blockUntilTypesGreen('origin');

  const queue = await includeInProgress(await staleRules(rules, cache), rules);
  log(`${queue.length} stale · ${rules.length - queue.length} cached`);

  spinner.start('punish  stage arthouse');
  const stage = await prepareWorkspace(queue);
  spinner.stop();

  if (stage.mode === 'skip' || queue.length === 0) {
    if (once === null || once === undefined) {
      await waitUntilSigint();
    }

    return;
  }

  await blockUntilTypesGreen('arthouse');
  let pluginEntry = 'src/origin/index.ts';
  let index = stage.index;

  while (index < queue.length) {
    const rule = queue[index];
    const blockerNo = index + 1;
    const label = `${blockerNo}/${queue.length}  ${prefix}/${rule.id}`;
    await writeState(index, rule.id);
    const report = await whip(rule, label, pluginEntry);
    if (report.kind === 'clean') {
      await snapshot();
      await markPassed(cache, rule);
      whipped.add(rule.id);
      pluginEntry = 'src/origin/index.ts';
      index += 1;
      continue;
    }

    printBlocker(
      `${prefix}/${rule.id}`,
      report,
      ruleWorkerRel(rule.id),
      blockerNo,
      queue.length,
    );

    if (once) {
      process.exit(1);
    }

    await waitForHands([
      ruleWorker(arthouseDir, rule.id),
      path.join(painRoomDir, rule.id),
    ]);
    await blockUntilTypesGreen('arthouse');
    await copySeeds();
    pluginEntry = 'src/arthouse/index.ts';
  }

  await blockUntilTypesGreen('arthouse');
  await saveCache(cache);

  if (once === null || once === undefined) {
    spinner.start('punish  promote origin');
    await promoteArthouseToOrigin();
    spinner.stop();
    await buildRootDist();
    await refreshCacheAfterOriginWrite(cache, rules, whipped);
    await wipeArthouse();
    log(`${paint(ansi.cyan, 'queue empty.')} origin updated.`);
    await waitUntilSigint();

    return;
  }

  await wipeArthouse();
  spinner.stop();
  log(`${paint(ansi.cyan, 'queue empty.')} origin untouched.`);
}

main().catch((error) => {
  spinner.stop();
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
