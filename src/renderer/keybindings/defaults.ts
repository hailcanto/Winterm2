import type { Keybinding } from './types'

export const defaultKeybindings: Keybinding[] = [
  { id: 'newTab', label: '新建标签页', keys: 'ctrl+shift+t', action: 'newTab', category: 'tabs' },
  { id: 'closeTab', label: '关闭标签页', keys: 'ctrl+shift+w', action: 'closeTab', category: 'tabs' },
  { id: 'nextTab', label: '下一个标签', keys: 'ctrl+tab', action: 'nextTab', category: 'tabs' },
  { id: 'prevTab', label: '上一个标签', keys: 'ctrl+shift+tab', action: 'prevTab', category: 'tabs' },
  { id: 'splitHorizontal', label: '水平分屏', keys: 'ctrl+shift+d', action: 'splitHorizontal', category: 'panes' },
  { id: 'splitVertical', label: '垂直分屏', keys: 'ctrl+shift+e', action: 'splitVertical', category: 'panes' },
  { id: 'closePane', label: '关闭面板', keys: 'ctrl+shift+x', action: 'closePane', category: 'panes' },
  { id: 'search', label: '搜索', keys: 'ctrl+shift+f', action: 'search', category: 'terminal' },
  { id: 'copy', label: '复制', keys: 'ctrl+shift+c', action: 'copy', category: 'terminal' },
  { id: 'paste', label: '粘贴', keys: 'ctrl+shift+v', action: 'paste', category: 'terminal' },
  { id: 'zoomIn', label: '放大字号', keys: 'ctrl+=', action: 'zoomIn', category: 'app' },
  { id: 'zoomOut', label: '缩小字号', keys: 'ctrl+-', action: 'zoomOut', category: 'app' },
  { id: 'zoomReset', label: '重置字号', keys: 'ctrl+0', action: 'zoomReset', category: 'app' },
  { id: 'openSettings', label: '打开设置', keys: 'ctrl+,', action: 'openSettings', category: 'app' },
]
