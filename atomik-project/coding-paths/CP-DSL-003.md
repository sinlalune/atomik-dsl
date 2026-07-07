---
type: Atomik Coding Path
title: Generability evaluation — pocket spec × small models × adversarial corpus (D3)
description: Turn batch-03's simulated G1–G6 failure modes into measured numbers — an annotated task corpus, a kernel-as-grader eval harness over the Batches API, a full Haiku 4.5 matrix in two regimes with a Sonnet 5 confabulation judge, and a committed findings report.
tags: [coding-path, dsl, d3, eval]
timestamp: 2026-07-07T00:00:00Z
atomik:
  id: CP-DSL-003
  status: done
  closed: 2026-07-07
  current_step: none
  base_commit: e0dc2ef
---

# Goal

Batch-03 established the generation failure modes (G1–G6) by a large model *simulating* a small one, and prescribed the empirical exit: real small models, multiple runs, a scoring grid, two regimes. Spec §13.2–13.4 names the same tests. This path executes them. The kernel is the grader — parsing every generation under the `generated` profile turns validity, grounding, epistemic fidelity, and repairability into mechanical scores — and the whole experiment is file-durable and rerunnable, so it becomes the regression suite for every future spec version, not a one-off study.

# Owner decisions (scope freeze, 2026-07-07)

- **Subject models:** ~~Haiku 4.5 only~~ **amended 2026-07-07** → **Haiku 4.5 (`claude-haiku-4-5`) *and* Gemini 3.1 Flash-Lite (`gemini-3.1-flash-lite`)**. Rationale: batch-03 calls for "several real small models," and a non-Anthropic subject removes the single-vendor circularity (Anthropic language, Anthropic model, Anthropic judge) — cross-vendor agreement becomes a reported finding, and vendor sensitivity is itself measurable. Both are the cheap-small-model class the DSL targets. Judge stays Anthropic (independence from the subject).
- **Confabulation:** scored by a Sonnet 5 (`claude-sonnet-5`) LLM-judge pass; reported separately from mechanical metrics, marked judged-not-proven. Judge model is fixed regardless of subject provider.
- **Scale:** full matrix per provider — 16 tasks × 5 runs × 2 regimes (≈160 generations) × 2 providers, + repair rounds + judge pass, via each vendor's Batch API (50% pricing both sides). Estimated spend ≤ ~$15.
- **Misconception-acceptance threshold (spec §13.4 "agreed threshold"):** ≥80% of runs on misconception tasks preserve the marked falsehood. Owner may amend before S05 concludes.
- **Dependency decision:** the official `@anthropic-ai/sdk` **and** `@google/genai` enter as **root devDependencies** for the eval app only; `packages/dsl-core` stays dependency-free (the standing prohibition covers the kernels, and CP-DSL-004 vendors only `packages/dsl-core`). Both SDKs are dynamically imported in their provider's submit path only, so the scoring/dry-run paths need neither.

## Verified provider facts (Gemini, from ai.google.dev batch-api docs, 2026-07-07)

- Model id `gemini-3.1-flash-lite` confirmed current (2.0 Flash-Lite retired 2026-06-01).
- Batch: `ai.batches.create({ model, src: inlineRequests, config: { displayName } })`; inline request shape `{ contents: [{ parts: [{text}], role: "user" }], config: { systemInstruction: {parts:[{text}]}, maxOutputTokens } }`.
- Poll `batchJob.state` until `JOB_STATE_SUCCEEDED | _FAILED | _CANCELLED | _EXPIRED`.
- Results at `batchJob.dest.inlinedResponses[i]` → `.response.text` or `.error`. **No correlation key on inline requests — results are order-matched by index**, so the adapter keeps a parallel `customId` array and zips by position. Env key `GEMINI_API_KEY`.

# Definition of done

- **Corpus** (`apps/eval-generability/tasks/`): 16 machine-readable tasks, FR + EN, seeded from batch-03's three probes and batch-04's pedagogy cases plus fresh passages. Each task carries: passage, vault index (legitimate `[[links]]` — G2), `maxClaimStatus` ceiling (G4), required epistemic properties as declarative checks (G3), and expected-archetype hints where one exists (G1).
- **Harness** (`apps/eval-generability/`): builds prompts as *pocket spec verbatim + task*; two regimes (R1 model-plane-only per the pipeline contract, R2 free); submits via the Batches API with `custom_id` keying; scores through the kernel (diagnostics, resolver-backed grounding, property assertions, status ceiling); runs one line-scoped repair round and re-scores; computes per-task stability across the 5 runs (archetype mode share + node/relation Jaccard); judge pass sends passage + scene to Sonnet 5 for unsupported-element flags. One command reruns everything; every run logged as committed JSONL (prompt hash, raw output, IR, scores).
- **Executed**: full Haiku 4.5 matrix + repair + judge, results committed.
- **Report** (new document type — template check against main-repo bedrock 24 first): the batch-03 grid quantified — (a) archetype stability R1 vs R2, (b) fabrication rate, (c) epistemic fidelity incl. the §13.4 threshold verdict, (d) confabulation (judged), (e) one-pass repairability — with per-metric verdicts against G1–G6 and open questions routed to future paths, never silently absorbed here.
- **Spec touchpoint**: language spec §13 items 2–4 annotated as executed with a pointer to the report (changelog-worthy note; surface language untouched).
- **Invariants**: golden fixture byte-identical; kernels unmodified (the harness is a read-only consumer); `packages/dsl-core` gains no dependency.
- Module note, register, log.md, ledger updated at every step; one meaningful diff per step.

# Documentation coverage

Completeness rule: every document of this repository appears below at least once.

## Required

- `AGENTS.md`
- `docs/bedrock/00_00-orientation.md`
- `docs/bedrock/atomik_dsl_spec_v0_3.md` (v0.3.1 — §8 pipeline contract, §10 generator card, §13 falsification tests)
- `docs/bedrock/atomik_pocket_spec_v0_3.md` — the actual prompt artifact under test
- `docs/bedrock/atomik_render_core_spec_v0_1.md` (§2 IR — what the grader consumes)
- `atomik-project/sources/atomik-corpus-test-batch-03-generability.md` — the protocol source; task seeds
- `atomik-project/sources/atomik-corpus-test-batch-04-pedagogy.md` — misconception task seeds
- `docs/modules/dsl-core.md`
- `packages/dsl-core/fixtures/atomik_scene_ir_golden_northstar_v0_1.json` (gate: must not move)

## Conditional

- Main-repo `24_24-doc-templates.md` (at `~/projects/4tom1k`) — before S05: the report is a new document type; check for an applicable template.
- `docs/bedrock/atomik_guide_accessible_v0_3.md` — only if findings change author-facing guidance.
- `docs/adr/ADR-DSL-001-standalone-dual-plane-library-repo.md` — only if the dependency decision needs escalation to an ADR.
- `atomik-project/sources/atomik-corpus-test-batch-01.md` / `-02.md` — ad hoc, if a task seed needs an expressivity case.

## Deliberately excluded

- `atomik-project/brainstorm/open-questions.md` — findings may *feed* it, but nothing here resolves it.
- `README.md`, `atomik-project/sessions/` — no contract touched.
- `CP-DSL-004` — integration path; eval results inform it but don't change its scope.
- `apps/prototype-cycle/` — untouched by this path.
- Acting on findings (spec changes, new pipeline stages, pocket-spec rewrites) — each is its own future path; this path measures.

# Execution

- [x] S01 Open the path: ledger with base commit and owner decisions; register D3 → active; ACTIVE.md; orientation roadmap; log. Record the credentials blocker (no ANTHROPIC_API_KEY in the environment yet — blocks S04 only).
- [x] S02 Task corpus: 16 annotated tasks under `apps/eval-generability/tasks/` + a task-schema note; validate annotations mechanically (vault indexes well-formed, property checks executable, status ceilings in the closed vocabulary).
- [x] S03 Harness: prompt builder (R1/R2), Batches API client (official SDK, root devDependency), kernel-as-grader scorer, repair round, stability aggregation, judge-pass builder, JSONL logging; dry-run mode (no API) proves the full pipeline on canned outputs; npm script.
- [x] S04 Execute: generation → repair → judge, both providers (Haiku 4.5 + Gemini 3.1 Flash-Lite), Sonnet 5 judge; raw results committed. Three live API bugs found and fixed en route (custom_id pattern, Gemini candidates-path extraction, Gemini metadata.key correlation) — the last mislabeled every Gemini scene until fixed and re-run; verified by a probe + task-match spot-check.
- [x] S05 Score + report: `report.mjs` → `docs/evals/generability_eval_v0_3_1.md` + `analysis.json` (adapts the bedrock-24 capability-eval template); spec §13 tests 2–4 annotated as executed; §13.4 threshold PASS both providers. Guide unchanged — findings validate existing author-facing behavior, they don't revise it.
- [x] S06 Same-work-unit docs audit and close: register, ACTIVE.md, orientation, log, ledger; fixture-diff gate re-check.

# Current checkpoint

```text
base commit : e0dc2ef (branch master — CP-DSL-002 closed, 65/65 green)
changed     : S03 — harness (pure, dependency-free) + multi-provider adapter
              layer under apps/eval-generability/. Vendor-neutral core:
              scorer.mjs (kernel-as-grader: generated-profile parse + vault
              resolver → validity, grounding, status ceiling, choreography-rule,
              15 property checks, structural signatures), prompt.mjs (system =
              pocket spec VERBATIM; R1 model-plane-only / R2 free; repair +
              judge builders), stability.mjs (archetype mode share, node/relation
              Jaccard, pass/fabrication rates), batch.mjs (vendor-neutral
              plan items + id scheme + scene extraction). Providers:
              providers/anthropic.mjs (Batches, keyed by custom_id) +
              providers/google.mjs (Gemini batch, inline requests, ORDER-zipped
              by index — verified against ai.google.dev docs) + registry;
              each dynamically imports its SDK in the submit path only, so
              scoring/dry-run load no node_modules. run.mjs orchestrator
              (--dry-run | build [provider] | live [provider]); judge always
              routes through the anthropic provider (Sonnet 5) regardless of
              subject. test_harness.mjs = 36 assertions incl. offline Gemini
              body-shape + order-zipping. Dry-run scores 10 canned runs and
              surfaces every failure mode (1 parse fail, 1 G2 fab, 1 G4 breach,
              0.67 drift). build assembles both providers' 160-request matrices;
              live pre-flights each chosen provider's key and blocks cleanly.
tests       : 65 passing; eval:test 36/36; eval:validate 16/16; dry-run +
              build(both) green; fixture untouched; no dep added to dsl-core
S04 IN FLIGHT (2026-07-07): owner provided both keys (loaded from gitignored
              .env); deps installed + both keys auth-verified (Haiku 4.5 + Gemini
              3.1 Flash-Lite each replied "OK"). Two live bugs found and fixed
              before spend: (1) authcheck module-resolution from scratchpad —
              cosmetic; (2) **custom_id contained ':' — Anthropic Batches API
              requires ^[a-zA-Z0-9_-]{1,64}$, so the first launch was rejected
              at batch creation with NO tokens billed**; separator changed to
              '_' (commit 668dc39). Re-launched: **Anthropic side completed in
              full** (generation 218KB / repair / judge all written) in
              results/live-1783426556456/. Two more live bugs, both fixed
              (commit 39db2dc): (3) Gemini batch text lives at
              candidates[0].content.parts[].text, not the live-only .text getter
              — all 160 Gemini generations were valid but scored 'missing';
              verified fix re-parses the real SUCCEEDED job 160/160; (4) a
              0-item repair/judge batch 400s — now skipped. Added `live --into
              <dir>` to resume one provider without re-paying the other. Google
              phases resuming into the same dir (batch egc3a...); Anthropic data
              preserved. Only Gemini generation (~5¢) re-run; nothing else
              re-paid. Self-test 37/37.
path closed 2026-07-07 — definition-of-done audit:
  ✓ 16-task annotated corpus + mechanical validator (eval:validate 16/16)
  ✓ kernel-as-grader harness, multi-provider, dependency-free scoring paths;
    self-test 39/39; dry-run proves the pipeline offline
  ✓ full matrix executed: Haiku 4.5 + Gemini 3.1 Flash-Lite, 16×2×5 each,
    + repair + Sonnet 5 judge; raw results committed (612K, reproducible)
  ✓ findings report docs/evals/generability_eval_v0_3_1.md + analysis.json;
    G1–G6 verdicts, cross-vendor comparison, §13.4 threshold PASS both
  ✓ spec §13 tests 2–4 annotated executed; pocket spec used verbatim
  ✓ kernels untouched (harness is a read-only consumer); dsl-core gains no
    dependency; golden fixture byte-identical to base:
    git diff e0dc2ef..HEAD -- packages/dsl-core/fixtures/ → empty
  ✓ module note, register, log, ledger, orientation updated
  three live bugs found+fixed with no fabricated results (custom_id pattern,
  Gemini candidates-path, Gemini metadata.key correlation); each caught by
  early verification before trusting numbers
next        : findings feed future paths (spec/pipeline changes, broader eval
              population) — each its own path; D4 (workbench integration)
              executes in the main repo after its S00 owner amendment.
blockers    : none.
```

# Blockers

- **S04 credentials**: no `ANTHROPIC_API_KEY` in the environment and no `ant` profile. S02–S03 proceed; S04 waits on the owner.
