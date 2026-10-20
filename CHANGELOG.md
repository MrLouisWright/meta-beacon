# Changelog

## 1.0.1 - 2026-10-20

- Docs: README badges, credit and support sections, links to the project site; homepage now points to the project site.
- No changes to the package code.

## 1.0.0 (2026-10-14)

First release, by Louis Wright.

- Reads every HTML page in a build directory (`dist/`, `public/`, `_site/`, `out/`) and maps it to its public URL.
- Title and meta description: missing, empty, duplicated in the head, outside the head, too short or too long (characters, configurable).
- Open Graph: `og:title`, `og:type`, `og:image`, `og:url` presence; absolute URLs; `og:url` vs canonical; `og:image` resolved to the local file with PNG/JPEG/GIF/WebP dimensions, size and format checks; alt text.
- Twitter/X cards: valid `twitter:card`, image fallback to `og:image`, `summary_large_image` sizing.
- Head basics: `<meta charset>`, viewport, `<html lang>`, `name="og:*"` vs `property=` mix-ups.
- Text/JSON/SARIF/Markdown output, `--fail-on`, exit codes 0/1/2, allowlist with expiry, severity overrides.
- Composite GitHub Action with job summary.
