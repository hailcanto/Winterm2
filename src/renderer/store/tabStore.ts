import { create } from 'zustand'
import { nanoid } from 'nanoid'
import { destroyTerminalInstance } from '../hooks/useTerminal'

// --- Types ---

export interface TerminalPane {
  type: 'terminal'
  id: string
  title: string
}

export interface SplitPane {
  type: 'split'
  id: string
  direction: 'horizontal' | 'vertical'
  ratio: number
  children: [PaneNode, PaneNode]
}

export type PaneNode = TerminalPane | SplitPane

export interface FloatingPaneState {
  id: string
  title: string
  x: number
  y: number
  width: number
  height: number
  visible: boolean
  zIndex: number
}

export interface Tab {
  id: string
  title: string
  rootPane: PaneNode
  activePaneId: string
  fullscreenPaneId: string | null
  floatingPanes: FloatingPaneState[]
  floatingCounter: number
}

interface TabState {
  tabs: Tab[]
  activeTabId: string
  addTab: () => void
  removeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  renameTab: (tabId: string, title: string) => void
  splitPane: (tabId: string, paneId: string, direction: 'horizontal' | 'vertical') => void
  closePane: (tabId: string, paneId: string) => void
  updatePaneRatio: (tabId: string, splitId: string, ratio: number) => void
  setActivePaneId: (tabId: string, paneId: string) => void
  updatePaneTitle: (paneId: string, title: string) => void
  getActiveTab: () => Tab | undefined
  getActivePane: () => TerminalPane | undefined
  togglePaneFullscreen: (tabId: string, paneId: string) => void
  navigatePane: (direction: 'left' | 'right' | 'up' | 'down') => void
  addFloatingPane: (tabId: string) => void
  removeFloatingPane: (tabId: string, paneId: string) => void
  updateFloatingPane: (tabId: string, paneId: string, updates: Partial<FloatingPaneState>) => void
  toggleFloatingPanesVisible: (tabId: string) => void
  bringFloatingToFront: (tabId: string, paneId: string) => void
}

// --- Helpers ---

function createTerminalPane(title = '终端'): TerminalPane {
  return { type: 'terminal', id: nanoid(), title }
}

function createTab(): Tab {
  const pane = createTerminalPane()
  return {
    id: nanoid(),
    title: pane.title,
    rootPane: pane,
    activePaneId: pane.id,
    fullscreenPaneId: null,
    floatingPanes: [],
    floatingCounter: 100
  }
}

function findPane(node: PaneNode, paneId: string): PaneNode | null {
  if (node.id === paneId) return node
  if (node.type === 'split') {
    return findPane(node.children[0], paneId) || findPane(node.children[1], paneId)
  }
  return null
}

function findTerminalPane(node: PaneNode, paneId: string): TerminalPane | null {
  if (node.type === 'terminal' && node.id === paneId) return node
  if (node.type === 'split') {
    return findTerminalPane(node.children[0], paneId) || findTerminalPane(node.children[1], paneId)
  }
  return null
}

function replacePane(node: PaneNode, targetId: string, replacement: PaneNode): PaneNode {
  if (node.id === targetId) return replacement
  if (node.type === 'split') {
    return {
      ...node,
      children: [
        replacePane(node.children[0], targetId, replacement),
        replacePane(node.children[1], targetId, replacement)
      ]
    }
  }
  return node
}

function removePaneFromTree(node: PaneNode, targetId: string): PaneNode | null {
  if (node.type === 'terminal') {
    return node.id === targetId ? null : node
  }
  if (node.children[0].id === targetId) return node.children[1]
  if (node.children[1].id === targetId) return node.children[0]

  const left = removePaneFromTree(node.children[0], targetId)
  if (left !== node.children[0]) {
    return left ? { ...node, children: [left, node.children[1]] } : node.children[1]
  }
  const right = removePaneFromTree(node.children[1], targetId)
  if (right !== node.children[1]) {
    return right ? { ...node, children: [node.children[0], right] } : node.children[0]
  }
  return node
}

function getFirstTerminal(node: PaneNode): TerminalPane | null {
  if (node.type === 'terminal') return node
  return getFirstTerminal(node.children[0]) || getFirstTerminal(node.children[1])
}

function updateTitleInTree(node: PaneNode, paneId: string, title: string): PaneNode {
  if (node.type === 'terminal') {
    return node.id === paneId ? { ...node, title } : node
  }
  return {
    ...node,
    children: [
      updateTitleInTree(node.children[0], paneId, title),
      updateTitleInTree(node.children[1], paneId, title)
    ]
  }
}

function updateRatioInTree(node: PaneNode, splitId: string, ratio: number): PaneNode {
  if (node.type === 'split') {
    if (node.id === splitId) return { ...node, ratio }
    return {
      ...node,
      children: [
        updateRatioInTree(node.children[0], splitId, ratio),
        updateRatioInTree(node.children[1], splitId, ratio)
      ]
    }
  }
  return node
}

function collectTerminalIds(node: PaneNode): string[] {
  if (node.type === 'terminal') return [node.id]
  return [...collectTerminalIds(node.children[0]), ...collectTerminalIds(node.children[1])]
}

// --- Navigation helpers ---

interface Rect { x: number; y: number; w: number; h: number }

function buildPaneRects(node: PaneNode, rect: Rect): Map<string, Rect> {
  const map = new Map<string, Rect>()
  if (node.type === 'terminal') {
    map.set(node.id, rect)
    return map
  }
  const { direction, ratio, children } = node
  let r1: Rect, r2: Rect
  if (direction === 'horizontal') {
    r1 = { x: rect.x, y: rect.y, w: rect.w * ratio, h: rect.h }
    r2 = { x: rect.x + rect.w * ratio, y: rect.y, w: rect.w * (1 - ratio), h: rect.h }
  } else {
    r1 = { x: rect.x, y: rect.y, w: rect.w, h: rect.h * ratio }
    r2 = { x: rect.x, y: rect.y + rect.h * ratio, w: rect.w, h: rect.h * (1 - ratio) }
  }
  for (const [id, r] of buildPaneRects(children[0], r1)) map.set(id, r)
  for (const [id, r] of buildPaneRects(children[1], r2)) map.set(id, r)
  return map
}

function findNeighborPane(rects: Map<string, Rect>, currentId: string, direction: 'left' | 'right' | 'up' | 'down'): string | null {
  const current = rects.get(currentId)
  if (!current) return null
  const eps = 0.001
  let best: string | null = null
  let bestDist = Infinity

  for (const [id, r] of rects) {
    if (id === currentId) continue
    let valid = false
    let dist = 0

    if (direction === 'right') {
      if (r.x >= current.x + current.w - eps) {
        const overlapMin = Math.max(current.y, r.y)
        const overlapMax = Math.min(current.y + current.h, r.y + r.h)
        if (overlapMax > overlapMin + eps) {
          valid = true
          dist = r.x - (current.x + current.w)
        }
      }
    } else if (direction === 'left') {
      if (r.x + r.w <= current.x + eps) {
        const overlapMin = Math.max(current.y, r.y)
        const overlapMax = Math.min(current.y + current.h, r.y + r.h)
        if (overlapMax > overlapMin + eps) {
          valid = true
          dist = current.x - (r.x + r.w)
        }
      }
    } else if (direction === 'down') {
      if (r.y >= current.y + current.h - eps) {
        const overlapMin = Math.max(current.x, r.x)
        const overlapMax = Math.min(current.x + current.w, r.x + r.w)
        if (overlapMax > overlapMin + eps) {
          valid = true
          dist = r.y - (current.y + current.h)
        }
      }
    } else if (direction === 'up') {
      if (r.y + r.h <= current.y + eps) {
        const overlapMin = Math.max(current.x, r.x)
        const overlapMax = Math.min(current.x + current.w, r.x + r.w)
        if (overlapMax > overlapMin + eps) {
          valid = true
          dist = current.y - (r.y + r.h)
        }
      }
    }

    if (valid && dist < bestDist) {
      bestDist = dist
      best = id
    }
  }
  return best
}

// --- Store ---

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [],
  activeTabId: '',

  addTab: () => {
    const tab = createTab()
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id
    }))
  },

  removeTab: (tabId: string) => {
    const state = get()
    const tab = state.tabs.find((t) => t.id === tabId)
    if (tab) {
      // Destroy all terminal instances in this tab
      const ids = collectTerminalIds(tab.rootPane)
      ids.forEach((id) => destroyTerminalInstance(id))
      if (tab.floatingPanes) {
        tab.floatingPanes.forEach((fp) => destroyTerminalInstance(fp.id))
      }
    }
    set((state) => {
      const newTabs = state.tabs.filter((t) => t.id !== tabId)
      let newActiveId = state.activeTabId
      if (state.activeTabId === tabId) {
        const idx = state.tabs.findIndex((t) => t.id === tabId)
        const next = newTabs[idx] || newTabs[idx - 1]
        newActiveId = next?.id ?? ''
      }
      return { tabs: newTabs, activeTabId: newActiveId }
    })
  },

  setActiveTab: (tabId: string) => {
    set({ activeTabId: tabId })
  },

  renameTab: (tabId: string, title: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, title: title || t.title } : t
      )
    }))
  },

  splitPane: (tabId: string, paneId: string, direction: 'horizontal' | 'vertical') => {
    set((state) => {
      const tab = state.tabs.find((t) => t.id === tabId)
      if (!tab) return state
      const target = findPane(tab.rootPane, paneId)
      if (!target) return state

      const newPane = createTerminalPane()
      const split: SplitPane = {
        type: 'split',
        id: nanoid(),
        direction,
        ratio: 0.5,
        children: [target, newPane]
      }
      const newRoot = replacePane(tab.rootPane, paneId, split)
      return {
        tabs: state.tabs.map((t) =>
          t.id === tabId ? { ...t, rootPane: newRoot, activePaneId: newPane.id, fullscreenPaneId: null } : t
        )
      }
    })
  },

  closePane: (tabId: string, paneId: string) => {
    // Destroy the terminal instance for the closed pane
    destroyTerminalInstance(paneId)

    set((state) => {
      const tab = state.tabs.find((t) => t.id === tabId)
      if (!tab) return state

      // If root is the target terminal, remove the whole tab
      if (tab.rootPane.id === paneId && tab.rootPane.type === 'terminal') {
        const newTabs = state.tabs.filter((t) => t.id !== tabId)
        let newActiveId = state.activeTabId
        if (state.activeTabId === tabId) {
          const idx = state.tabs.findIndex((t) => t.id === tabId)
          const next = newTabs[idx] || newTabs[idx - 1]
          newActiveId = next?.id ?? ''
        }
        return { tabs: newTabs, activeTabId: newActiveId }
      }

      const newRoot = removePaneFromTree(tab.rootPane, paneId)
      if (!newRoot) return state

      let newActivePaneId = tab.activePaneId
      if (tab.activePaneId === paneId) {
        const first = getFirstTerminal(newRoot)
        newActivePaneId = first?.id ?? ''
      }

      return {
        tabs: state.tabs.map((t) =>
          t.id === tabId ? { ...t, rootPane: newRoot, activePaneId: newActivePaneId, fullscreenPaneId: t.fullscreenPaneId === paneId ? null : t.fullscreenPaneId } : t
        )
      }
    })
  },

  updatePaneRatio: (tabId: string, splitId: string, ratio: number) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, rootPane: updateRatioInTree(t.rootPane, splitId, ratio) } : t
      )
    }))
  },

  setActivePaneId: (tabId: string, paneId: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, activePaneId: paneId } : t
      )
    }))
  },

  updatePaneTitle: (paneId: string, title: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) => ({
        ...t,
        rootPane: updateTitleInTree(t.rootPane, paneId, title)
      }))
    }))
  },

  getActiveTab: () => {
    const { tabs, activeTabId } = get()
    return tabs.find((t) => t.id === activeTabId)
  },

  getActivePane: () => {
    const tab = get().getActiveTab()
    if (!tab) return undefined
    return findTerminalPane(tab.rootPane, tab.activePaneId) ?? undefined
  },

  togglePaneFullscreen: (tabId: string, paneId: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id !== tabId) return t
        return { ...t, fullscreenPaneId: t.fullscreenPaneId === paneId ? null : paneId }
      })
    }))
  },

  navigatePane: (direction: 'left' | 'right' | 'up' | 'down') => {
    const tab = get().getActiveTab()
    if (!tab) return
    const rects = buildPaneRects(tab.rootPane, { x: 0, y: 0, w: 1, h: 1 })
    const target = findNeighborPane(rects, tab.activePaneId, direction)
    if (target) {
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tab.id ? { ...t, activePaneId: target } : t
        )
      }))
    }
  },

  addFloatingPane: (tabId: string) => {
    const newId = nanoid()
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id !== tabId) return t
        const offset = t.floatingPanes.length * 30
        const newPane: FloatingPaneState = {
          id: newId,
          title: '浮动终端',
          x: 100 + offset,
          y: 80 + offset,
          width: 500,
          height: 350,
          visible: true,
          zIndex: t.floatingCounter + 1
        }
        return {
          ...t,
          floatingPanes: [...t.floatingPanes, newPane],
          floatingCounter: t.floatingCounter + 1,
          activePaneId: newId
        }
      })
    }))
  },

  removeFloatingPane: (tabId: string, paneId: string) => {
    destroyTerminalInstance(paneId)
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id !== tabId) return t
        const newFloating = t.floatingPanes.filter((fp) => fp.id !== paneId)
        const newActivePaneId = t.activePaneId === paneId
          ? (getFirstTerminal(t.rootPane)?.id ?? '')
          : t.activePaneId
        return { ...t, floatingPanes: newFloating, activePaneId: newActivePaneId }
      })
    }))
  },

  updateFloatingPane: (tabId: string, paneId: string, updates: Partial<FloatingPaneState>) => {
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id !== tabId) return t
        return {
          ...t,
          floatingPanes: t.floatingPanes.map((fp) =>
            fp.id === paneId ? { ...fp, ...updates } : fp
          )
        }
      })
    }))
  },

  toggleFloatingPanesVisible: (tabId: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id !== tabId) return t
        const anyVisible = t.floatingPanes.some((fp) => fp.visible)
        return {
          ...t,
          floatingPanes: t.floatingPanes.map((fp) => ({ ...fp, visible: !anyVisible }))
        }
      })
    }))
  },

  bringFloatingToFront: (tabId: string, paneId: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id !== tabId) return t
        const newCounter = t.floatingCounter + 1
        return {
          ...t,
          floatingCounter: newCounter,
          floatingPanes: t.floatingPanes.map((fp) =>
            fp.id === paneId ? { ...fp, zIndex: newCounter } : fp
          )
        }
      })
    }))
  },
}))
