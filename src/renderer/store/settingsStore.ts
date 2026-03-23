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
}

interface SettingsState extends Settings {
  updateSettings: (partial: Partial<Settings>) => void
  loadSettings: () => Promise<void>
  saveSettings: () => Promise<void>
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
  themeName: 'one-dark'
}

const STORAGE_KEY = 'winterm2-settings'

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...defaultSettings,

  updateSettings: (partial: Partial<Settings>) => {
    set(partial)
    get().saveSettings()
  },

  loadSettings: async () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Settings>
        set({ ...defaultSettings, ...saved })
      }
    } catch {
      // ignore parse errors, use defaults
    }
  },

  saveSettings: async () => {
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
        themeName: state.themeName
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // ignore storage errors
    }
  }
}))
