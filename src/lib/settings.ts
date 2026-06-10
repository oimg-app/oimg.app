
export type FileStatus = "done" | "processing" | "queued" | "error";
export type Codec = "SVG" | "PNG" | "WebP" | "JPEG" | "AVIF";
export type SortKey =
    | "queue order"
    | "file size"
    | "savings %"
    | "name"
    | "format";

export interface FileEntry {
    id: string;
    name: string;
    type: string;
    orig: number;
    opt: number;
    status: FileStatus;
    target: string;
    dim: string;
    q: number | null;
    /** Set to Date.now() at ingest; used as queue-order sort key (D-04 / Phase 10 Plan 02). Optional so legacy STUB_FILES entries without it remain valid. */
    createdAt?: number;
    prog?: number;
    settings?: FileSettings; // per-file settings (D-01) — optional until initialized
    rawBuffer?: ArrayBuffer; // original file bytes; cache for live re-encode (D-05)
    encodedBuffer?: ArrayBuffer; // result of last encode
    error?: string; // per-file error message (D-13)
}

export interface SvgoPlugin {
    id: string;
    on: boolean;
    saves: string;
}

// SVGO plugin defaults — declared here (before defaultFileSettings/STUB_FILES) so module-eval-time
// seeding of per-file settings can reference it without hitting the const temporal-dead-zone (CR-01).
export const SVGO_PLUGINS: SvgoPlugin[] = [
    { id: "removeDoctype", on: true, saves: "0.4%" },
    { id: "removeXMLProcInst", on: true, saves: "0.3%" },
    { id: "removeComments", on: true, saves: "1.2%" },
    { id: "removeMetadata", on: true, saves: "0.8%" },
    { id: "removeEditorsNSData", on: true, saves: "2.1%" },
    { id: "cleanupAttrs", on: true, saves: "0.6%" },
    { id: "mergeStyles", on: true, saves: "4.8%" },
    { id: "inlineStyles", on: true, saves: "6.2%" },
    { id: "minifyStyles", on: true, saves: "3.4%" },
    { id: "convertStyleToAttrs", on: false, saves: "1.8%" },
    { id: "cleanupIds", on: true, saves: "5.6%" },
    { id: "removeRasterImages", on: false, saves: "—" },
    { id: "removeUselessDefs", on: true, saves: "2.4%" },
    { id: "cleanupNumericValues", on: true, saves: "8.1%" },
    { id: "convertColors", on: true, saves: "1.4%" },
    { id: "removeEmptyAttrs", on: true, saves: "0.5%" },
    { id: "removeEmptyContainers", on: true, saves: "0.7%" },
    { id: "removeUnusedNS", on: true, saves: "0.3%" },
    { id: "sortAttrs", on: true, saves: "—" },
    { id: "removeDimensions", on: false, saves: "0.4%" },
    { id: "convertPathData", on: true, saves: "14.3%" },
    { id: "mergePaths", on: true, saves: "7.2%" },
];

// Phase 09, Plan 01 — D-01/D-03: per-file settings shape (mirrors SettingsState in settings.ts)
export interface FileSettings {
    codec: Codec;
    q: number;
    method: number;
    lossless: boolean;
    resizeOn: boolean;
    w: string;
    h: string;
    alg: string;
    fit: string;
    stripMeta: boolean;
    keepIcc: boolean;
    aggressive: boolean;
    plugins: SvgoPlugin[];
    progressive?: boolean; // JPEG only — default true (Pitfall 6)

    colorsOn: boolean;
    colors: number;
    dithering: number;
}

// D-01: shallow-copy helper — call when adding entries to assign per-file defaults without aliasing.
// `plugins` is deep-copied (map + spread) so per-file plugin toggles never alias the shared
// SVGO_PLUGINS array or another entry's plugin objects (CR-01 fold-in).
export function initFileSettings(defaults: FileSettings): FileSettings {
    return { ...defaults, plugins: defaults.plugins.map((p) => ({ ...p })) };
}

// Map a raw FileEntry.type (lowercase, e.g. 'png'/'jpg'/'svg') to its natural output Codec.
// Used to seed per-file defaults so a freshly-seeded entry encodes to a sane target before
// the user touches the inspector (CR-01).
export function codecForType(type: string): Codec {
    switch (type.toLowerCase()) {
        case "svg":
            return "SVG";
        case "png":
            return "PNG";
        case "jpg":
        case "jpeg":
            return "JPEG";
        case "webp":
            return "WebP";
        case "avif":
            return "AVIF";
        // Quick 260610-lby: HEIC/HEIF are INPUT-only — map to JPEG (universal raster output for photos).
        // DO NOT add 'HEIC' to the Codec union or CODECS array — that would create a forbidden inspector tab.
        case "heic":
        case "heif":
            return "JPEG";
        default:
            return "WebP";
    }
}

// CR-01: build a complete, self-contained FileSettings for a seeded/uploaded entry. Without this,
// entries had no `settings` field and the first inspector edit spread `undefined` — collapsing the
// whole settings object down to the single edited key (data loss + broken encodes). codec derives
// from the entry's own type; q from the entry's own q (falling back to the WebP-ish default 82).
export function defaultFileSettings(
    type: string,
    q: number | null,
): FileSettings {
    return {
        codec: codecForType(type),
        q: q ?? 82,
        method: 4,
        lossless: false,
        resizeOn: false,
        colorsOn: false,
        w: "1600",
        h: "auto",
        alg: "lanczos3",
        fit: "contain",
        stripMeta: true,
        keepIcc: false,
        aggressive: false,
        plugins: SVGO_PLUGINS.map((p) => ({ ...p })),
        progressive: true,
        colors: 256,
        dithering: 1,
    };
}
