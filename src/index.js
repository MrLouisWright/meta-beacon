import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { contentPages, canonicalOf, runBeacon, finder, SITE_OPTIONS, SITE_HELP, siteOptions } from './site.js';
import { imageInfo } from './image.js';
import { buildReport, UsageError } from './core.js';

export * from './core.js';
export { imageInfo, SITE_OPTIONS, SITE_HELP, siteOptions };

export const RULES = {
  'title-missing': { severity: 'high', title: 'Page has no <title> or it is empty' },
  'og-image-not-found': { severity: 'high', title: 'og:image / twitter:image points at a file that is not in the build' },
  'title-multiple': { severity: 'medium', title: 'More than one <title> in the head' },
  'description-missing': { severity: 'medium', title: 'No meta description, or it is empty' },
  'description-multiple': { severity: 'medium', title: 'More than one meta description' },
  'meta-outside-head': { severity: 'medium', title: '<title> or social/meta tags are in <body>, where crawlers may ignore them' },
  'og-missing': { severity: 'medium', title: 'Required Open Graph tags are missing (og:title, og:type, og:image, og:url)' },
  'og-relative-url': { severity: 'medium', title: 'og:image / og:url / twitter:image is not an absolute URL' },
  'og-image-format': { severity: 'medium', title: 'og:image is SVG/AVIF or not an image, which most platforms will not render' },
  'twitter-card-invalid': { severity: 'medium', title: 'twitter:card is not summary, summary_large_image, app or player' },
  'viewport-missing': { severity: 'medium', title: 'No <meta name="viewport">' },
  'title-length': { severity: 'low', title: 'Title is shorter or longer than the configured range (default 10–60 characters)' },
  'description-length': { severity: 'low', title: 'Meta description is outside the configured range (default 50–160 characters)' },
  'og-image-size': { severity: 'low', title: 'og:image is smaller than recommended (1200×630), or tiny (<200×200)' },
  'og-image-heavy': { severity: 'low', title: 'og:image file is larger than 5 MB' },
  'og-url-mismatch': { severity: 'low', title: 'og:url differs from the canonical URL' },
  'twitter-card-missing': { severity: 'low', title: 'No twitter:card, so X shows a plain link' },
  'og-image-alt-missing': { severity: 'low', title: 'og:image has no og:image:alt (and no twitter:image:alt)' },
  'charset-missing': { severity: 'low', title: 'No <meta charset> in the first 1024 bytes' },
  'lang-missing': { severity: 'low', title: '<html> has no lang attribute' },
  'og-name-attribute': { severity: 'info', title: 'Open Graph tag uses name= instead of property=' },
};

const OG_REQUIRED = ['og:title', 'og:type', 'og:image', 'og:url'];
const CARDS = new Set(['summary', 'summary_large_image', 'app', 'player']);
const len = (s) => [...String(s)].length;

export function analyze(site, opts = {}, config = {}) {
  const { findings, add } = finder(RULES);
  const [tMin, tMax] = opts.titleLength || config.titleLength || [10, 60];
  const [dMin, dMax] = opts.descriptionLength || config.descriptionLength || [50, 160];
  const requireOg = opts.og ?? config.og ?? true; const requireTwitter = opts.twitter ?? config.twitter ?? true;
  const imgCache = new Map(); let checked = 0;
  for (const pg of contentPages(site)) {
    checked++;
    const d = pg.doc; const at = (line) => ({ file: pg.file, line });
    // title
    const titles = d.titles.filter((t) => !t.el.parent || t.el.parent.tag !== 'svg');
    const headTitles = titles.filter((t) => t.inHead);
    if (!titles.length || !titles.some((t) => t.text)) add('title-missing', pg.path, titles.length ? 'The <title> is empty' : 'No <title>', 'Add a unique, descriptive <title> in the <head>.', at(titles[0]?.line ?? 1));
    else {
      if (headTitles.length > 1) add('title-multiple', pg.path, `${headTitles.length} <title> elements; browsers and crawlers use only the first ("${headTitles[0].text}")`, 'Keep one <title>.', at(headTitles[1].line));
      if (!headTitles.length) add('meta-outside-head', pg.path, '<title> is inside <body>', 'Move <title> into <head> (an element before it may have closed the head early).', at(titles[0].line));
      const t = (headTitles[0] || titles[0]).text; const n = len(t);
      if (t && (n < tMin || n > tMax)) add('title-length', pg.path, `Title is ${n} characters (${n < tMin ? `under ${tMin}` : `over ${tMax}; search results truncate it`}): "${t.length > 90 ? t.slice(0, 87) + '…' : t}"`, n < tMin ? 'Make it descriptive: say what the page is about, then the site name.' : 'Put the important words first and trim it.', at((headTitles[0] || titles[0]).line));
    }
    // description
    const descs = d.meta('description').filter((m) => m.name === 'description');
    if (!descs.length || !descs.some((m) => (m.content || '').trim())) add('description-missing', pg.path, descs.length ? 'meta description is empty' : 'No meta description', 'Add <meta name="description" content="…"> summarising the page in one or two sentences.', at(descs[0]?.line ?? 1));
    else {
      if (descs.length > 1) add('description-multiple', pg.path, `${descs.length} meta descriptions`, 'Keep one.', at(descs[1].line));
      const m = descs.find((x) => x.inHead) || descs[0]; const n = len((m.content || '').trim());
      if (!m.inHead) add('meta-outside-head', pg.path, 'meta description is inside <body>', 'Move it into <head>.', at(m.line));
      if (n < dMin || n > dMax) add('description-length', pg.path, `Meta description is ${n} characters (${n < dMin ? `under ${dMin}` : `over ${dMax}; it will be truncated`})`, n < dMin ? 'Write a fuller summary that would make someone click.' : 'Trim it; put the key message first.', at(m.line));
    }
    // head basics
    const charset = d.metas.find((m) => m.charset || (m.httpEquiv === 'content-type' && /charset/i.test(m.content || '')));
    if (!charset) add('charset-missing', pg.path, 'No <meta charset>', 'Add <meta charset="utf-8"> as the first element in <head>.', at(1));
    else if (pg.html.indexOf('charset') > 1024) add('charset-missing', pg.path, '<meta charset> is not in the first 1024 bytes', 'Move <meta charset="utf-8"> to the top of <head>.', at(charset.line));
    if (!d.metas.some((m) => m.name === 'viewport')) add('viewport-missing', pg.path, 'No <meta name="viewport">', 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.', at(1));
    if (!d.lang) add('lang-missing', pg.path, '<html> has no lang attribute', 'Add lang, e.g. <html lang="en">.', at(d.all.find((e) => e.tag === 'html')?.line ?? 1));
    // Open Graph
    const og = (k) => d.meta(k).filter((m) => (m.content || '').trim());
    for (const m of d.metas.filter((x) => x.name?.startsWith('og:') && !x.property)) add('og-name-attribute', pg.path, `<meta name="${m.name}"> should use property="${m.name}"`, `Use <meta property="${m.name}" content="…">; some parsers ignore name=.`, at(m.line));
    for (const m of d.metas.filter((x) => (x.property?.startsWith('og:') || x.name?.startsWith('twitter:')) && !x.inHead)) { add('meta-outside-head', pg.path, `${m.property || m.name} is inside <body>`, 'Move social tags into <head>; scrapers read only the head.', at(m.line)); break; }
    if (requireOg) { const miss = OG_REQUIRED.filter((k) => !og(k).length); if (miss.length) add('og-missing', pg.path, `Missing ${miss.join(', ')}`, `Add ${miss.map((k) => `<meta property="${k}" content="…">`).join(', ')}.`, at(1)); }
    const canonical = canonicalOf(site, pg).url;
    for (const k of ['og:url', 'og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image']) for (const m of og(k)) if (!/^https?:\/\//i.test(m.content.trim())) add('og-relative-url', pg.path, `${k} "${m.content}" is not an absolute URL`, `Use the full URL, e.g. ${site.origin ? site.resolve(pg, m.content)?.href : 'https://example.com/…'}; scrapers do not resolve relative URLs.`, at(m.line));
    const ogUrl = og('og:url')[0];
    if (ogUrl && canonical && /^https?:/i.test(ogUrl.content)) { try { const a = new URL(ogUrl.content.trim()); if (a.href.replace(/\/$/, '') !== canonical.href.replace(/\/$/, '')) add('og-url-mismatch', pg.path, `og:url ${a.href} differs from canonical ${canonical.href}`, 'Use the canonical URL for og:url so shares consolidate.', at(ogUrl.line)); } catch { /* invalid */ } }
    // images
    const images = [...og('og:image'), ...og('og:image:url'), ...og('twitter:image')];
    const card = d.metaContent('twitter:card');
    for (const m of images) {
      const u = site.resolve(pg, m.content.trim()); if (!u) continue;
      const local = site.origin ? u.origin === site.origin : !/^https?:/i.test(m.content.trim());
      if (!local) continue;
      let rel = decodeURIComponent(u.pathname); if (site.basePath && rel.startsWith(site.basePath)) rel = rel.slice(site.basePath.length);
      const file = join(site.dir, rel);
      if (!existsSync(file)) { add('og-image-not-found', pg.path, `${m.property || m.name} ${m.content} is not in the build (${rel})`, 'Fix the path or add the image to the build output; shares will show no image.', at(m.line)); continue; }
      if (!imgCache.has(file)) { try { imgCache.set(file, imageInfo(file)); } catch { imgCache.set(file, { format: 'unknown' }); } }
      const info = imgCache.get(file);
      if (['svg', 'avif', 'unknown'].includes(info.format)) { add('og-image-format', pg.path, `${rel} is ${info.format === 'unknown' ? 'not a recognised image' : info.format.toUpperCase()}`, 'Use a PNG or JPEG (WebP works on most platforms).', at(m.line)); continue; }
      if (info.width && info.height) {
        const big = (m.name === 'twitter:image' ? card : null) === 'summary_large_image' || m.property?.startsWith('og:');
        if (info.width < 200 || info.height < 200) add('og-image-size', pg.path, `${rel} is ${info.width}×${info.height}; Facebook and LinkedIn ignore images under 200×200`, 'Use 1200×630 (1.91:1).', { ...at(m.line), severity: 'medium' });
        else if (big && (info.width < 1200 || info.height < 630) && !(opts.smallImagesOk || config.smallImagesOk)) add('og-image-size', pg.path, `${rel} is ${info.width}×${info.height}; 1200×630 is recommended for large previews`, 'Export the share image at 1200×630.', at(m.line));
      }
      if (info.bytes > 5 * 1024 * 1024) add('og-image-heavy', pg.path, `${rel} is ${(info.bytes / 1048576).toFixed(1)} MB; X rejects images over 5 MB`, 'Compress it (JPEG quality 80 is usually plenty).', at(m.line));
    }
    if (og('og:image').length && !og('og:image:alt').length && !og('twitter:image:alt').length && (opts.imageAlt ?? config.imageAlt ?? true)) add('og-image-alt-missing', pg.path, 'og:image has no og:image:alt', 'Describe the image with <meta property="og:image:alt" content="…">.', at(og('og:image')[0].line));
    // Twitter
    if (requireTwitter) {
      const cardTag = d.meta('twitter:card')[0];
      if (!cardTag) add('twitter-card-missing', pg.path, 'No twitter:card', 'Add <meta name="twitter:card" content="summary_large_image">; X reads the other fields from Open Graph.', at(1));
      else if (!CARDS.has(String(cardTag.content || '').trim())) add('twitter-card-invalid', pg.path, `twitter:card "${cardTag.content}" is not a valid card type`, 'Use summary or summary_large_image.', at(cardTag.line));
    }
  }
  return { findings, info: { checked } };
}

export function check(dir, opts = {}, config = {}, configFile) {
  const tool = { name: 'meta-beacon', version: opts.toolVersion || '1.0.0', rules: RULES, emoji: '🏷️', defaultFile: 'index.html' };
  return runBeacon(tool, dir, { ...opts, UsageError }, config, configFile, analyze, buildReport);
}
