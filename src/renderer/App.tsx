import React, { useEffect, useState, useMemo } from 'react'
import './App.css'
import TitleBar from './components/TitleBar'
import TabBar from './components/TabBar'
import SplitView from './components/SplitView'
import FloatingPanel from './components/FloatingPanel'
import { SearchBar } from './components/SearchBar'
import { SettingsPanel } from './components/SettingsPanel'
import { useTabStore } from './store/tabStore'
import StatusBar from './components/StatusBar'
import { useThemeStore } from './store/themeStore'
import { useSettingsStore } from './store/settingsStore'
import { keybindingManager } from './keybindings/manager'
import { getSearchAddon, setSyncInputCallback } from './hooks/useTerminal'
import { CommandPalette } from './components/CommandPalette'
import { layoutPresets } from './layouts'

function collectAllTerminalIds(tab: any): string[] {
  const ids: string[] = []
  const collect = (node: any) => {
    if (node.type === 'terminal') { ids.push(node.id); return }
    collect(node.children[0])
    collect(node.children[1])
  }
  collect(tab.rootPane)
  tab.floatingPanes.forEach((fp: any) => ids.push(fp.id))
  return ids
}

const App: React.FC = () => {
  const [searchVisible, setSearchVisible] = useState(false)
  const [settingsVisible, setSettingsVisible] = useState(false)
  const [commandPaletteVisible, setCommandPaletteVisible] = useState(false)

  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const addTab = useTabStore((s) => s.addTab)
  const applyThemeToCSS = useThemeStore((s) => s.applyThemeToCSS)
  const opacity = useSettingsStore((s) => s.opacity)
  const dividerColor = useSettingsStore((s) => s.dividerColor)
  const activePaneId = useTabStore((s) => s.tabs.find(t => t.id === s.activeTabId)?.activePaneId ?? '')

  useEffect(() => {
    const { themeName } = useSettingsStore.getState()
    if (themeName) {
      useThemeStore.getState().setTheme(themeName)
    } else {
      applyThemeToCSS()
    }
    // Restore session
    useTabStore.getState().restoreSession()
  }, [])

  // Apply window-level opacity
  useEffect(() => {
    window.windowAPI.setOpacity(opacity)
  }, [opacity])

  // Apply divider color
  useEffect(() => {
    document.documentElement.style.setProperty('--divider-color', dividerColor)
  }, [dividerColor])

  useEffect(() => {
    if (tabs.length === 0) {
      addTab()
    }
  }, [tabs.length, addTab])

  // Register keybindings once — use getState() inside handlers to always get fresh state
  useEffect(() => {
    keybindingManager.register('newTab', () => {
      useTabStore.getState().addTab()
    })

    keybindingManager.register('closeTab', () => {
      const { activeTabId, removeTab } = useTabStore.getState()
      if (activeTabId) removeTab(activeTabId)
    })

    keybindingManager.register('nextTab', () => {
      const { tabs, activeTabId, setActiveTab } = useTabStore.getState()
      const idx = tabs.findIndex((t) => t.id === activeTabId)
      if (idx >= 0 && tabs.length > 1) {
        setActiveTab(tabs[(idx + 1) % tabs.length].id)
      }
    })

    keybindingManager.register('prevTab', () => {
      const { tabs, activeTabId, setActiveTab } = useTabStore.getState()
      const idx = tabs.findIndex((t) => t.id === activeTabId)
      if (idx >= 0 && tabs.length > 1) {
        setActiveTab(tabs[(idx - 1 + tabs.length) % tabs.length].id)
      }
    })

    keybindingManager.register('splitHorizontal', () => {
      const { getActiveTab, splitPane } = useTabStore.getState()
      const tab = getActiveTab()
      if (tab) splitPane(tab.id, tab.activePaneId, 'horizontal')
    })

    keybindingManager.register('splitVertical', () => {
      const { getActiveTab, splitPane } = useTabStore.getState()
      const tab = getActiveTab()
      if (tab) splitPane(tab.id, tab.activePaneId, 'vertical')
    })

    keybindingManager.register('closePane', () => {
      const { getActiveTab, closePane } = useTabStore.getState()
      const tab = getActiveTab()
      if (tab) closePane(tab.id, tab.activePaneId)
    })

    keybindingManager.register('focusLeft', () => {
      useTabStore.getState().navigatePane('left')
    })
    keybindingManager.register('focusRight', () => {
      useTabStore.getState().navigatePane('right')
    })
    keybindingManager.register('focusUp', () => {
      useTabStore.getState().navigatePane('up')
    })
    keybindingManager.register('focusDown', () => {
      useTabStore.getState().navigatePane('down')
    })

    keybindingManager.register('toggleFullscreen', () => {
      const { getActiveTab, togglePaneFullscreen } = useTabStore.getState()
      const tab = getActiveTab()
      if (tab) togglePaneFullscreen(tab.id, tab.activePaneId)
    })

    keybindingManager.register('newFloatingPane', () => {
      const tab = useTabStore.getState().getActiveTab()
      if (tab) useTabStore.getState().addFloatingPane(tab.id)
    })

    keybindingManager.register('toggleFloatingPane', () => {
      const tab = useTabStore.getState().getActiveTab()
      if (tab) useTabStore.getState().toggleFloatingPanesVisible(tab.id)
    })

    keybindingManager.register('toggleSyncInput', () => {
      const tab = useTabStore.getState().getActiveTab()
      if (tab) useTabStore.getState().toggleSyncInput(tab.id)
    })

    keybindingManager.register('commandPalette', () => setCommandPaletteVisible((v) => !v))

    keybindingManager.register('search', () => setSearchVisible((v) => !v))

    keybindingManager.register('copy', () => {
      const tab = useTabStore.getState().getActiveTab()
      if (!tab) return
      const event = new CustomEvent('winterm2:copy', { detail: { paneId: tab.activePaneId } })
      window.dispatchEvent(event)
    })

    keybindingManager.register('paste', () => {
      const tab = useTabStore.getState().getActiveTab()
      if (!tab) return
      navigator.clipboard.readText().then(text => {
        if (text) window.terminalAPI.writePty(tab.activePaneId, text)
      })
    })

    keybindingManager.register('zoomIn', () => {
      const s = useSettingsStore.getState()
      s.updateSettings({ fontSize: Math.min(32, s.fontSize + 1) })
    })

    keybindingManager.register('zoomOut', () => {
      const s = useSettingsStore.getState()
      s.updateSettings({ fontSize: Math.max(8, s.fontSize - 1) })
    })

    keybindingManager.register('zoomReset', () => {
      useSettingsStore.getState().updateSettings({ fontSize: 14 })
    })

    keybindingManager.register('openSettings', () => setSettingsVisible((v) => !v))

    const handler = (e: KeyboardEvent) => {
      keybindingManager.handleKeyEvent(e)
    }
    window.addEventListener('keydown', handler)

    return () => {
      window.removeEventListener('keydown', handler)
      ;['newTab', 'closeTab', 'nextTab', 'prevTab', 'splitHorizontal', 'splitVertical',
        'closePane', 'focusLeft', 'focusRight', 'focusUp', 'focusDown', 'toggleFullscreen',
        'newFloatingPane', 'toggleFloatingPane', 'toggleSyncInput', 'commandPalette',
        'search', 'copy', 'paste', 'zoomIn', 'zoomOut', 'zoomReset', 'openSettings'
      ].forEach((a) => keybindingManager.unregister(a))
    }
  }, [])

  // Setup sync input broadcast
  useEffect(() => {
    setSyncInputCallback((sourcePaneId: string, data: string) => {
      const state = useTabStore.getState()
      const tab = state.tabs.find((t) => {
        const allIds = collectAllTerminalIds(t)
        return allIds.includes(sourcePaneId)
      })
      if (!tab || !tab.syncInput) return
      const allIds = collectAllTerminalIds(tab)
      allIds.forEach((id) => {
        if (id !== sourcePaneId) {
          window.terminalAPI.writePty(id, data)
        }
      })
    })
    return () => setSyncInputCallback(null)
  }, [])

  // Save session on window close
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        const { tabs, activeTabId } = useTabStore.getState()
        const session = {
          tabs: tabs.map((t) => ({
            title: t.title,
            rootPane: JSON.parse(JSON.stringify(t.rootPane)),
            syncInput: t.syncInput,
            floatingPanes: t.floatingPanes.map((fp) => ({
              title: fp.title,
              x: fp.x, y: fp.y,
              width: fp.width, height: fp.height
            }))
          })),
          activeTabIndex: tabs.findIndex((t) => t.id === activeTabId)
        }
        localStorage.setItem('winterm2-session', JSON.stringify(session))
      } catch {
        // ignore
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  const commands = useMemo(() => {
    const kb = keybindingManager.getKeybindings()
    const findKeys = (action: string) => kb.find(k => k.action === action)?.keys || ''
    return [
      { id: 'newTab', label: '新建标签页', keys: findKeys('newTab'), action: () => useTabStore.getState().addTab() },
      { id: 'closeTab', label: '关闭标签页', keys: findKeys('closeTab'), action: () => { const { activeTabId, removeTab } = useTabStore.getState(); if (activeTabId) removeTab(activeTabId) } },
      { id: 'splitHorizontal', label: '水平分屏', keys: findKeys('splitHorizontal'), action: () => { const { getActiveTab, splitPane } = useTabStore.getState(); const tab = getActiveTab(); if (tab) splitPane(tab.id, tab.activePaneId, 'horizontal') } },
      { id: 'splitVertical', label: '垂直分屏', keys: findKeys('splitVertical'), action: () => { const { getActiveTab, splitPane } = useTabStore.getState(); const tab = getActiveTab(); if (tab) splitPane(tab.id, tab.activePaneId, 'vertical') } },
      { id: 'closePane', label: '关闭面板', keys: findKeys('closePane'), action: () => { const { getActiveTab, closePane } = useTabStore.getState(); const tab = getActiveTab(); if (tab) closePane(tab.id, tab.activePaneId) } },
      { id: 'toggleFullscreen', label: '面板全屏', keys: findKeys('toggleFullscreen'), action: () => { const { getActiveTab, togglePaneFullscreen } = useTabStore.getState(); const tab = getActiveTab(); if (tab) togglePaneFullscreen(tab.id, tab.activePaneId) } },
      { id: 'newFloatingPane', label: '新建浮动面板', keys: findKeys('newFloatingPane'), action: () => { const tab = useTabStore.getState().getActiveTab(); if (tab) useTabStore.getState().addFloatingPane(tab.id) } },
      { id: 'toggleFloatingPane', label: '显隐浮动面板', keys: findKeys('toggleFloatingPane'), action: () => { const tab = useTabStore.getState().getActiveTab(); if (tab) useTabStore.getState().toggleFloatingPanesVisible(tab.id) } },
      { id: 'toggleSyncInput', label: '同步输入', keys: findKeys('toggleSyncInput'), action: () => { const tab = useTabStore.getState().getActiveTab(); if (tab) useTabStore.getState().toggleSyncInput(tab.id) } },
      { id: 'search', label: '搜索', keys: findKeys('search'), action: () => setSearchVisible((v) => !v) },
      { id: 'zoomIn', label: '放大字号', keys: findKeys('zoomIn'), action: () => { const s = useSettingsStore.getState(); s.updateSettings({ fontSize: Math.min(32, s.fontSize + 1) }) } },
      { id: 'zoomOut', label: '缩小字号', keys: findKeys('zoomOut'), action: () => { const s = useSettingsStore.getState(); s.updateSettings({ fontSize: Math.max(8, s.fontSize - 1) }) } },
      { id: 'zoomReset', label: '重置字号', keys: findKeys('zoomReset'), action: () => useSettingsStore.getState().updateSettings({ fontSize: 14 }) },
      { id: 'openSettings', label: '打开设置', keys: findKeys('openSettings'), action: () => setSettingsVisible((v) => !v) },
      ...layoutPresets.map((preset) => ({
        id: `layout-${preset.id}`,
        label: `布局: ${preset.label}`,
        keys: '',
        action: () => {
          const tab = useTabStore.getState().getActiveTab()
          if (tab) useTabStore.getState().applyLayout(tab.id, preset.build())
        }
      })),
    ]
  }, [])

  return (
    <div className="app">
      <TitleBar />
      <TabBar />
      <div className="terminal-area">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId
          return (
            <div
              key={tab.id}
              className={`tab-content ${isActive ? 'visible' : 'hidden'}`}
            >
              <SplitView node={tab.rootPane} tabId={tab.id} isTabActive={isActive} />
              {tab.floatingPanes.map((fp) => (
                <FloatingPanel key={fp.id} pane={fp} tabId={tab.id} isTabActive={isActive} />
              ))}
            </div>
          )
        })}
      </div>
      <StatusBar />
      {searchVisible && (
        <SearchBar
          searchAddon={activePaneId ? getSearchAddon(activePaneId) : null}
          visible={searchVisible}
          onClose={() => setSearchVisible(false)}
        />
      )}
      {settingsVisible && (
        <SettingsPanel
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
        />
      )}
      {commandPaletteVisible && (
        <CommandPalette
          visible={commandPaletteVisible}
          onClose={() => setCommandPaletteVisible(false)}
          commands={commands}
        />
      )}
    </div>
  )
}

export default App
