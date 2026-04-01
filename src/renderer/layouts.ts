import { nanoid } from 'nanoid'
import type { PaneNode, SplitPane, TerminalPane } from './store/tabStore'

function tp(): TerminalPane {
  return { type: 'terminal', id: nanoid(), title: '终端' }
}

function sp(direction: 'horizontal' | 'vertical', ratio: number, c1: PaneNode, c2: PaneNode): SplitPane {
  return { type: 'split', id: nanoid(), direction, ratio, children: [c1, c2] }
}

export interface LayoutPreset {
  id: string
  label: string
  build: () => PaneNode
}

export const layoutPresets: LayoutPreset[] = [
  {
    id: 'two-columns',
    label: '双栏 (50/50)',
    build: () => sp('horizontal', 0.5, tp(), tp())
  },
  {
    id: 'three-columns',
    label: '三栏 (33/33/33)',
    build: () => sp('horizontal', 0.33, tp(), sp('horizontal', 0.5, tp(), tp()))
  },
  {
    id: 'main-side',
    label: '主栏+侧栏 (70/30)',
    build: () => sp('horizontal', 0.7, tp(), tp())
  },
  {
    id: 'two-rows',
    label: '双行 (50/50)',
    build: () => sp('vertical', 0.5, tp(), tp())
  },
  {
    id: 'grid-2x2',
    label: '田字格 (2×2)',
    build: () => sp('vertical', 0.5,
      sp('horizontal', 0.5, tp(), tp()),
      sp('horizontal', 0.5, tp(), tp())
    )
  },
  {
    id: 'main-bottom',
    label: '主栏+底栏 (70/30)',
    build: () => sp('vertical', 0.7, tp(), tp())
  },
]
