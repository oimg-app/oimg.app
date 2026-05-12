import { useState } from 'react'
import { toast } from 'sonner'
import { Icons } from '@/components/icons'
import { CODECS } from '@/data/defaults'
import type { CodecLabel } from '@/types'
import type { CmdGroup } from '@/components/shell/CommandPalette/CommandPalette'
import {useTheme} from "@/hooks/useTheme.ts";
import {useRuntimeStore, useSettingsStore} from "@/stores";

interface Params {
  startOptimize: () => void
  cancelBatch: () => void
  running: boolean
}

export function useCommandPalette({
  startOptimize,
  cancelBatch,
  running,
}: Params) {
  const [cmdkOpen, setCmdkOpen] = useState<boolean>(false)
  const { theme, setTheme } = useTheme()

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')
  const setCodecFromMenu = (c: CodecLabel) => {
    useSettingsStore.getState().setCodec({ label: c });
  }

  const exportZip = () => {
    useRuntimeStore.getState().export('zip')
  }

  const cmdGroups: CmdGroup[] = [
    { group: 'Actions', items: [
      { ic: <Icons.Upload size={13} />, label: 'Add files…', meta: 'A', do: () => toast.info('File picker opened') },
      { ic: <Icons.Play size={13} />, label: 'Optimize all', meta: 'Run worker pool · ⌘⏎', do: startOptimize },
      ...(running ? [{ ic: <Icons.X size={14} />, label: 'Cancel batch', meta: 'Stops in-flight workers · ⌘.', do: cancelBatch }] : []),
      { ic: <Icons.Download size={13} />, label: 'Export ZIP', meta: 'E', do: exportZip },
      // { ic: <Icons.Zap size={13} />, label: 'Auto (Butteraugli 1.4)', meta: 'B', do: () => pushToast('Auto-optimizing…', 'butteraugli ≤ 1.4') },
    ]},
    { group: 'View', items: [
      { ic: <Icons.Grid size={13} />, label: 'Switch to Batch', do: () => useSettingsStore.getState().setView('Batch') },
      { ic: <Icons.Layers size={13} />, label: 'Switch to Compare', do: () => useSettingsStore.getState().setView('Compare') },
      { ic: <Icons.BarChart size={13} />, label: 'Switch to Report', do: () => useSettingsStore.getState().setView('Report') },
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
