import React, { useState, useRef, useEffect } from 'react'
import type { SearchAddon } from '@xterm/addon-search'
import './SearchBar.css'

interface SearchBarProps {
  searchAddon: SearchAddon | null
  visible: boolean
  onClose: () => void
}

export const SearchBar: React.FC<SearchBarProps> = ({ searchAddon, visible, onClose }) => {
  const [query, setQuery] = useState('')
  const [regex, setRegex] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [matchIndex, setMatchIndex] = useState<number | null>(null)
  const [matchCount, setMatchCount] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (visible && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [visible])

  useEffect(() => {
    if (!searchAddon) return
    const disposable = searchAddon.onDidChangeResults(({ resultIndex, resultCount }) => {
      setMatchIndex(resultIndex)
      setMatchCount(resultCount)
    })
    return () => disposable.dispose()
  }, [searchAddon])

  useEffect(() => {
    setMatchIndex(null)
    setMatchCount(null)
  }, [query])

  if (!visible) return null

  const searchOptions = { regex, caseSensitive, wholeWord }

  const findNext = () => {
    if (searchAddon && query) {
      searchAddon.findNext(query, searchOptions)
    }
  }

  const findPrevious = () => {
    if (searchAddon && query) {
      searchAddon.findPrevious(query, searchOptions)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        findPrevious()
      } else {
        findNext()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div className="search-bar">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="搜索..."
      />
      {query && (
        <span className={`search-count ${matchCount === 0 ? 'no-match' : ''}`}>
          {matchCount === null ? '' : matchCount === 0 ? '无匹配' : `${matchIndex == null || matchIndex === -1 ? 0 : matchIndex + 1}/${matchCount}`}
        </span>
      )}
      <button
        className={`search-bar-btn ${regex ? 'active' : ''}`}
        onClick={() => setRegex(!regex)}
        title="正则表达式"
      >.*</button>
      <button
        className={`search-bar-btn ${caseSensitive ? 'active' : ''}`}
        onClick={() => setCaseSensitive(!caseSensitive)}
        title="区分大小写"
      >Aa</button>
      <button
        className={`search-bar-btn ${wholeWord ? 'active' : ''}`}
        onClick={() => setWholeWord(!wholeWord)}
        title="全词匹配"
      >W</button>
      <button className="search-bar-btn" onClick={findPrevious} title="上一个">↑</button>
      <button className="search-bar-btn" onClick={findNext} title="下一个">↓</button>
      <button className="search-bar-btn search-bar-close" onClick={onClose} title="关闭">✕</button>
    </div>
  )
}
