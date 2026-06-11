# PawKit Claude 开发指南

## 适用范围与事实来源

本文件适用于仓库根目录及 `pawkit/` 下的所有开发任务。

PawKit 是一个以 Windows 为主要目标平台的本地桌面效率工具箱，技术栈为 Electron、React、TypeScript、Vite、Tailwind CSS、Zustand、electron-store 和 Vitest。产品优先保证启动速度、稳定性、低权限、本地隐私、清晰交互和可恢复性。

处理任务时按以下顺序判断事实：

1. 当前代码、类型、配置和测试是最高优先级事实来源。
2. 本文件记录长期有效的项目边界与开发规范。
3. `docs/plans/` 只作为历史阶段背景，不能假设仍代表当前实现。
4. 历史对话、旧计划和旧问题描述只能提供上下文，不能覆盖当前代码事实。

开始工作前必须先检查：

```powershell
git status --short
rg --files pawkit/src
```

不要回退用户或其他助手已有改动。不要把临时缺陷清单、一次性维护重点或短期实现计划写进本文件；这类内容应放到独立计划文档或任务说明中。

## 项目边界

默认以资深 Electron、React、TypeScript 桌面应用工程师视角推进，优先关注 Windows 桌面真实行为、系统权限、IPC 边界、窗口状态、本地数据安全和失败恢复。

当前产品范围：

- 本地工具：剪贴板、调色板、截图、JSON、时间戳、Base64/URL/JWT/Data URL、二维码。
- 本地配置：主题、启动页、工具启用与排序、常用工具、窗口位置与尺寸、快捷键、本地历史、收藏和截图偏好。
- 系统能力：通过 Electron 主进程访问剪贴板、屏幕捕获、窗口、托盘、全局快捷键和文件保存对话框。
- 管理能力：首页效率概览、工具管理、快捷键管理、数据统计、配置导出和本地重置。

默认不做：

- 账号、登录、云同步和多端同步。
- 插件系统、第三方脚本执行和远程代码加载。
- 自动更新、遥测、埋点和联网分析。
- 云 OCR、云存储，以及上传剪贴板或截图内容。
- 为追求跨平台一致性而牺牲 Windows 体验。

用户明确要求超出边界的能力时，先补设计说明，明确隐私、安全、权限、失败处理、数据迁移和回滚策略，再实施。

## 工作区与命令

仓库根目录用于 Git 和文档管理，实际应用位于 `pawkit/`。所有 `pnpm` 命令必须在 `pawkit/` 中运行：

```powershell
Set-Location .\pawkit
pnpm run dev
pnpm run test
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm run build:win
```

命令用途：

- `pnpm run dev`：启动 Electron 开发版，renderer 开发服务器默认使用 `5573` 端口。
- `pnpm run test`：运行 Vitest 单元测试。
- `pnpm run typecheck`：检查 main、preload、renderer 的 TypeScript 类型。
- `pnpm run lint`：运行 ESLint。
- `pnpm run build`：先执行类型检查，再构建 Electron 应用。
- `pnpm run build:win`：生成 Windows NSIS 安装包，输出到 `pawkit/release/`。

依赖管理统一使用 `pnpm`。不要混用 `npm` 或 `yarn`，不要无理由改写 `pnpm-lock.yaml`。

## 文件与编码规范

1. 所有代码注释必须使用中文，禁止英文注释。
2. 页面文案、错误提示、确认弹窗和用户可见状态必须使用中文。
3. 所有文本文件必须使用 UTF-8 without BOM，禁止 UTF-16 和 GBK。
4. 中文必须直接输出，禁止写成 `\uXXXX`。
5. 使用 PowerShell 执行命令；创建、修改或写入文本文件时使用 `Set-Content -Encoding utf8`，并确认结果为 UTF-8 without BOM。
6. 不要产生与任务无关的大范围格式化、换行、锁文件或配置文件 diff。
7. 注释只解释不明显的约束、原因和复杂流程，不为简单代码逐行复述。

修改文本文件后检查 BOM：

```powershell
$bytes = [System.IO.File]::ReadAllBytes((Resolve-Path .\CLAUDE.md))
$bytes[0..2]
```

UTF-8 BOM 的前三个字节是 `239 187 191`，项目文件不得出现该前缀。

## 架构边界

目录职责：

- `pawkit/src/main/`：Electron 主进程，负责窗口、托盘、全局快捷键、IPC handler、系统剪贴板、截图、保存对话框和 electron-store。
- `pawkit/src/preload/`：通过 `contextBridge` 暴露受控的 `window.electronAPI`。
- `pawkit/src/shared/`：main、preload、renderer 共用的常量、类型和 IPC 通道。
- `pawkit/src/renderer/src/`：React 页面、布局、Zustand store、纯工具函数、截图编辑引擎和样式。

强制边界：

- renderer 不能直接访问 Node.js、Electron 主进程能力、文件系统或 electron-store。
- preload 禁止暴露 `ipcRenderer`、通用 `invoke` 或通用 `send`。
- `window.electronAPI` 必须保持语义化、最小化，并在 `shared/types.ts` 中有完整类型。
- `contextIsolation` 必须保持开启，`nodeIntegration` 必须保持关闭。
- preload 当前固定构建为 CommonJS，入口输出为 `preload/index.cjs`；修改构建配置或窗口 preload 路径时必须同步验证。

新增或修改 Electron 能力时按固定链路实施：

1. 在 `shared/ipc-channels.ts` 定义专用 IPC 通道。
2. 在 `shared/types.ts` 定义请求、响应和 `ElectronAPI` 类型。
3. 在 `main/` 实现业务能力，在 `main/ipc/` 只做来源校验、参数校验和调用编排。
4. 在 `preload/index.ts` 暴露最小语义 API。
5. 在 renderer 页面或 store 中调用 `window.electronAPI`。
6. 为失败、取消和不可用状态提供中文反馈。
7. 运行类型检查、Lint、测试和相关桌面手工验证。

IPC 安全规则：

- 所有 `ipcMain.handle` 必须先使用 `validateSender` 校验来源。
- 覆盖层使用的 `ipcMain.on` 必须通过窗口或 `WebContents` 关联校验发送方，不能信任任意 renderer 事件。
- 开发环境 sender 只允许 `localhost`、`127.0.0.1`、`::1` 和实际开发端口；默认回退端口为 `5573`。
- 生产环境只允许应用自身的本地 renderer 文件。
- 外部链接使用系统默认浏览器打开，应用窗口内禁止任意外部导航。

## 配置与状态规范

持久化配置统一由 `pawkit/src/main/store.ts` 中的 electron-store 管理。

新增或修改配置时必须同步：

1. `shared/types.ts` 中的 `AppSettings` 或对应类型。
2. `main/store.ts` 中的 `ALLOWED_KEYS` 白名单。
3. `main/store.ts` 中的 `defaultSettings`。
4. renderer store 或页面中的读取、兼容默认值和写入逻辑。
5. 配置导出、重置、旧版本缺字段时的兼容行为。

现有配置域：

- `app.theme`：主题。
- `app.shortcuts`：全局快捷键状态和按键。
- `app.windowBounds`：窗口位置与尺寸。
- `app.enabledTools`：启用工具列表。
- `app.startPage`：启动页策略。
- `app.lastActiveTool`：上次使用工具。
- `app.toolUsage`：工具使用次数和最近使用时间，不记录工具内容。
- `management.toolOrder`：工具排序。
- `management.favoriteTools`：首页常用工具。
- `management.autoUpdate`、`management.lastCheckUpdateTime`：预留字段，未实现自动更新前禁止引入联网行为。
- `clipboard.history`：剪贴板本地历史。
- `color.favorites`、`color.recent`：颜色收藏和最近颜色。
- `qrcode.history`：二维码历史，只保存模板、字段和样式，不保存图片 data URL。
- `screenshot.preferences`：截图标注颜色和线宽偏好。
- `privacy.qrcodeHistoryLimit`：二维码历史保留数量。

状态职责：

- 跨重启数据放 electron-store，不要只放 Zustand。
- 当前页面选择、筛选条件、编辑状态等短期 UI 状态放 renderer。
- renderer 不得绕过 IPC 直接持久化。
- 写配置时必须使用白名单 key，并为旧数据缺字段提供默认值。
- 持久化结构扩展优先增加可选字段，避免让历史数据无法渲染。

## 工具注册规范

新增工具不能只创建页面。至少检查并同步：

1. `shared/constants.ts` 的 `TOOL_IDS` 和 `ToolId`。
2. `renderer/src/utils/tool-registry.ts` 的名称、图标、说明和禁用能力。
3. `renderer/src/components/layout/content-area.tsx` 的页面渲染分支。
4. `main/store.ts` 与 `renderer/src/stores/app-store.ts` 的默认启用、排序和常用工具。
5. 启动页、最近使用、管理中心、侧边栏和设置页的兼容行为。
6. 纯逻辑测试和必要的页面手工验证。

工具 ID 是持久化数据的一部分。已有 ID 不得随意改名；确需改名时必须提供迁移和回退策略。

## 核心数据规范

### 剪贴板

- 剪贴板监听、采集、去重、持久化和系统写入属于 main 层，IPC 层不写业务逻辑。
- renderer 的 `clipboard-store` 负责加载、监听、筛选和交互状态。
- 历史支持文本、图片、文件和富文本；修改时必须考虑四种类型和旧历史兼容。
- 不要使用 `trim()` 改写用户复制内容。首尾空格、多行文本、命令和代码都可能有意义。
- 空字符串可以忽略，但只包含空格的文本默认视为有效文本。
- 默认完整记录剪贴板内容，不自动做密码、密钥或敏感内容过滤；改变隐私策略前必须先明确产品规则和用户开关。
- 收藏项清空时默认保留；普通历史数量和超长内容限制集中在 `main/services/clipboard-config.ts`。
- 图片过大时应保留可展示的压缩版本或缩略图，不能静默消失。
- Windows 文件剪贴板需要兼容原生文件格式和路径兜底，不能只按普通文本处理。
- URL、JSON、命令、长文本等轻量分类优先在 renderer 派生，除非确实需要持久化或跨进程复用。

### 调色板与取色

- 颜色转换、色阶、配色建议、对比度和开发格式生成等纯逻辑放在 `renderer/src/utils/color.ts`。
- `ColorRecord` 新字段必须保持可选，兼容旧收藏和最近颜色。
- 屏幕取色通过 main 截取屏幕并创建覆盖层，renderer 不能直接访问系统截图 API。
- 全屏滴管必须考虑多显示器、负坐标、高 DPI、点击完成、Esc/右键取消、超时和加载失败。
- 调色板优先服务开发工作流：HEX、RGB、HSL、CSS 变量、Tailwind 片段、JSON token、色阶、配色建议和对比度检查。

### 截图

- 通用图片复制、保存和全屏滴管能力位于 `main/screenshot-service.ts`。
- 新版区域截图会话位于 `main/screen-capture/`，负责冻结所有显示器、覆盖层会话、显示器认领和输出。
- 两套能力职责不同，不要为了复用而混合会话状态。
- 区域选择、标注几何、reducer 和 canvas 渲染位于 renderer 截图引擎；可测试的纯逻辑必须保持与 Electron API 解耦。
- 截图会话必须防止重复启动，并在完成、保存、取消、窗口销毁和加载失败后关闭所有覆盖层、恢复原主窗口。
- 保存图片时不能假设一定存在焦点窗口。
- 复制、保存、取消和失败都必须返回明确状态，不能只写 `console.error`。

### JSON、时间戳、编码与二维码

- JSON、时间解析、编码转换和二维码 payload 生成优先放在 `renderer/src/utils/` 的纯函数中。
- JSON 工具需要保持文本编辑与树编辑同步，JSONC 转换为标准 JSON 时不得假装保留注释。
- 时间戳解析必须明确秒、毫秒、日期、ISO、本地、UTC 和固定偏移语义。
- JWT 功能只做本地解码和展示，不做签名验证或安全承诺。
- 二维码图片按需生成，不把 data URL 写入持久化历史；历史上限裁剪时保留收藏项。

## 窗口、托盘与快捷键

- 主窗口是无边框窗口，拖动区域使用 `.app-drag`，按钮、输入框、导航项等交互区域使用 `.app-no-drag`。
- 关闭按钮语义是隐藏到托盘；退出应用通过托盘菜单或显式退出 API。
- 最小化必须进入任务栏，不能用隐藏窗口代替。
- 显示窗口时若窗口已最小化，必须先恢复再聚焦。
- 保存窗口尺寸时跳过最小化、最大化和全屏状态。
- 屏幕坐标和保存的窗口位置必须考虑多显示器变化，不能假设坐标始终为正数或显示器永远存在。

快捷键规则：

- 真实注册逻辑以 `main/shortcuts/config.ts` 为准。
- `ShortcutKey` 必须在 `shared/types.ts` 和 `main/shortcuts/types.ts` 保持一致。
- 调色板快捷键 key 固定使用 `colorPicker`，不要写成 `color`。
- 修改快捷键后必须验证注册、冲突提示、禁用、恢复默认、窗口导航和截图触发。

## UI 与交互规范

PawKit 是高频桌面工具，不是营销网站。视觉方向为克制、专业、紧凑的桌面工具界面，在现有深色玻璃质感基础上保持清晰层级，同时确保浅色主题可用。

长期规则：

- 优先使用 `renderer/src/styles/index.css` 中的设计 token 和现有通用类，避免页面散落硬编码色值。
- 新增颜色必须同时检查浅色与深色主题，保证文字、边框、hover、active、disabled 和 focus 对比度。
- 页面主要空间用于实际工具，不用大面积说明、装饰背景、营销式首页或纯占位内容。
- 卡片只用于独立重复项或确实需要边界的工具区域，避免卡片嵌套和无意义的面板层叠。
- 工具栏、内容块、列表项、元信息和操作组必须有稳定间距；不要靠零散 `mt-*`、`p-*` 临时补洞。
- 图标按钮优先使用 Lucide 图标，并为不熟悉的图标提供 tooltip。
- 高频操作必须有明确反馈；危险操作必须二次确认。
- 页面需要兼顾鼠标和键盘操作，尤其是剪贴板、JSON、快捷键和截图。
- 固定尺寸区域、工具栏和列表在窗口最小尺寸下不能裁切、重叠或被状态栏遮挡。
- 浏览器可用于 renderer 视觉巡检，但 `window.electronAPI` 在普通浏览器中不可用；页面应在合理范围内降级，不应因缺少 Electron API 直接白屏。

## 日志、安全与隐私

- 不读取、不上传、不联网处理剪贴板、截图、二维码和配置内容，除非用户明确要求并确认隐私提示。
- 插件、脚本执行、远程配置和远程代码默认禁止。
- 不在日志中输出完整剪贴板、截图 data URL、二维码内容或用户配置。
- 开发调试日志优先使用现有 logger；完成任务后删除临时高频日志。
- IPC 参数不能因为 TypeScript 类型存在就默认可信，主进程仍需做运行时校验。
- 任何导出、清空、重置和覆盖写入操作都要处理取消、失败和用户恢复路径。

## 测试与验证

可测试的业务逻辑应优先抽成纯函数并补 Vitest。现有测试覆盖工具偏好、JSON、日期、编码、二维码，以及截图标注、几何和 reducer。

每轮代码改动结束前，在 `pawkit/` 中至少运行：

```powershell
pnpm run test
pnpm run typecheck
pnpm run lint
```

涉及 main、preload、共享类型、构建配置或依赖时，再运行：

```powershell
pnpm run build
```

涉及安装包、图标、electron-builder 或 NSIS 时运行：

```powershell
pnpm run build:win
```

涉及窗口、托盘、全局快捷键、剪贴板多类型、截图、屏幕取色、保存对话框、系统剪贴板写入等桌面交互时，必须启动开发版手工验证：

```powershell
pnpm run dev
```

`pnpm run dev` 是常驻进程。验证结束后确认没有残留的 PawKit 开发版 `electron.exe` 或对应 `node.exe` 进程。

编译通过不等于桌面交互通过。以下能力必须在 Windows 桌面环境实际操作确认：

- 无边框窗口拖动、最小化、最大化、关闭隐藏、托盘恢复和退出。
- 全局快捷键注册、冲突、禁用、重置和页面导航。
- 文本、图片、文件、富文本剪贴板采集与还原。
- 多显示器、高 DPI、负坐标下的截图和全屏取色。
- 图片复制、保存对话框、取消和失败反馈。
- 浅色与深色主题、最小窗口尺寸和各工具页布局。

交付时必须说明修改模块、执行过的验证命令，以及无法自动验证、需要用户本机确认的桌面交互。
