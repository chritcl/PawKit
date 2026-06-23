import type { Feature, GeoJsonProperties, Geometry } from 'geojson'
import type { GeoLayer } from '../../../../../shared/types'
import type { AttributePanelMode } from './types'

interface AttributePanelProps {
  activeLayer: GeoLayer | null
  mode: AttributePanelMode
  jsonText: string
  setJsonText: (value: string) => void
  jsonDirty: boolean
  setJsonDirty: (value: boolean) => void
  jsonError: string
  setJsonError: (value: string) => void
  resetJsonEditor: () => void
  saveJsonEditor: () => void
  canEditActiveLayer: boolean
  attributeFilter: string
  setAttributeFilter: (value: string) => void
  tableFieldName: string
  setTableFieldName: (value: string) => void
  addTableField: () => void
  renameTableField: () => void
  dropTableField: () => void
  activeFields: string[]
  setFieldName: (value: string) => void
  filteredRows: Array<{ feature: Feature<Geometry, GeoJsonProperties>; index: number }>
  selectedFeatureSet: Set<string>
  featureKey: (layerId: string, featureIndex: number) => string
  focusFeature: (featureIndex: number) => void
  editFeatureProperty: (featureIndex: number, field: string, value: string) => void
}

function formatPropertyValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function geometryLabel(geometry: Geometry | null | undefined): string {
  return geometry?.type ?? '无几何'
}

export function AttributePanel({
  activeLayer,
  mode,
  jsonText,
  setJsonText,
  jsonDirty,
  setJsonDirty,
  jsonError,
  setJsonError,
  resetJsonEditor,
  saveJsonEditor,
  canEditActiveLayer,
  attributeFilter,
  setAttributeFilter,
  tableFieldName,
  setTableFieldName,
  addTableField,
  renameTableField,
  dropTableField,
  activeFields,
  setFieldName,
  filteredRows,
  selectedFeatureSet,
  featureKey,
  focusFeature,
  editFeatureProperty
}: AttributePanelProps): JSX.Element {
  if (!activeLayer) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[color:var(--text-muted)]">
        导入或新建矢量图层后，可在这里查看表格和编辑 GeoJSON。
      </div>
    )
  }

  if (mode === 'json') {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        <textarea
          className="min-h-0 flex-1 resize-none rounded-md border border-[var(--glass-border)] bg-[var(--input-surface)] p-3 font-mono text-xs leading-5 text-[color:var(--text-primary)]"
          value={jsonText}
          onChange={(event) => {
            setJsonText(event.target.value)
            setJsonDirty(true)
            setJsonError('')
          }}
          spellCheck={false}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className={`text-xs ${jsonError ? 'text-[color:var(--tone-danger)]' : 'text-[color:var(--text-muted)]'}`}>
            {jsonError || (jsonDirty ? 'JSON 有未保存修改' : 'JSON 与当前图层同步')}
          </div>
          <div className="flex gap-2">
            <button className="toolbar-button" onClick={resetJsonEditor} disabled={!canEditActiveLayer}>恢复</button>
            <button className="toolbar-button-primary" onClick={saveJsonEditor} disabled={!canEditActiveLayer}>保存 JSON</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="min-w-40 flex-1 rounded-md border border-[var(--glass-border)] bg-[var(--input-surface)] px-2 py-1.5 text-xs text-[color:var(--text-primary)]"
          value={attributeFilter}
          onChange={(event) => setAttributeFilter(event.target.value)}
          placeholder="筛选表格内容"
        />
        <input
          className="w-32 rounded-md border border-[var(--glass-border)] bg-[var(--input-surface)] px-2 py-1.5 text-xs text-[color:var(--text-primary)]"
          value={tableFieldName}
          onChange={(event) => setTableFieldName(event.target.value)}
          placeholder="新字段"
        />
        <button className="toolbar-button h-8 px-2 text-xs" onClick={addTableField} disabled={!canEditActiveLayer}>新增字段</button>
        <button className="toolbar-button h-8 px-2 text-xs" onClick={renameTableField} disabled={!canEditActiveLayer}>重命名字段</button>
        <button className="toolbar-button-danger h-8 px-2 text-xs" onClick={dropTableField} disabled={!canEditActiveLayer}>删除字段</button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-[var(--glass-border)]">
        <table className="min-w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-[var(--window-surface)] text-[color:var(--text-muted)]">
            <tr>
              <th className="border-b border-[var(--glass-border)] px-2 py-2 text-left font-medium">#</th>
              <th className="border-b border-[var(--glass-border)] px-2 py-2 text-left font-medium">几何</th>
              {activeFields.map((field) => (
                <th key={field} className="min-w-36 border-b border-[var(--glass-border)] px-2 py-2 text-left font-medium">
                  <button className="text-left hover:text-[color:var(--text-primary)]" onClick={() => setFieldName(field)}>
                    {field}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={activeFields.length + 2} className="px-3 py-6 text-center text-[color:var(--text-muted)]">
                  没有可显示的属性记录
                </td>
              </tr>
            )}
            {filteredRows.map(({ feature, index }) => {
              const key = featureKey(activeLayer.id, index)
              const selected = selectedFeatureSet.has(key)
              return (
                <tr
                  key={key}
                  className={`cursor-pointer border-b border-[var(--glass-border)] ${selected ? 'bg-[var(--surface-selected)]' : 'hover:bg-[var(--glass-surface-hover)]'}`}
                  onClick={() => focusFeature(index)}
                >
                  <td className="whitespace-nowrap px-2 py-1.5 text-[color:var(--text-muted)]">{index + 1}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-[color:var(--text-secondary)]">{geometryLabel(feature.geometry)}</td>
                  {activeFields.map((field) => (
                    <td key={field} className="px-2 py-1.5">
                      <input
                        className="w-full min-w-28 rounded border border-transparent bg-transparent px-1.5 py-1 text-[color:var(--text-primary)] hover:border-[var(--glass-border)] focus:border-[rgba(var(--color-primary-rgb),0.55)] focus:bg-[var(--input-surface)] focus:outline-none"
                        value={formatPropertyValue(feature.properties?.[field])}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => editFeatureProperty(index, field, event.currentTarget.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') event.currentTarget.blur()
                        }}
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
