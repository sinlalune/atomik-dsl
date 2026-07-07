#!/usr/bin/env node
/* Generability eval orchestrator (CP-DSL-003). Modes:
 *   --dry-run   score canned SYNTHETIC outputs end-to-end; proves the pipeline
 *               with no API and no dependencies. Writes results/dry-run/.
 *   build       write the real generation batch bodies to results/<ts>/ for
 *               inspection or manual submission. No API.
 *   live        S04: submit generation -> repair -> judge via the Batches API.
 *               Requires ANTHROPIC_API_KEY (+ @anthropic-ai/sdk installed).
 * Usage: node apps/eval-generability/run.mjs --dry-run   (npm run eval:dry-run)
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPocketSpec } from './prompt.mjs';
import { score } from './scorer.mjs';
import { aggregate } from './stability.mjs';
import {
  buildGenerationBatch, buildRepairBatch, buildJudgeBatch,
  extractScene, genId, parseId
} from './batch.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const MODEL = 'claude-haiku-4-5';
const JUDGE_MODEL = 'claude-sonnet-5';
const REGIMES = ['R1', 'R2'];
const RUNS = 5;

function loadTasks() {
  const dir = join(here, 'tasks');
  return readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'README.md')
    .sort().map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
}

function ensureDir(d) { mkdirSync(d, { recursive: true }); return d; }
function writeJsonl(path, rows) { writeFileSync(path, rows.map((r) => JSON.stringify(r)).join('\n') + '\n'); }

/* Score a custom_id -> output map into per-run records and per-task aggregates. */
function scoreAll(tasks, outputs) {
  const byId = {}; tasks.forEach((t) => { byId[t.id] = t; });
  const records = []; // flat per-run records
  for (const [cid, out] of Object.entries(outputs)) {
    const { kind, taskId, regime, run } = parseId(cid);
    if (kind !== 'gen') continue;
    const task = byId[taskId];
    if (!task) continue;
    const scene = extractScene(out.text || '');
    const rec = { taskId, regime, run, apiError: out.error || null, sceneText: scene };
    rec.score = (out.text && scene) ? score(task, scene) : { parses: false, pass: false, archetype: null, nodeIds: [], relationSignature: [], fabricatedCount: 0, statusWithinCeiling: false, propsPassed: 0, propsTotal: task.properties.length, errorCount: -1, diagnostics: [] };
    records.push(rec);
  }
  // aggregate per (task, regime)
  const groups = {};
  records.forEach((r) => { const k = r.taskId + '|' + r.regime; (groups[k] = groups[k] || []).push(r.score); });
  const aggregates = Object.entries(groups).map(([k, recs]) => {
    const [taskId, regime] = k.split('|');
    return { taskId, regime, ...aggregate(recs) };
  }).sort((a, b) => a.taskId.localeCompare(b.taskId) || a.regime.localeCompare(b.regime));
  return { records, aggregates };
}

function summarize(aggregates) {
  const r1 = aggregates.filter((a) => a.regime === 'R1');
  const r2 = aggregates.filter((a) => a.regime === 'R2');
  const mean = (xs, f) => xs.length ? xs.reduce((s, a) => s + f(a), 0) / xs.length : 0;
  return {
    tasksCovered: new Set(aggregates.map((a) => a.taskId)).size,
    R1: { archetypeModeShare: mean(r1, (a) => a.archetypeModeShare), nodeJaccard: mean(r1, (a) => a.nodeJaccard), passRate: mean(r1, (a) => a.passRate), fabricationRate: mean(r1, (a) => a.fabricationRate) },
    R2: { archetypeModeShare: mean(r2, (a) => a.archetypeModeShare), nodeJaccard: mean(r2, (a) => a.nodeJaccard), passRate: mean(r2, (a) => a.passRate), fabricationRate: mean(r2, (a) => a.fabricationRate) }
  };
}

async function main() {
  const mode = process.argv[2] || '--dry-run';
  const tasks = loadTasks();
  const pocket = loadPocketSpec();

  if (mode === '--dry-run' || mode === 'dry-run') {
    const { cannedOutputs } = await import('./fixtures/dry-run-outputs.mjs');
    // fixtures map id -> scene string; normalize to the live { text, error } shape
    const outputs = {};
    for (const [id, text] of Object.entries(cannedOutputs)) outputs[id] = { text, error: null };
    const { records, aggregates } = scoreAll(tasks, outputs);
    const outDir = ensureDir(join(here, 'results', 'dry-run'));
    writeJsonl(join(outDir, 'records.jsonl'), records.map((r) => ({ taskId: r.taskId, regime: r.regime, run: r.run, apiError: r.apiError, score: r.score })));
    writeJsonl(join(outDir, 'aggregates.jsonl'), aggregates);
    const summary = summarize(aggregates);
    writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log('DRY RUN (synthetic fixtures — NOT eval results)');
    console.log('  scored ' + records.length + ' canned runs across ' + summary.tasksCovered + ' tasks');
    console.log('  parse failures: ' + records.filter((r) => !r.score.parses).length);
    console.log('  fabrications caught: ' + records.filter((r) => r.score.fabricatedCount > 0).length);
    console.log('  status-ceiling breaches: ' + records.filter((r) => r.score.parses && !r.score.statusWithinCeiling).length);
    console.log('  archetype drift (water-cycle R1 modeShare): ' +
      (aggregates.find((a) => a.taskId === 'water-cycle' && a.regime === 'R1') || {}).archetypeModeShare);
    console.log('  wrote ' + outDir);
    return;
  }

  if (mode === 'build') {
    const requests = buildGenerationBatch(pocket, tasks, { regimes: REGIMES, runs: RUNS, model: MODEL });
    const outDir = ensureDir(join(here, 'results', 'batch-' + Date.now()));
    writeJsonl(join(outDir, 'generation.requests.jsonl'), requests);
    console.log('built ' + requests.length + ' generation requests (' + tasks.length + ' tasks × ' + REGIMES.length + ' regimes × ' + RUNS + ' runs)');
    console.log('model=' + MODEL + '  judge=' + JUDGE_MODEL);
    console.log('wrote ' + outDir + '/generation.requests.jsonl (inspect or submit)');
    return;
  }

  if (mode === 'live') {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('live mode needs ANTHROPIC_API_KEY (and `npm i -D @anthropic-ai/sdk`).');
      console.error('This is the CP-DSL-003 S04 blocker: provide a key, then rerun `node run.mjs live`.');
      process.exit(2);
    }
    const { submitBatch } = await import('./batch.mjs');
    const outDir = ensureDir(join(here, 'results', 'live-' + Date.now()));
    const log = (m) => console.log(m);

    // 1. generation
    const genReqs = buildGenerationBatch(pocket, tasks, { regimes: REGIMES, runs: RUNS, model: MODEL });
    const gen = await submitBatch(genReqs, { log });
    writeFileSync(join(outDir, 'generation.results.json'), JSON.stringify(gen.results, null, 2));
    const { records } = scoreAll(tasks, gen.results);

    // 2. repair round for parse failures
    const byId = {}; tasks.forEach((t) => { byId[t.id] = t; });
    const failed = records.filter((r) => !r.score.parses).map((r) => ({
      taskId: r.taskId, regime: r.regime, run: r.run, task: byId[r.taskId],
      sceneText: r.sceneText, diagnostics: r.score.diagnostics
    }));
    if (failed.length) {
      const repairReqs = buildRepairBatch(pocket, failed, MODEL);
      const rep = await submitBatch(repairReqs, { log });
      writeFileSync(join(outDir, 'repair.results.json'), JSON.stringify(rep.results, null, 2));
    }

    // 3. judge pass over parsed generations
    const parsed = records.filter((r) => r.score.parses).map((r) => ({
      taskId: r.taskId, regime: r.regime, run: r.run, task: byId[r.taskId], sceneText: r.sceneText
    }));
    const judgeReqs = buildJudgeBatch(parsed, JUDGE_MODEL);
    const judged = await submitBatch(judgeReqs, { log });
    writeFileSync(join(outDir, 'judge.results.json'), JSON.stringify(judged.results, null, 2));

    console.log('live run complete → ' + outDir + ' (score + report in S05)');
    return;
  }

  console.error('unknown mode: ' + mode + '  (use --dry-run | build | live)');
  process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
