# Generability eval — task corpus (CP-DSL-003)

One JSON file per task. A task is a source passage plus machine-checkable
annotations; the kernel + these annotations grade every generation (batch-03
grid, spec §13.2–13.4). Seeds: batch-03 probes A/B/C, batch-04 gestures
P1/P2/P4, spec §9 worked examples, plus fresh passages. FR + EN mix on purpose:
content is user-language, keywords are the interlingua.

## Schema

```jsonc
{
  "id": "kebab-id",                  // unique
  "lang": "fr" | "en",
  "seed": "provenance note",
  "passage": "the text the model generates from (60–120 words)",
  "vaultIndex": ["Note title", …],   // the ONLY notes that exist (G2);
                                     // any other [[link]] is a fabrication.
                                     // Empty array = linking anything is a fabrication.
  "allowedClaimStatuses": [ … ],     // G4 ceiling: claim [status] must be one of
                                     // these (closed vocabulary; "never stronger
                                     // than the source"). Explicit list — the spec
                                     // defines no total strength order.
  "teachingSequence": false,          // true → the prompt states the user asked
                                     // for a teaching sequence (steps/gates legal
                                     // AND expected; otherwise they are a violation
                                     // of pocket-spec rule 1)
  "expectedArchetype": "cycle",      // optional; context for the G1 stability
                                     // numbers, never scored as right/wrong
  "properties": [ { "id": "...", "check": "<type>", …params } ]
}
```

## Property check types (implemented by the scorer, S03)

| check | params | passes when |
|---|---|---|
| `nodeMatching` | `pattern`, `min?=1` | ≥min nodes/evidence whose label matches the regex (case-insensitive) |
| `nodeStatusMatching` | `pattern`, `status` | some node matching the regex carries exactly that status |
| `relationClass` | `class`, `min?=1` | ≥min relations with that `[as]` class |
| `relationToClaim` | `min?=1` | ≥min relations with a `claim` endpoint |
| `evidenceCount` | `min` | ≥min nodes with role `evidence` |
| `datedEvidence` | `min` | ≥min evidence nodes carrying `[date]` |
| `evidenceEdge` | — | some relation joins two evidence-role nodes |
| `edgeClassNot` | `pattern`, `forbidden[]` | every relation touching a node matching the regex has a class outside `forbidden` (hedges must survive — G3/G4) |
| `minNodes` | `n` | IR has ≥n nodes |
| `directedEdges` | `min` | ≥min directed node→node relations |
| `placesValue` | `min` | ≥min `place … at <value>` entries |
| `placesRelative` | `min` | ≥min relative `place` entries |
| `signedEdges` | `min` | ≥min relations carrying `[sign]` |
| `hasSteps` | — | IR has ≥1 step (teaching tasks only) |
| `hasGate` | — | some step has a non-empty `requires` (the C4 gate) |

Every task additionally gets the implicit checks: parses under the `generated`
profile, claim status ∈ `allowedClaimStatuses`, zero fabricated wikilinks
(resolver backed by `vaultIndex`).

`validate_tasks.mjs` (one directory up) checks this schema mechanically; run it
after any corpus edit.
