import React, { useState, useRef, useEffect } from 'react'
import { useTabStore } from '../store/tabStore'
import './TabBar.css'

const TabBar: React.FC = () => {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab, renameTab } = useTabStore()
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingTabId])

  const startEdit = (tabId: string, title: string) => {
    setEditingTabId(tabId)
    setEditValue(title)
  }

  const commitEdit = () => {
    if (editingTabId) {
      renameTab(editingTabId, editValue)
      setEditingTabId(null)
    }
  }

  const cancelEdit = () => {
    setEditingTabId(null)
  }

  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          {editingTabId === tab.id ? (
            <input
              ref={inputRef}
              className="tab-title-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit()
                else if (e.key === 'Escape') cancelEdit()
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="tab-title"
              onDoubleClick={(e) => {
                e.stopPropagation()
                startEdit(tab.id, tab.title)
              }}
            >
              {tab.title}
            </span>
          )}
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation()
              removeTab(tab.id)
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button className="tab-add" onClick={addTab}>
        +
      </button>
    </div>
  )
}

export default TabBar
