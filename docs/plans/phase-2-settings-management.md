# Phase 2 本地配置与管理中心基础实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** 在 Phase 1 工程壳基础上接入本地配置存储，实现设置页、管理中心应用概览、工具管理和数据管理基础能力。

**Architecture:** 主进程通过 electron-store 封装 typed setting service，preload 暴露 setting API，renderer 通过 Zustand 同步本地配置。管理中心只处理本地配置和统计信息，不接入账号、同步、插件或自动更新。

**Tech Stack:** Electron, TypeScript, electron-store, React, Zustand, Tailwind CSS, shadcn/ui。

---

## 阶段边界

必须实现：

```txt
1. 接入 electron-store
2. 封装 typed setting service
3. 保存主题配置
4. 保存窗口尺寸
5. 保存启用工具列表
6. 保存工具排序
7. 保存快捷键默认配置
8. 管理中心应用概览
9. 工具管理基础页
10. 数据管理基础页
11. 设置页主题切换
```

禁止实现：

```txt
真实剪贴板历史
截图
账号登录
云同步
插件系统
自动更新下载安装
快捷键自定义编辑
```

## 数据结构

本阶段本地存储默认结构：

```json
{
  "clipboard": {
    "history": []
  },
  "color": {
    "favorites": [],
    "recent": []
  },
  "app": {
    "theme": "dark",
    "shortcuts": {
      "toggleWindow": "Alt+Space",
      "clipboard": "Alt+V",
      "screenshot": "Alt+A",
      "color": "Alt+C"
    },
    "windowBounds": null,
    "enabledTools": ["clipboard", "color", "json", "timestamp"]
  },
  "management": {
    "toolOrder": ["clipboard", "color", "json", "timestamp"],
    "autoUpdate": false,
    "lastCheckUpdateTime": null
  }
}
```

## 任务拆分

### Task 1：安装和封装 electron-store

**Files:**
- Modify: `pawkit/package.json`
- Create or Modify: `pawkit/src/main/store.ts`
- Modify: `pawkit/src/shared/types.ts`

**Steps:**

1. 安装依赖：

```bash
pnpm add electron-store
```

2. 定义 `AppSettings`、`ShortcutSettings`、`ManagementSettings` 类型。
3. 在 `src/main/store.ts` 创建单例 store，并提供：

```txt
getSetting(key)
setSetting(key, value)
getAllSettings()
resetSettings()
```

4. 不使用 `any`，必要时使用 `unknown` 和显式类型守卫。

### Task 2：实现 setting IPC

**Files:**
- Modify: `pawkit/src/main/ipc/setting.ts`
- Modify: `pawkit/src/shared/ipc-channels.ts`
- Modify: `pawkit/src/preload/index.ts`
- Modify: `pawkit/src/renderer/src/types/electron.d.ts`

**Steps:**

1. 将 Phase 1 的 setting 占位实现替换为 electron-store 实现。
2. 增加以下 API：

```ts
setting.get<T>(key: string): Promise<T | null>
setting.set(key: string, value: unknown): Promise<boolean>
setting.getAll(): Promise<AppSettings>
setting.reset(): Promise<boolean>
```

3. IPC channel 仍然使用白名单常量。
4. preload 不直接暴露 ipcRenderer。

### Task 3：保存窗口尺寸

**Files:**
- Modify: `pawkit/src/main/window.ts`
- Modify: `pawkit/src/main/store.ts`

**Steps:**

1. 创建窗口时读取 `app.windowBounds`。
2. 窗口 resize / move 后保存 bounds。
3. 如果没有保存过 bounds，使用默认 960 x 680。
4. 保存前校验 bounds 中的 width / height / x / y 是数字。

### Task 4：主题配置

**Files:**
- Modify: `pawkit/src/renderer/src/stores/app-store.ts`
- Modify: `pawkit/src/renderer/src/App.tsx`
- Modify: `pawkit/src/renderer/src/styles/index.css`
- Modify: `pawkit/src/renderer/src/pages/settings/index.tsx`

**Steps:**

1. 启动时从 `setting.get('app.theme')` 读取主题。
2. 设置页提供暗色 / 浅色切换。
3. 切换主题后写入 `setting.set('app.theme', theme)`。
4. 毛玻璃视觉在暗色和浅色下都保持可读性。

### Task 5：工具管理基础页

**Files:**
- Modify: `pawkit/src/renderer/src/pages/management/index.tsx`
- Create: `pawkit/src/renderer/src/pages/management/tool-manage.tsx`
- Modify: `pawkit/src/renderer/src/utils/tool-registry.ts`

**Steps:**

1. 展示所有工具名称、阶段、启用状态。
2. 支持启用 / 禁用工具。
3. 禁用工具后左侧菜单隐藏该工具，但首页、管理中心、设置不能被禁用。
4. 保存到 `app.enabledTools`。
5. 工具排序只保存基础数组，不实现拖拽。

### Task 6：应用概览和数据管理

**Files:**
- Create: `pawkit/src/renderer/src/pages/management/dashboard.tsx`
- Create: `pawkit/src/renderer/src/pages/management/data-manage.tsx`
- Modify: `pawkit/src/renderer/src/pages/management/index.tsx`

**Steps:**

1. 应用概览展示：应用版本、当前主题、启用工具数量、快捷键状态、本地数据项数量。
2. 数据管理展示：剪贴板历史数量、颜色收藏数量、最近颜色数量。
3. 提供重置配置按钮。
4. 重置需要二次确认。
5. 不实现导入 / 导出，保留远期占位。

### Task 7：验证

Run:

```bash
pnpm build
```

Manual check:

```txt
1. 设置主题后重启仍然保持
2. 调整窗口尺寸后重启仍然保持
3. 工具启用状态可以保存
4. 管理中心统计信息能显示
5. 重置配置后恢复默认值
```

## Claude Code 投喂提示词

```txt
请在已经完成 Phase 1 的 PawKit 项目基础上，只执行 docs/plans/phase-2-settings-management.md。不要实现真实工具能力、账号、同步、插件或自动更新。所有注释和页面文案使用中文，所有文本文件使用 UTF-8 without BOM。完成后运行 pnpm build，并汇报验证结果。
```
