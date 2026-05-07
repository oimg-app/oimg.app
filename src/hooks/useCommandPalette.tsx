import { useState } from 'react'
import { Icons } from '@/components/icons'
import { CODECS } from '@/data/defaults'
import type { CodecLabel } from '@/types'
import type { CmdGroup } from '@/components/shell/CommandPalette/CommandPalette'

export type View = 'Batch' | 'Compare' | 'Report'

interface Params {
  startOptimize: () => void
  cancelBatch: () => void
  running: boolean
  exportZip: () => void
  pushToast: (msg: string, meta?: string) => void
  theme: string
  toggleTheme: () => void
  setView: (v: View) => void
  setOpen: (v: string | null) => void
  setCodecFromMenu: (c: CodecLabel) => void
}

export function useCommandPalette({
  startOptimize,
  cancelBatch,
  running,
  exportZip,
  pushToast,
  theme,
  toggleTheme,
  setView,
  setCodecFromMenu,
}: Params) {
  const [cmdkOpen, setCmdkOpen] = useState<boolean>(false)

  const cmdGroups: CmdGroup[] = [
    { group: 'Actions', items: [
      { ic: <Icons.Upload size={13} />, label: 'Add files…', meta: 'A', do: () => pushToast('File picker opened') },
      { ic: <Icons.Play size={13} />, label: 'Optimize all', meta: 'Run worker pool · ⌘⏎', do: startOptimize },
      ...(running ? [{ ic: <Icons.X size={14} />, label: 'Cancel batch', meta: 'Stops in-flight workers · ⌘.', do: cancelBatch }] : []),
      { ic: <Icons.Download size={13} />, label: 'Export ZIP', meta: 'E', do: exportZip },
      { ic: <Icons.Zap size={13} />, label: 'Auto (Butteraugli 1.4)', meta: 'B', do: () => pushToast('Auto-optimizing…', 'butteraugli ≤ 1.4') },
    ]},
    { group: 'View', items: [
      { ic: <Icons.Grid size={13} />, label: 'Switch to Batch', do: () => setView('Batch') },
      { ic: <Icons.Layers size={13} />, label: 'Switch to Compare', do: () => setView('Compare') },
      { ic: <Icons.BarChart size={13} />, label: 'Switch to Report', do: () => setView('Report') },
      { ic: theme === 'dark' ? <Icons.Sun size={13} /> : <Icons.Moon size={13} />, label: 'Toggle ' + (theme === 'dark' ? 'light' : 'dark') + ' theme', do: toggleTheme },
    ]},
    { group: 'Codec', items: CODECS.filter((c) => c !== 'SVG').map((c) => ({
      ic: <Icons.Image size={13} />,
      label: 'Set output → ' + c + (c === 'JPEG' ? ' (mozjpeg)' : c === 'PNG' ? ' (oxipng)' : ''),
      do: () => setCodecFromMenu(c),
    }))},
  ]

  return { cmdkOpen, setCmdkOpen, cmdGroups }
}
