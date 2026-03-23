import { create } from 'zustand'
import type { AppTheme } from '../themes/types'
import { builtinThemes, defaultTheme } from '../themes/builtinThemes'

interface ThemeState {
  currentTheme: AppTheme
  themes: AppTheme[]
  setTheme: (themeName: string) => void
  applyThemeToCSS: () => void
}

const uiColorToCSSVar: Record<string, string> = {
  titleBar: '--title-bar',
  titleBarText: '--title-bar-text',
  tabBar: '--tab-bar',
  tabActive: '--tab-active',
  tabActiveText: '--tab-active-text',
  tabInactive: '--tab-inactive',
  tabInactiveText: '--tab-inactive-text',
  tabHover: '--tab-hover',
  border: '--border',
  scrollbar: '--scrollbar',
  scrollbarHover: '--scrollbar-hover',
  accent: '--accent',
  settingsBg: '--settings-bg',
  settingsText: '--settings-text',
  inputBg: '--input-bg',
  inputBorder: '--input-border',
  inputText: '--input-text',
  buttonBg: '--button-bg',
  buttonText: '--button-text',
  buttonHover: '--button-hover'
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  currentTheme: defaultTheme,
  themes: builtinThemes,

  setTheme: (themeName: string) => {
    const theme = get().themes.find((t) => t.name === themeName)
    if (theme) {
      set({ currentTheme: theme })
      get().applyThemeToCSS()
    }
  },

  applyThemeToCSS: () => {
    const { currentTheme } = get()
    const root = document.documentElement
    const ui = currentTheme.ui as Record<string, string>
    for (const [key, cssVar] of Object.entries(uiColorToCSSVar)) {
      if (ui[key]) {
        root.style.setProperty(cssVar, ui[key])
      }
    }
  }
}))
