# PawKit Claude 开发指南

## 项目边界

PawKit 是一个 Windows 桌面效率工具箱，技术栈为 Electron + React + TypeScript + Tailwind CSS + Zustand + electron-store。项目以本地离线工具为核心，优先保证启动速度、稳定性、低权限和清晰交互。

默认工作角色：

- 处理 PawKit 任务时，默认以资深 Electron + React + TypeScript 桌面应用开发工程师视角推进。
- 优先关注 Windows 桌面真实行为、系统权限、IPC 边界、窗口状态、本地数据安全和用户可恢复性。

当前允许的能力范围：

- 本地工具：剪贴板、调色板、截图、JSON、时间戳、Base64/URL、二维码等离线工具。
- 本地配置：主题、工具启用状态、工具顺序、窗口尺寸、快捷键、本地历史和收藏。
- 系统能力：通过 Electron main 进程访问剪贴板、截图、窗口、托盘、全局快捷键和文件保存对话框。
- 管理能力：工具管理、快捷键管理、数据统计和本地重置。

默认不做的能力：

- 账号体系、登录、云同步、多端同步。
- 插件系统、第三方脚本执行、远程代码加载。
- 自动更新、遥测、埋点、联网分析。
- 云 OCR、云存储、上传剪贴板或截图内容。
- 跨平台适配优先级低于 Windows 体验，除非用户明确要求。

如果用户要求超出边界的能力，必须先补设计说明，明确隐私、安全、权限、失败处理和回滚策略，再实施。

历史文档使用规则：

- `docs/plans/` 和 `TechnicalDevelopmentDocuments.md` 可以作为背景参考，但不能假设仍代表当前实现。
- 开工前必须以实际代码、`git status --short`、当前配置和现有 IPC/类型为准。
- 阶段文档里的“只实现当前 Phase”原则保留为范围控制：只实现本轮明确要求的能力，不提前扩展未被要求的后续阶段功能。
- 如果文档与代码冲突，先按代码现状定位问题，再把需要长期保留的规则沉淀回 `CLAUDE.md`。

## 文件与编码规范

1. 所有代码注释必须使用中文。
2. 页面文案、错误提示、确认弹窗必须使用中文。
3. 所有文本文件必须使用 UTF-8 without BOM，禁止 UTF-16 / GBK。
4. 中文必须直接输出，禁止写成 `\uXXXX`。
5. 创建、修改、写入文本文件时使用 PowerShell `Set-Content -Encoding utf8`。
6. 不要回退用户或其他助手已有改动；工作前先看 `git status --short`。
7. 不要把格式化、换行、锁文件、配置文件顺手改成与任务无关的大 diff。

## 架构分层规范

- `pawkit/src/main/`：Electron 主进程，负责窗口、托盘、全局快捷键、IPC handler、系统剪贴板、截图、文件保存、electron-store。
- `pawkit/src/preload/`：只通过 `contextBridge` 暴露受控的 `window.electronAPI`，禁止直接暴露 `ipcRenderer`。
- `pawkit/src/shared/`：main / preload / renderer 共享的类型、常量、IPC 通道。
- `pawkit/src/renderer/src/`：React 页面、布局组件、Zustand store、纯工具函数和样式。
- 渲染进程不能直接访问 Node.js、Electron 主进程能力、文件系统或 `electron-store`。

新增 Electron 能力的固定路径：

1. 在 `shared/ipc-channels.ts` 定义 IPC 通道。
2. 在 `shared/types.ts` 定义请求、响应和 `ElectronAPI` 类型。
3. 在 `main/ipc/` 增加 handler，并使用 `validateSender` 校验来源。
4. 在 `preload/index.ts` 暴露最小 API。
5. 在 renderer 的页面或 store 中调用 `window.electronAPI`。
6. 运行 `pnpm run typecheck` 和 `pnpm run lint`。

## 配置规范

本地配置统一通过 `electron-store` 管理，配置定义集中在 `pawkit/src/main/store.ts`。

配置 key 规则：

- 所有可写 key 必须加入 `ALLOWED_KEYS` 白名单。
- 默认值必须加入 `defaultSettings`。
- 类型必须能在 `shared/types.ts` 中找到对应结构。
- renderer 不能绕过 IPC 写配置。
- 新增配置必须考虑旧版本没有该字段时的默认值。

现有配置域：

- `app.theme`：主题。
- `app.shortcuts`：全局快捷键启用状态和按键。
- `app.windowBounds`：窗口尺寸与位置。
- `app.enabledTools`：启用工具列表。
- `management.toolOrder`：工具排序。
- `management.autoUpdate`、`management.lastCheckUpdateTime`：预留管理配置，未实现自动更新前不要扩展实际联网行为。
- `clipboard.history`：剪贴板本地历史。
- `color.favorites`、`color.recent`：颜色收藏和最近颜色。

快捷键配置规范：

- 快捷键真实注册逻辑以 `main/shortcuts/config.ts` 为准。
- `ShortcutKey` 必须在 `shared/types.ts` 和 `main/shortcuts/types.ts` 保持一致。
- 调色板快捷键 key 使用 `colorPicker`，不要写成 `color`。
- 修改快捷键后必须验证注册状态、冲突提示、禁用和恢复默认。

窗口配置规范：

- 主窗口是无边框窗口，标题栏拖动区域必须使用 `.app-drag`。
- 标题栏按钮、输入框、导航项等交互区域必须使用 `.app-no-drag`。
- 关闭按钮语义是隐藏到托盘，退出应用通过托盘菜单或显式退出 API。
- 最小化必须进入任务栏，不要用隐藏窗口代替。
- 保存窗口尺寸时跳过最小化、最大化、全屏状态。

## 数据规范

剪贴板：

- 文本历史默认本地保存，不上传、不同步。
- 不要使用 `trim()` 改写用户复制内容；首尾空格、多行文本、命令和代码都可能有意义。
- 空字符串可以忽略，但只包含空格的文本应视为有效文本，除非产品另行决定。
- 默认尽量完整记录剪贴板内容，不自动做敏感内容识别、密码过滤或密钥过滤；如果以后要加隐私保护，必须先补产品规则和用户可控开关。
- 收藏项清空时默认保留。
- 超长文本上限由 `clipboard-config.ts` 管理，不要在页面中散落重复常量。
- 历史项的轻量分类、URL/JSON/命令/长文本提示优先在 renderer 派生，除非确实需要持久化或跨进程复用。

颜色：

- `ColorRecord` 必须兼容旧数据。
- `name`、`tags`、`source` 等字段只能是可选字段，不能要求历史数据迁移后才能渲染。
- 颜色转换、色阶、对比度等纯逻辑放在 `renderer/src/utils/color.ts`。
- 屏幕取色可以复用截图能力，但不能让 renderer 直接访问系统截图 API。
- 调色板能力优先服务前端开发工作流：HEX、RGB、HSL、CSS 变量、Tailwind 片段、JSON token、色阶、配色建议和对比度检查。

截图与二维码：

- 截图、复制图片、保存图片都走 main/preload 暴露的 API。
- 保存图片时不能假设一定存在焦点窗口。
- 复制或保存失败必须有中文页面反馈，不能只写 `console.error`。

## UI 与交互规范

- 继续使用当前暗色、苹果式毛玻璃视觉，不引入突兀的营销型首页或大面积装饰背景。
- 页面应优先服务工具效率，避免纯说明文字占据主要区域。
- 高频操作必须有明确反馈，例如复制成功、保存成功、失败原因、清空确认。
- 危险操作必须二次确认，例如清空历史、重置配置。
- 工具页面需要兼顾鼠标和键盘使用，尤其是剪贴板、快捷键管理等高频页。
- 页面文案不要写“远期功能”占位，除非该区域确实不可用且用户需要知道原因。

## 安全与权限规范

- 所有 IPC handler 必须校验 sender 来源。
- preload 只暴露语义化 API，不暴露通用 IPC 调用器。
- 不读取、不上传、不联网处理剪贴板和截图内容，除非用户明确要求并有隐私提示。
- 外部链接必须通过默认浏览器打开，应用窗口内禁止任意外部导航。
- 插件、脚本执行、远程配置等能力默认禁止。

## 验证规范

每轮代码改动结束前至少运行：

```powershell
pnpm run typecheck
pnpm run lint
```

涉及 main / preload / 构建路径时运行：

```powershell
pnpm run build
```

涉及窗口、托盘、全局快捷键、截图、取色、保存对话框等桌面交互时，还需要启动开发版手工验证：

```powershell
pnpm run dev
```

`pnpm run dev` 是常驻进程。验证结束后要确认没有残留 PawKit 相关的 `electron.exe` / `node.exe` 开发进程。

编译通过不等于桌面交互通过。无边框拖动、任务栏最小化、托盘恢复、全局快捷键、截图、屏幕取色、保存对话框、复制图片或文件到系统剪贴板，都必须在 Windows 桌面环境中实际操作确认；无法自动验证时必须在交付说明里明确写出。

交付时必须说明：

- 修改了哪些模块。
- 跑过哪些验证命令。
- 哪些桌面交互无法自动验证，需要用户本机确认。
