# PawKit 分阶段开发计划索引

这组文档用于把 PawKit 的总 PRD 拆成多份可以逐次喂给 Claude Code 的实施计划。建议每次只给 Claude Code 一份 Phase 文档，不要一次性喂完整 PRD 和所有阶段。

## 文档顺序

1. [Phase 1 基础工程壳](./phase-1-shell.md)
2. [Phase 2 本地配置与管理中心基础](./phase-2-settings-management.md)
3. [Phase 3 核心离线工具](./phase-3-core-tools.md)
4. [Phase 4 打包与 MVP 稳定](./phase-4-package-stability.md)
5. [Phase 5 截图与扩展工具](./phase-5-screenshot-extended-tools.md)
6. [Phase 6 远期增强能力](./phase-6-future-enhancements.md)

## 推荐使用方式

```txt
1. 先把 TechnicalDevelopmentDocuments.md 作为总背景给 Claude Code。
2. 再只给当前阶段的 Phase 文档。
3. 明确告诉 Claude Code：只执行当前 Phase，不要实现后续阶段。
4. 每个 Phase 完成后运行 pnpm build。
5. 当前 Phase 验收通过后，再开始下一份文档。
```

## 当前关键约束

```txt
1. 所有注释使用中文。
2. 页面文案使用中文。
3. 所有文本文件使用 UTF-8 without BOM。
4. 渲染进程不能直接访问 Node.js。
5. 所有 Electron 能力必须通过 preload 暴露。
6. preload 不允许直接暴露 ipcRenderer。
7. UI 采用苹果式毛玻璃视觉。
8. 第一阶段只做基础壳和占位，不做真实工具能力。
```

## 推荐给 Claude Code 的通用开头

```txt
你现在是一个资深 Electron + React + TypeScript 桌面应用开发工程师。

这是 PawKit，一个 Windows 桌面工具箱。请严格遵守 TechnicalDevelopmentDocuments.md 和当前 Phase 文档，只实现当前 Phase，不要提前实现后续阶段。

所有注释和页面文案必须使用中文。所有文本文件必须使用 UTF-8 without BOM。渲染进程不能直接访问 Node.js。所有 Electron 能力必须通过 preload 暴露。UI 采用苹果式毛玻璃视觉。
```

## 阶段依赖关系

```txt
Phase 1 是后续所有阶段的基础。
Phase 2 依赖 Phase 1 的 preload、shared 和基础布局。
Phase 3 依赖 Phase 2 的 electron-store 和设置体系。
Phase 4 依赖 Phase 3 的 MVP 功能。
Phase 5 依赖 Phase 4 的稳定版本。
Phase 6 每个子计划都需要单独设计，不建议一次性执行。
```
