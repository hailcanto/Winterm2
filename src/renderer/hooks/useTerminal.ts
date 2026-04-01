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

    // PTY data -> terminal
    instance.unsubData = window.terminalAPI.onPtyData(paneId, (data) => {
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

    // File path link provider
    const filePathRegex = /(?:[a-zA-Z]:\\|\.{0,2}\/)[^\s:*?"<>|]+(?::\d+)?/
    const urlRegex = /https?:\/\/[^\s]+/

    term.registerLinkProvider({
      provideLinks(bufferLineNumber: number, callback: (links: Array<{ range: { start: { x: number; y: number }; end: { x: number; y: number } }; text: string; activate: () => void }> | undefined) => void) {
        const line = term.buffer.active.getLine(bufferLineNumber - 1)
        if (!line) { callback(undefined); return }
        const text = line.translateToString()
        const links: Array<{ range: { start: { x: number; y: number }; end: { x: number; y: number } }; text: string; activate: () => void }> = []

        // Match file paths
        let match: RegExpExecArray | null
        const fpRegex = new RegExp(filePathRegex.source, 'g')
        while ((match = fpRegex.exec(text)) !== null) {
          const startX = match.index + 1
          const endX = match.index + match[0].length
          links.push({
            range: {
              start: { x: startX, y: bufferLineNumber },
              end: { x: endX, y: bufferLineNumber }
            },
            text: match[0],
            activate: () => {
              const pathPart = match![0].split(':')[0] + (match![0].includes(':\\') ? '\\' + match![0].split('\\').slice(1).join('\\').split(':')[0] : '')
              window.shellAPI.openPath(pathPart.replace(/:\d+$/, ''))
            }
          })
        }

        // Match URLs
        const urlRegexG = new RegExp(urlRegex.source, 'g')
        while ((match = urlRegexG.exec(text)) !== null) {
          const startX = match.index + 1
          const endX = match.index + match[0].length
          links.push({
            range: {
              start: { x: startX, y: bufferLineNumber },
              end: { x: endX, y: bufferLineNumber }
            },
            text: match[0],
            activate: () => {
              window.shellAPI.openExternal(match![0])
            }
          })
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

  const containerRef = useRef<HTMLDivElement | null>(null)
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
