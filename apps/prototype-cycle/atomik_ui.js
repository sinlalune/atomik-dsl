/* atomik prototype UI — browser only (syntax-checkable in node). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var SVGNS = 'http://www.w3.org/2000/svg';

  var PRESETS = {
    demo: { label: '1 · Démo complète (cycle + méprise + porte)', src: "@PRESET_DEMO@" },
    simple: { label: '2 · Cycle simple + curseur (projection suggérée)', src: "@PRESET_SIMPLE@" },
    northstar: { label: '3 · Étoile polaire (fixture, rendu de secours)', src: "@PRESET_NORTH@" },
    broken: { label: '4 · Diagnostics (scène volontairement cassée)', src: "@PRESET_BROKEN@" }
  };

  var STATUS_GLYPH = {
    established: '●', supported: '◉', contested: '◐', hypothesis: '?',
    speculative: '≈', reported: 'ℹ', misconception: '✕', unspecified: '·'
  };
  var STATUS_FR = {
    established: 'établi', supported: 'étayé', contested: 'contesté', hypothesis: 'hypothèse',
    speculative: 'spéculatif', reported: 'rapporté', misconception: 'croyance fausse', unspecified: 'non précisé'
  };

  var state = { currentStep: 1, inputs: {}, committed: [] };
  var ir = null, geo = null, notices = [], compiled = false;

  /* ---------- compile ---------- */
  var debounceTimer = null;
  function onEdit() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(compile, 220);
  }

  function compile() {
    var src = $('src').value;
    ir = Atomik.parse(src);
    var L = Atomik.layout(ir);
    geo = L.layout; notices = L.notices.slice();
    var skipped = geo.edges.filter(function (e) { return e.skip; }).length;
    if (skipped) notices.push(skipped + ' arête(s) vers claim/relation non tracée(s) (prototype)');
    state = { currentStep: 1, inputs: {}, committed: [] };
    compiled = true;
    renderAll();
  }

  /* ---------- render ---------- */
  function renderAll() {
    if (!compiled) return;
    renderDiagnostics();
    renderIRTab();
    renderClaimBar();
    renderNotices();
    var pres = Atomik.present(ir, state);
    renderStage(pres, { badges: false });
    renderNotes(pres);
    renderInputs(pres);
    renderMeters(pres);
    renderStepNav(pres);
  }

  function renderClaimBar() {
    var bar = $('claimbar');
    bar.innerHTML = '';
    if (!ir.claim) { bar.textContent = '— pas de claim —'; return; }
    var chip = document.createElement('span');
    chip.className = 'chip status-' + ir.claim.status;
    chip.textContent = STATUS_GLYPH[ir.claim.status] + ' ' + STATUS_FR[ir.claim.status];
    var txt = document.createElement('span');
    txt.className = 'claimtext';
    txt.textContent = ir.claim.text;
    bar.appendChild(chip); bar.appendChild(txt);
    if (ir.subject) {
      var sub = document.createElement('span');
      sub.className = 'subject';
      sub.textContent = '⌘ ' + ir.subject.label.text;
      bar.appendChild(sub);
    }
  }

  function renderNotices() {
    var row = $('notices'); row.innerHTML = '';
    /* projection selector (I4): prominent when suggested */
    var projWrap = document.createElement('span');
    projWrap.className = 'chip proj' + (ir.projection && ir.projection.suggested ? ' suggested' : '');
    projWrap.appendChild(document.createTextNode('projection : '));
    var sel = document.createElement('select');
    Atomik.constants.ARCHETYPES.forEach(function (a) {
      var o = document.createElement('option');
      o.value = a; o.textContent = a;
      sel.appendChild(o);
    });
    sel.value = ir.projection ? ir.projection.archetype : 'graph';
    sel.onchange = function () { flipProjection(sel.value); };
    projWrap.appendChild(sel);
    if (ir.projection && ir.projection.suggested) {
      var st = document.createElement('em'); st.textContent = ' suggérée par l’IA — à toi de trancher';
      projWrap.appendChild(st);
    }
    row.appendChild(projWrap);
    notices.forEach(function (n) {
      var c = document.createElement('span');
      c.className = 'chip warn'; c.textContent = n;
      row.appendChild(c);
    });
  }

  /* I4: flipping rewrites exactly the project line in the source */
  function flipProjection(arch) {
    var ta = $('src');
    var lines = ta.value.split('\n');
    if (ir.projection && ir.projection.line) {
      var i = ir.projection.line - 1;
      lines[i] = lines[i].replace(/project\s+as\s+[A-Za-z-]+/, 'project as ' + arch);
    } else {
      lines.push('project as ' + arch);
    }
    ta.value = lines.join('\n');
    compile();
  }

  function renderStage(pres, opts) {
    var host = $('stage');
    host.innerHTML = '';
    host.appendChild(buildSVG(pres, opts));
  }

  function buildSVG(pres, opts) {
    opts = opts || {};
    var svg = document.createElementNS(SVGNS, 'svg');
    var vb = geo.viewBox;
    svg.setAttribute('viewBox', vb.join(' '));
    svg.setAttribute('class', 'scene');
    svg.setAttribute('role', 'img');
    if (ir.claim) svg.setAttribute('aria-label', ir.claim.text + ' (statut : ' + STATUS_FR[ir.claim.status] + ')');

    var defs = document.createElementNS(SVGNS, 'defs');
    defs.innerHTML =
      '<marker id="m-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M0,0 L10,5 L0,10 z" fill="var(--edge)"/></marker>' +
      '<marker id="m-tbar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto">' +
      '<path d="M8,0 L8,10" stroke="var(--refute)" stroke-width="2.6"/></marker>';
    svg.appendChild(defs);

    /* lane regions under everything (flow: layout.lanes) */
    if (geo.lanes && geo.lanes.length) {
      geo.lanes.forEach(function (L) {
        var rc = document.createElementNS(SVGNS, 'rect');
        rc.setAttribute('x', L.x0 - 14); rc.setAttribute('y', vb[1] + 6);
        rc.setAttribute('width', (L.x1 - L.x0) + 28); rc.setAttribute('height', vb[3] - 12);
        rc.setAttribute('rx', 12);
        rc.setAttribute('class', 'lane');
        svg.appendChild(rc);
        if (L.label) {
          var lt = document.createElementNS(SVGNS, 'text');
          lt.setAttribute('x', L.x0 - 2); lt.setAttribute('y', vb[1] + 26);
          lt.setAttribute('class', 'lanelabel');
          lt.textContent = L.label;
          svg.appendChild(lt);
        }
      });
    }

    var visN = {}, visR = {}, hi = {};
    pres.visibleNodes.forEach(function (id) { visN[id] = true; });
    pres.visibleRelations.forEach(function (id) { visR[id] = true; });
    pres.highlighted.forEach(function (id) { hi[id] = true; });

    var relById = {};
    ir.relations.forEach(function (r) { relById[r.id] = r; });

    /* edges under nodes */
    geo.edges.forEach(function (e) {
      if (e.skip) return;
      var r = relById[e.id];
      var g = document.createElementNS(SVGNS, 'g');
      g.setAttribute('class', 'edge cls-' + r['class'] + (hi[r.id] ? ' hi' : ''));
      if (!visR[r.id]) g.setAttribute('display', 'none');
      var p = document.createElementNS(SVGNS, 'path');
      /* a pre-routed path (ring arcs, flow back-edges) always wins over the straight segment */
      p.setAttribute('d', e.path ? e.path : ('M ' + e.x1 + ' ' + e.y1 + ' L ' + e.x2 + ' ' + e.y2));
      p.setAttribute('fill', 'none');
      if (r.directed) p.setAttribute('marker-end', r['class'] === 'refutation' ? 'url(#m-tbar)' : 'url(#m-arrow)');
      g.appendChild(p);
      if (r['class'] === 'boundary') {
        var bx = e.labelAt.x;
        var by = e.labelAt.y;
        var brk = document.createElementNS(SVGNS, 'text');
        brk.setAttribute('x', bx); brk.setAttribute('y', by);
        brk.setAttribute('class', 'breakglyph'); brk.textContent = '✂';
        g.appendChild(brk);
      }
      if (r.kind || r.sign || r.label) {
        var t = document.createElementNS(SVGNS, 'text');
        t.setAttribute('x', e.labelAt.x); t.setAttribute('y', e.labelAt.y);
        t.setAttribute('class', 'edgelabel');
        t.textContent = (r.kind || '') + (r.sign ? ' ' + r.sign : '') + (r.label ? ' — ' + r.label : '');
        g.appendChild(t);
      }
      svg.appendChild(g);
    });

    /* first-revealing step per id (for export badges) */
    var firstStep = {};
    ir.steps.forEach(function (s) {
      s.effects.forEach(function (e) {
        if (e.type === 'reveal') e.targets.forEach(function (t) {
          if (firstStep[t] === undefined) firstStep[t] = s.sourceStep;
        });
      });
    });

    ir.nodes.forEach(function (n) {
      var p = geo.pos[n.id], b = geo.boxes[n.id];
      if (!p) return;
      var g = document.createElementNS(SVGNS, 'g');
      g.setAttribute('class', 'node role-' + n.role + ' status-' + n.status +
        (hi[n.id] ? ' hi' : '') + (n.salience === 'criterial' ? ' criterial' : '') +
        (n.salience === 'incidental' ? ' incidental' : ''));
      if (!visN[n.id]) g.setAttribute('display', 'none');
      g.setAttribute('aria-label', n.label.text);
      var x = p.x - b.w / 2, y = p.y - b.h / 2;

      if (hi[n.id]) {
        var glow = document.createElementNS(SVGNS, 'rect');
        glow.setAttribute('x', x - 5); glow.setAttribute('y', y - 5);
        glow.setAttribute('width', b.w + 10); glow.setAttribute('height', b.h + 10);
        glow.setAttribute('rx', 14); glow.setAttribute('class', 'glow');
        g.appendChild(glow);
      }

      var shape;
      if (n.role === 'decision') {
        shape = document.createElementNS(SVGNS, 'polygon');
        shape.setAttribute('points',
          p.x + ',' + y + ' ' + (x + b.w) + ',' + p.y + ' ' + p.x + ',' + (y + b.h) + ' ' + x + ',' + p.y);
      } else {
        shape = document.createElementNS(SVGNS, 'rect');
        shape.setAttribute('x', x); shape.setAttribute('y', y);
        shape.setAttribute('width', b.w); shape.setAttribute('height', b.h);
        shape.setAttribute('rx', (n.role === 'start' || n.role === 'terminal') ? b.h / 2 : 10);
      }
      shape.setAttribute('class', 'box');
      g.appendChild(shape);

      if (n.role === 'contradiction') {
        var inner = document.createElementNS(SVGNS, 'rect');
        inner.setAttribute('x', x + 4); inner.setAttribute('y', y + 4);
        inner.setAttribute('width', b.w - 8); inner.setAttribute('height', b.h - 8);
        inner.setAttribute('rx', 8); inner.setAttribute('class', 'box inner');
        g.appendChild(inner);
      }
      if (n.role === 'evidence') {
        var fold = document.createElementNS(SVGNS, 'path');
        fold.setAttribute('d', 'M ' + (x + b.w - 16) + ' ' + y + ' L ' + (x + b.w) + ' ' + (y + 16) +
          ' L ' + (x + b.w - 16) + ' ' + (y + 16) + ' Z');
        fold.setAttribute('class', 'fold');
        g.appendChild(fold);
      }

      var badgeRoom = n.status === 'misconception' ? 18 : 0;
      var textTop = y + (b.h - badgeRoom) / 2 - (b.lines.length - 1) * 8;
      b.lines.forEach(function (lineTxt, i) {
        var t = document.createElementNS(SVGNS, 'text');
        t.setAttribute('x', p.x); t.setAttribute('y', textTop + i * 16);
        t.setAttribute('class', 'label');
        t.textContent = lineTxt;
        g.appendChild(t);
      });

      if (n.status === 'misconception') {
        var strike = document.createElementNS(SVGNS, 'line');
        strike.setAttribute('x1', x + 8); strike.setAttribute('y1', y + (b.h - badgeRoom) - 4);
        strike.setAttribute('x2', x + b.w - 8); strike.setAttribute('y2', y + 6);
        strike.setAttribute('class', 'strike');
        g.appendChild(strike);
        var bw = 118, bh2 = 16;
        var br = document.createElementNS(SVGNS, 'rect');
        br.setAttribute('x', p.x - bw / 2); br.setAttribute('y', y + b.h - bh2 - 4);
        br.setAttribute('width', bw); br.setAttribute('height', bh2);
        br.setAttribute('rx', 8); br.setAttribute('class', 'falsebadge');
        g.appendChild(br);
        var bt = document.createElementNS(SVGNS, 'text');
        bt.setAttribute('x', p.x); bt.setAttribute('y', y + b.h - 8);
        bt.setAttribute('class', 'falsebadgetext');
        bt.textContent = '✕ croyance fausse';
        g.appendChild(bt);
      }

      if (opts.badges && firstStep[n.id] !== undefined) {
        var bc = document.createElementNS(SVGNS, 'circle');
        bc.setAttribute('cx', x + 2); bc.setAttribute('cy', y + 2); bc.setAttribute('r', 10);
        bc.setAttribute('class', 'stepbadge');
        g.appendChild(bc);
        var bn = document.createElementNS(SVGNS, 'text');
        bn.setAttribute('x', x + 2); bn.setAttribute('y', y + 6);
        bn.setAttribute('class', 'stepbadgetext');
        bn.textContent = String(firstStep[n.id]);
        g.appendChild(bn);
      }
      svg.appendChild(g);
    });
    return svg;
  }

  function renderNotes(pres) {
    var host = $('notes'); host.innerHTML = '';
    pres.notes.forEach(function (n) {
      var d = document.createElement('div');
      d.className = 'note';
      d.innerHTML = '<span class="origin"></span>';
      d.firstChild.textContent = n.origin;
      d.appendChild(document.createTextNode(' ' + n.text));
      host.appendChild(d);
    });
  }

  function renderInputs(pres) {
    var host = $('inputs'); host.innerHTML = '';
    ir.inputs.forEach(function (inp) {
      var wrap = document.createElement('div');
      wrap.className = 'input' + (pres.lockedInputs.indexOf(inp.id) >= 0 ? ' locked' : '');
      var lab = document.createElement('label');
      lab.textContent = inp.label || inp.id;
      wrap.appendChild(lab);
      var cur = pres.env[inp.id];
      if (inp.control.type === 'choice') {
        inp.control.options.forEach(function (opt) {
          var l2 = document.createElement('label'); l2.className = 'opt';
          var r = document.createElement('input');
          r.type = 'radio'; r.name = 'in-' + inp.id; r.value = opt;
          r.checked = cur === opt;
          r.onchange = function () { commit(inp.id, opt); };
          l2.appendChild(r); l2.appendChild(document.createTextNode(' ' + opt));
          wrap.appendChild(l2);
        });
      } else if (inp.control.type === 'slider') {
        var s = document.createElement('input');
        s.type = 'range'; s.min = inp.control.min; s.max = inp.control.max; s.step = 'any';
        s.value = cur;
        var v = document.createElement('span'); v.className = 'val';
        v.textContent = ' ' + (Math.round(cur * 10) / 10);
        s.oninput = function () { commit(inp.id, parseFloat(s.value)); };
        wrap.appendChild(s); wrap.appendChild(v);
      } else {
        var c = document.createElement('input');
        c.type = 'checkbox'; c.checked = !!cur;
        c.onchange = function () { commit(inp.id, c.checked); };
        wrap.appendChild(c);
      }
      host.appendChild(wrap);
    });
  }

  function commit(id, val) {
    state.inputs[id] = val;
    if (state.committed.indexOf(id) < 0) state.committed.push(id);
    renderAll();
  }

  function renderMeters(pres) {
    var host = $('meters'); host.innerHTML = '';
    ir.marks.forEach(function (m) {
      var v = pres.env[m.value];
      var max = m.max !== undefined ? m.max : 100;
      var pct = Math.max(0, Math.min(100, (parseFloat(v) / max) * 100));
      var d = document.createElement('div'); d.className = 'meter';
      var lab = document.createElement('span'); lab.textContent = m.label + ' : ' + (Math.round(parseFloat(v) * 10) / 10);
      var bar = document.createElement('div'); bar.className = 'bar';
      var fill = document.createElement('div'); fill.className = 'fill'; fill.style.width = pct + '%';
      bar.appendChild(fill);
      d.appendChild(lab); d.appendChild(bar);
      host.appendChild(d);
    });
  }

  function renderStepNav(pres) {
    var host = $('stepnav'); host.innerHTML = '';
    if (pres.maxStep <= 1 && !ir.steps.length) { host.classList.add('empty'); return; }
    host.classList.remove('empty');
    var prev = document.createElement('button');
    prev.textContent = '◀ Préc.'; prev.disabled = !pres.canPrev;
    prev.onclick = function () { state.currentStep = Math.max(1, state.currentStep - 1); renderAll(); };
    var next = document.createElement('button');
    next.textContent = 'Suiv. ▶'; next.disabled = !pres.canNext;
    next.onclick = function () { state.currentStep = Math.min(pres.maxStep, state.currentStep + 1); renderAll(); };
    var lab = document.createElement('span'); lab.className = 'steplabel';
    lab.textContent = 'Étape ' + pres.currentStep + ' / ' + pres.maxStep;
    host.appendChild(prev); host.appendChild(lab); host.appendChild(next);
    if (pres.lockedInputs.length) {
      var lock = document.createElement('span'); lock.className = 'lock';
      var names = pres.lockedInputs.map(function (id) {
        var inp = ir.inputs.filter(function (x) { return x.id === id; })[0];
        return inp && inp.label ? inp.label : id;
      });
      lock.textContent = '🔒 engage-toi d’abord : ' + names.join(', ');
      host.appendChild(lock);
    }
  }

  function renderDiagnostics() {
    var host = $('diags'); host.innerHTML = '';
    var count = $('diagcount');
    var errs = ir.diagnostics.filter(function (d) { return d.severity === 'error'; }).length;
    var warns = ir.diagnostics.length - errs;
    count.textContent = ir.diagnostics.length ? (errs + ' err · ' + warns + ' warn') : '✓';
    count.className = errs ? 'bad' : (warns ? 'meh' : 'good');
    if (!ir.diagnostics.length) {
      var okd = document.createElement('div'); okd.className = 'diag ok';
      okd.textContent = '✓ aucun diagnostic — scène valide';
      host.appendChild(okd); return;
    }
    ir.diagnostics.forEach(function (d) {
      var el = document.createElement('div');
      el.className = 'diag ' + d.severity;
      el.textContent = 'L' + d.line + ' · ' + d.code + ' — ' + d.message + (d.hint ? '  ↳ ' + d.hint : '');
      el.onclick = function () { focusLine(d.line); };
      host.appendChild(el);
    });
  }

  function focusLine(line) {
    var ta = $('src');
    var lines = ta.value.split('\n');
    var start = 0;
    for (var i = 0; i < line - 1 && i < lines.length; i++) start += lines[i].length + 1;
    var end = start + (lines[line - 1] || '').length;
    ta.focus(); ta.setSelectionRange(start, end);
  }

  function renderIRTab() {
    $('irjson').textContent = JSON.stringify(JSON.parse(JSON.stringify(ir)), null, 2);
  }

  /* export: all-revealed + step badges (render-core §5) */
  function exportSVG() {
    var pres = Atomik.present(ir, state, { ignoreGates: true });
    var svg = buildSVG(pres, { badges: true });
    svg.setAttribute('xmlns', SVGNS);
    var style = document.createElement('style');
    style.textContent = document.getElementById('scene-css').textContent;
    svg.insertBefore(style, svg.firstChild.nextSibling);
    var meta = document.createComment(' atomik source:\n' + $('src').value.replace(/--/g, '—') + '\n');
    svg.appendChild(meta);
    var blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (ir.scene ? ir.scene.id : 'scene') + '.svg';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 500);
  }

  /* ---------- tabs & wiring ---------- */
  function showTab(name) {
    ['source', 'ir', 'diag'].forEach(function (t) {
      $('tab-' + t).classList.toggle('active', t === name);
      $('pane-' + t).style.display = t === name ? '' : 'none';
    });
  }

  function boot() {
    var sel = $('preset');
    Object.keys(PRESETS).forEach(function (k) {
      var o = document.createElement('option');
      o.value = k; o.textContent = PRESETS[k].label;
      sel.appendChild(o);
    });
    sel.onchange = function () { $('src').value = PRESETS[sel.value].src; compile(); };
    $('src').addEventListener('input', onEdit);
    $('tab-source').onclick = function () { showTab('source'); };
    $('tab-ir').onclick = function () { showTab('ir'); };
    $('tab-diag').onclick = function () { showTab('diag'); };
    $('export').onclick = exportSVG;
    document.addEventListener('keydown', function (ev) {
      if (ev.target && ev.target.tagName === 'TEXTAREA') return;
      if (ev.key === 'ArrowRight') { var p1 = Atomik.present(ir, state); if (p1.canNext) { state.currentStep++; renderAll(); } }
      if (ev.key === 'ArrowLeft') { var p2 = Atomik.present(ir, state); if (p2.canPrev) { state.currentStep--; renderAll(); } }
    });
    $('src').value = PRESETS.demo.src;
    showTab('source');
    compile();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
