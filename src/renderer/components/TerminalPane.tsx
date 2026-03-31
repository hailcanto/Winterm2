import React, { useMemo } from 'react'
import '@xterm/xterm/css/xterm.css'
import { useTerminal } from '../hooks/useTerminal'
import { useSettingsStore } from '../store/settingsStore'
import { useThemeStore } from '../store/themeStore'
import { useTabStore } from '../store/tabStore'
import './TerminalPane.css'

interface TerminalPaneProps {
  paneId: string
  isActive: boolean
  isVisible: boolean
}

const TerminalPane: React.FC<TerminalPaneProps> = ({ paneId, isActive, isVisible }) => {
  const fontSize = useSettingsStore((s) => s.fontSize)
  const fontFamily = useSettingsStore((s) => s.fontFamily)
  const lineHeight = useSettingsStore((s) => s.lineHeight)
  const cursorStyle = useSettingsStore((s) => s.cursorStyle)
  const cursorBlink = useSettingsStore((s) => s.cursorBlink)
  const scrollback = useSettingsStore((s) => s.scrollback)
  const xtermTheme = useThemeStore((s) => s.currentTheme.terminal)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const setActivePaneId = useTabStore((s) => s.setActivePaneId)

  const stableTheme = useMemo(
    () => xtermTheme as Record<string, string>,
    [JSON.stringify(xtermTheme)]
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

  const handleClick = () => {
    setActivePaneId(activeTabId, paneId)
    focus()
  }

  return (
    <div
      className={`terminal-pane ${isActive ? 'active' : ''}`}
      ref={terminalRef}
      onClick={handleClick}
    />
  )
}

export default TerminalPane
