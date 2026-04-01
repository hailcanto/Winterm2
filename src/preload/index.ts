import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('terminalAPI', {
  createPty(id: string, cols: number, rows: number, cwd?: string, shell?: string): Promise<void> {
    return ipcRenderer.invoke('pty:create', { id, cols, rows, cwd, shell })
  },

  writePty(id: string, data: string): void {
    ipcRenderer.send('pty:write', { id, data })
  },

  resizePty(id: string, cols: number, rows: number): void {
    ipcRenderer.send('pty:resize', { id, cols, rows })
  },

  destroyPty(id: string): void {
    ipcRenderer.send('pty:destroy', { id })
  },

  onPtyData(id: string, callback: (data: string) => void): () => void {
    const channel = `pty:data:${id}`
    const listener = (_event: Electron.IpcRendererEvent, data: string): void => {
      callback(data)
    }
    ipcRenderer.on(channel, listener)
    return () => {
      ipcRenderer.removeListener(channel, listener)
    }
  },

  onPtyExit(id: string, callback: (exitCode: number) => void): () => void {
    const channel = `pty:exit:${id}`
    const listener = (_event: Electron.IpcRendererEvent, exitCode: number): void => {
      callback(exitCode)
    }
    ipcRenderer.on(channel, listener)
    return () => {
      ipcRenderer.removeListener(channel, listener)
    }
  },

  getCwd(id: string): Promise<string> {
    return ipcRenderer.invoke('pty:getCwd', { id })
  }
})

contextBridge.exposeInMainWorld('windowAPI', {
  minimize(): void {
    ipcRenderer.invoke('window:minimize')
  },

  maximize(): void {
    ipcRenderer.invoke('window:maximize')
  },

  close(): void {
    ipcRenderer.invoke('window:close')
  },

  isMaximized(): Promise<boolean> {
    return ipcRenderer.invoke('window:isMaximized')
  },

  onMaximizeChange(callback: (maximized: boolean) => void): () => void {
    const channel = 'window:maximized-changed'
    const listener = (_event: Electron.IpcRendererEvent, maximized: boolean): void => {
      callback(maximized)
    }
    ipcRenderer.on(channel, listener)
    return () => {
      ipcRenderer.removeListener(channel, listener)
    }
  },

  setOpacity(opacity: number): void {
    ipcRenderer.send('window:setOpacity', opacity)
  }
})

contextBridge.exposeInMainWorld('shellAPI', {
  openPath(filePath: string): Promise<void> {
    return ipcRenderer.invoke('shell:openPath', filePath)
  },
  openExternal(url: string): Promise<void> {
    return ipcRenderer.invoke('shell:openExternal', url)
  }
})
