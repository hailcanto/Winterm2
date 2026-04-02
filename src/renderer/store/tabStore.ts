import { create } from 'zustand'
import { nanoid } from 'nanoid'
import { destroyTerminalInstance, setRestoredCwd } from '../hooks/useTerminal'

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
  syncInput: boolean
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
  toggleSyncInput: (tabId: string) => void
  applyLayout: (tabId: string, rootPane: PaneNode) => void
  saveSession: () => Promise<void>
  restoreSession: () => void
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
    floatingCounter: 100,
    syncInput: false
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

// --- Session serialization ---

// Cache the last successfully serialized session for sync save on beforeunload
let lastSessionJson: string | null = null
export function getLastSessionJson(): string | null { return lastSessionJson }

// Sync fallback: serialize layout without cwd (for beforeunload when cache is empty)
export function saveSessionSyncFallback(): void {
  try {
    const { tabs, activeTabId } = useTabStore.getState()
    if (tabs.length === 0) return
    const cwdMap: Record<string, string> = {}
    const session = {
      tabs: tabs.map((t) => {
        const terminalIds = collectTerminalIds(t.rootPane)
        const mainIndex = terminalIds.indexOf(t.activePaneId)
        const floatingIndex = t.floatingPanes.findIndex(fp => fp.id === t.activePaneId)
        return {
          title: t.title,
          rootPane: serializePaneTree(t.rootPane, cwdMap),
          activePaneIndex: mainIndex >= 0 ? mainIndex : 0,
          activeIsFloating: floatingIndex >= 0,
          activeFloatingIndex: floatingIndex >= 0 ? floatingIndex : -1,
          syncInput: t.syncInput,
          floatingPanes: t.floatingPanes.map((fp) => ({
            title: fp.title,
            x: fp.x, y: fp.y,
            width: fp.width, height: fp.height,
            cwd: ''
          }))
        }
      }),
      activeTabIndex: tabs.findIndex((t) => t.id === activeTabId)
    }
    localStorage.setItem('winterm2-session', JSON.stringify(session))
  } catch { /* ignore */ }
}

interface SerializedTerminal { type: 'terminal'; title: string; cwd: string }
interface SerializedSplit { type: 'split'; direction: 'horizontal' | 'vertical'; ratio: number; children: [SerializedNode, SerializedNode] }
type SerializedNode = SerializedTerminal | SerializedSplit

function serializePaneTree(node: PaneNode, cwdMap: Record<string, string>): SerializedNode {
  if (node.type === 'terminal') {
    return { type: 'terminal', title: node.title, cwd: cwdMap[node.id] || '' }
  }
  return {
    type: 'split',
    direction: node.direction,
    ratio: node.ratio,
    children: [
      serializePaneTree(node.children[0], cwdMap),
      serializePaneTree(node.children[1], cwdMap)
    ]
  }
}

function deserializePaneTree(node: SerializedNode): PaneNode {
  if (node.type === 'terminal') {
    const pane = createTerminalPane(node.title)
    ;(pane as any)._cwd = node.cwd || ''
    return pane
  }
  return {
    type: 'split',
    id: nanoid(),
    direction: node.direction,
    ratio: node.ratio,
    children: [
      deserializePaneTree(node.children[0]),
      deserializePaneTree(node.children[1])
    ]
  }
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
        // Also destroy floating pane PTYs
        if (tab.floatingPanes) {
          tab.floatingPanes.forEach((fp) => destroyTerminalInstance(fp.id))
        }
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

  toggleSyncInput: (tabId: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, syncInput: !t.syncInput } : t
      )
    }))
  },

  applyLayout: (tabId: string, rootPane: PaneNode) => {
    // Destroy all existing terminal instances in the tab
    const state = get()
    const tab = state.tabs.find((t) => t.id === tabId)
    if (!tab) return
    const oldIds = collectTerminalIds(tab.rootPane)
    oldIds.forEach((id) => destroyTerminalInstance(id))
    // Also destroy floating panes
    tab.floatingPanes.forEach((fp) => destroyTerminalInstance(fp.id))

    const firstTerminal = getFirstTerminal(rootPane)
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? {
          ...t,
          rootPane,
          activePaneId: firstTerminal?.id ?? '',
          fullscreenPaneId: null,
          floatingPanes: [],
          floatingCounter: 100
        } : t
      )
    }))
  },

  saveSession: async () => {
    try {
      const { tabs, activeTabId } = get()
      const cwdMap: Record<string, string> = {}
      for (const tab of tabs) {
        const ids = collectTerminalIds(tab.rootPane)
        tab.floatingPanes.forEach((fp) => ids.push(fp.id))
        for (const id of ids) {
          try {
            const cwd = await window.terminalAPI.getCwd(id)
            if (cwd) cwdMap[id] = cwd
          } catch {
            // ignore
          }
        }
      }
      const session = {
        tabs: tabs.map((t) => {
          const terminalIds = collectTerminalIds(t.rootPane)
          const mainIndex = terminalIds.indexOf(t.activePaneId)
          const floatingIndex = t.floatingPanes.findIndex(fp => fp.id === t.activePaneId)
          return {
            title: t.title,
            rootPane: serializePaneTree(t.rootPane, cwdMap),
            activePaneIndex: mainIndex >= 0 ? mainIndex : 0,
            activeIsFloating: floatingIndex >= 0,
            activeFloatingIndex: floatingIndex >= 0 ? floatingIndex : -1,
            syncInput: t.syncInput,
            floatingPanes: t.floatingPanes.map((fp) => ({
              title: fp.title,
              x: fp.x, y: fp.y,
              width: fp.width, height: fp.height,
              cwd: cwdMap[fp.id] || ''
            }))
          }
        }),
        activeTabIndex: tabs.findIndex((t) => t.id === activeTabId)
      }
      const json = JSON.stringify(session)
      lastSessionJson = json
      localStorage.setItem('winterm2-session', json)
    } catch {
      // ignore save errors
    }
  },

  restoreSession: () => {
    try {
      const raw = localStorage.getItem('winterm2-session')
      if (!raw) return
      localStorage.removeItem('winterm2-session')
      const session = JSON.parse(raw)
      if (!session.tabs || session.tabs.length === 0) return

      const newTabs: Tab[] = session.tabs.map((saved: any) => {
        const rootPane = deserializePaneTree(saved.rootPane)
        const firstTerminal = getFirstTerminal(rootPane)
        const floatingPanes: FloatingPaneState[] = (saved.floatingPanes || []).map((fp: any) => ({
          id: nanoid(),
          title: fp.title || '浮动终端',
          x: fp.x || 100,
          y: fp.y || 80,
          width: fp.width || 500,
          height: fp.height || 350,
          visible: true,
          zIndex: 101,
          _cwd: fp.cwd || ''
        }))
        const terminalIds = collectTerminalIds(rootPane)
        const activePaneIndex = saved.activePaneIndex ?? 0
        let restoredActivePaneId: string
        if (saved.activeIsFloating && saved.activeFloatingIndex >= 0 && saved.activeFloatingIndex < floatingPanes.length) {
          restoredActivePaneId = floatingPanes[saved.activeFloatingIndex].id
        } else {
          restoredActivePaneId = terminalIds[activePaneIndex] ?? firstTerminal?.id ?? ''
        }
        return {
          id: nanoid(),
          title: saved.title || '终端',
          rootPane,
          activePaneId: restoredActivePaneId,
          fullscreenPaneId: null,
          floatingPanes,
          floatingCounter: 100 + floatingPanes.length,
          syncInput: saved.syncInput || false
        }
      })

      // Set restored cwds for PTY creation
      for (const tab of newTabs) {
        const setCwds = (node: PaneNode) => {
          if (node.type === 'terminal') {
            const cwd = (node as any)._cwd
            if (cwd) {
              setRestoredCwd(node.id, cwd)
              delete (node as any)._cwd
            }
            return
          }
          setCwds(node.children[0])
          setCwds(node.children[1])
        }
        setCwds(tab.rootPane)
        tab.floatingPanes.forEach((fp: any) => {
          if (fp._cwd) {
            setRestoredCwd(fp.id, fp._cwd)
            delete fp._cwd
          }
        })
      }

      const activeIdx = Math.max(0, Math.min(session.activeTabIndex || 0, newTabs.length - 1))
      set({ tabs: newTabs, activeTabId: newTabs[activeIdx]?.id ?? '' })
    } catch {
      // ignore restore errors
    }
  },
}))
