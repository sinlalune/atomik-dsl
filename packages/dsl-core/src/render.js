/* atomik render kernel — Scene IR → pure runtime + layout geometry.
 * present() implements render-core spec §5: RS1 purity over
 * (currentStep, inputs, committed), C4 gated steps, C3 transient notes,
 * edge effective visibility. layout() implements §6 for `cycle`
 * (+ announced fallback grid). AST interpretation only — no eval.
 * No DOM, never re-reads source text (D1).
 * UMD-ish: Node (require) or browser (AtomikRender).
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.AtomikRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------------- runtime: pure present() ---------------- */
  function evalExpr(e, env) {
    switch (e.op) {
      case 'lit': return e.value;
      case 'ref': return env[e.id];
      case 'not': return !truthy(evalExpr(e.a, env));
      case 'and': return truthy(evalExpr(e.a, env)) && truthy(evalExpr(e.b, env));
      case 'or': return truthy(evalExpr(e.a, env)) || truthy(evalExpr(e.b, env));
      default: {
        var a = evalExpr(e.a, env), b = evalExpr(e.b, env);
        switch (e.op) {
          case '+': return num(a) + num(b);
          case '-': return num(a) - num(b);
          case '*': return num(a) * num(b);
          case '/': return num(b) === 0 ? 0 : num(a) / num(b);
          case '==': return a === b || String(a) === String(b);
          case '!=': return !(a === b || String(a) === String(b));
          case '<': return num(a) < num(b);
          case '<=': return num(a) <= num(b);
          case '>': return num(a) > num(b);
          case '>=': return num(a) >= num(b);
        }
      }
    }
    return null;
  }
  function truthy(v) { return v === true || (typeof v === 'number' && v !== 0) || (typeof v === 'string' && v.length > 0); }
  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }

  function defaultInputValue(inp) {
    var c = inp.control;
    if (c.type === 'slider') return c['default'] !== undefined ? c['default'] : c.min;
    if (c.type === 'toggle') return c['default'] !== undefined ? c['default'] : false;
    return c['default'] !== undefined ? c['default'] : null; // choice: uncommitted
  }

  /* present(ir, state[, opts]) — RS1 pure.
   * state = { currentStep, inputs: {id:value}, committed: [ids] }
   * opts  = { ignoreGates: bool }  (export mode)
   */
  function present(ir, state, opts) {
    opts = opts || {};
    var committed = {};
    (state.committed || []).forEach(function (c) { committed[c] = true; });
    ir.inputs.forEach(function (inp) { if (inp.committedByDefault) committed[inp.id] = true; });

    var env = {};
    ir.inputs.forEach(function (inp) {
      env[inp.id] = (state.inputs && state.inputs[inp.id] !== undefined)
        ? state.inputs[inp.id] : defaultInputValue(inp);
    });
    ir.deriveds.forEach(function (d) { env[d.id] = evalExpr(d.expr, env); });

    var visible = {}, highlight = {};
    ir.nodes.forEach(function (n) { visible[n.id] = !n.initiallyHidden; });
    ir.relations.forEach(function (r) { visible[r.id] = !r.initiallyHidden; });

    function gateOpen(step) {
      if (opts.ignoreGates) return true;
      return step.requires.every(function (rq) { return committed[rq]; });
    }
    function applyEffect(e) {
      if (e.type === 'reveal') e.targets.forEach(function (t) { visible[t] = true; });
      else if (e.type === 'hide') e.targets.forEach(function (t) { visible[t] = false; });
      else if (e.type === 'highlight') e.targets.forEach(function (t) { highlight[t] = true; });
    }

    var notes = [];
    var maxStep = ir.steps.length ? ir.steps[ir.steps.length - 1].index : 1;
    var cur = opts.ignoreGates ? maxStep : Math.max(1, Math.min(state.currentStep || 1, maxStep));

    ir.steps.forEach(function (s) {
      if (s.index > cur) return;
      if (!gateOpen(s)) return;              // C4: a gated step's effects wait for commitment
      s.effects.forEach(function (e) {
        applyEffect(e);
        if (e.type === 'note' && s.index === cur) notes.push({ text: e.text, origin: 'step ' + s.sourceStep });
      });
    });
    ir.rules.forEach(function (r, i) {
      if (truthy(evalExpr(r.when, env))) {
        applyEffect(r.effect);
        if (r.effect.type === 'note') notes.push({ text: r.effect.text, origin: 'rule L' + r.line });
      }
    });

    /* edge effective visibility (own flag AND endpoints) */
    var relById = {};
    ir.relations.forEach(function (r) { relById[r.id] = r; });
    var effMemo = {};
    function endVisible(ep, seen) {
      if (ep.kind === 'claim') return true;
      if (ep.kind === 'node') return !!visible[ep.id];
      return relEffective(ep.id, seen);
    }
    function relEffective(id, seen) {
      if (effMemo[id] !== undefined) return effMemo[id];
      seen = seen || {};
      if (seen[id]) return false;
      seen[id] = true;
      var r = relById[id];
      var v = !!(r && visible[id] && endVisible(r.from, seen) && endVisible(r.to, seen));
      effMemo[id] = v;
      return v;
    }

    var visibleNodes = ir.nodes.filter(function (n) { return visible[n.id]; }).map(function (n) { return n.id; });
    var visibleRelations = ir.relations.filter(function (r) { return relEffective(r.id); }).map(function (r) { return r.id; });
    var highlighted = Object.keys(highlight).filter(function (id) {
      return relById[id] ? relEffective(id) : visible[id];
    });

    var curStepObj = ir.steps.filter(function (s) { return s.index === cur; })[0];
    var unmet = curStepObj ? curStepObj.requires.filter(function (rq) { return !committed[rq]; }) : [];

    return {
      currentStep: cur, maxStep: maxStep,
      env: env, notes: notes,
      visibleNodes: visibleNodes, visibleRelations: visibleRelations,
      highlighted: highlighted,
      lockedInputs: unmet,
      canPrev: cur > 1,
      canNext: cur < maxStep && unmet.length === 0
    };
  }

  /* ---------------- text measurement + wrapping ---------------- */
  function wrapLabel(text, maxChars) {
    maxChars = maxChars || 16;
    var words = text.split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) {
      if (!cur.length) { cur = w; return; }
      if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w;
      else { lines.push(cur); cur = w; }
    });
    if (cur.length) lines.push(cur);
    if (!lines.length) lines = [''];
    return lines;
  }
  function nodeBox(n) {
    var lines = wrapLabel(n.label.text, 16);
    var longest = lines.reduce(function (m, l) { return Math.max(m, l.length); }, 4);
    var w = Math.max(88, Math.min(200, longest * 7.6 + 26));
    var h = lines.length * 16 + 22;
    if (n.status === 'misconception') h += 18; // room for the "false belief" badge
    if (n.role === 'decision') { w += 24; h += 14; }
    return { w: w, h: h, lines: lines };
  }

  /* ---------------- cycle layout ---------------- */
  function findLongestCycle(ir) {
    var adj = {};
    ir.nodes.forEach(function (n) { adj[n.id] = []; });
    ir.relations.forEach(function (r) {
      if (r.directed && r.from.kind === 'node' && r.to.kind === 'node' &&
          adj[r.from.id] && adj[r.to.id] !== undefined) adj[r.from.id].push(r.to.id);
    });
    var best = null;
    var order = ir.nodes.map(function (n) { return n.id; });
    order.forEach(function (start) {
      var path = [start], inPath = {}; inPath[start] = true;
      (function dfs(u) {
        (adj[u] || []).forEach(function (v) {
          if (v === start && path.length >= 2) {
            if (!best || path.length > best.length) best = path.slice();
          } else if (!inPath[v]) {
            path.push(v); inPath[v] = true;
            dfs(v);
            path.pop(); delete inPath[v];
          }
        });
      })(start);
    });
    if (!best) return null;
    // deterministic rotation: start at the ring node that appears first in IR order
    var firstIdx = 0, firstPos = Infinity;
    best.forEach(function (id, i) {
      var pos = order.indexOf(id);
      if (pos < firstPos) { firstPos = pos; firstIdx = i; }
    });
    return best.slice(firstIdx).concat(best.slice(0, firstIdx));
  }

  function rectExit(cx, cy, hw, hh, tx, ty) {
    var dx = tx - cx, dy = ty - cy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };
    var t = Infinity;
    if (dx !== 0) t = Math.min(t, hw / Math.abs(dx));
    if (dy !== 0) t = Math.min(t, hh / Math.abs(dy));
    return { x: cx + dx * t, y: cy + dy * t };
  }

  function layoutCycle(ir) {
    var notices = [];
    var ring = findLongestCycle(ir);
    if (!ring) return { fallback: true, notices: ['aucun cycle trouvé — rendu de secours (graph)'], layout: layoutFallback(ir, 'no-cycle') };

    var boxes = {};
    ir.nodes.forEach(function (n) { boxes[n.id] = nodeBox(n); });

    var N = ring.length;
    var sumW = ring.reduce(function (s, id) { return s + boxes[id].w; }, 0);
    var R = Math.max(130, sumW / (2 * Math.PI) * 1.55 + 44, N * 44);
    var cx = 0, cy = 0;
    var angle = {};
    ring.forEach(function (id, i) { angle[id] = -Math.PI / 2 + (2 * Math.PI * i) / N; });

    var pos = {};
    ring.forEach(function (id) {
      pos[id] = { x: cx + R * Math.cos(angle[id]), y: cy + R * Math.sin(angle[id]) };
    });

    /* satellites: non-ring nodes attached to a ring node */
    var ringSet = {}; ring.forEach(function (id) { ringSet[id] = true; });
    var satsByAnchor = {};
    var parked = [];
    ir.nodes.forEach(function (n) {
      if (ringSet[n.id]) return;
      var anchor = null;
      for (var i = 0; i < ir.relations.length; i++) {
        var r = ir.relations[i];
        if (r.from.kind !== 'node' || r.to.kind !== 'node') continue;
        if (r.from.id === n.id && ringSet[r.to.id]) { anchor = r.to.id; break; }
        if (r.to.id === n.id && ringSet[r.from.id]) { anchor = r.from.id; break; }
      }
      if (!anchor) { parked.push(n.id); return; }
      (satsByAnchor[anchor] = satsByAnchor[anchor] || []).push(n.id);
    });
    Object.keys(satsByAnchor).forEach(function (anchor) {
      var list = satsByAnchor[anchor];
      list.forEach(function (id, k) {
        var spread = (k - (list.length - 1) / 2) * 0.42;
        var a = angle[anchor] + spread;
        var dist = R + boxes[anchor].h / 2 + 78 + boxes[id].h / 2;
        pos[id] = { x: cx + dist * Math.cos(a), y: cy + dist * Math.sin(a) };
        angle[id] = a;
      });
    });
    if (parked.length) {
      notices.push('nœuds hors cycle non rattachés : ' + parked.join(', ') + ' (rangée basse)');
      var px = -((parked.length - 1) * 110) / 2;
      parked.forEach(function (id, i) {
        pos[id] = { x: cx + px + i * 220, y: cy + R + 170 };
      });
    }

    /* edges */
    var ringPair = {};
    ring.forEach(function (id, i) { ringPair[id + '→' + ring[(i + 1) % N]] = true; });
    var edges = ir.relations.map(function (r) {
      if (r.from.kind !== 'node' || r.to.kind !== 'node' || !pos[r.from.id] || !pos[r.to.id]) {
        return { id: r.id, skip: true };
      }
      var isRingEdge = r.directed && ringPair[r.from.id + '→' + r.to.id];
      if (isRingEdge) {
        var aFrom = angle[r.from.id], aTo = angle[r.to.id];
        var mFrom = (boxes[r.from.id].w / 2 + 12) / R;
        var mTo = (boxes[r.to.id].w / 2 + 16) / R;
        var a1 = aFrom + mFrom;
        var a2raw = aTo; while (a2raw <= aFrom) a2raw += 2 * Math.PI;
        var a2 = a2raw - mTo;
        var p1 = { x: cx + R * Math.cos(a1), y: cy + R * Math.sin(a1) };
        var p2 = { x: cx + R * Math.cos(a2), y: cy + R * Math.sin(a2) };
        var large = (a2 - a1) > Math.PI ? 1 : 0;
        var mid = (a1 + a2) / 2;
        return {
          id: r.id, ring: true,
          path: 'M ' + p1.x.toFixed(1) + ' ' + p1.y.toFixed(1) +
                ' A ' + R.toFixed(1) + ' ' + R.toFixed(1) + ' 0 ' + large + ' 1 ' +
                p2.x.toFixed(1) + ' ' + p2.y.toFixed(1),
          labelAt: { x: cx + (R + 16) * Math.cos(mid), y: cy + (R + 16) * Math.sin(mid) }
        };
      }
      var bF = boxes[r.from.id], bT = boxes[r.to.id];
      var pF = pos[r.from.id], pT = pos[r.to.id];
      var e1 = rectExit(pF.x, pF.y, bF.w / 2, bF.h / 2, pT.x, pT.y);
      var e2 = rectExit(pT.x, pT.y, bT.w / 2, bT.h / 2, pF.x, pF.y);
      return {
        id: r.id, ring: false,
        x1: e1.x, y1: e1.y, x2: e2.x, y2: e2.y,
        labelAt: { x: (e1.x + e2.x) / 2, y: (e1.y + e2.y) / 2 - 6 }
      };
    });

    /* bounds */
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    ir.nodes.forEach(function (n) {
      var p = pos[n.id], b = boxes[n.id];
      if (!p) return;
      minX = Math.min(minX, p.x - b.w / 2); maxX = Math.max(maxX, p.x + b.w / 2);
      minY = Math.min(minY, p.y - b.h / 2); maxY = Math.max(maxY, p.y + b.h / 2);
    });
    var pad = 46;
    return {
      fallback: false, notices: notices,
      layout: {
        archetype: 'cycle', ring: ring, parked: parked,
        pos: pos, boxes: boxes, edges: edges,
        viewBox: [minX - pad, minY - pad, (maxX - minX) + 2 * pad, (maxY - minY) + 2 * pad]
      }
    };
  }

  /* ---------------- flow layout (layered, Sugiyama-lite) ---------------- */
  /* Contract (§6): rank order follows edge direction; lanes honored;
   * back-edges routed around; cyclic models legal. Deterministic (L1):
   * DFS cycle-breaking, ranking, and ordering all derive from IR order. */
  function layoutFlow(ir) {
    var notices = [];
    var boxes = {};
    ir.nodes.forEach(function (n) { boxes[n.id] = nodeBox(n); });
    var order = ir.nodes.map(function (n) { return n.id; });
    var idx = {};
    order.forEach(function (id, i) { idx[id] = i; });

    /* directed node→node edges, in IR order */
    var flowEdges = [];
    ir.relations.forEach(function (r) {
      if (r.directed && r.from.kind === 'node' && r.to.kind === 'node' &&
          idx[r.from.id] !== undefined && idx[r.to.id] !== undefined)
        flowEdges.push({ id: r.id, from: r.from.id, to: r.to.id });
    });

    /* cycle-breaking: DFS in IR order; an edge into the active stack is a
       back-edge — kept visually, ignored for ranking */
    var back = {};
    var state = {}; // undefined = unvisited, 1 = on stack, 2 = done
    var outAdj = {};
    order.forEach(function (id) { outAdj[id] = []; });
    flowEdges.forEach(function (e) { outAdj[e.from].push(e); });
    (function () {
      function dfs(u) {
        state[u] = 1;
        outAdj[u].forEach(function (e) {
          if (state[e.to] === 1) back[e.id] = true;
          else if (!state[e.to]) dfs(e.to);
        });
        state[u] = 2;
      }
      order.forEach(function (id) { if (!state[id]) dfs(id); });
    })();

    /* longest-path ranks over the acyclic remainder */
    var inAdj = {};
    order.forEach(function (id) { inAdj[id] = []; });
    flowEdges.forEach(function (e) { if (!back[e.id]) inAdj[e.to].push(e); });
    var rankMemo = {};
    function rankOf(v) {
      if (rankMemo[v] !== undefined) return rankMemo[v];
      rankMemo[v] = 0; // guards re-entry; acyclic by construction
      var r = 0;
      inAdj[v].forEach(function (e) { r = Math.max(r, rankOf(e.from) + 1); });
      rankMemo[v] = r;
      return r;
    }
    var rank = {};
    var maxRank = 0;
    order.forEach(function (id) { rank[id] = rankOf(id); maxRank = Math.max(maxRank, rank[id]); });

    var rows = [];
    for (var ri = 0; ri <= maxRank; ri++) rows.push([]);
    order.forEach(function (id) { rows[rank[id]].push(id); }); // IR-order seed

    /* two mean-field ordering passes: sort each row by the average position
       of its neighbours; stable, ties keep IR order (L1) */
    var xIndex = {};
    order.forEach(function (id, i) { xIndex[id] = i; });
    var nbr = {};
    order.forEach(function (id) { nbr[id] = []; });
    flowEdges.forEach(function (e) { nbr[e.from].push(e.to); nbr[e.to].push(e.from); });
    for (var pass = 0; pass < 2; pass++) {
      rows.forEach(function (row) {
        var bary = {};
        row.forEach(function (id) {
          var s = 0;
          nbr[id].forEach(function (m) { s += xIndex[m]; });
          bary[id] = nbr[id].length ? s / nbr[id].length : xIndex[id];
        });
        row.sort(function (a, b) { return (bary[a] - bary[b]) || (idx[a] - idx[b]); });
        row.forEach(function (id, i) { xIndex[id] = i; });
      });
    }

    /* coordinates: rows top-down, centered; no overlap by construction (L2) */
    var rowGap = 84, colGap = 46;
    var pos = {};
    var y = 0;
    rows.forEach(function (row) {
      var rowH = 0, totalW = 0;
      row.forEach(function (id) {
        rowH = Math.max(rowH, boxes[id].h);
        totalW += boxes[id].w;
      });
      totalW += colGap * Math.max(0, row.length - 1);
      var x = -totalW / 2;
      row.forEach(function (id) {
        pos[id] = { x: x + boxes[id].w / 2, y: y + rowH / 2 };
        x += boxes[id].w + colGap;
      });
      y += rowH + rowGap;
    });

    /* edges: straight segments; back-edges flagged (routed in a later step) */
    var geoEdges = ir.relations.map(function (r) {
      if (r.from.kind !== 'node' || r.to.kind !== 'node' || !pos[r.from.id] || !pos[r.to.id])
        return { id: r.id, skip: true };
      var bF = boxes[r.from.id], bT = boxes[r.to.id];
      var pF = pos[r.from.id], pT = pos[r.to.id];
      var e1 = rectExit(pF.x, pF.y, bF.w / 2, bF.h / 2, pT.x, pT.y);
      var e2 = rectExit(pT.x, pT.y, bT.w / 2, bT.h / 2, pF.x, pF.y);
      var ge = {
        id: r.id, ring: false,
        x1: e1.x, y1: e1.y, x2: e2.x, y2: e2.y,
        labelAt: { x: (e1.x + e2.x) / 2, y: (e1.y + e2.y) / 2 - 6 }
      };
      if (back[r.id]) ge.back = true;
      return ge;
    });

    /* bounds */
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    ir.nodes.forEach(function (n) {
      var p = pos[n.id], b = boxes[n.id];
      minX = Math.min(minX, p.x - b.w / 2); maxX = Math.max(maxX, p.x + b.w / 2);
      minY = Math.min(minY, p.y - b.h / 2); maxY = Math.max(maxY, p.y + b.h / 2);
    });
    if (!ir.nodes.length) { minX = 0; minY = 0; maxX = 10; maxY = 10; }
    var pad = 46;
    return {
      fallback: false, notices: notices,
      layout: {
        archetype: 'flow', rows: rows, backEdges: Object.keys(back),
        pos: pos, boxes: boxes, edges: geoEdges,
        viewBox: [minX - pad, minY - pad, (maxX - minX) + 2 * pad, (maxY - minY) + 2 * pad]
      }
    };
  }

  /* minimal fallback (prototype): rows grid + straight edges */
  function layoutFallback(ir, reason) {
    var boxes = {}, pos = {};
    ir.nodes.forEach(function (n) { boxes[n.id] = nodeBox(n); });
    var perRow = Math.max(2, Math.ceil(Math.sqrt(ir.nodes.length)));
    ir.nodes.forEach(function (n, i) {
      var r = Math.floor(i / perRow), c = i % perRow;
      pos[n.id] = { x: c * 240, y: r * 150 };
    });
    var edges = ir.relations.map(function (r) {
      if (r.from.kind !== 'node' || r.to.kind !== 'node' || !pos[r.from.id] || !pos[r.to.id]) return { id: r.id, skip: true };
      var bF = boxes[r.from.id], bT = boxes[r.to.id];
      var pF = pos[r.from.id], pT = pos[r.to.id];
      var e1 = rectExit(pF.x, pF.y, bF.w / 2, bF.h / 2, pT.x, pT.y);
      var e2 = rectExit(pT.x, pT.y, bT.w / 2, bT.h / 2, pF.x, pF.y);
      return { id: r.id, ring: false, x1: e1.x, y1: e1.y, x2: e2.x, y2: e2.y, labelAt: { x: (e1.x + e2.x) / 2, y: (e1.y + e2.y) / 2 - 6 } };
    });
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    ir.nodes.forEach(function (n) {
      var p = pos[n.id], b = boxes[n.id];
      minX = Math.min(minX, p.x - b.w / 2); maxX = Math.max(maxX, p.x + b.w / 2);
      minY = Math.min(minY, p.y - b.h / 2); maxY = Math.max(maxY, p.y + b.h / 2);
    });
    if (!ir.nodes.length) { minX = 0; minY = 0; maxX = 10; maxY = 10; }
    var pad = 46;
    return {
      archetype: 'graph', reason: reason, ring: [], parked: [],
      pos: pos, boxes: boxes, edges: edges,
      viewBox: [minX - pad, minY - pad, (maxX - minX) + 2 * pad, (maxY - minY) + 2 * pad]
    };
  }

  /* resolve projection + layout — render-core §3 (no hard failures) */
  function layout(ir) {
    var arch = ir.projection ? ir.projection.archetype : 'graph';
    var notices = [];
    if (!ir.projection) notices.push('pas de ligne project — archétype par défaut : graph');
    if (arch === 'cycle') {
      var r = layoutCycle(ir);
      return { layout: r.layout, notices: notices.concat(r.notices), requested: arch };
    }
    if (arch === 'flow') {
      var f = layoutFlow(ir);
      return { layout: f.layout, notices: notices.concat(f.notices), requested: arch };
    }
    if (arch !== 'graph') notices.push('prototype : seuls « cycle » et « flow » sont implémentés — « ' + arch + ' » rendu en secours minimal (graph)');
    return { layout: layoutFallback(ir, 'prototype-scope'), notices: notices, requested: arch };
  }

  return {
    present: present,
    layout: layout,
    layoutCycle: layoutCycle,
    layoutFlow: layoutFlow,
    wrapLabel: wrapLabel,
    nodeBox: nodeBox
  };
});
