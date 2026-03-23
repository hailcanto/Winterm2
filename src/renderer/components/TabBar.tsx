import React from 'react'
import { useTabStore } from '../store/tabStore'
import './TabBar.css'

const TabBar: React.FC = () => {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab } = useTabStore()

  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          <span className="tab-title">{tab.title}</span>
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
