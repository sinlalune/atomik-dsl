/* Stability aggregation across the N runs of one task (G1 — the central
 * batch-03 threat: the same passage regenerating into unrecognizable scenes,
 * poisoning file-first diffs). Pure. */

function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  A.forEach((x) => { if (B.has(x)) inter++; });
  return inter / (A.size + B.size - inter);
}

function meanPairwise(sets) {
  if (sets.length < 2) return 1;
  let sum = 0, n = 0;
  for (let i = 0; i < sets.length; i++)
    for (let j = i + 1; j < sets.length; j++) { sum += jaccard(sets[i], sets[j]); n++; }
  return n ? sum / n : 1;
}

/* aggregate(scoreRecords[]) for one task -> stability summary.
 * archetypeModeShare: fraction of runs landing on the most common archetype
 * (1.0 = every run agreed; low = the model can't settle on a projection).
 * nodeJaccard / relationJaccard: mean pairwise structural overlap across runs. */
export function aggregate(records) {
  const n = records.length;
  const archCounts = {};
  records.forEach((r) => { const a = r.archetype || '(none)'; archCounts[a] = (archCounts[a] || 0) + 1; });
  const modeCount = Math.max(0, ...Object.values(archCounts));
  const modeArch = Object.keys(archCounts).find((k) => archCounts[k] === modeCount) || null;

  return {
    runs: n,
    archetypeDistribution: archCounts,
    archetypeMode: modeArch,
    archetypeModeShare: n ? modeCount / n : 0,
    nodeJaccard: meanPairwise(records.map((r) => r.nodeIds)),
    relationJaccard: meanPairwise(records.map((r) => r.relationSignature)),
    passRate: n ? records.filter((r) => r.pass).length / n : 0,
    fabricationRate: n ? records.filter((r) => r.fabricatedCount > 0).length / n : 0,
    statusCeilingHoldRate: n ? records.filter((r) => r.statusWithinCeiling).length / n : 0
  };
}

export { jaccard, meanPairwise };
