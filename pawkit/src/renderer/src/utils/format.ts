// Base64 编解码工具

// Base64 编码
export function base64Encode(text: string): { success: boolean; result: string; error?: string } {
  try {
    const result = btoa(unescape(encodeURIComponent(text)))
    return { success: true, result }
  } catch {
    return { success: false, result: '', error: '编码失败，输入可能包含无效字符' }
  }
}

// Base64 解码
export function base64Decode(encoded: string): { success: boolean; result: string; error?: string } {
  try {
    const result = decodeURIComponent(escape(atob(encoded)))
    return { success: true, result }
  } catch {
    return { success: false, result: '', error: '解码失败，请确保输入是有效的 Base64 字符串' }
  }
}

// URL 编码
export function urlEncode(text: string): { success: boolean; result: string; error?: string } {
  try {
    const result = encodeURIComponent(text)
    return { success: true, result }
  } catch {
    return { success: false, result: '', error: '编码失败' }
  }
}

// URL 解码
export function urlDecode(encoded: string): { success: boolean; result: string; error?: string } {
  try {
    const result = decodeURIComponent(encoded)
    return { success: true, result }
  } catch {
    return { success: false, result: '', error: '解码失败，请确保输入是有效的 URL 编码字符串' }
  }
}
