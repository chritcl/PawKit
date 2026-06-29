import { useState } from 'react'
import type { Feature, GeoJsonProperties, Geometry } from 'geojson'
import type { GeoLayer } from '../../../../../shared/types'
import {
  formatGeometryCellValue,
  formatPropertyCellValue,
  parseGeometryCellValue,
  parsePropertyCellValue
} from '../../../utils/geospatial'
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
  formatJsonEditor: () => void
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
  editFeatureProperty: (featureIndex: number, field: string, value: unknown) => void
  editFeatureGeometry: (featureIndex: number, geometry: Geometry) => void
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
  formatJsonEditor,
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
  editFeatureProperty,
  editFeatureGeometry
}: AttributePanelProps): JSX.Element {
  const [cellDrafts, setCellDrafts] = useState<Record<string, string>>({})
  const [tableEditError, setTableEditError] = useState('')

  const removeCellDraft = (cellKey: string): void => {
    setCellDrafts((drafts) => {
      const next = { ...drafts }
      delete next[cellKey]
      return next
    })
  }

  const commitCellDraft = (
    cellKey: string,
    feature: Feature<Geometry, GeoJsonProperties>,
    featureIndex: number,
    field: string
  ): void => {
    const draft = cellDrafts[cellKey]
    if (draft === undefined) return
    const originalValue = feature.properties?.[field]
    const originalText = formatPropertyCellValue(originalValue)
    if (draft === originalText) {
      removeCellDraft(cellKey)
      return
    }

    try {
      editFeatureProperty(featureIndex, field, parsePropertyCellValue(draft, originalValue))
      setTableEditError('')
      removeCellDraft(cellKey)
    } catch (error) {
      setTableEditError(error instanceof Error ? error.message : '属性单元格提交失败')
    }
  }

  const commitGeometryDraft = (
    cellKey: string,
    feature: Feature<Geometry, GeoJsonProperties>,
    featureIndex: number
  ): void => {
    const draft = cellDrafts[cellKey]
    if (draft === undefined) return
    const originalText = formatGeometryCellValue(feature.geometry)
    if (draft === originalText) {
      removeCellDraft(cellKey)
      return
    }

    try {
      editFeatureGeometry(featureIndex, parseGeometryCellValue(draft))
      setTableEditError('')
      removeCellDraft(cellKey)
    } catch (error) {
      setTableEditError(error instanceof Error ? error.message : '几何单元格提交失败')
    }
  }

  if (!activeLayer) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[color:var(--text-muted)]">
        导入或新建矢量图层后，可在这里查看表格和编辑 GeoJSON。
      </div>
    )
  }

  if (mode === 'json') {
    return (
      <div className="geo-attribute-content flex h-full min-h-0 flex-col gap-2">
        <textarea
          className="min-h-[400px] flex-1 resize-none rounded-md border border-[var(--glass-border)] bg-[var(--input-surface)] p-3 font-mono text-xs leading-5 text-[color:var(--text-primary)]"
          value={jsonText}
          onChange={(event) => {
            setJsonText(event.target.value)
            setJsonDirty(true)
            setJsonError('')
          }}
          spellCheck={false}
        />
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2">
          <div className={`text-xs ${jsonError ? 'text-[color:var(--tone-danger)]' : 'text-[color:var(--text-muted)]'}`}>
            {jsonError || (jsonDirty ? 'JSON 有未保存修改' : 'JSON 与当前图层同步')}
          </div>
          <div className="flex gap-2">
            <button className="toolbar-button" onClick={resetJsonEditor} disabled={!canEditActiveLayer}>恢复</button>
            <button className="toolbar-button" onClick={formatJsonEditor} disabled={!canEditActiveLayer}>格式化 JSON</button>
            <button className="toolbar-button-primary" onClick={saveJsonEditor} disabled={!canEditActiveLayer}>保存 JSON</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="geo-attribute-content flex h-full min-h-0 flex-col gap-2">
      <div className="shrink-0 flex flex-wrap items-center gap-2">
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
      {activeFields.length === 0 && filteredRows.length > 0 && (
        <div className="shrink-0 rounded-md border border-[var(--glass-border)] bg-[var(--input-surface)] px-3 py-2 text-xs text-[color:var(--text-muted)]">
          当前记录没有属性字段，仍可查看序号并编辑几何(WKT)；输入新字段名后点击“新增字段”即可开始编辑属性。
        </div>
      )}
      {tableEditError && (
        <div className="shrink-0 rounded-md border border-[var(--tone-danger-border)] bg-[var(--tone-danger-soft)] px-3 py-2 text-xs text-[color:var(--tone-danger)]">
          {tableEditError}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-[var(--glass-border)]">
        <table className="min-w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-[var(--window-surface)] text-[color:var(--text-muted)]">
            <tr>
              <th className="border-b border-[var(--glass-border)] px-2 py-2 text-left font-medium">#</th>
              <th className="border-b border-[var(--glass-border)] px-2 py-2 text-left font-medium">几何</th>
              <th className="min-w-64 border-b border-[var(--glass-border)] px-2 py-2 text-left font-medium">几何(WKT)</th>
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
                <td colSpan={activeFields.length + 3} className="px-3 py-6 text-center text-[color:var(--text-muted)]">
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
                  <td className="px-2 py-1.5">
                    <input
                      className="w-full min-w-56 rounded border border-transparent bg-transparent px-1.5 py-1 font-mono text-[color:var(--text-primary)] hover:border-[var(--glass-border)] focus:border-[rgba(var(--color-primary-rgb),0.55)] focus:bg-[var(--input-surface)] focus:outline-none"
                      value={cellDrafts[`${key}:__pawkitGeometry`] ?? formatGeometryCellValue(feature.geometry)}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => {
                        setCellDrafts((drafts) => ({ ...drafts, [`${key}:__pawkitGeometry`]: event.currentTarget.value }))
                      }}
                      onBlur={() => commitGeometryDraft(`${key}:__pawkitGeometry`, feature, index)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') event.currentTarget.blur()
                        if (event.key === 'Escape') {
                          event.stopPropagation()
                          setTableEditError('')
                          removeCellDraft(`${key}:__pawkitGeometry`)
                          event.currentTarget.blur()
                        }
                      }}
                    />
                  </td>
                  {activeFields.map((field) => {
                    const cellKey = `${key}:${field}`
                    const value = cellDrafts[cellKey] ?? formatPropertyCellValue(feature.properties?.[field])
                    return (
                      <td key={field} className="px-2 py-1.5">
                        <input
                          className="w-full min-w-28 rounded border border-transparent bg-transparent px-1.5 py-1 text-[color:var(--text-primary)] hover:border-[var(--glass-border)] focus:border-[rgba(var(--color-primary-rgb),0.55)] focus:bg-[var(--input-surface)] focus:outline-none"
                          value={value}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => {
                            setCellDrafts((drafts) => ({ ...drafts, [cellKey]: event.currentTarget.value }))
                          }}
                          onBlur={() => commitCellDraft(cellKey, feature, index, field)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') event.currentTarget.blur()
                            if (event.key === 'Escape') {
                              event.stopPropagation()
                              setTableEditError('')
                              removeCellDraft(cellKey)
                              event.currentTarget.blur()
                            }
                          }}
                        />
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
