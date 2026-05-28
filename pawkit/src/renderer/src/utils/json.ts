// JSON 工具函数

// 解析 JSON 错误并返回中文提示
function parseJsonError(json: string, error: Error): string {
  const message = error.message

  // 尝试提取错误位置（V8 引擎格式：position N）
  const posMatch = message.match(/position (\d+)/)
  if (posMatch) {
    const pos = parseInt(posMatch[1])
    const lines = json.substring(0, pos).split('\n')
    const line = lines.length
    const col = lines[lines.length - 1].length + 1

    // 翻译常见错误信息
    if (message.includes('Unexpected token')) {
      const tokenMatch = message.match(/Unexpected token (.) /)
      const token = tokenMatch ? tokenMatch[1] : '未知'
      return `第 ${line} 行，第 ${col} 列：意外的字符 "${token}"`
    }
    if (message.includes('Unexpected end of JSON input')) {
      return `第 ${line} 行，第 ${col} 列：JSON 不完整，意外结束`
    }
    if (message.includes('Expected')) {
      return `第 ${line} 行，第 ${col} 列：缺少预期的字符`
    }

    return `第 ${line} 行，第 ${col} 列：${message}`
  }

  // 其他错误翻译
  if (message.includes('Unexpected end of JSON input')) {
    return 'JSON 不完整，意外结束'
  }
  if (message.includes('Unexpected token')) {
    return 'JSON 包含意外的字符'
  }
  if (message.includes('is not valid JSON')) {
    return '输入的文本不是有效的 JSON 格式'
  }

  return `JSON 解析错误：${message}`
}

// 格式化 JSON（2 空格缩进，保持中文不转义）
export function formatJson(json: string): { success: boolean; result: string; error?: string } {
  try {
    const parsed = JSON.parse(json)
    const formatted = JSON.stringify(parsed, null, 2)
    return { success: true, result: formatted }
  } catch (error) {
    return { success: false, result: '', error: parseJsonError(json, error as Error) }
  }
}

// 压缩 JSON
export function compressJson(json: string): { success: boolean; result: string; error?: string } {
  try {
    const parsed = JSON.parse(json)
    const compressed = JSON.stringify(parsed)
    return { success: true, result: compressed }
  } catch (error) {
    return { success: false, result: '', error: parseJsonError(json, error as Error) }
  }
}

// 校验 JSON
export function validateJson(json: string): { valid: boolean; error?: string } {
  try {
    JSON.parse(json)
    return { valid: true }
  } catch (error) {
    return { valid: false, error: parseJsonError(json, error as Error) }
  }
}

// 示例 JSON
export const exampleJson = `{
  "name": "PawKit",
  "version": "0.0.1",
  "description": "Windows 桌面效率工具箱",
  "features": [
    "剪贴板历史",
    "JSON 工具",
    "时间戳转换",
    "调色板"
  ],
  "author": {
    "name": "噗噗",
    "role": "开发者"
  },
  "isAwesome": true,
  "score": 99.5
}`
