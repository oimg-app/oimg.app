// Phase 5 plan 02 — ICC extraction/embedding utilities.
// Pure ArrayBuffer/DataView operations — NO external npm dependency.
// Source: 05-RESEARCH.md §ICC Preservation; 05-02-PLAN.md Task 2.
//
// T-5-02-03: extractPngIcc() returns null on ANY parse error — never throws.
// T-5-02-04: embedPngIcc() validates PNG magic bytes before walking chunks.
//
// PNG chunk format: [4-byte BE length][4-byte ASCII type][N bytes data][4-byte CRC]
// PNG signature: 8 bytes 0x89 50 4E 47 0D 0A 1A 0A
// iCCP chunk data: [null-terminated name][1-byte compression method][compressed ICC data]
//
// JPEG segment format: 0xFF [marker] [2-byte BE length including length bytes] [data]
// APP2 ICC marker: 0xFF 0xE2, data starts with 'ICC_PROFILE\0' (12 bytes)
// followed by [1-byte sequence number (1-indexed)] [1-byte total segments] [ICC chunk]

// ─────────────────────────────────────────────────────────────────────────────
// CRC32 (inline, no dependency)
// Standard table-lookup CRC32. Required for PNG iCCP chunk injection.
// ─────────────────────────────────────────────────────────────────────────────

const CRC32_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    t[i] = c
  }
  return t
})()

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

// ─────────────────────────────────────────────────────────────────────────────
// PNG utilities
// ─────────────────────────────────────────────────────────────────────────────

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const ICCP_TYPE = 0x69434350 // 'iCCP' as 32-bit BE
// IHDR_TYPE not used directly — IHDR is found by position (always first chunk, 13 bytes)
const IEND_TYPE = 0x49454e44 // 'IEND' as 32-bit BE

function hasPngSignature(view: DataView): boolean {
  if (view.byteLength < 8) return false
  for (let i = 0; i < 8; i++) {
    if (view.getUint8(i) !== PNG_SIGNATURE[i]) return false
  }
  return true
}

/**
 * Extract ICC profile data from a PNG iCCP chunk.
 * Returns null if no iCCP chunk is found or on any parse error.
 * T-5-02-03: never throws.
 */
export function extractPngIcc(pngBytes: ArrayBuffer): Uint8Array | null {
  try {
    const view = new DataView(pngBytes)
    if (!hasPngSignature(view)) return null

    let offset = 8 // skip PNG signature
    while (offset + 12 <= view.byteLength) {
      const length = view.getUint32(offset, false) // big-endian
      const type = view.getUint32(offset + 4, false)
      const dataOffset = offset + 8
      const nextOffset = dataOffset + length + 4 // +4 for CRC

      if (type === ICCP_TYPE) {
        // iCCP data: null-terminated name + 1-byte compression method + compressed ICC data
        let nameEnd = dataOffset
        const maxNameEnd = Math.min(dataOffset + 80, dataOffset + length) // PNG spec: max 79 bytes
        while (nameEnd < maxNameEnd && view.getUint8(nameEnd) !== 0) {
          nameEnd++
        }
        // nameEnd points to the null byte; +1 for null, +1 for compression method
        const iccDataStart = nameEnd + 2
        if (iccDataStart > dataOffset + length) return null
        const iccLength = length - (iccDataStart - dataOffset)
        if (iccLength <= 0) return null
        return new Uint8Array(pngBytes, iccDataStart, iccLength)
      }

      if (type === IEND_TYPE) break
      if (nextOffset <= offset) break // sanity guard against infinite loop
      offset = nextOffset
    }
    return null
  } catch {
    // T-5-02-03: return null on any parse error — never propagate
    return null
  }
}

/**
 * Embed an ICC profile as an iCCP chunk into a PNG, inserted after IHDR.
 * Returns a new ArrayBuffer (does not mutate input).
 * The iCCP chunk uses 'ICC' as the profile name with compression method 0.
 */
export function embedPngIcc(pngBytes: ArrayBuffer, iccData: Uint8Array): ArrayBuffer {
  const view = new DataView(pngBytes)
  if (!hasPngSignature(view)) {
    // If not valid PNG, return unchanged
    return pngBytes.slice(0)
  }

  // Build the iCCP chunk
  // Profile name: 'ICC' + null byte + compression method byte (0 = deflate)
  const name = new TextEncoder().encode('ICC')
  const chunkDataLength = name.length + 1 + 1 + iccData.length
  // Chunk layout: [4-byte length][4-byte type][data][4-byte CRC]
  const chunkTotalSize = 4 + 4 + chunkDataLength + 4

  // Assemble iCCP chunk data (type bytes + data) for CRC computation
  const typeBytes = new Uint8Array([0x69, 0x43, 0x43, 0x50]) // 'iCCP'
  const iccpData = new Uint8Array(4 + chunkDataLength)
  iccpData.set(typeBytes, 0) // type for CRC
  iccpData.set(name, 4) // profile name
  iccpData[4 + name.length] = 0 // null terminator
  iccpData[4 + name.length + 1] = 0 // compression method = 0 (deflate)
  iccpData.set(iccData, 4 + name.length + 2) // compressed ICC data

  const chunkCrc = crc32(iccpData)

  // Find insertion point: after IHDR chunk (offset 8 + 4 + 4 + 13 + 4 = 33)
  // IHDR is always the first chunk, with exactly 13 bytes of data.
  let insertionOffset = 8 // after PNG signature
  const ihdrLength = view.getUint32(insertionOffset, false)
  insertionOffset += 8 + ihdrLength + 4 // skip IHDR: length + type + data + CRC

  // Allocate output: original + iCCP chunk
  const out = new Uint8Array(pngBytes.byteLength + chunkTotalSize)
  const outView = new DataView(out.buffer)

  // Copy everything up to insertion point
  out.set(new Uint8Array(pngBytes, 0, insertionOffset), 0)

  // Write iCCP chunk at insertion point
  let pos = insertionOffset
  outView.setUint32(pos, chunkDataLength, false) // length
  pos += 4
  out.set(typeBytes, pos) // type
  pos += 4
  out.set(name, pos) // profile name
  pos += name.length
  out[pos++] = 0 // null terminator
  out[pos++] = 0 // compression method
  out.set(iccData, pos) // ICC data
  pos += iccData.length
  outView.setUint32(pos, chunkCrc, false) // CRC
  pos += 4

  // Copy the rest of the original PNG
  out.set(new Uint8Array(pngBytes, insertionOffset), pos)

  return out.buffer
}

// ─────────────────────────────────────────────────────────────────────────────
// JPEG utilities
// ─────────────────────────────────────────────────────────────────────────────

const ICC_PROFILE_IDENTIFIER = 'ICC_PROFILE\0'
const ICC_PROFILE_IDENTIFIER_BYTES = new TextEncoder().encode(ICC_PROFILE_IDENTIFIER)

/**
 * Extract ICC profile data from a JPEG file (APP2 segments with ICC_PROFILE marker).
 * Reassembles multi-segment ICC data by sequence number.
 * Returns null if no ICC data found or on parse error.
 */
export function extractJpegIcc(jpegBytes: ArrayBuffer): Uint8Array | null {
  try {
    const view = new DataView(jpegBytes)
    if (view.byteLength < 4) return null
    // JPEG must start with SOI: 0xFF 0xD8
    if (view.getUint8(0) !== 0xff || view.getUint8(1) !== 0xd8) return null

    const segments: Map<number, Uint8Array> = new Map()
    let totalSegments = 0
    let offset = 2 // skip SOI

    while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break
      const marker = view.getUint8(offset + 1)
      if (marker === 0xd9) break // EOI

      // Markers with no length: SOI, EOI, RST0-RST7
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2
        continue
      }

      if (offset + 4 > view.byteLength) break
      const segLength = view.getUint16(offset + 2, false) // includes the 2 length bytes
      const dataOffset = offset + 4
      const dataLength = segLength - 2

      if (marker === 0xe2 && dataLength >= ICC_PROFILE_IDENTIFIER_BYTES.length + 2) {
        // Check for ICC_PROFILE\0 identifier
        let isIcc = true
        for (let i = 0; i < ICC_PROFILE_IDENTIFIER_BYTES.length; i++) {
          if (view.getUint8(dataOffset + i) !== ICC_PROFILE_IDENTIFIER_BYTES[i]) {
            isIcc = false
            break
          }
        }
        if (isIcc) {
          const seqNum = view.getUint8(dataOffset + ICC_PROFILE_IDENTIFIER_BYTES.length)
          totalSegments = view.getUint8(dataOffset + ICC_PROFILE_IDENTIFIER_BYTES.length + 1)
          const iccStart = dataOffset + ICC_PROFILE_IDENTIFIER_BYTES.length + 2
          const iccLen = dataLength - ICC_PROFILE_IDENTIFIER_BYTES.length - 2
          if (iccLen > 0) {
            segments.set(seqNum, new Uint8Array(jpegBytes, iccStart, iccLen))
          }
        }
      }

      offset += 2 + segLength
    }

    if (segments.size === 0) return null

    // Reassemble in sequence order
    let totalLen = 0
    for (let i = 1; i <= (totalSegments || segments.size); i++) {
      totalLen += segments.get(i)?.length ?? 0
    }
    const result = new Uint8Array(totalLen)
    let pos = 0
    for (let i = 1; i <= (totalSegments || segments.size); i++) {
      const seg = segments.get(i)
      if (seg) {
        result.set(seg, pos)
        pos += seg.length
      }
    }
    return result
  } catch {
    return null
  }
}

/**
 * Embed ICC profile data into a JPEG as APP2 segment(s) after SOI.
 * Splits into 65521-byte chunks if iccData exceeds one segment.
 * Returns a new ArrayBuffer (does not mutate input).
 */
export function embedJpegIcc(jpegBytes: ArrayBuffer, iccData: Uint8Array): ArrayBuffer {
  try {
    const view = new DataView(jpegBytes)
    if (view.byteLength < 2) return jpegBytes.slice(0)
    if (view.getUint8(0) !== 0xff || view.getUint8(1) !== 0xd8) return jpegBytes.slice(0)
  } catch {
    return jpegBytes.slice(0)
  }

  // Max ICC data per APP2 segment: 65535 - 2 (length) - 12 (identifier) - 2 (seq+total) = 65519
  const MAX_ICC_CHUNK = 65519
  const chunks: Uint8Array[] = []
  for (let i = 0; i < iccData.length; i += MAX_ICC_CHUNK) {
    chunks.push(iccData.subarray(i, i + MAX_ICC_CHUNK))
  }
  const totalSegments = chunks.length

  // Build APP2 segments
  // Layout: 0xFF 0xE2 [2-byte length including length bytes] [identifier] [seq] [total] [data]
  const segmentBuffers: Uint8Array[] = []
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!
    const segTotal = 2 + 2 + ICC_PROFILE_IDENTIFIER_BYTES.length + 2 + chunk.length
    const seg = new Uint8Array(segTotal)
    seg[0] = 0xff
    seg[1] = 0xe2
    const segLen = 2 + ICC_PROFILE_IDENTIFIER_BYTES.length + 2 + chunk.length // length field value
    seg[2] = (segLen >> 8) & 0xff
    seg[3] = segLen & 0xff
    seg.set(ICC_PROFILE_IDENTIFIER_BYTES, 4)
    seg[4 + ICC_PROFILE_IDENTIFIER_BYTES.length] = i + 1 // sequence number (1-indexed)
    seg[4 + ICC_PROFILE_IDENTIFIER_BYTES.length + 1] = totalSegments
    seg.set(chunk, 4 + ICC_PROFILE_IDENTIFIER_BYTES.length + 2)
    segmentBuffers.push(seg)
  }

  // Total size of all APP2 segments
  const segTotalBytes = segmentBuffers.reduce((s, b) => s + b.length, 0)

  // Output: SOI + all APP2 segments + rest of JPEG (everything after SOI)
  const out = new Uint8Array(jpegBytes.byteLength + segTotalBytes)
  out[0] = 0xff
  out[1] = 0xd8 // SOI
  let pos = 2
  for (const seg of segmentBuffers) {
    out.set(seg, pos)
    pos += seg.length
  }
  // Copy the rest of the JPEG (after SOI)
  out.set(new Uint8Array(jpegBytes, 2), pos)

  return out.buffer
}

// ─────────────────────────────────────────────────────────────────────────────
// D-14 WebP ICC — DEFERRED to Phase 8
// ─────────────────────────────────────────────────────────────────────────────
// D-14 DEFERRED: extractWebpIcc/embedWebpIcc not implemented in Phase 5.
// WebP RIFF container walk (ICCP chunk in VP8X) was estimated at ~120 LOC.
// The LOC gate (<=300 per format) would permit it, but the AVIF implementation
// was measured at >300 LOC for a correct BMFF box walk, and as a batch decision
// both WebP and AVIF ICC are deferred together to Phase 8 for a unified
// ICC completion pass that handles all four formats consistently.
// See .planning/phases/05-raster-encoders/05-02-SUMMARY.md for measurement.

// ─────────────────────────────────────────────────────────────────────────────
// D-14 AVIF ICC — DEFERRED to Phase 8
// ─────────────────────────────────────────────────────────────────────────────
// D-14 DEFERRED: extractAvifIcc/embedAvifIcc not implemented in Phase 5.
// AVIF BMFF box walk (moov→trak→mdia→minf→stbl→stsd→av01→colr with type='prof')
// was estimated at ~350+ LOC for a correct recursive BMFF implementation.
// This exceeds the 300-LOC gate specified in the plan. Deferred to Phase 8.
// See .planning/phases/05-raster-encoders/05-02-SUMMARY.md for measurement.
