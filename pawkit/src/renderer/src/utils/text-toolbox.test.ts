import { describe, expect, it } from 'vitest'
import {
  addLineAffixes,
  convertFullHalfWidth,
  convertLineEndings,
  convertNaming,
  convertTabsAndSpaces,
  decodeUnicodeEscapes,
  encodeUnicodeEscapes,
  extractTextItems,
  formatTextStats,
  parseSeparator,
  replaceTemplateVariables,
  shuffleLines,
  splitOrJoinBySeparator,
  transformCase,
  transformLines
} from './text-toolbox'

describe('文本处理工具箱函数', () => {
  it('支持大小写转换并保留中文', () => {
    expect(transformCase('pawkit 文本 TOOL', 'upper')).toBe('PAWKIT 文本 TOOL')
    expect(transformCase('pawkit 文本 TOOL', 'lower')).toBe('pawkit 文本 tool')
    expect(transformCase('hello world\npawkit 文本', 'title')).toBe('Hello World\nPawkit 文本')
    expect(transformCase('hello world. pawkit 文本\nsecond line', 'sentence')).toBe('Hello world. Pawkit 文本\nSecond line')
  })

  it('支持驼峰、帕斯卡、短横线和下划线命名转换', () => {
    expect(convertNaming('user_name demoText-工具', 'camel')).toBe('userNameDemoText工具')
    expect(convertNaming('user_name demoText-工具', 'pascal')).toBe('UserNameDemoText工具')
    expect(convertNaming('userName demoText 工具', 'kebab')).toBe('user-name-demo-text-工具')
    expect(convertNaming('userName demoText 工具', 'snake')).toBe('user_name_demo_text_工具')
  })

  it('支持行清理、排序、去重、反转和编号', () => {
    const text = '  beta  \n\nalpha\nbeta\n  alpha  '

    expect(transformLines(text, 'remove-empty')).toBe('  beta  \nalpha\nbeta\n  alpha  ')
    expect(transformLines(text, 'trim')).toBe('beta\n\nalpha\nbeta\nalpha')
    expect(transformLines('a   b\t\tc', 'merge-spaces')).toBe('a b c')
    expect(transformLines('b\na\nc', 'sort-asc')).toBe('a\nb\nc')
    expect(transformLines('b\na\nc', 'sort-desc')).toBe('c\nb\na')
    expect(transformLines('b\na\nb\na', 'unique')).toBe('b\na')
    expect(transformLines('b\na\nc', 'reverse')).toBe('c\na\nb')
    expect(transformLines('b\na', 'number')).toBe('1. b\n2. a')
  })

  it('支持逐行添加前缀和后缀', () => {
    expect(addLineAffixes('a\n\nb', '> ', ' ;')).toBe('> a ;\n>  ;\n> b ;')
  })

  it('支持分隔符转义和拆分合并', () => {
    expect(parseSeparator('\\t')).toBe('\t')
    expect(parseSeparator('\\r\\n')).toBe('\r\n')
    expect(splitOrJoinBySeparator('a,b,,c', ',', 'split')).toBe('a\nb\n\nc')
    expect(splitOrJoinBySeparator('a\nb\n\nc', '|', 'join')).toBe('a|b||c')
  })

  it('按出现顺序提取 URL、邮箱、中国大陆手机号和 IP', () => {
    const text = '访问 https://pawkit.dev，联系 hi@pawkit.dev 或 +86 138-0013-8000，服务器 192.168.1.1 与 2001:db8::1'

    expect(extractTextItems(text, 'url')).toEqual(['https://pawkit.dev'])
    expect(extractTextItems(text, 'email')).toEqual(['hi@pawkit.dev'])
    expect(extractTextItems(text, 'phone-cn')).toEqual(['+86 138-0013-8000'])
    expect(extractTextItems(text, 'ip')).toEqual(['192.168.1.1', '2001:db8::1'])
  })

  it('支持 Unicode 转义往返且中文不转码到源码层', () => {
    const encoded = encodeUnicodeEscapes('PawKit 文本😀')

    expect(encoded).toBe('\\u0050\\u0061\\u0077\\u004b\\u0069\\u0074\\u0020\\u6587\\u672c\\u{1f600}')
    expect(decodeUnicodeEscapes(encoded)).toBe('PawKit 文本😀')
    expect(decodeUnicodeEscapes('\\u4f60\\u597d \\u{1f680}')).toBe('你好 🚀')
  })

  it('支持全角半角互转', () => {
    expect(convertFullHalfWidth('ＡＢＣ１２３　，！', 'half')).toBe('ABC123 ,!')
    expect(convertFullHalfWidth('ABC123 ,!', 'full')).toBe('ＡＢＣ１２３　，！')
  })

  it('支持换行符和 Tab 空格转换', () => {
    expect(convertLineEndings('a\r\nb\rc', 'lf')).toBe('a\nb\nc')
    expect(convertLineEndings('a\nb\nc', 'crlf')).toBe('a\r\nb\r\nc')
    expect(convertTabsAndSpaces('a\tb', 'tab-to-space', 2)).toBe('a  b')
    expect(convertTabsAndSpaces('a    b', 'space-to-tab', 2)).toBe('a\t\tb')
  })

  it('支持可注入随机源的行随机打乱', () => {
    expect(shuffleLines('a\nb\nc', () => 0)).toBe('b\nc\na')
  })

  it('支持模板变量替换，未配置变量保持占位符', () => {
    expect(replaceTemplateVariables('你好 {{name}}，今天是 {{day}}，{{missing}}', [
      { key: 'name', value: '噗噗' },
      { key: 'day', value: '周二' }
    ])).toBe('你好 噗噗，今天是 周二，{{missing}}')
  })

  it('统计字符、单词和行数', () => {
    expect(formatTextStats('hello PawKit\n中文 文本')).toEqual({
      characters: 18,
      words: 4,
      lines: 2,
      bytes: 26
    })
  })
})
