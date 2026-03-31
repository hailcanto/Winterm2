import { BrowserWindow, ipcMain } from 'electron'
import { spawn, IPty } from 'node-pty'
import { existsSync } from 'fs'

const ptys = new Map<string, IPty>()

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

    const shellArgs = resolvedShell.toLowerCase().includes('pwsh') || resolvedShell.toLowerCase().includes('powershell')
      ? ['-NoLogo', '-NoProfile']
      : []

    const pty = spawn(resolvedShell, shellArgs, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: cwd || process.env.USERPROFILE || process.cwd(),
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        TERM_PROGRAM: 'WinTerm2'
      } as Record<string, string>,
      useConpty: true
    })

    ptys.set(id, pty)

    pty.onData((data) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send(`pty:data:${id}`, data)
      }
    })

    pty.onExit(({ exitCode }) => {
      ptys.delete(id)
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
    }
  })
}

export function destroyAllPtys(): void {
  for (const [id, pty] of ptys) {
    pty.kill()
    ptys.delete(id)
  }
}
