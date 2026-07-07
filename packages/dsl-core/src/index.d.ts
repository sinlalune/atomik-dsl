/* Type declarations for @atomik/dsl-core.
 * SceneIR (irVersion 0.1) is the frozen contract — render-core spec §2.2.
 * Presentation and layout geometry describe what the current kernel emits;
 * geometry is engine-internal and loosely versioned (render-core §4).
 * UMD: `require('@atomik/dsl-core')` in Node, global `Atomik` in the browser.
 */

export = Atomik;
export as namespace Atomik;

declare namespace Atomik {
  // ---- Scene IR (frozen contract, render-core §2.2) ----

  type Status =
    | "established" | "supported" | "contested" | "hypothesis"
    | "speculative" | "reported" | "misconception" | "unspecified";
  type RelClass =
    | "fact" | "inference" | "hypothesis" | "analogy"
    | "interpretation" | "refutation" | "boundary" | "unspecified";
  type Role =
    | "process" | "decision" | "start" | "terminal"
    | "question" | "evidence" | "assumption" | "contradiction";
  type Archetype =
    | "graph" | "flow" | "cycle" | "tree" | "nested" | "concentric"
    | "timeline" | "axis" | "matrix" | "bar" | "map";

  type Ref =
    | { kind: "note"; target: string }
    | { kind: "unresolved"; raw: string }
    | { kind: "literal" };
  interface Label { text: string; ref: Ref }

  interface NodeIR {
    id: string;
    label: Label;
    role: Role;
    status: Status;
    group?: string;
    salience?: "criterial" | "incidental";
    tone?: string;
    source?: Label;
    date?: string;
    initiallyHidden: boolean;
    line: number;
    extras: Record<string, string | true>;
  }

  type Endpoint =
    | { kind: "node"; id: string }
    | { kind: "relation"; id: string }
    | { kind: "claim" };

  interface RelationIR {
    id: string;
    idSource: "authored" | "synthetic";
    from: Endpoint;
    to: Endpoint;
    directed: boolean;
    kind: string;
    class: RelClass;
    sign?: "+" | "-";
    weight?: number;
    many?: boolean;
    label?: string;
    status: Status;
    initiallyHidden: boolean;
    line: number;
    extras: Record<string, string | true>;
  }

  interface Group {
    id: string;
    label?: string;
    kind: "cluster" | "lane" | "loop";
    polarity?: "reinforcing" | "balancing";
    line: number;
  }

  type PlaceIR = { node: string; line: number } & (
    | { mode: "value"; at: number }
    | { mode: "relative"; rel: "above" | "below" | "left-of" | "right-of" | "inside" | "adjacent"; anchor: string }
  );

  interface DataTable { id: string; cols: string[]; rows: string[][]; lines: number[] }

  interface ProjectionIR {
    archetype: Archetype;
    from?: string;
    range?: [number, number];
    scale?: "linear" | "log";
    label?: string;
    suggested: boolean;
    line: number;
  }

  interface InputIR {
    id: string;
    control:
      | { type: "slider"; min: number; max: number; default?: number }
      | { type: "choice"; options: string[]; default?: string }
      | { type: "toggle"; default?: boolean };
    label?: string;
    committedByDefault: boolean;
    line: number;
  }

  type Expr =
    | { op: "lit"; value: number | string }
    | { op: "ref"; id: string }
    | { op: "not"; a: Expr }
    | { op: "+" | "-" | "*" | "/" | "==" | "!=" | "<" | "<=" | ">" | ">="
        | "and" | "or"; a: Expr; b: Expr };

  interface DerivedIR { id: string; expr: Expr; line: number }

  type EffectIR =
    | { type: "note"; text: string }
    | { type: "reveal" | "hide" | "highlight"; targets: string[] }
    | { type: "set"; input: string; value: number | string }
    | { type: "require"; input: string };

  interface RuleIR { when: Expr; effect: EffectIR; line: number }
  interface StepIR { index: number; sourceStep: number; effects: EffectIR[]; requires: string[]; lines: number[] }
  interface MarkIR { kindOfMark: "meter"; label: string; value: string; max?: number; line: number }
  interface Diagnostic { line: number; code: string; severity: "error" | "warning"; message: string; hint?: string }

  interface SceneIR {
    irVersion: "0.1";
    surface: { language: "atomik"; version: string };
    origin: "authored" | "generated";
    diagnostics: Diagnostic[];
    /** null only when the statement is missing from the source — an error
     *  diagnostic accompanies it (partial validity, render-core §8). */
    scene: { id: string; line: number } | null;
    claim: { text: string; status: Status; line: number } | null;
    subject?: { label: Label; line: number };
    groups: Group[];
    nodes: NodeIR[];
    relations: RelationIR[];
    places: PlaceIR[];
    data: DataTable[];
    projection?: ProjectionIR;
    inputs: InputIR[];
    deriveds: DerivedIR[];
    rules: RuleIR[];
    steps: StepIR[];
    marks: MarkIR[];
  }

  // ---- pure runtime (render-core §5: RS1, C4 gates, C3 notes) ----

  type InputValue = number | string | boolean;

  interface RuntimeState {
    currentStep?: number;
    inputs?: Record<string, InputValue>;
    committed?: string[];
  }

  interface Note { text: string; origin: string }

  interface Presentation {
    currentStep: number;
    maxStep: number;
    env: Record<string, InputValue | null>;
    notes: Note[];
    visibleNodes: string[];
    visibleRelations: string[];
    highlighted: string[];
    lockedInputs: string[];
    canPrev: boolean;
    canNext: boolean;
  }

  // ---- layout geometry (engine-internal, loosely versioned — §4) ----

  interface NodeBox { w: number; h: number; lines: string[] }
  interface Point { x: number; y: number }

  type LayoutEdge =
    | { id: string; skip: true }
    | { id: string; ring: true; path: string; labelAt: Point }
    | { id: string; ring: false; x1: number; y1: number; x2: number; y2: number; labelAt: Point };

  interface Geometry {
    archetype: "cycle" | "graph";
    /** present on fallback layouts: why the requested archetype was not used */
    reason?: string;
    ring: string[];
    parked: string[];
    pos: Record<string, Point>;
    boxes: Record<string, NodeBox>;
    edges: LayoutEdge[];
    viewBox: [number, number, number, number];
  }

  interface LayoutResult { layout: Geometry; notices: string[]; requested: Archetype }
  interface CycleAttempt { fallback: boolean; notices: string[]; layout: Geometry }

  // ---- public surface ----

  function parse(text: string, opts?: { resolver?: (wikilinkText: string) => Ref }): SceneIR;
  function present(ir: SceneIR, state: RuntimeState, opts?: { ignoreGates?: boolean }): Presentation;
  function layout(ir: SceneIR): LayoutResult;
  function layoutCycle(ir: SceneIR): CycleAttempt;
  function wrapLabel(text: string, maxChars?: number): string[];
  function nodeBox(node: NodeIR): NodeBox;
  const constants: {
    STATUSES: Status[];
    CLASSES: RelClass[];
    ROLES: Role[];
    ARCHETYPES: Archetype[];
  };
}
