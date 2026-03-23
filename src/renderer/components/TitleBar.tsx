import React, { useEffect, useState } from 'react'
import './TitleBar.css'

const TitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    const cleanup = window.windowAPI.onMaximizeChange((maximized: boolean) => {
      setIsMaximized(maximized)
    })
    return () => {
      if (typeof cleanup === 'function') cleanup()
    }
  }, [])

  return (
    <div className="title-bar">
      <div className="title-bar-title">WinTerm2</div>
      <div className="title-bar-controls">
        <button className="title-bar-btn" onClick={() => window.windowAPI.minimize()}>
          ─
        </button>
        <button className="title-bar-btn" onClick={() => window.windowAPI.maximize()}>
          {isMaximized ? '⧉' : '□'}
        </button>
        <button className="title-bar-btn close" onClick={() => window.windowAPI.close()}>
          ✕
        </button>
      </div>
    </div>
  )
}

export default TitleBar
