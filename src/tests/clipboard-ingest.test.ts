// Phase 15 — ING-01: clipboard dispatcher unit tests. Source: 15-02-PLAN.md
//
// Run with:
//   node --experimental-strip-types \
//        --import ./src/tests/_alias-loader.mjs \
//        src/tests/clipboard-ingest.test.ts
//
// The alias loader maps `sonner` → src/tests/stubs/sonner.mjs which records
// every toast.* call into globalThis.__toastCalls. We snapshot/reset that
// array per test. pickFromUrl is left as-is (Wave 1 module), but its network
// path is bypassed by stubbing globalThis.fetch via setFetchStub before
// running URL branches.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  IMAGE_URL_RE,
  pickFromClipboard,
  processClipboardEvent,
  type ClipboardDispatcher,
} from '@/lib/clipboard-ingest';

// ---------- toast call recorder (from stubs/sonner.mjs) ----------
type ToastCall = { level: string; message: string };
const toastCalls: ToastCall[] = (globalThis as unknown as { __toastCalls: ToastCall[] })
  .__toastCalls;
function resetToasts() {
  toastCalls.length = 0;
}

// ---------- spy dispatcher ----------
function makeDispatcher(): ClipboardDispatcher & { calls: File[][] } {
  const calls: File[][] = [];
  return {
    calls,
    async ingest(files: File[]) {
      calls.push(files);
    },
  };
}

// ---------- fetch stub for URL branch (mirrors url-ingest.test.ts) ----------
type FetchStub = (input: RequestInfo | URL) => Promise<Response>;
const originalFetch = globalThis.fetch;
function setFetchStub(stub: FetchStub) {
  (globalThis as { fetch: FetchStub }).fetch = stub;
}
function restoreFetch() {
  (globalThis as { fetch: typeof originalFetch }).fetch = originalFetch;
}
function imageResponse(bytes: Uint8Array, type = 'image/png'): Response {
  return new Response(bytes, {
    status: 200,
    headers: { 'content-type': type, 'content-length': String(bytes.length) },
  });
}

// ---------- navigator.clipboard fake builder ----------
interface AsyncClipFake {
  read?: () => Promise<ClipboardItem[]>;
  readText?: () => Promise<string>;
}
function setAsyncClipboard(fake: AsyncClipFake | undefined) {
  if (fake === undefined) {
    delete (globalThis as { navigator?: unknown }).navigator;
    return;
  }
  (globalThis as { navigator: { clipboard: AsyncClipFake } }).navigator = {
    clipboard: fake,
  };
}
function restoreNavigator() {
  delete (globalThis as { navigator?: unknown }).navigator;
}

// Build a fake ClipboardItem for navigator.clipboard.read()
function fakeClipboardItem(type: string, blob: Blob): ClipboardItem {
  return {
    types: [type],
    async getType(t: string) {
      if (t === type) return blob;
      throw new Error(`unknown type ${t}`);
    },
    presentationStyle: 'unspecified',
  } as unknown as ClipboardItem;
}

// Build a fake DataTransferItem for ClipboardEvent
function fakeStringItem(text: string, type = 'text/plain') {
  return {
    kind: 'string' as const,
    type,
    getAsString(cb: (s: string) => void) {
      cb(text);
    },
    getAsFile() {
      return null;
    },
  };
}
function fakeFileItem(file: File) {
  return {
    kind: 'file' as const,
    type: file.type,
    getAsString(_cb: (s: string) => void) {
      /* noop */
    },
    getAsFile() {
      return file;
    },
  };
}
function fakeClipboardEvent(items: ReadonlyArray<unknown>): ClipboardEvent {
  return {
    clipboardData: {
      items: items as unknown as DataTransferItemList,
    },
  } as unknown as ClipboardEvent;
}

// ==========================================================================
// IMAGE_URL_RE
// ==========================================================================
test('IMAGE_URL_RE: matches common image extensions', () => {
  assert.ok(IMAGE_URL_RE.test('https://example.com/cat.png'));
  assert.ok(IMAGE_URL_RE.test('https://example.com/cat.JPG'));
  assert.ok(IMAGE_URL_RE.test('https://example.com/cat.jpeg'));
  assert.ok(IMAGE_URL_RE.test('https://example.com/cat.webp'));
  assert.ok(IMAGE_URL_RE.test('https://example.com/cat.avif'));
  assert.ok(IMAGE_URL_RE.test('https://example.com/cat.svg'));
  assert.ok(IMAGE_URL_RE.test('https://example.com/cat.heic'));
  assert.ok(IMAGE_URL_RE.test('https://example.com/cat.heif'));
});

test('IMAGE_URL_RE: tolerates querystring', () => {
  assert.ok(IMAGE_URL_RE.test('https://cdn.example.com/cat.png?w=200&v=1'));
});

test('IMAGE_URL_RE: rejects non-image URLs', () => {
  assert.equal(IMAGE_URL_RE.test('https://example.com/index.html'), false);
  assert.equal(IMAGE_URL_RE.test('https://example.com/'), false);
  assert.equal(IMAGE_URL_RE.test('not a url'), false);
});

// ==========================================================================
// pickFromClipboard — capability gate
// ==========================================================================
test('pickFromClipboard: no clipboard surface → HTTPS hint toast', async () => {
  resetToasts();
  setAsyncClipboard(undefined);
  const dispatcher = makeDispatcher();

  await pickFromClipboard(dispatcher);

  assert.equal(dispatcher.calls.length, 0);
  assert.equal(toastCalls.length, 1);
  assert.equal(toastCalls[0].level, 'error');
  assert.match(toastCalls[0].message, /HTTPS \+ permission.*Cmd\/Ctrl\+V/);
  restoreNavigator();
});

test('pickFromClipboard: missing readText → HTTPS hint toast', async () => {
  resetToasts();
  setAsyncClipboard({ read: async () => [] });
  const dispatcher = makeDispatcher();

  await pickFromClipboard(dispatcher);

  assert.equal(dispatcher.calls.length, 0);
  assert.equal(toastCalls.length, 1);
  assert.equal(toastCalls[0].level, 'error');
  restoreNavigator();
});

// ==========================================================================
// pickFromClipboard — image bytes branch
// ==========================================================================
test('pickFromClipboard: image bytes from clipboard.read() → ingest + success', async () => {
  resetToasts();
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  const blob = new Blob([png], { type: 'image/png' });
  setAsyncClipboard({
    read: async () => [fakeClipboardItem('image/png', blob)],
    readText: async () => '',
  });
  const dispatcher = makeDispatcher();

  await pickFromClipboard(dispatcher);

  assert.equal(dispatcher.calls.length, 1);
  assert.equal(dispatcher.calls[0].length, 1);
  assert.equal(dispatcher.calls[0][0].type, 'image/png');
  assert.match(dispatcher.calls[0][0].name, /^pasted-\d+\.png$/);
  assert.equal(toastCalls.length, 1);
  assert.equal(toastCalls[0].level, 'success');
  assert.equal(toastCalls[0].message, 'Pasted image imported');
  restoreNavigator();
});

test('pickFromClipboard: read() throws → falls through to text branch', async () => {
  resetToasts();
  setAsyncClipboard({
    read: async () => {
      throw new DOMException('not allowed', 'NotAllowedError');
    },
    readText: async () => '', // empty → "no image or url"
  });
  const dispatcher = makeDispatcher();

  await pickFromClipboard(dispatcher);

  assert.equal(dispatcher.calls.length, 0);
  assert.equal(toastCalls.length, 1);
  assert.equal(toastCalls[0].level, 'message');
  assert.match(toastCalls[0].message, /no image or image URL/);
  restoreNavigator();
});

// ==========================================================================
// pickFromClipboard — text/URL branch
// ==========================================================================
test('pickFromClipboard: text URL → pickFromUrl → ingest + success toast', async () => {
  resetToasts();
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
  setFetchStub(async () => imageResponse(png, 'image/png'));
  setAsyncClipboard({
    read: async () => [],
    readText: async () => 'https://images.example.com/cat.png',
  });
  const dispatcher = makeDispatcher();

  await pickFromClipboard(dispatcher);

  assert.equal(dispatcher.calls.length, 1, 'ingest should be called once');
  assert.equal(dispatcher.calls[0][0].type, 'image/png');
  assert.equal(toastCalls.length, 1);
  assert.equal(toastCalls[0].level, 'success');
  assert.match(toastCalls[0].message, /^Imported from URL: images\.example\.com$/);

  restoreFetch();
  restoreNavigator();
});

test('pickFromClipboard: text without URL → friendly "no image" message', async () => {
  resetToasts();
  setAsyncClipboard({
    read: async () => [],
    readText: async () => 'just some plain text',
  });
  const dispatcher = makeDispatcher();

  await pickFromClipboard(dispatcher);

  assert.equal(dispatcher.calls.length, 0);
  assert.equal(toastCalls.length, 1);
  assert.equal(toastCalls[0].level, 'message');
  assert.match(toastCalls[0].message, /no image or image URL/);
  restoreNavigator();
});

// ==========================================================================
// processClipboardEvent — file branch
// ==========================================================================
test('processClipboardEvent: single image file → ingest + true', async () => {
  resetToasts();
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  const file = new File([png], 'screenshot.png', { type: 'image/png' });
  const ev = fakeClipboardEvent([fakeFileItem(file)]);
  const dispatcher = makeDispatcher();

  const handled = await processClipboardEvent(ev, dispatcher);

  assert.equal(handled, true);
  assert.equal(dispatcher.calls.length, 1);
  assert.equal(dispatcher.calls[0][0], file);
  assert.equal(toastCalls.length, 1);
  assert.equal(toastCalls[0].level, 'success');
  assert.equal(toastCalls[0].message, 'Pasted image imported');
});

test('processClipboardEvent: multiple image files → plural toast', async () => {
  resetToasts();
  const a = new File([new Uint8Array([1])], 'a.png', { type: 'image/png' });
  const b = new File([new Uint8Array([2])], 'b.jpg', { type: 'image/jpeg' });
  const ev = fakeClipboardEvent([fakeFileItem(a), fakeFileItem(b)]);
  const dispatcher = makeDispatcher();

  const handled = await processClipboardEvent(ev, dispatcher);

  assert.equal(handled, true);
  assert.equal(dispatcher.calls.length, 1);
  assert.equal(dispatcher.calls[0].length, 2);
  assert.equal(toastCalls.length, 1);
  assert.equal(toastCalls[0].message, 'Pasted 2 images');
});

// ==========================================================================
// processClipboardEvent — URL branch
// ==========================================================================
test('processClipboardEvent: text/plain with image URL → ingest + true', async () => {
  resetToasts();
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  setFetchStub(async () => imageResponse(png, 'image/png'));

  const ev = fakeClipboardEvent([
    fakeStringItem('https://cdn.example.com/photo.png', 'text/plain'),
  ]);
  const dispatcher = makeDispatcher();

  const handled = await processClipboardEvent(ev, dispatcher);

  assert.equal(handled, true);
  assert.equal(dispatcher.calls.length, 1);
  assert.equal(toastCalls.length, 1);
  assert.equal(toastCalls[0].level, 'success');
  assert.match(toastCalls[0].message, /^Imported from URL: cdn\.example\.com$/);

  restoreFetch();
});

// ==========================================================================
// processClipboardEvent — silent miss
// ==========================================================================
test('processClipboardEvent: plain text without URL → returns false silently', async () => {
  resetToasts();
  const ev = fakeClipboardEvent([fakeStringItem('hello world', 'text/plain')]);
  const dispatcher = makeDispatcher();

  const handled = await processClipboardEvent(ev, dispatcher);

  assert.equal(handled, false);
  assert.equal(dispatcher.calls.length, 0);
  assert.equal(toastCalls.length, 0, 'must not toast on unrelated paste');
});

test('processClipboardEvent: empty event → returns false silently', async () => {
  resetToasts();
  const ev = fakeClipboardEvent([]);
  const dispatcher = makeDispatcher();

  const handled = await processClipboardEvent(ev, dispatcher);

  assert.equal(handled, false);
  assert.equal(dispatcher.calls.length, 0);
  assert.equal(toastCalls.length, 0);
});

test('processClipboardEvent: missing clipboardData → false silently', async () => {
  resetToasts();
  const ev = { clipboardData: null } as unknown as ClipboardEvent;
  const dispatcher = makeDispatcher();

  const handled = await processClipboardEvent(ev, dispatcher);

  assert.equal(handled, false);
  assert.equal(dispatcher.calls.length, 0);
  assert.equal(toastCalls.length, 0);
});

// ==========================================================================
// processClipboardEvent — first text/plain wins (P-11)
// ==========================================================================
test('processClipboardEvent: only first text/plain is inspected', async () => {
  resetToasts();
  const ev = fakeClipboardEvent([
    fakeStringItem('not a url', 'text/plain'),
    // Should NOT be considered — first text/plain already lost.
    fakeStringItem('https://cdn.example.com/cat.png', 'text/plain'),
  ]);
  const dispatcher = makeDispatcher();

  const handled = await processClipboardEvent(ev, dispatcher);

  assert.equal(handled, false);
  assert.equal(dispatcher.calls.length, 0);
  assert.equal(toastCalls.length, 0);
});
