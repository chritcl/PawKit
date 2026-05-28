# Phase 4 打包与 MVP 稳定实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** 将 PawKit MVP 做到可安装、可退出、可诊断，并完成 Windows NSIS 安装包打包验证。

**Architecture:** 使用 electron-builder 打包 Windows x64 NSIS。补齐应用图标、关于页面、版本信息、快捷键失败提示和 IPC sender 校验。此阶段以稳定性和安全收口为主，不新增大功能。

**Tech Stack:** Electron, electron-builder, TypeScript, React, Tailwind CSS。

---

## 阶段边界

必须实现：

```txt
1. electron-builder 配置
2. Windows x64 NSIS 安装包
3. resources/icon.ico
4. 关于页面展示应用版本
5. 快捷键注册失败提示
6. 退出时注销全部快捷键
7. IPC sender 校验
8. 安装版手测清单
```

禁止实现：

```txt
截图
OCR
插件系统
账号同步
自动更新下载逻辑
```

## 任务拆分

### Task 1：安装 electron-builder

**Files:**
- Modify: `pawkit/package.json`

**Steps:**

```bash
pnpm add -D electron-builder
```

增加脚本：

```json
{
  "build:win": "electron-vite build && electron-builder --win"
}
```

### Task 2：配置打包信息

**Files:**
- Modify: `pawkit/package.json`

**Implementation requirements:**

```json
{
  "build": {
    "appId": "com.pawkit.desktop",
    "productName": "PawKit",
    "directories": {
      "output": "release"
    },
    "win": {
      "target": ["nsis"],
      "icon": "resources/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    }
  }
}
```

### Task 3：补齐图标和应用元信息

**Files:**
- Create: `pawkit/resources/icon.ico`
- Modify: `pawkit/src/shared/constants.ts`
- Modify: `pawkit/src/renderer/src/pages/management/index.tsx`
- Modify: `pawkit/src/renderer/src/pages/settings/index.tsx`

**Implementation requirements:**

- 应用内显示名称：PawKit。
- 关于区域展示版本号。
- 托盘使用同一个 icon。
- 如果图标暂时不可设计，使用简洁临时图标，但文件必须存在。

### Task 4：快捷键稳定性

**Files:**
- Modify: `pawkit/src/main/shortcuts.ts`
- Modify: `pawkit/src/main/ipc/app.ts`
- Modify: `pawkit/src/preload/index.ts`

**Implementation requirements:**

- 注册失败时记录中文日志。
- 注册失败状态通过 preload 可查询。
- 退出应用时 `globalShortcut.unregisterAll()`。
- 不实现快捷键自定义。

### Task 5：IPC sender 校验

**Files:**
- Create: `pawkit/src/main/ipc/validate-sender.ts`
- Modify: `pawkit/src/main/ipc/*.ts`

**Implementation requirements:**

- 所有 IPC handler 都调用 sender 校验。
- 只允许来自应用自身 renderer 的请求。
- 校验失败时返回安全失败值，并记录中文警告。

### Task 6：打包验证

Run:

```bash
pnpm build
pnpm build:win
```

Manual check:

```txt
1. release 目录生成安装包
2. 安装后应用可以启动
3. 主窗口可以显示和隐藏
4. 托盘菜单可以打开和退出
5. Alt + Space 正常工作
6. 核心工具在安装版可用
7. 卸载后不会残留明显异常文件
```

## Claude Code 投喂提示词

```txt
请在已经完成 Phase 1-3 的 PawKit 项目基础上，只执行 docs/plans/phase-4-package-stability.md。本阶段只做打包、安全和稳定性收口，不新增截图、OCR、账号、同步、插件或自动更新。所有注释和页面文案使用中文，所有文本文件使用 UTF-8 without BOM。完成后运行 pnpm build 和 pnpm build:win，并汇报验证结果。
```
