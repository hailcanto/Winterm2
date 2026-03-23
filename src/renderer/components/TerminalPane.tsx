import React from 'react'
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
  const { fontSize, fontFamily, lineHeight, cursorStyle, cursorBlink, scrollback } =
    useSettingsStore()
  const xtermTheme = useThemeStore((s) => s.currentTheme.terminal)
  const { activeTabId, setActivePaneId } = useTabStore()

  const { terminalRef, focus } = useTerminal({
    paneId,
    fontSize,
    fontFamily,
    lineHeight,
    cursorStyle,
    cursorBlink,
    scrollback,
    theme: xtermTheme as Record<string, string>,
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
