import React, { useCallback, useRef } from 'react'
import { useTabStore, type PaneNode } from '../store/tabStore'
import TerminalPane from './TerminalPane'
import './SplitView.css'

interface SplitViewProps {
  node: PaneNode
  tabId: string
  isTabActive?: boolean
}

const SplitView: React.FC<SplitViewProps> = ({ node, tabId, isTabActive = false }) => {
  const { updatePaneRatio } = useTabStore()
  const activePaneId = useTabStore((s) => s.tabs.find((t) => t.id === tabId)?.activePaneId ?? '')
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (node.type !== 'split') return
      e.preventDefault()

      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const isHorizontal = node.direction === 'horizontal'

      const onMouseMove = (ev: MouseEvent) => {
        let ratio: number
        if (isHorizontal) {
          ratio = (ev.clientX - rect.left) / rect.width
        } else {
          ratio = (ev.clientY - rect.top) / rect.height
        }
        ratio = Math.max(0.1, Math.min(0.9, ratio))
        updatePaneRatio(tabId, node.id, ratio)
      }

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [node, tabId, updatePaneRatio]
  )

  if (node.type === 'terminal') {
    return <TerminalPane paneId={node.id} isActive={isTabActive && node.id === activePaneId} isVisible={isTabActive} />
  }

  const firstSize = `${node.ratio}fr`
  const secondSize = `${1 - node.ratio}fr`

  return (
    <div
      ref={containerRef}
      className={`split-view ${node.direction}`}
      style={{
        '--first-size': firstSize,
        '--second-size': secondSize
      } as React.CSSProperties}
    >
      <SplitView node={node.children[0]} tabId={tabId} isTabActive={isTabActive} />
      <div
        className={`split-divider ${node.direction}`}
        onMouseDown={handleMouseDown}
      />
      <SplitView node={node.children[1]} tabId={tabId} isTabActive={isTabActive} />
    </div>
  )
}

export default SplitView
