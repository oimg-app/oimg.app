// Phase 15 — ING-01: shared clipboard dispatcher. Source: 15-02-PLAN.md
//
// Two entry points wrap the browser clipboard surface so a single dispatcher
// — held by useIngest — can resolve image bytes or image URLs into FileEntry
// records without leaking React/store concerns into the lib layer.
//
//   pickFromClipboard(d)      — proactive, uses Async Clipboard API
//                               (navigator.clipboard.read + readText). Triggered
//                               by Cmd+V command palette / button.
//   processClipboardEvent(e,d) — reactive, walks ClipboardEvent.clipboardData.items
//                                from a captured `paste` event listener.
//
// Decision tree per RESEARCH §1.2 / §5 and CONTEXT D-03, D-05:
//   1. Image bytes (Blob with image/* MIME) → File → dispatcher.ingest()
//   2. Else text → IMAGE_URL_RE → pickFromUrl → dispatcher.ingest()
//   3. Else: pickFromClipboard toasts a hint; processClipboardEvent silently
//      returns false (paste events are frequent; spurious toasts are noise).
//
// HTTPS/permission gating: navigator.clipboard.read may throw NotAllowedError
// or be undefined on non-secure contexts. We surface a single toast pointing
// users at the native paste-event path (Cmd/Ctrl+V) instead.

import { toast } from 'sonner';
import { pickFromUrl } from '@/lib/url-ingest';

/**
 * Trailing image extension check. Accepts optional querystring/hash.
 * Pinned per CONTEXT D-05 + RESEARCH §2.
 */
export const IMAGE_URL_RE = /\.(png|jpe?g|webp|avif|gif|svg|heic|heif)(\?.*)?$/i;

/**
 * Minimal sink interface that the dispatcher writes into. Decouples the lib
 * from React: useIngest constructs a dispatcher that calls back into its own
 * ingest() function (which already knows how to map File[] → FileEntry[]).
 */
export interface ClipboardDispatcher {
  ingest(files: File[]): Promise<void>;
}

/**
 * Async Clipboard API path. Triggered by an explicit user gesture (button
 * click or Cmd+V command). Reads image bytes first, falls back to text.
 *
 * Returns void; success/failure surfaces via toast.
 */
export async function pickFromClipboard(
  dispatcher: ClipboardDispatcher,
): Promise<void> {
  // Capability gate: secure context + Permissions API + clipboard surface.
  // If either read or readText is missing we cannot proceed — direct user to
  // the native paste-event seam, which works without the Async Clipboard API.
  const clip = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (!clip || typeof clip.read !== 'function' || typeof clip.readText !== 'function') {
    toast.error('Clipboard read needs HTTPS + permission — try Cmd/Ctrl+V instead.');
    return;
  }

  // 1) Image bytes branch — navigator.clipboard.read() returns ClipboardItem[].
  // Walk every item × every type; first image/* wins.
  try {
    const items = await clip.read();
    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type);
          const ext = type.split('/')[1] || 'png';
          const name = `pasted-${Date.now()}.${ext}`;
          const file = new File([blob], name, { type });
          // G-15-02: toast on accept; downstream optimize errors surface via setFileError.
          toast.success('Pasted image imported');
          void dispatcher.ingest([file]).catch(() => {});
          return;
        }
      }
    }
  } catch {
    // NotAllowedError / SecurityError / DOMException — fall through to text path.
    // We deliberately swallow: the readText() branch below is the natural retry.
  }

  // 2) Text branch — image URL match → reuse Wave 1 url-ingest.
  try {
    const text = await clip.readText();
    const trimmed = text.trim();
    if (trimmed && IMAGE_URL_RE.test(trimmed)) {
      const file = await pickFromUrl(trimmed);
      if (file) {
        let host = '';
        try { host = new URL(trimmed).host } catch {}
        // G-15-02: toast on accept; downstream optimize errors surface via setFileError.
        toast.success(host ? `Imported from URL: ${host}` : 'Imported from URL');
        void dispatcher.ingest([file]).catch(() => {});
        return;
      }
      // pickFromUrl returned null and already toasted the reason; no double-toast.
      return;
    }
  } catch {
    // readText() can throw NotAllowedError too — treat as "nothing usable".
  }

  // 3) No image bytes, no URL. Inform the user without sounding like an error.
  toast.message('Clipboard has no image or image URL');
}

/**
 * Paste-event path. Called from a captured `paste` listener; walks
 * `event.clipboardData.items` synchronously.
 *
 * Returns true if SOMETHING was ingested (image file OR URL match); the
 * caller should call e.preventDefault() in that case. Returns false when
 * the paste was unrelated (text, other content) — caller MUST NOT toast
 * or preventDefault, since paste events fire frequently in form inputs.
 */
export async function processClipboardEvent(
  event: ClipboardEvent,
  dispatcher: ClipboardDispatcher,
): Promise<boolean> {
  const data = event.clipboardData;
  if (!data) return false;

  const items = Array.from(data.items);

  // 1) Image file branch — DataTransferItem.kind === 'file' with image/* type.
  // Collect ALL image files in a single paste (some browsers attach multiples).
  const imageFiles: File[] = [];
  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) imageFiles.push(file);
    }
  }
  if (imageFiles.length > 0) {
    // G-15-02: toast on accept; downstream optimize errors surface via setFileError.
    toast.success(
      imageFiles.length === 1
        ? 'Pasted image imported'
        : `Pasted ${imageFiles.length} images`,
    );
    void dispatcher.ingest(imageFiles).catch(() => {});
    return true;
  }

  // 2) URL branch — first text/plain or text/uri-list item wins (RESEARCH P-11).
  // getAsString is callback-based; promisify, but only call once per item.
  for (const item of items) {
    if (item.kind === 'string' && (item.type === 'text/plain' || item.type === 'text/uri-list')) {
      const text = await new Promise<string>((resolve) => {
        item.getAsString(resolve);
      });
      const trimmed = text.trim();
      if (trimmed && IMAGE_URL_RE.test(trimmed)) {
        const file = await pickFromUrl(trimmed);
        if (file) {
          let host = '';
          try { host = new URL(trimmed).host } catch {}
          // G-15-02: toast on accept; downstream optimize errors surface via setFileError.
          toast.success(host ? `Imported from URL: ${host}` : 'Imported from URL');
          void dispatcher.ingest([file]).catch(() => {});
          return true;
        }
        // pickFromUrl returned null and already toasted; signal "handled" so the
        // caller still preventDefaults the paste (user clearly meant a URL).
        return true;
      }
      // First text/plain wins per RESEARCH P-11 — do not keep scanning.
      break;
    }
  }

  return false;
}
