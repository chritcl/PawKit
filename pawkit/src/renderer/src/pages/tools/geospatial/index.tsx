import 'ol/ol.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BoxSelect,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Database,
  Download,
  Eye,
  EyeOff,
  FileJson,
  Globe2,
  Layers,
  Loader2,
  Map as MapIcon,
  MousePointer2,
  PenLine,
  Plus,
  Sparkles,
  Table2,
  Trash2,
  Upload,
  Wifi,
  WifiOff,
  XCircle
} from 'lucide-react'
import OlMap from 'ol/Map'
import View from 'ol/View'
import GeoJSON from 'ol/format/GeoJSON'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import OSM from 'ol/source/OSM'
import VectorSource from 'ol/source/Vector'
import { fromLonLat } from 'ol/proj'
import Draw, { createBox } from 'ol/interaction/Draw'
import Modify from 'ol/interaction/Modify'
import Select from 'ol/interaction/Select'
import Snap from 'ol/interaction/Snap'
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style'
import OlFeature from 'ol/Feature'
import type { FeatureLike } from 'ol/Feature'
import type { Geometry as OlGeometry } from 'ol/geom'
import type { FeatureCollection, GeoJsonProperties, Geometry } from 'geojson'
import type {
  GeoDataFormat,
  GeoImportResult,
  GeoLayer,
  GeoOperationRequest,
  GeoOperationResult
} from '../../../../../shared/types'
import {
  addPropertyField,
  dropPropertyField,
  geoDialogFilters,
  getExportExtension,
  getLayerFields,
  getMapDataProjection,
  normalizeGeoJsonInput,
  renamePropertyField,
  setFeatureProperty,
  updateGeoLayerCollection,
  validateGeoOperationRequest
} from '../../../utils/geospatial'
import type { GeoExportPayload } from '../../../utils/geospatial'
import { AttributePanel } from './attribute-panel'
import { OperationPanel } from './operation-panel'
import { operationTabs, type AttributePanelMode, type BasemapMode, type DrawMode, type OperationPanelId, type WorkStatus } from './types'
import { useGeoWorker } from './use-geo-worker'
import { useMapLayerSync } from './use-map-layer-sync'
import { getNextActiveLayerAfterRemoval } from './page-helpers'

const exportFormats: Array<{ id: GeoDataFormat; label: string }> = [
  { id: 'geojson', label: 'GeoJSON' },
  { id: 'topojson', label: 'TopoJSON' },
  { id: 'csv', label: 'CSV + WKT' },
  { id: 'kml', label: 'KML' },
  { id: 'svg', label: 'SVG 地图' },
  { id: 'shapefile', label: 'Shapefile ZIP' },
  { id: 'flatgeobuf', label: 'FlatGeobuf' }
]

const geoJsonFormat = new GeoJSON()

function createLayerId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function formatBytes(bytes = 0): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatElapsed(seconds: number): string {
  const safeSeconds = Math.max(0, seconds)
  if (safeSeconds < 60) return `${safeSeconds} 秒`
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60
  return `${minutes} 分 ${remainder.toString().padStart(2, '0')} 秒`
}

function formatLayerKind(layer: GeoLayer): string {
  return `${layer.format.toUpperCase()} · ${layer.featureCount} 个要素`
}

function normalizeFileName(name: string, format: GeoDataFormat): string {
  const extension = getExportExtension(format)
  const withoutExtension = name.replace(/\.[^.]+$/, '') || 'geospatial-layer'
  return `${withoutExtension}.${extension}`
}

function stripInternalProperties(collection: FeatureCollection): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: collection.features.map((feature) => {
      const properties: Record<string, unknown> = { ...(feature.properties ?? {}) }
      delete properties.__pawkitLayerId
      delete properties.__pawkitFeatureIndex
      delete properties.__pawkitFeatureKey
      return {
        ...feature,
        properties: properties as GeoJsonProperties
      }
    })
  }
}

function getFeatureStyle(feature: FeatureLike, activeLayerId: string | null): Style {
  const layerId = feature.get('__pawkitLayerId') as string | undefined
  const active = Boolean(activeLayerId && layerId === activeLayerId)
  const strokeColor = active ? 'rgba(63, 140, 255, 0.96)' : 'rgba(126, 217, 169, 0.84)'
  const fillColor = active ? 'rgba(63, 140, 255, 0.18)' : 'rgba(126, 217, 169, 0.12)'

  return new Style({
    fill: new Fill({ color: fillColor }),
    stroke: new Stroke({
      color: strokeColor,
      width: active ? 2.2 : 1.4
    }),
    image: new CircleStyle({
      radius: active ? 5 : 4,
      fill: new Fill({ color: strokeColor }),
      stroke: new Stroke({ color: '#ffffff', width: 1.5 })
    })
  })
}

function createEmptyLayer(name: string): GeoLayer {
  return {
    id: createLayerId(),
    name,
    format: 'geojson',
    visible: true,
    featureCount: 0,
    crs: 'EPSG:4326',
    collection: {
      type: 'FeatureCollection',
      features: []
    },
    warnings: []
  }
}

function featureKey(layerId: string, featureIndex: number): string {
  return `${layerId}:${featureIndex}`
}

function geometryLabel(geometry: Geometry | null | undefined): string {
  return geometry?.type ?? '无几何'
}

function emptyFeatureCollection(): FeatureCollection {
  return { type: 'FeatureCollection', features: [] }
}

function stringifyLayerCollection(layer: GeoLayer | null): string {
  const collection = layer?.collection ?? emptyFeatureCollection()
  return JSON.stringify(collection, null, 2)
}

export function GeospatialPage(): JSX.Element {
  const [layers, setLayers] = useState<GeoLayer[]>([])
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null)
  const [drawMode, setDrawMode] = useState<DrawMode>('select')
  const [operationPanel, setOperationPanel] = useState<OperationPanelId>('geometry')
  const [attributePanelMode, setAttributePanelMode] = useState<AttributePanelMode>('table')
  const [attributePanelCollapsed, setAttributePanelCollapsed] = useState(false)
  const [basemapMode, setBasemapMode] = useState<BasemapMode>('osm')
  const [busy, setBusy] = useState(false)
  const [busyStartedAt, setBusyStartedAt] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [status, setStatus] = useState<WorkStatus>({ kind: 'idle', message: '导入地理数据后开始处理' })
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([])
  const [exportFormat, setExportFormat] = useState<GeoDataFormat>('geojson')
  const [clipLayerId, setClipLayerId] = useState('')
  const [simplifyTolerance, setSimplifyTolerance] = useState('0.01')
  const [bufferDistance, setBufferDistance] = useState('1')
  const [bufferUnits, setBufferUnits] = useState('kilometers')
  const [sourceCrs, setSourceCrs] = useState('EPSG:4326')
  const [targetCrs, setTargetCrs] = useState('EPSG:3857')
  const [expression, setExpression] = useState('')
  const [fieldName, setFieldName] = useState('')
  const [newFieldName, setNewFieldName] = useState('')
  const [tableFieldName, setTableFieldName] = useState('')
  const [attributeFilter, setAttributeFilter] = useState('')
  const [jsonText, setJsonText] = useState('')
  const [jsonDirty, setJsonDirty] = useState(false)
  const [jsonError, setJsonError] = useState('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const mapElementRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<OlMap | null>(null)
  const baseLayerRef = useRef<TileLayer<OSM> | null>(null)
  const vectorSourceRef = useRef<VectorSource<OlFeature<OlGeometry>> | null>(null)
  const vectorLayerRef = useRef<VectorLayer<VectorSource<OlFeature<OlGeometry>>> | null>(null)
  const selectRef = useRef<Select | null>(null)
  const modifyRef = useRef<Modify | null>(null)
  const drawRef = useRef<Draw | null>(null)
  const snapRef = useRef<Snap | null>(null)
  const activeLayerIdRef = useRef<string | null>(null)
  const fitAfterRenderRef = useRef(false)
  const taskTokenRef = useRef(0)
  const { callWorker, cancelWorker } = useGeoWorker()

  const activeLayer = useMemo(
    () => layers.find((layer) => layer.id === activeLayerId) ?? null,
    [activeLayerId, layers]
  )
  const vectorLayers = layers
  const clipLayer = useMemo(
    () => vectorLayers.find((layer) => layer.id === clipLayerId) ?? null,
    [clipLayerId, vectorLayers]
  )
  const activeFields = useMemo(() => getLayerFields(activeLayer), [activeLayer])
  const canEditActiveLayer = Boolean(activeLayer)
  const canEditMapLayer = Boolean(activeLayer?.visible)
  const canExportActiveLayer = canEditActiveLayer && !busy
  const statusMessage = busy ? `${status.message} · 已用时 ${formatElapsed(elapsedSeconds)}` : status.message
  const selectedFeatureSet = useMemo(() => new Set(selectedFeatureIds), [selectedFeatureIds])
  const activeCollection = activeLayer?.collection ?? null
  const activeOperationTab = operationTabs.find((tab) => tab.id === operationPanel) ?? operationTabs[0]
  const filteredRows = useMemo(() => {
    const collection = activeCollection
    if (!collection) return []
    const query = attributeFilter.trim().toLowerCase()
    return collection.features
      .map((feature, index) => ({ feature, index }))
      .filter(({ feature, index }) => {
        if (!query) return true
        const key = featureKey(activeLayer?.id ?? '', index).toLowerCase()
        const props = JSON.stringify(feature.properties ?? {}).toLowerCase()
        const geometry = geometryLabel(feature.geometry).toLowerCase()
        return key.includes(query) || props.includes(query) || geometry.includes(query)
      })
  }, [activeCollection, activeLayer?.id, attributeFilter])

  const syncJsonEditorFromLayer = useCallback((layer: GeoLayer | null): void => {
    setJsonText(stringifyLayerCollection(layer))
    setJsonDirty(false)
    setJsonError('')
  }, [])

  const activateLayer = useCallback((layer: GeoLayer | null): void => {
    setActiveLayerId(layer?.id ?? null)
    setSelectedFeatureIds([])
    if (layer?.crs) setSourceCrs(layer.crs)
    syncJsonEditorFromLayer(layer)
  }, [syncJsonEditorFromLayer])

  const beginTask = useCallback((message: string): number => {
    const token = taskTokenRef.current + 1
    taskTokenRef.current = token
    setBusy(true)
    setBusyStartedAt(Date.now())
    setElapsedSeconds(0)
    setStatus({ kind: 'idle', message })
    return token
  }, [])

  const isTaskActive = useCallback((token: number): boolean => taskTokenRef.current === token, [])

  const finishTask = useCallback((token: number): void => {
    if (taskTokenRef.current !== token) return
    setBusy(false)
    setBusyStartedAt(null)
    setElapsedSeconds(0)
  }, [])

  const cancelCurrentTask = useCallback((): void => {
    taskTokenRef.current += 1
    cancelWorker(new Error('任务已停止'))
    setBusy(false)
    setBusyStartedAt(null)
    setElapsedSeconds(0)
    setStatus({ kind: 'warning', message: '当前地理空间任务已停止' })
  }, [cancelWorker])

  const fitMapToSource = useCallback(() => {
    const map = mapRef.current
    const source = vectorSourceRef.current
    if (!map || !source || source.isEmpty()) return
    const extent = source.getExtent()
    if (!extent) return
    map.getView().fit(extent, {
      padding: [48, 48, 48, 48],
      maxZoom: 15,
      duration: 220
    })
  }, [])

  useMapLayerSync({
    layers,
    activeLayerId,
    vectorSourceRef,
    vectorLayerRef,
    fitAfterRenderRef,
    fitMapToSource,
    featureKey
  })

  const applyCollectionToActiveLayer = useCallback((
    collection: FeatureCollection,
    message: string,
    options: { fit?: boolean } = {}
  ): void => {
    const targetId = activeLayerIdRef.current
    if (!targetId) return
    setLayers((current) => current.map((layer) => (
      layer.id === targetId
        ? updateGeoLayerCollection(layer, collection)
        : layer
    )))
    setSelectedFeatureIds([])
    setJsonText(JSON.stringify(collection, null, 2))
    setJsonDirty(false)
    setJsonError('')
    if (options.fit) fitAfterRenderRef.current = true
    setStatus({ kind: 'success', message })
  }, [])

  const syncActiveVectorLayer = useCallback((nextMessage = '地图编辑已同步'): void => {
    const source = vectorSourceRef.current
    const targetId = activeLayerIdRef.current
    if (!source || !targetId) return

    const features = source.getFeatures().filter((feature) => feature.get('__pawkitLayerId') === targetId)
    const collection = stripInternalProperties(geoJsonFormat.writeFeaturesObject(features, {
      dataProjection: getMapDataProjection(activeLayer),
      featureProjection: 'EPSG:3857'
    }) as FeatureCollection)

    setLayers((current) => current.map((layer) => {
      if (layer.id !== targetId) return layer
      return updateGeoLayerCollection(layer, collection)
    }))
    setSelectedFeatureIds([])
    setJsonText(JSON.stringify(collection, null, 2))
    setJsonDirty(false)
    setJsonError('')
    setStatus({ kind: 'success', message: nextMessage })
  }, [activeLayer])

  const focusFeature = useCallback((featureIndex: number): void => {
    if (!activeLayerId) return
    const source = vectorSourceRef.current
    const select = selectRef.current
    const map = mapRef.current
    if (!source || !select || !map) return
    const key = featureKey(activeLayerId, featureIndex)
    const feature = source.getFeatures().find((item) => item.get('__pawkitFeatureKey') === key)
    if (!feature) return
    select.getFeatures().clear()
    select.getFeatures().push(feature)
    setSelectedFeatureIds([key])
    const geometry = feature.getGeometry()
    if (geometry) {
      map.getView().fit(geometry.getExtent(), {
        padding: [96, 96, 96, 96],
        maxZoom: 16,
        duration: 180
      })
    }
  }, [activeLayerId])

  const editFeatureProperty = useCallback((featureIndex: number, field: string, value: string): void => {
    if (!activeCollection) return
    try {
      applyCollectionToActiveLayer(
        setFeatureProperty(activeCollection, featureIndex, field, value),
        '属性单元格已更新'
      )
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : '属性更新失败' })
    }
  }, [activeCollection, applyCollectionToActiveLayer])

  const addTableField = useCallback((): void => {
    if (!activeCollection) return
    try {
      applyCollectionToActiveLayer(addPropertyField(activeCollection, tableFieldName), `字段 ${tableFieldName.trim()} 已新增`)
      setTableFieldName('')
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : '新增字段失败' })
    }
  }, [activeCollection, applyCollectionToActiveLayer, tableFieldName])

  const renameTableField = useCallback((): void => {
    if (!activeCollection) return
    try {
      applyCollectionToActiveLayer(renamePropertyField(activeCollection, fieldName, newFieldName), `字段 ${fieldName.trim()} 已重命名`)
      setFieldName(newFieldName.trim())
      setNewFieldName('')
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : '重命名字段失败' })
    }
  }, [activeCollection, applyCollectionToActiveLayer, fieldName, newFieldName])

  const dropTableField = useCallback((): void => {
    if (!activeCollection) return
    try {
      applyCollectionToActiveLayer(dropPropertyField(activeCollection, fieldName), `字段 ${fieldName.trim()} 已删除`)
      setFieldName('')
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : '删除字段失败' })
    }
  }, [activeCollection, applyCollectionToActiveLayer, fieldName])

  const saveJsonEditor = useCallback((): void => {
    if (!activeLayer) {
      setJsonError('请选择一个矢量图层')
      return
    }
    try {
      const collection = normalizeGeoJsonInput(JSON.parse(jsonText))
      applyCollectionToActiveLayer(collection, 'JSON 已保存并同步地图', { fit: true })
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : 'JSON 保存失败')
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'JSON 保存失败' })
    }
  }, [activeLayer, applyCollectionToActiveLayer, jsonText])

  const resetJsonEditor = useCallback((): void => {
    const collection = activeCollection ?? { type: 'FeatureCollection', features: [] }
    setJsonText(JSON.stringify(collection, null, 2))
    setJsonDirty(false)
    setJsonError('')
  }, [activeCollection])

  useEffect(() => {
    activeLayerIdRef.current = activeLayerId
  }, [activeLayerId])

  useEffect(() => {
    if (!busyStartedAt) return undefined
    const updateElapsed = (): void => {
      setElapsedSeconds(Math.floor((Date.now() - busyStartedAt) / 1000))
    }
    updateElapsed()
    const intervalId = window.setInterval(updateElapsed, 1000)
    return () => window.clearInterval(intervalId)
  }, [busyStartedAt])

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) return
    const source = new VectorSource<OlFeature<OlGeometry>>()
    const baseLayer = new TileLayer({
      source: new OSM(),
      visible: true
    })
    const layer = new VectorLayer({
      source,
      style: (feature) => getFeatureStyle(feature, activeLayerIdRef.current)
    })
    const map = new OlMap({
      target: mapElementRef.current,
      layers: [baseLayer, layer],
      view: new View({
        center: fromLonLat([104, 35]),
        zoom: 4
      })
    })

    baseLayerRef.current = baseLayer
    vectorSourceRef.current = source
    vectorLayerRef.current = layer
    mapRef.current = map

    return () => {
      map.setTarget(undefined)
      mapRef.current = null
      baseLayerRef.current = null
      vectorSourceRef.current = null
      vectorLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    const baseLayer = baseLayerRef.current
    if (!baseLayer) return
    const visible = basemapMode === 'osm'
    baseLayer.setVisible(visible)
    if (!visible) baseLayer.getSource()?.clear()
  }, [basemapMode])

  useEffect(() => {
    mapRef.current?.updateSize()
  }, [attributePanelCollapsed, operationPanel])

  useEffect(() => {
    const map = mapRef.current
    const source = vectorSourceRef.current
    if (!map || !source) return

    const removeInteraction = (interaction: Select | Modify | Draw | Snap | null): void => {
      if (interaction) map.removeInteraction(interaction)
    }
    removeInteraction(selectRef.current)
    removeInteraction(modifyRef.current)
    removeInteraction(drawRef.current)
    removeInteraction(snapRef.current)
    selectRef.current = null
    modifyRef.current = null
    drawRef.current = null
    snapRef.current = null
    setSelectedFeatureIds([])

    if (!canEditMapLayer || !activeLayerId) return

    const select = new Select({
      filter: (feature) => feature.get('__pawkitLayerId') === activeLayerId
    })
    select.getFeatures().on(['add', 'remove'], () => {
      const keys = select.getFeatures().getArray()
        .map((feature) => feature.get('__pawkitFeatureKey') as string | undefined)
        .filter((key): key is string => Boolean(key))
      setSelectedFeatureIds(keys)
    })
    map.addInteraction(select)
    selectRef.current = select

    if (drawMode === 'select') {
      const modify = new Modify({ features: select.getFeatures() })
      modify.on('modifyend', () => syncActiveVectorLayer())
      map.addInteraction(modify)
      modifyRef.current = modify
    } else {
      const draw = new Draw({
        source,
        type: drawMode === 'box' ? 'Circle' : drawMode === 'point' ? 'Point' : drawMode === 'line' ? 'LineString' : 'Polygon',
        geometryFunction: drawMode === 'box' ? createBox() : undefined
      })
      draw.on('drawend', (event) => {
        event.feature.set('__pawkitLayerId', activeLayerId)
        window.setTimeout(() => syncActiveVectorLayer('绘制要素已加入当前图层'), 0)
      })
      const snap = new Snap({ source })
      map.addInteraction(draw)
      map.addInteraction(snap)
      drawRef.current = draw
      snapRef.current = snap
    }

    return () => {
      removeInteraction(selectRef.current)
      removeInteraction(modifyRef.current)
      removeInteraction(drawRef.current)
      removeInteraction(snapRef.current)
    }
  }, [activeLayerId, canEditMapLayer, drawMode, syncActiveVectorLayer])

  const importFiles = async (): Promise<void> => {
    if (busy) return
    const taskToken = beginTask('请选择地理数据文件；选择后会读取文件内容')
    try {
      const files = await window.electronAPI.geo.openFiles(geoDialogFilters)
      if (!isTaskActive(taskToken)) return
      if (files.length === 0) {
        setStatus({ kind: 'warning', message: '导入已取消' })
        return
      }
      const fileSize = files.reduce((total, file) => total + file.size, 0)
      setStatus({ kind: 'idle', message: `已读取 ${files.length} 个文件（${formatBytes(fileSize)}），Worker 正在解析地理数据` })
      const result = await callWorker<GeoImportResult>({ type: 'import', files }, {
        timeoutMs: 5 * 60 * 1000,
        timeoutMessage: '导入解析超过 5 分钟，已停止。请尝试拆分文件、先转换为 GeoJSON/FlatGeobuf，或导入更小范围数据。'
      })
      if (!isTaskActive(taskToken)) return
      if (result.layers.length === 0) {
        setStatus({ kind: 'warning', message: result.warnings[0] ?? '未识别出可导入的地理图层' })
        return
      }
      setLayers((current) => [...current, ...result.layers])
      if (!activeLayerId && result.layers[0]) activateLayer(result.layers[0])
      fitAfterRenderRef.current = true
      const warningText = result.warnings.length > 0 ? `，${result.warnings.length} 条提示` : ''
      setStatus({ kind: result.warnings.length > 0 ? 'warning' : 'success', message: `已导入 ${result.layers.length} 个图层，${formatBytes(fileSize)}${warningText}` })
    } catch (error) {
      if (!isTaskActive(taskToken)) return
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : '导入失败' })
    } finally {
      finishTask(taskToken)
    }
  }

  const createDrawingLayer = (): void => {
    const layer = createEmptyLayer(`绘制图层 ${layers.length + 1}`)
    setLayers((current) => [...current, layer])
    activateLayer(layer)
    setDrawMode('polygon')
    setStatus({ kind: 'success', message: '已创建空白绘制图层' })
  }

  const removeLayer = (layerId: string): void => {
    const nextActiveLayer = getNextActiveLayerAfterRemoval(layers, layerId, activeLayerId)
    setLayers((current) => current.filter((layer) => layer.id !== layerId))
    if (activeLayerId === layerId) {
      activateLayer(nextActiveLayer)
    }
    if (clipLayerId === layerId) setClipLayerId('')
    setStatus({ kind: 'success', message: '图层已删除' })
  }

  const toggleLayerVisible = (layerId: string): void => {
    setLayers((current) => current.map((layer) => (
      layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
    )))
    if (layerId === activeLayerId) setSelectedFeatureIds([])
  }

  const deleteSelectedFeatures = (): void => {
    const select = selectRef.current
    const source = vectorSourceRef.current
    if (!select || !source || selectedFeatureIds.length === 0) return
    select.getFeatures().forEach((feature) => source.removeFeature(feature as OlFeature<OlGeometry>))
    select.getFeatures().clear()
    setSelectedFeatureIds([])
    syncActiveVectorLayer('选中要素已删除')
  }

  const runOperation = async (type: GeoOperationRequest['type']): Promise<void> => {
    if (busy) return
    if (!activeLayer) {
      setStatus({ kind: 'warning', message: '请选择一个矢量图层' })
      return
    }
    const options: Record<string, unknown> = {}
    if (type === 'simplify') options.tolerance = Number(simplifyTolerance)
    if (type === 'buffer') {
      options.distance = Number(bufferDistance)
      options.units = bufferUnits
    }
    if (type === 'project') {
      options.from = sourceCrs
      options.to = targetCrs
    }
    if (type === 'filter') options.expression = expression
    if (type === 'calculate') {
      options.field = newFieldName || fieldName
      options.expression = expression
    }
    if (type === 'rename-field') {
      options.from = fieldName
      options.to = newFieldName
    }
    if (type === 'drop-field' || type === 'merge' || type === 'sort') options.field = fieldName
    if (type === 'sort') options.direction = sortDirection

    const requiresClip = type === 'clip' || type === 'erase'
    if (requiresClip && !clipLayer) {
      setStatus({ kind: 'warning', message: '请选择一个面图层作为裁剪/擦除范围' })
      return
    }

    const request: GeoOperationRequest = {
      type,
      layer: activeLayer,
      clipLayer: requiresClip ? clipLayer ?? undefined : undefined,
      options
    }

    try {
      validateGeoOperationRequest(request)
    } catch (error) {
      setStatus({ kind: 'warning', message: error instanceof Error ? error.message : '操作参数无效' })
      return
    }

    const taskToken = beginTask('Worker 正在执行空间处理')
    try {
      const result = await callWorker<GeoOperationResult>({
        type: 'operation',
        request
      }, {
        timeoutMs: 3 * 60 * 1000,
        timeoutMessage: '空间处理超过 3 分钟，已停止。请尝试减少要素数量、先简化几何，或拆分图层后再处理。'
      })
      if (!isTaskActive(taskToken)) return
      if (!result.success || !result.layer) {
        setStatus({ kind: 'error', message: result.message })
        return
      }
      setLayers((current) => [...current, result.layer as GeoLayer])
      activateLayer(result.layer)
      fitAfterRenderRef.current = true
      setStatus({ kind: 'success', message: `${result.layer.name} 已生成` })
    } catch (error) {
      if (!isTaskActive(taskToken)) return
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : '处理失败' })
    } finally {
      finishTask(taskToken)
    }
  }

  const exportActiveLayer = async (): Promise<void> => {
    if (busy) return
    if (!activeLayer) {
      setStatus({ kind: 'warning', message: '请选择一个可导出的矢量图层' })
      return
    }
    const taskToken = beginTask('Worker 正在生成导出文件')
    try {
      const suggestedName = normalizeFileName(activeLayer.name, exportFormat)
      const payload = await callWorker<GeoExportPayload>({
        type: 'export',
        request: {
          layerId: activeLayer.id,
          format: exportFormat,
          fileName: suggestedName
        },
        layer: activeLayer
      }, {
        timeoutMs: 3 * 60 * 1000,
        timeoutMessage: '导出生成超过 3 分钟，已停止。请尝试减少要素数量或换用 GeoJSON/FlatGeobuf 导出。'
      })
      if (!isTaskActive(taskToken)) return
      if (payload.archiveEntries) {
        setStatus({ kind: 'idle', message: '导出文件已生成，正在保存压缩包' })
        const result = await window.electronAPI.geo.saveArchive({
          suggestedName,
          entries: payload.archiveEntries
        })
        if (!isTaskActive(taskToken)) return
        setStatus({ kind: result.success ? 'success' : result.status === 'cancelled' ? 'warning' : 'error', message: result.message })
        return
      }
      if (!payload.bytes) throw new Error('导出结果为空')
      const extension = getExportExtension(exportFormat)
      setStatus({ kind: 'idle', message: '导出文件已生成，正在保存文件' })
      const result = await window.electronAPI.geo.saveFile({
        suggestedName,
        bytes: payload.bytes,
        filters: [{ name: exportFormats.find((item) => item.id === exportFormat)?.label ?? '地理数据', extensions: [extension] }]
      })
      if (!isTaskActive(taskToken)) return
      setStatus({ kind: result.success ? 'success' : result.status === 'cancelled' ? 'warning' : 'error', message: result.message })
    } catch (error) {
      if (!isTaskActive(taskToken)) return
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : '导出失败' })
    } finally {
      finishTask(taskToken)
    }
  }


  return (
    <div className="geo-page tool-page">
      <div className="toolbar-surface geo-toolbar">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="toolbar-button-primary" onClick={importFiles} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            导入数据
          </button>
          {busy && (
            <button type="button" className="toolbar-button-danger" onClick={cancelCurrentTask}>
              <XCircle className="h-4 w-4" />
              停止任务
            </button>
          )}
          <button type="button" className="toolbar-button" onClick={createDrawingLayer} disabled={busy}>
            <Plus className="h-4 w-4" />
            新建绘制图层
          </button>
          <button type="button" className="toolbar-button" onClick={fitMapToSource} disabled={layers.length === 0}>
            <Globe2 className="h-4 w-4" />
            适配视图
          </button>
          <button
            type="button"
            className="toolbar-button"
            onClick={() => setBasemapMode((mode) => (mode === 'offline' ? 'osm' : 'offline'))}
            title={basemapMode === 'osm' ? '当前使用在线 OSM 底图，点击切到离线网格' : '当前使用离线网格，不请求在线瓦片'}
          >
            {basemapMode === 'osm' ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {basemapMode === 'osm' ? '在线 OSM' : '离线网格'}
          </button>
        </div>
        <div className={`geo-status rounded-md border px-3 py-1.5 text-xs ${
          status.kind === 'error'
            ? 'border-[var(--tone-danger-border)] bg-[var(--tone-danger-soft)] text-[color:var(--tone-danger)]'
            : status.kind === 'warning'
              ? 'border-[var(--tone-warning-border)] bg-[var(--tone-warning-soft)] text-[color:var(--tone-warning)]'
              : status.kind === 'success'
                ? 'border-[var(--tone-success-border)] bg-[var(--tone-success-soft)] text-[color:var(--tone-success)]'
                : 'border-[var(--glass-border)] bg-[var(--input-surface)] text-[color:var(--text-secondary)]'
        }`}>
          {statusMessage}
        </div>
      </div>

      <div className={`geo-workbench ${attributePanelCollapsed ? 'geo-workbench-attribute-collapsed' : ''}`}>
        <aside className="glass-panel geo-layer-panel">
          <section className="min-h-0 flex-1 overflow-hidden">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-[color:var(--text-primary)]">
                <Layers className="h-4 w-4" />
                图层
              </h2>
              <span className="text-xs text-[color:var(--text-muted)]">{layers.length}</span>
            </div>
            <div className="flex max-h-full flex-col gap-2 overflow-auto pr-1">
              {layers.length === 0 && (
                <div className="soft-panel p-3 text-sm leading-6 text-[color:var(--text-muted)]">
                  支持 GeoJSON、TopoJSON、CSV、KML、SVG、Shapefile ZIP 和 FlatGeobuf 导入。
                </div>
              )}
              {layers.map((layer) => (
                <div
                  key={layer.id}
                  className={`geo-layer-card ${layer.id === activeLayerId ? 'geo-layer-card-active' : ''}`}
                >
                  <button
                    type="button"
                    className="geo-layer-main"
                    onClick={() => activateLayer(layer)}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[color:var(--text-primary)]">{layer.name}</div>
                      <div className="mt-1 text-xs text-[color:var(--text-muted)]">{formatLayerKind(layer)}</div>
                    </div>
                  </button>
                  <div className="geo-layer-actions">
                    <button
                      type="button"
                      className="icon-button h-7 min-h-7 w-7 min-w-7"
                      title={layer.visible ? '隐藏图层' : '显示图层'}
                      onClick={() => toggleLayerVisible(layer.id)}
                    >
                      {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      className="icon-button h-7 min-h-7 w-7 min-w-7"
                      title="删除图层"
                      onClick={() => removeLayer(layer.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {layer.warnings && layer.warnings.length > 0 && (
                    <div className="mt-2 text-xs text-[color:var(--tone-warning)]">{layer.warnings[0]}</div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="border-t border-[var(--glass-border)] pt-3">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[color:var(--text-primary)]">
              <Database className="h-4 w-4" />
              字段
            </h2>
            <div className="flex max-h-28 flex-wrap gap-1 overflow-auto">
              {activeFields.length === 0 ? (
                <span className="text-xs text-[color:var(--text-muted)]">当前图层暂无字段</span>
              ) : activeFields.map((field) => (
                <button
                  key={field}
                  className={`rounded-md border px-2 py-1 text-xs ${
                    fieldName === field
                      ? 'border-[rgba(var(--color-primary-rgb),0.55)] bg-[var(--surface-selected)] text-[color:var(--text-primary)]'
                      : 'border-[var(--glass-border)] bg-[var(--input-surface)] text-[color:var(--text-secondary)]'
                  }`}
                  onClick={() => setFieldName(field)}
                >
                  {field}
                </button>
              ))}
            </div>
          </section>

          <section className="border-t border-[var(--glass-border)] pt-3">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[color:var(--text-primary)]">
              <Download className="h-4 w-4" />
              导出
            </h2>
            <div className="flex gap-2">
              <select
                className="min-w-0 flex-1 rounded-md border border-[var(--glass-border)] bg-[var(--input-surface)] px-2 py-2 text-sm text-[color:var(--text-primary)]"
                value={exportFormat}
                onChange={(event) => setExportFormat(event.target.value as GeoDataFormat)}
              >
                {exportFormats.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
              <button className="toolbar-button-primary" onClick={exportActiveLayer} disabled={!canExportActiveLayer}>
                保存
              </button>
            </div>
          </section>
        </aside>

        <main
          className="geo-map-panel"
          style={basemapMode === 'offline' ? {
            backgroundColor: 'var(--window-surface)',
            backgroundImage: 'linear-gradient(rgba(var(--color-primary-rgb),0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--color-primary-rgb),0.08) 1px, transparent 1px)',
            backgroundSize: '32px 32px'
          } : undefined}
        >
          <div ref={mapElementRef} className="h-full w-full" />
          <div className="geo-map-draw-toolbar">
            {([
              ['select', MousePointer2, '选择/修改'],
              ['point', CircleDot, '点'],
              ['line', PenLine, '线'],
              ['polygon', Sparkles, '面'],
              ['box', BoxSelect, '框选范围']
            ] as const).map(([mode, Icon, label]) => (
              <button
                type="button"
                key={mode}
                className={`segmented-item ${drawMode === mode ? 'segmented-item-active' : ''}`}
                onClick={() => setDrawMode(mode)}
                disabled={!canEditMapLayer}
                title={canEditMapLayer ? label : '当前图层隐藏或未选择，无法在地图上编辑'}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
            <button type="button" className="toolbar-button-danger" onClick={deleteSelectedFeatures} disabled={selectedFeatureIds.length === 0}>
              <Trash2 className="h-4 w-4" />
              删除选中 {selectedFeatureIds.length > 0 ? selectedFeatureIds.length : ''}
            </button>
          </div>
          <div className="geo-basemap-badge">
            {basemapMode === 'osm' ? '在线 OSM 底图' : '离线网格底图 · 不请求在线瓦片'}
          </div>
        </main>

        <aside className="glass-panel geo-operation-panel">
          <div className="flex items-center gap-1 rounded-lg border border-[var(--glass-border)] bg-[var(--input-surface)] p-1">
            {operationTabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                className={`segmented-item flex-1 justify-center ${operationPanel === tab.id ? 'segmented-item-active' : ''}`}
                onClick={() => setOperationPanel(tab.id)}
                title={tab.description}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="sr-only" aria-live="polite">{activeOperationTab.title}</div>
          <OperationPanel
            panel={operationPanel}
            busy={busy}
            canEditActiveLayer={canEditActiveLayer}
            vectorLayers={vectorLayers}
            activeFields={activeFields}
            activeLayerId={activeLayerId}
            clipLayerId={clipLayerId}
            setClipLayerId={setClipLayerId}
            simplifyTolerance={simplifyTolerance}
            setSimplifyTolerance={setSimplifyTolerance}
            bufferDistance={bufferDistance}
            setBufferDistance={setBufferDistance}
            bufferUnits={bufferUnits}
            setBufferUnits={setBufferUnits}
            fieldName={fieldName}
            setFieldName={setFieldName}
            newFieldName={newFieldName}
            setNewFieldName={setNewFieldName}
            expression={expression}
            setExpression={setExpression}
            sortDirection={sortDirection}
            setSortDirection={setSortDirection}
            sourceCrs={sourceCrs}
            setSourceCrs={setSourceCrs}
            targetCrs={targetCrs}
            setTargetCrs={setTargetCrs}
            runOperation={runOperation}
          />
        </aside>

        <section className="glass-panel geo-attribute-panel">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <MapIcon className="h-4 w-4 text-[color:var(--text-muted)]" />
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                  属性数据 {activeLayer ? `· ${activeLayer.name}` : ''}
                </h2>
                <p className="text-xs text-[color:var(--text-muted)]">
                  {activeLayer ? `${activeLayer.featureCount} 条记录，选中 ${selectedFeatureIds.length} 条` : '矢量图层支持表格和 JSON 编辑'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={`segmented-item ${attributePanelMode === 'table' ? 'segmented-item-active' : ''}`}
                onClick={() => setAttributePanelMode('table')}
              >
                <Table2 className="h-4 w-4" />
                表格
              </button>
              <button
                type="button"
                className={`segmented-item ${attributePanelMode === 'json' ? 'segmented-item-active' : ''}`}
                onClick={() => setAttributePanelMode('json')}
              >
                <FileJson className="h-4 w-4" />
                JSON
              </button>
              <button type="button" className="icon-button h-8 min-h-8 w-8 min-w-8" onClick={() => setAttributePanelCollapsed((value) => !value)} title={attributePanelCollapsed ? '展开属性面板' : '收起属性面板'}>
                {attributePanelCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {!attributePanelCollapsed && (
            <AttributePanel
              activeLayer={activeLayer}
              mode={attributePanelMode}
              jsonText={jsonText}
              setJsonText={setJsonText}
              jsonDirty={jsonDirty}
              setJsonDirty={setJsonDirty}
              jsonError={jsonError}
              setJsonError={setJsonError}
              resetJsonEditor={resetJsonEditor}
              saveJsonEditor={saveJsonEditor}
              canEditActiveLayer={canEditActiveLayer}
              attributeFilter={attributeFilter}
              setAttributeFilter={setAttributeFilter}
              tableFieldName={tableFieldName}
              setTableFieldName={setTableFieldName}
              addTableField={addTableField}
              renameTableField={renameTableField}
              dropTableField={dropTableField}
              activeFields={activeFields}
              setFieldName={setFieldName}
              filteredRows={filteredRows}
              selectedFeatureSet={selectedFeatureSet}
              featureKey={featureKey}
              focusFeature={focusFeature}
              editFeatureProperty={editFeatureProperty}
            />
          )}
        </section>
      </div>
    </div>
  )
}
