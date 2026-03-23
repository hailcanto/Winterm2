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

export interface Tab {
  id: string
  title: string
  rootPane: PaneNode
  activePaneId: string
}

interface TabState {
  tabs: Tab[]
  activeTabId: string
  addTab: () => void
  removeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  splitPane: (tabId: string, paneId: string, direction: 'horizontal' | 'vertical') => void
  closePane: (tabId: string, paneId: string) => void
  updatePaneRatio: (tabId: string, splitId: string, ratio: number) => void
  setActivePaneId: (tabId: string, paneId: string) => void
  updatePaneTitle: (paneId: string, title: string) => void
  getActiveTab: () => Tab | undefined
  getActivePane: () => TerminalPane | undefined
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
    activePaneId: pane.id
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
          t.id === tabId ? { ...t, rootPane: newRoot, activePaneId: newPane.id } : t
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
          t.id === tabId ? { ...t, rootPane: newRoot, activePaneId: newActivePaneId } : t
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
  }
}))
