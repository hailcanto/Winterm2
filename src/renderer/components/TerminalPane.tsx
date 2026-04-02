import React, { useMemo, useEffect, useState } from 'react'
import '@xterm/xterm/css/xterm.css'
import { useTerminal } from '../hooks/useTerminal'
import { useSettingsStore } from '../store/settingsStore'
import { useThemeStore } from '../store/themeStore'
import { useTabStore } from '../store/tabStore'
import './TerminalPane.css'
import ContextMenu from './ContextMenu'

interface TerminalPaneProps {
  paneId: string
  isActive: boolean
  isVisible: boolean
  isFullscreen?: boolean
}

const TerminalPane: React.FC<TerminalPaneProps> = ({ paneId, isActive, isVisible, isFullscreen = false }) => {
  const fontSize = useSettingsStore((s) => s.fontSize)
  const fontFamily = useSettingsStore((s) => s.fontFamily)
  const lineHeight = useSettingsStore((s) => s.lineHeight)
  const cursorStyle = useSettingsStore((s) => s.cursorStyle)
  const cursorBlink = useSettingsStore((s) => s.cursorBlink)
  const scrollback = useSettingsStore((s) => s.scrollback)
  const xtermTheme = useThemeStore((s) => s.currentTheme.terminal)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const setActivePaneId = useTabStore((s) => s.setActivePaneId)

  const themeKey = JSON.stringify(xtermTheme)
  const stableTheme = useMemo(
    () => xtermTheme as unknown as Record<string, string>,
    [themeKey]
  )

  const { terminalRef, focus } = useTerminal({
    paneId,
    fontSize,
    fontFamily,
    lineHeight,
    cursorStyle,
    cursorBlink,
    scrollback,
    theme: stableTheme,
    isActive: isVisible
  })

  const [contextMenu, setContextMenu] = useState<{x: number, y: number} | null>(null)

  const handleClick = () => {
    setActivePaneId(activeTabId, paneId)
    focus()
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  useEffect(() => {
    if (isActive) {
      focus()
    }
  }, [isActive, focus])

  return (
    <div
      className={`terminal-pane ${isActive ? 'active' : ''} ${isFullscreen ? 'fullscreen' : ''}`}
      ref={terminalRef as React.RefObject<HTMLDivElement>}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            { label: '复制', action: () => { navigator.clipboard.writeText(document.getSelection()?.toString() || '') } },
            { label: '粘贴', action: () => { navigator.clipboard.readText().then(text => { if (text) window.terminalAPI.writePty(paneId, text) }) } },
            { separator: true, label: '', action: () => {} },
            { label: '水平分屏', action: () => { const { getActiveTab, splitPane } = useTabStore.getState(); const tab = getActiveTab(); if (tab) splitPane(tab.id, paneId, 'horizontal') } },
            { label: '垂直分屏', action: () => { const { getActiveTab, splitPane } = useTabStore.getState(); const tab = getActiveTab(); if (tab) splitPane(tab.id, paneId, 'vertical') } },
            { separator: true, label: '', action: () => {} },
            { label: '搜索', action: () => { const e = new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, shiftKey: true, bubbles: true }); window.dispatchEvent(e) } },
            { label: '关闭面板', action: () => { const { getActiveTab, closePane } = useTabStore.getState(); const tab = getActiveTab(); if (tab) closePane(tab.id, paneId) } },
          ]}
        />
      )}
    </div>
  )
}

export default TerminalPane
