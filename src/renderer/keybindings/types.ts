export interface Keybinding {
  id: string
  label: string
  keys: string
  action: string
  category: 'tabs' | 'panes' | 'terminal' | 'app'
}

export type KeybindingAction =
  | 'newTab' | 'closeTab' | 'nextTab' | 'prevTab'
  | 'splitHorizontal' | 'splitVertical' | 'closePane'
  | 'search' | 'copy' | 'paste'
  | 'zoomIn' | 'zoomOut' | 'zoomReset'
  | 'openSettings'
  | 'focusLeft' | 'focusRight' | 'focusUp' | 'focusDown'
  | 'toggleFullscreen'
  | 'newFloatingPane' | 'toggleFloatingPane'
  | 'toggleSyncInput'
  | 'commandPalette'
