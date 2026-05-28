# Phase 6 远期增强能力实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** 在 PawKit 已经具备 MVP 和扩展工具能力后，按独立子项目逐步实现截图标注、贴图置顶、OCR、命令面板、快捷键自定义、插件系统、自动更新和账号同步。

**Architecture:** Phase 6 不应该一次性全部实现。每个增强能力都需要先写单独设计文档，再拆独立实施计划。优先顺序建议为命令面板、快捷键自定义、截图标注、OCR、自动更新、插件系统、账号同步。

**Tech Stack:** Electron, React, TypeScript, Zustand, Tailwind CSS, electron-updater, OCR provider, plugin sandbox design。

---

## 阶段原则

```txt
1. 每个远期能力单独开文档、单独开发、单独验收。
2. 不要在同一次 Claude Code 会话中混做多个大能力。
3. 优先实现离线能力，再考虑云端能力。
4. 插件和账号同步必须先做安全设计，不允许直接执行任意第三方代码。
5. OCR 如果使用云服务，必须明确隐私提示和开关。
```

## 推荐实施顺序

```txt
1. 工具搜索命令面板
2. 快捷键自定义和冲突检测
3. 截图标注
4. 截图贴图置顶
5. OCR 文字识别
6. 自动更新
7. 插件系统
8. 账号与云同步
```

## 子计划 1：工具搜索命令面板

**Goal:** 提供类似 Raycast / uTools 的快速搜索入口。

**Scope:**

```txt
1. 全局快捷键打开命令面板
2. 搜索工具名称
3. 搜索最近使用工具
4. 回车打开工具
5. 支持键盘上下选择
```

**Files:**
- Modify: `pawkit/src/renderer/src/utils/tool-registry.ts`
- Create: `pawkit/src/renderer/src/components/command-palette/index.tsx`
- Modify: `pawkit/src/renderer/src/App.tsx`
- Modify: `pawkit/src/main/shortcuts.ts`

**Acceptance:**

```txt
1. 命令面板可以快速打开
2. 搜索结果准确
3. 全键盘可用
4. 不影响 Alt + Space 主窗口快捷键
```

## 子计划 2：快捷键自定义和冲突检测

**Goal:** 允许用户配置全局快捷键，并在冲突时给出中文提示。

**Scope:**

```txt
1. 快捷键管理页
2. 修改快捷键
3. 恢复默认快捷键
4. 注册失败提示
5. 常见冲突检测
```

**Acceptance:**

```txt
1. 用户修改快捷键后重启仍然保持
2. 冲突快捷键不会静默失败
3. 默认快捷键可以恢复
```

## 子计划 3：截图标注

**Goal:** 为截图添加基础编辑能力。

**Scope:**

```txt
矩形标注
箭头标注
文字标注
马赛克
画笔
撤销 / 重做
复制或保存标注后图片
```

**Acceptance:**

```txt
1. 标注工具可切换
2. 编辑后图片可以复制和保存
3. ESC / Enter 行为清晰
```

## 子计划 4：截图贴图置顶

**Goal:** 支持将截图作为置顶小窗贴在桌面。

**Scope:**

```txt
1. 创建 alwaysOnTop 图片窗口
2. 支持拖动
3. 支持缩放
4. 支持关闭
5. 支持透明边框或轻量工具栏
```

**Acceptance:**

```txt
1. 贴图窗口始终置顶
2. 多个贴图窗口可以共存
3. 关闭贴图不影响主应用
```

## 子计划 5：OCR 文字识别

**Goal:** 从截图中识别文字。

**Scope:**

```txt
1. 本地 OCR 或云 OCR 方案评估
2. 隐私提示
3. 识别结果展示
4. 一键复制
5. 保存识别历史可选
```

**Acceptance:**

```txt
1. 用户明确知道图片是否离开本机
2. OCR 失败有中文错误提示
3. 识别结果可以复制
```

## 子计划 6：自动更新

**Goal:** 支持检查新版本并提示用户更新。

**Scope:**

```txt
1. electron-updater 接入
2. 检查更新
3. 下载进度
4. 安装提示
5. 设置页开关
```

**Acceptance:**

```txt
1. 更新失败不影响应用启动
2. 用户可以关闭自动检查
3. 更新提示文案清楚
```

## 子计划 7：插件系统

**Goal:** 支持未来扩展第三方工具能力。

**Scope:**

```txt
1. 插件 manifest 设计
2. 插件目录管理
3. 插件启用 / 禁用
4. 插件权限声明
5. 插件运行沙箱设计
```

**Acceptance:**

```txt
1. 不直接执行未校验代码
2. 插件权限可见
3. 插件崩溃不影响主应用
```

## 子计划 8：账号与云同步

**Goal:** 在不影响离线工具使用的前提下，支持多设备配置同步。

**Scope:**

```txt
1. 登录 / 退出登录
2. 用户信息展示
3. 同步开关
4. 本地优先冲突策略
5. 云端同步剪贴板收藏和颜色收藏
```

**Acceptance:**

```txt
1. 不登录也能使用全部本地工具
2. 同步失败不丢本地数据
3. 用户可以关闭同步
```

## Claude Code 投喂提示词

```txt
请不要一次性实现整个 Phase 6。先从 docs/plans/phase-6-future-enhancements.md 里选择一个子计划，重新写成独立实施计划，再执行该子计划。所有注释和页面文案使用中文，所有文本文件使用 UTF-8 without BOM。
```
