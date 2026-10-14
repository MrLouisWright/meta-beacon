import type { Report, Rule } from './core.js';
export * from './core.js';

export interface SiteOptions {
  /** Public URL of the site, e.g. "https://example.com". Inferred from canonical/og:url when omitted. */
  baseUrl?: string;
  /** Only check pages matching these file or URL-path globs. */
  include?: string[];
  /** Skip pages matching these globs. */
  exclude?: string[];
  /** Pages are served without the .html extension. */
  cleanUrls?: boolean;
  now?: Date;
  toolVersion?: string;
  [option: string]: unknown;
}
export declare const RULES: Record<string, Rule>;
export declare const SITE_OPTIONS: Record<string, { type: 'string' | 'boolean'; multiple?: boolean }>;
export declare const SITE_HELP: string;
/** Check a built static site directory. config is the parsed .meta-beacon.json. */
export declare function check(dir: string, opts?: SiteOptions, config?: Record<string, unknown>, configFile?: string): Report;
export declare function analyze(site: unknown, opts?: SiteOptions, config?: Record<string, unknown>): { findings: Report['findings']; info: Record<string, unknown> };
export declare function imageInfo(file: string): { format: 'png' | 'jpeg' | 'gif' | 'webp' | 'svg' | 'avif' | 'unknown'; width?: number; height?: number; bytes: number };
export declare function siteOptions(cli?: Record<string, unknown>, config?: Record<string, unknown>): SiteOptions;
