// Quick 260610-lby: ambient declaration for `heic-decode` (no bundled types / no @types package).
// HEIC is a DECODE-ONLY input format — see src/workers/codec.worker.ts decodeSource() 'heic'/'heif' branch.
// Shape mirrors the library's documented API: https://www.npmjs.com/package/heic-decode
//   default({ buffer }) → { width, height, data }  where data is RGBA bytes.
// Analog: src/types/globals.d.ts (single-purpose ambient `.d.ts`, zero-runtime).

declare module 'heic-decode' {
  interface HeicDecodeInput {
    buffer: ArrayBuffer | Uint8Array
  }
  interface HeicDecodeResult {
    width: number
    height: number
    /** RGBA pixel bytes — feed to `new Uint8ClampedArray(data)` then `new ImageData(...)`. */
    data: ArrayBuffer
  }
  /** Decode the primary image of a HEIC/HEIF file to raw RGBA pixels. */
  export default function decode(input: HeicDecodeInput): Promise<HeicDecodeResult>
  /** Decode every image in a multi-image HEIC (unused here, declared for completeness). */
  export function all(input: HeicDecodeInput): Promise<Array<{ width: number; height: number; decode: () => Promise<HeicDecodeResult> }>>
}

declare module 'libheif-js/libheif-wasm/libheif-bundle.mjs' {
  interface HeifDecoder {
    new(): Decoder
  }

  interface WasmDecoder {
    delete(): void
  }

  interface Decoder {
    decoder: WasmDecoder
    decode(input: ArrayBuffer): Array<HeifImage>
  }

  type DisplayCallback = ({ data }: { data: Uint8ClampedArray, width: number, height: number }) => void

  export interface HeifImage {
    get_width(): number
    get_height(): number
    free(): void
    display(input: { data: Uint8ClampedArray, width: number, height: number }, cb: DisplayCallback)
  }

  export interface LibHeifModule {
    HeifDecoder: HeifDecoder
    ready: Promise<boolean>
  }

  export default function module(): LibHeifModule
}
