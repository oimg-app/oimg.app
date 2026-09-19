# Ingest Spec

## Purpose
Get user-supplied images into the app queue as `FileEntry` records. Ingest is the entry gate of the pipeline: no bytes reach the codec worker without going through here. All ingest paths (drop, folder, picker, watch, paste, URL, HEIC decode) funnel through the same `useIngest.ingest` dispatcher so downstream code sees one shape.

## Requirements

### Requirement: File drop from the OS
The system SHALL accept image files dragged onto the app window and add them to the queue.

#### Scenario: User drops one or more files onto the dropzone
- **WHEN** the user drags one or more image files onto the visible dropzone in `FilesPane`
- **THEN** each supported file is added to `filesAtom.entries` with `status: 'queued'`, its format badge, byte size, and a stable id

#### Scenario: User drops a file onto the app outside the dropzone
- **WHEN** the user drops files anywhere on the app window
- **THEN** the same dispatcher runs (the app root also accepts drops, not only the dropzone element)

### Requirement: Folder drop and directory picker
The system SHALL accept a folder — via drag-drop of a directory or via `showDirectoryPicker` — and recursively add every supported image file it contains as separate queue entries.

#### Scenario: User drops a folder
- **WHEN** the user drops a folder containing mixed files (images + non-images)
- **THEN** every supported image is queued and non-images are silently skipped

### Requirement: File picker via toolbar
The system SHALL open the OS file picker when the user clicks the toolbar "Add files" affordance and queue the chosen files.

#### Scenario: User picks files from device
- **WHEN** the user activates Toolbar "From device"
- **THEN** the browser file picker opens accepting the supported image MIME set

### Requirement: Watch folder (minimum-viable)
The system SHALL let the user pick a folder to watch and auto-ingest new/changed image files that appear in it while the watch is active. The implementation is minimum-viable: only the picker + one live watch are shipped; stop-watching UI, IDB handle persistence across reloads, recursive traversal beyond the picked directory, and multi-folder watching are deferred.

#### Scenario: Chromium browser with FileSystemObserver
- **WHEN** the user activates Toolbar "Watch folder" in Chrome/Edge and grants read access
- **THEN** the app subscribes via `FileSystemObserver` and each new image dropped into the folder is auto-ingested through the same dispatcher

#### Scenario: Firefox or Safari (no FileSystemObserver)
- **WHEN** the user activates "Watch folder" in a browser lacking `FileSystemObserver`
- **THEN** the app snapshots the current folder contents into the queue and surfaces a toast explaining that live watching is unavailable in this browser

### Requirement: Paste from clipboard
The system SHALL accept image bytes and image URLs pasted from the clipboard through two entry points: the Toolbar "From URL or paste" action, and a document-level `Cmd/Ctrl+V` handler on the app root.

#### Scenario: Clipboard contains image bytes
- **WHEN** the user pastes and the clipboard exposes an image blob (via `navigator.clipboard.read()` or the paste event's `clipboardData.items`)
- **THEN** the image is ingested and a toast confirms "Pasted from clipboard: {name}"

#### Scenario: Clipboard contains an image URL as plain text
- **WHEN** the user pastes plain text that parses as an image URL
- **THEN** the app fetches the URL, verifies the response is an image via `Content-Type`, ingests it, and toasts "Imported from URL: {host}"

#### Scenario: Clipboard has neither
- **WHEN** the clipboard has no image and no image URL
- **THEN** a toast surfaces "Clipboard has no image or image URL" and the queue is unchanged

### Requirement: URL fetch failure surfacing
The system SHALL translate URL-fetch failures into clear, action-oriented toasts and MUST NOT proxy the request through any server.

#### Scenario: Cross-origin fetch is blocked
- **WHEN** the pasted URL rejects with a `TypeError` (opaque CORS failure)
- **THEN** the toast reads "URL blocked by CORS — download and drop the file, or paste it directly"

#### Scenario: Server returns a non-OK status
- **WHEN** the fetch succeeds but `res.ok === false`
- **THEN** the toast surfaces the HTTP status (e.g. "URL returned 403")

#### Scenario: URL points to a non-image resource
- **WHEN** the response `Content-Type` is not an image MIME
- **THEN** the toast reads "Not an image" and no queue entry is created

### Requirement: Data-URI ingest
The system SHALL accept `data:image/*;base64,...` and `data:image/svg+xml,...` URIs pasted as text and treat them as image bytes.

#### Scenario: User pastes a data URI
- **WHEN** the pasted text starts with `data:image/`
- **THEN** the app decodes the payload and ingests it without a network fetch

### Requirement: Supported-format gate
The system SHALL accept SVG, PNG, JPEG, WebP, AVIF, and HEIC/HEIF; other file types SHALL be rejected before entering the queue with a toast naming the unsupported format.

#### Scenario: User drops an unsupported file
- **WHEN** the user drops a PDF, MP4, or other unsupported type
- **THEN** it is not added to `filesAtom.entries` and a toast names the rejected file and its type

### Requirement: HEIC decode to a raster ImageData
The system SHALL decode `.heic` / `.heif` files to `ImageData` at ingest time using `heic-decode` / `libheif-js`, so downstream encoders can process them like any other raster source.

#### Scenario: User drops a HEIC photo
- **WHEN** the user drops an iPhone `.heic` file
- **THEN** the file is decoded on the main thread, an `ImageData` payload is buffered on the entry, and the entry is queued as a normal raster source (available to export to JPEG/WebP/AVIF/PNG)

### Requirement: Single dispatcher
The system SHALL route every ingest path (drop, folder, picker, watch, paste, URL, data-URI, HEIC) through a single `useIngest.ingest` dispatcher that produces `FileEntry` records with a uniform shape, so `useOptimize` and the inspector see one contract.

## Non-goals

- Persistent watch folders across page reload (deferred to v1.3: IDB handle persistence).
- Stop-watching UI (deferred — restart the app to release a watch).
- Recursive folder watch beyond the picked directory (deferred).
- Multi-folder watch (only one watched folder at a time).
- Server-side URL proxying to defeat CORS (excluded by the zero-server constraint).
- Drag-from-tab HTML-fragment ingest (stretch, deferred).
- HEIC encode (only decode ships; users export HEIC sources to JPEG/WebP/AVIF/PNG).
- Web Share Target API ("Share to oimg.app" from OS share sheets — deferred to v1.3, PWA-NEXT).
