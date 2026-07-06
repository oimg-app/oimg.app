// Phase 15 — ING-01: clipboard dispatcher unit tests. Source: 15-02-PLAN.md
// G-15-01 / G-15-02 updates: Source: 15-05-PLAN.md (Task 5).
//
// Run with:
//   node --experimental-strip-types \
//        --import ./src/tests/_alias-loader.mjs \
//        src/tests/clipboard-ingest.test.ts
//
// Toast recording: sonner exports `toast` as a singleton object. We bootstrap
// minimal DOM/window globals (mirroring url-ingest.test.ts) so sonner can load
// without crashing, then monkey-patch toast.* methods to push into
// globalThis.__toastCalls. clipboard-ingest is dynamically imported AFTER the
// patch so its `import { toast } from 'sonner'` resolves to the patched object.
// pickFromUrl's network path is bypassed via setFetchStub on URL branches.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

// ---------- DOM bootstrap (mirrors url-ingest.test.ts) ----------
function defineGlobal(name: string, value: unknown): void {
  Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
}
const headStub = { appendChild() {} };
defineGlobal('window', globalThis);
defineGlobal('isSecureContext', true);
defineGlobal('navigator', { userAgent: 'node' });
defineGlobal('document', {
  createElement: (tag?: string) => {
    if (tag === 'style') return { textContent: '', setAttribute() {}, appendChild() {} };
    return { value: '', setAttribute() {}, style: {} as Record<string, string>, select() {} };
  },
  getElementsByTagName: (name: string) => (name === 'head' ? [headStub] : []),
  createTextNode: (data: string) => ({ data, nodeValue: data }),
  head: headStub,
  body: { appendChild() {}, removeChild() {} },
  execCommand: () => true,
});

// ---------- toast call recorder ----------
type ToastCall = { level: string; message: string };
const toastCalls: ToastCall[] = [];
(globalThis as unknown as { __toastCalls: ToastCall[] }).__toastCalls = toastCalls;
function resetToasts() {
  toastCalls.length = 0;
}

// ---------- patch sonner BEFORE loading clipboard-ingest ----------
const sonner = await import('sonner');
const makeRecorder = (level: string) => (m: unknown) => {
  toastCalls.push({ level, message: typeof m === 'string' ? m : String(m) });
};
Object.assign((sonner as unknown as { toast: Record<string, unknown> }).toast, {
  success: makeRecorder('success'),
  error: makeRecorder('error'),
  message: makeRecorder('message'),
  warning: makeRecorder('warning'),
  info: makeRecorder('info'),
});

// ---------- now dynamically import clipboard-ingest (uses the patched toast) ----------
const clipMod = await import('@/lib/clipboard-ingest');
const { isHttpUrl, pickFromClipboard, processClipboardEvent } = clipMod;
type ClipboardDispatcher = { ingest: (files: File[]) => Promise<void> };

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
  // Use defineProperty (matches url-ingest.test.ts) — Node 25 native fetch
  // is a non-writable global accessor; plain assignment silently no-ops.
  Object.defineProperty(globalThis, 'fetch', { value: stub, writable: true, configurable: true });
}
function restoreFetch() {
  Object.defineProperty(globalThis, 'fetch', { value: originalFetch, writable: true, configurable: true });
}
function imageResponse(bytes: Uint8Array, type = 'image/png'): Response {
  return new Response(bytes as unknown as BodyInit, {
    status: 200,
    headers: { 'content-type': type, 'content-length': String(bytes.length) },
  });
}

// ---------- navigator.clipboard fake builder ----------
interface AsyncClipFake {
  read?: () => Promise<ClipboardItem[]>;
  readText?: () => Promise<string>;
}
interface PermissionsFake {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query?: (descriptor: any) => Promise<{ state: PermissionState }>;
}
function setAsyncClipboard(fake: AsyncClipFake | undefined, perms?: PermissionsFake) {
  if (fake === undefined && perms === undefined) {
    delete (globalThis as { navigator?: unknown }).navigator;
    return;
  }
  (globalThis as { navigator: { clipboard?: AsyncClipFake; permissions?: PermissionsFake } }).navigator = {
    ...(fake !== undefined ? { clipboard: fake } : {}),
    ...(perms !== undefined ? { permissions: perms } : {}),
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
// isHttpUrl — G-15-01(b) two-tier gate (replaces the prior extension-only regex)
// ==========================================================================
test('isHttpUrl: accepts http(s) URLs regardless of extension', () => {
  // Without an image extension — the new gate's whole point.
  assert.equal(isHttpUrl('https://picsum.photos/200/300'), true);
  assert.equal(isHttpUrl('https://images.unsplash.com/photo-12345'), true);
  // With extension still works.
  assert.equal(isHttpUrl('https://example.com/cat.png'), true);
  assert.equal(isHttpUrl('https://example.com/cat.JPG'), true);
  assert.equal(isHttpUrl('https://cdn.example.com/cat.png?w=200&v=1'), true);
  // http:// also accepted.
  assert.equal(isHttpUrl('http://example.com/cat.png'), true);
});

test('isHttpUrl: rejects bare hosts (silent-on-unrelated-paste preserved)', () => {
  // CONTEXT D-12: bare hosts must stay silent — they are not http URLs in
  // the user's intent. `new URL(...)` throws on missing scheme.
  assert.equal(isHttpUrl('consent.cookiebot.com'), false);
  assert.equal(isHttpUrl('not-a-url'), false);
  assert.equal(isHttpUrl('hello world'), false);
  assert.equal(isHttpUrl(''), false);
});

test('isHttpUrl: rejects non-http schemes', () => {
  assert.equal(isHttpUrl('ftp://example.com/cat.png'), false);
  assert.equal(isHttpUrl('javascript:alert(1)'), false);
  assert.equal(isHttpUrl('data:image/png;base64,AAAA'), false);
  assert.equal(isHttpUrl('file:///tmp/cat.png'), false);
});

// ==========================================================================
// pickFromClipboard — permission probe (G-15-01)
// ==========================================================================
test('pickFromClipboard: permission denied → recovery toast + no clipboard read', async () => {
  resetToasts();
  let readCalled = false;
  setAsyncClipboard(
    {
      read: async () => {
        readCalled = true;
        return [];
      },
      readText: async () => '',
    },
    {
      query: async () => ({ state: 'denied' as PermissionState }),
    },
  );
  const dispatcher = makeDispatcher();

  await pickFromClipboard(dispatcher);

  assert.equal(readCalled, false, 'clip.read must NOT be called when permission is denied');
  assert.equal(dispatcher.calls.length, 0);
  assert.equal(toastCalls.length, 1);
  assert.equal(toastCalls[0].level, 'error');
  assert.match(toastCalls[0].message, /Clipboard read is blocked for this site/);
  assert.match(toastCalls[0].message, /address-bar lock icon/);
  assert.match(toastCalls[0].message, /Cmd\/Ctrl\+V/);
  restoreNavigator();
});

test('pickFromClipboard: permission query rejects (Safari) → falls through to read', async () => {
  resetToasts();
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  const blob = new Blob([png], { type: 'image/png' });
  setAsyncClipboard(
    {
      read: async () => [fakeClipboardItem('image/png', blob)],
      readText: async () => '',
    },
    {
      query: async () => {
        // Safari throws on unknown permission name.
        throw new TypeError("'clipboard-read' is not a valid permission name");
      },
    },
  );
  const dispatcher = makeDispatcher();

  await pickFromClipboard(dispatcher);

  // Falls through to the image-bytes branch.
  assert.equal(dispatcher.calls.length, 1);
  assert.equal(toastCalls.length, 1);
  assert.equal(toastCalls[0].level, 'success');
  assert.equal(toastCalls[0].message, 'Pasted image imported');
  restoreNavigator();
});

test('pickFromClipboard: permission granted → falls through to read', async () => {
  resetToasts();
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  const blob = new Blob([png], { type: 'image/png' });
  setAsyncClipboard(
    {
      read: async () => [fakeClipboardItem('image/png', blob)],
      readText: async () => '',
    },
    {
      query: async () => ({ state: 'granted' as PermissionState }),
    },
  );
  const dispatcher = makeDispatcher();

  await pickFromClipboard(dispatcher);

  assert.equal(dispatcher.calls.length, 1);
  assert.equal(toastCalls.length, 1);
  assert.equal(toastCalls[0].level, 'success');
  restoreNavigator();
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

  // G-15-02: void dispatcher.ingest — wait a microtask for the queued ingest.
  await new Promise((r) => setImmediate(r));

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

  // G-15-02: void dispatcher.ingest — wait a microtask for the queued ingest.
  await new Promise((r) => setImmediate(r));

  assert.equal(dispatcher.calls.length, 1, 'ingest should be called once');
  assert.equal(dispatcher.calls[0][0].type, 'image/png');
  assert.equal(toastCalls.length, 1);
  assert.equal(toastCalls[0].level, 'success');
  assert.match(toastCalls[0].message, /^Imported from URL: images\.example\.com$/);

  restoreFetch();
  restoreNavigator();
});

test('pickFromClipboard: text URL without image extension → still reaches pickFromUrl', async () => {
  // G-15-01(b): the broadened two-tier gate must allow URLs that don't end
  // in .png/.jpg through to pickFromUrl, which sniffs Content-Type.
  resetToasts();
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  setFetchStub(async () => imageResponse(png, 'image/png'));
  setAsyncClipboard({
    read: async () => [],
    readText: async () => 'https://picsum.photos/200/300',
  });
  const dispatcher = makeDispatcher();

  await pickFromClipboard(dispatcher);
  await new Promise((r) => setImmediate(r));

  assert.equal(dispatcher.calls.length, 1, 'extension-less URL must reach pickFromUrl');
  assert.equal(toastCalls.length, 1);
  assert.equal(toastCalls[0].level, 'success');
  assert.match(toastCalls[0].message, /^Imported from URL: picsum\.photos$/);

  restoreFetch();
  restoreNavigator();
});

test('pickFromClipboard: bare host (no scheme) → friendly "no image" message', async () => {
  // G-15-01(b): CONTEXT D-12 — bare hosts stay silent on Cmd+V, but on the
  // proactive Toolbar surface the catch-all toast at the end still fires.
  resetToasts();
  setAsyncClipboard({
    read: async () => [],
    readText: async () => 'consent.cookiebot.com',
  });
  const dispatcher = makeDispatcher();

  await pickFromClipboard(dispatcher);

  assert.equal(dispatcher.calls.length, 0);
  assert.equal(toastCalls.length, 1);
  assert.equal(toastCalls[0].level, 'message');
  assert.match(toastCalls[0].message, /no image or image URL/);
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
// G-15-02 — toast-before-ingest ordering regression
// ==========================================================================
test('pickFromClipboard: toast fires BEFORE dispatcher.ingest resolves (G-15-02)', async () => {
  // Regression: prior code awaited dispatcher.ingest() — which awaits the
  // full worker-pool optimize pipeline — BEFORE toasting. Users saw seconds
  // of silence. Stall the dispatcher with a never-resolving Promise and
  // assert the success toast still surfaces within 50ms of pickFromClipboard
  // being awaited.
  resetToasts();
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  const blob = new Blob([png], { type: 'image/png' });
  setAsyncClipboard({
    read: async () => [fakeClipboardItem('image/png', blob)],
    readText: async () => '',
  });
  // Dispatcher.ingest returns a never-resolving Promise — would deadlock the
  // old code's `await dispatcher.ingest(...); toast.success(...)` ordering.
  let ingestCalled = false;
  const stalled: ClipboardDispatcher = {
    ingest: () => {
      ingestCalled = true;
      return new Promise<void>(() => {}); // never resolves
    },
  };

  const start = Date.now();
  // Race pickFromClipboard against a 50ms timer — if the toast is gated on
  // the never-resolving ingest, pickFromClipboard itself stalls.
  await Promise.race([
    pickFromClipboard(stalled),
    new Promise((r) => setTimeout(r, 50)),
  ]);
  const elapsed = Date.now() - start;

  assert.ok(elapsed < 100, `pickFromClipboard should not block on stalled ingest (took ${elapsed}ms)`);
  assert.equal(ingestCalled, true, 'dispatcher.ingest was fire-and-forget invoked');
  assert.equal(toastCalls.length, 1, 'toast must fire even if ingest never resolves');
  assert.equal(toastCalls[0].level, 'success');
  assert.equal(toastCalls[0].message, 'Pasted image imported');
  restoreNavigator();
});

test('processClipboardEvent: toast fires BEFORE dispatcher.ingest resolves (G-15-02)', async () => {
  // Same regression on the synthetic-event surface.
  resetToasts();
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  const file = new File([png], 'screenshot.png', { type: 'image/png' });
  const ev = fakeClipboardEvent([fakeFileItem(file)]);
  let ingestCalled = false;
  const stalled: ClipboardDispatcher = {
    ingest: () => {
      ingestCalled = true;
      return new Promise<void>(() => {});
    },
  };

  const start = Date.now();
  const handled = await Promise.race([
    processClipboardEvent(ev, stalled),
    new Promise<boolean>((r) => setTimeout(() => r(false), 50)),
  ]);
  const elapsed = Date.now() - start;

  assert.ok(elapsed < 100, `processClipboardEvent should not block on stalled ingest (took ${elapsed}ms)`);
  assert.equal(handled, true);
  assert.equal(ingestCalled, true);
  assert.equal(toastCalls.length, 1, 'toast must fire even if ingest never resolves');
  assert.equal(toastCalls[0].level, 'success');
  assert.equal(toastCalls[0].message, 'Pasted image imported');
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
  await new Promise((r) => setImmediate(r));

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
  await new Promise((r) => setImmediate(r));

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
  await new Promise((r) => setImmediate(r));

  assert.equal(handled, true);
  assert.equal(dispatcher.calls.length, 1);
  assert.equal(toastCalls.length, 1);
  assert.equal(toastCalls[0].level, 'success');
  assert.match(toastCalls[0].message, /^Imported from URL: cdn\.example\.com$/);

  restoreFetch();
});

test('processClipboardEvent: URL without image extension → reaches pickFromUrl (G-15-01(b))', async () => {
  // The pre-fix regex rejected this silently; the broadened gate must let it
  // through to pickFromUrl, which sniffs Content-Type post-fetch.
  resetToasts();
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  setFetchStub(async () => imageResponse(png, 'image/png'));

  const ev = fakeClipboardEvent([
    fakeStringItem('https://picsum.photos/200/300', 'text/plain'),
  ]);
  const dispatcher = makeDispatcher();

  const handled = await processClipboardEvent(ev, dispatcher);
  await new Promise((r) => setImmediate(r));

  assert.equal(handled, true);
  assert.equal(dispatcher.calls.length, 1);
  assert.equal(toastCalls.length, 1);
  assert.equal(toastCalls[0].level, 'success');
  assert.match(toastCalls[0].message, /^Imported from URL: picsum\.photos$/);

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

test('processClipboardEvent: bare host (consent.cookiebot.com) → returns false silently', async () => {
  // G-15-01(b) / CONTEXT D-12: bare hosts are not URLs in user intent —
  // surfacing a "scheme-missing" toast would invert the silent-on-unrelated-paste
  // rule. The new URL() constructor throws → isHttpUrl returns false → silent.
  resetToasts();
  const ev = fakeClipboardEvent([fakeStringItem('consent.cookiebot.com', 'text/plain')]);
  const dispatcher = makeDispatcher();

  const handled = await processClipboardEvent(ev, dispatcher);

  assert.equal(handled, false);
  assert.equal(dispatcher.calls.length, 0);
  assert.equal(toastCalls.length, 0);
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
