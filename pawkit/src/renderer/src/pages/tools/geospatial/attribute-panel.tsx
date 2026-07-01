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
  fieldName: string
  setFieldName: (value: string) => void
  filteredRows: Array<{ feature: Feature<Geometry, GeoJsonProperties>; index: number }>
  selectedFeatureSet: Set<string>
  featureKey: (layerId: string, featureIndex: number) => string
  selectFeature: (featureIndex: number, toggle: boolean) => void
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
  fieldName,
  setFieldName,
  filteredRows,
  selectedFeatureSet,
  featureKey,
  selectFeature,
  editFeatureProperty,
  editFeatureGeometry
}: AttributePanelProps): JSX.Element {
  const [cellDrafts, setCellDrafts] = useState<Record<string, string>>({})
  const [tableEditError, setTableEditError] = useState('')
  const selectedField = activeFields.includes(fieldName) ? fieldName : ''

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
      <div className="geo-table-toolbar">
        <input
          className="geo-table-filter"
          value={attributeFilter}
          onChange={(event) => setAttributeFilter(event.target.value)}
          placeholder="筛选表格内容"
        />
        <select
          className="geo-field-select"
          value={selectedField}
          onChange={(event) => setFieldName(event.target.value)}
          disabled={activeFields.length === 0}
          title="当前字段"
        >
          <option value="">选择字段</option>
          {activeFields.map((field) => (
            <option key={field} value={field}>{field}</option>
          ))}
        </select>
        <input
          className="geo-field-name-input"
          value={tableFieldName}
          onChange={(event) => setTableFieldName(event.target.value)}
          placeholder={selectedField ? '新字段名/重命名目标' : '新字段名'}
        />
        <button
          type="button"
          className="toolbar-button h-8 px-2 text-xs"
          onClick={addTableField}
          disabled={!canEditActiveLayer || tableFieldName.trim().length === 0}
        >
          新增字段
        </button>
        <button
          type="button"
          className="toolbar-button h-8 px-2 text-xs"
          onClick={renameTableField}
          disabled={!canEditActiveLayer || !selectedField || tableFieldName.trim().length === 0}
        >
          重命名字段
        </button>
        <button
          type="button"
          className="toolbar-button-danger h-8 px-2 text-xs"
          onClick={dropTableField}
          disabled={!canEditActiveLayer || !selectedField}
        >
          删除字段
        </button>
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
      <div className="geo-table-shell">
        <table className="geo-attribute-table">
          <thead>
            <tr>
              <th className="geo-table-sticky geo-table-index">#</th>
              <th className="geo-table-sticky geo-table-geometry">几何</th>
              <th className="geo-table-wkt">几何(WKT)</th>
              {activeFields.map((field) => (
                <th key={field} className={`geo-field-header ${selectedField === field ? 'geo-field-header-active' : ''}`}>
                  <button type="button" onClick={() => setFieldName(field)}>
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
                  className={`geo-attribute-row ${selected ? 'geo-attribute-row-selected' : ''}`}
                  aria-selected={selected}
                  onClick={(event) => selectFeature(index, event.ctrlKey || event.metaKey)}
                >
                  <td className="geo-table-sticky geo-table-index text-[color:var(--text-muted)]">{index + 1}</td>
                  <td className="geo-table-sticky geo-table-geometry text-[color:var(--text-secondary)]">{geometryLabel(feature.geometry)}</td>
                  <td className="geo-table-wkt-cell">
                    <input
                      className="geo-table-input geo-table-input-wkt"
                      value={cellDrafts[`${key}:__pawkitGeometry`] ?? formatGeometryCellValue(feature.geometry)}
                      disabled={!canEditActiveLayer}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => {
                        setTableEditError('')
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
                      <td key={field} className="geo-field-cell">
                        <input
                          className="geo-table-input"
                          value={value}
                          disabled={!canEditActiveLayer}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => {
                            setTableEditError('')
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
