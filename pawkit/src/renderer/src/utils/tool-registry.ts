import type { LucideIcon } from 'lucide-react'
import { TOOL_IDS, isToolId, type ToolId } from '../../../shared/constants'
import {
  Home,
  Clipboard,
  Palette,
  Camera,
  Braces,
  Clock,
  Binary,
  Map,
  QrCode,
  Video,
  SendHorizontal,
  Regex,
  FileDiff,
  CaseSensitive,
  Settings,
  Sliders
} from 'lucide-react'

export interface ExtendedToolMeta {
  id: ToolId
  name: string
  icon: LucideIcon
  description: string
  phase: number
  canDisable: boolean
}

export const toolRegistry: ExtendedToolMeta[] = [
  {
    id: TOOL_IDS.HOME,
    name: '首页',
    icon: Home,
    description: '常用工具和最近使用',
    phase: 1,
    canDisable: false
  },
  {
    id: TOOL_IDS.CLIPBOARD,
    name: '剪贴板',
    icon: Clipboard,
    description: '剪贴板历史管理',
    phase: 3,
    canDisable: true
  },
  {
    id: TOOL_IDS.COLOR_PICKER,
    name: '调色板',
    icon: Palette,
    description: '颜色转换和管理',
    phase: 3,
    canDisable: true
  },
  {
    id: TOOL_IDS.SCREENSHOT,
    name: '截图',
    icon: Camera,
    description: '屏幕截图工具',
    phase: 5,
    canDisable: true
  },
  {
    id: TOOL_IDS.JSON_TOOL,
    name: 'JSON 工具',
    icon: Braces,
    description: 'JSON 格式化和校验',
    phase: 3,
    canDisable: true
  },
  {
    id: TOOL_IDS.TIMESTAMP_TOOL,
    name: '时间戳',
    icon: Clock,
    description: '时间戳转换工具',
    phase: 3,
    canDisable: true
  },
  {
    id: TOOL_IDS.BASE64_TOOL,
    name: '编码转换',
    icon: Binary,
    description: 'Base64、URL、JWT、Data URL 本地转换与调试',
    phase: 5,
    canDisable: true
  },
  {
    id: TOOL_IDS.QRCODE,
    name: '二维码',
    icon: QrCode,
    description: '文本、URL、WiFi 和名片二维码',
    phase: 5,
    canDisable: true
  },
  {
    id: TOOL_IDS.MEDIA_PLAYER,
    name: '媒体播放器',
    icon: Video,
    description: '本地音视频与 HTTP/HLS 串流调试',
    phase: 5,
    canDisable: true
  },
  {
    id: TOOL_IDS.HTTP_API_TOOL,
    name: 'API 调试',
    icon: SendHorizontal,
    description: 'HTTP 请求、响应预览、历史收藏与代码生成',
    phase: 5,
    canDisable: true
  },
  {
    id: TOOL_IDS.GEOSPATIAL,
    name: '地理空间',
    icon: Map,
    description: '地理数据读写、地图编辑与空间处理',
    phase: 5,
    canDisable: true
  },
  {
    id: TOOL_IDS.REGEX_TOOL,
    name: '正则表达式',
    icon: Regex,
    description: '正则匹配、捕获组、替换预览与模板',
    phase: 5,
    canDisable: true
  },
  {
    id: TOOL_IDS.TEXT_DIFF,
    name: '文本 Diff',
    icon: FileDiff,
    description: '文本对比、差异高亮与补丁生成',
    phase: 5,
    canDisable: true
  },
  {
    id: TOOL_IDS.TEXT_TOOLBOX,
    name: '文本处理',
    icon: CaseSensitive,
    description: '大小写、命名、行处理、提取和模板替换',
    phase: 5,
    canDisable: true
  },
  {
    id: TOOL_IDS.MANAGEMENT,
    name: '管理中心',
    icon: Settings,
    description: '应用管理和配置',
    phase: 2,
    canDisable: false
  },
  {
    id: TOOL_IDS.SETTINGS,
    name: '设置',
    icon: Sliders,
    description: '应用设置',
    phase: 1,
    canDisable: false
  }
]

export const toolRegistryById = Object.fromEntries(toolRegistry.map((tool) => [tool.id, tool])) as Record<ToolId, ExtendedToolMeta>

export function getToolMeta(toolId: string): ExtendedToolMeta | undefined {
  return isToolId(toolId) ? toolRegistryById[toolId] : undefined
}

export function getDisableableTools(): ExtendedToolMeta[] {
  return toolRegistry.filter((tool) => tool.canDisable)
}
