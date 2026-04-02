import { BrowserWindow, ipcMain, shell } from 'electron'
import { spawn, IPty } from 'node-pty'
import { existsSync } from 'fs'
import { execFile } from 'child_process'
import * as path from 'path'

type ShellType = 'wsl' | 'gitbash' | 'windows'

const ptys = new Map<string, IPty>()
const ptyCwds = new Map<string, string>()
const ptyShells = new Map<string, ShellType>()

// Parse OSC 7 sequences: \x1b]7;file://host/path\x07 or \x1b]7;file://host/path\x1b\\
const osc7Regex = /\x1b\]7;file:\/\/[^/]*(\/.*?)(?:\x07|\x1b\\)/

function detectShell(): string {
  const pwsh7Paths = [
    'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
    'C:\\Program Files (x86)\\PowerShell\\7\\pwsh.exe'
  ]

  for (const p of pwsh7Paths) {
    if (existsSync(p)) return p
  }

  // 尝试 PATH 中的 pwsh
  try {
    const { execSync } = require('child_process')
    const result = execSync('where pwsh.exe', { encoding: 'utf-8', timeout: 3000 }).trim()
    if (result) return result.split('\n')[0].trim()
  } catch {
    // pwsh not found in PATH
  }

  return 'powershell.exe'
}

export function setupPtyHandlers(mainWindow: BrowserWindow): void {
  const defaultShell = detectShell()

  ipcMain.handle('pty:create', (_event, { id, cols, rows, cwd, shell: customShell }: { id: string; cols: number; rows: number; cwd?: string; shell?: string }) => {
    if (ptys.has(id)) return

    const resolvedShell = customShell || defaultShell

    const shellLower = resolvedShell.toLowerCase()

    const isWsl = shellLower.includes('wsl')
    const isGitBash = shellLower.includes('bash') && !isWsl
    const isPwsh = shellLower.includes('pwsh') || shellLower.includes('powershell')
    const shellType: ShellType = isWsl ? 'wsl' : isGitBash ? 'gitbash' : 'windows'

    let shellArgs: string[] = isPwsh ? ['-NoLogo', '-NoProfile'] : []

    // Resolve cwd for the target shell
    const defaultCwd = process.env.USERPROFILE || process.cwd()
    let resolvedCwd = defaultCwd
    let originalCwd = cwd || ''

    if (cwd) {
      if (/^[a-zA-Z]:/.test(cwd) && existsSync(cwd)) {
        // Windows absolute path — use directly
        resolvedCwd = cwd
      } else if (isWsl && cwd.startsWith('/')) {
        // WSL Unix path — pass via --cd, use default Windows cwd for spawn
        shellArgs = ['--cd', cwd, ...shellArgs]
        resolvedCwd = defaultCwd
      } else if (isGitBash && /^\/[a-zA-Z]\//.test(cwd)) {
        // Git Bash /c/Users/... → C:\Users\...
        const winPath = cwd[1].toUpperCase() + ':' + cwd.slice(2).replace(/\//g, '\\')
        if (existsSync(winPath)) resolvedCwd = winPath
      } else if (!cwd.startsWith('/') && existsSync(cwd)) {
        resolvedCwd = cwd
      }
    }

    const pty = spawn(resolvedShell, shellArgs, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: resolvedCwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        TERM_PROGRAM: 'WinTerm2'
      } as Record<string, string>,
      useConpty: true
    })

    ptys.set(id, pty)
    ptyCwds.set(id, originalCwd || resolvedCwd)
    ptyShells.set(id, shellType)

    pty.onData((data) => {
      // Track cwd changes via OSC 7
      const match = osc7Regex.exec(data)
      if (match) {
        try {
          let decoded = decodeURIComponent(match[1])
          // Strip leading / from Windows paths like /C:/Users/...
          if (/^\/[a-zA-Z]:/.test(decoded)) decoded = decoded.slice(1)
          ptyCwds.set(id, decoded)
        } catch {
          // ignore malformed URI
        }
      }

      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send(`pty:data:${id}`, data)
      }
    })

    pty.onExit(({ exitCode }) => {
      ptys.delete(id)
      ptyCwds.delete(id)
      ptyShells.delete(id)
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send(`pty:exit:${id}`, exitCode)
      }
    })
  })

  ipcMain.on('pty:write', (_event, { id, data }: { id: string; data: string }) => {
    ptys.get(id)?.write(data)
  })

  ipcMain.on('pty:resize', (_event, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
    ptys.get(id)?.resize(cols, rows)
  })

  ipcMain.on('pty:destroy', (_event, { id }: { id: string }) => {
    const pty = ptys.get(id)
    if (pty) {
      pty.kill()
      ptys.delete(id)
      ptyCwds.delete(id)
      ptyShells.delete(id)
    }
  })

  // Also allow renderer to update cwd directly (e.g. parsed from shell prompt)
  ipcMain.on('pty:updateCwd', (_event, { id, cwd }: { id: string; cwd: string }) => {
    if (ptys.has(id) && cwd) {
      ptyCwds.set(id, cwd)
    }
  })

  ipcMain.handle('pty:getCwd', (_event, { id }: { id: string }) => {
    return ptyCwds.get(id) || ''
  })

  ipcMain.handle('pty:getShellType', (_event, { id }: { id: string }) => {
    return ptyShells.get(id) || 'windows'
  })

  // Resolve a raw path from terminal output to a Windows path and open it
  ipcMain.handle('shell:openTerminalPath', async (_event, { paneId, rawPath }: { paneId: string; rawPath: string }) => {
    const st = ptyShells.get(paneId) || 'windows'
    const cwd = ptyCwds.get(paneId) || ''

    let winPath: string | null = null

    if (st === 'windows') {
      // PowerShell / cmd: resolve with win32 path module
      if (path.win32.isAbsolute(rawPath)) {
        winPath = rawPath
      } else if (cwd) {
        winPath = path.win32.resolve(cwd, rawPath)
      }
    } else if (st === 'wsl') {
      // Build full POSIX path
      let fullPath: string
      if (rawPath.startsWith('/')) {
        fullPath = rawPath
      } else if (cwd) {
        fullPath = cwd.replace(/\/$/, '') + '/' + rawPath
      } else {
        return
      }
      // If already a Windows path, use directly
      if (/^[a-zA-Z]:/.test(fullPath)) {
        winPath = fullPath
      } else {
        // Convert via wslpath
        try {
          winPath = await new Promise<string>((resolve, reject) => {
            execFile('wsl', ['wslpath', '-w', fullPath], { timeout: 3000 }, (err, stdout) => {
              if (err || !stdout?.trim()) reject(err)
              else resolve(stdout.trim())
            })
          })
        } catch { /* leave null */ }
      }
    } else if (st === 'gitbash') {
      let fullPath: string
      if (rawPath.startsWith('/')) {
        fullPath = rawPath
      } else if (cwd) {
        fullPath = cwd.replace(/\/$/, '') + '/' + rawPath
      } else {
        return
      }
      // /c/Users/... → C:\Users\...
      if (/^\/[a-zA-Z]\//.test(fullPath)) {
        winPath = fullPath[1].toUpperCase() + ':' + fullPath.slice(2).replace(/\//g, '\\')
      } else if (/^[a-zA-Z]:/.test(fullPath)) {
        winPath = fullPath
      }
    }

    if (winPath) {
      try { await shell.openPath(winPath) } catch { /* ignore */ }
    }
  })
}

export function destroyAllPtys(): void {
  for (const [id, pty] of ptys) {
    pty.kill()
    ptys.delete(id)
  }
  ptyCwds.clear()
  ptyShells.clear()
}
