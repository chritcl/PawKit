# Phase 5 截图与扩展工具实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** 在 PawKit MVP 稳定后，补充截图、屏幕取色、Base64、URL 编解码和二维码生成等扩展工具。

**Architecture:** 截图能力通过 Electron main 进程调用 desktopCapturer、clipboard、nativeImage 等原生能力，renderer 只负责预览和交互。编码转换和二维码属于纯前端工具，优先放在 renderer utils 并补基础测试。

**Tech Stack:** Electron, TypeScript, React, Tailwind CSS, desktopCapturer, clipboard, nativeImage。

---

## 阶段边界

必须实现：

```txt
1. 全屏截图
2. 截图预览
3. 截图复制到剪贴板
4. 截图保存到本地
5. 区域截图
6. 屏幕取色
7. Base64 编解码
8. URL 编解码
9. 二维码生成
```

禁止实现：

```txt
截图标注
贴图置顶
OCR
插件系统
账号同步
自动更新
```

## 任务拆分

### Task 1：截图 IPC 基础

**Files:**
- Modify: `pawkit/src/shared/ipc-channels.ts`
- Modify: `pawkit/src/shared/types.ts`
- Create: `pawkit/src/main/ipc/screenshot.ts`
- Modify: `pawkit/src/main/ipc/index.ts`
- Modify: `pawkit/src/preload/index.ts`
- Modify: `pawkit/src/renderer/src/types/electron.d.ts`

**Implementation requirements:**

preload 暴露：

```txt
screenshot.captureFullScreen
screenshot.copyImageToClipboard
screenshot.saveImage
```

返回值使用明确类型，例如：

```ts
interface ScreenshotResult {
  dataUrl: string
  width: number
  height: number
  createdAt: string
}
```

### Task 2：全屏截图和预览

**Files:**
- Create: `pawkit/src/main/screenshot-service.ts`
- Modify: `pawkit/src/renderer/src/pages/tools/screenshot/index.tsx`

**Implementation requirements:**

- 使用 `desktopCapturer.getSources` 获取屏幕源。
- 支持当前主屏截图。
- 在截图页面展示预览。
- 预览区域保持毛玻璃风格，但图片本身不能被模糊影响。

### Task 3：复制和保存截图

**Files:**
- Modify: `pawkit/src/main/screenshot-service.ts`
- Modify: `pawkit/src/main/ipc/screenshot.ts`
- Modify: `pawkit/src/renderer/src/pages/tools/screenshot/index.tsx`

**Implementation requirements:**

- 复制到剪贴板使用 Electron clipboard。
- 保存到本地使用系统保存对话框。
- 只允许保存 png。
- 用户取消保存时返回取消状态，不报错。

### Task 4：区域截图

**Files:**
- Create: `pawkit/src/main/screenshot-window.ts`
- Create: `pawkit/src/renderer/src/pages/tools/screenshot/capture-overlay.tsx`
- Modify: `pawkit/src/main/ipc/screenshot.ts`

**Implementation requirements:**

```txt
1. 创建全屏透明截图窗口
2. 鼠标拖拽选择区域
3. Canvas 裁剪图片
4. ESC 取消截图
5. Enter 确认截图
```

注意：

- 先支持单屏，后续再扩展多屏。
- 高 DPI 下需要校验截图坐标。

### Task 5：屏幕取色

**Files:**
- Create: `pawkit/src/main/color-picker-service.ts`
- Modify: `pawkit/src/main/ipc/screenshot.ts`
- Modify: `pawkit/src/renderer/src/pages/tools/color-picker/index.tsx`

**Implementation requirements:**

- 从截图像素中读取颜色。
- 取色结果写入最近颜色。
- 支持复制 HEX。

### Task 6：Base64 与 URL 编解码

**Files:**
- Create or Modify: `pawkit/src/renderer/src/utils/format.ts`
- Modify: `pawkit/src/renderer/src/pages/tools/base64-tool/index.tsx`
- Test: `pawkit/src/renderer/src/utils/format.test.ts`

**Implementation requirements:**

```txt
Base64 编码
Base64 解码
URL encode
URL decode
异常输入中文提示
一键复制
清空
```

### Task 7：二维码生成

**Files:**
- Modify: `pawkit/package.json`
- Create: `pawkit/src/renderer/src/pages/tools/qrcode-tool/index.tsx`
- Modify: `pawkit/src/renderer/src/utils/tool-registry.ts`

**Implementation requirements:**

- 使用成熟二维码库，不手写二维码算法。
- 支持输入文本并生成二维码。
- 支持复制二维码图片或保存图片。
- 如果保存图片需要 Electron 能力，必须通过 preload。

### Task 8：验证

Run:

```bash
pnpm build
```

Manual check:

```txt
1. 全屏截图可以生成预览
2. 截图可以复制到剪贴板
3. 截图可以保存为 png
4. 区域截图支持 ESC 取消和 Enter 确认
5. 取色可以返回正确 HEX
6. Base64 和 URL 编解码可用
7. 二维码可以生成
```

## Claude Code 投喂提示词

```txt
请在已经完成 Phase 1-4 的 PawKit 项目基础上，只执行 docs/plans/phase-5-screenshot-extended-tools.md。本阶段实现截图和扩展工具，不实现截图标注、贴图置顶、OCR、账号、同步、插件或自动更新。所有注释和页面文案使用中文，所有文本文件使用 UTF-8 without BOM。完成后运行 pnpm build 和可用测试，并汇报验证结果。
```
