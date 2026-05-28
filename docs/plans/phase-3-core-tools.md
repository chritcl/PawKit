# Phase 3 核心离线工具实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** 实现 PawKit MVP 的四个核心离线工具：剪贴板文本历史、JSON 工具、时间戳工具和调色板。

**Architecture:** Electron 原生能力仍然在 main 和 preload 中完成，renderer 只调用 preload API。纯函数能力放在 renderer utils，并补基础单元测试。剪贴板历史使用 electron-store 本地持久化，工具页面沿用 Phase 1/2 的毛玻璃 UI 体系。

**Tech Stack:** Electron, TypeScript, electron-store, React, Zustand, Tailwind CSS, dayjs, nanoid。

---

## 阶段边界

必须实现：

```txt
1. 剪贴板文本历史
2. JSON 格式化 / 压缩 / 校验
3. 时间戳转换
4. HEX / RGB / HSL 颜色转换
5. 颜色收藏和最近颜色
```

禁止实现：

```txt
图片剪贴板历史
截图
OCR
账号同步
插件系统
自动更新
```

## 任务拆分

### Task 1：剪贴板 IPC 与数据结构

**Files:**
- Modify: `pawkit/src/shared/types.ts`
- Modify: `pawkit/src/shared/ipc-channels.ts`
- Create: `pawkit/src/main/ipc/clipboard.ts`
- Modify: `pawkit/src/main/ipc/index.ts`
- Modify: `pawkit/src/preload/index.ts`
- Modify: `pawkit/src/renderer/src/types/electron.d.ts`

**Implementation requirements:**

```ts
export interface ClipboardItem {
  id: string
  type: 'text' | 'image'
  content: string
  favorite: boolean
  createdAt: string
}
```

preload 暴露：

```txt
clipboard.readText
clipboard.writeText
clipboard.getHistory
clipboard.clearHistory
clipboard.removeItem
clipboard.toggleFavorite
```

### Task 2：剪贴板轮询和持久化

**Files:**
- Create: `pawkit/src/main/clipboard-service.ts`
- Modify: `pawkit/src/main/store.ts`
- Modify: `pawkit/src/main/index.ts`

**Implementation requirements:**

```txt
最大保存数量：200 条
轮询间隔：800ms
忽略空文本
忽略重复文本
超过最大数量时删除最旧记录
收藏内容不自动删除
```

说明：

- 只处理文本剪贴板。
- 写入剪贴板时避免马上重复记录。
- 应用退出时停止轮询。

### Task 3：剪贴板页面

**Files:**
- Modify: `pawkit/src/renderer/src/stores/clipboard-store.ts`
- Modify: `pawkit/src/renderer/src/pages/tools/clipboard/index.tsx`

**Implementation requirements:**

```txt
顶部搜索框
清空按钮
历史列表
收藏标记
复制按钮
删除按钮
创建时间
内容预览
```

交互要求：

- 点击复制后写回系统剪贴板。
- 删除单条后刷新列表。
- 清空前需要二次确认。
- 收藏项在列表中有明显标记。

### Task 4：JSON 工具纯函数和页面

**Files:**
- Modify: `pawkit/src/renderer/src/utils/json.ts`
- Modify: `pawkit/src/renderer/src/pages/tools/json-tool/index.tsx`
- Test: `pawkit/src/renderer/src/utils/json.test.ts`

**Implementation requirements:**

```txt
JSON 格式化
JSON 压缩
JSON 校验
错误提示
一键复制
清空
示例填充
```

格式化规则：

```txt
缩进：2 个空格
保持中文不转义
错误时尽量展示错误位置和错误信息
```

### Task 5：时间戳工具

**Files:**
- Modify: `pawkit/src/renderer/src/utils/date.ts`
- Modify: `pawkit/src/renderer/src/pages/tools/timestamp-tool/index.tsx`
- Test: `pawkit/src/renderer/src/utils/date.test.ts`

**Implementation requirements:**

```txt
当前时间展示
秒级时间戳
毫秒级时间戳
时间戳转日期
日期转时间戳
一键复制
自动刷新当前时间
```

默认格式：

```txt
YYYY-MM-DD HH:mm:ss
```

### Task 6：调色板工具

**Files:**
- Modify: `pawkit/src/renderer/src/utils/color.ts`
- Modify: `pawkit/src/renderer/src/pages/tools/color-picker/index.tsx`
- Test: `pawkit/src/renderer/src/utils/color.test.ts`

**Implementation requirements:**

```ts
hexToRgb(hex: string): RGB
rgbToHex(r: number, g: number, b: number): string
rgbToHsl(r: number, g: number, b: number): HSL
hslToRgb(h: number, s: number, l: number): RGB
isValidHex(hex: string): boolean
```

页面要求：

```txt
HEX 输入
RGB 输入
HSL 输入
颜色预览
一键复制颜色值
生成 CSS 变量
收藏颜色
最近颜色记录
```

### Task 7：验证

Run:

```bash
pnpm build
```

如果配置了测试脚本，运行：

```bash
pnpm test
```

Manual check:

```txt
1. 剪贴板文本可以自动记录
2. 重复文本不会重复保存
3. 剪贴板历史可以搜索、复制、删除、清空、收藏
4. JSON 工具可以格式化、压缩、校验
5. 时间戳可以双向转换
6. 颜色格式可以互转
7. 异常输入都有中文提示
```

## Claude Code 投喂提示词

```txt
请在已经完成 Phase 1 和 Phase 2 的 PawKit 项目基础上，只执行 docs/plans/phase-3-core-tools.md。不要实现截图、OCR、账号、同步、插件或自动更新。所有注释和页面文案使用中文，所有文本文件使用 UTF-8 without BOM。完成后运行 pnpm build 和可用测试，并汇报验证结果。
```
