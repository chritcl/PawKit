import 'ol/ol.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BoxSelect,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Database,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FileJson,
  Globe2,
  Layers,
  Loader2,
  Map as MapIcon,
  Merge,
  MousePointer2,
  PenLine,
  Plus,
  Scissors,
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
import type { BBox, FeatureCollection, GeoJsonProperties, Geometry } from 'geojson'
import type {
  GeoDataFormat,
  GeoExportRequest,
  GeoFilePayload,
  GeoImportResult,
  GeoLayer,
  GeoOperationRequest,
  GeoOperationResult
} from '../../../../../shared/types'
import {
  addPropertyField,
  bytesToArrayBuffer,
  dropPropertyField,
  geoDialogFilters,
  getExportExtension,
  getLayerFields,
  normalizeGeoJsonInput,
  renamePropertyField,
  setFeatureProperty,
  updateGeoLayerCollection
} from '../../../utils/geospatial'
import type { GeoExportPayload } from '../../../utils/geospatial'

type DrawMode = 'select' | 'point' | 'line' | 'polygon' | 'box'
type StatusKind = 'idle' | 'success' | 'warning' | 'error'
type OperationPanel = 'geometry' | 'attributes' | 'projection'
type AttributePanelMode = 'table' | 'json'
type BasemapMode = 'offline' | 'osm'

interface WorkStatus {
  kind: StatusKind
  message: string
}

interface PendingWorkerCall {
  resolve: (payload: unknown) => void
  reject: (error: Error) => void
  timeoutId: number
}

interface WorkerCallOptions {
  timeoutMs?: number
  timeoutMessage?: string
}

type WorkerRequestPayload =
  | { type: 'import'; files: GeoFilePayload[] }
  | { type: 'operation'; request: GeoOperationRequest }
  | { type: 'export'; request: GeoExportRequest; layer: GeoLayer }

type WorkerResponse =
  | { id: string; success: true; payload: unknown }
  | { id: string; success: false; message: string }

function prepareWorkerRequest(
  request: WorkerRequestPayload,
  id: string
): { message: WorkerRequestPayload & { id: string }; transfers: Transferable[] } {
  if (request.type !== 'import') {
    return { message: { ...request, id }, transfers: [] }
  }

  const transfers: Transferable[] = []
  const files = request.files.map((file) => {
    const buffer = bytesToArrayBuffer(file.bytes)
    transfers.push(buffer)
    return {
      ...file,
      bytes: buffer,
      size: buffer.byteLength
    }
  })

  return { message: { type: 'import', files, id }, transfers }
}

const geoJsonFormat = new GeoJSON()

const exportFormats: Array<{ id: Exclude<GeoDataFormat, 'geotiff'>; label: string }> = [
  { id: 'geojson', label: 'GeoJSON' },
  { id: 'topojson', label: 'TopoJSON' },
  { id: 'csv', label: 'CSV + WKT' },
  { id: 'kml', label: 'KML' },
  { id: 'svg', label: 'SVG 地图' },
  { id: 'shapefile', label: 'Shapefile ZIP' },
  { id: 'flatgeobuf', label: 'FlatGeobuf' },
  { id: 'geopackage', label: 'GeoPackage' },
  { id: 'geoparquet', label: 'GeoParquet' }
]

const unitOptions = [
  { id: 'kilometers', label: '千米' },
  { id: 'meters', label: '米' },
  { id: 'miles', label: '英里' }
]

const operationTabs: Array<{ id: OperationPanel; label: string }> = [
  { id: 'geometry', label: '几何' },
  { id: 'attributes', label: '属性' },
  { id: 'projection', label: '投影' }
]

function createRequestId(): string {
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
  if (layer.kind === 'raster') return 'GeoTIFF 范围展示'
  return `${layer.format.toUpperCase()} · ${layer.featureCount} 个要素`
}

function normalizeFileName(name: string, format: GeoDataFormat): string {
  const extension = getExportExtension(format)
  const withoutExtension = name.replace(/\.[^.]+$/, '') || 'geospatial-layer'
  return `${withoutExtension}.${extension}`
}

function bboxToCollection(bbox: BBox): FeatureCollection {
  const [minX, minY, maxX, maxY] = bbox
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'GeoTIFF 范围' },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [minX, minY],
            [maxX, minY],
            [maxX, maxY],
            [minX, maxY],
            [minX, minY]
          ]]
        }
      }
    ]
  }
}

function stripInternalProperties(collection: FeatureCollection): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: collection.features.map((feature) => {
      const properties: Record<string, unknown> = { ...(feature.properties ?? {}) }
      delete properties.__pawkitLayerId
      delete properties.__pawkitLayerKind
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
  const kind = feature.get('__pawkitLayerKind') as string | undefined
  const active = Boolean(activeLayerId && layerId === activeLayerId)
  const strokeColor = kind === 'raster'
    ? 'rgba(239, 200, 111, 0.95)'
    : active ? 'rgba(63, 140, 255, 0.96)' : 'rgba(126, 217, 169, 0.84)'
  const fillColor = kind === 'raster'
    ? 'rgba(239, 200, 111, 0.1)'
    : active ? 'rgba(63, 140, 255, 0.18)' : 'rgba(126, 217, 169, 0.12)'

  return new Style({
    fill: new Fill({ color: fillColor }),
    stroke: new Stroke({
      color: strokeColor,
      width: active ? 2.2 : 1.4,
      lineDash: kind === 'raster' ? [8, 6] : undefined
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
    id: createRequestId(),
    name,
    kind: 'vector',
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

function formatPropertyValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function geometryLabel(geometry: Geometry | null | undefined): string {
  return geometry?.type ?? '无几何'
}

function emptyFeatureCollection(): FeatureCollection {
  return { type: 'FeatureCollection', features: [] }
}

function stringifyLayerCollection(layer: GeoLayer | null): string {
  const collection = layer?.kind === 'vector' && layer.collection ? layer.collection : emptyFeatureCollection()
  return JSON.stringify(collection, null, 2)
}

export function GeospatialPage(): JSX.Element {
  const [layers, setLayers] = useState<GeoLayer[]>([])
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null)
  const [drawMode, setDrawMode] = useState<DrawMode>('select')
  const [operationPanel, setOperationPanel] = useState<OperationPanel>('geometry')
  const [attributePanelMode, setAttributePanelMode] = useState<AttributePanelMode>('table')
  const [attributePanelCollapsed, setAttributePanelCollapsed] = useState(false)
  const [basemapMode, setBasemapMode] = useState<BasemapMode>('offline')
  const [busy, setBusy] = useState(false)
  const [busyStartedAt, setBusyStartedAt] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [status, setStatus] = useState<WorkStatus>({ kind: 'idle', message: '导入地理数据后开始处理' })
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([])
  const [exportFormat, setExportFormat] = useState<Exclude<GeoDataFormat, 'geotiff'>>('geojson')
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
  const workerRef = useRef<Worker | null>(null)
  const pendingRef = useRef(new Map<string, PendingWorkerCall>())
  const selectRef = useRef<Select | null>(null)
  const modifyRef = useRef<Modify | null>(null)
  const drawRef = useRef<Draw | null>(null)
  const snapRef = useRef<Snap | null>(null)
  const activeLayerIdRef = useRef<string | null>(null)
  const fitAfterRenderRef = useRef(false)
  const taskTokenRef = useRef(0)

  const activeLayer = useMemo(
    () => layers.find((layer) => layer.id === activeLayerId) ?? null,
    [activeLayerId, layers]
  )
  const vectorLayers = useMemo(() => layers.filter((layer) => layer.kind === 'vector' && layer.collection), [layers])
  const clipLayer = useMemo(
    () => vectorLayers.find((layer) => layer.id === clipLayerId) ?? null,
    [clipLayerId, vectorLayers]
  )
  const activeFields = useMemo(() => getLayerFields(activeLayer), [activeLayer])
  const canEditActiveLayer = activeLayer?.kind === 'vector' && Boolean(activeLayer.collection)
  const canExportActiveLayer = canEditActiveLayer && !busy
  const statusMessage = busy ? `${status.message} · 已用时 ${formatElapsed(elapsedSeconds)}` : status.message
  const selectedFeatureSet = useMemo(() => new Set(selectedFeatureIds), [selectedFeatureIds])
  const activeCollection = activeLayer?.kind === 'vector' ? activeLayer.collection ?? null : null
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
    syncJsonEditorFromLayer(layer)
  }, [syncJsonEditorFromLayer])

  const rejectPendingWorkerCalls = useCallback((error: Error): void => {
    pendingRef.current.forEach((handler) => {
      window.clearTimeout(handler.timeoutId)
      handler.reject(error)
    })
    pendingRef.current.clear()
  }, [])

  const createWorker = useCallback((): Worker => {
    const worker = new Worker(new URL('../../../utils/geospatial-worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const handler = pendingRef.current.get(event.data.id)
      if (!handler) return
      window.clearTimeout(handler.timeoutId)
      pendingRef.current.delete(event.data.id)
      if (event.data.success) {
        handler.resolve(event.data.payload)
      } else {
        handler.reject(new Error(event.data.message))
      }
    }
    worker.onerror = (event) => {
      rejectPendingWorkerCalls(new Error(event.message || '地理空间 Worker 异常'))
      if (workerRef.current === worker) {
        worker.terminate()
        workerRef.current = null
      }
    }
    worker.onmessageerror = () => {
      rejectPendingWorkerCalls(new Error('地理空间 Worker 返回了无法解析的数据'))
      if (workerRef.current === worker) {
        worker.terminate()
        workerRef.current = null
      }
    }
    return worker
  }, [rejectPendingWorkerCalls])

  const callWorker = useCallback(<T,>(
    request: WorkerRequestPayload,
    options: WorkerCallOptions = {}
  ): Promise<T> => {
    const worker = workerRef.current ?? createWorker()
    workerRef.current = worker
    const id = createRequestId()
    const timeoutMs = options.timeoutMs ?? 120000
    return new Promise<T>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        const handler = pendingRef.current.get(id)
        if (!handler) return
        pendingRef.current.delete(id)
        handler.reject(new Error(options.timeoutMessage ?? `地理空间 Worker 超过 ${Math.round(timeoutMs / 1000)} 秒没有返回，已停止当前任务`))
        if (workerRef.current === worker) {
          worker.terminate()
          workerRef.current = createWorker()
        }
      }, timeoutMs)

      pendingRef.current.set(id, {
        resolve: (payload) => resolve(payload as T),
        reject,
        timeoutId
      })

      try {
        const { message, transfers } = prepareWorkerRequest(request, id)
        worker.postMessage(message, transfers)
      } catch (error) {
        window.clearTimeout(timeoutId)
        pendingRef.current.delete(id)
        reject(error instanceof Error ? error : new Error('无法启动地理空间 Worker 任务'))
      }
    })
  }, [createWorker])

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
    rejectPendingWorkerCalls(new Error('任务已停止'))
    workerRef.current?.terminate()
    workerRef.current = createWorker()
    setBusy(false)
    setBusyStartedAt(null)
    setElapsedSeconds(0)
    setStatus({ kind: 'warning', message: '当前地理空间任务已停止' })
  }, [createWorker, rejectPendingWorkerCalls])

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

  const applyCollectionToActiveLayer = useCallback((
    collection: FeatureCollection,
    message: string,
    options: { fit?: boolean } = {}
  ): void => {
    const targetId = activeLayerIdRef.current
    if (!targetId) return
    setLayers((current) => current.map((layer) => (
      layer.id === targetId && layer.kind === 'vector'
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
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857'
    }) as FeatureCollection)

    setLayers((current) => current.map((layer) => {
      if (layer.id !== targetId || layer.kind !== 'vector') return layer
      return updateGeoLayerCollection(layer, collection)
    }))
    setSelectedFeatureIds([])
    setJsonText(JSON.stringify(collection, null, 2))
    setJsonDirty(false)
    setJsonError('')
    setStatus({ kind: 'success', message: nextMessage })
  }, [])

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
    if (!activeLayer || activeLayer.kind !== 'vector') {
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
    const worker = createWorker()
    workerRef.current = worker
    return () => {
      rejectPendingWorkerCalls(new Error('地理空间页面已关闭'))
      if (workerRef.current && workerRef.current !== worker) workerRef.current.terminate()
      worker.terminate()
      workerRef.current = null
    }
  }, [createWorker, rejectPendingWorkerCalls])

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
      visible: false
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
    baseLayerRef.current?.setVisible(basemapMode === 'osm')
  }, [basemapMode])

  useEffect(() => {
    const source = vectorSourceRef.current
    const layer = vectorLayerRef.current
    if (!source || !layer) return
    source.clear()

    layers.forEach((geoLayer) => {
      if (!geoLayer.visible) return
      const collection = geoLayer.collection ?? (geoLayer.kind === 'raster' && geoLayer.raster?.bbox ? bboxToCollection(geoLayer.raster.bbox) : null)
      if (!collection) return
      const features = geoJsonFormat.readFeatures(collection, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857'
      }) as OlFeature<OlGeometry>[]
      features.forEach((feature, index) => {
        feature.set('__pawkitLayerId', geoLayer.id)
        feature.set('__pawkitLayerKind', geoLayer.kind)
        feature.set('__pawkitFeatureIndex', index)
        feature.set('__pawkitFeatureKey', featureKey(geoLayer.id, index))
      })
      source.addFeatures(features)
    })

    layer.changed()
    if (fitAfterRenderRef.current) {
      fitAfterRenderRef.current = false
      requestAnimationFrame(fitMapToSource)
    }
  }, [fitMapToSource, layers])

  useEffect(() => {
    vectorLayerRef.current?.changed()
  }, [activeLayerId])

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

    if (!canEditActiveLayer || !activeLayerId) return

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
        event.feature.set('__pawkitLayerKind', 'vector')
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
  }, [activeLayerId, canEditActiveLayer, drawMode, syncActiveVectorLayer])

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
    setLayers((current) => current.filter((layer) => layer.id !== layerId))
    if (activeLayerId === layerId) {
      const nextLayer = layers.find((layer) => layer.id !== layerId)
      activateLayer(nextLayer ?? null)
    }
    setStatus({ kind: 'success', message: '图层已删除' })
  }

  const toggleLayerVisible = (layerId: string): void => {
    setLayers((current) => current.map((layer) => (
      layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
    )))
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
    if (!activeLayer || activeLayer.kind !== 'vector') {
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

    const taskToken = beginTask('Worker 正在执行空间处理')
    try {
      const result = await callWorker<GeoOperationResult>({
        type: 'operation',
        request: {
          type,
          layer: activeLayer,
          clipLayer: requiresClip ? clipLayer ?? undefined : undefined,
          options
        }
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
    if (!activeLayer || activeLayer.kind !== 'vector') {
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

  const renderOperationPanel = (): JSX.Element => {
    if (operationPanel === 'geometry') {
      return (
        <section className="space-y-3">
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
          <button className="toolbar-button w-full" onClick={() => void runOperation('merge')} disabled={busy || !canEditActiveLayer}>
            <Merge className="h-4 w-4" />
            按字段合并
          </button>
        </section>
      )
    }

    if (operationPanel === 'attributes') {
      return (
        <section className="space-y-3">
          <input
            className="w-full rounded-md border border-[var(--glass-border)] bg-[var(--input-surface)] px-2 py-2 text-sm text-[color:var(--text-primary)]"
            value={fieldName}
            onChange={(event) => setFieldName(event.target.value)}
            placeholder="字段名，例如 name"
          />
          <input
            className="w-full rounded-md border border-[var(--glass-border)] bg-[var(--input-surface)] px-2 py-2 text-sm text-[color:var(--text-primary)]"
            value={newFieldName}
            onChange={(event) => setNewFieldName(event.target.value)}
            placeholder="新字段名"
          />
          <textarea
            className="min-h-24 w-full resize-y rounded-md border border-[var(--glass-border)] bg-[var(--input-surface)] px-2 py-2 text-sm text-[color:var(--text-primary)]"
            value={expression}
            onChange={(event) => setExpression(event.target.value)}
            placeholder="表达式，例如 population > 100000 或 area * 2"
          />
          <div className="grid grid-cols-2 gap-2">
            <button className="toolbar-button" onClick={() => void runOperation('filter')} disabled={busy || !canEditActiveLayer}>筛选</button>
            <button className="toolbar-button" onClick={() => void runOperation('calculate')} disabled={busy || !canEditActiveLayer}>计算字段</button>
            <button className="toolbar-button" onClick={() => void runOperation('rename-field')} disabled={busy || !canEditActiveLayer}>派生重命名</button>
            <button className="toolbar-button" onClick={() => void runOperation('drop-field')} disabled={busy || !canEditActiveLayer}>派生删除</button>
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

  const renderAttributePanel = (): JSX.Element => {
    if (!activeLayer) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-[color:var(--text-muted)]">
          导入或新建矢量图层后，可在这里查看表格和编辑 GeoJSON。
        </div>
      )
    }
    if (activeLayer.kind === 'raster') {
      return (
        <div className="flex h-full items-center justify-center text-sm text-[color:var(--tone-warning)]">
          GeoTIFF 当前仅展示范围，不提供属性表和 JSON 编辑。
        </div>
      )
    }

    if (attributePanelMode === 'json') {
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
                          defaultValue={formatPropertyValue(feature.properties?.[field])}
                          onClick={(event) => event.stopPropagation()}
                          onBlur={(event) => editFeatureProperty(index, field, event.currentTarget.value)}
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

  return (
    <div className="tool-page flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="toolbar-surface flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button className="toolbar-button-primary" onClick={importFiles} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            导入数据
          </button>
          {busy && (
            <button className="toolbar-button-danger" onClick={cancelCurrentTask}>
              <XCircle className="h-4 w-4" />
              停止任务
            </button>
          )}
          <button className="toolbar-button" onClick={createDrawingLayer} disabled={busy}>
            <Plus className="h-4 w-4" />
            新建绘制图层
          </button>
          <button className="toolbar-button" onClick={fitMapToSource} disabled={layers.length === 0}>
            <Globe2 className="h-4 w-4" />
            适配视图
          </button>
          <button
            className="toolbar-button"
            onClick={() => setBasemapMode((mode) => (mode === 'offline' ? 'osm' : 'offline'))}
            title={basemapMode === 'offline' ? '当前使用离线网格，不请求在线瓦片' : '当前使用在线 OSM 底图'}
          >
            {basemapMode === 'offline' ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
            {basemapMode === 'offline' ? '离线网格' : '在线 OSM'}
          </button>
        </div>
        <div className={`rounded-md border px-3 py-1.5 text-xs ${
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

      <div
        className="grid min-h-0 flex-1 grid-cols-[260px_minmax(420px,1fr)_320px] gap-3"
        style={{ gridTemplateRows: attributePanelCollapsed ? 'minmax(0,1fr) auto' : 'minmax(300px,1fr) minmax(220px,38%)' }}
      >
        <aside className="glass-panel row-span-2 flex min-h-0 flex-col gap-3 overflow-hidden">
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
                  支持 GeoJSON、TopoJSON、CSV、KML、SVG、Shapefile ZIP、FlatGeobuf、GeoPackage、GeoParquet 和 GeoTIFF 导入。GeoTIFF 当前只展示范围。
                </div>
              )}
              {layers.map((layer) => (
                <button
                  key={layer.id}
                  className={`rounded-lg border p-3 text-left transition ${
                    layer.id === activeLayerId
                      ? 'border-[rgba(var(--color-primary-rgb),0.55)] bg-[var(--surface-selected)]'
                      : 'border-[var(--glass-border)] bg-[var(--input-surface)] hover:bg-[var(--glass-surface-hover)]'
                  }`}
                  onClick={() => activateLayer(layer)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[color:var(--text-primary)]">{layer.name}</div>
                      <div className="mt-1 text-xs text-[color:var(--text-muted)]">{formatLayerKind(layer)}</div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <span
                        className="icon-button h-7 min-h-7 w-7 min-w-7"
                        role="button"
                        tabIndex={0}
                        title={layer.visible ? '隐藏图层' : '显示图层'}
                        onClick={(event) => {
                          event.stopPropagation()
                          toggleLayerVisible(layer.id)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') toggleLayerVisible(layer.id)
                        }}
                      >
                        {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </span>
                      <span
                        className="icon-button h-7 min-h-7 w-7 min-w-7"
                        role="button"
                        tabIndex={0}
                        title="删除图层"
                        onClick={(event) => {
                          event.stopPropagation()
                          removeLayer(layer.id)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') removeLayer(layer.id)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                  {layer.kind === 'raster' && (
                    <div className="mt-2 rounded-md border border-[var(--tone-warning-border)] bg-[var(--tone-warning-soft)] px-2 py-1 text-xs text-[color:var(--tone-warning)]">
                      栅格层只叠加范围，矢量处理禁用。
                    </div>
                  )}
                  {layer.warnings && layer.warnings.length > 0 && (
                    <div className="mt-2 text-xs text-[color:var(--tone-warning)]">{layer.warnings[0]}</div>
                  )}
                </button>
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
                onChange={(event) => setExportFormat(event.target.value as Exclude<GeoDataFormat, 'geotiff'>)}
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
          className="relative min-h-0 overflow-hidden rounded-lg border border-[var(--glass-border)] bg-[var(--window-surface)]"
          style={basemapMode === 'offline' ? {
            backgroundColor: 'var(--window-surface)',
            backgroundImage: 'linear-gradient(rgba(var(--color-primary-rgb),0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--color-primary-rgb),0.08) 1px, transparent 1px)',
            backgroundSize: '32px 32px'
          } : undefined}
        >
          <div ref={mapElementRef} className="h-full w-full" />
          <div className="absolute left-3 top-3 flex flex-wrap gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--window-surface)]/95 p-2 shadow-sm">
            {([
              ['select', MousePointer2, '选择/修改'],
              ['point', CircleDot, '点'],
              ['line', PenLine, '线'],
              ['polygon', Sparkles, '面'],
              ['box', BoxSelect, '框选范围']
            ] as const).map(([mode, Icon, label]) => (
              <button
                key={mode}
                className={`segmented-item ${drawMode === mode ? 'segmented-item-active' : ''}`}
                onClick={() => setDrawMode(mode)}
                disabled={!canEditActiveLayer}
                title={label}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
            <button className="toolbar-button-danger" onClick={deleteSelectedFeatures} disabled={selectedFeatureIds.length === 0}>
              <Trash2 className="h-4 w-4" />
              删除选中 {selectedFeatureIds.length > 0 ? selectedFeatureIds.length : ''}
            </button>
          </div>
          {basemapMode === 'offline' && (
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-[var(--glass-border)] bg-[var(--window-surface)]/90 px-2 py-1 text-xs text-[color:var(--text-muted)]">
              离线网格底图 · 不请求在线瓦片
            </div>
          )}
        </main>

        <aside className="glass-panel flex min-h-0 flex-col gap-3 overflow-auto">
          <div className="flex items-center gap-1 rounded-lg border border-[var(--glass-border)] bg-[var(--input-surface)] p-1">
            {operationTabs.map((tab) => (
              <button
                key={tab.id}
                className={`segmented-item flex-1 justify-center ${operationPanel === tab.id ? 'segmented-item-active' : ''}`}
                onClick={() => setOperationPanel(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {renderOperationPanel()}
        </aside>

        <section className="glass-panel col-span-2 flex min-h-0 flex-col gap-3 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <MapIcon className="h-4 w-4 text-[color:var(--text-muted)]" />
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                  属性数据 {activeLayer ? `· ${activeLayer.name}` : ''}
                </h2>
                <p className="text-xs text-[color:var(--text-muted)]">
                  {activeLayer?.kind === 'vector' ? `${activeLayer.featureCount} 条记录，选中 ${selectedFeatureIds.length} 条` : '矢量图层支持表格和 JSON 编辑'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className={`segmented-item ${attributePanelMode === 'table' ? 'segmented-item-active' : ''}`}
                onClick={() => setAttributePanelMode('table')}
              >
                <Table2 className="h-4 w-4" />
                表格
              </button>
              <button
                className={`segmented-item ${attributePanelMode === 'json' ? 'segmented-item-active' : ''}`}
                onClick={() => setAttributePanelMode('json')}
              >
                <FileJson className="h-4 w-4" />
                JSON
              </button>
              <button className="icon-button h-8 min-h-8 w-8 min-w-8" onClick={() => setAttributePanelCollapsed((value) => !value)} title={attributePanelCollapsed ? '展开属性面板' : '收起属性面板'}>
                {attributePanelCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {!attributePanelCollapsed && renderAttributePanel()}
        </section>
      </div>
    </div>
  )
}
