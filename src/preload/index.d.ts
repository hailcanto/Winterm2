interface TerminalAPI {
  createPty(id: string, cols: number, rows: number, cwd?: string, shell?: string): Promise<void>
  writePty(id: string, data: string): void
  resizePty(id: string, cols: number, rows: number): void
  destroyPty(id: string): void
  onPtyData(id: string, callback: (data: string) => void): () => void
  onPtyExit(id: string, callback: (exitCode: number) => void): () => void
}

interface WindowAPI {
  minimize(): void
  maximize(): void
  close(): void
  isMaximized(): Promise<boolean>
  onMaximizeChange(callback: (maximized: boolean) => void): () => void
  setOpacity(opacity: number): void
}

declare global {
  interface Window {
    terminalAPI: TerminalAPI
    windowAPI: WindowAPI
  }
}

export {}
