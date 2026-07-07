/* atomik dsl-core — the package's public surface.
 * lang (text → Scene IR) and render (IR → pure runtime + layout) assembled
 * behind the single `Atomik` object consumers know; the internal split is
 * not part of the contract. Browser load order: lang.js, render.js, index.js.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports)
    module.exports = factory(require('./lang.js'), require('./render.js'));
  else root.Atomik = factory(root.AtomikLang, root.AtomikRender);
})(typeof self !== 'undefined' ? self : this, function (lang, render) {
  'use strict';
  return {
    parse: lang.parse,
    present: render.present,
    layout: render.layout,
    layoutCycle: render.layoutCycle,
    layoutFlow: render.layoutFlow,
    wrapLabel: render.wrapLabel,
    nodeBox: render.nodeBox,
    constants: lang.constants
  };
});
