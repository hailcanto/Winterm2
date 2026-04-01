import React, { useState, useRef, useEffect, useMemo } from 'react'
import { keybindingManager } from '../keybindings/manager'
import './CommandPalette.css'

interface Command {
  id: string
  label: string
  keys: string
  action: () => void
}

interface CommandPaletteProps {
  visible: boolean
  onClose: () => void
  commands: Command[]
}

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  let qi = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++
  }
  return qi === q.length
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ visible, onClose, commands }) => {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    if (!query.trim()) return commands
    return commands.filter((cmd) => fuzzyMatch(query, cmd.label) || fuzzyMatch(query, cmd.id))
  }, [query, commands])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (visible && inputRef.current) {
      setQuery('')
      setSelectedIndex(0)
      inputRef.current.focus()
    }
  }, [visible])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const item = listRef.current.children[selectedIndex] as HTMLElement
    if (item) item.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (!visible) return null

  const execute = (cmd: Command) => {
    onClose()
    cmd.action()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) execute(filtered[selectedIndex])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <>
      <div className="command-palette-overlay" onClick={onClose} />
      <div className="command-palette">
        <input
          ref={inputRef}
          className="command-palette-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入命令..."
        />
        <div className="command-palette-list" ref={listRef}>
          {filtered.map((cmd, i) => (
            <div
              key={cmd.id}
              className={`command-palette-item ${i === selectedIndex ? 'selected' : ''}`}
              onClick={() => execute(cmd)}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span className="command-palette-label">{cmd.label}</span>
              {cmd.keys && <span className="command-palette-keys">{cmd.keys}</span>}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="command-palette-empty">无匹配命令</div>
          )}
        </div>
      </div>
    </>
  )
}
