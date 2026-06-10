// STORE-08: this module must NOT be imported by components. Only stores (Phase 2+) and tests may import it.
// Phase 01, Plan 04 — STORE-05 + ICON-01
// Phase 10, Plan 02 — D-04: added optional createdAt field to FileEntry (queue-order sort key)

// --- Type exports ---

// --- Sample bytes (tiny valid 1×1 images) so the seeded demo files actually optimize ---
// Phase 09 regression fix: the real-bytes useOptimize (Plan 03) refuses 0-byte buffers
// (WR-02 / T-9-V5), so byte-less seed entries made "Optimize all" a no-op. Each is a valid
// 1×1 image verified to decode through its jSquash codec (atob-safe at module load — the
// JPEG differs from the test fixture, whose JPEG base64 is intentionally atob-incompatible).
// Source types in STUB_FILES are png/jpg/svg/webp only (no avif source).
import {defaultFileSettings, FileEntry} from "@/lib/settings";

const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const TINY_JPEG_B64 =
  "/9j/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=";
const TINY_WEBP_B64 =
  "UklGRiYAAABXRUJQVlA4IBoAAADQAQCdASoBAAEAAUAmJbACdAEO/g3OAAAA";
const TINY_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="red"/></svg>';

function b64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer as ArrayBuffer;
}

// Fresh ArrayBuffer per call so per-entry buffers never alias (each entry owns its bytes).
function sampleBytesFor(type: string): ArrayBuffer {
  switch (type.toLowerCase()) {
    case "png":
      return b64ToArrayBuffer(TINY_PNG_B64);
    case "jpg":
    case "jpeg":
      return b64ToArrayBuffer(TINY_JPEG_B64);
    case "webp":
      return b64ToArrayBuffer(TINY_WEBP_B64);
    case "svg":
      return new TextEncoder().encode(TINY_SVG).buffer as ArrayBuffer;
    default:
      return new ArrayBuffer(0);
  }
}

// --- Data exports (verbatim from example-ui/data.jsx) ---

const STUB_FILES_SEED: FileEntry[] = [
  {
    id: "f1",
    name: "hero-banner@2x.png",
    type: "png",
    orig: 1842300,
    opt: 412800,
    status: "done",
    target: "webp",
    dim: "2400×1600",
    q: 82,
  },
  {
    id: "f2",
    name: "product-shot-01.jpg",
    type: "jpg",
    orig: 956400,
    opt: 198200,
    status: "done",
    target: "avif",
    dim: "1920×1280",
    q: 60,
  },
  {
    id: "f3",
    name: "icon-set.svg",
    type: "svg",
    orig: 28640,
    opt: 9120,
    status: "done",
    target: "svg",
    dim: "512×512",
    q: null,
  },
  {
    id: "f4",
    name: "avatar-grid.png",
    type: "png",
    orig: 524800,
    opt: 142100,
    status: "done",
    target: "webp",
    dim: "800×800",
    q: 80,
  },
  {
    id: "f5",
    name: "screenshot-dashboard.png",
    type: "png",
    orig: 2104500,
    opt: 487600,
    status: "processing",
    target: "avif",
    dim: "2880×1800",
    q: 55,
    prog: 0.62,
  },
  {
    id: "f6",
    name: "logomark-mono.svg",
    type: "svg",
    orig: 4820,
    opt: 1240,
    status: "done",
    target: "svg",
    dim: "64×64",
    q: null,
  },
  {
    id: "f7",
    name: "background-texture.jpg",
    type: "jpg",
    orig: 1456800,
    opt: 384200,
    status: "done",
    target: "webp",
    dim: "3840×2160",
    q: 75,
  },
  {
    id: "f8",
    name: "team-photo.jpg",
    type: "jpg",
    orig: 3204800,
    opt: 642300,
    status: "done",
    target: "avif",
    dim: "4032×3024",
    q: 65,
  },
  {
    id: "f9",
    name: "brand-illustration.svg",
    type: "svg",
    orig: 142800,
    opt: 38400,
    status: "done",
    target: "svg",
    dim: "1200×800",
    q: null,
  },
  {
    id: "f10",
    name: "menu-card.webp",
    type: "webp",
    orig: 384200,
    opt: 142800,
    status: "queued",
    target: "avif",
    dim: "1600×1200",
    q: 70,
  },
  {
    id: "f11",
    name: "feature-callout.png",
    type: "png",
    orig: 218400,
    opt: 84200,
    status: "done",
    target: "webp",
    dim: "600×400",
    q: 80,
  },
  {
    id: "f12",
    name: "og-card-twitter.jpg",
    type: "jpg",
    orig: 184600,
    opt: 62400,
    status: "queued",
    target: "webp",
    dim: "1200×630",
    q: 78,
  },
];

// Seed each entry with real (tiny, valid) bytes so "Optimize all" dispatches real jobs on
// first load (see sampleBytesFor above). Real uploads supply their own bytes via File handles.
// CR-01: also seed a complete per-file `settings` object so the first inspector edit mutates a
// real object instead of spreading `undefined` (which collapsed settings to a single key).
export const STUB_FILES: FileEntry[] = STUB_FILES_SEED.map((e) => ({
  ...e,
  rawBuffer: sampleBytesFor(e.type),
  settings: defaultFileSettings(e.type, e.q),
}));
