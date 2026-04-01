# WinTerm2 升级开发计划

> 基于 [Zellij](https://github.com/zellij-org/zellij) 等优秀终端项目的功能调研，结合 WinTerm2 现有架构制定的功能演进路线。

---

## 当前版本功能概览（v1.0.2）

- 多标签页管理
- 水平/垂直嵌套分屏（平铺模式）
- 6 套内置主题 + 实时切换
- WebGL GPU 加速渲染
- 终端内搜索（正则/大小写/全词匹配）
- 窗口透明度调节
- 分屏线颜色/粗细自定义
- 自定义 Shell / 启动目录
- 快捷键体系

---

## Phase 1 — 基础体验增强（v1.0.3）

> 目标：补齐面板操作的键盘支持，提升多分屏场景下的操作效率。改动范围小，风险低。

### 1.1 面板方向键导航

- **描述**：使用 `Alt + 方向键` 在分屏面板之间快速切换焦点，无需鼠标点击
- **参考**：Zellij 的 `Alt + ←/→/↑/↓` 面板导航
- **实现要点**：
  - 在分屏树中根据当前活跃面板的位置和方向，计算相邻面板
  - 在 `keybindings/defaults.ts` 中注册 `focusLeft / focusRight / focusUp / focusDown` 四个快捷键
  - 在 `tabStore.ts` 中新增 `focusDirection(tabId, direction)` 方法
- **涉及文件**：`tabStore.ts`、`defaults.ts`、`App.tsx`

### 1.2 面板全屏/最大化

- **描述**：按快捷键将当前活跃面板临时放大为全屏，再按一次恢复原布局
- **参考**：Zellij 的 Fullscreen Pane 功能
- **实现要点**：
  - 在 `tabStore` 中记录 `maximizedPaneId`，非空时 `SplitView` 只渲染该面板
  - 快捷键 `Alt+Shift+F` 切换最大化状态
  - 最大化时在面板角落显示一个小图标提示当前处于全屏模式
- **涉及文件**：`tabStore.ts`、`SplitView.tsx`、`defaults.ts`、`App.tsx`

### 1.3 标签页/面板重命名

- **描述**：双击标签页名称可编辑，支持给面板自定义标题
- **参考**：Zellij 的 Rename Tab / Rename Pane
- **实现要点**：
  - `TabBar` 组件中双击标签触发 inline 编辑模式
  - 编辑完成后调用 `tabStore.updateTabTitle(tabId, title)`
  - 面板标题可通过右键菜单或快捷键修改
- **涉及文件**：`TabBar.tsx`、`tabStore.ts`

---

## Phase 2 — 差异化功能（v1.0.4）

> 目标：引入浮动面板和状态栏，形成与 Windows Terminal 的差异化竞争力。

### 2.1 浮动面板（Floating Panes）

- **描述**：按快捷键弹出一个浮动在主面板之上的终端窗口，可拖拽移动、调整大小，用完可隐藏
- **参考**：Zellij 的 Floating Panes（`Alt+F` 切换）
- **实现要点**：
  - 新增 `FloatingPane` 组件，使用 `position: absolute` 覆盖在 `terminal-area` 之上
  - 在 `tabStore` 中扩展数据模型，每个 Tab 维护一个 `floatingPanes: FloatingPaneState[]` 数组
  - 每个浮动面板记录 `{ id, x, y, width, height, visible, zIndex }`
  - 支持拖拽标题栏移动、拖拽边缘调整大小
  - 快捷键 `Alt+Shift+N` 新建浮动面板，`Alt+F` 切换显示/隐藏所有浮动面板
- **涉及文件**：新增 `FloatingPane.tsx`、`FloatingPane.css`，修改 `tabStore.ts`、`App.tsx`、`defaults.ts`

### 2.2 状态栏（Status Bar）

- **描述**：窗口底部显示一行状态栏，包含当前面板信息和常用快捷键提示
- **参考**：Zellij 的 Status Bar
- **实现要点**：
  - 新增 `StatusBar` 组件，固定在窗口底部
  - 左侧显示：当前会话信息（面板数量、活跃面板标题）
  - 右侧显示：上下文相关的快捷键提示（如分屏、搜索、设置）
  - 支持在设置中开关状态栏
- **涉及文件**：新增 `StatusBar.tsx`、`StatusBar.css`，修改 `App.tsx`、`App.css`、`settingsStore.ts`

### 2.3 搜索增强

- **描述**：搜索结果显示匹配计数（如 "3/15"），搜索时高亮所有匹配项
- **参考**：Zellij 的搜索滚动缓冲区 + VS Code 搜索体验
- **实现要点**：
  - 利用 xterm.js SearchAddon 的 `findNext` / `findPrevious` 返回值追踪匹配位置
  - 在 `SearchBar` 组件中显示 "当前/总数" 计数器
  - 搜索时使用 decoration API 高亮所有匹配项
- **涉及文件**：`SearchBar.tsx`、`SearchBar.css`

---

## Phase 3 — 效率工具（v1.0.5）

> 目标：面向高级用户和运维场景，提供批量操作和工作流自动化能力。

### 3.1 同步输入（Sync Input）

- **描述**：开启后，在当前面板输入的内容会同步发送到同一标签页的所有面板
- **参考**：Zellij 的 Sync Input、iTerm2 的 Broadcast Input
- **实现要点**：
  - 在 `tabStore` 中新增 `syncInput: boolean` 字段
  - 开启时，`useTerminal` 的 `onData` 回调将数据广播到同 Tab 下所有 PTY
  - 状态栏显示同步输入状态指示
  - 快捷键 `Alt+Shift+S` 切换同步输入
- **涉及文件**：`tabStore.ts`、`useTerminal.ts`、`defaults.ts`、`StatusBar.tsx`

### 3.2 命令面板（Command Palette）

- **描述**：按 `Ctrl+Shift+P` 弹出命令面板，输入关键词模糊搜索并执行命令
- **参考**：VS Code Command Palette、Zellij 的 Session Manager
- **实现要点**：
  - 新增 `CommandPalette` 组件，居中弹出，带搜索输入框
  - 注册所有可用命令（新建标签、分屏、切换主题、打开设置等）
  - 支持模糊匹配，显示命令名称和对应快捷键
  - 回车执行选中命令，Escape 关闭
- **涉及文件**：新增 `CommandPalette.tsx`、`CommandPalette.css`，修改 `App.tsx`、`defaults.ts`

### 3.3 布局预设（Layout Presets）

- **描述**：提供几种常用布局模板，一键应用到当前标签页
- **参考**：Zellij 的 Layout System
- **实现要点**：
  - 预定义布局：双栏（50/50）、三栏（33/33/33）、主+侧栏（70/30）、田字格（2x2）
  - 可通过命令面板或快捷键选择布局
  - 应用布局时自动创建对应的分屏结构和终端实例
- **涉及文件**：新增 `layouts.ts`，修改 `tabStore.ts`、`CommandPalette.tsx`

---

## Phase 4 — 高级功能（v1.0.6）

> 目标：实现会话持久化和智能终端交互，向专业级终端工具迈进。

### 4.1 会话保存与恢复

- **描述**：关闭应用时保存当前所有标签页和分屏布局，重新打开时恢复
- **参考**：Zellij 的 Session Resurrection
- **实现要点**：
  - 关闭前将 `tabStore` 的完整面板树结构序列化到 localStorage 或文件
  - 保存每个面板的工作目录（通过 PTY 查询 cwd）
  - 启动时读取保存的布局，重建面板树并为每个面板创建新的 PTY
  - 注意：终端历史内容无法恢复，仅恢复布局结构和工作目录
- **涉及文件**：`tabStore.ts`、`App.tsx`、`main/index.ts`、`ptyManager.ts`

### 4.2 点击打开文件路径

- **描述**：终端输出中的文件路径可点击，使用系统默认编辑器打开
- **参考**：Zellij 的 Click to Open File Path、VS Code Terminal 的链接检测
- **实现要点**：
  - 使用 xterm.js 的 `registerLinkProvider` API
  - 正则匹配常见路径格式（绝对路径、相对路径、带行号的路径如 `file.ts:42`）
  - 点击后通过 IPC 调用主进程的 `shell.openPath()` 打开文件
  - 悬停时显示下划线和提示
- **涉及文件**：`useTerminal.ts`、`main/index.ts`、`preload/index.ts`

### 4.3 右键上下文菜单

- **描述**：右键点击终端区域弹出上下文菜单，提供复制、粘贴、分屏、搜索等常用操作
- **实现要点**：
  - 新增 `ContextMenu` 组件
  - 根据当前状态动态生成菜单项（有选中文本时显示"复制"，否则灰显）
  - 菜单项包括：复制、粘贴、搜索、水平分屏、垂直分屏、关闭面板、全屏、重命名
- **涉及文件**：新增 `ContextMenu.tsx`、`ContextMenu.css`，修改 `TerminalPane.tsx`

---

## 优先级总览

| 优先级 | 功能 | 版本 | 复杂度 |
|--------|------|------|--------|
| P0 | 面板方向键导航 | v1.0.3 | ★☆☆☆☆ |
| P0 | 面板全屏/最大化 | v1.0.3 | ★★☆☆☆ |
| P0 | 标签页/面板重命名 | v1.0.3 | ★★☆☆☆ |
| P1 | 浮动面板 | v1.0.4 | ★★★★☆ |
| P1 | 状态栏 | v1.0.4 | ★★☆☆☆ |
| P1 | 搜索增强 | v1.0.4 | ★★☆☆☆ |
| P2 | 同步输入 | v1.0.5 | ★★★☆☆ |
| P2 | 命令面板 | v1.0.5 | ★★★☆☆ |
| P2 | 布局预设 | v1.0.5 | ★★★☆☆ |
| P3 | 会话保存与恢复 | v1.0.6 | ★★★★☆ |
| P3 | 点击打开文件路径 | v1.0.6 | ★★★☆☆ |
| P3 | 右键上下文菜单 | v1.0.6 | ★★★☆☆ |

---

## 参考资料

- [Zellij 功能介绍](https://zellij.dev/features/)
- [Zellij 基础教程](https://zellij.dev/tutorials/basic-functionality/)
- [Zellij GitHub](https://github.com/zellij-org/zellij)
- [xterm.js API 文档](https://xtermjs.org/docs/api/terminal/)
