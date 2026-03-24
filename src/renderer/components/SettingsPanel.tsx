import React from 'react'
import { useSettingsStore } from '../store/settingsStore'
import { useThemeStore } from '../store/themeStore'
import { keybindingManager } from '../keybindings/manager'
import './SettingsPanel.css'

interface SettingsPanelProps {
  visible: boolean
  onClose: () => void
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ visible, onClose }) => {
  const settings = useSettingsStore()
  const { themes, currentTheme, setTheme } = useThemeStore()

  if (!visible) return null

  const keybindings = keybindingManager.getKeybindings()

  return (
    <>
      <div className="settings-overlay" onClick={onClose} />
      <div className="settings-panel">
        <div className="settings-header">
          <h2>设置</h2>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>
        <div className="settings-body">
          <div className="settings-section">
            <h3>外观</h3>
            <div className="settings-row">
              <span className="settings-label">主题</span>
              <select
                className="settings-select"
                value={currentTheme.name}
                onChange={e => {
                  setTheme(e.target.value)
                  settings.updateSettings({ themeName: e.target.value })
                }}
              >
                {themes.map(t => (
                  <option key={t.name} value={t.name}>{t.displayName}</option>
                ))}
              </select>
            </div>
            <div className="settings-row">
              <span className="settings-label">字体</span>
              <input
                className="settings-input"
                value={settings.fontFamily}
                onChange={e => settings.updateSettings({ fontFamily: e.target.value })}
              />
            </div>
            <div className="settings-row">
              <span className="settings-label">字号</span>
              <input
                className="settings-input"
                type="number"
                min={8}
                max={32}
                value={settings.fontSize}
                onChange={e => settings.updateSettings({ fontSize: Number(e.target.value) })}
              />
            </div>
            <div className="settings-row">
              <span className="settings-label">行高</span>
              <input
                className="settings-input"
                type="number"
                min={1}
                max={2}
                step={0.1}
                value={settings.lineHeight}
                onChange={e => settings.updateSettings({ lineHeight: Number(e.target.value) })}
              />
            </div>
            <div className="settings-row">
              <span className="settings-label">光标样式</span>
              <select
                className="settings-select"
                value={settings.cursorStyle}
                onChange={e => settings.updateSettings({ cursorStyle: e.target.value as 'block' | 'underline' | 'bar' })}
              >
                <option value="block">方块</option>
                <option value="underline">下划线</option>
                <option value="bar">竖线</option>
              </select>
            </div>
            <div className="settings-row">
              <span className="settings-label">光标闪烁</span>
              <input
                className="settings-checkbox"
                type="checkbox"
                checked={settings.cursorBlink}
                onChange={e => settings.updateSettings({ cursorBlink: e.target.checked })}
              />
            </div>
            <div className="settings-row">
              <span className="settings-label">透明度</span>
              <input
                className="settings-range"
                type="range"
                min={0.5}
                max={1}
                step={0.05}
                value={settings.opacity}
                onChange={e => settings.updateSettings({ opacity: Number(e.target.value) })}
              />
            </div>
            <div className="settings-row">
              <span className="settings-label">分屏线颜色</span>
              <div className="divider-color-group">
                {['#ff8c00', '#00bfff', '#00e676', '#ff4081', '#ab47bc', '#ffeb3b', '#78909c', '#ffffff'].map(c => (
                  <button
                    key={c}
                    className={`divider-color-swatch${settings.dividerColor === c ? ' active' : ''}`}
                    style={{ background: c }}
                    onClick={() => settings.updateSettings({ dividerColor: c })}
                  />
                ))}
                <input
                  type="color"
                  value={settings.dividerColor}
                  onChange={e => settings.updateSettings({ dividerColor: e.target.value })}
                  className="divider-color-picker"
                />
              </div>
            </div>
            <div className="settings-row">
              <span className="settings-label">分屏线粗细</span>
              <div className="divider-width-group">
                <input
                  className="settings-range"
                  type="range"
                  min={1}
                  max={8}
                  step={1}
                  value={settings.dividerWidth}
                  onChange={e => settings.updateSettings({ dividerWidth: Number(e.target.value) })}
                />
                <span className="divider-width-value">{settings.dividerWidth}px</span>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3>终端</h3>
            <div className="settings-row">
              <span className="settings-label">默认 Shell</span>
              <input
                className="settings-input"
                value={settings.defaultShell}
                placeholder="自动检测"
                onChange={e => settings.updateSettings({ defaultShell: e.target.value })}
              />
            </div>
            <div className="settings-row">
              <span className="settings-label">滚动缓冲区</span>
              <input
                className="settings-input"
                type="number"
                min={1000}
                max={100000}
                step={1000}
                value={settings.scrollback}
                onChange={e => settings.updateSettings({ scrollback: Number(e.target.value) })}
              />
            </div>
            <div className="settings-row">
              <span className="settings-label">启动目录</span>
              <input
                className="settings-input"
                value={settings.startupCwd}
                placeholder="用户主目录"
                onChange={e => settings.updateSettings({ startupCwd: e.target.value })}
              />
            </div>
          </div>

          <div className="settings-section">
            <h3>快捷键</h3>
            <ul className="keybinding-list">
              {keybindings.map(kb => (
                <li key={kb.id} className="keybinding-item">
                  <span>{kb.label}</span>
                  <span className="keybinding-key">{kb.keys}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  )
}
