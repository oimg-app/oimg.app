// Visual-shell fixtures for Phase 1.
// Static mock data the App.tsx prototype renders today (12 fake files, 22 SVGO plugin
// entries, codec/resize/fit enums). This file will be deleted in Phase 2 when the
// real codec pipeline replaces it. For PRODUCTION codec defaults that the Phase 2
// pipeline reads, see src/data/defaults.ts.

export type FileType = 'png' | 'jpg' | 'svg' | 'webp' | 'avif';
export type FileStatusMock = 'queued' | 'processing' | 'done' | 'error';

export interface MockFile {
  id: string;
  name: string;
  type: FileType;
  orig: number;
  opt: number;
  status: FileStatusMock;
  target: FileType;
  dim: string;
  q: number | null;
  prog?: number;
}

export const MOCK_FILES: MockFile[] = [
  { id: 'f1',  name: 'hero-banner@2x.png',        type: 'png',  orig: 1842300, opt: 412800, status: 'done',       target: 'webp', dim: '2400×1600', q: 82 },
  { id: 'f2',  name: 'product-shot-01.jpg',       type: 'jpg',  orig: 956400,  opt: 198200, status: 'done',       target: 'avif', dim: '1920×1280', q: 60 },
  { id: 'f3',  name: 'icon-set.svg',              type: 'svg',  orig: 28640,   opt: 9120,   status: 'done',       target: 'svg',  dim: '512×512',   q: null },
  { id: 'f4',  name: 'avatar-grid.png',           type: 'png',  orig: 524800,  opt: 142100, status: 'done',       target: 'webp', dim: '800×800',   q: 80 },
  { id: 'f5',  name: 'screenshot-dashboard.png',  type: 'png',  orig: 2104500, opt: 487600, status: 'processing', target: 'avif', dim: '2880×1800', q: 55, prog: 0.62 },
  { id: 'f6',  name: 'logomark-mono.svg',         type: 'svg',  orig: 4820,    opt: 1240,   status: 'done',       target: 'svg',  dim: '64×64',     q: null },
  { id: 'f7',  name: 'background-texture.jpg',    type: 'jpg',  orig: 1456800, opt: 384200, status: 'done',       target: 'webp', dim: '3840×2160', q: 75 },
  { id: 'f8',  name: 'team-photo.jpg',            type: 'jpg',  orig: 3204800, opt: 642300, status: 'done',       target: 'avif', dim: '4032×3024', q: 65 },
  { id: 'f9',  name: 'brand-illustration.svg',    type: 'svg',  orig: 142800,  opt: 38400,  status: 'done',       target: 'svg',  dim: '1200×800',  q: null },
  { id: 'f10', name: 'menu-card.webp',            type: 'webp', orig: 384200,  opt: 142800, status: 'queued',     target: 'avif', dim: '1600×1200', q: 70 },
  { id: 'f11', name: 'feature-callout.png',       type: 'png',  orig: 218400,  opt: 84200,  status: 'done',       target: 'webp', dim: '600×400',   q: 80 },
  { id: 'f12', name: 'og-card-twitter.jpg',       type: 'jpg',  orig: 184600,  opt: 62400,  status: 'queued',     target: 'webp', dim: '1200×630',  q: 78 },
];

export interface SvgoPlugin {
  id: string;
  on: boolean;
  saves: string;
}

export const SVGO_PLUGINS: SvgoPlugin[] = [
  { id: 'removeDoctype', on: true, saves: '0.4%' },
  { id: 'removeXMLProcInst', on: true, saves: '0.3%' },
  { id: 'removeComments', on: true, saves: '1.2%' },
  { id: 'removeMetadata', on: true, saves: '0.8%' },
  { id: 'removeEditorsNSData', on: true, saves: '2.1%' },
  { id: 'cleanupAttrs', on: true, saves: '0.6%' },
  { id: 'mergeStyles', on: true, saves: '4.8%' },
  { id: 'inlineStyles', on: true, saves: '6.2%' },
  { id: 'minifyStyles', on: true, saves: '3.4%' },
  { id: 'convertStyleToAttrs', on: false, saves: '1.8%' },
  { id: 'cleanupIds', on: true, saves: '5.6%' },
  { id: 'removeRasterImages', on: false, saves: '—' },
  { id: 'removeUselessDefs', on: true, saves: '2.4%' },
  { id: 'cleanupNumericValues', on: true, saves: '8.1%' },
  { id: 'convertColors', on: true, saves: '1.4%' },
  { id: 'removeEmptyAttrs', on: true, saves: '0.5%' },
  { id: 'removeEmptyContainers', on: true, saves: '0.7%' },
  { id: 'removeUnusedNS', on: true, saves: '0.3%' },
  { id: 'sortAttrs', on: true, saves: '—' },
  { id: 'removeDimensions', on: false, saves: '0.4%' },
  { id: 'convertPathData', on: true, saves: '14.3%' },
  { id: 'mergePaths', on: true, saves: '7.2%' },
];

export type CodecLabel = 'SVG' | 'PNG' | 'WebP' | 'JPEG' | 'AVIF';
export const CODECS: CodecLabel[] = ['SVG', 'PNG', 'WebP', 'JPEG', 'AVIF'];

export type ResizeAlg = 'lanczos3' | 'mitchell' | 'catrom' | 'triangle';
export const RESIZE_ALG: ResizeAlg[] = ['lanczos3', 'mitchell', 'catrom', 'triangle'];

export type FitMode = 'cover' | 'contain' | 'fill';
export const FIT_MODES: FitMode[] = ['cover', 'contain', 'fill'];
