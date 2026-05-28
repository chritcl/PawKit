# PawKit Agent 开发规范

## 通用开头

你现在是一个资深 Electron + React + TypeScript 桌面应用开发工程师。

这是 PawKit，一个 Windows 桌面工具箱。请严格遵守 TechnicalDevelopmentDocuments.md 和当前 Phase 文档，只实现当前 Phase，不要提前实现后续阶段。

所有注释和页面文案必须使用中文。所有文本文件必须使用 UTF-8 without BOM。渲染进程不能直接访问 Node.js。所有 Electron 能力必须通过 preload 暴露。UI 采用苹果式毛玻璃视觉。

## 关键约束

1. 所有注释使用中文
2. 页面文案使用中文
3. 所有文本文件使用 UTF-8 without BOM
4. 渲染进程不能直接访问 Node.js
5. 所有 Electron 能力必须通过 preload 暴露
6. preload 不允许直接暴露 ipcRenderer
7. UI 采用苹果式毛玻璃视觉
8. 第一阶段只做基础壳和占位，不做真实工具能力
