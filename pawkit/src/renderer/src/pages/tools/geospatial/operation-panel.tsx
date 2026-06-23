import { CircleDot, Eraser, Globe2, Merge, Scissors } from 'lucide-react'
import type { GeoLayer, GeoOperationRequest } from '../../../../../shared/types'
import { operationTabs, type OperationPanelId } from './types'

const unitOptions = [
  { id: 'kilometers', label: '千米' },
  { id: 'meters', label: '米' },
  { id: 'miles', label: '英里' }
]

interface OperationPanelProps {
  panel: OperationPanelId
  busy: boolean
  canEditActiveLayer: boolean
  vectorLayers: GeoLayer[]
  activeFields: string[]
  activeLayerId: string | null
  clipLayerId: string
  setClipLayerId: (value: string) => void
  simplifyTolerance: string
  setSimplifyTolerance: (value: string) => void
  bufferDistance: string
  setBufferDistance: (value: string) => void
  bufferUnits: string
  setBufferUnits: (value: string) => void
  fieldName: string
  setFieldName: (value: string) => void
  newFieldName: string
  setNewFieldName: (value: string) => void
  expression: string
  setExpression: (value: string) => void
  sortDirection: 'asc' | 'desc'
  setSortDirection: (value: 'asc' | 'desc') => void
  sourceCrs: string
  setSourceCrs: (value: string) => void
  targetCrs: string
  setTargetCrs: (value: string) => void
  runOperation: (type: GeoOperationRequest['type']) => void | Promise<void>
}

interface FieldControlProps {
  label: string
  value: string
  fields: string[]
  onChange: (value: string) => void
  placeholder: string
}

function FieldControl({ label, value, fields, onChange, placeholder }: FieldControlProps): JSX.Element {
  return (
    <label className="block text-xs text-[color:var(--text-muted)]">
      {label}
      {fields.length > 0 ? (
        <select
          className="mt-1 w-full rounded-md border border-[var(--glass-border)] bg-[var(--input-surface)] px-2 py-2 text-sm text-[color:var(--text-primary)]"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">请选择字段</option>
          {fields.map((field) => (
            <option key={field} value={field}>{field}</option>
          ))}
        </select>
      ) : (
        <input
          className="mt-1 w-full rounded-md border border-[var(--glass-border)] bg-[var(--input-surface)] px-2 py-2 text-sm text-[color:var(--text-primary)]"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      )}
    </label>
  )
}

export function OperationPanel({
  panel,
  busy,
  canEditActiveLayer,
  vectorLayers,
  activeFields,
  activeLayerId,
  clipLayerId,
  setClipLayerId,
  simplifyTolerance,
  setSimplifyTolerance,
  bufferDistance,
  setBufferDistance,
  bufferUnits,
  setBufferUnits,
  fieldName,
  setFieldName,
  newFieldName,
  setNewFieldName,
  expression,
  setExpression,
  sortDirection,
  setSortDirection,
  sourceCrs,
  setSourceCrs,
  targetCrs,
  setTargetCrs,
  runOperation
}: OperationPanelProps): JSX.Element {
  const tab = operationTabs.find((item) => item.id === panel) ?? operationTabs[0]
  const disableReason = !canEditActiveLayer
    ? tab.disabledHint
    : panel === 'attributes' && activeFields.length === 0
      ? '当前图层暂无字段；可以先在下方属性表新增字段。'
      : ''

  const header = (
    <div className="geo-operation-header">
      <div>
        <h2>{tab.title}</h2>
        <p>{tab.description}</p>
      </div>
      {disableReason && <div className="geo-operation-hint">{disableReason}</div>}
    </div>
  )

  if (panel === 'geometry') {
    return (
      <section className="space-y-3">
        {header}
        <label className="block text-xs text-[color:var(--text-muted)]">
          简化容差
          <input
            className="mt-1 w-full rounded-md border border-[var(--glass-border)] bg-[var(--input-surface)] px-2 py-2 text-sm text-[color:var(--text-primary)]"
            value={simplifyTolerance}
            onChange={(event) => setSimplifyTolerance(event.target.value)}
          />
        </label>
        <button className="toolbar-button w-full" onClick={() => void runOperation('simplify')} disabled={busy || !canEditActiveLayer}>
          <Scissors className="h-4 w-4" />
          简化几何
        </button>
        <div className="grid grid-cols-[1fr_88px] gap-2">
          <input
            className="rounded-md border border-[var(--glass-border)] bg-[var(--input-surface)] px-2 py-2 text-sm text-[color:var(--text-primary)]"
            value={bufferDistance}
            onChange={(event) => setBufferDistance(event.target.value)}
            placeholder="缓冲距离"
          />
          <select
            className="rounded-md border border-[var(--glass-border)] bg-[var(--input-surface)] px-2 py-2 text-sm text-[color:var(--text-primary)]"
            value={bufferUnits}
            onChange={(event) => setBufferUnits(event.target.value)}
          >
            {unitOptions.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </div>
        <button className="toolbar-button w-full" onClick={() => void runOperation('buffer')} disabled={busy || !canEditActiveLayer}>
          <CircleDot className="h-4 w-4" />
          生成缓冲区
        </button>
        <FieldControl
          label="融合字段"
          value={fieldName}
          fields={activeFields}
          onChange={setFieldName}
          placeholder="字段名，例如 level"
        />
        <button className="toolbar-button w-full" onClick={() => void runOperation('merge')} disabled={busy || !canEditActiveLayer}>
          <Merge className="h-4 w-4" />
          按所选字段融合
        </button>
        <select
          className="w-full rounded-md border border-[var(--glass-border)] bg-[var(--input-surface)] px-2 py-2 text-sm text-[color:var(--text-primary)]"
          value={clipLayerId}
          onChange={(event) => setClipLayerId(event.target.value)}
        >
          <option value="">选择裁剪/擦除范围图层</option>
          {vectorLayers.filter((layer) => layer.id !== activeLayerId).map((layer) => (
            <option key={layer.id} value={layer.id}>{layer.name}</option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <button className="toolbar-button" onClick={() => void runOperation('clip')} disabled={busy || !canEditActiveLayer}>
            <Scissors className="h-4 w-4" />
            裁剪
          </button>
          <button className="toolbar-button" onClick={() => void runOperation('erase')} disabled={busy || !canEditActiveLayer}>
            <Eraser className="h-4 w-4" />
            擦除
          </button>
        </div>
      </section>
    )
  }

  if (panel === 'attributes') {
    return (
      <section className="space-y-3">
        {header}
        <FieldControl
          label="目标字段"
          value={fieldName}
          fields={activeFields}
          onChange={setFieldName}
          placeholder="字段名，例如 name"
        />
        <input
          className="w-full rounded-md border border-[var(--glass-border)] bg-[var(--input-surface)] px-2 py-2 text-sm text-[color:var(--text-primary)]"
          value={newFieldName}
          onChange={(event) => setNewFieldName(event.target.value)}
          placeholder="新字段名，用于计算或派生重命名"
        />
        <textarea
          className="min-h-24 w-full resize-y rounded-md border border-[var(--glass-border)] bg-[var(--input-surface)] px-2 py-2 text-sm text-[color:var(--text-primary)]"
          value={expression}
          onChange={(event) => setExpression(event.target.value)}
          placeholder="表达式，例如 population > 100000 或 area * 2"
        />
        <div className="grid grid-cols-2 gap-2">
          <button className="toolbar-button" onClick={() => void runOperation('filter')} disabled={busy || !canEditActiveLayer}>按表达式筛选</button>
          <button className="toolbar-button" onClick={() => void runOperation('calculate')} disabled={busy || !canEditActiveLayer}>计算到新字段</button>
          <button className="toolbar-button" onClick={() => void runOperation('rename-field')} disabled={busy || !canEditActiveLayer}>派生重命名</button>
          <button className="toolbar-button" onClick={() => void runOperation('drop-field')} disabled={busy || !canEditActiveLayer}>派生删除字段</button>
        </div>
        <div className="grid grid-cols-[1fr_92px] gap-2">
          <button className="toolbar-button" onClick={() => void runOperation('sort')} disabled={busy || !canEditActiveLayer}>按字段排序</button>
          <select
            className="rounded-md border border-[var(--glass-border)] bg-[var(--input-surface)] px-2 py-2 text-sm text-[color:var(--text-primary)]"
            value={sortDirection}
            onChange={(event) => setSortDirection(event.target.value as 'asc' | 'desc')}
          >
            <option value="asc">升序</option>
            <option value="desc">降序</option>
          </select>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      {header}
      <input
        className="w-full rounded-md border border-[var(--glass-border)] bg-[var(--input-surface)] px-2 py-2 text-sm text-[color:var(--text-primary)]"
        value={sourceCrs}
        onChange={(event) => setSourceCrs(event.target.value)}
        placeholder="源 CRS，例如 EPSG:4326"
      />
      <input
        className="w-full rounded-md border border-[var(--glass-border)] bg-[var(--input-surface)] px-2 py-2 text-sm text-[color:var(--text-primary)]"
        value={targetCrs}
        onChange={(event) => setTargetCrs(event.target.value)}
        placeholder="目标 CRS 或 Proj4 字符串"
      />
      <button className="toolbar-button w-full" onClick={() => void runOperation('project')} disabled={busy || !canEditActiveLayer}>
        <Globe2 className="h-4 w-4" />
        转换投影
      </button>
      <p className="rounded-md border border-[var(--glass-border)] bg-[var(--input-surface)] px-3 py-2 text-xs leading-5 text-[color:var(--text-muted)]">
        默认支持 EPSG:4326、EPSG:3857 和完整 Proj4 字符串；未知 EPSG 不联网解析。
      </p>
    </section>
  )
}
