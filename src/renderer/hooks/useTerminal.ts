import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { SearchAddon } from '@xterm/addon-search'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { ImageAddon } from '@xterm/addon-image'
import { useEffect, useRef, useCallback } from 'react'
import { keybindingManager } from '../keybindings/manager'
import { useSettingsStore } from '../store/settingsStore'

interface TerminalInstance {
  terminal: Terminal
  fitAddon: FitAddon
  searchAddon: SearchAddon
  container: HTMLDivElement | null
  resizeObserver: ResizeObserver | null
  unsubData: (() => void) | null
  unsubExit: (() => void) | null
  onDataDisposable: { dispose: () => void } | null
  copyHandler: ((e: Event) => void) | null
}

// Global map to persist terminal instances across React re-renders
const terminalInstances = new Map<string, TerminalInstance>()

// Sync input broadcast callback
let syncInputCallback: ((sourcePaneId: string, data: string) => void) | null = null

export function setSyncInputCallback(cb: ((sourcePaneId: string, data: string) => void) | null) {
  syncInputCallback = cb
}

// Restored session cwds for PTY creation
const restoredCwds = new Map<string, string>()
// Cached shell types per pane (queried after PTY creation)
const paneShellTypes = new Map<string, string>()

export function setRestoredCwd(paneId: string, cwd: string) {
  if (cwd) restoredCwds.set(paneId, cwd)
}

function getOrCreateInstance(paneId: string, options: {
  fontSize: number
  fontFamily: string
  lineHeight: number
  cursorStyle: 'block' | 'underline' | 'bar'
  cursorBlink: boolean
  scrollback: number
  theme?: Record<string, string>
}): TerminalInstance {
  const existing = terminalInstances.get(paneId)
  if (existing) return existing

  const term = new Terminal({
    fontSize: options.fontSize,
    fontFamily: options.fontFamily,
    lineHeight: options.lineHeight,
    cursorStyle: options.cursorStyle,
    cursorBlink: options.cursorBlink,
    scrollback: options.scrollback,
    theme: options.theme,
    allowProposedApi: true
  })

  const fitAddon = new FitAddon()
  const searchAddon = new SearchAddon()

  term.loadAddon(fitAddon)
  term.loadAddon(new Unicode11Addon())
  term.loadAddon(searchAddon)

  try {
    term.loadAddon(new ImageAddon())
  } catch (e) {
    console.warn('Image addon failed to load:', e)
  }

  try {
    term.loadAddon(new WebglAddon())
  } catch (e) {
    console.warn('WebGL addon failed to load, falling back to canvas renderer:', e)
  }

  term.attachCustomKeyEventHandler(keybindingManager.createXtermKeyHandler())

  const instance: TerminalInstance = {
    terminal: term,
    fitAddon,
    searchAddon,
    container: null,
    resizeObserver: null,
    unsubData: null,
    unsubExit: null,
    onDataDisposable: null,
    copyHandler: null
  }

  terminalInstances.set(paneId, instance)
  return instance
}

function attachToContainer(paneId: string, instance: TerminalInstance, container: HTMLDivElement) {
  if (instance.container === container) return // Already attached

  const { terminal: term, fitAddon: fa } = instance

  // If terminal was previously opened somewhere, we need to re-open it
  // xterm.js doesn't support moving, so we check if it's already opened
  if (!instance.container) {
    // First time opening
    term.open(container)

    // Create PTY with shell and cwd from settings
    const { defaultShell, startupCwd } = useSettingsStore.getState()
    const restoredCwd = restoredCwds.get(paneId)
    if (restoredCwd) restoredCwds.delete(paneId)
    window.terminalAPI.createPty(paneId, term.cols, term.rows, restoredCwd || startupCwd || undefined, defaultShell || undefined)
    // Cache shell type for link provider
    window.terminalAPI.getShellType(paneId).then(t => paneShellTypes.set(paneId, t)).catch(() => {})

    // PTY data -> terminal
    const osc7Re = /\x1b\]7;file:\/\/[^/]*(\/.*?)(?:\x07|\x1b\\)/
    instance.unsubData = window.terminalAPI.onPtyData(paneId, (data) => {
      // Track cwd via OSC 7 on renderer side as well
      const m = osc7Re.exec(data)
      if (m) {
        try {
          let cwd = decodeURIComponent(m[1])
          // Strip leading / from Windows paths like /C:/Users/...
          if (/^\/[a-zA-Z]:/.test(cwd)) cwd = cwd.slice(1)
          window.terminalAPI.updateCwd(paneId, cwd)
        } catch { /* ignore */ }
      }
      term.write(data)
    })

    // PTY exit
    instance.unsubExit = window.terminalAPI.onPtyExit(paneId, () => {
      term.write('\r\n[进程已退出]')
    })

    // Terminal input -> PTY (with sync input support)
    instance.onDataDisposable = term.onData((data) => {
      window.terminalAPI.writePty(paneId, data)
      if (syncInputCallback) {
        syncInputCallback(paneId, data)
      }
    })

    // Copy handler
    instance.copyHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.paneId === paneId && term.hasSelection()) {
        navigator.clipboard.writeText(term.getSelection())
      }
    }
    window.addEventListener('winterm2:copy', instance.copyHandler)

    // Link provider: URLs and file paths (3 categories)
    const urlRegex = /https?:\/\/[^\s]+/g
    // Windows absolute: C:\...
    const winAbsRegex = /[a-zA-Z]:\\[^\s:*?"<>|]+(?::\d+)?/g
    // Relative: ./ ../ .\ ..\ (must have at least 1 dot)
    const relativeRegex = /\.{1,2}[/\\][^\s:*?"<>|]+(?::\d+)?/g
    // Unix absolute: /home/... /c/... (must contain at least one / separator after initial /letter)
    const unixAbsRegex = /\/[a-zA-Z][^\s:*?"<>|]*\/[^\s:*?"<>|]+(?::\d+)?/g

    type Link = { range: { start: { x: number; y: number }; end: { x: number; y: number } }; text: string; activate: () => void }

    term.registerLinkProvider({
      provideLinks(bufferLineNumber: number, callback: (links: Link[] | undefined) => void) {
        const line = term.buffer.active.getLine(bufferLineNumber - 1)
        if (!line) { callback(undefined); return }
        const text = line.translateToString()
        const links: Link[] = []

        // 1. Match URLs first, record their ranges
        const urlRanges: [number, number][] = []
        urlRegex.lastIndex = 0
        let urlMatch: RegExpExecArray | null
        while ((urlMatch = urlRegex.exec(text)) !== null) {
          const matchedText = urlMatch[0]
          const s = urlMatch.index
          const e = s + matchedText.length
          urlRanges.push([s, e])
          links.push({
            range: { start: { x: s + 1, y: bufferLineNumber }, end: { x: e, y: bufferLineNumber } },
            text: matchedText,
            activate: () => { window.shellAPI.openExternal(matchedText) }
          })
        }

        const overlapsUrl = (s: number, e: number) => urlRanges.some(([us, ue]) => s < ue && e > us)
        const addFileLink = (matchedText: string, s: number, e: number) => {
          if (overlapsUrl(s, e)) return
          links.push({
            range: { start: { x: s + 1, y: bufferLineNumber }, end: { x: e, y: bufferLineNumber } },
            text: matchedText,
            activate: () => { window.shellAPI.openTerminalPath(paneId, matchedText.replace(/:\d+$/, '')) }
          })
        }

        // 2. Windows absolute paths (all shells)
        winAbsRegex.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = winAbsRegex.exec(text)) !== null) addFileLink(m[0], m.index, m.index + m[0].length)

        // 3. Relative paths (all shells)
        relativeRegex.lastIndex = 0
        while ((m = relativeRegex.exec(text)) !== null) addFileLink(m[0], m.index, m.index + m[0].length)

        // 4. Unix absolute paths (only for WSL / Git Bash)
        const shellType = paneShellTypes.get(paneId) || 'windows'
        if (shellType === 'wsl' || shellType === 'gitbash') {
          unixAbsRegex.lastIndex = 0
          while ((m = unixAbsRegex.exec(text)) !== null) addFileLink(m[0], m.index, m.index + m[0].length)
        }

        callback(links.length > 0 ? links : undefined)
      }
    })
  } else {
    // Re-attaching to a new container — move the terminal element
    const termElement = instance.container.querySelector('.xterm')
    if (termElement) {
      container.appendChild(termElement)
    }
  }

  instance.container = container

  // Setup ResizeObserver
  if (instance.resizeObserver) {
    instance.resizeObserver.disconnect()
  }
  instance.resizeObserver = new ResizeObserver(() => {
    try {
      fa.fit()
      window.terminalAPI.resizePty(paneId, term.cols, term.rows)
    } catch {
      // ignore
    }
  })
  instance.resizeObserver.observe(container)

  // Initial fit
  requestAnimationFrame(() => {
    try {
      fa.fit()
      window.terminalAPI.resizePty(paneId, term.cols, term.rows)
    } catch {
      // ignore
    }
  })
}

function destroyInstance(paneId: string) {
  const instance = terminalInstances.get(paneId)
  if (!instance) return

  if (instance.resizeObserver) instance.resizeObserver.disconnect()
  if (instance.onDataDisposable) instance.onDataDisposable.dispose()
  if (instance.unsubData) instance.unsubData()
  if (instance.unsubExit) instance.unsubExit()
  if (instance.copyHandler) window.removeEventListener('winterm2:copy', instance.copyHandler)

  window.terminalAPI.destroyPty(paneId)
  instance.terminal.dispose()
  terminalInstances.delete(paneId)
  paneShellTypes.delete(paneId)
}

// --- Hook ---

interface UseTerminalOptions {
  paneId: string
  fontSize?: number
  fontFamily?: string
  lineHeight?: number
  cursorStyle?: 'block' | 'underline' | 'bar'
  cursorBlink?: boolean
  scrollback?: number
  theme?: Record<string, string>
  isActive?: boolean
}

interface UseTerminalReturn {
  terminalRef: React.RefObject<HTMLDivElement | null>
  searchAddon: SearchAddon | null
  fit: () => void
  focus: () => void
}

export function useTerminal(options: UseTerminalOptions): UseTerminalReturn {
  const {
    paneId,
    fontSize = 14,
    fontFamily = 'Cascadia Code, Consolas, monospace',
    lineHeight = 1.2,
    cursorStyle = 'bar',
    cursorBlink = true,
    scrollback = 5000,
    theme,
    isActive
  } = options

  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<TerminalInstance | null>(null)

  const fit = useCallback(() => {
    const inst = instanceRef.current
    if (!inst) return
    try {
      inst.fitAddon.fit()
      window.terminalAPI.resizePty(paneId, inst.terminal.cols, inst.terminal.rows)
    } catch {
      // ignore
    }
  }, [paneId])

  const focus = useCallback(() => {
    instanceRef.current?.terminal.focus()
  }, [])

  // Attach terminal to container
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const instance = getOrCreateInstance(paneId, {
      fontSize, fontFamily, lineHeight, cursorStyle, cursorBlink, scrollback, theme
    })
    instanceRef.current = instance
    attachToContainer(paneId, instance, container)

    // Cleanup: only detach observer, don't destroy the instance
    // Instance is destroyed when the pane is removed from the store
    return () => {
      if (instance.resizeObserver) {
        instance.resizeObserver.disconnect()
        instance.resizeObserver = null
      }
    }
  }, [paneId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Refit and focus when tab becomes visible
  useEffect(() => {
    if (!isActive) return
    const inst = instanceRef.current
    if (!inst) return

    requestAnimationFrame(() => {
      try {
        inst.fitAddon.fit()
        window.terminalAPI.resizePty(paneId, inst.terminal.cols, inst.terminal.rows)
        inst.terminal.refresh(0, inst.terminal.rows - 1)
        inst.terminal.focus()
      } catch {
        // ignore
      }
    })
  }, [isActive, paneId])

  // Update terminal options dynamically
  useEffect(() => {
    const inst = instanceRef.current
    if (!inst) return
    const term = inst.terminal
    term.options.fontSize = fontSize
    term.options.fontFamily = fontFamily
    term.options.lineHeight = lineHeight
    term.options.cursorStyle = cursorStyle
    term.options.cursorBlink = cursorBlink
    term.options.scrollback = scrollback
    if (theme) term.options.theme = theme

    requestAnimationFrame(() => {
      try {
        inst.fitAddon.fit()
        window.terminalAPI.resizePty(paneId, term.cols, term.rows)
      } catch {
        // ignore
      }
    })
  }, [fontSize, fontFamily, lineHeight, cursorStyle, cursorBlink, scrollback, theme, paneId])

  return {
    terminalRef: containerRef,
    searchAddon: instanceRef.current?.searchAddon ?? null,
    fit,
    focus
  }
}

// Export for cleanup when tabs/panes are removed
export { destroyInstance as destroyTerminalInstance }

// Export for accessing search addon from outside components
export function getSearchAddon(paneId: string): SearchAddon | null {
  return terminalInstances.get(paneId)?.searchAddon ?? null
}
