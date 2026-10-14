import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { check, imageInfo, RULES } from '../src/index.js';

const fx = (n) => new URL(`./fixtures/${n}`, import.meta.url).pathname;
const bin = new URL('../bin/meta-beacon.js', import.meta.url).pathname;
const run = (dir, opts = {}, config = {}) => check(dir, opts, config).findings;
const rules = (dir, o, c) => run(dir, o, c).map((f) => f.rule);
function site(files) { const d = mkdtempSync(join(tmpdir(), 'mb-')); for (const [p, c] of Object.entries(files)) { mkdirSync(join(d, p, '..'), { recursive: true }); writeFileSync(join(d, p), c); } return d; }
const head = (inner) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>A perfectly fine page title</title><meta name="description" content="A perfectly reasonable description that is long enough to pass the default check.">${inner}</head><body></body></html>`;

test('good fixture is clean', () => { assert.deepEqual(rules(fx('good')), []); });
test('bad fixture reports every planted problem', () => {
  const r = new Set(rules(fx('bad')));
  for (const x of ['og-image-not-found', 'description-missing', 'og-image-format', 'meta-outside-head', 'og-image-size', 'viewport-missing', 'og-missing', 'title-multiple', 'og-relative-url', 'twitter-card-invalid', 'twitter-card-missing', 'og-image-alt-missing', 'charset-missing', 'lang-missing', 'title-length', 'description-length', 'og-url-mismatch', 'og-name-attribute']) assert.ok(r.has(x), x);
});
test('redirect stubs are skipped', () => { assert.ok(!run(fx('bad')).some((f) => f.file === 'old.html')); });
test('tiny images are medium, small large-card images are low', () => {
  const f = run(fx('bad')).filter((x) => x.rule === 'og-image-size');
  assert.equal(f.find((x) => x.file === 'blog/tiny.html').severity, 'medium'); assert.equal(f.find((x) => x.file === 'index.html').severity, 'low');
});
test('length ranges and og/twitter can be configured', () => {
  const d = site({ 'index.html': head('') });
  assert.ok(rules(d).includes('og-missing'));
  assert.deepEqual(rules(d, { og: false, twitter: false }), []);
  assert.ok(rules(d, { og: false, twitter: false, titleLength: [40, 70] }).includes('title-length'));
  assert.ok(rules(d, { og: false, twitter: false }, { descriptionLength: [10, 20] }).includes('description-length'));
});
test('--base-url resolves relative og:image to a local file', () => {
  const d = site({ 'index.html': head('<meta property="og:image" content="https://ex.org/x.png">') });
  assert.ok(rules(d, { baseUrl: 'https://ex.org', og: false, twitter: false }).includes('og-image-not-found'));
  assert.ok(!rules(d, { baseUrl: 'https://other.org', og: false, twitter: false }).includes('og-image-not-found'));
});
test('imageInfo reads PNG, GIF, JPEG and WebP headers', () => {
  const d = mkdtempSync(join(tmpdir(), 'img-'));
  const gif = Buffer.from('GIF89a\x10\x00\x20\x00', 'latin1'); writeFileSync(join(d, 'a.gif'), gif);
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x76, 0x04, 0xb0, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); writeFileSync(join(d, 'a.jpg'), jpg);
  const webp = Buffer.alloc(30); webp.write('RIFF', 0); webp.write('WEBP', 8); webp.write('VP8X', 12); webp.writeUIntLE(1199, 24, 3); webp.writeUIntLE(629, 27, 3); writeFileSync(join(d, 'a.webp'), webp);
  assert.deepEqual([imageInfo(join(d, 'a.gif')).width, imageInfo(join(d, 'a.gif')).height], [16, 32]);
  assert.deepEqual([imageInfo(join(d, 'a.jpg')).width, imageInfo(join(d, 'a.jpg')).height], [1200, 630]);
  assert.deepEqual([imageInfo(join(d, 'a.webp')).width, imageInfo(join(d, 'a.webp')).height], [1200, 630]);
  assert.equal(imageInfo(fx('good') + '/img/og.png').width, 1200);
});
test('allowlist and exclude', () => {
  const c = { allowlist: [{ rule: 'og-image-not-found', file: 'blog/*', reason: 'tracked', expires: '2099-01-01' }] };
  assert.ok(!rules(fx('bad'), {}, c).includes('og-image-not-found'));
  assert.ok(!run(fx('bad'), { exclude: ['blog/**'] }).some((f) => f.file?.startsWith('blog/')));
});
test('CLI: exit codes, SARIF, list-rules, bad ranges', () => {
  assert.equal(spawnSync(process.execPath, [bin, fx('bad'), '--fail-on', 'high']).status, 1);
  assert.equal(spawnSync(process.execPath, [bin, fx('good'), '--fail-on', 'info']).status, 0);
  assert.equal(spawnSync(process.execPath, [bin, '/nonexistent-dir-xyz']).status, 2);
  assert.equal(spawnSync(process.execPath, [bin, fx('good'), '--title-length', 'abc']).status, 2);
  const s = JSON.parse(execFileSync(process.execPath, [bin, fx('bad'), '-f', 'sarif', '--fail-on', 'none'], { encoding: 'utf8' }));
  assert.equal(s.version, '2.1.0'); assert.ok(s.runs[0].results.length > 10);
  const l = execFileSync(process.execPath, [bin, '--list-rules'], { encoding: 'utf8' }); for (const k of Object.keys(RULES)) assert.ok(l.includes(k));
});
