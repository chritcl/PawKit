import { describe, expect, it } from 'vitest'
import {
  addJsonChildAtPath,
  buildJsonTree,
  collectExpandablePaths,
  compressJson,
  countJsonNodes,
  createDefaultExpandedPaths,
  diffJsonValues,
  formatJson,
  parseJsonInput,
  queryJsonPath,
  renameJsonKeyAtPath,
  removeJsonValueAtPath,
  searchJsonValue,
  setJsonValueAtPath,
  sortJson,
  validateJson
} from './json'

describe('JSON 工具函数', () => {
  it('格式化严格 JSON 并保留中文', () => {
    const result = formatJson('{"name":"噗噗","count":2}', 'strict')

    expect(result.success).toBe(true)
    expect(result.result).toContain('"name": "噗噗"')
    expect(result.result).not.toContain('\\u')
  })

  it('压缩严格 JSON', () => {
    const result = compressJson('{\n  "name": "PawKit"\n}', 'strict')

    expect(result.success).toBe(true)
    expect(result.result).toBe('{"name":"PawKit"}')
  })

  it('支持 JSONC 注释和尾逗号，并输出标准 JSON', () => {
    const result = formatJson(`{
      // 注释
      "name": "PawKit",
    }`, 'jsonc')

    expect(result.success).toBe(true)
    expect(result.result).toBe('{\n  "name": "PawKit"\n}')
  })

  it('严格模式拒绝 JSONC 注释', () => {
    const result = validateJson('{\n  // 注释\n  "name": "PawKit"\n}', 'strict')

    expect(result.valid).toBe(false)
    expect(result.diagnostic?.line).toBe(2)
  })

  it('递归排序对象键名但保持数组顺序', () => {
    const result = sortJson('{"b":2,"a":{"d":4,"c":3},"list":[{"z":1,"a":2}]}', 'strict')

    expect(result.success).toBe(true)
    expect(result.result).toBe(`{
  "a": {
    "c": 3,
    "d": 4
  },
  "b": 2,
  "list": [
    {
      "a": 2,
      "z": 1
    }
  ]
}`)
  })

  it('返回错误行列', () => {
    const result = parseJsonInput('{\n  "name": "PawKit",\n}', 'strict')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.diagnostic.line).toBeGreaterThanOrEqual(2)
      expect(result.diagnostic.column).toBeGreaterThanOrEqual(1)
    }
  })

  it('生成可编辑树并支持任意层级展开集合', () => {
    const value = { user: { name: 'PawKit', tags: ['tool'] } }
    const tree = buildJsonTree(value)
    const defaultExpanded = createDefaultExpandedPaths(value)
    const allExpanded = collectExpandablePaths(value)

    expect(tree.children[0].key).toBe('user')
    expect(defaultExpanded.has('$')).toBe(true)
    expect(defaultExpanded.has('$.user')).toBe(true)
    expect(allExpanded.has('$.user.tags')).toBe(true)
  })

  it('支持树节点改值、重命名、添加和删除', () => {
    let value: unknown = { user: { name: 'PawKit' } }
    value = setJsonValueAtPath(value, ['user', 'name'], 'PawKit Pro')
    const renamed = renameJsonKeyAtPath(value, ['user', 'name'], 'title')
    expect(renamed.success).toBe(true)
    if (renamed.success) value = renamed.value

    const added = addJsonChildAtPath(value, ['user'], 'number', 'count')
    expect(added.success).toBe(true)
    if (added.success) value = added.value

    value = removeJsonValueAtPath(value, ['user', 'title'])
    expect(JSON.stringify(value)).toBe('{"user":{"count":0}}')
  })

  it('支持普通搜索并统计节点数量', () => {
    const value = { users: [{ id: 1, name: '噗噗' }, { id: 2, name: 'PawKit' }] }
    const matches = searchJsonValue(value, 'name')

    expect(matches.map((item) => item.pathText)).toEqual(['$.users[0].name', '$.users[1].name'])
    expect(countJsonNodes(value)).toBe(8)
  })

  it('支持 JSONPath 通配符和递归查询', () => {
    const value = { users: [{ id: 1, name: '噗噗' }, { id: 2, name: 'PawKit' }] }
    const wildcard = queryJsonPath(value, '$.users[*].name')
    const recursive = queryJsonPath(value, '$..id')

    expect(wildcard.success).toBe(true)
    expect(recursive.success).toBe(true)
    if (wildcard.success) {
      expect(wildcard.matches.map((item) => item.value)).toEqual(['噗噗', 'PawKit'])
    }
    if (recursive.success) {
      expect(recursive.matches.map((item) => item.pathText)).toEqual(['$.users[0].id', '$.users[1].id'])
    }
  })

  it('JSONPath 输入错误时返回中文提示', () => {
    const result = queryJsonPath({ name: 'PawKit' }, 'name')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('$')
    }
  })

  it('按语义比较 JSON 并忽略对象键名顺序', () => {
    const same = diffJsonValues({ b: 2, a: 1 }, { a: 1, b: 2 })
    const changed = diffJsonValues(
      { id: 1, user: { name: 'PawKit', enabled: true }, removed: null },
      { id: '1', user: { name: 'PawKit Pro', enabled: true }, added: 2 }
    )

    expect(same).toEqual([])
    expect(changed.map((item) => [item.kind, item.pathText])).toEqual([
      ['added', '$.added'],
      ['type-changed', '$.id'],
      ['removed', '$.removed'],
      ['modified', '$.user.name']
    ])
  })
})
