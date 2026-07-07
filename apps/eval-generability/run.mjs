#!/usr/bin/env node
/* Generability eval orchestrator (CP-DSL-003), multi-provider. Modes:
 *   --dry-run          score canned SYNTHETIC outputs end-to-end; no API, no deps.
 *   build [provider]   write real batch request bodies for inspection. No API.
 *   live  [provider]   S04: generation -> repair -> judge via each subject
 *                      provider's Batch API. Needs that provider's key + SDK.
 * provider ∈ anthropic | google | all (default all). Judge always Anthropic.
 * Usage: node apps/eval-generability/run.mjs --dry-run   (npm run eval:dry-run)
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPocketSpec } from './prompt.mjs';
import { score } from './scorer.mjs';
import { aggregate } from './stability.mjs';
import { planGeneration, planRepair, planJudge, extractScene, parseId } from './batch.mjs';
import { get as getProvider, SUBJECT_PROVIDERS } from './providers/index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const REGIMES = ['R1', 'R2'];
const RUNS = 5;

function loadTasks() {
  const dir = join(here, 'tasks');
  return readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'README.md')
    .sort().map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
}
function ensureDir(d) { mkdirSync(d, { recursive: true }); return d; }
function writeJsonl(path, rows) { writeFileSync(path, rows.map((r) => JSON.stringify(r)).join('\n') + '\n'); }
function resolveProviders(arg) { return (!arg || arg === 'all') ? SUBJECT_PROVIDERS.slice() : [arg]; }

/* Score a custom_id -> {text,error} map into per-run records + per-(task,regime)
 * aggregates. `provider` tags each record (provider is a run dimension). */
function scoreAll(tasks, outputs, provider) {
  const byId = {}; tasks.forEach((t) => { byId[t.id] = t; });
  const records = [];
  for (const [cid, out] of Object.entries(outputs)) {
    const { kind, taskId, regime, run } = parseId(cid);
    if (kind !== 'gen') continue;
    const task = byId[taskId];
    if (!task) continue;
    const scene = extractScene(out.text || '');
    const rec = { provider, taskId, regime, run, apiError: out.error || null, sceneText: scene };
    rec.score = (out.text && scene) ? score(task, scene)
      : { parses: false, pass: false, archetype: null, nodeIds: [], relationSignature: [], fabricatedCount: 0, statusWithinCeiling: false, propsPassed: 0, propsTotal: task.properties.length, errorCount: -1, diagnostics: [] };
    records.push(rec);
  }
  const groups = {};
  records.forEach((r) => { const k = r.taskId + '|' + r.regime; (groups[k] = groups[k] || []).push(r.score); });
  const aggregates = Object.entries(groups).map(([k, recs]) => {
    const [taskId, regime] = k.split('|');
    return { provider, taskId, regime, ...aggregate(recs) };
  }).sort((a, b) => a.taskId.localeCompare(b.taskId) || a.regime.localeCompare(b.regime));
  return { records, aggregates };
}

function summarize(aggregates) {
  const mean = (xs, f) => xs.length ? xs.reduce((s, a) => s + f(a), 0) / xs.length : 0;
  const per = (regime) => {
    const g = aggregates.filter((a) => a.regime === regime);
    return { archetypeModeShare: mean(g, (a) => a.archetypeModeShare), nodeJaccard: mean(g, (a) => a.nodeJaccard), passRate: mean(g, (a) => a.passRate), fabricationRate: mean(g, (a) => a.fabricationRate) };
  };
  return { tasksCovered: new Set(aggregates.map((a) => a.taskId)).size, R1: per('R1'), R2: per('R2') };
}

async function runGenRepairJudge(provider, tasks, pocket, outDir, log) {
  const p = getProvider(provider);
  const anth = getProvider('anthropic'); // judge always routes here
  const byId = {}; tasks.forEach((t) => { byId[t.id] = t; });

  // 1. generation
  const genItems = planGeneration(pocket, tasks, { regimes: REGIMES, runs: RUNS });
  const gen = await p.submit(genItems, p.subjectModel, { log });
  writeFileSync(join(outDir, provider + '.generation.results.json'), JSON.stringify(gen.results, null, 2));
  const { records } = scoreAll(tasks, gen.results, provider);

  // 2. repair round for parse failures
  const failed = records.filter((r) => !r.score.parses).map((r) => ({
    taskId: r.taskId, regime: r.regime, run: r.run, task: byId[r.taskId], sceneText: r.sceneText, diagnostics: r.score.diagnostics
  }));
  if (failed.length) {
    const rep = await p.submit(planRepair(pocket, failed), p.subjectModel, { log });
    writeFileSync(join(outDir, provider + '.repair.results.json'), JSON.stringify(rep.results, null, 2));
  }

  // 3. judge pass (Sonnet 5 via anthropic) over parsed generations
  const parsed = records.filter((r) => r.score.parses).map((r) => ({
    taskId: r.taskId, regime: r.regime, run: r.run, task: byId[r.taskId], sceneText: r.sceneText
  }));
  const judged = await anth.submit(planJudge(parsed), anth.judgeModel, { log });
  writeFileSync(join(outDir, provider + '.judge.results.json'), JSON.stringify(judged.results, null, 2));
  log('[' + provider + '] done: ' + records.length + ' generations, ' + failed.length + ' repairs, ' + parsed.length + ' judged');
}

async function main() {
  const mode = process.argv[2] || '--dry-run';
  const providerArg = process.argv[3];
  const tasks = loadTasks();
  const pocket = loadPocketSpec();

  if (mode === '--dry-run' || mode === 'dry-run') {
    const { cannedOutputs } = await import('./fixtures/dry-run-outputs.mjs');
    const outputs = {};
    for (const [id, text] of Object.entries(cannedOutputs)) outputs[id] = { text, error: null };
    const { records, aggregates } = scoreAll(tasks, outputs, 'dry');
    const outDir = ensureDir(join(here, 'results', 'dry-run'));
    writeJsonl(join(outDir, 'records.jsonl'), records.map((r) => ({ provider: r.provider, taskId: r.taskId, regime: r.regime, run: r.run, apiError: r.apiError, score: r.score })));
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
    const outDir = ensureDir(join(here, 'results', 'batch-' + Date.now()));
    const items = planGeneration(pocket, tasks, { regimes: REGIMES, runs: RUNS });
    for (const name of resolveProviders(providerArg)) {
      const p = getProvider(name);
      const bodies = name === 'google' ? p.toRequests(items) : p.toRequests(items, p.subjectModel);
      writeJsonl(join(outDir, name + '.generation.requests.jsonl'), bodies);
      console.log('[' + name + '] built ' + bodies.length + ' requests (model=' + p.subjectModel + ')');
    }
    console.log('matrix: ' + tasks.length + ' tasks × ' + REGIMES.length + ' regimes × ' + RUNS + ' runs; judge=claude-sonnet-5');
    console.log('wrote ' + outDir);
    return;
  }

  if (mode === 'live') {
    const chosen = resolveProviders(providerArg);
    // pre-flight: every chosen provider needs its key present
    const missing = chosen.map(getProvider).filter((p) => !process.env[p.envKey]);
    if (missing.length) {
      console.error('live mode is blocked — missing credentials for: ' + missing.map((p) => p.name + ' (' + p.envKey + ')').join(', '));
      console.error('CP-DSL-003 S04 blocker. Fix: `cp .env.example .env` and fill in the key(s), run `npm install`,');
      console.error('then `npm run eval:live` (it auto-loads .env). Or run one provider: `npm run eval:live -- anthropic|google`.');
      process.exit(2);
    }
    const outDir = ensureDir(join(here, 'results', 'live-' + Date.now()));
    const log = (m) => console.log(m);
    for (const name of chosen) await runGenRepairJudge(name, tasks, pocket, outDir, log);
    console.log('live run complete → ' + outDir + ' (score + report in S05)');
    return;
  }

  console.error('unknown mode: ' + mode + '  (use --dry-run | build [provider] | live [provider])');
  process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
