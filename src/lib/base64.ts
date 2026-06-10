
/**
 * D-02: chunked base64 — `String.fromCharCode(...new Uint8Array(huge))` blows V8 call
 * stack at ~125KB. 32KB (0x8000) window is the standard browser-safe slice size.
 */
export function bufferToBase64(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf)
    const CHUNK = 0x8000 // 32KB
    let binary = ''
    for (let i = 0; i < bytes.length; i += CHUNK) {
        const slice = bytes.subarray(i, i + CHUNK)
        binary += String.fromCharCode.apply(null, slice as unknown as number[])
    }
    return btoa(binary)
}
