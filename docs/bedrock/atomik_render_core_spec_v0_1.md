# atomik render-core — Specification v0.1 (draft)

Status: draft. Companion to `atomik_dsl_spec_v0_3.md` (the language spec). That document defines what scenes *say*; this one defines how they become pixels — and, more importantly, the **Scene IR**: the data structure everything else consumes. The IR is the expensive decision; layout algorithms can be iterated, the IR cannot be changed cheaply once consumers exist.

Feedback loop: three places where writing this spec forced constraints back onto the language spec are flagged as **errata candidates (C1–C3)** for a v0.3.1.

---

## 1. Position in the architecture

Per the kernel split (doc 14):

```
.atomik text ──lang-core──▶ Scene IR ──render-core──▶ RenderPlan ──render-react──▶ DOM/SVG
                (parse, ground,        (project, layout,      (paint, events,
                 validate, default,     theme → geometry)      step navigation)
                 print, diagnose)
```

- **lang-core** owns text ↔ IR. Tokenize, parse, ground references, validate (both profiles), fill defaults, compute derived flags, print canonical form. No React, no DOM, no filesystem.
- **render-core** owns IR → RenderPlan. Projection dispatch, per-archetype layout, theme token resolution, the *pure* runtime state function. No DOM.
- **render-react** owns RenderPlan → DOM. Painting, input widgets, step navigation UI, event wiring. No layout math.

Dependency direction: render-react → render-core → shared-types ← lang-core. The renderer never re-reads source text; if it needs something, the IR must carry it.

---

## 2. The Scene IR

### 2.1 Principles

- **P1 — Fully resolved.** Wikilinks grounded, defaults filled, evidence desugared, step numbering normalized. The renderer trusts what it receives.
- **P2 — Semantic only.** No geometry, no colors, no pixels. Those live in the RenderPlan (§4), which is engine-internal and loosely versioned. The IR is the frozen contract.
- **P3 — JSON-serializable.** The IR can be cached, snapshot-tested, sent across the Electron boundary, indexed.
- **P4 — Independently versioned.** `irVersion` evolves separately from surface syntax. A v0.4 surface keyword maps into the same IR if possible; consumers don't move.
- **P5 — Provenance everywhere.** Every entity carries its source line(s). This is what lets diagnostics point at lines and lets the AI patch pipeline target single-line edits (batch-03 repair loop).

### 2.2 Shape (TypeScript notation, normative)

```ts
interface SceneIR {
  irVersion: "0.1"
  surface: { language: "atomik"; version: string }      // e.g. "0.3"
  origin: "authored" | "generated"
  diagnostics: Diagnostic[]                              // warnings survive into IR
  scene: { id: string; line: number }
  claim: { text: string; status: Status; line: number }
  subject?: { label: Label; line: number }
  groups: Group[]
  nodes: NodeIR[]                                        // evidence desugared here
  relations: RelationIR[]
  places: PlaceIR[]
  data: DataTable[]
  projection?: ProjectionIR
  inputs: InputIR[]
  deriveds: DerivedIR[]
  rules: RuleIR[]
  steps: StepIR[]                                        // normalized, ordered
  marks: MarkIR[]
}

type Status = "established" | "supported" | "contested" | "hypothesis"
            | "speculative" | "reported" | "misconception" | "unspecified"
type RelClass = "fact" | "inference" | "hypothesis" | "analogy"
              | "interpretation" | "refutation" | "boundary" | "unspecified"
type Role = "process" | "decision" | "start" | "terminal"
          | "question" | "evidence" | "assumption" | "contradiction"

type Ref = { kind: "note"; target: string }      // resolved
         | { kind: "unresolved"; raw: string }   // authored link to a not-yet-existing note
         | { kind: "literal" }                   // plain text, never was a link
interface Label { text: string; ref: Ref }

interface NodeIR {
  id: string
  label: Label
  role: Role                        // default "process"
  status: Status                    // default "unspecified"
  group?: string
  salience?: "criterial" | "incidental"
  tone?: string
  source?: Label                    // evidence provenance
  date?: string
  initiallyHidden: boolean          // computed, see D4
  line: number
  extras: Record<string, string | true>   // unknown attrs, preserved (D8)
}

type Endpoint =
  | { kind: "node"; id: string }
  | { kind: "relation"; id: string }
  | { kind: "claim" }

interface RelationIR {
  id: string                        // always present, see D7
  idSource: "authored" | "synthetic"
  from: Endpoint
  to: Endpoint
  directed: boolean                 // "->" true, "~" false
  kind: string                      // free author token, e.g. "réfute"
  class: RelClass
  sign?: "+" | "-"
  weight?: number
  many?: boolean
  label?: string
  status: Status
  initiallyHidden: boolean
  line: number
  extras: Record<string, string | true>
}

interface Group {
  id: string; label?: string
  kind: "cluster" | "lane" | "loop"
  polarity?: "reinforcing" | "balancing"
  line: number
}

type PlaceIR = { node: string; line: number } & (
  | { mode: "value"; at: number }
  | { mode: "relative"; rel: "above" | "below" | "left-of" | "right-of" | "inside" | "adjacent"; anchor: string }
)

interface DataTable { id: string; cols: string[]; rows: string[][]; lines: number[] }

interface ProjectionIR {
  archetype: "graph" | "flow" | "cycle" | "tree" | "nested" | "concentric"
           | "timeline" | "axis" | "matrix" | "bar" | "map"
  from?: string
  range?: [number, number]
  scale?: "linear" | "log"
  label?: string
  suggested: boolean
  line: number
}

interface InputIR {
  id: string
  control: { type: "slider"; min: number; max: number; default?: number }
         | { type: "choice"; options: string[]; default?: string }
         | { type: "toggle"; default?: boolean }
  label?: string
  committedByDefault: boolean       // slider/toggle: true; choice without default: false
  line: number
}

type Expr =
  | { op: "lit"; value: number | string }
  | { op: "ref"; id: string }
  | { op: "not"; a: Expr }
  | { op: "+" | "-" | "*" | "/" | "==" | "!=" | "<" | "<=" | ">" | ">="
      | "and" | "or"; a: Expr; b: Expr }

interface DerivedIR { id: string; expr: Expr; line: number }

type EffectIR =
  | { type: "note"; text: string }
  | { type: "reveal" | "hide" | "highlight"; targets: string[] }   // node or relation ids
  | { type: "set"; input: string; value: number | string }
  | { type: "require"; input: string }

interface RuleIR { when: Expr; effect: EffectIR; line: number }
interface StepIR { index: number; sourceStep: number; effects: EffectIR[]; requires: string[]; lines: number[] }
interface MarkIR { kindOfMark: "meter"; label: string; value: string; max?: number; line: number }
interface Diagnostic { line: number; code: string; severity: "error" | "warning"; message: string; hint?: string }
```

### 2.3 The decisions this locks (D1–D11)

- **D1 — The renderer never re-parses.** Everything visual-relevant is in the IR. If a future feature needs source access from the renderer, that is an IR design failure, not a shortcut to take.
- **D2 — Endpoints are a discriminated union.** `node | relation | claim`. Relation-to-relation (argument maps, analogy boundaries) is legal in the IR; layout v0.1 attaches such edges at the target edge's midpoint. `claim` is a singleton endpoint with no id.
- **D3 — References are grounded before the IR, with profile-dependent fallback.** Grounding runs in lang-core; the renderer contains zero link-resolution logic. In the **generated** profile, unresolvable links may not exist: the generator emits literals (language spec §10), so `unresolved` never appears. In the **authored** profile, a wikilink to a note that does not exist yet is *legitimate and preserved* as `{ kind: "unresolved" }` — linking to future notes is how a file-first vault grows. The renderer shows it as a broken-link affordance (§8); creating the note is the host app's action, not the renderer's.
- **D4 — Initial visibility is computed by lang-core, not the renderer.** Rule: any id targeted by any `reveal` effect (in a **step or a rule**) has `initiallyHidden: true`; everything else starts visible; an id targeted by both `reveal` and `hide` starts hidden. Stored per element. → **Erratum candidate C1**: language spec §6 said "named in some `step n reveal`"; this generalizes to rule-reveals (otherwise a rule's reveal is meaningless) and resolves the reveal+hide conflict.
- **D5 — Expressions are ASTs, never strings.** The runtime interprets `Expr` trees; there is no `eval`, no string execution, anywhere. This is the Electron security contract applied to the DSL: scene files are data even when they compute.
- **D6 — Provenance on every entity.** `line` fields are what make diagnostics line-scoped and AI patches single-line-targetable. The canonical printer guarantees line stability for unedited statements.
- **D7 — Relations always have ids.** Authored ids are preserved; missing ids are synthesized (`~r1`, `~r2`… prefix outside the identifier grammar so they can never collide with, or be referenced by, source text). Effects may target authored relation ids; synthetic ids are engine-internal.
- **D8 — Unknown attributes survive into `extras`.** The forward-compatibility valve continues into the IR: the printer round-trips them, future renderers may read them, current ones ignore them.
- **D9 — `evidence` is sugar, desugared here.** A node with `role: "evidence"` + `source`/`date`. No separate evidence entity; one less consumer concept.
- **D10 — Canonical array order.** IR arrays mirror the canonical printer order (groups, nodes in first-mention order, relations, …). IR diffs are as stable as file diffs (G1 continued).
- **D11 — Runtime purity (see §5).** Render state is a pure function of `(currentStep, inputValues)`. To guarantee this, `set` is **forbidden inside `rule`** (validator error, both profiles): a rule writing an input can loop. `set` remains legal in `step` (applied once on step entry). → **Erratum candidate C2** for the language grammar, which currently allows `set` in both.

### 2.4 IR excerpt — the north-star scene

Abbreviated (full version = golden fixture #1, §9: `atomik_scene_ir_golden_northstar_v0_1.json`, which also fixes the canonical line layout):

```json
{
  "irVersion": "0.1",
  "surface": { "language": "atomik", "version": "0.3" },
  "origin": "authored",
  "claim": { "text": "In the absence of air, all objects fall at the same rate.",
             "status": "established", "line": 3 },
  "nodes": [
    { "id": "belief", "label": { "text": "Heavy objects fall faster", "ref": { "kind": "literal" } },
      "role": "process", "status": "misconception",
      "initiallyHidden": true, "line": 6, "extras": {} },
    { "id": "vacuum", "label": { "text": "Hammer and feather dropped in a vacuum", "ref": { "kind": "literal" } },
      "role": "evidence", "status": "unspecified",
      "initiallyHidden": true, "line": 7, "extras": {} }
  ],
  "relations": [
    { "id": "~r1", "idSource": "synthetic",
      "from": { "kind": "node", "id": "vacuum" }, "to": { "kind": "node", "id": "belief" },
      "directed": true, "kind": "refutes", "class": "refutation",
      "status": "unspecified", "initiallyHidden": false, "line": 10, "extras": {} }
  ],
  "inputs": [
    { "id": "guess",
      "control": { "type": "choice", "options": ["hammer first", "together", "feather first"] },
      "label": "Predict:", "committedByDefault": false, "line": 14 }
  ],
  "steps": [
    { "index": 1, "sourceStep": 1,
      "effects": [ { "type": "reveal", "targets": ["belief"] },
                   { "type": "note", "text": "Most people expect the heavy object to win." } ],
      "requires": [], "lines": [17, 18] },
    { "index": 2, "sourceStep": 2,
      "effects": [ { "type": "reveal", "targets": ["vacuum"] } ],
      "requires": ["guess"], "lines": [19, 20] }
  ]
}
```

Note what the IR made explicit that the text left implicit: `initiallyHidden` computed, role defaults filled, the synthetic relation id, `committedByDefault: false` on the choice, per-entity lines.

---

## 3. Render pipeline stages

```
SceneIR → resolveProjection → layout[archetype] → applyTheme → RenderPlan
                                     ↑
                          RuntimeState (step, inputs)   — §5
```

1. **resolveProjection**: `projection.archetype`, else `graph`. Unknown archetype (future version): fall back to `graph`, add warning badge.
2. **layout[archetype]** (§6): consumes the IR subset it declares, plus the current visibility set; emits positioned geometry.
3. **applyTheme** (§7): statuses/roles/classes → visual tokens.
4. **RenderPlan**: positioned, themed marks. Re-computed on every runtime state change; layout must be deterministic (§6, L1) so recomputation is stable.

---

## 4. RenderPlan (engine-internal, loosely versioned)

Not a frozen contract; sketched here so render-react has a target:

```ts
interface RenderPlan {
  viewport: { w: number; h: number }        // intrinsic, before embedding constraints
  regions: PositionedRegion[]                // groups, lanes, loop badges
  glyphs: PositionedNode[]                   // x,y,w,h + resolved tokens + a11y text
  edges: RoutedEdge[]                        // path points + terminator style + tokens
  axes?: AxisSpec[]                          // ticks, labels, scale
  widgets: WidgetSpec[]                      // inputs, meters, step navigator, notes
  overlays: Overlay[]                        // status chip, projection-flip affordance, warnings
}
```

Only two hard rules here: every glyph carries **a11y text** (see §8), and every visual mark traces back to an IR entity id (hit-testing → provenance → "open the line").

---

## 5. Runtime state machine

**State** = `(currentStep, inputValues, committedInputs)`. Nothing else. **RS1 (purity):** everything visible is a pure function of this state — no hidden history, no latches. Same state ⇒ same render, always. This is what makes scenes testable and diffs meaningful.

- **Visibility(id)**: start from `initiallyHidden`; apply step effects for steps `1..currentStep` in document order; then apply effects of rules whose condition is currently true, in document order. Reveal/hide/highlight from rules are **reactive**: they hold while the condition holds, release when it stops. (No latching — RS1.)
- **Edge effective visibility**: a relation paints only when its own visibility is true **and** both endpoints are visible (for an endpoint of kind `relation`, that relation's effective visibility; for `claim`, always visible). Revealing a node therefore reveals its edges to already-visible nodes without any extra effect line.
- **Notes** are transient: show the current step's notes + notes of currently-true rules. Earlier steps' notes are gone. → **Erratum candidate C3**: language spec §6 didn't state note lifetime.
- **Derived values** recompute on any input change; reference cycles among `derive` are a validation error (lang-core detects).
- **Gates — gated-step semantics (C4)**: a step with non-empty `requires` is a *gated step*. Two consequences, both pure (the committed set is part of runtime state): (1) **its own effects apply only while every required input is committed** — so `step 2 require guess` + `step 2 reveal vacuum` withholds the evidence until the learner has predicted, which is the intended predict-then-see shape (north-star scene) and the shape authors will write naturally; (2) advancing past it stays blocked until committed. `committed` = user has interacted, or `committedByDefault` (sliders/toggles, and choices with `[default]`). The step navigator shows a locked state with the input highlighted. *(C4: found while writing the golden fixture's runtime oracle — the earlier "blocks exit only" semantics let a same-step reveal spoil the prediction.)*
- **`set`** applies once, on step entry (D11). Forbidden in rules.
- **Step navigation**: next/prev; prev never un-commits inputs; jumping forward past a gate is impossible, jumping backward is free.
- **Export/print state**: the "all-revealed" state (every reveal applied, gates ignored) with step badges on step-revealed elements. A printed scene must not silently hide teaching content.

---

## 6. Layout contracts per archetype

Global rules first:

- **L1 — Deterministic.** Same IR + same state ⇒ identical geometry. Any stochastic algorithm (force-directed `graph`) runs with a fixed seed derived from `scene.id`.
- **L2 — No node overlap, ever.** Overflow degrades (§6.1 caps), it never overlaps.
- **L3 — Labels are content.** A layout that drops or truncates labels beyond ~20% has failed; prefer growing the viewport.
- **L4 — Hidden ≠ absent.** Layout is computed on the *full* graph (all-revealed), and hidden elements are collapsed at paint time with reserved space optional per archetype. Rationale: step-by-step reveal must not cause layout jumps that disorient the learner. (Archetypes may opt into reflow if jump-free is impossible; `flow` and `graph` reserve space, `cycle` always reserves.)
- **L5 — Constraint conflicts degrade loudly.** Unsatisfiable `place` constraints → best-effort layout + a warning badge listing the dropped constraint, never silent dropping.

| Archetype | Consumes | Layout family | Guarantees | Degrades |
|---|---|---|---|---|
| `graph` (default) | nodes, relations, groups | force-directed, seeded | L1–L4; clusters hulled | >60 nodes → outline card |
| `flow` | nodes, relations (directed), groups | layered (Sugiyama) | rank order follows edge direction; lanes honored; back-edges routed around | cycles allowed (back-edges); >40 nodes → outline card |
| `cycle` | nodes, relations forming ≥1 cycle | radial ring | ring order = traversal order; ring closes visually | non-cyclic model → auto-fallback `flow` + warning |
| `tree` | nodes, relations (must be forest) | tidy tree (Reingold–Tilford) | parent above children; sibling order = source order | non-forest → `flow` + warning |
| `nested` | nodes, `contains`-like relations or groups | containment packing | strict box nesting | depth >6 → `tree` + warning |
| `concentric` | chain of `encloses`-like relations | concentric rings | innermost = chain end; ring thickness by `place at` value if given | non-chain → `nested` + warning |
| `timeline` | nodes + `place at` (dates/numbers) | 1D scale, horizontal | position strictly proportional to value; collision → lanes | unplaced nodes → parked row + warning |
| `axis` | nodes + `place at`, range, scale | 1D scale (linear/log) | proportional placement; log honors `[scale log]` | values outside range → clamped + warning |
| `matrix` | `data` table via `from` | grid | column/row order = source order; header row styled | >30×12 → outline card |
| `bar` | `data` table (label + numeric col) | grid of bars | bar length proportional **from a zero baseline, always** (a truncated axis is a visual lie — I5 applied to charts); non-numeric cell → error card | — |
| `map` | nodes + relative `place` constraints | constraint solver (above/below/left-of/right-of/inside/adjacent) | all satisfiable constraints satisfied; L5 on conflicts | no constraints → `graph` + warning |

**Edge terminators are semantic** (ties to §7): assertion arrows for directed relations; a **blocking bar terminator (⊣)** for `class: refutation`; a **break glyph on the target edge** for `class: boundary`; no terminator for `~`. Sign renders as +/− badges; `weight` as stroke emphasis; `many` as a fan/crow's-foot near the target.

### 6.1 Performance caps

Beyond caps (table above), render the **outline card** (§8) rather than a degraded diagram. Caps are per-archetype constants, revisable; the invariant is that degradation is *explicit*, never a silently unreadable render.

---

## 7. Theme tokens — materializing the language invariants

Themes may restyle anything **except** the invariant tokens. Mapping from language spec §7:

| Invariant (lang §7) | Mechanism here |
|---|---|
| I1 marked falsehood | `status: misconception` ⇒ tokens `falsehood-strike` (persistent diagonal strike overlay) + `falsehood-badge` ("false belief" chip) on the glyph, in **every archetype and every step where visible**. Themes may recolor, never remove. |
| I2 status visible | scene frame carries `status-chip(<status>)`; `reported`/`contested`/`hypothesis` chips must be visually distinct from `established` (shape + label, not color alone). |
| I3 refutation ≠ assertion | `class: refutation` ⇒ `edge-undo` token: dashed stroke + ⊣ terminator. `class: boundary` ⇒ `edge-break` token on target. |
| I4 flippable projection | `projection.suggested` ⇒ `flip-affordance` overlay (archetype switcher); a flip rewrites exactly the `project` line via lang-core printer. |
| I5 polish ≠ truth | no theme may attach checkmark/verified iconography to any status other than `established`; renderer adds **no** certainty decoration of its own. |

Token families (non-exhaustive): `surface-*`, `glyph-*(role)`, `chip-*(status)`, `edge-*(class)`, `salience-criterial` (emphasis) / `salience-incidental` (recede), `tone-*` (author mood — decorative only, may never override status tokens; a `tone success` on a `misconception` node loses).

---

## 8. Fallbacks, errors, accessibility

- **Outline card** — the degradation invariant, executable. When a scene can't render (over caps, unknown future constructs dominating, embed context too small), render the canonical source as an **indented outline** with status chips inline. The language's "reads as a sensible outline" rule is why this is always acceptable. Also the print fallback and the RSS/export fallback.
- **Error card** — parse/validation errors: show line-scoped diagnostics (from IR `diagnostics`) above an outline of the lines that *did* parse. Partial validity is the norm, not blank failure.
- **Accessibility** — the scene's accessible name is the claim (+ status, spoken); the accessible description is the generated outline. Step navigation is keyboard-first (←/→), inputs are native controls, `highlight` also sets `aria-current`. A learner using a screen reader gets the choreography as a guided text sequence — the outline *is* the alternative modality, not an afterthought.
- **Unresolved references** (`Ref.kind: "unresolved"`, authored scenes only — D3): rendered with a broken-link affordance (dotted underline on the label), click/activate exposes the host app's create-note action. Never rendered as an error; a link into the future is a normal state of a growing vault.
- **RTL**: labels render with Unicode bidi; archetype mirroring (flow direction, axis direction) is deferred, noted.

---

## 9. Conformance tests (what falsifies this spec)

1. **Golden IR fixtures.** `text → IR` snapshots for: north star (9.1), planet count, analogy boundary, matrix, pH axis, plus one file exercising every statement type. Any lang-core change that shifts a fixture is a reviewed event.
2. **North-star end-to-end.** Rendered scene must pass an invariant checklist: strike visible in all steps where `belief` is visible; gated step 2 withholds its reveal (`vacuum`) *and* blocks 2→3 until `guess` is committed (C4); ⊣ terminator on the refutation edge; export shows all-revealed + badges. Machine-checkable form: `runtimeOracle` in the golden fixture.
3. **Purity property test.** Random walks over (step, inputs): render(state) must be identical regardless of the path taken to reach the state.
4. **Layout property tests.** cycle: ring order preserved; timeline/axis: monotone value→position; map: satisfiable constraint sets fully satisfied; L2 no-overlap fuzzing per archetype.
5. **Degradation read test.** The outline card of each fixture given to a cold reader; if they can't state the claim and the gist, the outline rendering (or the source) fails.
6. **Determinism test.** Same IR rendered twice (fresh processes) ⇒ byte-identical SVG for static archetypes; seeded-identical for `graph`.

---

## 10. Errata fed back to the language spec (v0.3 → v0.3.1 candidates)

- **C1** (§6 lang): initial-hidden rule generalized — any target of any `reveal` (step *or* rule) starts hidden; reveal+hide conflict resolves to hidden.
- **C2** (§4 grammar): `set` is illegal inside `rule` (validator error, both profiles); legal in `step` only. Preserves runtime purity, prevents rule loops.
- **C3** (§6 lang): note lifetime defined — transient: current step's notes + currently-true rules' notes.

---

## 11. Deliberately deferred

Animation/transition timing spec (reveal easing, layout morphing on flip) · RTL archetype mirroring · edge-to-edge attachment beyond midpoint · theming API surface for third parties · collaborative presence · streaming render during generation (render lines as they arrive — attractive for the highlight-to-scene flow, but needs the partial-validity story hardened first).
