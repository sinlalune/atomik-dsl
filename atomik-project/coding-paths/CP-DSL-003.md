---
type: Atomik Coding Path
title: Generability evaluation — pocket spec × small models × adversarial corpus (D3)
description: Turn batch-03's simulated G1–G6 failure modes into measured numbers — an annotated task corpus, a kernel-as-grader eval harness over the Batches API, a full Haiku 4.5 matrix in two regimes with a Sonnet 5 confabulation judge, and a committed findings report.
tags: [coding-path, dsl, d3, eval]
timestamp: 2026-07-07T00:00:00Z
atomik:
  id: CP-DSL-003
  status: active
  current_step: S03
  base_commit: e0dc2ef
---

# Goal

Batch-03 established the generation failure modes (G1–G6) by a large model *simulating* a small one, and prescribed the empirical exit: real small models, multiple runs, a scoring grid, two regimes. Spec §13.2–13.4 names the same tests. This path executes them. The kernel is the grader — parsing every generation under the `generated` profile turns validity, grounding, epistemic fidelity, and repairability into mechanical scores — and the whole experiment is file-durable and rerunnable, so it becomes the regression suite for every future spec version, not a one-off study.

# Owner decisions (scope freeze, 2026-07-07)

- **Subject model:** Haiku 4.5 (`claude-haiku-4-5`) only — the cheap-small-model class the DSL targets.
- **Confabulation:** scored by a Sonnet 5 (`claude-sonnet-5`) LLM-judge pass; reported separately from mechanical metrics, marked judged-not-proven.
- **Scale:** full matrix — 16 tasks × 5 runs × 2 regimes (≈160 generations + 1 repair round + judge pass), all via the Message Batches API (50% pricing). Estimated spend $3–8.
- **Misconception-acceptance threshold (spec §13.4 "agreed threshold"):** ≥80% of runs on misconception tasks preserve the marked falsehood. Owner may amend before S05 concludes.
- **Dependency decision:** the official `@anthropic-ai/sdk` enters as a **root devDependency** for the eval app only; `packages/dsl-core` stays dependency-free (the standing prohibition covers the kernels, and CP-DSL-004 vendors only `packages/dsl-core`).

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
- [ ] S03 Harness: prompt builder (R1/R2), Batches API client (official SDK, root devDependency), kernel-as-grader scorer, repair round, stability aggregation, judge-pass builder, JSONL logging; dry-run mode (no API) proves the full pipeline on canned outputs; npm script.
- [ ] S04 Execute: generation batch (Haiku 4.5, full matrix) → repair batch → judge batch (Sonnet 5); commit raw logs. **Blocked on owner-provided API key.**
- [ ] S05 Score + report: aggregate, write the findings document (template check first), annotate spec §13, thresholds verdict; guide check if author-facing findings.
- [ ] S06 Same-work-unit docs audit and close: register, ACTIVE.md, orientation, log, ledger; fixture-diff gate re-check.

# Current checkpoint

```text
base commit : e0dc2ef (branch master — CP-DSL-002 closed, 65/65 green)
changed     : S02 — 16 annotated tasks in apps/eval-generability/tasks/
              (batch-03 A/B/C, batch-04 P1/P2/P4/P5, spec §9 cases, fresh FR/EN
              passages); tasks/README.md schema + 15 property-check types;
              validate_tasks.mjs (schema/status-ceiling/regex/param checks) wired
              as npm run eval:validate — 16/16 valid. Proved achievability +
              scorer logic against a hand-authored ideal for task 05 (0 error
              diagnostics, status in ceiling, 0 fabricated links, all 3
              properties PASS) and the G2 fabrication detector fires on an
              out-of-vault link. Corpus spans all six G-ruptures + the archetype
              set; four teaching tasks exercise misconception+refutation+gate.
tests       : 65 passing / 0 failed; eval:validate 16/16; no kernel change
next action : S03 — harness (prompt builder R1/R2, Batches client, kernel-as-
              grader scorer, repair round, stability + judge builders, JSONL);
              dry-run mode proves the pipeline with no API
blockers    : S04 requires an Anthropic API key; environment has none
              (ANTHROPIC_API_KEY unset, no ant CLI). Owner provides before S04.
```

# Blockers

- **S04 credentials**: no `ANTHROPIC_API_KEY` in the environment and no `ant` profile. S02–S03 proceed; S04 waits on the owner.
