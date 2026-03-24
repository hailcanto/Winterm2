import React, { useEffect, useState } from 'react'
import './App.css'
import TitleBar from './components/TitleBar'
import TabBar from './components/TabBar'
import SplitView from './components/SplitView'
import { SearchBar } from './components/SearchBar'
import { SettingsPanel } from './components/SettingsPanel'
import { useTabStore } from './store/tabStore'
import { useThemeStore } from './store/themeStore'
import { useSettingsStore } from './store/settingsStore'
import { keybindingManager } from './keybindings/manager'

const App: React.FC = () => {
  const [searchVisible, setSearchVisible] = useState(false)
  const [settingsVisible, setSettingsVisible] = useState(false)

  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const addTab = useTabStore((s) => s.addTab)
  const applyThemeToCSS = useThemeStore((s) => s.applyThemeToCSS)
  const opacity = useSettingsStore((s) => s.opacity)
  const dividerColor = useSettingsStore((s) => s.dividerColor)

  useEffect(() => {
    applyThemeToCSS()
    useSettingsStore.getState().loadSettings()
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
        'closePane', 'search', 'copy', 'paste', 'zoomIn', 'zoomOut', 'zoomReset', 'openSettings'
      ].forEach((a) => keybindingManager.unregister(a))
    }
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
            </div>
          )
        })}
      </div>
      {searchVisible && (
        <SearchBar
          searchAddon={null}
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
    </div>
  )
}

export default App
