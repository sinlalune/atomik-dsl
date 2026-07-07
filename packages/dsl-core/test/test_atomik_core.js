'use strict';
const fs = require('fs');
const path = require('path');
const Atomik = require(path.join(__dirname, '..')); // public entry (package.json main)

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label); }
}

/* deep compare treating missing key == undefined; reports first diff paths */
function diff(a, b, path, out) {
  path = path || '$'; out = out || [];
  if (a === b) return out;
  const ta = Object.prototype.toString.call(a), tb = Object.prototype.toString.call(b);
  if (ta !== tb) { out.push(path + ': type ' + ta + ' vs ' + tb + ' (' + JSON.stringify(a) + ' vs ' + JSON.stringify(b) + ')'); return out; }
  if (Array.isArray(a)) {
    if (a.length !== b.length) { out.push(path + ': array length ' + a.length + ' vs ' + b.length); return out; }
    for (let i = 0; i < a.length; i++) { diff(a[i], b[i], path + '[' + i + ']', out); if (out.length > 8) return out; }
    return out;
  }
  if (a && typeof a === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      const va = a[k], vb = b[k];
      if (va === undefined && vb === undefined) continue;
      diff(va, vb, path + '.' + k, out);
      if (out.length > 8) return out;
    }
    return out;
  }
  out.push(path + ': ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b));
  return out;
}

/* strip undefined-valued keys so JSON-style compare is fair */
function clean(x) { return JSON.parse(JSON.stringify(x)); }

console.log('\n== 1. Golden fixture parity (render-core spec §9.1) ==');
const golden = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'atomik_scene_ir_golden_northstar_v0_1.json'), 'utf8'));
const src = golden.canonicalSource.join('\n');
const ir = clean(Atomik.parse(src));
const d = diff(ir, clean(golden.expectedIR));
if (d.length) { d.forEach(x => console.log('    diff ' + x)); }
ok(d.length === 0, 'parsed IR is deep-equal to expectedIR (' + golden.canonicalSource.length + ' source lines)');
ok(ir.diagnostics.length === 0, 'no diagnostics on the golden source');

console.log('\n== 2. Runtime oracle A1–A7 (gated steps C4, purity RS1) ==');
const S = (step, inputs, committed) => ({ currentStep: step, inputs: inputs || {}, committed: committed || [] });
const setEq = (arr, expect) => arr.slice().sort().join(',') === expect.slice().sort().join(',');

let p = Atomik.present(ir, S(1));
ok(setEq(p.visibleNodes, ['belief']), 'A1 step1: only belief visible');
ok(p.visibleRelations.length === 0, 'A1 step1: no relations painted');
ok(p.notes.some(n => n.text.startsWith('Most people')), 'A1 step1: elicit note shown');

p = Atomik.present(ir, S(2));
ok(setEq(p.visibleNodes, ['belief']), 'A2 gate withholds: vacuum NOT revealed while uncommitted (C4)');
ok(p.canNext === false && p.lockedInputs.includes('guess'), 'A2 advance blocked, lock names guess');

p = Atomik.present(ir, S(2, { guess: 'together' }, ['guess']));
ok(setEq(p.visibleNodes, ['belief', 'vacuum']), 'A3 commit: vacuum revealed');
ok(setEq(p.visibleRelations, ['~r1']), 'A3 refutation edge paints once both endpoints visible');
ok(p.notes.some(n => n.text.startsWith('You predicted')), 'A3 right-guess rule note');
ok(p.canNext === true, 'A3 advance allowed');

p = Atomik.present(ir, S(2, { guess: 'hammer first' }, ['guess']));
ok(p.notes.some(n => n.text.startsWith('A very common')), 'A4 wrong-guess note; commitment (not correctness) opens the gate');
ok(p.canNext === true, 'A4 advance allowed after any committed answer');

p = Atomik.present(ir, S(4, { guess: 'hammer first' }, ['guess']));
ok(setEq(p.visibleNodes, ['belief', 'vacuum', 'truth', 'reason']), 'A5 resolution: all four visible');
ok(setEq(p.visibleRelations, ['~r1', '~r2', '~r3']), 'A5 all edges painted');
ok(setEq(p.highlighted, ['truth']), 'A5 step-3 highlight persists at step 4 (cumulative)');

const pA = Atomik.present(ir, S(1, { guess: 'together' }, ['guess']));
const pB = Atomik.present(ir, S(1, { guess: 'together' }, ['guess']));
ok(JSON.stringify(pA) === JSON.stringify(pB), 'A6 purity: same state ⇒ identical presentation');
ok(setEq(pA.visibleNodes, ['belief']), 'A6 back to step1 after commit: belief only (no latching)');

p = Atomik.present(ir, S(1), { ignoreGates: true });
ok(setEq(p.visibleNodes, ['belief', 'vacuum', 'truth', 'reason']), 'A7 export mode: all revealed, gates ignored');

console.log('\n== 3. Demo cycle scene (parser + C4 + edge visibility + layout) ==');
const demo = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'presets', 'preset_demo.atomik'), 'utf8');
const dIr = clean(Atomik.parse(demo));
dIr.diagnostics.forEach(x => console.log('    diag L' + x.line + ' ' + x.code + ': ' + x.message));
ok(dIr.diagnostics.length === 0, 'demo scene parses with zero diagnostics');
ok(dIr.relations.filter(r => r['class'] === 'refutation').length === 1, 'one refutation edge');
ok(dIr.nodes.find(n => n.id === 'gone').status === 'misconception', 'misconception status parsed');
ok(dIr.nodes.every(n => n.initiallyHidden === true), 'C1: every reveal target starts hidden (all nodes)');

let q = Atomik.present(dIr, S(2));
ok(setEq(q.visibleNodes, ['gone']), 'demo A2: gated step 2 withholds evap until commitment');
q = Atomik.present(dIr, S(2, { devine: 'elle a disparu' }, ['devine']));
ok(setEq(q.visibleNodes, ['gone', 'evap']), 'demo: commit reveals evap');
ok(setEq(q.visibleRelations, dIr.relations.filter(r => r['class'] === 'refutation').map(r => r.id)), 'demo: only the refutation edge paints (ring endpoints still hidden)');
q = Atomik.present(dIr, S(4, { devine: 'x' }, ['devine']));
ok(q.visibleRelations.length === 5, 'demo step4: ring closes — all 5 edges painted');
ok(setEq(q.highlighted, ['evap']), 'demo step4: highlight on evap');

const L = Atomik.layout(dIr);
ok(L.layout.archetype === 'cycle', 'cycle layout selected');
ok(setEq(L.layout.ring, ['evap', 'cond', 'pluie', 'coll']), 'ring = the 4-node cycle, deterministic start (IR order)');
const ringIds = L.layout.ring;
const cx = 0, cy = 0;
const radii = ringIds.map(id => Math.hypot(L.layout.pos[id].x - cx, L.layout.pos[id].y - cy));
const R0 = radii[0];
ok(radii.every(r => Math.abs(r - R0) < 0.5), 'ring nodes equidistant from center (on the circle)');
const satR = Math.hypot(L.layout.pos['gone'].x, L.layout.pos['gone'].y);
ok(satR > R0 + 40, 'satellite (gone) orbits outside the ring');
ok(L.layout.parked.length === 0, 'no parked nodes');
const ringEdges = L.layout.edges.filter(e => e.ring);
ok(ringEdges.length === 4, '4 ring edges rendered as arcs');
ok(ringEdges.every(e => /^M .* A /.test(e.path)), 'ring edges are SVG arcs');

console.log('\n== 4. Diagnostics & C2 (broken preset) ==');
const broken = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'presets', 'preset_broken.atomik'), 'utf8');
const bIr = Atomik.parse(broken);
const codes = bIr.diagnostics.map(x => x.code);
ok(codes.includes('unknown-id'), 'unknown endpoint id flagged');
ok(codes.includes('set-in-rule'), 'C2: set inside a rule is an error');
ok(codes.includes('unknown-keyword'), 'unknown keyword → warning, line skipped');
ok(bIr.nodes.length === 2, 'partial validity: valid lines still build the IR');
const hinted = bIr.diagnostics.find(x => x.code === 'unknown-id' && x.hint);
ok(!!hinted, 'repair hint present (nearest id) — batch-03 repair loop shape');

console.log('\n== 5. Generated-profile guard (G4) ==');
const gen = 'atomik 0.3\nscene g [origin generated]\nclaim "Something."\nnode a "A"';
const gIr = Atomik.parse(gen);
ok(gIr.diagnostics.some(x => x.code === 'claim-status-required'), 'generated profile: missing claim status is an error');

console.log('\n== 6. Flow archetype: layered layout (CP-DSL-002) ==');
function overlappingPair(g) {
  const ids = Object.keys(g.pos);
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const A = ids[i], B = ids[j];
    if (Math.abs(g.pos[A].x - g.pos[B].x) < (g.boxes[A].w + g.boxes[B].w) / 2 &&
        Math.abs(g.pos[A].y - g.pos[B].y) < (g.boxes[A].h + g.boxes[B].h) / 2) return A + '/' + B;
  }
  return null;
}
const flowSrc = [
  'atomik 0.3', 'scene diamond', 'claim "Layered."',
  'node a "A"', 'node b "B"', 'node c "C"', 'node d "D"',
  'relation a -> b then', 'relation a -> c then',
  'relation b -> d then', 'relation c -> d then',
  'project as flow'
].join('\n');
const fIr = clean(Atomik.parse(flowSrc));
ok(fIr.diagnostics.length === 0, 'diamond scene parses clean');
const F = Atomik.layout(fIr);
ok(F.requested === 'flow' && F.layout.archetype === 'flow', 'flow layout selected, no fallback');
ok(F.layout.backEdges.length === 0, 'diamond DAG: no back-edges');
ok(fIr.relations.every(r => F.layout.pos[r.from.id].y < F.layout.pos[r.to.id].y),
  'rank order follows edge direction: every edge points downward (§6)');
ok(F.layout.pos['b'].y === F.layout.pos['c'].y, 'siblings b and c share a rank');
ok(JSON.stringify(Atomik.layout(clean(Atomik.parse(flowSrc)))) === JSON.stringify(F),
  'L1: fresh parse + layout is byte-identical');
ok(overlappingPair(F.layout) === null, 'L2: no node overlap (diamond)');

const flowDemo = clean(Atomik.parse(demo.replace('project as cycle', 'project as flow')));
const FD = Atomik.layout(flowDemo);
ok(FD.layout.archetype === 'flow', 'cyclic model is legal flow input (cycles allowed)');
ok(FD.layout.backEdges.length === 1, 'exactly one back-edge closes the water cycle');
ok(flowDemo.relations
    .filter(r => !FD.layout.backEdges.includes(r.id))
    .every(r => FD.layout.pos[r.from.id].y < FD.layout.pos[r.to.id].y),
  'all non-back edges point downward in the cyclic model');
ok(overlappingPair(FD.layout) === null, 'L2: no node overlap (demo as flow)');
ok(flowDemo.nodes.every(n => FD.layout.pos[n.id]), 'L4: hidden nodes positioned (full-graph layout)');
const backGe = FD.layout.edges.find(e => e.back);
ok(!!backGe && !backGe.skip, 'back-edge flagged in the geometry');

console.log('\n== 7. Flow lanes + routed back-edges (CP-DSL-002 S03) ==');
const laneSrc = [
  'atomik 0.3', 'scene analogy', 'claim "Two sides."',
  'group piece "Pièce" [kind lane]', 'group qubit "Qubit" [kind lane]',
  'node coin "Pile ou face" [in piece]', 'node spin "Spin up/down" [in qubit]',
  'node turn "Pièce qui tourne" [in piece]', 'node sup "Superposition" [in qubit]',
  'relation coin -> turn devient', 'relation spin -> sup devient',
  'project as flow'
].join('\n');
const lIr = clean(Atomik.parse(laneSrc));
ok(lIr.diagnostics.length === 0, 'lane scene parses clean');
const LF = Atomik.layout(lIr).layout;
ok(LF.lanes.length === 2 && LF.lanes[0].id === 'piece' && LF.lanes[0].x1 < LF.lanes[1].x0,
  'lanes: declaration-ordered, disjoint x-bands');
const inBand = (id, i) =>
  LF.pos[id].x - LF.boxes[id].w / 2 >= LF.lanes[i].x0 - 0.01 &&
  LF.pos[id].x + LF.boxes[id].w / 2 <= LF.lanes[i].x1 + 0.01;
ok(inBand('coin', 0) && inBand('turn', 0), 'lane 1 members stay inside their band');
ok(inBand('spin', 1) && inBand('sup', 1), 'lane 2 members stay inside their band');
ok(overlappingPair(LF) === null, 'L2 holds with lanes');

const rb = Atomik.layout(flowDemo).layout;
const routed = rb.edges.find(e => e.back);
ok(/^M /.test(routed.path) && routed.path.split(' L ').length === 6,
  'back-edge routed as a 6-point orthogonal path');
function segHitsBoxInterior(x1, y1, x2, y2, b) {
  const eps = 0.5;
  const rx1 = b.cx - b.w / 2 + eps, rx2 = b.cx + b.w / 2 - eps;
  const ry1 = b.cy - b.h / 2 + eps, ry2 = b.cy + b.h / 2 - eps;
  return Math.min(x1, x2) < rx2 && Math.max(x1, x2) > rx1 &&
         Math.min(y1, y2) < ry2 && Math.max(y1, y2) > ry1;
}
const rpts = routed.path.slice(2).split(' L ').map(s => s.split(' ').map(Number));
let clear = true;
for (let i = 1; i < rpts.length; i++)
  for (const id of Object.keys(rb.pos))
    if (segHitsBoxInterior(rpts[i - 1][0], rpts[i - 1][1], rpts[i][0], rpts[i][1],
        { cx: rb.pos[id].x, cy: rb.pos[id].y, w: rb.boxes[id].w, h: rb.boxes[id].h })) clear = false;
ok(clear, 'routed back-edge clears every node box (around, never through)');
ok(JSON.stringify(Atomik.layout(flowDemo)) === JSON.stringify(Atomik.layout(flowDemo)),
  'L1 holds with lanes + routing');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
