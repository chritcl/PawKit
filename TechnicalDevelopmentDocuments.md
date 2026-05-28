# PawKit Windows 桌面工具箱技术开发文档

## 1. 项目概述

项目名称：**PawKit**

项目类型：Windows 桌面端开发者效率工具箱。

核心目标：开发一个常驻 Windows 系统托盘、默认离线可用、可通过全局快捷键快速唤起的轻量工具箱。PawKit 优先服务开发者和高频电脑用户，提供剪贴板历史、调色板、JSON 工具、时间戳工具、截图、编码转换等常用能力。

产品原则：

```txt
离线优先
启动快速
系统托盘常驻
快捷键优先
界面克制
工具模块化
数据默认本地保存
账号、同步、插件、自动更新后置
```

参考产品方向：

```txt
uTools
PowerToys
Snipaste
Ditto
Raycast
```

---

## 2. 技术栈

本项目采用以下技术栈：

```txt
Electron
React
Vite
TypeScript
Zustand
Tailwind CSS
shadcn/ui
electron-vite
electron-builder
electron-store
lucide-react
dayjs
nanoid
```

说明：

- Electron 负责桌面端原生能力，例如窗口、托盘、快捷键、剪贴板、截图、本地文件访问。
- React 负责渲染界面。
- Vite 负责前端构建和开发体验。
- TypeScript 负责类型约束。
- Zustand 负责轻量状态管理。
- Tailwind CSS 负责样式系统。
- shadcn/ui 只在需要具体组件时逐步添加，不在第一轮一次性引入过多组件。
- electron-vite 负责 Electron + Vite 项目工程化。
- electron-builder 负责打包 Windows exe。
- electron-store 负责本地配置和本地数据存储。

---

## 3. 产品定位

PawKit 是一个面向 Windows 用户的轻量桌面效率工具箱。应用常驻系统托盘，通过全局快捷键快速唤起，核心工具默认离线可用。

应用内置「管理中心」，用于统一管理应用自身能力，例如工具启用状态、快捷键、本地数据、应用信息和后续扩展能力。管理中心不是传统业务后台系统，也不应该成为第一版的复杂功能集合。

第一版不强制登录，不依赖云端服务，不因为账号能力影响本地工具使用。

整体形态：

```txt
系统托盘常驻
全局快捷键唤起
小窗口工具面板
本地数据存储
离线可用
启动速度快
暗色优先，兼容浅色
苹果式毛玻璃视觉
开发者工具风格
```

---

## 4. 功能阶段规划

### 4.1 Phase 1：基础工程壳

第一阶段只完成基础工程、Electron 原生外壳、布局和页面占位，不实现真实业务工具能力。

范围：

```txt
1. Electron + React + TypeScript 项目基础架构
2. Tailwind CSS 配置
3. shadcn/ui 基础配置
4. 主窗口
5. 系统托盘
6. 全局快捷键 Alt + Space
7. preload API 基础结构
8. 左侧菜单 + 右侧内容区布局
9. 首页占位
10. 管理中心页面占位
11. 设置页占位
12. 剪贴板页面占位
13. 调色板页面占位
14. JSON 工具页面占位
15. 时间戳工具页面占位
```

Phase 1 验收标准：

```txt
1. pnpm dev 可以启动应用
2. Windows 可以正常显示主窗口
3. 关闭窗口后隐藏到托盘，不直接退出应用
4. 托盘菜单可以打开窗口和退出应用
5. Alt + Space 可以显示 / 隐藏主窗口
6. 左侧菜单可以切换页面占位内容
7. 渲染进程不能直接访问 Node.js
8. Electron 能力通过 preload 暴露
9. pnpm build 可以通过
```

### 4.2 Phase 2：本地配置与管理中心基础

范围：

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

Phase 2 验收标准：

```txt
1. 重启应用后主题配置保持
2. 重启应用后窗口尺寸保持
3. 启用工具状态可以本地保存
4. 管理中心可以展示本地统计信息
5. 设置页可以读写本地配置
```

### 4.3 Phase 3：核心离线工具

范围：

```txt
1. 剪贴板文本历史
2. JSON 格式化 / 压缩 / 校验
3. 时间戳转换
4. 调色板颜色转换
```

Phase 3 验收标准：

```txt
1. 剪贴板可以自动记录文本历史
2. 剪贴板历史支持搜索、复制、删除、清空、收藏
3. JSON 工具可以格式化、压缩、校验并展示错误提示
4. 时间戳工具可以完成秒级 / 毫秒级 / 日期互转
5. 调色板可以完成 HEX / RGB / HSL 互转
6. 所有异常输入都有中文提示
```

### 4.4 Phase 4：打包与 MVP 稳定

范围：

```txt
1. 配置 electron-builder
2. 打包 Windows x64 NSIS 安装包
3. 补齐 resources/icon.ico
4. 关于页面展示应用版本
5. 快捷键注册失败提示
6. 退出应用时注销全部快捷键
7. IPC sender 校验
8. Windows 安装包验证
```

Phase 4 验收标准：

```txt
1. 可以生成 Windows exe 安装包
2. 安装后应用可以正常启动
3. 托盘、快捷键、核心工具在安装版中可用
4. 应用退出行为正确
```

### 4.5 Phase 5：截图与扩展工具

范围：

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

Phase 5 验收标准：

```txt
1. 截图在常规屏幕和高 DPI 屏幕下可用
2. 截图可以保存和复制
3. 区域截图支持 ESC 取消和 Enter 确认
4. 编解码工具可以离线使用
5. 二维码可以本地生成
```

### 4.6 Phase 6：远期增强能力

以下能力不进入 MVP，后续单独拆分计划开发：

```txt
1. 截图标注
2. 截图贴图置顶
3. OCR 文字识别
4. 工具搜索命令面板
5. 快捷键自定义和冲突检测
6. 插件系统
7. 自动更新
8. 账号与云同步
```

---

## 5. 项目初始化要求

使用 electron-vite 官方推荐脚手架初始化项目。

命令：

```bash
pnpm create @quick-start/electron pawkit --template react-ts
```

如果脚手架出现交互选项：

```txt
Add Electron updater plugin? 选择 No
Enable Electron download mirror proxy? 按当前网络情况选择，默认 No
```

进入项目并安装依赖：

```bash
cd pawkit
pnpm install
```

启动项目：

```bash
pnpm dev
```

基础依赖：

```bash
pnpm add zustand electron-store clsx tailwind-merge lucide-react dayjs nanoid
```

开发依赖：

```bash
pnpm add -D prettier
```

Tailwind CSS 使用 Vite 插件方式：

```bash
pnpm add tailwindcss @tailwindcss/vite
```

shadcn/ui 初始化：

```bash
pnpm dlx shadcn@latest init
```

Phase 1 最多只添加以下组件：

```bash
pnpm dlx shadcn@latest add button input tooltip separator scroll-area
```

---

## 6. 推荐项目目录结构

请按照以下结构组织项目。第一阶段可以先创建必要文件，后续阶段按模块补齐。

```txt
pawkit/
├─ src/
│  ├─ main/
│  │  ├─ index.ts
│  │  ├─ window.ts
│  │  ├─ tray.ts
│  │  ├─ shortcuts.ts
│  │  ├─ store.ts
│  │  └─ ipc/
│  │     ├─ index.ts
│  │     ├─ app.ts
│  │     ├─ setting.ts
│  │     ├─ clipboard.ts
│  │     ├─ screenshot.ts
│  │     └─ file.ts
│  ├─ preload/
│  │  ├─ index.ts
│  │  └─ types.ts
│  ├─ shared/
│  │  ├─ constants.ts
│  │  ├─ ipc-channels.ts
│  │  └─ types.ts
│  └─ renderer/
│     ├─ index.html
│     └─ src/
│        ├─ main.tsx
│        ├─ App.tsx
│        ├─ components/
│        │  ├─ layout/
│        │  ├─ common/
│        │  └─ ui/
│        ├─ pages/
│        │  ├─ home/
│        │  ├─ management/
│        │  ├─ settings/
│        │  └─ tools/
│        │     ├─ clipboard/
│        │     ├─ color-picker/
│        │     ├─ screenshot/
│        │     ├─ json-tool/
│        │     ├─ timestamp-tool/
│        │     └─ base64-tool/
│        ├─ stores/
│        │  ├─ app-store.ts
│        │  ├─ clipboard-store.ts
│        │  └─ setting-store.ts
│        ├─ utils/
│        │  ├─ color.ts
│        │  ├─ date.ts
│        │  ├─ json.ts
│        │  └─ format.ts
│        ├─ types/
│        │  └─ electron.d.ts
│        └─ styles/
│           └─ index.css
├─ resources/
│  └─ icon.ico
├─ package.json
├─ electron.vite.config.ts
├─ tsconfig.json
└─ README.md
```

目录规则：

```txt
1. main 只放 Electron 主进程代码
2. preload 只放安全桥接代码
3. shared 放 main / preload / renderer 共用类型、常量和 IPC channel
4. renderer 只放 React 渲染层代码
5. renderer 不允许直接 import electron、fs、path 等 Node.js / Electron 模块
6. 文件命名统一使用 kebab-case 或 index.tsx
7. React 组件命名使用 PascalCase
```

---

## 7. 主进程开发要求

Electron 主进程负责以下能力：

```txt
1. 创建主窗口
2. 创建系统托盘
3. 注册全局快捷键
4. 监听 IPC 请求
5. 操作系统剪贴板
6. 获取屏幕截图源
7. 本地数据读写
8. 应用退出和最小化到托盘
```

Phase 1 主进程只需要实现：

```txt
1. 创建主窗口
2. 创建系统托盘
3. 注册 Alt + Space
4. 注册 app 类 IPC
5. 关闭窗口时隐藏到托盘
6. 退出应用时注销快捷键
```

窗口要求：

```txt
默认宽度：960
默认高度：680
最小宽度：800
最小高度：560
关闭窗口时不退出应用，而是隐藏到托盘
支持通过快捷键显示 / 隐藏
支持托盘点击显示 / 隐藏
```

窗口配置要求：

```ts
webPreferences: {
  preload: preloadPath,
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: false
}
```

禁止在渲染进程直接启用 Node.js。

---

## 8. Preload 通信规范

所有 Electron 能力必须通过 preload 暴露给 React 页面。

禁止在页面中直接使用：

```ts
import { ipcRenderer } from "electron";
```

必须通过：

```ts
contextBridge.exposeInMainWorld("electronAPI", {
  app: {},
  setting: {},
  clipboard: {},
  screenshot: {},
});
```

preload 不允许直接暴露 `ipcRenderer`，只允许暴露经过白名单封装的方法。

### 8.1 Phase 1 API

```ts
export interface ElectronAPI {
  app: {
    showWindow: () => Promise<void>;
    hideWindow: () => Promise<void>;
    toggleWindow: () => Promise<void>;
    quit: () => Promise<void>;
  };
  setting: {
    get: <T = unknown>(key: string) => Promise<T | null>;
    set: (key: string, value: unknown) => Promise<boolean>;
  };
}
```

### 8.2 Phase 3 API

```ts
export interface ClipboardItem {
  id: string;
  type: "text" | "image";
  content: string;
  favorite: boolean;
  createdAt: string;
}

export interface ClipboardAPI {
  readText: () => Promise<string>;
  writeText: (text: string) => Promise<boolean>;
  getHistory: () => Promise<ClipboardItem[]>;
  clearHistory: () => Promise<boolean>;
  removeItem: (id: string) => Promise<boolean>;
  toggleFavorite: (id: string) => Promise<boolean>;
}
```

---

## 9. 渲染层设计

Phase 1 不使用 React Router。渲染层采用 `activeTool + ToolRegistry` 切换页面，降低桌面工具箱复杂度。

主界面布局：

```txt
左侧工具菜单
右侧工具内容区
顶部工具标题栏
底部状态栏
```

左侧菜单包含：

```txt
首页
剪贴板
调色板
截图
JSON 工具
时间戳
Base64
管理中心
设置
```

首页展示：

```txt
常用工具卡片
最近使用工具
快捷键提示
应用版本
```

Phase 1 页面占位要求：

```txt
1. 每个页面必须有中文标题
2. 每个页面必须说明当前阶段只做占位
3. 每个页面必须展示后续要实现的核心能力
4. 页面之间可以通过左侧菜单切换
```

UI 风格：

```txt
苹果式毛玻璃视觉
暗色优先，兼容浅色
半透明层级
克制
清晰
开发者工具风格
信息密度适中
卡片圆角不超过 8px
避免营销页式大 Hero
避免装饰性渐变球和无意义背景装饰
```

毛玻璃视觉规范：

```txt
1. 主窗口背景使用深色或浅色渐变底色，但不要使用大面积高饱和渐变。
2. 侧边栏、顶部栏、状态栏和主要内容面板使用半透明背景。
3. 半透明面板需要使用 backdrop-blur，呈现类似 macOS / iOS 的磨砂玻璃效果。
4. 面板边框使用 1px 半透明白色或黑色细边，不使用厚重描边。
5. 阴影要轻，不使用夸张投影。
6. 工具卡片和列表项要有轻微透明度、细边框和 hover 高亮。
7. 当前选中菜单项使用柔和高亮，不使用强烈纯色块。
8. 文字必须保持足够对比度，不能因为透明和模糊影响可读性。
9. 背景可以有轻微色彩层次，但不能出现装饰性渐变球、光斑或无意义图案。
10. 整体感觉参考 Apple 系统应用的毛玻璃与层级关系，但布局仍然保持开发者工具的高效率。
```

Tailwind 实现建议：

```txt
1. 使用 bg-white/8、bg-white/10、bg-black/20、border-white/10、border-black/10 等透明色。
2. 使用 backdrop-blur-xl 或 backdrop-blur-2xl 实现毛玻璃。
3. 使用 shadow-sm 或 shadow-md，避免 shadow-2xl 这种过重阴影。
4. 使用 transition-colors 提供细腻 hover 状态。
5. 使用 CSS 变量管理背景、面板、边框、文字和强调色。
6. 优先使用 lucide-react 图标表达工具，不要用文字按钮堆满界面。
```

---

## 10. 剪贴板功能要求

剪贴板模块从 Phase 3 开始实现。

功能说明：

```txt
1. 定时读取系统剪贴板文本
2. 自动保存历史记录
3. 相同内容不重复保存
4. 支持搜索
5. 支持点击复制
6. 支持删除单条记录
7. 支持清空全部记录
8. 支持收藏常用内容
9. 支持限制最大保存数量
```

数据结构：

```ts
export interface ClipboardItem {
  id: string;
  type: "text" | "image";
  content: string;
  favorite: boolean;
  createdAt: string;
}
```

默认限制：

```txt
最大保存数量：200 条
轮询间隔：800ms
忽略空文本
忽略重复文本
超过最大数量时删除最旧记录
收藏内容不自动删除
```

页面交互：

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

---

## 11. 调色板功能要求

调色板模块从 Phase 3 开始实现。

功能说明：

```txt
1. HEX 输入
2. RGB 输入
3. HSL 输入
4. HEX / RGB / HSL 自动互转
5. 颜色预览
6. 一键复制颜色值
7. 生成 CSS 变量
8. 收藏颜色
9. 最近颜色记录
```

工具函数要求：

```ts
hexToRgb(hex: string): RGB
rgbToHex(r: number, g: number, b: number): string
rgbToHsl(r: number, g: number, b: number): HSL
hslToRgb(h: number, s: number, l: number): RGB
isValidHex(hex: string): boolean
```

CSS 变量输出格式：

```css
--color-primary: #1677ff;
--color-primary-rgb: 22, 119, 255;
```

---

## 12. JSON 工具功能要求

JSON 工具从 Phase 3 开始实现。

功能说明：

```txt
1. JSON 格式化
2. JSON 压缩
3. JSON 校验
4. 错误提示
5. 一键复制
6. 清空
7. 示例填充
```

格式化规则：

```txt
缩进：2 个空格
保持中文不转义
错误时展示错误行号和错误信息
```

页面布局：

```txt
左侧输入区
右侧输出区
顶部工具栏
底部错误提示区
```

---

## 13. 时间戳工具功能要求

时间戳工具从 Phase 3 开始实现。

功能说明：

```txt
1. 当前时间展示
2. 秒级时间戳
3. 毫秒级时间戳
4. 时间戳转日期
5. 日期转时间戳
6. 一键复制
7. 自动刷新当前时间
```

默认格式：

```txt
YYYY-MM-DD HH:mm:ss
```

---

## 14. 截图功能设计

截图功能从 Phase 5 开始实现。

第一版截图功能：

```txt
1. 全屏截图
2. 获取当前屏幕图像
3. 显示截图预览
4. 保存到本地
5. 复制到剪贴板
```

第二版截图功能：

```txt
1. 全屏透明截图窗口
2. 鼠标拖拽选择区域
3. Canvas 裁剪图片
4. ESC 取消截图
5. Enter 确认截图
```

第三版截图功能：

```txt
1. 矩形标注
2. 箭头标注
3. 文字标注
4. 马赛克
5. 画笔
6. 贴图置顶
```

---

## 15. 管理中心设计

管理中心用于统一管理应用自身能力，不等同于传统后台管理系统。

Phase 1 只做管理中心占位页。

Phase 2 实现：

```txt
1. 应用概览
2. 工具管理基础能力
3. 数据管理基础能力
4. 设置入口
```

远期再实现：

```txt
1. 快捷键自定义
2. 账号与登录
3. 同步设置
4. 插件管理
5. 自动更新
```

应用概览展示内容：

```txt
应用版本
剪贴板记录数量
收藏颜色数量
已启用工具数量
快捷键启用状态
存储占用大小
更新状态
```

工具管理用于控制工具是否启用、排序和展示：

```txt
支持启用 / 禁用工具
支持调整工具排序
支持设置首页常用工具
支持查看工具版本
支持查看工具说明
```

数据管理用于处理本地数据：

```txt
查看本地数据占用
清空剪贴板历史
清空颜色收藏
导出配置
导入配置
重置应用
```

账号与登录不进入 MVP。后续如果接入账号系统，可以支持：

```txt
账号登录
退出登录
用户信息展示
会员状态
云端同步
多设备数据同步
```

登录能力不应该影响本地工具的基本使用。

---

## 16. 状态管理设计

使用 Zustand。

### 16.1 app-store

```ts
interface AppStore {
  activeTool: string;
  theme: "light" | "dark";
  setActiveTool: (tool: string) => void;
  setTheme: (theme: "light" | "dark") => void;
}
```

### 16.2 clipboard-store

```ts
interface ClipboardStore {
  list: ClipboardItem[];
  keyword: string;
  setList: (list: ClipboardItem[]) => void;
  setKeyword: (keyword: string) => void;
  removeItem: (id: string) => void;
  clearList: () => void;
}
```

---

## 17. 本地存储设计

Phase 2 使用 `electron-store`。

需要存储：

```txt
clipboard.history
color.favorites
color.recent
app.theme
app.shortcuts
app.windowBounds
app.enabledTools
management.toolOrder
```

数据结构示例：

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
  "user": {
    "isLoggedIn": false,
    "profile": null,
    "syncEnabled": false
  },
  "management": {
    "toolOrder": ["clipboard", "color", "json", "timestamp"],
    "autoUpdate": false,
    "lastCheckUpdateTime": null
  }
}
```

---

## 18. 快捷键设计

默认快捷键：

```txt
Alt + Space：显示 / 隐藏主窗口
Alt + V：打开剪贴板
Alt + A：截图
Alt + C：打开调色板
```

Phase 1 只实现：

```txt
Alt + Space：显示 / 隐藏主窗口
```

Phase 4 前需要补齐：

```txt
快捷键注册失败时给出提示
退出应用时注销全部快捷键
```

快捷键自定义属于 Phase 6 远期能力。

---

## 19. 安全要求

Electron 安全配置要求：

```txt
关闭 nodeIntegration
开启 contextIsolation
不要直接暴露 ipcRenderer
不要在渲染进程执行任意 Node.js API
IPC 通信需要白名单
IPC handler 需要校验 sender
本地文件路径需要校验
外部链接用 shell.openExternal 打开
不要允许任意页面导航
不要加载不可信远程内容
```

---

## 20. 打包要求

Phase 4 使用 electron-builder 打包 Windows exe。

打包目标：

```txt
Windows x64
NSIS 安装包
可执行 exe
桌面快捷方式
开始菜单快捷方式
```

package.json 示例：

```json
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "build:win": "electron-vite build && electron-builder --win"
  },
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

---

## 21. 开发顺序

请严格按照以下顺序开发：

```txt
1. Phase 1：基础工程壳
2. Phase 2：本地配置与管理中心基础
3. Phase 3：核心离线工具
4. Phase 4：打包与 MVP 稳定
5. Phase 5：截图与扩展工具
6. Phase 6：远期增强能力
```

Phase 1 内部顺序：

```txt
1. 初始化 Electron + React + TypeScript 项目
2. 配置 Tailwind CSS
3. 配置 shadcn/ui 基础能力
4. 创建主窗口
5. 实现托盘
6. 实现 Alt + Space 快捷键
7. 实现 preload API
8. 创建 shared 类型和 IPC channel
9. 创建 Zustand app-store
10. 创建基础布局
11. 创建首页和页面占位
12. 运行 pnpm build 验证
```

---

## 22. AI 开发要求

开发时请遵守以下要求：

```txt
1. 使用 TypeScript，不要写 any，必要时定义 interface。
2. React 组件使用函数组件。
3. 状态管理使用 Zustand。
4. 样式使用 Tailwind CSS。
5. Electron 原生能力只能放在 main 或 preload 中。
6. 渲染进程不能直接访问 Node.js。
7. 代码需要模块化，不要全部写在一个文件里。
8. 每个功能模块需要有独立目录。
9. 公共工具函数放到 utils。
10. IPC 通信统一放到 src/main/ipc。
11. 组件命名使用 PascalCase。
12. 文件命名使用 kebab-case 或 index.tsx，保持统一。
13. 代码注释使用中文。
14. 页面文案使用中文。
15. UI 风格保持一致，采用苹果式毛玻璃视觉。
16. 文本文件使用 UTF-8 without BOM。
17. 不要一次性实现后续阶段能力。
```

---

## 23. 测试与验收要求

每个阶段都需要运行：

```bash
pnpm build
```

如果项目配置了 lint，则同时运行：

```bash
pnpm lint
```

Phase 1 手测清单：

```txt
1. 应用可以启动
2. 主窗口尺寸符合要求
3. 关闭窗口后应用隐藏到托盘
4. 托盘点击可以显示 / 隐藏窗口
5. 托盘菜单可以退出应用
6. Alt + Space 可以显示 / 隐藏窗口
7. 页面菜单切换正常
8. 控制台无明显报错
```

后续纯函数工具优先补单元测试：

```txt
颜色转换
JSON 错误定位
时间戳转换
编码转换
```

剪贴板和截图属于系统能力，使用手测 + IPC handler 边界测试。
