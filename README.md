# meta-beacon

> Audit titles, meta descriptions, Open Graph and Twitter/X cards across a built static site.

Every page needs a good title, a description and a share preview, and they break in small ways. A template change drops `og:image` from blog posts. A CMS emits two `<title>` tags. Someone ships `og:image="/img/share.png"`, but scrapers don't resolve relative URLs, so links shared on LinkedIn show no image. The share image is an SVG that Facebook won't render, or 300 px wide when 1200×630 is expected. `meta-beacon` reads every page in your build output and reports each of these problems with the file, line, severity and a **concrete fix**. It opens the real image files to check their format and dimensions.

CLI, library and GitHub Action. Node.js 18+, **zero runtime dependencies**. Works on any static build output (Astro, Next.js `output: 'export'`, Eleventy, Hugo, Jekyll, Docusaurus, VitePress, plain HTML) and runs offline: point it at the folder your build writes. By Louis Wright.

## Features

- **Titles and descriptions:** missing, empty, duplicated in the head, placed in `<body>`, and length outside a configurable range (default titles 10–60 and descriptions 50–160 characters).
- **Open Graph:** `og:title`, `og:type`, `og:image` and `og:url` are present; URLs are absolute; `og:url` matches the canonical URL; `name="og:*"` vs `property=` mix-ups; `og:image:alt`.
- **Real share images:** `og:image` and `twitter:image` on your own domain are resolved to files in the build. Missing files, SVG/AVIF, images under 200×200 (ignored by Facebook and LinkedIn), large-card images under 1200×630 and files over 5 MB are reported. PNG, JPEG, GIF and WebP headers are read directly.
- **Twitter/X cards:** `twitter:card` is present and valid (`summary`, `summary_large_image`, `app` or `player`).
- **Head basics:** `<meta charset>` within the first 1024 bytes, viewport, and `<html lang>`.
- **Output:** text, JSON, SARIF 2.1.0 and Markdown; `--fail-on`; exit codes 0/1/2; allowlist entries with expiry dates.

Duplicate titles and descriptions *across* pages are covered by [duplicate-beacon](https://github.com/MrLouisWright/duplicate-beacon), and canonical tags by [canonical-beacon](https://github.com/MrLouisWright/canonical-beacon).

## Rules

| Rule | Default severity | What it catches |
|---|---|---|
| `title-missing` | high | Page has no <title> or it is empty |
| `og-image-not-found` | high | og:image / twitter:image points at a file that is not in the build |
| `title-multiple` | medium | More than one <title> in the head |
| `description-missing` | medium | No meta description, or it is empty |
| `description-multiple` | medium | More than one meta description |
| `meta-outside-head` | medium | <title> or social/meta tags are in <body>, where crawlers may ignore them |
| `og-missing` | medium | Required Open Graph tags are missing (og:title, og:type, og:image, og:url) |
| `og-relative-url` | medium | og:image / og:url / twitter:image is not an absolute URL |
| `og-image-format` | medium | og:image is SVG/AVIF or not an image, which most platforms will not render |
| `twitter-card-invalid` | medium | twitter:card is not summary, summary_large_image, app or player |
| `viewport-missing` | medium | No <meta name="viewport"> |
| `title-length` | low | Title is shorter or longer than the configured range (default 10–60 characters) |
| `description-length` | low | Meta description is outside the configured range (default 50–160 characters) |
| `og-image-size` | low | og:image is smaller than recommended (1200×630), or tiny (<200×200) |
| `og-image-heavy` | low | og:image file is larger than 5 MB |
| `og-url-mismatch` | low | og:url differs from the canonical URL |
| `twitter-card-missing` | low | No twitter:card, so X shows a plain link |
| `og-image-alt-missing` | low | og:image has no og:image:alt (and no twitter:image:alt) |
| `charset-missing` | low | No <meta charset> in the first 1024 bytes |
| `lang-missing` | low | <html> has no lang attribute |
| `og-name-attribute` | info | Open Graph tag uses name= instead of property= |
| `allowlist-expired` | medium | Allowlist entry has expired |
| `allowlist-unused` | info | Allowlist entry matched nothing |

## Install and run

```bash
npx meta-beacon dist                                   # after your build
npx meta-beacon dist --base-url https://example.com --fail-on medium
npx meta-beacon _site --title-length 15-65 --description-length 70-155
npx meta-beacon out --exclude "drafts/**" --no-twitter
```

Pages are mapped to URLs the way static hosts serve them: `index.html` → `/`, `blog/index.html` → `/blog/`, `about.html` → `/about.html` (or `/about` with `--clean-urls`). Pass `--base-url` with your public URL, or let it be inferred from canonical / `og:url` tags. Pages with a meta refresh (redirect stubs) and `404.html` are skipped.

### Sample output

```text
meta-beacon — https://example.com
4 page(s) at https://example.com (inferred)

HIGH     blog/post.html:11 og:image https://example.com/img/missing.jpg is not in the build (/img/missing.jpg) [og-image-not-found]
         ↳ fix: Fix the path or add the image to the build output; shares will show no image.
MEDIUM   blog/post.html:6 meta description is empty [description-missing]
         ↳ fix: Add <meta name="description" content="…"> summarising the page in one or two sentences.
MEDIUM   blog/post.html:12 /img/logo.svg is SVG [og-image-format]
         ↳ fix: Use a PNG or JPEG (WebP works on most platforms).
MEDIUM   blog/post.html:14 <title> is inside <body> [meta-outside-head]
         ↳ fix: Move <title> into <head> (an element before it may have closed the head early).
MEDIUM   blog/tiny.html:4 /img/tiny.png is 100×100; Facebook and LinkedIn ignore images under 200×200 [og-image-size]
         ↳ fix: Use 1200×630 (1.91:1).
MEDIUM   index.html:1 No <meta name="viewport"> [viewport-missing]
         ↳ fix: Add <meta name="viewport" content="width=device-width, initial-scale=1">.
MEDIUM   index.html:1 Missing og:type [og-missing]
         ↳ fix: Add <meta property="og:type" content="…">.
MEDIUM   index.html:5 2 <title> elements; browsers and crawlers use only the first ("Home") [title-multiple]
…

1 high, 9 medium, 9 low, 1 info
✔ Passing (fail-on: none).
```

## Options

```text
meta-beacon 1.0.0 — titles, meta descriptions, Open Graph and Twitter cards for static sites

Usage: meta-beacon [site-dir] [options]

Site
      --base-url <url>        Public URL of the site, e.g. https://example.com (default: inferred from canonical/og:url)
      --include <globs>       Only check these pages (file or URL path globs, comma-separated)
      --exclude <globs>       Skip these pages
      --clean-urls            Pages are served without .html (about.html -> /about)
Checks
      --title-length <min-max>         Title length range in characters (default 10-60)
      --description-length <min-max>   Description length range (default 50-160)
      --no-og                          Do not require Open Graph tags
      --no-twitter                     Do not require twitter:card

Common
  -c, --config <file>     JSON config (default: .meta-beacon.json or "metaBeacon" in package.json)
  -f, --format <fmt>      text (default) | json | sarif | markdown
      --json <file>       Also write a JSON report
      --sarif <file>      Also write SARIF 2.1.0
      --markdown <file>   Also write Markdown (e.g. for a job summary)
      --fail-on <sev>     critical | high | medium | low | info | none (default: high)
      --list-rules        Print rules and default severities
      --no-fixes          Hide fix suggestions in text output
      --no-color          Disable colours
  -v, --version / -h, --help

Exit codes: 0 = passed, 1 = findings at or above --fail-on, 2 = usage, config or read error.
```

## Configuration and allowlist

Options can live in `.meta-beacon.json` (or a `"metaBeacon"` key in `package.json`, or `--config <file>`):

```json
{
  "failOn": "medium",
  "severity": { "title-length": "low" },
  "allowlist": [
    { "rule": "og-image-size", "file": "legacy/**", "reason": "Old campaign pages, removed in Q1", "expires": "2027-03-31" }
  ],
  "titleLength": [15, 65]
}
```

- **`severity`** changes a rule's severity, or turns it `"off"`.
- **`allowlist`** entries suppress matching findings. Each needs a `reason` and matches on any combination of `rule`, `file`, `subject` (globs with `*`) and `match` (a substring of the message). Add `expires` (`YYYY-MM-DD`) so the exception is time-boxed: once it lapses the finding comes back along with an `allowlist-expired` finding (medium). Entries that no longer match anything are reported as `allowlist-unused` (info).

Config can also set `baseUrl`, `include`, `exclude` and `cleanUrls`. The config file is looked up in the site directory first, then in the current directory, so `.meta-beacon.json` can live at your repository root. Other keys: `titleLength` and `descriptionLength` (`[min, max]`), `"og": false`, `"twitter": false`, `"imageAlt": false` and `"smallImagesOk": true`.

## Output and exit codes

- `--format text` (default), `json`, `sarif` (SARIF 2.1.0 for GitHub code scanning) or `markdown` (for job summaries and PR comments). `--json`, `--sarif` and `--markdown` write extra report files in the same run.
- `--fail-on <severity>` sets the threshold (`critical`, `high`, `medium`, `low`, `info`, `none`; default `high`).
- Exit codes: **0** passed, **1** findings at or above `--fail-on`, **2** usage, config or read error.

## GitHub Action

```yaml
permissions:
  contents: read
  security-events: write   # only needed for the SARIF upload
jobs:
  meta-beacon:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
        with: { persist-credentials: false }
      - run: npm ci && npm run build   # produce the static site first
      - uses: MrLouisWright/meta-beacon@v1
        with:
          path: dist
          fail-on: high
          sarif: meta-beacon.sarif
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with: { sarif_file: meta-beacon.sarif }
```

| Input | Description | Default |
|---|---|---|
| `path` | Built site directory (e.g. dist, public, _site) | `.` |
| `base-url` | Public URL of the site, e.g. https://example.com | `` |
| `fail-on` | Failure threshold | `high` |
| `config` | Config file path | |
| `sarif` / `json` | Write SARIF / JSON report to this path | |
| `job-summary` | Add the Markdown report to the job summary | `true` |
| `args` | Extra CLI arguments | |

The action runs the bundled CLI with Node 20; it has no dependencies to install. Pin it to a commit SHA if your policy requires it.

## Library

```js
import { check, imageInfo } from 'meta-beacon';
const report = check('dist', { baseUrl: 'https://example.com' });
for (const f of report.findings) console.log(f.rule, f.file, f.message);
imageInfo('dist/img/og.png'); // { format: 'png', width: 1200, height: 630, bytes: 48213 }
```

Types are included.

## Requirements

Node.js 18 or newer. Zero runtime dependencies.

## Licence

MIT © Louis Wright. See [LICENSE](LICENSE).
