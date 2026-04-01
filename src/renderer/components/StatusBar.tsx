import React from 'react'
import { useTabStore } from '../store/tabStore'
import type { PaneNode } from '../store/tabStore'
import './StatusBar.css'

function countTerminals(node: PaneNode): number {
  if (node.type === 'terminal') return 1
  return countTerminals(node.children[0]) + countTerminals(node.children[1])
}

const StatusBar: React.FC = () => {
  const activeTab = useTabStore((s) => s.tabs.find(t => t.id === s.activeTabId))
  const activePane = useTabStore((s) => s.getActivePane())

  const paneCount = activeTab ? countTerminals(activeTab.rootPane) : 0
  const paneTitle = activePane?.title || '终端'

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <span className="status-item">{paneTitle}</span>
        <span className="status-separator">|</span>
        <span className="status-item">面板: {paneCount}</span>
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
