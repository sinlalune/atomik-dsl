---
type: Atomik Capability Evaluation
title: "Generability evaluation — pocket spec × Haiku 4.5 × Gemini 3.1 Flash-Lite"
description: Batch-03 G1–G6 grid, measured. Two cheap small models generate atomik from an annotated adversarial corpus; the kernel grades every scene; a Sonnet 5 judge scores confabulation.
tags: [eval, dsl, generability, d3]
timestamp: 2026-07-07T13:24:54.980Z
atomik:
  path: CP-DSL-003
  irVersion: "0.1"
  adaptsTemplate: "24_24-doc-templates.md#retrieval-local-capability-evaluation (nearest genre; sections driven by batch-03 G1–G6 and spec §13)"
---

# Generability evaluation (D3)

Batch-03 established the generation failure modes G1–G6 by a large model *simulating* a small one and prescribed the empirical exit: real small models, multiple runs, a scoring grid, two regimes. This is that run, executed. **The kernel is the grader** — every generation is parsed under the `generated` profile with a vault-backed resolver, turning validity, grounding, epistemic ceiling, and structural properties into mechanical scores; a Sonnet 5 judge adds a confabulation read (marked *judged-not-proven*).

- **Subjects:** claude-haiku-4-5, gemini-3.1-flash-lite. **Judge:** claude-sonnet-5.
- **Matrix:** 16 annotated tasks × 2 regimes (R1 model-plane-only per the §8/§10 pipeline contract; R2 free) × 5 runs per provider. System prompt = the pocket spec *verbatim* (the artifact under test).
- **Results dir:** `apps/eval-generability/results/live-1783426556456` · generated 2026-07-07T13:24:54.980Z.

> **Caveat.** These are two models on one corpus, not a population. The mechanical scores are reproducible from the committed raw results; the confabulation numbers are one judge model's opinion. Treat magnitudes as directional, and the cross-vendor *pattern* as the load-bearing finding.

## Headline — G1–G6 verdicts

- **G1 archetype stability** — R1 (model-plane-only) mean archetype mode-share anthropic 84.0%, google 85.0% vs R2 (free) anthropic 73.0%, google 84.0%. Higher R1 than R2 supports the batch-03 lever: fixing the plane and letting projection be user-flippable stabilizes generation.
- **G2 reference grounding** — anthropic fabrication rate R1 0.0%, google fabrication rate R1 0.0% (links outside the task vault index).
- **G3 G4 epistemic fidelity** — anthropic status-ceiling hold R1 91.0%, judged unsupported-element rate 78.0%; google status-ceiling hold R1 84.0%, judged unsupported-element rate 65.0%.
- **G5 scope** — Not directly scored; the no-archetype task (career-decision) and node-count variance across runs are the proxy — see per-task node Jaccard.
- **G6 repairability** — anthropic fixed 16/21 parse failures (76.0%); google fixed 12/21 parse failures (57.0%).
- **misconception acceptance** — anthropic 100.0% (20/20, PASS); google 95.0% (19/20, PASS).

## Per-provider rollup

### anthropic (claude-haiku-4-5)

| metric | R1 (model-plane-only) | R2 (free) |
|---|---|---|
| archetype mode-share (G1 ↑ better) | 84.0% | 73.0% |
| node Jaccard across runs (↑ stabler) | 42.0% | 41.0% |
| relation Jaccard across runs | 17.0% | 19.0% |
| headline pass rate | 66.0% | 46.0% |
| fabrication rate (G2 ↓ better) | 0.0% | 0.0% |
| status-ceiling hold (G4 ↑ better) | 91.0% | 74.0% |
| parse-fail rate (↓ better) | 11.0% | 15.0% |

- **Repairability (G6):** one line-scoped repair round fixed 16/21 parse failures (76.0%).
- **Confabulation (judged):** 131 scenes judged; unsupported-element rate 78.0%, over-confident-claim 29.0%, flattened-hedge 37.0% (8 judge replies unparseable).
- **Misconception acceptance (§13.4, ≥80.0%):** 100.0% of R1 runs on misconception tasks preserved the marked falsehood (20/20) — **PASS**.

### google (gemini-3.1-flash-lite)

| metric | R1 (model-plane-only) | R2 (free) |
|---|---|---|
| archetype mode-share (G1 ↑ better) | 85.0% | 84.0% |
| node Jaccard across runs (↑ stabler) | 38.0% | 42.0% |
| relation Jaccard across runs | 15.0% | 15.0% |
| headline pass rate | 61.0% | 44.0% |
| fabrication rate (G2 ↓ better) | 0.0% | 0.0% |
| status-ceiling hold (G4 ↑ better) | 84.0% | 81.0% |
| parse-fail rate (↓ better) | 8.0% | 19.0% |

- **Repairability (G6):** one line-scoped repair round fixed 12/21 parse failures (57.0%).
- **Confabulation (judged):** 129 scenes judged; unsupported-element rate 65.0%, over-confident-claim 21.0%, flattened-hedge 40.0% (10 judge replies unparseable).
- **Misconception acceptance (§13.4, ≥80.0%):** 95.0% of R1 runs on misconception tasks preserved the marked falsehood (19/20) — **PASS**.

## Cross-vendor comparison (R1, the pipeline-contract regime)

| metric | anthropic | google |
|---|---|---|
| archetype mode-share | 84.0% | 85.0% |
| node Jaccard | 42.0% | 38.0% |
| pass rate | 66.0% | 61.0% |
| fabrication rate | 0.0% | 0.0% |
| status-ceiling hold | 91.0% | 84.0% |
| parse-fail rate | 11.0% | 8.0% |

The question this answers: is the pocket spec vendor-neutral, or quietly tuned to one house model? Agreement across two independent small models is evidence the spec — not the model — carries the behavior. Divergence localizes where the spec leans on one vendor's instincts.

**Reading.** The two models agree closely on the guarantees the DSL was built for: **zero fabricated references** on both (grounding the vault index in the prompt works), **misconception preservation above threshold on both** (the north-star gesture survives generation), and high status-ceiling hold. That agreement across independent vendors is the evidence that these behaviors are carried by the spec + kernel-grader, not by one house model. The **shared weaknesses are equally informative and confirm batch-03's central thesis** — the risk is in *judgment*, not *mechanics*: judged confabulation (unsupported elements) is high on both, and cross-run **structural stability is low** (node Jaccard ~0.4; the same passage regenerates into recognizably different node/edge sets), which is the file-diff-noise concern. Both point at the generation *pipeline* (framing, grounding, forced epistemic slots — spec §8), not the language surface. The one clear vendor difference is the **model-plane lever**: constraining to the model plane (R1) lifts Haiku's archetype stability markedly (73%→84%) but barely moves Gemini (84%→85%), which is already stable unconstrained — so the "emit model-only, user flips the projection" rule earns its keep more on some models than others, but never hurts.

## Spec §13 falsification tests

- **§13.2 archetype stability under model-only generation** — measured as R1 archetype mode-share above. R1-vs-R2 tests the model/projection-split lever.
- **§13.4 misconception acceptance** — measured against the ≥80.0% threshold above.
- **Pocket-spec token budget (§13.3)** — unchanged this path (~1.2K, verified in CP-DSL-001); the spec text was used verbatim as the system prompt.

## What this does not settle (routed onward, not absorbed)

- Two models are not a population; broaden the subject set and corpus before treating magnitudes as fixed (a future D-path, not this one).
- Confabulation is one judge's read; a human epistemic-fidelity review would harden it.
- G5 (scope from a passage) is only proxied here; a dedicated framing eval is future work.
- Acting on any weakness found (spec change, a pipeline stage, a pocket-spec rewrite) is its own coding path — this path measures.

Raw per-request results (generation, repair, judge, both providers) are committed alongside this report; `analysis.json` carries the full per-task numbers behind these rollups.
