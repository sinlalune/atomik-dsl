# atomik 0.3 — pocket spec (for generators)

You write atomik: a line-oriented DSL for small visual explanations. One statement per line. `#` comments. First line: `atomik 0.3`. Ids: letters/digits/_/-. Strings in double quotes (Unicode ok, escape \" \\). `[[Wiki Link]]` = reference to an existing note — NEVER invent one; if unsure, use a plain string. Any statement may end with attributes: `[key]` or `[key value]` or `[key "text"]`.

## Statements

scene <id>
claim "<what the scene asserts>" [status <s>]        # exactly one; status REQUIRED
subject [[Topic]]                                     # optional
node <id> "<label>"|[[Note]] [role <r>] [status <s>] [in <group>] [salience criterial|incidental]
evidence <id> "<text>" [source [[Note]]|"<text>"] [date <v>] [status <s>]
relation [<id>:] <a> ->|~ <b> <kind> [as <c>] [sign +|-] [label "<why>"] [many] [status <s>]
   # a,b = node/evidence ids, a relation id, or the word claim
group <id> "<label>" [kind cluster|lane|loop] [polarity reinforcing|balancing]
place <id> at <value>                                 # position by value (axis/timeline)
place <id> above|below|left-of|right-of|inside|adjacent <id>   # for map
data <id> cols "<h1>" | "<h2>" | ...
data <id> row  "<c1>" | "<c2>" | ...
project as <archetype> [from <dataset>] [<lo>..<hi>] [scale log] [suggested]
input <id> = slider <lo>..<hi> [default <v>] | choice "a" | "b" | ... | toggle  [label "<q>"]
derive <id> = <expr>                                  # + - * / ( ) only
rule <expr> => <effect>                               # ==,!=,<,<=,>,>=,and,or,not
step <n> <effect>                                     # authored teaching sequence
mark meter "<label>" value <id> [max <v>]

Effects: note "<text>" · reveal <ids> · hide <ids> · highlight <ids> · set <input> <v> · require <input>

## Closed vocabularies

status: established supported contested hypothesis speculative reported misconception unspecified
  # reported = "source says so, unverified" — your safe default
  # misconception = held-but-false belief (nodes only), renderer marks it FALSE
as (relation class): fact inference hypothesis analogy interpretation refutation boundary
role: process decision start terminal question evidence assumption contradiction
archetype: graph flow cycle tree nested concentric timeline axis matrix bar map

## Rules you MUST follow when generating from a text

1. Emit ONLY: scene, claim, subject, node/evidence, relation, group, place, data — plus at most ONE `project as <x> [suggested]` line. No steps, inputs, rules unless the user asked for a teaching sequence.
2. claim needs [status]. Never stronger than the source: hedged wording ("hypothesis", "suggests", "may", "widely accepted but") => hypothesis / contested / reported — never established.
3. Every relation you infer from prose: default [as inference]. Use [as fact] only if the source states it as settled.
4. Preserve what the source marks: uncertainty, supporting evidence, anomalies, alternatives, disagreements. Do not flatten a hedged text into a confident chain.
5. A false belief being discussed => node with [status misconception], plus a `relation <evid> -> <belief> refutes [as refutation]` if the text refutes it.
6. Sources that disagree: one evidence line each (+ [source] [date]), relations to `claim` (supports / contradicts), and evidence-to-evidence (supersedes, contradicts).
7. [[Links]] only for notes you were told exist. Otherwise plain strings.
8. Output in this order, nothing else around it: scene, claim, subject, groups, nodes/evidence (first-mention order), relations, place, data, project.

## Minimal example

atomik 0.3
scene water_cycle
claim "Water continuously cycles between sea, air, and land." [status established]
subject [[Water cycle]]
node evap "Evaporation"
node cond "Condensation"
node precip "Precipitation"
node coll "Collection"
relation evap -> cond then [as fact]
relation cond -> precip then [as fact]
relation precip -> coll then [as fact]
relation coll -> evap then [as fact]
project as cycle [suggested]

## Choreography example (only when a teaching sequence is requested)

input guess = choice "hammer first" | "together" [label "Predict:"]
node belief "Heavy falls faster" [status misconception]
node vacuum "Vacuum drop test" [role evidence]
node truth "Both land together"
relation vacuum -> belief refutes [as refutation]
step 1 reveal belief
step 2 require guess
step 2 reveal vacuum
step 3 reveal truth
step 3 highlight truth
