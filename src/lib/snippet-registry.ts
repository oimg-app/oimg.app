/**
 * Snippet registry — Phase 3
 * Source: 03-RESEARCH.md §Pattern 4 (Registry design, D-12)
 *
 * CRITICAL: SnippetPanel MUST use this registry's applicableFormats filter.
 * NEVER add switch(file.format) branches to SnippetPanel — add entries here instead.
 * Phase 5/6 plugs in raster generators by adding entries, NOT by touching SnippetPanel.
 */
import type { FormatId, SnippetId } from '../types/index'
import { generateInlineSvg, generateDataUri } from './svg-snippets'

export interface SnippetDef {
  id: SnippetId
  label: string             // Section title: "Inline SVG", "Data URI · URL-encoded"
  badge: string             // Section badge: "inline", "data-uri"
  codeLabel: string         // code-row .lbl text: "<svg>", "CSS background"
  applicableFormats: FormatId[]
  generate: (svgText: string | null) => string | null  // null = no data or not applicable
}

export const SNIPPET_REGISTRY: Record<SnippetId, SnippetDef> = {
  'inline-svg': {
    id: 'inline-svg',
    label: 'Inline SVG',
    badge: 'inline',
    codeLabel: '<svg>',
    applicableFormats: ['svg'],
    generate: (svgText) => svgText ? generateInlineSvg(svgText) : null,
  },
  'url-encoded-uri': {
    id: 'url-encoded-uri',
    label: 'Data URI · URL-encoded',
    badge: 'data-uri',
    codeLabel: 'CSS background',
    applicableFormats: ['svg'],
    generate: (svgText) => svgText ? generateDataUri(svgText) : null,
  },
  // Phase 5/6 stubs — render nothing for SVG files (applicableFormats excludes 'svg')
  'picture': {
    id: 'picture',
    label: 'Picture',
    badge: 'picture',
    codeLabel: '<picture>',
    applicableFormats: ['png', 'jpeg', 'webp', 'avif'],
    generate: () => null,  // Phase 5/6 implements
  },
  'img-srcset': {
    id: 'img-srcset',
    label: 'Image srcset',
    badge: 'img',
    codeLabel: '<img srcset>',
    applicableFormats: ['png', 'jpeg', 'webp', 'avif'],
    generate: () => null,  // Phase 5/6 implements
  },
  'data-uri-base64': {
    id: 'data-uri-base64',
    label: 'Data URI · Base64',
    badge: 'base64',
    codeLabel: 'CSS background',
    applicableFormats: ['png', 'jpeg', 'webp', 'avif'],
    generate: () => null,  // Phase 5/6 implements
  },
}
