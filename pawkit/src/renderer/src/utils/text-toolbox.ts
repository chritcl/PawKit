export type TextCaseMode = 'upper' | 'lower' | 'title' | 'sentence'
export type NamingMode = 'camel' | 'pascal' | 'kebab' | 'snake'
export type LineTransformMode =
  | 'remove-empty'
  | 'trim'
  | 'merge-spaces'
  | 'sort-asc'
  | 'sort-desc'
  | 'unique'
  | 'reverse'
  | 'number'
export type SplitJoinMode = 'split' | 'join'
export type ExtractMode = 'url' | 'email' | 'phone-cn' | 'ip'
export type FullHalfWidthMode = 'full' | 'half'
export type LineEndingMode = 'lf' | 'crlf' | 'cr'
export type TabSpaceMode = 'tab-to-space' | 'space-to-tab'

export interface TemplateVariable {
  key: string
  value: string
}

export interface TextStats {
  characters: number
  words: number
  lines: number
  bytes: number
}

function splitLines(text: string): string[] {
  return text.split(/\r\n|\n|\r/)
}

function capitalizeWord(word: string): string {
  if (!word) return word
  return `${word[0].toLocaleUpperCase()}${word.slice(1)}`
}

function splitNamingWords(text: string): string[] {
  return text
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[\s_-]+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => word.trim())
    .filter(Boolean)
}

function normalizeWords(text: string): string[] {
  return splitNamingWords(text).map((word) => word.toLocaleLowerCase())
}

function compareLine(a: string, b: string): number {
  return a.localeCompare(b, 'zh-CN', { numeric: true, sensitivity: 'base' })
}

function collectRegexMatches(text: string, regex: RegExp, groupIndex = 0): Array<{ index: number; value: string }> {
  return Array.from(text.matchAll(regex)).map((match) => {
    const value = match[groupIndex] ?? match[0]
    const relativeIndex = match[0].indexOf(value)
    return {
      index: (match.index ?? 0) + Math.max(relativeIndex, 0),
      value
    }
  })
}

function uniqueMatches(matches: Array<{ index: number; value: string }>): string[] {
  const seen = new Set<string>()
  return matches
    .sort((a, b) => a.index - b.index)
    .map((match) => match.value)
    .filter((value) => {
      if (seen.has(value)) return false
      seen.add(value)
      return true
    })
}

export function transformCase(text: string, mode: TextCaseMode): string {
  if (mode === 'upper') return text.toLocaleUpperCase()
  if (mode === 'lower') return text.toLocaleLowerCase()
  if (mode === 'title') {
    return text.replace(/\p{L}[\p{L}\p{N}'’]*/gu, (word) => capitalizeWord(word.toLocaleLowerCase()))
  }
  return text.replace(/(^|[.!?。！？]\s+|\n+)(\p{L})/gu, (_match, prefix: string, first: string) => {
    return `${prefix}${first.toLocaleUpperCase()}`
  })
}

export function convertNaming(text: string, mode: NamingMode): string {
  const words = normalizeWords(text)
  if (words.length === 0) return ''

  if (mode === 'kebab') return words.join('-')
  if (mode === 'snake') return words.join('_')

  const pascal = words.map(capitalizeWord).join('')
  if (mode === 'pascal') return pascal
  return `${words[0]}${words.slice(1).map(capitalizeWord).join('')}`
}

export function transformLines(text: string, mode: LineTransformMode): string {
  const lines = splitLines(text)

  if (mode === 'remove-empty') return lines.filter((line) => line.trim().length > 0).join('\n')
  if (mode === 'trim') return lines.map((line) => line.trim()).join('\n')
  if (mode === 'merge-spaces') return lines.map((line) => line.replace(/[ \t]+/g, ' ')).join('\n')
  if (mode === 'sort-asc') return [...lines].sort(compareLine).join('\n')
  if (mode === 'sort-desc') return [...lines].sort(compareLine).reverse().join('\n')
  if (mode === 'unique') {
    const seen = new Set<string>()
    return lines.filter((line) => {
      if (seen.has(line)) return false
      seen.add(line)
      return true
    }).join('\n')
  }
  if (mode === 'reverse') return [...lines].reverse().join('\n')
  return lines.map((line, index) => `${index + 1}. ${line}`).join('\n')
}

export function addLineAffixes(text: string, prefix: string, suffix: string): string {
  return splitLines(text).map((line) => `${prefix}${line}${suffix}`).join('\n')
}

export function parseSeparator(separator: string): string {
  return separator
    .replace(/\\r/g, '\r')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\')
}

export function splitOrJoinBySeparator(text: string, separator: string, mode: SplitJoinMode): string {
  const parsedSeparator = parseSeparator(separator)
  if (!parsedSeparator) return text
  return mode === 'split'
    ? text.split(parsedSeparator).join('\n')
    : splitLines(text).join(parsedSeparator)
}

export function extractTextItems(text: string, mode: ExtractMode): string[] {
  if (mode === 'url') {
    return uniqueMatches(collectRegexMatches(text, /\bhttps?:\/\/[^\s<>"'，。；、)]+/gu))
  }
  if (mode === 'email') {
    return uniqueMatches(collectRegexMatches(text, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu))
  }
  if (mode === 'phone-cn') {
    return uniqueMatches(collectRegexMatches(text, /(^|[^\d])((?:\+?86[-\s]?)?1[3-9]\d[-\s]?\d{4}[-\s]?\d{4})(?=$|[^\d])/gu, 2))
  }

  const ipv4 = collectRegexMatches(text, /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/gu)
  const ipv6 = collectRegexMatches(
    text,
    /(?:\b(?:[A-F0-9]{1,4}:){7}[A-F0-9]{1,4}\b|\b(?:[A-F0-9]{1,4}:){1,6}:[A-F0-9]{1,4}\b|\b(?:[A-F0-9]{1,4}:){1,5}(?::[A-F0-9]{1,4}){1,2}\b|\b(?:[A-F0-9]{1,4}:){1,4}(?::[A-F0-9]{1,4}){1,3}\b|\b(?:[A-F0-9]{1,4}:){1,3}(?::[A-F0-9]{1,4}){1,4}\b|\b(?:[A-F0-9]{1,4}:){1,2}(?::[A-F0-9]{1,4}){1,5}\b|\b[A-F0-9]{1,4}:(?:(?::[A-F0-9]{1,4}){1,6})\b|::(?:[A-F0-9]{1,4}:){0,6}[A-F0-9]{1,4}\b|\b(?:[A-F0-9]{1,4}:){1,7}:|::)/giu
  )
  return uniqueMatches([...ipv4, ...ipv6])
}

export function encodeUnicodeEscapes(text: string): string {
  return Array.from(text).map((char) => {
    const codePoint = char.codePointAt(0) ?? 0
    if (codePoint <= 0xffff) {
      return `\\u${codePoint.toString(16).padStart(4, '0')}`
    }
    return `\\u{${codePoint.toString(16)}}`
  }).join('')
}

export function decodeUnicodeEscapes(text: string): string {
  return text.replace(/\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})/gu, (match, braced: string | undefined, fixed: string | undefined) => {
    const rawCodePoint = braced ?? fixed
    if (!rawCodePoint) return match
    const codePoint = Number.parseInt(rawCodePoint, 16)
    if (!Number.isFinite(codePoint)) return match
    try {
      return String.fromCodePoint(codePoint)
    } catch {
      return match
    }
  })
}

export function convertFullHalfWidth(text: string, mode: FullHalfWidthMode): string {
  return Array.from(text).map((char) => {
    const code = char.charCodeAt(0)
    if (mode === 'half') {
      if (code === 0x3000) return ' '
      if (code >= 0xff01 && code <= 0xff5e) return String.fromCharCode(code - 0xfee0)
      return char
    }
    if (code === 0x20) return String.fromCharCode(0x3000)
    if (code >= 0x21 && code <= 0x7e) return String.fromCharCode(code + 0xfee0)
    return char
  }).join('')
}

export function convertLineEndings(text: string, mode: LineEndingMode): string {
  const normalized = splitLines(text).join('\n')
  if (mode === 'lf') return normalized
  if (mode === 'crlf') return normalized.replace(/\n/g, '\r\n')
  return normalized.replace(/\n/g, '\r')
}

export function convertTabsAndSpaces(text: string, mode: TabSpaceMode, spaceSize: number): string {
  const safeSize = Math.max(1, Math.min(16, Math.round(spaceSize)))
  if (mode === 'tab-to-space') return text.replace(/\t/g, ' '.repeat(safeSize))
  return text.replace(new RegExp(` {${safeSize}}`, 'g'), '\t')
}

export function shuffleLines(text: string, random: () => number = Math.random): string {
  const lines = splitLines(text)
  for (let index = lines.length - 1; index > 0; index--) {
    const targetIndex = Math.floor(random() * (index + 1))
    const current = lines[index]
    lines[index] = lines[targetIndex]
    lines[targetIndex] = current
  }
  return lines.join('\n')
}

export function replaceTemplateVariables(text: string, variables: TemplateVariable[]): string {
  const valueByKey = new Map(
    variables
      .map((item) => [item.key.trim(), item.value] as const)
      .filter(([key]) => key.length > 0)
  )
  return text.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, key: string) => {
    return valueByKey.has(key.trim()) ? valueByKey.get(key.trim()) ?? '' : match
  })
}

export function formatTextStats(text: string): TextStats {
  const trimmed = text.trim()
  return {
    characters: Array.from(text).length,
    words: trimmed ? trimmed.split(/\s+/u).length : 0,
    lines: text ? splitLines(text).length : 0,
    bytes: new TextEncoder().encode(text).length
  }
}
