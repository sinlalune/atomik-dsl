#!/usr/bin/env node
/* Rebuilds apps/prototype-cycle/index.html from repo sources:
 *   packages/dsl-core/src/{lang,render,index}.js  (kernel, browser load order)
 *   apps/prototype-cycle/atomik_ui.js     (painter/UI, with @PRESET_*@ placeholders)
 *   apps/prototype-cycle/template.html    (layout + CSS, with @CORE@/@UI@ markers)
 *   packages/dsl-core/fixtures/…          (presets + golden north-star source)
 * Zero dependencies. Run: npm run build:prototype
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const pkg = join(repo, 'packages', 'dsl-core');

const core = ['lang.js', 'render.js', 'index.js']
  .map((f) => readFileSync(join(pkg, 'src', f), 'utf8'))
  .join('\n');
let ui = readFileSync(join(here, 'atomik_ui.js'), 'utf8');
const tpl = readFileSync(join(here, 'template.html'), 'utf8');
const golden = JSON.parse(readFileSync(join(pkg, 'fixtures', 'atomik_scene_ir_golden_northstar_v0_1.json'), 'utf8'));

const presets = {
  '"@PRESET_DEMO@"': JSON.stringify(readFileSync(join(pkg, 'fixtures', 'presets', 'preset_demo.atomik'), 'utf8')),
  '"@PRESET_SIMPLE@"': JSON.stringify(readFileSync(join(pkg, 'fixtures', 'presets', 'preset_simple.atomik'), 'utf8')),
  '"@PRESET_NORTH@"': JSON.stringify(golden.canonicalSource.join('\n') + '\n'),
  '"@PRESET_BROKEN@"': JSON.stringify(readFileSync(join(pkg, 'fixtures', 'presets', 'preset_broken.atomik'), 'utf8'))
};
for (const [token, value] of Object.entries(presets)) {
  if (!ui.includes(token)) throw new Error('missing placeholder ' + token);
  ui = ui.split(token).join(value);
}

if (!tpl.includes('/*@CORE@*/') || !tpl.includes('/*@UI@*/')) throw new Error('template markers missing');
if (core.includes('</script') || ui.includes('</script')) throw new Error('script-closing sequence in injected JS');

const html = tpl.replace('/*@CORE@*/', core).replace('/*@UI@*/', ui);
const out = join(here, 'index.html');
writeFileSync(out, html);
console.log('built', out, html.length, 'bytes');
