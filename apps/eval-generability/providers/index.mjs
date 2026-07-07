/* Provider registry (CP-DSL-003). Subject models run per provider; the judge
 * always routes through the anthropic provider (Sonnet 5) regardless of
 * subject, per the owner decision. */
import * as anthropic from './anthropic.mjs';
import * as google from './google.mjs';

export const providers = { anthropic, google };
export const SUBJECT_PROVIDERS = ['anthropic', 'google'];

export function get(name) {
  const p = providers[name];
  if (!p) throw new Error('unknown provider "' + name + '" (have: ' + Object.keys(providers).join(', ') + ')');
  return p;
}
