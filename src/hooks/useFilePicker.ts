import { useRef } from 'react'
import type { DragEvent, RefObject } from 'react'
import { toast } from 'sonner'
import type { FormatId } from '@/types'
import { addSourceWithVariants } from '@/stores'

// Private helper — detect format from MIME then extension.
// Verbatim from App.tsx lines 177–186 (Plan 04-07 origin).
function formatFromFile(f: File): FormatId | null {
  const mime = (f.type || '').toLowerCase()
  const ext = (f.name.toLowerCase().split('.').pop() ?? '')
  if (mime === 'image/png' || ext === 'png') return 'png'
  if (mime === 'image/svg+xml' || ext === 'svg') return 'svg'
  if (mime === 'image/jpeg' || ext === 'jpg' || ext === 'jpeg') return 'jpeg'
  if (mime === 'image/webp' || ext === 'webp') return 'webp'
  if (mime === 'image/avif' || ext === 'avif') return 'avif'
  return null
}

// Private helper — ingest FileList / File[] into the files store.
// Verbatim from App.tsx lines 188–215 (Plan 04-07 origin).
async function ingestDroppedFiles(files: FileList | File[]): Promise<void> {
  const list = Array.from(files)
  let skipped = 0
  const skippedNames: string[] = []
  for (const f of list) {
    const format = formatFromFile(f)
    if (!format) {
      skipped++
      if (skippedNames.length < 3) skippedNames.push(f.name)
      continue
    }
    await addSourceWithVariants({
      sourceBlob: f,
      sourceDensity: '1x',
      name: f.name,
      format,
      // v0.4 — D-01/D-02 SCOPED: targets locked to source density at drop
      // time. Phase 5 will surface the target-density chooser pre-drop.
      targets: ['1x'],
    })
  }
  if (skipped > 0) {
    const tail = skippedNames.length < skipped ? '…' : ''
    toast.info(
      `${skipped} unsupported file${skipped === 1 ? '' : 's'} skipped (${skippedNames.join(', ')}${tail})`,
    )
  }
}

export interface UseFilePickerReturn {
  fileInputRef: RefObject<HTMLInputElement | null>
  handleFilePick: () => void
  handleDrop: (e: DragEvent) => void
  handleDragOver: (e: DragEvent) => void
  handleDragLeave: (e: DragEvent) => void
  handleFileInputChange: (files: FileList) => void
}

export function useFilePicker(): UseFilePickerReturn {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleFilePick = () => {
    fileInputRef.current?.click()
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
      void ingestDroppedFiles(files)
    }
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleFileInputChange = (files: FileList) => {
    if (files.length > 0) void ingestDroppedFiles(files)
  }

  return { fileInputRef, handleFilePick, handleDrop, handleDragOver, handleDragLeave, handleFileInputChange }
}
