// --- Constant exports ---

export const CODECS = ["SVG", "PNG", "WebP", "JPEG", "AVIF"] as const;
export const RESIZE_ALGS = [
    "lanczos3",
    "mitchell",
    "catrom",
    "triangle",
] as const;
export const FIT_MODES = ["cover", "contain", "fill"] as const;
