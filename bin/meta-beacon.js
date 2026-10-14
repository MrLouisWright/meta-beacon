#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { mainCli, check, RULES, SITE_OPTIONS, SITE_HELP } from '../src/index.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const range = (v, name) => { if (v == null) return undefined; const m = /^(\d+)[-,:](\d+)$/.exec(v); if (!m) throw Object.assign(new Error(`--${name} must look like 10-60`), { code: 'EINVAL' }); return [+m[1], +m[2]]; };
mainCli({
  name: 'meta-beacon', version: pkg.version, configKey: 'metaBeacon', rules: RULES,
  tagline: 'titles, meta descriptions, Open Graph and Twitter cards for static sites',
  usage: 'Usage: meta-beacon [site-dir] [options]',
  help: `${SITE_HELP}Checks
      --title-length <min-max>         Title length range in characters (default 10-60)
      --description-length <min-max>   Description length range (default 50-160)
      --no-og                          Do not require Open Graph tags
      --no-twitter                     Do not require twitter:card
`,
  options: { ...SITE_OPTIONS, 'title-length': { type: 'string' }, 'description-length': { type: 'string' }, 'no-og': { type: 'boolean' }, 'no-twitter': { type: 'boolean' } },
  run: async ({ dir, values: o, config, configFile }) => {
    let tl; let dl;
    try { tl = range(o['title-length'], 'title-length'); dl = range(o['description-length'], 'description-length'); } catch (e) { const { UsageError } = await import('../src/core.js'); throw new UsageError(e.message); }
    return check(dir, { cli: o, titleLength: tl, descriptionLength: dl, og: o['no-og'] ? false : undefined, twitter: o['no-twitter'] ? false : undefined, toolVersion: pkg.version }, config, configFile);
  },
});
