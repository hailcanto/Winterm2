import React from 'react'
import { useTabStore } from '../store/tabStore'
import type { PaneNode } from '../store/tabStore'
import './StatusBar.css'

function countTerminals(node: PaneNode): number {
  if (node.type === 'terminal') return 1
  return countTerminals(node.children[0]) + countTerminals(node.children[1])
}

function findTerminalInTree(node: PaneNode, paneId: string): string | undefined {
  if (node.type === 'terminal') return node.id === paneId ? node.title : undefined
  return findTerminalInTree(node.children[0], paneId) || findTerminalInTree(node.children[1], paneId)
}

const StatusBar: React.FC = () => {
  const activeTab = useTabStore((s) => s.tabs.find(t => t.id === s.activeTabId))
  const paneTitle = useTabStore((s) => {
    const tab = s.tabs.find(t => t.id === s.activeTabId)
    if (!tab) return '终端'
    // Check floating panes first
    const fp = tab.floatingPanes.find(f => f.id === tab.activePaneId)
    if (fp) return fp.title || '浮动终端'
    return findTerminalInTree(tab.rootPane, tab.activePaneId) || '终端'
  })
  const syncInput = useTabStore((s) => {
    const tab = s.tabs.find(t => t.id === s.activeTabId)
    return tab?.syncInput ?? false
  })

  const paneCount = activeTab ? countTerminals(activeTab.rootPane) + activeTab.floatingPanes.length : 0

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <span className="status-item">{paneTitle}</span>
        <span className="status-separator">|</span>
        <span className="status-item">面板: {paneCount}</span>
        {syncInput && (
          <>
            <span className="status-separator">|</span>
            <span className="status-item status-sync">同步输入</span>
          </>
        )}
      </div>
      <div className="status-bar-right">
        <span className="status-hint">Alt+Shift+= 水平分屏</span>
        <span className="status-hint">Alt+Shift+- 垂直分屏</span>
        <span className="status-hint">Ctrl+Shift+F 搜索</span>
        <span className="status-hint">Ctrl+, 设置</span>
      </div>
    </div>
  )
}

export default StatusBar
