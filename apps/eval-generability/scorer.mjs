/* Kernel-as-grader: score one generated scene against one task's annotations.
 * Pure and dependency-free — consumes only the dsl-core public surface. The
 * generated profile turns validity, grounding, epistemic ceiling, and the
 * property checks into mechanical booleans (CP-DSL-003, spec §13.2). */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const A = require('../../packages/dsl-core');

const rx = (p) => new RegExp(p, 'i');

/* resolver backed by the task's vault index (G2): a wikilink resolves only if
 * the note exists; anything else is preserved as unresolved = a fabrication. */
export function makeResolver(vaultIndex) {
  const vault = new Set(vaultIndex);
  return (text) => vault.has(text) ? { kind: 'note', target: text } : { kind: 'unresolved', raw: text };
}

function fabricatedLinks(ir) {
  const out = [];
  ir.nodes.forEach((n) => { if (n.label.ref.kind === 'unresolved') out.push(n.label.text); });
  if (ir.subject && ir.subject.label.ref.kind === 'unresolved') out.push(ir.subject.label.text);
  ir.nodes.forEach((n) => { if (n.source && n.source.ref && n.source.ref.kind === 'unresolved') out.push(n.source.text); });
  return out;
}

function checkProperty(ir, p) {
  const nodes = ir.nodes, rels = ir.relations;
  switch (p.check) {
    case 'nodeMatching': return nodes.filter((n) => rx(p.pattern).test(n.label.text)).length >= (p.min || 1);
    case 'nodeStatusMatching': return nodes.some((n) => rx(p.pattern).test(n.label.text) && n.status === p.status);
    case 'relationClass': return rels.filter((r) => r['class'] === p.class).length >= (p.min || 1);
    case 'relationToClaim': return rels.filter((r) => r.from.kind === 'claim' || r.to.kind === 'claim').length >= (p.min || 1);
    case 'evidenceCount': return nodes.filter((n) => n.role === 'evidence').length >= p.min;
    case 'datedEvidence': return nodes.filter((n) => n.role === 'evidence' && n.date !== undefined).length >= p.min;
    case 'evidenceEdge': {
      const ev = new Set(nodes.filter((n) => n.role === 'evidence').map((n) => n.id));
      return rels.some((r) => r.from.kind === 'node' && r.to.kind === 'node' && ev.has(r.from.id) && ev.has(r.to.id));
    }
    case 'edgeClassNot': {
      const hits = nodes.filter((n) => rx(p.pattern).test(n.label.text)).map((n) => n.id);
      const hitSet = new Set(hits);
      const touching = rels.filter((r) => (r.from.kind === 'node' && hitSet.has(r.from.id)) || (r.to.kind === 'node' && hitSet.has(r.to.id)));
      return touching.length > 0 && touching.every((r) => p.forbidden.indexOf(r['class']) < 0);
    }
    case 'minNodes': return nodes.length >= p.n;
    case 'directedEdges': return rels.filter((r) => r.directed && r.from.kind === 'node' && r.to.kind === 'node').length >= p.min;
    case 'placesValue': return ir.places.filter((x) => x.mode === 'value').length >= p.min;
    case 'placesRelative': return ir.places.filter((x) => x.mode === 'relative').length >= p.min;
    case 'signedEdges': return rels.filter((r) => r.sign === '+' || r.sign === '-').length >= p.min;
    case 'hasSteps': return ir.steps.length >= 1;
    case 'hasGate': return ir.steps.some((s) => s.requires.length > 0);
    default: return null; // unknown check — caught by validate_tasks
  }
}

/* score(task, sceneText) -> a flat, JSON-serializable record. */
export function score(task, sceneText) {
  const ir = A.parse(sceneText, { resolver: makeResolver(task.vaultIndex) });
  const errors = ir.diagnostics.filter((d) => d.severity === 'error');
  const warnings = ir.diagnostics.filter((d) => d.severity === 'warning');
  const parses = errors.length === 0 && !!ir.scene && !!ir.claim;

  const claimStatus = ir.claim ? ir.claim.status : null;
  const statusWithinCeiling = ir.claim ? task.allowedClaimStatuses.indexOf(claimStatus) >= 0 : false;
  const fabricated = fabricatedLinks(ir);

  // pocket-spec rule 1: no steps/inputs/rules unless a teaching sequence was asked for
  const emittedChoreography = ir.steps.length > 0 || ir.inputs.length > 0 || ir.rules.length > 0;
  const choreographyViolation = emittedChoreography && !task.teachingSequence;

  const properties = task.properties.map((p) => ({ id: p.id, pass: checkProperty(ir, p) === true }));
  const propsPassed = properties.filter((x) => x.pass).length;

  return {
    parses,
    errorCount: errors.length,
    warningCount: warnings.length,
    diagnostics: ir.diagnostics.map((d) => ({ line: d.line, code: d.code, severity: d.severity })),
    archetype: ir.projection ? ir.projection.archetype : null,
    claimStatus,
    statusWithinCeiling,
    fabricatedLinks: fabricated,
    fabricatedCount: fabricated.length,
    choreographyViolation,
    nodeIds: ir.nodes.map((n) => n.id).sort(),
    relationSignature: ir.relations.map((r) => edgeSig(r)).sort(),
    properties,
    propsPassed,
    propsTotal: properties.length,
    // headline pass: clean parse, grounded, within ceiling, no illicit choreography, all properties
    pass: parses && statusWithinCeiling && fabricated.length === 0 && !choreographyViolation && propsPassed === properties.length
  };
}

/* endpoint-shape signature for a relation, robust to synthetic-id churn:
 * uses node ids (author-controlled) and the semantic class, not the ~rN id. */
function edgeSig(r) {
  const end = (e) => e.kind === 'node' ? e.id : e.kind === 'claim' ? 'claim' : ':' + e.id;
  return end(r.from) + (r.directed ? '->' : '~') + end(r.to) + '#' + r['class'];
}

export { edgeSig };
