/* atomik core — prototype implementation of:
 *   - lang-core subset: parse + ground(stub) + validate + IR build (irVersion 0.1)
 *   - render-core subset: pure runtime present(), cycle layout (+ fallback grid)
 * Conforms to atomik_dsl_spec_v0_3.md and atomik_render_core_spec_v0_1.md,
 * including errata C1 (reveal-anywhere hides initially), C2 (set forbidden in
 * rules), C3 (transient notes), C4 (gated-step semantics).
 * UMD-ish: usable from Node (tests) and the browser (prototype UI).
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.Atomik = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STATUSES = ['established', 'supported', 'contested', 'hypothesis',
    'speculative', 'reported', 'misconception', 'unspecified'];
  var CLASSES = ['fact', 'inference', 'hypothesis', 'analogy',
    'interpretation', 'refutation', 'boundary', 'unspecified'];
  var ROLES = ['process', 'decision', 'start', 'terminal',
    'question', 'evidence', 'assumption', 'contradiction'];
  var ARCHETYPES = ['graph', 'flow', 'cycle', 'tree', 'nested', 'concentric',
    'timeline', 'axis', 'matrix', 'bar', 'map'];
  var RELPOS = ['above', 'below', 'left-of', 'right-of', 'inside', 'adjacent'];
  var EFFECTS = ['note', 'reveal', 'hide', 'highlight', 'set', 'require'];

  /* ---------------- small utils ---------------- */

  function isIdent(s) { return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(s); }

  function unquote(s) {
    // s includes the surrounding double quotes
    var out = '', i;
    for (i = 1; i < s.length - 1; i++) {
      var c = s[i];
      if (c === '\\' && i + 1 < s.length - 1) { out += s[i + 1]; i++; }
      else out += c;
    }
    return out;
  }

  /* strip a `#` comment, respecting "…" strings and [[…]] links */
  function stripComment(line) {
    var inStr = false, i;
    for (i = 0; i < line.length; i++) {
      var c = line[i];
      if (inStr) {
        if (c === '\\') i++;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === '#') return line.slice(0, i);
    }
    return line;
  }

  /* pull trailing [key], [key value], [key "value"], [key [[Wiki]]] attrs */
  var ATTR_RE = /\s*\[([A-Za-z_][A-Za-z0-9_-]*)(?:\s+("(?:[^"\\]|\\.)*"|\[\[[^\]]+\]\]|[^\]"]+?))?\s*\]\s*$/;
  function extractAttrs(rest) {
    var attrs = {}, order = [];
    for (;;) {
      var m = ATTR_RE.exec(rest);
      if (!m) break;
      var key = m[1];
      var val = true;
      if (m[2] !== undefined) {
        var raw = m[2].trim();
        if (raw[0] === '"') val = unquote(raw);
        else val = raw;
      }
      attrs[key] = val; order.unshift(key);
      rest = rest.slice(0, m.index);
    }
    return { head: rest.trim(), attrs: attrs, order: order };
  }

  /* tokenizer for statement heads (after keyword, before attrs) */
  function Scanner(s) { this.s = s; this.i = 0; }
  Scanner.prototype.ws = function () { while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++; };
  Scanner.prototype.eof = function () { this.ws(); return this.i >= this.s.length; };
  Scanner.prototype.peek = function () { this.ws(); return this.s[this.i]; };
  Scanner.prototype.rest = function () { this.ws(); return this.s.slice(this.i); };
  Scanner.prototype.tryLit = function (lit) {
    this.ws();
    if (this.s.startsWith(lit, this.i)) { this.i += lit.length; return true; }
    return false;
  };
  Scanner.prototype.word = function () {
    this.ws();
    var m = /^[^\s"]+/.exec(this.s.slice(this.i));
    if (!m) return null;
    this.i += m[0].length; return m[0];
  };
  Scanner.prototype.string = function () {
    this.ws();
    if (this.s[this.i] !== '"') return null;
    var j = this.i + 1;
    while (j < this.s.length) {
      if (this.s[j] === '\\') j += 2;
      else if (this.s[j] === '"') { var raw = this.s.slice(this.i, j + 1); this.i = j + 1; return unquote(raw); }
      else j++;
    }
    return null; // unterminated
  };
  Scanner.prototype.wikilink = function () {
    this.ws();
    if (!this.s.startsWith('[[', this.i)) return null;
    var end = this.s.indexOf(']]', this.i + 2);
    if (end < 0) return null;
    var inner = this.s.slice(this.i + 2, end); this.i = end + 2;
    return inner.trim();
  };

  /* ---------------- expression parser ---------------- */
  function tokenizeExpr(s, err) {
    var toks = [], i = 0;
    var re2 = ['==', '!=', '<=', '>='];
    while (i < s.length) {
      var c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '"') {
        var j = i + 1;
        while (j < s.length && !(s[j] === '"' && s[j - 1] !== '\\')) j++;
        if (j >= s.length) { err('unterminated-string'); return toks; }
        toks.push({ t: 'str', v: unquote(s.slice(i, j + 1)) }); i = j + 1; continue;
      }
      var two = s.slice(i, i + 2);
      if (re2.indexOf(two) >= 0) { toks.push({ t: 'op', v: two }); i += 2; continue; }
      if ('<>+-*/()'.indexOf(c) >= 0) { toks.push({ t: 'op', v: c }); i++; continue; }
      var m = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(s.slice(i));
      if (m) {
        var w = m[0];
        if (w === 'and' || w === 'or' || w === 'not') toks.push({ t: 'op', v: w });
        else toks.push({ t: 'id', v: w });
        i += w.length; continue;
      }
      var n = /^-?\d+(\.\d+)?/.exec(s.slice(i));
      if (n) { toks.push({ t: 'num', v: parseFloat(n[0]) }); i += n[0].length; continue; }
      err('bad-char', c); i++;
    }
    return toks;
  }

  function parseExpr(src, onErr) {
    var bad = false;
    var toks = tokenizeExpr(src, function () { bad = true; });
    var p = 0;
    function peek() { return toks[p]; }
    function eat(v) { if (toks[p] && toks[p].t === 'op' && toks[p].v === v) { p++; return true; } return false; }
    function fact() {
      var t = peek();
      if (!t) { bad = true; return { op: 'lit', value: 0 }; }
      if (eat('not')) return { op: 'not', a: fact() };
      if (eat('(')) { var e = or(); if (!eat(')')) bad = true; return e; }
      if (t.t === 'num') { p++; return { op: 'lit', value: t.v }; }
      if (t.t === 'str') { p++; return { op: 'lit', value: t.v }; }
      if (t.t === 'id') { p++; return { op: 'ref', id: t.v }; }
      bad = true; p++; return { op: 'lit', value: 0 };
    }
    function term() { var a = fact(); for (;;) { if (eat('*')) a = { op: '*', a: a, b: fact() }; else if (eat('/')) a = { op: '/', a: a, b: fact() }; else return a; } }
    function sum() { var a = term(); for (;;) { if (eat('+')) a = { op: '+', a: a, b: term() }; else if (eat('-')) a = { op: '-', a: a, b: term() }; else return a; } }
    function cmp() {
      var a = sum(); var t = peek();
      if (t && t.t === 'op' && ['==', '!=', '<', '<=', '>', '>='].indexOf(t.v) >= 0) { p++; return { op: t.v, a: a, b: sum() }; }
      return a;
    }
    function and() { var a = cmp(); while (eat('and')) a = { op: 'and', a: a, b: cmp() }; return a; }
    function or() { var a = and(); while (eat('or')) a = { op: 'or', a: a, b: and() }; return a; }
    var e = or();
    if (p < toks.length) bad = true;
    if (bad && onErr) onErr();
    return e;
  }

  function exprRefs(e, out) {
    out = out || [];
    if (!e) return out;
    if (e.op === 'ref') out.push(e.id);
    if (e.a) exprRefs(e.a, out);
    if (e.b) exprRefs(e.b, out);
    return out;
  }

  /* ---------------- effect parser ---------------- */
  function parseEffect(sc, diag, line) {
    var w = sc.word();
    if (!w || EFFECTS.indexOf(w) < 0) { diag(line, 'bad-effect', 'error', 'expected an effect: ' + EFFECTS.join(' | ')); return null; }
    if (w === 'note') {
      var s = sc.string();
      if (s === null) { diag(line, 'note-string', 'error', 'note expects a quoted string'); return null; }
      return { type: 'note', text: s };
    }
    if (w === 'set') {
      var id = sc.word(); var v = sc.string();
      if (v === null) { var wv = sc.word(); v = wv !== null && /^-?\d+(\.\d+)?$/.test(wv) ? parseFloat(wv) : wv; }
      if (!id || v === null || v === undefined) { diag(line, 'set-args', 'error', 'set expects: set <input> <value>'); return null; }
      return { type: 'set', input: id, value: v };
    }
    if (w === 'require') {
      var rid = sc.word();
      if (!rid) { diag(line, 'require-args', 'error', 'require expects an input id'); return null; }
      return { type: 'require', input: rid };
    }
    var targets = [];
    for (;;) { var t = sc.word(); if (!t) break; targets.push(t); }
    if (!targets.length) { diag(line, 'targets', 'error', w + ' expects at least one id'); return null; }
    return { type: w, targets: targets };
  }

  /* ---------------- ground (stub) ---------------- */
  /* Prototype grounding: every wikilink resolves to a note named by its text.
   * A real lang-core resolves against the vault index; authored links to
   * missing notes become { kind:"unresolved" } (render-core spec D3). */
  function groundLink(inner, resolver) {
    if (resolver) return resolver(inner);
    return { kind: 'note', target: inner };
  }

  /* ---------------- parse → IR ---------------- */
  function parse(text, opts) {
    opts = opts || {};
    var diagnostics = [];
    function diag(line, code, severity, message, hint) {
      var d = { line: line, code: code, severity: severity, message: message };
      if (hint) d.hint = hint;
      diagnostics.push(d);
    }

    var ir = {
      irVersion: '0.1',
      surface: { language: 'atomik', version: '0.0' },
      origin: 'authored',
      diagnostics: diagnostics,
      scene: null, claim: null,
      groups: [], nodes: [], relations: [], places: [], data: [],
      inputs: [], deriveds: [], rules: [], steps: [], marks: []
    };
    var stepsRaw = {}; // sourceStep -> {effects, requires, lines}
    var dataById = {};
    var synth = 0;

    var lines = text.split(/\r?\n/);
    for (var ln = 1; ln <= lines.length; ln++) {
      var raw = stripComment(lines[ln - 1]);
      if (!raw.trim()) continue;
      var ex = extractAttrs(raw);
      var head = ex.head, attrs = ex.attrs;
      var sc = new Scanner(head);
      var kw = sc.word();
      if (!kw) continue;

      switch (kw) {
        case 'atomik': {
          var v = sc.word();
          ir.surface.version = v || '0.0';
          break;
        }
        case 'scene': {
          var sid = sc.word();
          if (!sid || !isIdent(sid)) { diag(ln, 'scene-id', 'error', 'scene expects an identifier'); break; }
          ir.scene = { id: sid, line: ln };
          if (attrs.origin === 'generated' || attrs.origin === 'authored') ir.origin = attrs.origin;
          break;
        }
        case 'claim': {
          var ct = sc.string();
          if (ct === null) { diag(ln, 'claim-string', 'error', 'claim expects a quoted string'); break; }
          var cst = attrs.status;
          if (cst && STATUSES.indexOf(cst) < 0) { diag(ln, 'bad-status', 'warning', 'unknown status "' + cst + '"', 'one of: ' + STATUSES.join(' ')); cst = 'unspecified'; }
          ir.claim = { text: ct, status: cst || 'unspecified', line: ln };
          break;
        }
        case 'subject': {
          var wl = sc.wikilink();
          var lbl;
          if (wl !== null) lbl = { text: wl, ref: groundLink(wl, opts.resolver) };
          else { var ss = sc.string(); if (ss === null) { diag(ln, 'subject-arg', 'error', 'subject expects [[Note]] or "text"'); break; } lbl = { text: ss, ref: { kind: 'literal' } }; }
          ir.subject = { label: lbl, line: ln };
          break;
        }
        case 'node': case 'evidence': {
          var nid = sc.word();
          if (!nid || !isIdent(nid)) { diag(ln, kw + '-id', 'error', kw + ' expects an identifier'); break; }
          var nwl = sc.wikilink(); var nlbl;
          if (nwl !== null) nlbl = { text: nwl, ref: groundLink(nwl, opts.resolver) };
          else { var ns = sc.string(); if (ns === null) { diag(ln, kw + '-label', 'error', kw + ' expects a "label" or [[Note]]'); break; } nlbl = { text: ns, ref: { kind: 'literal' } }; }
          var role = kw === 'evidence' ? 'evidence' : (attrs.role || 'process');
          if (ROLES.indexOf(role) < 0) { diag(ln, 'bad-role', 'warning', 'unknown role "' + role + '"'); role = 'process'; }
          var nst = attrs.status || 'unspecified';
          if (STATUSES.indexOf(nst) < 0) { diag(ln, 'bad-status', 'warning', 'unknown status "' + nst + '"'); nst = 'unspecified'; }
          var node = { id: nid, label: nlbl, role: role, status: nst };
          if (attrs['in']) node.group = String(attrs['in']);
          if (attrs.salience === 'criterial' || attrs.salience === 'incidental') node.salience = attrs.salience;
          if (typeof attrs.tone === 'string') node.tone = attrs.tone;
          if (attrs.source !== undefined) {
            var sv = String(attrs.source);
            var mlink = /^\[\[([^\]]+)\]\]$/.exec(sv);
            node.source = mlink ? { text: mlink[1].trim(), ref: groundLink(mlink[1].trim(), opts.resolver) }
                                : { text: sv, ref: { kind: 'literal' } };
          }
          if (attrs.date !== undefined) node.date = String(attrs.date);
          node.initiallyHidden = false; // computed after full pass (D4)
          node.line = ln;
          node.extras = {};
          var known = ['role', 'status', 'in', 'salience', 'tone', 'source', 'date'];
          for (var k in attrs) if (known.indexOf(k) < 0) node.extras[k] = attrs[k];
          ir.nodes.push(node);
          break;
        }
        case 'relation': {
          // optional "<id>:" prefix
          var relId = null;
          var save = sc.i;
          var maybe = sc.word();
          if (maybe && maybe.slice(-1) === ':' && isIdent(maybe.slice(0, -1))) relId = maybe.slice(0, -1);
          else if (maybe && sc.tryLit(':') && isIdent(maybe)) relId = maybe;
          else sc.i = save;
          function endpoint() {
            var w2 = sc.word();
            if (!w2) return null;
            // arrow may be glued: a->b handled by requiring spaces in v0.3 canonical;
            // tolerate glued arrows:
            var g = /^(.*?)(->|~)(.*)$/.exec(w2);
            if (g && g[1] && g[3]) { sc.i -= (w2.length - g[1].length); w2 = g[1]; }
            else if (g && g[1] && !g[3]) { sc.i -= (w2.length - g[1].length); w2 = g[1]; }
            if (w2 === 'claim') return { kind: 'claim' };
            if (!isIdent(w2)) return null;
            return { kind: 'pending', id: w2 };
          }
          var from = endpoint();
          var arrow = null;
          if (sc.tryLit('->')) arrow = '->';
          else if (sc.tryLit('~')) arrow = '~';
          else { var aw = sc.word(); if (aw === '->' || aw === '~') arrow = aw; }
          var to = arrow ? endpoint() : null;
          if (!from || !arrow || !to) { diag(ln, 'relation-shape', 'error', 'relation expects: [id:] a -> b <kind>  or  a ~ b <kind>'); break; }
          var kind = '';
          if (!sc.eof()) { var kwd = sc.word(); if (kwd) kind = kwd; }
          var cls = attrs['as'] || 'unspecified';
          if (CLASSES.indexOf(cls) < 0) { diag(ln, 'bad-class', 'warning', 'unknown class "' + cls + '"', 'one of: ' + CLASSES.slice(0, -1).join(' ')); cls = 'unspecified'; }
          var rst = attrs.status || 'unspecified';
          if (STATUSES.indexOf(rst) < 0) { diag(ln, 'bad-status', 'warning', 'unknown status "' + rst + '"'); rst = 'unspecified'; }
          var rel = {
            id: relId || ('~r' + (++synth)),
            idSource: relId ? 'authored' : 'synthetic',
            from: from, to: to, directed: arrow === '->',
            kind: kind, 'class': cls, status: rst,
            initiallyHidden: false, line: ln, extras: {}
          };
          if (attrs.sign === '+' || attrs.sign === '-') rel.sign = attrs.sign;
          if (attrs.weight !== undefined && !isNaN(parseFloat(attrs.weight))) rel.weight = parseFloat(attrs.weight);
          if (attrs.many === true) rel.many = true;
          if (typeof attrs.label === 'string') rel.label = attrs.label;
          var knownR = ['as', 'status', 'sign', 'weight', 'many', 'label'];
          for (var k2 in attrs) if (knownR.indexOf(k2) < 0) rel.extras[k2] = attrs[k2];
          ir.relations.push(rel);
          break;
        }
        case 'group': {
          var gid = sc.word();
          if (!gid || !isIdent(gid)) { diag(ln, 'group-id', 'error', 'group expects an identifier'); break; }
          var glabel = sc.string();
          var g2 = { id: gid, kind: 'cluster', line: ln };
          if (glabel !== null) g2.label = glabel;
          if (['cluster', 'lane', 'loop'].indexOf(attrs.kind) >= 0) g2.kind = attrs.kind;
          if (attrs.polarity === 'reinforcing' || attrs.polarity === 'balancing') g2.polarity = attrs.polarity;
          ir.groups.push(g2);
          break;
        }
        case 'place': {
          var pid = sc.word();
          var nx = sc.word();
          if (!pid || !nx) { diag(ln, 'place-shape', 'error', 'place expects: place <id> at <value> | place <id> <relpos> <id>'); break; }
          if (nx === 'at') {
            var val = sc.word();
            var num = parseFloat(val);
            if (isNaN(num)) { diag(ln, 'place-value', 'error', 'place ... at expects a number'); break; }
            ir.places.push({ node: pid, mode: 'value', at: num, line: ln });
          } else if (RELPOS.indexOf(nx) >= 0) {
            var anc = sc.word();
            if (!anc) { diag(ln, 'place-anchor', 'error', 'place <id> ' + nx + ' expects an anchor id'); break; }
            ir.places.push({ node: pid, mode: 'relative', rel: nx, anchor: anc, line: ln });
          } else diag(ln, 'place-shape', 'error', 'unknown place form "' + nx + '"');
          break;
        }
        case 'data': {
          var did = sc.word(); var mode = sc.word();
          if (!did || (mode !== 'cols' && mode !== 'row')) { diag(ln, 'data-shape', 'error', 'data expects: data <id> cols|row "a" | "b" | ...'); break; }
          var cells = sc.rest().split('|').map(function (c) {
            c = c.trim();
            if (c[0] === '"' && c.slice(-1) === '"') return unquote(c);
            return c;
          }).filter(function (c) { return c.length > 0; });
          var tb = dataById[did];
          if (!tb) { tb = dataById[did] = { id: did, cols: [], rows: [], lines: [] }; ir.data.push(tb); }
          if (mode === 'cols') tb.cols = cells; else tb.rows.push(cells);
          tb.lines.push(ln);
          break;
        }
        case 'project': {
          if (!sc.tryLit('as')) { var w3 = sc.word(); if (w3 !== 'as') { diag(ln, 'project-as', 'error', 'project expects: project as <archetype>'); break; } }
          var arch = sc.word();
          if (ARCHETYPES.indexOf(arch) < 0) { diag(ln, 'bad-archetype', 'warning', 'unknown archetype "' + arch + '"', 'one of: ' + ARCHETYPES.join(' ')); arch = 'graph'; }
          var proj = { archetype: arch, suggested: attrs.suggested === true, line: ln };
          // optional "from <id>" and "lo..hi"
          for (;;) {
            var save2 = sc.i; var t2 = sc.word();
            if (!t2) break;
            if (t2 === 'from') { var fid = sc.word(); if (fid) proj.from = fid; }
            else {
              var mr = /^(-?\d+(?:\.\d+)?)\.\.(-?\d+(?:\.\d+)?)$/.exec(t2);
              if (mr) proj.range = [parseFloat(mr[1]), parseFloat(mr[2])];
              else { sc.i = save2; break; }
            }
          }
          if (attrs.scale === 'linear' || attrs.scale === 'log') proj.scale = attrs.scale;
          if (typeof attrs.label === 'string') proj.label = attrs.label;
          ir.projection = proj;
          break;
        }
        case 'input': {
          var iid = sc.word();
          if (!iid || !isIdent(iid)) { diag(ln, 'input-id', 'error', 'input expects an identifier'); break; }
          if (!sc.tryLit('=')) { diag(ln, 'input-eq', 'error', 'input expects: input <id> = slider|choice|toggle …'); break; }
          var ity = sc.word();
          var control = null;
          if (ity === 'slider') {
            var rw = sc.word();
            var mr2 = /^(-?\d+(?:\.\d+)?)\.\.(-?\d+(?:\.\d+)?)$/.exec(rw || '');
            if (!mr2) { diag(ln, 'slider-range', 'error', 'slider expects lo..hi'); break; }
            control = { type: 'slider', min: parseFloat(mr2[1]), max: parseFloat(mr2[2]) };
            if (attrs['default'] !== undefined) control['default'] = parseFloat(attrs['default']);
          } else if (ity === 'choice') {
            var optsArr = [];
            for (;;) {
              var s3 = sc.string();
              if (s3 === null) break;
              optsArr.push(s3);
              if (!sc.tryLit('|')) break;
            }
            if (!optsArr.length) { diag(ln, 'choice-options', 'error', 'choice expects "a" | "b" | …'); break; }
            control = { type: 'choice', options: optsArr };
            if (typeof attrs['default'] === 'string') control['default'] = attrs['default'];
          } else if (ity === 'toggle') {
            control = { type: 'toggle' };
            if (attrs['default'] !== undefined) control['default'] = (attrs['default'] === true || attrs['default'] === 'true');
          } else { diag(ln, 'input-type', 'error', 'input type must be slider, choice, or toggle'); break; }
          var inp = { id: iid, control: control };
          if (typeof attrs.label === 'string') inp.label = attrs.label;
          inp.committedByDefault = control.type === 'slider' || control.type === 'toggle'
            ? true : (control['default'] !== undefined);
          inp.line = ln;
          ir.inputs.push(inp);
          break;
        }
        case 'derive': {
          var did2 = sc.word();
          if (!did2 || !isIdent(did2)) { diag(ln, 'derive-id', 'error', 'derive expects an identifier'); break; }
          if (!sc.tryLit('=')) { diag(ln, 'derive-eq', 'error', 'derive expects: derive <id> = <expr>'); break; }
          var bad1 = false;
          var e1 = parseExpr(sc.rest(), function () { bad1 = true; });
          if (bad1) diag(ln, 'expr', 'error', 'could not parse expression');
          ir.deriveds.push({ id: did2, expr: e1, line: ln });
          break;
        }
        case 'rule': {
          var restLine = sc.rest();
          var idx = -1, inS = false;
          for (var i3 = 0; i3 < restLine.length - 1; i3++) {
            var c3 = restLine[i3];
            if (inS) { if (c3 === '\\') i3++; else if (c3 === '"') inS = false; }
            else if (c3 === '"') inS = true;
            else if (c3 === '=' && restLine[i3 + 1] === '>') { idx = i3; break; }
          }
          if (idx < 0) { diag(ln, 'rule-arrow', 'error', 'rule expects: rule <expr> => <effect>'); break; }
          var bad2 = false;
          var cond = parseExpr(restLine.slice(0, idx), function () { bad2 = true; });
          if (bad2) diag(ln, 'expr', 'error', 'could not parse rule condition');
          var eff = parseEffect(new Scanner(restLine.slice(idx + 2)), diag, ln);
          if (!eff) break;
          if (eff.type === 'set') { diag(ln, 'set-in-rule', 'error', 'set is not allowed in rules (C2) — use it in a step', 'move this set into a step'); break; }
          if (eff.type === 'require') { diag(ln, 'require-in-rule', 'error', 'require only makes sense in a step'); break; }
          ir.rules.push({ when: cond, effect: eff, line: ln });
          break;
        }
        case 'step': {
          var nw = sc.word();
          var sn = parseInt(nw, 10);
          if (isNaN(sn) || sn < 1) { diag(ln, 'step-n', 'error', 'step expects a positive integer'); break; }
          var eff2 = parseEffect(sc, diag, ln);
          if (!eff2) break;
          var slot = stepsRaw[sn] || (stepsRaw[sn] = { sourceStep: sn, effects: [], requires: [], lines: [] });
          if (eff2.type === 'require') { if (slot.requires.indexOf(eff2.input) < 0) slot.requires.push(eff2.input); }
          else slot.effects.push(eff2);
          slot.lines.push(ln);
          break;
        }
        case 'mark': {
          var mk = sc.word();
          if (mk !== 'meter') { diag(ln, 'mark-kind', 'warning', 'only "mark meter" exists in v0.3 — line skipped'); break; }
          var mlabel = sc.string();
          var vword = sc.word(); // "value"
          var vref = sc.word();
          if (mlabel === null || vword !== 'value' || !vref) { diag(ln, 'mark-shape', 'error', 'mark expects: mark meter "label" value <id> [max n]'); break; }
          var mark = { kindOfMark: 'meter', label: mlabel, value: vref, line: ln };
          if (attrs.max !== undefined && !isNaN(parseFloat(attrs.max))) mark.max = parseFloat(attrs.max);
          ir.marks.push(mark);
          break;
        }
        default:
          diag(ln, 'unknown-keyword', 'warning', 'unknown keyword "' + kw + '" — line skipped (forward compatibility)');
      }
    }

    /* ---- steps normalization ---- */
    var stepNums = Object.keys(stepsRaw).map(Number).sort(function (a, b) { return a - b; });
    ir.steps = stepNums.map(function (n2, i4) {
      var s4 = stepsRaw[n2];
      s4.lines.sort(function (a, b) { return a - b; });
      return { index: i4 + 1, sourceStep: n2, effects: s4.effects, requires: s4.requires, lines: s4.lines };
    });

    /* ---- resolve endpoints + validate ids ---- */
    var nodeById = {}, relByAuthored = {}, inputById = {}, deriveById = {};
    ir.nodes.forEach(function (n3) {
      if (nodeById[n3.id]) diag(n3.line, 'dup-id', 'error', 'duplicate node id "' + n3.id + '"');
      nodeById[n3.id] = n3;
    });
    ir.relations.forEach(function (r3) {
      if (r3.idSource === 'authored') {
        if (relByAuthored[r3.id] || nodeById[r3.id]) diag(r3.line, 'dup-id', 'error', 'duplicate id "' + r3.id + '"');
        relByAuthored[r3.id] = r3;
      }
    });
    ir.inputs.forEach(function (x) { if (inputById[x.id]) diag(x.line, 'dup-id', 'error', 'duplicate input id "' + x.id + '"'); inputById[x.id] = x; });
    ir.deriveds.forEach(function (x) { if (deriveById[x.id] || inputById[x.id]) diag(x.line, 'dup-id', 'error', 'duplicate id "' + x.id + '"'); deriveById[x.id] = x; });

    function resolveEndpoint(ep, line) {
      if (ep.kind === 'claim') return ep;
      var id = ep.id;
      if (nodeById[id]) return { kind: 'node', id: id };
      if (relByAuthored[id]) return { kind: 'relation', id: id };
      var near = nearest(id, Object.keys(nodeById).concat(Object.keys(relByAuthored)));
      diag(line, 'unknown-id', 'error', 'unknown id "' + id + '"', near ? 'nearest: "' + near + '"' : undefined);
      return { kind: 'node', id: id };
    }
    ir.relations.forEach(function (r4) {
      r4.from = resolveEndpoint(r4.from, r4.line);
      r4.to = resolveEndpoint(r4.to, r4.line);
    });

    /* effect target / input checks */
    function checkTargets(eff3, line) {
      if (eff3.type === 'reveal' || eff3.type === 'hide' || eff3.type === 'highlight') {
        eff3.targets.forEach(function (t3) {
          if (!nodeById[t3] && !relByAuthored[t3]) {
            var near2 = nearest(t3, Object.keys(nodeById).concat(Object.keys(relByAuthored)));
            diag(line, 'unknown-id', 'error', 'unknown id "' + t3 + '" in ' + eff3.type, near2 ? 'nearest: "' + near2 + '"' : undefined);
          }
        });
      }
      if (eff3.type === 'set' && !inputById[eff3.input]) diag(line, 'unknown-input', 'error', 'unknown input "' + eff3.input + '"');
    }
    ir.steps.forEach(function (s5) {
      s5.effects.forEach(function (e5) { checkTargets(e5, s5.lines[0]); });
      s5.requires.forEach(function (rq) { if (!inputById[rq]) diag(s5.lines[0], 'unknown-input', 'error', 'require: unknown input "' + rq + '"'); });
    });
    ir.rules.forEach(function (r5) {
      checkTargets(r5.effect, r5.line);
      exprRefs(r5.when).forEach(function (ref) {
        if (!inputById[ref] && !deriveById[ref]) diag(r5.line, 'unknown-ref', 'error', 'rule references unknown value "' + ref + '"');
      });
    });
    ir.deriveds.forEach(function (d5) {
      exprRefs(d5.expr).forEach(function (ref) {
        if (!inputById[ref] && !deriveById[ref]) diag(d5.line, 'unknown-ref', 'error', 'derive references unknown value "' + ref + '"');
      });
    });
    ir.marks.forEach(function (m5) {
      if (!inputById[m5.value] && !deriveById[m5.value]) diag(m5.line, 'unknown-ref', 'error', 'mark references unknown value "' + m5.value + '"');
    });
    ir.nodes.forEach(function (n5) {
      if (n5.group && !ir.groups.some(function (g5) { return g5.id === n5.group; }))
        diag(n5.line, 'unknown-group', 'warning', 'unknown group "' + n5.group + '"');
    });

    /* ---- D4 / C1: initial visibility ---- */
    var revealed = {};
    ir.steps.forEach(function (s6) { s6.effects.forEach(function (e6) { if (e6.type === 'reveal') e6.targets.forEach(function (t6) { revealed[t6] = true; }); }); });
    ir.rules.forEach(function (r6) { if (r6.effect.type === 'reveal') r6.effect.targets.forEach(function (t6) { revealed[t6] = true; }); });
    ir.nodes.forEach(function (n6) { n6.initiallyHidden = !!revealed[n6.id]; });
    ir.relations.forEach(function (r7) { r7.initiallyHidden = !!revealed[r7.id]; });

    /* ---- required frame ---- */
    if (!ir.scene) diag(1, 'missing-scene', 'error', 'missing "scene <id>" statement');
    if (!ir.claim) diag(1, 'missing-claim', 'error', 'missing claim — a scene asserts exactly one thing');
    if (ir.origin === 'generated' && ir.claim && ir.claim.status === 'unspecified')
      diag(ir.claim.line, 'claim-status-required', 'error', 'generated profile: claim [status …] is required (dsl spec §8)');

    return ir;
  }

  /* tiny Levenshtein-lite for hints */
  function nearest(id, ids) {
    var best = null, bestD = 3;
    ids.forEach(function (c) {
      var d = lev(id, c);
      if (d < bestD) { bestD = d; best = c; }
    });
    return best;
  }
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    var m = [], i, j;
    for (i = 0; i <= a.length; i++) { m[i] = [i]; }
    for (j = 0; j <= b.length; j++) { m[0][j] = j; }
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++)
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return m[a.length][b.length];
  }

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
    if (arch !== 'graph') notices.push('prototype : seul « cycle » est implémenté — « ' + arch + ' » rendu en secours minimal (graph)');
    return { layout: layoutFallback(ir, 'prototype-scope'), notices: notices, requested: arch };
  }

  return {
    parse: parse,
    present: present,
    layout: layout,
    layoutCycle: layoutCycle,
    wrapLabel: wrapLabel,
    nodeBox: nodeBox,
    constants: { STATUSES: STATUSES, CLASSES: CLASSES, ROLES: ROLES, ARCHETYPES: ARCHETYPES }
  };
});
