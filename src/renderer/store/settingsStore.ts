import { create } from 'zustand'

interface Settings {
  fontFamily: string
  fontSize: number
  lineHeight: number
  cursorStyle: 'block' | 'underline' | 'bar'
  cursorBlink: boolean
  opacity: number
  defaultShell: string
  scrollback: number
  startupCwd: string
  themeName: string
  dividerColor: string
  dividerWidth: number
}

interface SettingsState extends Settings {
  updateSettings: (partial: Partial<Settings>) => void
  loadSettings: () => void
  saveSettings: () => void
}

const defaultSettings: Settings = {
  fontFamily: 'Cascadia Code, Consolas, monospace',
  fontSize: 14,
  lineHeight: 1.2,
  cursorStyle: 'bar',
  cursorBlink: true,
  opacity: 1.0,
  defaultShell: '',
  scrollback: 5000,
  startupCwd: '',
  themeName: 'one-dark',
  dividerColor: '#ff8c00',
  dividerWidth: 4
}

const STORAGE_KEY = 'winterm2-settings'

function loadSavedSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Settings>
      return { ...defaultSettings, ...saved }
    }
  } catch {
    // ignore parse errors, use defaults
  }
  return defaultSettings
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...loadSavedSettings(),

  updateSettings: (partial: Partial<Settings>) => {
    set(partial)
    get().saveSettings()
  },

  loadSettings: () => {
    const saved = loadSavedSettings()
    set(saved)
  },

  saveSettings: () => {
    try {
      const state = get()
      const settings: Settings = {
        fontFamily: state.fontFamily,
        fontSize: state.fontSize,
        lineHeight: state.lineHeight,
        cursorStyle: state.cursorStyle,
        cursorBlink: state.cursorBlink,
        opacity: state.opacity,
        defaultShell: state.defaultShell,
        scrollback: state.scrollback,
        startupCwd: state.startupCwd,
        themeName: state.themeName,
        dividerColor: state.dividerColor,
        dividerWidth: state.dividerWidth
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // ignore storage errors
    }
  }
}))
