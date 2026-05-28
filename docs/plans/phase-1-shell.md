# Phase 1 基础工程壳实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** 创建 PawKit 的 Electron + React + TypeScript 基础工程壳，完成窗口、托盘、快捷键、preload API、基础布局和页面占位。

**Architecture:** 使用 electron-vite 官方脚手架创建项目。主进程负责窗口、托盘、快捷键和 IPC；preload 只暴露白名单 API；renderer 使用 React + Zustand + Tailwind 实现苹果式毛玻璃布局；shared 存放跨进程类型、常量和 IPC channel。

**Tech Stack:** Electron, React, Vite, TypeScript, Zustand, Tailwind CSS, shadcn/ui, lucide-react, electron-vite。

---

## 阶段边界

本阶段只做基础工程壳，不实现真实工具能力。

必须实现：

```txt
1. Electron + React + TypeScript 项目基础架构
2. Tailwind CSS 配置
3. shadcn/ui 基础配置
4. 主窗口
5. 系统托盘
6. Alt + Space 显示 / 隐藏窗口
7. preload API 基础结构
8. src/shared 类型和 IPC channel
9. Zustand app-store
10. 苹果式毛玻璃基础布局
11. 首页、管理中心、设置、剪贴板、调色板、截图、JSON、时间戳、Base64 页面占位
```

禁止实现：

```txt
剪贴板历史
JSON 格式化
颜色转换
时间戳转换
截图
账号
云同步
插件
自动更新
```

## 任务拆分

### Task 1：初始化项目

**Files:**
- Create: `pawkit/`
- Create: `pawkit/package.json`
- Create: `pawkit/electron.vite.config.ts`

**Steps:**

1. 在项目父目录执行：

```bash
pnpm create @quick-start/electron pawkit --template react-ts
```

2. 如果出现脚手架交互：

```txt
Add Electron updater plugin? 选择 No
Enable Electron download mirror proxy? 默认 No，除非当前网络必须使用镜像
```

3. 进入项目并安装依赖：

```bash
cd pawkit
pnpm install
pnpm add zustand clsx tailwind-merge lucide-react
pnpm add tailwindcss @tailwindcss/vite
pnpm add -D prettier
```

4. 验证：

```bash
pnpm dev
```

Expected: Electron 应用可以启动。

### Task 2：配置 Tailwind 与 shadcn/ui

**Files:**
- Modify: `pawkit/electron.vite.config.ts`
- Modify: `pawkit/src/renderer/src/styles/index.css`
- Create or Modify: `pawkit/components.json`

**Steps:**

1. 在 renderer 的 Vite 配置中接入 `@tailwindcss/vite`。
2. CSS 入口使用：

```css
@import "tailwindcss";
```

3. 初始化 shadcn/ui：

```bash
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button input tooltip separator scroll-area
```

4. 验证：

```bash
pnpm build
```

Expected: 构建通过。

### Task 3：创建 shared 类型和 IPC channel

**Files:**
- Create: `pawkit/src/shared/constants.ts`
- Create: `pawkit/src/shared/ipc-channels.ts`
- Create: `pawkit/src/shared/types.ts`

**Implementation requirements:**

- `constants.ts` 定义应用名、默认窗口尺寸、默认快捷键、工具 ID。
- `ipc-channels.ts` 定义 app 和 setting 的 channel 常量。
- `types.ts` 定义 `ToolId`、`ToolMeta`、`ElectronAPI`、`AppTheme`。
- 不要使用 `any`。

### Task 4：实现主窗口

**Files:**
- Modify: `pawkit/src/main/index.ts`
- Create: `pawkit/src/main/window.ts`

**Implementation requirements:**

- 默认尺寸：960 x 680。
- 最小尺寸：800 x 560。
- `contextIsolation: true`。
- `nodeIntegration: false`。
- `sandbox: false`。
- 关闭窗口时隐藏到托盘，不退出应用。
- 支持 `showWindow`、`hideWindow`、`toggleWindow`。

### Task 5：实现托盘

**Files:**
- Create: `pawkit/src/main/tray.ts`
- Modify: `pawkit/src/main/index.ts`

**Implementation requirements:**

- 托盘菜单包含：打开 PawKit、显示 / 隐藏、退出。
- 单击托盘图标显示 / 隐藏窗口。
- 退出时设置 `isQuitting`，避免关闭事件继续隐藏窗口。
- 如果 `resources/icon.ico` 暂不存在，使用 Electron 空图标或临时 nativeImage，避免 Phase 1 阻塞。

### Task 6：实现全局快捷键

**Files:**
- Create: `pawkit/src/main/shortcuts.ts`
- Modify: `pawkit/src/main/index.ts`

**Implementation requirements:**

- 注册 `Alt+Space`。
- 触发后调用 `toggleWindow`。
- 应用退出时注销全部快捷键。
- 注册失败时打印中文警告日志。

### Task 7：实现 IPC 和 preload API

**Files:**
- Create: `pawkit/src/main/ipc/index.ts`
- Create: `pawkit/src/main/ipc/app.ts`
- Create: `pawkit/src/main/ipc/setting.ts`
- Modify: `pawkit/src/preload/index.ts`
- Create: `pawkit/src/preload/types.ts`
- Create: `pawkit/src/renderer/src/types/electron.d.ts`

**Implementation requirements:**

- preload 只暴露：

```ts
window.electronAPI.app.showWindow()
window.electronAPI.app.hideWindow()
window.electronAPI.app.toggleWindow()
window.electronAPI.app.quit()
window.electronAPI.setting.get(key)
window.electronAPI.setting.set(key, value)
```

- 不要暴露 `ipcRenderer`。
- `setting.get/set` 本阶段可以返回内存占位结果，Phase 2 再接入 electron-store。

### Task 8：实现渲染层状态和工具注册

**Files:**
- Create: `pawkit/src/renderer/src/stores/app-store.ts`
- Create: `pawkit/src/renderer/src/utils/tool-registry.ts`
- Modify: `pawkit/src/renderer/src/App.tsx`

**Implementation requirements:**

- 使用 Zustand 管理 `activeTool` 和 `theme`。
- 使用 `ToolRegistry` 定义工具菜单。
- 本阶段不引入 React Router。

### Task 9：实现苹果式毛玻璃布局

**Files:**
- Create: `pawkit/src/renderer/src/components/layout/app-shell.tsx`
- Create: `pawkit/src/renderer/src/components/layout/sidebar.tsx`
- Create: `pawkit/src/renderer/src/components/layout/title-bar.tsx`
- Create: `pawkit/src/renderer/src/components/layout/status-bar.tsx`
- Modify: `pawkit/src/renderer/src/styles/index.css`

**Implementation requirements:**

- 左侧菜单 + 顶部标题栏 + 内容区 + 底部状态栏。
- 使用 `backdrop-blur-xl` 或 `backdrop-blur-2xl`。
- 使用半透明背景和细边框。
- 卡片圆角不超过 8px。
- 不做营销页式 Hero。
- 不使用装饰性渐变球或光斑。

### Task 10：创建页面占位

**Files:**
- Create: `pawkit/src/renderer/src/pages/home/index.tsx`
- Create: `pawkit/src/renderer/src/pages/management/index.tsx`
- Create: `pawkit/src/renderer/src/pages/settings/index.tsx`
- Create: `pawkit/src/renderer/src/pages/tools/clipboard/index.tsx`
- Create: `pawkit/src/renderer/src/pages/tools/color-picker/index.tsx`
- Create: `pawkit/src/renderer/src/pages/tools/screenshot/index.tsx`
- Create: `pawkit/src/renderer/src/pages/tools/json-tool/index.tsx`
- Create: `pawkit/src/renderer/src/pages/tools/timestamp-tool/index.tsx`
- Create: `pawkit/src/renderer/src/pages/tools/base64-tool/index.tsx`

**Implementation requirements:**

- 每个页面使用中文标题。
- 每个页面说明当前阶段只做占位。
- 每个页面列出后续阶段要实现的能力。

### Task 11：验证

Run:

```bash
pnpm build
```

如果有 lint 脚本，再运行：

```bash
pnpm lint
```

Manual check:

```txt
1. pnpm dev 可以启动应用
2. 主窗口尺寸正确
3. 关闭窗口后隐藏到托盘
4. 托盘菜单可以打开和退出
5. Alt + Space 可以显示 / 隐藏窗口
6. 左侧菜单可以切换页面占位
7. 渲染进程没有直接访问 Node.js
```

## Claude Code 投喂提示词

```txt
请只执行 docs/plans/phase-1-shell.md 中的 Phase 1。不要实现后续阶段功能。所有注释和页面文案使用中文，所有文本文件使用 UTF-8 without BOM。完成后运行 pnpm build，并汇报验证结果。
```
