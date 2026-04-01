import React, { useCallback } from 'react'
import { useTabStore, type FloatingPaneState } from '../store/tabStore'
import TerminalPane from './TerminalPane'
import './FloatingPanel.css'

interface FloatingPanelProps {
  pane: FloatingPaneState
  tabId: string
  isTabActive: boolean
}

const FloatingPanel: React.FC<FloatingPanelProps> = ({ pane, tabId, isTabActive }) => {
  const updateFloatingPane = useTabStore((s) => s.updateFloatingPane)
  const removeFloatingPane = useTabStore((s) => s.removeFloatingPane)
  const bringFloatingToFront = useTabStore((s) => s.bringFloatingToFront)
  const setActivePaneId = useTabStore((s) => s.setActivePaneId)
  const activePaneId = useTabStore((s) => s.tabs.find((t) => t.id === tabId)?.activePaneId ?? '')

  const handleTitleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    bringFloatingToFront(tabId, pane.id)
    const startX = e.clientX - pane.x
    const startY = e.clientY - pane.y
    const onMove = (ev: MouseEvent) => {
      updateFloatingPane(tabId, pane.id, {
        x: Math.max(0, ev.clientX - startX),
        y: Math.max(0, ev.clientY - startY)
      })
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [tabId, pane.id, pane.x, pane.y, bringFloatingToFront, updateFloatingPane])

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const startW = pane.width
    const startH = pane.height
    const onMove = (ev: MouseEvent) => {
      updateFloatingPane(tabId, pane.id, {
        width: Math.max(200, startW + ev.clientX - startX),
        height: Math.max(150, startH + ev.clientY - startY)
      })
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [tabId, pane.id, pane.width, pane.height, updateFloatingPane])

  const handleClick = useCallback(() => {
    setActivePaneId(tabId, pane.id)
    bringFloatingToFront(tabId, pane.id)
  }, [tabId, pane.id, setActivePaneId, bringFloatingToFront])

  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    removeFloatingPane(tabId, pane.id)
  }, [tabId, pane.id, removeFloatingPane])

  if (!pane.visible) return null

  return (
    <div
      className={`floating-panel ${pane.id === activePaneId ? 'active' : ''}`}
      style={{ left: pane.x, top: pane.y, width: pane.width, height: pane.height, zIndex: pane.zIndex }}
      onClick={handleClick}
    >
      <div className="floating-panel-titlebar" onMouseDown={handleTitleMouseDown}>
        <span className="floating-panel-title">{pane.title}</span>
        <button className="floating-panel-close" onClick={handleClose}>✕</button>
      </div>
      <div className="floating-panel-body">
        <TerminalPane paneId={pane.id} isActive={isTabActive && pane.id === activePaneId} isVisible={isTabActive && pane.visible} />
      </div>
      <div className="floating-panel-resize" onMouseDown={handleResizeMouseDown} />
    </div>
  )
}

export default FloatingPanel
