# Windows 桌面工具箱技术开发文档

## 1. 项目名称

暂定名称：**PawKit**

项目类型：Windows 桌面端开发者工具箱。

核心目标：开发一个常驻 Windows 系统托盘的效率工具箱，支持剪贴板历史、调色板、截图、JSON 格式化、时间戳转换、Base64 编解码等常用功能。

------

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
```

说明：

- Electron 负责桌面端原生能力，例如托盘、快捷键、窗口、剪贴板、截图、本地文件读写。
- React 负责渲染界面。
- Vite 负责前端构建和开发环境。
- TypeScript 负责类型约束。
- Zustand 负责轻量状态管理。
- Tailwind CSS + shadcn/ui 负责 UI 样式。
- electron-vite 负责 Electron + Vite 项目工程化。
- electron-builder 负责打包 Windows exe。

------

## 3. 产品定位

PawKit 是一个面向 Windows 用户的轻量桌面效率工具箱，默认离线可用，核心能力包括剪贴板历史、调色板、截图、JSON 格式化、时间戳转换等常用工具。

应用内置「管理中心」，用于统一管理工具启用状态、快捷键、本地数据、账号登录、同步配置、插件扩展和自动更新能力。

管理中心服务于应用自身配置，不是传统业务后台管理系统。

整体形态：

```txt
系统托盘常驻
全局快捷键唤起
小窗口工具面板
本地数据存储
离线可用
启动速度快
界面简洁
```

参考产品方向：

```txt
uTools
PowerToys
Snipaste
Ditto
Raycast
```

------

## 4. 核心功能规划

### 4.1 第一阶段 MVP 功能

第一阶段优先完成以下功能：

```txt
1. 应用主窗口
2. 系统托盘
3. 全局快捷键唤起
4. 剪贴板文本历史
5. 调色板颜色转换
6. JSON 格式化
7. 时间戳转换
8. 本地配置存储
9. Windows exe 打包
```

### 4.2 第二阶段功能

```txt
1. 屏幕截图
2. 区域截图
3. 截图复制到剪贴板
4. 截图保存到本地
5. 屏幕取色
6. 颜色收藏
7. Base64 编解码
8. URL 编解码
9. 二维码生成
```

### 4.3 第三阶段功能

```txt
1. 截图标注
2. 截图贴图置顶
3. OCR 文字识别
4. 插件式工具扩展
5. 工具搜索命令面板
6. 快捷键自定义
7. 自动更新
```

------

## 5. 项目初始化要求

使用 electron-vite 初始化项目。

命令：

```bash
pnpm create electron-vite dev-toolbox
```

模板选择：

```txt
React
TypeScript
```

安装依赖：

```bash
cd dev-toolbox
pnpm install
```

启动项目：

```bash
pnpm dev
```

额外安装依赖：

```bash
pnpm add zustand
pnpm add electron-store
pnpm add clsx tailwind-merge
pnpm add lucide-react
pnpm add dayjs
pnpm add nanoid
pnpm add prettier
```

安装 Tailwind CSS：

```bash
pnpm add -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

------

## 6. 推荐项目目录结构

请按照以下结构组织项目：

```txt
dev-toolbox/
├─ src/
│  ├─ main/
│  │  ├─ index.ts
│  │  ├─ window.ts
│  │  ├─ tray.ts
│  │  ├─ shortcuts.ts
│  │  ├─ store.ts
│  │  └─ ipc/
│  │     ├─ index.ts
│  │     ├─ clipboard.ts
│  │     ├─ screenshot.ts
│  │     ├─ color.ts
│  │     ├─ file.ts
│  │     └─ setting.ts
│  │
│  ├─ preload/
│  │  ├─ index.ts
│  │  └─ types.ts
│  │
│  └─ renderer/
│     └─ src/
│        ├─ main.tsx
│        ├─ App.tsx
│        ├─ router/
│        │  └─ index.tsx
│        ├─ pages/
├─ 				Home/
├─ 				Tools/
│  				├─ Clipboard/
│  				├─ ColorPicker/
│  				├─ Screenshot/
│  				├─ JsonTool/
│  				├─ TimestampTool/
│  				└─ Base64Tool/
├─ 				Management/
│  				├─ Dashboard/
│  				├─ ToolManage/
│  				├─ ShortcutManage/
│  				├─ DataManage/
│  				├─ PluginManage/
│  				└─ UpdateManage/
├─ 				Auth/
│  				├─ Login/
│  				└─ Profile/
└─ 				Settings/
│        ├─ components/
│        │  ├─ layout/
│        │  ├─ common/
│        │  └─ ui/
│        ├─ hooks/
│        ├─ stores/
│        │  ├─ appStore.ts
│        │  ├─ clipboardStore.ts
│        │  └─ settingStore.ts
│        ├─ utils/
│        │  ├─ color.ts
│        │  ├─ date.ts
│        │  ├─ json.ts
│        │  └─ format.ts
│        ├─ types/
│        │  └─ electron.d.ts
│        └─ styles/
│           └─ index.css
│
├─ resources/
│  └─ icon.ico
│
├─ package.json
├─ electron.vite.config.ts
├─ tsconfig.json
└─ README.md
```

------

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

### 7.1 窗口要求

主窗口要求：

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

------

## 8. Preload 通信规范

所有 Electron 能力必须通过 preload 暴露给 React 页面。

禁止在页面中直接使用：

```ts
import { ipcRenderer } from 'electron'
```

需要通过：

```ts
contextBridge.exposeInMainWorld('electronAPI', {
  clipboard: {},
  screenshot: {},
  setting: {},
  app: {}
})
```

### 8.1 window.electronAPI 类型设计

需要声明全局类型：

```ts
export {}

declare global {
  interface Window {
    electronAPI: {
      clipboard: {
        readText: () => Promise<string>
        writeText: (text: string) => Promise<boolean>
        getHistory: () => Promise<ClipboardItem[]>
        clearHistory: () => Promise<boolean>
        removeItem: (id: string) => Promise<boolean>
      }
      app: {
        showWindow: () => Promise<void>
        hideWindow: () => Promise<void>
        quit: () => Promise<void>
      }
      setting: {
        get: <T = unknown>(key: string) => Promise<T>
        set: (key: string, value: unknown) => Promise<boolean>
      }
      screenshot: {
        captureScreen: () => Promise<string>
      }
    }
  }
}

export interface ClipboardItem {
  id: string
  type: 'text' | 'image'
  content: string
  favorite: boolean
  createdAt: string
}
```

------

## 9. 剪贴板功能要求

### 9.1 功能说明

剪贴板模块需要实现：

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

### 9.2 数据结构

```ts
export interface ClipboardItem {
  id: string
  type: 'text' | 'image'
  content: string
  favorite: boolean
  createdAt: string
}
```

### 9.3 默认限制

```txt
最大保存数量：200 条
轮询间隔：800ms
忽略空文本
忽略重复文本
超过最大数量时删除最旧记录
收藏内容不自动删除
```

### 9.4 页面交互

剪贴板页面需要包含：

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

------

## 10. 调色板功能要求

### 10.1 功能说明

调色板模块需要实现：

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

### 10.2 工具函数要求

需要实现以下工具函数：

```ts
hexToRgb(hex: string): RGB
rgbToHex(r: number, g: number, b: number): string
rgbToHsl(r: number, g: number, b: number): HSL
hslToRgb(h: number, s: number, l: number): RGB
isValidHex(hex: string): boolean
```

### 10.3 CSS 变量输出格式

```css
--color-primary: #1677ff;
--color-primary-rgb: 22, 119, 255;
```

------

## 11. JSON 工具功能要求

JSON 工具需要实现：

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

------

## 12. 时间戳工具功能要求

时间戳工具需要实现：

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

------

## 13. 截图功能设计

截图功能分阶段开发。

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

------

## 14. UI 设计要求

整体 UI 风格：

```txt
现代
简洁
暗色优先
圆角卡片
柔和阴影
开发者工具风格
```

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
工具箱
剪贴板
调色板
截图
JSON 工具
时间戳
Base64
管理中心
设置
```

管理中心：

```
应用概览
工具管理
快捷键管理
数据管理
账号中心
插件管理
自动更新
关于应用
```

首页展示：

```txt
常用工具卡片
最近使用工具
快捷键提示
应用版本
```

------

## 15. 管理中心设计

管理中心用于统一管理应用自身能力，不等同于传统后台管理系统。

### 15.1 管理中心包含模块

```txt
1. 应用概览
2. 工具管理
3. 快捷键管理
4. 数据管理
5. 账号与登录
6. 同步设置
7. 插件管理
8. 自动更新
9. 关于应用
```

### 15.2 应用概览

展示内容：

```
应用版本
当前登录状态
剪贴板记录数量
收藏颜色数量
已启用工具数量
快捷键启用状态
存储占用大小
更新状态
```

### 15.3 工具管理

工具管理用于控制工具是否启用、排序和展示。

```
支持启用 / 禁用工具
支持调整工具排序
支持设置首页常用工具
支持查看工具版本
支持查看工具说明
```

### 15.4 快捷键管理

快捷键管理用于统一配置全局快捷键。

```
显示当前快捷键
支持修改快捷键
检测快捷键冲突
快捷键注册失败时提示
支持恢复默认快捷键
```

### 15.5 数据管理

数据管理用于处理本地数据。

```
查看本地数据占用
清空剪贴板历史
清空颜色收藏
导出配置
导入配置
重置应用
```

### 15.6 账号与登录

第一版不强制登录，默认离线可用。

后续如果接入账号系统，可以支持：

```
账号登录
退出登录
用户信息展示
会员状态
云端同步
多设备数据同步
```

登录能力不应该影响本地工具的基本使用。

## 16. 状态管理设计

使用 Zustand。

### 16.1 appStore

```ts
interface AppStore {
  activeTool: string
  theme: 'light' | 'dark'
  setActiveTool: (tool: string) => void
  setTheme: (theme: 'light' | 'dark') => void
}
```

### 16.2 clipboardStore

```ts
interface ClipboardStore {
  list: ClipboardItem[]
  keyword: string
  setList: (list: ClipboardItem[]) => void
  setKeyword: (keyword: string) => void
  removeItem: (id: string) => void
  clearList: () => void
}
```

------

## 17. 本地存储设计

第一版使用 `electron-store`。

需要存储：

```txt
clipboard.history
color.favorites
color.recent
app.theme
app.shortcuts
app.windowBounds
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
      "screenshot": "Alt+A"
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
    "toolOrder": [],
    "autoUpdate": true,
    "lastCheckUpdateTime": null
  }
}
```

------

## 18. 快捷键设计

默认快捷键：

```txt
Alt + Space：显示 / 隐藏主窗口
Alt + V：打开剪贴板
Alt + A：截图
Alt + C：打开调色板
```

要求：

```txt
快捷键注册失败时给出提示
退出应用时注销全部快捷键
后续支持用户自定义快捷键
```

------

## 19. 安全要求

Electron 安全配置要求：

```txt
关闭 nodeIntegration
开启 contextIsolation
不要直接暴露 ipcRenderer
不要在渲染进程执行任意 Node.js API
IPC 通信需要白名单
本地文件路径需要校验
外部链接用 shell.openExternal 打开
```

------

## 20. 打包要求

使用 electron-builder 打包 Windows exe。

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
    "appId": "com.devtoolbox.app",
    "productName": "Dev Toolbox",
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

------

## 21. 开发顺序

请严格按照以下顺序开发：

```txt
1. 初始化 Electron + React + TypeScript 项目
2. 配置 Tailwind CSS
3. 创建基础布局
4. 创建主窗口
5. 实现托盘
6. 实现快捷键
7. 实现 preload API
8. 实现本地存储
9. 实现剪贴板模块
10. 实现调色板模块
11. 实现 JSON 工具
12. 实现时间戳工具
13. 实现设置页
14. 实现截图基础功能
15. 配置打包
16. 测试 Windows exe
```

------

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
15. UI 风格保持一致。
```

------

## 23. 验收标准

第一版完成后需要满足：

```txt
1. Windows 可以正常启动应用
2. 应用关闭后隐藏到托盘，不直接退出
3. 托盘菜单可以打开和退出应用
4. Alt + Space 可以显示 / 隐藏主窗口
5. 剪贴板可以自动记录文本历史
6. 点击剪贴板历史可以重新复制
7. JSON 工具可以正常格式化和校验
8. 时间戳工具可以正常转换
9. 调色板可以完成颜色格式转换
10. 应用可以成功打包为 Windows exe
```

------

## 24. 第一轮开发任务

请先完成第一轮基础工程，不要一次性实现所有功能。

第一轮只做：

```txt
1. Electron + React + TypeScript 项目基础架构
2. Tailwind CSS 配置
3. 主窗口
4. 系统托盘
5. 全局快捷键 Alt + Space
6. 左侧菜单 + 右侧内容区布局
7. 首页
8. 管理中心页面占位
9. 设置页占位
10. 剪贴板页面占位
11. 调色板页面占位
12. JSON 工具页面占位
13. 时间戳工具页面占位
```

完成后再继续开发具体功能。

------

## 25. 给 AI 的执行提示词

可以把下面这段作为开头直接发给 AI 编程助手：

```txt
你现在是一个资深 Electron + React + TypeScript 桌面应用开发工程师。

我要开发一个 Windows 桌面工具箱，技术栈是 Electron + React + Vite + TypeScript + Zustand + Tailwind CSS + electron-vite。

请根据我提供的技术开发文档，先搭建项目基础架构。第一轮只需要完成基础工程、主窗口、托盘、快捷键、基础布局和各功能页面占位，不要一次性实现所有功能。

要求：
1. 代码必须模块化。
2. Electron 主进程、preload、renderer 目录职责清晰。
3. 渲染进程不能直接调用 Node.js。
4. 所有 Electron 能力通过 preload 暴露。
5. 所有注释使用中文。
6. 页面文案使用中文。
7. 使用 TypeScript，尽量不要使用 any。
8. 使用 Tailwind CSS 完成界面。
9. 给出完整文件结构和关键代码。
10. 每一步修改都说明原因。
```
