// TitleBar — top 36px chrome bar.
// Extracted from src/App.tsx (lines 216–333) in plan 01-04.
// Quick task 260430-s6i: menus rewritten on shadcn Menubar (Base UI) while
// keeping OIMG visual classes (.titlebar, .menu, .popover, .pi, .div, .lbl,
// .kbd, .check, .on). Owns: brand mark, primary nav menus (Codec / View /
// Help), right pill cluster (privacy/offline pills, version, ⌘K Search).
// Quick task 260505-0hr — Task 4: classes migrated to titleBar.module.css.
// Visual contract preserved: `.kbd`, `.pill`, `.tbtn`, `.popover`, `.pi`, `.div`,
// `.lbl`, `.check`, `.on`, `.mono`, `.mark` remain global tokens consumed by
// child surfaces (Menubar / Tooltip popovers, .pill primitives) until their
// own module migrations land. role="banner" still asserted by shell.spec.ts.

import { Icons } from '@/components/icons'
import { useState } from 'react'
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
} from '@/components/ui/menubar'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/utils'
import type { CodecLabel } from '@/types'
import {APP_VERSION, CODECS} from '@/data/defaults'
import s from './titleBar.module.css'
import { useStore } from '@nanostores/react'
import { settingsStore, setCodec, setView, setCommandPaletteOpen } from '@/stores/settings'
import {useTheme} from "@/hooks/useTheme.ts";

const MENU_KEYS = {
  codec: 'menu-codec',
  view: 'menu-view',
  help: 'menu-help',
} as const

// Nullify shadcn Menubar's Tailwind wrapper defaults so .titlebar .menu paints
// the layout. Trigger/content visuals are owned by .titlebar .menu button and
// .popover (in src/index.css), which sit outside @layer utilities and beat
// shadcn's @layer utilities in the cascade.
const MENUBAR_RESET = 'h-auto rounded-none border-0 p-0 gap-[2px]'

const FileMenu = () => {
  const [openKey, onOpenKey] = useState<string | null>(null)
  const isOpen = (key: string) => openKey === key
  const { theme, setTheme } = useTheme()

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  const bindMenu = (key: string) => ({
    open: isOpen(key),
    onOpenChange: (open: boolean) => onOpenKey(open ? key : null),
  })

  const { codec: codecSlice, views, view } = useStore(settingsStore)
  const codec = codecSlice.label

  const onSelectCodec = (c: CodecLabel) => {
    setCodec({ label: c })
  }

  return (
      <Menubar aria-label="Primary" className={cn(s.menu, MENUBAR_RESET)}>
        <MenubarMenu {...bindMenu(MENU_KEYS.codec)}>
          <MenubarTrigger className={cn(isOpen(MENU_KEYS.codec) && 'on')}>Codec</MenubarTrigger>
          <MenubarContent className="popover" style={{ minWidth: 220 }}>
            <div className="lbl">Output format</div>
            {CODECS.map((c) => (
                <MenubarItem
                    key={c}
                    className={cn('pi check', codec === c && 'on')}
                    onClick={() => onSelectCodec(c)}
                >
                  <span className="mono">{c}</span>
                  <span className={s.kbd}>{c[0]}</span>
                </MenubarItem>
            ))}
            <MenubarSeparator className="div" />
            {/*<MenubarItem*/}
            {/*    className="pi"*/}
            {/*    onClick={() => onToast('Auto-optimizing…', 'butteraugli ≤ 1.4')}*/}
            {/*>*/}
            {/*  <Icons.Zap size={13} />*/}
            {/*  <span>Auto (Butteraugli)</span>*/}
            {/*  <span className={s.kbd}>⌘B</span>*/}
            {/*</MenubarItem>*/}
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu {...bindMenu(MENU_KEYS.view)}>
          <MenubarTrigger className={cn(isOpen(MENU_KEYS.view) && 'on')}>View</MenubarTrigger>
          <MenubarContent className="popover">
            {views.map((v, i) => (
                <MenubarItem
                    key={v}
                    className={cn('pi check', view === v && 'on')}
                    onClick={() => setView(v)}
                >
                  {v === 'Batch' && <Icons.Grid size={13} />}
                  {v === 'Compare' && <Icons.Layers size={13} />}
                  {v === 'Report' && <Icons.BarChart size={13} />}
                  <span>{v}</span>
                  <span className={s.kbd}>⌘{i + 1}</span>
                </MenubarItem>
            ))}
            <MenubarSeparator className="div" />
            <MenubarItem className="pi" onClick={toggleTheme}>
              {theme === 'dark' ? <Icons.Sun size={13} /> : <Icons.Moon size={13} />}
              <span>Toggle theme</span>
              <span className={s.kbd}>⌘⇧L</span>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu {...bindMenu(MENU_KEYS.help)}>
          <MenubarTrigger className={cn(isOpen(MENU_KEYS.help) && 'on')}>Help</MenubarTrigger>
          <MenubarContent className="popover">
            <MenubarItem className="pi"><Icons.File size={13} /><span>Documentation</span></MenubarItem>
            <MenubarItem className="pi"><Icons.Code size={13} /><span>Keyboard shortcuts</span><span className={s.kbd}>?</span></MenubarItem>
            <MenubarSeparator className="div" />
            <MenubarItem className="pi"><Icons.Eye size={13} /><span>What's new in v0.4.2</span></MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
  )
}

const CommandPaletteButton = () => {
  return (
      <button
          className="tbtn ghost"
          style={{height: 22, padding: '0 8px', fontSize: 11}}
          onClick={() => setCommandPaletteOpen(true)}
          aria-label="Open command palette"
      >
        <Icons.Search size={11}/> <span style={{color: 'var(--fg-2)'}}>Search</span>
        <span className={s.kbd} style={{marginLeft: 6}}>⌘K</span>
      </button>
  )
}

export function TitleBar() {
  return (
      <header role="banner" className={s.titlebar}>
        <div className={s.brand}>
          <span className="mark"></span>
          OIMG <span style={{color: 'var(--fg-3)', fontWeight: 400}}>· image optimizer</span>
        </div>

        <FileMenu/>

        <div className={s.right}>
        <Tooltip label="All processing happens locally · no upload">
          <span className="pill"><Icons.Lock size={10} /> 100% local</span>
        </Tooltip>
        <Tooltip label="PWA installed · works offline">
          <span className="pill">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
            Offline-ready
          </span>
        </Tooltip>
        <span style={{ color: 'var(--fg-3)' }}>{APP_VERSION}</span>
        <CommandPaletteButton />
      </div>
    </header>
  )
}
