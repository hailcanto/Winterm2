export interface TerminalColors {
  foreground: string
  background: string
  cursor: string
  cursorAccent: string
  selectionBackground: string
  selectionForeground: string
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
}

export interface UIColors {
  titleBar: string
  titleBarText: string
  tabBar: string
  tabActive: string
  tabActiveText: string
  tabInactive: string
  tabInactiveText: string
  tabHover: string
  border: string
  scrollbar: string
  scrollbarHover: string
  accent: string
  settingsBg: string
  settingsText: string
  inputBg: string
  inputBorder: string
  inputText: string
  buttonBg: string
  buttonText: string
  buttonHover: string
}

export interface AppTheme {
  name: string
  displayName: string
  type: 'dark' | 'light'
  terminal: TerminalColors
  ui: UIColors
}
