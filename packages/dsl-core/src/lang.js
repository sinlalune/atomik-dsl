/* atomik lang kernel — text → Scene IR (irVersion 0.1).
 * Tokenize, parse, ground (stub), validate (both profiles), fill defaults,
 * compute initial visibility (D4/C1), reject set/require in rules (C2).
 * Conforms to atomik_dsl_spec_v0_3.md (v0.3.1) and render-core spec §2.
 * DOM-free, dependency-free. UMD-ish: Node (require) or browser (AtomikLang).
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.AtomikLang = factory();
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

  return {
    parse: parse,
    constants: { STATUSES: STATUSES, CLASSES: CLASSES, ROLES: ROLES, ARCHETYPES: ARCHETYPES }
  };
});
