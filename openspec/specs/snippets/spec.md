# Snippets Spec

## Purpose
Give the developer paste-ready code from the optimized bytes. Three snippet families ship: a Base64 data-URI `<img>`, a URL-encoded CSS `background-image`, and a responsive `<picture>` block. All copies go through a single clipboard chokepoint so behavior is uniform across the Inspector, Toolbar bulk actions, and per-row context menus.

## Requirements

### Requirement: Output panel snippet sections
The system SHALL render on the Inspector's "Output" tab three snippet sections built from `$selectedFile`'s real encoded bytes: "Data URI · Base64" (`<img src="…">` shape), "Data URI · URL-encoded" (CSS `background-image` shape), and "Responsive `<picture>`".

#### Scenario: Snippets refresh on re-encode
- **WHEN** the user changes a setting and the selected file re-encodes
- **THEN** all three snippets update to reflect the new bytes (the `useEffect` dependency array includes `file?.encodedBuffer`)

#### Scenario: Snippets state through the lifecycle
- **WHEN** the selected file is `queued` / `processing` / `error`
- **THEN** the snippet sections render per-status placeholders (not stale prior content)

### Requirement: Base64 data-URI builder
The system SHALL build a Base64 data URI from encoded bytes via a chunked base64 encoder (so large buffers don't blow the call stack). The MIME type SHALL be derived from the entry's `encodedCodec`.

#### Scenario: Large WebP output
- **WHEN** a multi-megabyte entry encoded as WebP is turned into a Base64 data URI
- **THEN** the builder returns `data:image/webp;base64,…` without a stack overflow, and the payload decodes back to the exact encoded bytes

### Requirement: URL-encoded SVG builder
The system SHALL, for SVG output, produce a Yoksel-style URL-encoded data URI suitable for direct use in a CSS `background-image` value (percent-encoded, minimal escapes).

#### Scenario: SVG background-image snippet
- **WHEN** the selected file's output is SVG
- **THEN** the URL-encoded section shows a `data:image/svg+xml,…` URI with characters such as `<`, `>`, `#` and `"` percent-encoded, which renders when pasted into a CSS `background-image: url("…")`

### Requirement: Responsive `<picture>` shape
The system SHALL render the `<picture>` snippet as a single-source `<img>` wrapper with sensible defaults: escaped `alt` attribute, real width / height attributes from the entry, and the encoded image as the `src`.

#### Scenario: Picture snippet for a done entry
- **WHEN** the user views the Responsive `<picture>` section for a `done` 800×600 entry
- **THEN** the snippet contains an `<img>` whose `src` references the encoded output, with `width="800"`, `height="600"` and an escaped `alt` derived from the filename

### Requirement: Attribute escaping
The system SHALL escape any user-visible attribute (filename → `alt`, etc.) using a shared `escapeAttr` helper so a malicious filename cannot break out of the attribute in a copied snippet.

#### Scenario: Malicious filename
- **WHEN** a file named `x" onerror="alert(1).png` is turned into a snippet
- **THEN** the `"` characters are emitted as `&quot;` and the snippet contains no injected `onerror` attribute

### Requirement: Single clipboard chokepoint
The system SHALL route every clipboard write through a single `copyToClipboard` helper (`src/lib/clipboard.ts`) — the OutputPanel copy buttons, the Toolbar bulk-copy items (Copy `<picture>` / Copy data URIs / Manifest JSON), and the FileRow context-menu items (Copy `<picture>` / Copy data URI). No callsite MUST call `navigator.clipboard.writeText` directly.

#### Scenario: Copy from the Toolbar's "Copy `<picture>` HTML"
- **WHEN** the user activates the bulk Copy `<picture>` action
- **THEN** the chokepoint runs (with the batch of `<picture>` snippets joined) and a confirmation toast fires

### Requirement: FileRow context-menu snippet copies
The system SHALL expose "Copy `<picture>`" and "Copy data URI" siblings to "Save as…" in the per-row context menu, each routing through the chokepoint.

#### Scenario: Copy data URI from a row
- **WHEN** the user opens a `done` row's context menu and picks "Copy data URI"
- **THEN** the clipboard receives that entry's data URI via `copyToClipboard` and a confirmation toast fires

### Requirement: Bulk snippet actions
The system SHALL provide Toolbar bulk actions: Copy `<picture>` HTML (concatenated for all `done` entries), Copy as data URIs (concatenated), Manifest JSON (metadata for all `done` entries).

#### Scenario: Manifest JSON copy
- **WHEN** the user activates "Manifest JSON"
- **THEN** the clipboard receives a JSON array describing each `done` entry (name, output codec, byte size, dimensions, savings)

## Non-goals

- Multi-format `<picture>` fallback chain (`<source type=avif><source type=webp><img>`) — deferred to v1.3 snippet follow-ups.
- Snippet customization toggles: alt-text override, lazy-loading on/off, JSX vs HTML — deferred.
- Inline `<svg>` snippet (only data-URI SVG snippets ship) — deferred.
- Manifest JSON emitted as a file inside the ZIP export — clipboard only for now (deferred to v1.3).
- Framework-shaped snippets (Next.js `<Image>`, React `<Image>`, etc.).
