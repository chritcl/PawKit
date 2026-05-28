import { ToolMeta } from '../../../shared/types'
import { TOOL_IDS } from '../../../shared/constants'
import {
  Home,
  Clipboard,
  Palette,
  Camera,
  Braces,
  Clock,
  Binary,
  QrCode,
  Settings,
  Sliders
} from 'lucide-react'

// 扩展工具元数据（包含阶段信息）
export interface ExtendedToolMeta extends ToolMeta {
  phase: number
  canDisable: boolean
}

// 工具注册表
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
    name: 'Base64',
    icon: Binary,
    description: 'Base64 编解码工具',
    phase: 5,
    canDisable: true
  },
  {
    id: TOOL_IDS.QRCODE,
    name: '二维码',
    icon: QrCode,
    description: '二维码生成工具',
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

// 获取工具元数据
export function getToolMeta(toolId: string): ExtendedToolMeta | undefined {
  return toolRegistry.find((tool) => tool.id === toolId)
}

// 获取可禁用的工具列表
export function getDisableableTools(): ExtendedToolMeta[] {
  return toolRegistry.filter((tool) => tool.canDisable)
}
