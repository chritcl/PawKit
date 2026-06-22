import { nanoid } from 'nanoid'
import { Parser } from 'expr-eval'
import geopackageSqlWasmUrl from '@ngageoint/geopackage/dist/sql-wasm.wasm?url'
import type { Buffer } from 'buffer'
import type {
  BBox,
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  Position
} from 'geojson'
import type {
  GeoArchiveEntry,
  GeoBinaryData,
  GeoDataFormat,
  GeoExportRequest,
  GeoFilePayload,
  GeoImportResult,
  GeoLayer,
  GeoOperationRequest,
  GeoOperationResult
} from '../../../shared/types'
import type { ColumnSource, KeyValue } from 'hyparquet-writer'

type GeoFeature = Feature<Geometry, GeoJsonProperties>
type GeoFeatureCollection = FeatureCollection<Geometry, GeoJsonProperties>
type TurfModule = typeof import('@turf/turf')
type TurfUnits = import('@turf/turf').Units
type BrowserProcessLike = {
  env: Record<string, string | undefined>
  pid: number
  browser: boolean
  noDeprecation: boolean
  nextTick: (callback: (...args: unknown[]) => void, ...args: unknown[]) => void
}
type WkxGeometryConstructor = {
  parse: (value: string | Buffer) => { toGeoJSON: () => unknown }
  parseGeoJSON: (value: object) => { toWkt: () => string }
}

export interface GeoExportPayload {
  fileName: string
  bytes?: GeoBinaryData
  archiveEntries?: GeoArchiveEntry[]
  mimeType: string
}

const textDecoder = new TextDecoder('utf-8')
const textEncoder = new TextEncoder()

const lonFieldNames = ['lon', 'lng', 'longitude', 'x', '经度']
const latFieldNames = ['lat', 'latitude', 'y', '纬度']
const geometryFieldNames = ['geometry', 'geom', 'wkt', 'the_geom', 'wkb']
const geometryTypes = new Set([
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
  'GeometryCollection'
])

const supportedReadExtensions: Record<string, GeoDataFormat> = {
  geojson: 'geojson',
  json: 'geojson',
  topojson: 'topojson',
  csv: 'csv',
  tsv: 'csv',
  kml: 'kml',
  svg: 'svg',
  shp: 'shapefile',
  fgb: 'flatgeobuf',
  gpkg: 'geopackage',
  parquet: 'geoparquet',
  geoparquet: 'geoparquet',
  tif: 'geotiff',
  tiff: 'geotiff'
}

export const geoDialogFilters = [
  {
    name: '地理空间数据',
    extensions: [
      'geojson',
      'json',
      'topojson',
      'csv',
      'tsv',
      'kml',
      'svg',
      'shp',
      'shx',
      'dbf',
      'prj',
      'cpg',
      'fgb',
      'gpkg',
      'parquet',
      'geoparquet',
      'tif',
      'tiff',
      'zip'
    ]
  },
  { name: '所有文件', extensions: ['*'] }
]

function cloneCollection(collection: GeoFeatureCollection): GeoFeatureCollection {
  return JSON.parse(JSON.stringify(collection)) as GeoFeatureCollection
}

function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return value instanceof ArrayBuffer || Object.prototype.toString.call(value) === '[object ArrayBuffer]'
}

export function normalizeGeoBytes(bytes: GeoBinaryData): Uint8Array {
  if (isArrayBuffer(bytes)) return new Uint8Array(bytes)
  if (ArrayBuffer.isView(bytes)) {
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }
  throw new Error('地理空间文件不是有效二进制数据')
}

function bytesFromUnknown(value: unknown): Uint8Array {
  if (isArrayBuffer(value)) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }
  if (Array.isArray(value)) return new Uint8Array(value)
  throw new Error('导出结果不是有效二进制数据')
}

export function bytesToArrayBuffer(bytes: GeoBinaryData): ArrayBuffer {
  const normalized = normalizeGeoBytes(bytes)
  const buffer = new ArrayBuffer(normalized.byteLength)
  new Uint8Array(buffer).set(normalized)
  return buffer
}

function decodeText(bytes: GeoBinaryData): string {
  return textDecoder.decode(normalizeGeoBytes(bytes))
}

function encodeText(text: string): Uint8Array {
  return textEncoder.encode(text)
}

function ensureBrowserProcess(): void {
  const globalScope = globalThis as unknown as { process?: Partial<BrowserProcessLike> }
  if (globalScope.process) {
    globalScope.process.env ??= {}
    return
  }
  globalScope.process = {
    env: {},
    pid: 0,
    browser: true,
    noDeprecation: true,
    nextTick: (callback, ...args) => {
      queueMicrotask(() => callback(...args))
    }
  }
}

async function loadWkxGeometry(): Promise<WkxGeometryConstructor> {
  ensureBrowserProcess()
  const wkx = await import('wkx')
  return wkx.Geometry as unknown as WkxGeometryConstructor
}

function extensionOf(name: string): string {
  const matched = /\.([^.]+)$/.exec(name.toLowerCase())
  return matched?.[1] ?? ''
}

function baseNameOf(name: string): string {
  return name.replace(/\.[^.]+$/, '').toLowerCase()
}

export function detectGeoFormat(name: string): GeoDataFormat | null {
  return supportedReadExtensions[extensionOf(name)] ?? null
}

function visitGeometryPositions(geometry: Geometry, visitor: (position: Position) => void): void {
  if (geometry.type === 'GeometryCollection') {
    geometry.geometries.forEach((item) => visitGeometryPositions(item, visitor))
    return
  }

  const walk = (value: unknown): void => {
    if (Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number') {
      visitor(value as Position)
      return
    }
    if (Array.isArray(value)) value.forEach(walk)
  }
  walk(geometry.coordinates)
}

function getCollectionBBox(collection: GeoFeatureCollection): BBox | undefined {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  collection.features.forEach((feature) => {
    if (!feature.geometry) return
    visitGeometryPositions(feature.geometry, ([x, y]) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    })
  })

  return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : undefined
}

function createLayer(
  name: string,
  format: GeoDataFormat,
  collection: GeoFeatureCollection,
  warnings: string[] = []
): GeoLayer {
  return {
    id: nanoid(),
    name,
    kind: 'vector',
    format,
    visible: true,
    featureCount: collection.features.length,
    bbox: getCollectionBBox(collection),
    crs: 'EPSG:4326',
    collection,
    warnings
  }
}

function createRasterLayer(
  name: string,
  format: GeoDataFormat,
  width: number,
  height: number,
  bbox?: BBox,
  warnings: string[] = []
): GeoLayer {
  return {
    id: nanoid(),
    name,
    kind: 'raster',
    format,
    visible: true,
    featureCount: 0,
    bbox,
    raster: { width, height, bbox },
    warnings
  }
}

function isGeoJsonGeometry(value: unknown): value is Geometry {
  if (!value || typeof value !== 'object') return false
  const typed = value as { type?: string; coordinates?: unknown; geometries?: unknown }
  if (!typed.type || !geometryTypes.has(typed.type)) return false
  if (typed.type === 'GeometryCollection') return Array.isArray(typed.geometries)
  return Array.isArray(typed.coordinates)
}

export function normalizeGeoJsonInput(
  value: unknown,
  options: { dropInvalidFeatures?: boolean } = {}
): GeoFeatureCollection {
  if (!value || typeof value !== 'object') {
    throw new Error('不是有效的 GeoJSON 对象')
  }

  const typed = value as { type?: string; features?: GeoFeature[]; geometry?: Geometry }
  if (typed.type === 'FeatureCollection' && Array.isArray(typed.features)) {
    const features = typed.features.filter((item) => item?.type === 'Feature' && isGeoJsonGeometry(item.geometry))
    if (!options.dropInvalidFeatures && features.length !== typed.features.length) {
      throw new Error('FeatureCollection 中包含无效要素')
    }
    return {
      type: 'FeatureCollection',
      features
    }
  }

  if (typed.type === 'Feature' && isGeoJsonGeometry(typed.geometry)) {
    return { type: 'FeatureCollection', features: [typed as GeoFeature] }
  }

  if (isGeoJsonGeometry(value)) {
    return {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: value as Geometry }]
    }
  }

  throw new Error('GeoJSON 必须是 FeatureCollection、Feature 或 Geometry')
}

function normalizeGeoJson(value: unknown): GeoFeatureCollection {
  return normalizeGeoJsonInput(value, { dropInvalidFeatures: true })
}

export function updateGeoLayerCollection(layer: GeoLayer, collection: GeoFeatureCollection): GeoLayer {
  return {
    ...layer,
    kind: 'vector',
    collection,
    featureCount: collection.features.length,
    bbox: getCollectionBBox(collection)
  }
}

export function setFeatureProperty(
  collection: GeoFeatureCollection,
  featureIndex: number,
  field: string,
  value: unknown
): GeoFeatureCollection {
  const targetField = field.trim()
  if (!targetField) throw new Error('字段名不能为空')
  const next = cloneCollection(collection)
  const feature = next.features[featureIndex]
  if (!feature) throw new Error('要素不存在')
  feature.properties = {
    ...(feature.properties ?? {}),
    [targetField]: value
  }
  return next
}

export function addPropertyField(
  collection: GeoFeatureCollection,
  field: string,
  defaultValue: unknown = ''
): GeoFeatureCollection {
  const targetField = field.trim()
  if (!targetField) throw new Error('字段名不能为空')
  const next = cloneCollection(collection)
  next.features.forEach((feature) => {
    feature.properties = {
      ...(feature.properties ?? {}),
      [targetField]: feature.properties?.[targetField] ?? defaultValue
    }
  })
  return next
}

export function renamePropertyField(
  collection: GeoFeatureCollection,
  from: string,
  to: string
): GeoFeatureCollection {
  const sourceField = from.trim()
  const targetField = to.trim()
  if (!sourceField || !targetField) throw new Error('原字段和新字段不能为空')
  const next = cloneCollection(collection)
  next.features.forEach((feature) => {
    if (!feature.properties || !(sourceField in feature.properties)) return
    feature.properties[targetField] = feature.properties[sourceField]
    delete feature.properties[sourceField]
  })
  return next
}

export function dropPropertyField(collection: GeoFeatureCollection, field: string): GeoFeatureCollection {
  const targetField = field.trim()
  if (!targetField) throw new Error('字段名不能为空')
  const next = cloneCollection(collection)
  next.features.forEach((feature) => {
    if (feature.properties) delete feature.properties[targetField]
  })
  return next
}

async function parseJsonLayer(file: GeoFilePayload): Promise<GeoLayer> {
  const value = JSON.parse(decodeText(file.bytes))
  if (value?.type === 'Topology') {
    return createLayer(file.name, 'topojson', await topoJsonToCollection(value))
  }
  return createLayer(file.name, 'geojson', normalizeGeoJson(value))
}

async function topoJsonToCollection(value: unknown): Promise<GeoFeatureCollection> {
  const { feature: topojsonFeature } = await import('topojson-client')
  const topologyObject = value as { objects?: Record<string, unknown> }
  const objectNames = Object.keys(topologyObject.objects ?? {})
  if (objectNames.length === 0) {
    throw new Error('TopoJSON 没有可读取的 objects')
  }
  const features = objectNames.flatMap((name) => {
    const converted = topojsonFeature(value as never, topologyObject.objects?.[name] as never) as
      | GeoFeature
      | GeoFeatureCollection
    return converted.type === 'FeatureCollection' ? converted.features : [converted]
  })
  return { type: 'FeatureCollection', features }
}

function findField(fields: string[], candidates: string[]): string | null {
  const lowerMap = new Map(fields.map((field) => [field.toLowerCase(), field]))
  for (const candidate of candidates) {
    const matched = lowerMap.get(candidate.toLowerCase())
    if (matched) return matched
  }
  return null
}

async function parseGeometryValue(value: unknown): Promise<Geometry | null> {
  if (!value) return null
  if (typeof value === 'object') {
    const maybeGeometry = value as Geometry
    if (typeof maybeGeometry.type === 'string') return maybeGeometry
  }
  const text = String(value).trim()
  if (!text) return null
  if (text.startsWith('{')) {
    const parsed = JSON.parse(text) as Geometry | GeoFeature
    return parsed.type === 'Feature' ? parsed.geometry : parsed as Geometry
  }
  const WkxGeometry = await loadWkxGeometry()
  return WkxGeometry.parse(text).toGeoJSON() as Geometry
}

async function parseCsvLayer(file: GeoFilePayload): Promise<GeoLayer> {
  const Papa = await import('papaparse')
  const delimiter = extensionOf(file.name) === 'tsv' ? '\t' : undefined
  const result = Papa.parse<Record<string, unknown>>(decodeText(file.bytes), {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    delimiter
  })

  if (result.errors.length > 0) {
    throw new Error(result.errors[0]?.message ?? 'CSV 解析失败')
  }

  const rows = result.data.filter((row) => Object.keys(row).length > 0)
  const fields = result.meta.fields ?? Object.keys(rows[0] ?? {})
  const geometryField = findField(fields, geometryFieldNames)
  const lonField = findField(fields, lonFieldNames)
  const latField = findField(fields, latFieldNames)
  const warnings: string[] = []

  if (!geometryField && (!lonField || !latField)) {
    throw new Error('CSV 需要 WKT/GeoJSON geometry 字段，或经纬度/XY 字段')
  }

  const features: GeoFeature[] = []
  for (const row of rows) {
    try {
      const properties = { ...row } as GeoJsonProperties
      let geometry: Geometry | null = null
      if (geometryField) {
        geometry = await parseGeometryValue(row[geometryField])
        delete properties?.[geometryField]
      } else if (lonField && latField) {
        const x = Number(row[lonField])
        const y = Number(row[latField])
        if (Number.isFinite(x) && Number.isFinite(y)) {
          geometry = { type: 'Point', coordinates: [x, y] }
        }
      }
      if (geometry) features.push({ type: 'Feature', properties, geometry })
    } catch {
      warnings.push('部分 CSV 行的几何字段无法解析，已跳过')
    }
  }

  return createLayer(file.name, 'csv', { type: 'FeatureCollection', features }, [...new Set(warnings)])
}

async function parseKmlLayer(file: GeoFilePayload): Promise<GeoLayer> {
  if (typeof DOMParser === 'undefined') {
    throw new Error('当前运行环境不支持 KML DOM 解析')
  }
  const { kml: kmlToGeoJson } = await import('@mapbox/togeojson')
  const doc = new DOMParser().parseFromString(decodeText(file.bytes), 'application/xml')
  const errorNode = doc.querySelector('parsererror')
  if (errorNode) throw new Error('KML XML 解析失败')
  return createLayer(file.name, 'kml', normalizeGeoJson(kmlToGeoJson(doc)))
}

function parsePointList(points: string): Position[] {
  return points
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(',').map(Number).slice(0, 2) as Position)
    .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]))
}

function closeRing(points: Position[]): Position[] {
  if (points.length === 0) return points
  const first = points[0]
  const last = points[points.length - 1]
  if (first[0] === last[0] && first[1] === last[1]) return points
  return [...points, first]
}

function parseBasicPath(d: string): Geometry | null {
  const tokens = d.match(/[MLZmlz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []
  const points: Position[] = []
  let closed = false
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    if (/^[Zz]$/.test(token)) {
      closed = true
      continue
    }
    if (/^[MLml]$/.test(token)) {
      const x = Number(tokens[i + 1])
      const y = Number(tokens[i + 2])
      if (Number.isFinite(x) && Number.isFinite(y)) {
        points.push([x, y])
        i += 2
      }
    }
  }
  if (points.length < 2) return null
  if (closed && points.length >= 3) {
    return { type: 'Polygon', coordinates: [closeRing(points)] }
  }
  return { type: 'LineString', coordinates: points }
}

function attrValue(markup: string, name: string): string | null {
  const matched = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i').exec(markup)
  return matched?.[1] ?? null
}

function parseSvgLayer(file: GeoFilePayload): GeoLayer {
  const text = decodeText(file.bytes)
  const features: GeoFeature[] = []
  const warnings: string[] = []

  for (const matched of text.matchAll(/<polygon\b[^>]*>/gi)) {
    const points = attrValue(matched[0], 'points')
    if (!points) continue
    const ring = closeRing(parsePointList(points))
    if (ring.length >= 4) {
      features.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } })
    }
  }

  for (const matched of text.matchAll(/<polyline\b[^>]*>/gi)) {
    const points = attrValue(matched[0], 'points')
    if (!points) continue
    const line = parsePointList(points)
    if (line.length >= 2) {
      features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } })
    }
  }

  for (const matched of text.matchAll(/<circle\b[^>]*>/gi)) {
    const cx = Number(attrValue(matched[0], 'cx'))
    const cy = Number(attrValue(matched[0], 'cy'))
    const r = Number(attrValue(matched[0], 'r') ?? 0)
    if (Number.isFinite(cx) && Number.isFinite(cy)) {
      features.push({ type: 'Feature', properties: { r }, geometry: { type: 'Point', coordinates: [cx, cy] } })
    }
  }

  for (const matched of text.matchAll(/<path\b[^>]*>/gi)) {
    const d = attrValue(matched[0], 'd')
    const geometry = d ? parseBasicPath(d) : null
    if (geometry) {
      features.push({ type: 'Feature', properties: {}, geometry })
    } else if (d) {
      warnings.push('部分 SVG path 包含曲线或复杂命令，已跳过')
    }
  }

  if (features.length === 0) {
    throw new Error('SVG 未找到可导入的基础矢量形状')
  }

  return createLayer(file.name, 'svg', { type: 'FeatureCollection', features }, [...new Set(warnings)])
}

async function parseShapefileLayer(files: GeoFilePayload[]): Promise<GeoLayer> {
  const shapefile = await import('shapefile')
  const shp = files.find((file) => extensionOf(file.name) === 'shp')
  if (!shp) throw new Error('Shapefile 缺少 .shp 文件')
  const dbf = files.find((file) => extensionOf(file.name) === 'dbf')
  const prj = files.find((file) => extensionOf(file.name) === 'prj')
  const warnings: string[] = []
  if (!dbf) warnings.push('缺少 .dbf，属性数据为空')
  if (!prj) warnings.push('缺少 .prj，坐标系按 EPSG:4326 处理')

  const source = await shapefile.open(
    bytesToArrayBuffer(shp.bytes),
    dbf ? bytesToArrayBuffer(dbf.bytes) : undefined
  )
  const features: GeoFeature[] = []
  while (true) {
    const result = await source.read()
    if (result.done) break
    if (result.value?.geometry) features.push(result.value as GeoFeature)
  }

  const layer = createLayer(shp.name, 'shapefile', { type: 'FeatureCollection', features }, warnings)
  if (prj) layer.crs = decodeText(prj.bytes)
  return layer
}

async function parseFlatGeobufLayer(file: GeoFilePayload): Promise<GeoLayer> {
  const { geojson: flatgeobufGeojson } = await import('flatgeobuf')
  const features: GeoFeature[] = []
  for await (const feature of flatgeobufGeojson.deserialize(normalizeGeoBytes(file.bytes))) {
    if (feature.geometry) features.push(feature as GeoFeature)
  }
  return createLayer(file.name, 'flatgeobuf', { type: 'FeatureCollection', features })
}

function asyncBufferFromBytes(bytes: GeoBinaryData): { byteLength: number; slice: (start: number, end?: number) => Promise<ArrayBuffer> } {
  const data = normalizeGeoBytes(bytes)
  return {
    byteLength: data.byteLength,
    slice: async (start: number, end?: number) => bytesToArrayBuffer(data.slice(start, end))
  }
}

async function parseParquetGeometry(value: unknown): Promise<Geometry | null> {
  if (!value) return null
  if (isArrayBuffer(value) || ArrayBuffer.isView(value)) {
    const { Buffer } = await import('buffer')
    const WkxGeometry = await loadWkxGeometry()
    return WkxGeometry.parse(Buffer.from(bytesFromUnknown(value))).toGeoJSON() as Geometry
  }
  return parseGeometryValue(value)
}

async function parseGeoParquetLayer(file: GeoFilePayload): Promise<GeoLayer> {
  const { parquetReadObjects } = await import('hyparquet')
  const rows = await parquetReadObjects({ file: asyncBufferFromBytes(file.bytes) })
  const geometryField = findField(Object.keys(rows[0] ?? {}), geometryFieldNames)
  if (!geometryField) {
    throw new Error('GeoParquet 未找到 geometry/WKB/WKT 几何列')
  }
  const featureResults = await Promise.all(rows.map(async (row): Promise<GeoFeature[]> => {
    const properties = { ...row } as GeoJsonProperties
    const geometry = await parseParquetGeometry(row[geometryField])
    delete properties?.[geometryField]
    return geometry ? [{ type: 'Feature', properties, geometry }] : []
  }))
  const features = featureResults.flat()
  return createLayer(file.name, 'geoparquet', { type: 'FeatureCollection', features })
}

async function parseGeoPackageLayers(file: GeoFilePayload): Promise<GeoLayer[]> {
  const { GeoPackageAPI, setSqljsWasmLocateFile } = await import('@ngageoint/geopackage')
  setSqljsWasmLocateFile(() => geopackageSqlWasmUrl)
  const geoPackage = await GeoPackageAPI.open(normalizeGeoBytes(file.bytes))
  try {
    const tables = geoPackage.getFeatureTables()
    return tables.map((table) => {
      const features = [...geoPackage.iterateGeoJSONFeatures(table)]
        .filter((feature): feature is GeoFeature => Boolean(feature.geometry))
      return createLayer(`${file.name} · ${table}`, 'geopackage', { type: 'FeatureCollection', features })
    })
  } finally {
    geoPackage.close()
  }
}

async function parseGeoTiffLayer(file: GeoFilePayload): Promise<GeoLayer> {
  const { fromArrayBuffer } = await import('geotiff')
  const tiff = await fromArrayBuffer(bytesToArrayBuffer(file.bytes))
  const image = await tiff.getImage()
  const rawBbox = image.getBoundingBox()
  const bbox = rawBbox.length >= 4 && rawBbox.every(Number.isFinite) ? rawBbox.slice(0, 4) as BBox : undefined
  return createRasterLayer(file.name, 'geotiff', image.getWidth(), image.getHeight(), bbox, [
    'GeoTIFF 第一版仅支持范围展示，不参与矢量处理或写出'
  ])
}

async function expandZipFiles(file: GeoFilePayload): Promise<GeoFilePayload[]> {
  const { unzipSync } = await import('fflate')
  const entries = unzipSync(normalizeGeoBytes(file.bytes))
  return Object.entries(entries).map(([name, bytes]) => ({
    name,
    path: `${file.path}/${name}`,
    bytes,
    size: bytes.byteLength
  }))
}

function groupShapefileParts(files: GeoFilePayload[]): GeoFilePayload[][] {
  const groups = new Map<string, GeoFilePayload[]>()
  files.forEach((file) => {
    const ext = extensionOf(file.name)
    if (!['shp', 'shx', 'dbf', 'prj', 'cpg'].includes(ext)) return
    const key = baseNameOf(file.name)
    groups.set(key, [...(groups.get(key) ?? []), file])
  })
  return [...groups.values()].filter((group) => group.some((file) => extensionOf(file.name) === 'shp'))
}

export async function importGeoFiles(inputFiles: GeoFilePayload[]): Promise<GeoImportResult> {
  const layers: GeoLayer[] = []
  const warnings: string[] = []
  const expandedFiles: GeoFilePayload[] = []

  for (const file of inputFiles) {
    if (extensionOf(file.name) === 'zip') {
      expandedFiles.push(...await expandZipFiles(file))
    } else {
      expandedFiles.push(file)
    }
  }

  const shapefileParts = new Set<GeoFilePayload>()
  for (const group of groupShapefileParts(expandedFiles)) {
    group.forEach((file) => shapefileParts.add(file))
    layers.push(await parseShapefileLayer(group))
  }

  for (const file of expandedFiles) {
    if (shapefileParts.has(file)) continue
    const format = detectGeoFormat(file.name)
    if (!format) {
      warnings.push(`${file.name} 格式暂不支持`)
      continue
    }

    try {
      if (format === 'geojson') layers.push(await parseJsonLayer(file))
      else if (format === 'topojson') layers.push(createLayer(file.name, 'topojson', await topoJsonToCollection(JSON.parse(decodeText(file.bytes)))))
      else if (format === 'csv') layers.push(await parseCsvLayer(file))
      else if (format === 'kml') layers.push(await parseKmlLayer(file))
      else if (format === 'svg') layers.push(parseSvgLayer(file))
      else if (format === 'flatgeobuf') layers.push(await parseFlatGeobufLayer(file))
      else if (format === 'geoparquet') layers.push(await parseGeoParquetLayer(file))
      else if (format === 'geotiff') layers.push(await parseGeoTiffLayer(file))
      else if (format === 'geopackage') layers.push(...await parseGeoPackageLayers(file))
    } catch (error) {
      warnings.push(`${file.name}: ${error instanceof Error ? error.message : '导入失败'}`)
    }
  }

  return { layers, warnings }
}

async function collectionToCsv(collection: GeoFeatureCollection): Promise<string> {
  const Papa = await import('papaparse')
  const WkxGeometry = await loadWkxGeometry()
  const rows = collection.features.map((feature) => ({
    ...(feature.properties ?? {}),
    geometry: feature.geometry ? WkxGeometry.parseGeoJSON(feature.geometry).toWkt() : ''
  }))
  return Papa.unparse(rows)
}

async function collectionToSvg(collection: GeoFeatureCollection, width = 960, height = 640): Promise<string> {
  const { geoIdentity, geoPath } = await import('d3-geo')
  const projection = geoIdentity().reflectY(true).fitSize([width, height], collection as never)
  const path = geoPath(projection)
  const elements = collection.features.map((feature, index) => {
    const d = path(feature as never)
    const name = String(feature.properties?.name ?? feature.properties?.id ?? `feature-${index + 1}`)
    return d ? `<path d="${d}" data-name="${escapeXml(name)}" />` : ''
  }).filter(Boolean)
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">`,
    `<g fill="#3f8cff" fill-opacity="0.24" stroke="#3f8cff" stroke-width="1.2">`,
    ...elements,
    `</g>`,
    `</svg>`
  ].join('\n')
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sanitizeIdentifier(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .replace(/\W+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 58)
  const candidate = normalized || fallback
  return /^\d/.test(candidate) ? `f_${candidate}` : candidate
}

function uniqueIdentifier(base: string, used: Set<string>): string {
  let candidate = base
  let index = 2
  while (used.has(candidate)) {
    candidate = `${base}_${index}`
    index += 1
  }
  used.add(candidate)
  return candidate
}

function collectPropertyFields(collection: GeoFeatureCollection): string[] {
  const fields = new Set<string>()
  collection.features.forEach((feature) => {
    Object.keys(feature.properties ?? {}).forEach((field) => fields.add(field))
  })
  return [...fields].sort((left, right) => left.localeCompare(right, 'zh-CN'))
}

function normalizeTabularValue(value: unknown): unknown {
  if (value === null || value === undefined) return null
  if (value instanceof Uint8Array) return value
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value)
  return value
}

function inferGeoPackageDataType(values: unknown[]): string {
  const sample = values.find((value) => value !== null && value !== undefined)
  if (typeof sample === 'boolean') return 'BOOLEAN'
  if (typeof sample === 'number') return Number.isInteger(sample) ? 'INTEGER' : 'DOUBLE'
  if (sample instanceof Uint8Array) return 'BLOB'
  return 'TEXT'
}

function inferParquetType(values: unknown[]): ColumnSource['type'] {
  const sample = values.find((value) => value !== null && value !== undefined)
  if (typeof sample === 'boolean') return 'BOOLEAN'
  if (typeof sample === 'number') {
    return Number.isInteger(sample) && sample >= -2147483648 && sample <= 2147483647 ? 'INT32' : 'DOUBLE'
  }
  if (sample instanceof Uint8Array) return 'BYTE_ARRAY'
  return 'STRING'
}

function prepareGeoPackageFeatures(collection: GeoFeatureCollection): {
  columns: Array<{ name: string; dataType: string }>
  features: GeoFeature[]
} {
  const used = new Set(['id', 'geometry'])
  const fields = collectPropertyFields(collection)
  const fieldMap = fields.map((field, index) => ({
    source: field,
    target: uniqueIdentifier(sanitizeIdentifier(field, `field_${index + 1}`), used)
  }))
  const columns = fieldMap.map(({ source, target }) => ({
    name: target,
    dataType: inferGeoPackageDataType(collection.features.map((feature) => feature.properties?.[source]))
  }))
  const features = collection.features.map((feature) => {
    const properties: Record<string, unknown> = {}
    fieldMap.forEach(({ source, target }) => {
      properties[target] = normalizeTabularValue(feature.properties?.[source])
    })
    return { ...feature, properties: properties as GeoJsonProperties }
  })
  return { columns, features }
}

async function collectionToGeoPackageBytes(collection: GeoFeatureCollection, fileName: string): Promise<Uint8Array> {
  const { GeoPackageAPI, setSqljsWasmLocateFile } = await import('@ngageoint/geopackage')
  setSqljsWasmLocateFile(() => geopackageSqlWasmUrl)
  const geoPackage = await GeoPackageAPI.create()
  try {
    const tableName = sanitizeIdentifier(fileName.replace(/\.[^.]+$/, ''), 'pawkit_layer')
    const prepared = prepareGeoPackageFeatures(collection)
    geoPackage.createFeatureTableFromProperties(tableName, prepared.columns)
    await geoPackage.addGeoJSONFeaturesToGeoPackage(prepared.features, tableName, false, 1000)
    return bytesFromUnknown(await geoPackage.export())
  } finally {
    geoPackage.close()
  }
}

function geoParquetMetadata(collection: GeoFeatureCollection): KeyValue[] {
  const geometryTypes = [...new Set(collection.features
    .map((feature) => feature.geometry?.type)
    .filter((type): type is Geometry['type'] => Boolean(type)))]
  return [{
    key: 'geo',
    value: JSON.stringify({
      version: '1.1.0',
      primary_column: 'geometry',
      columns: {
        geometry: {
          encoding: 'WKB',
          geometry_types: geometryTypes,
          crs: null,
          bbox: getCollectionBBox(collection)
        }
      }
    })
  }]
}

async function collectionToGeoParquetBytes(collection: GeoFeatureCollection): Promise<Uint8Array> {
  const fields = collectPropertyFields(collection)
  const columnData: ColumnSource[] = [
    {
      name: 'geometry',
      data: collection.features.map((feature) => feature.geometry),
      type: 'GEOMETRY'
    },
    ...fields.map((field) => {
      const data = collection.features.map((feature) => normalizeTabularValue(feature.properties?.[field]))
      return {
        name: field,
        data,
        type: inferParquetType(data)
      } satisfies ColumnSource
    })
  ]
  const { parquetWriteBuffer } = await import('hyparquet-writer')
  return new Uint8Array(parquetWriteBuffer({
    columnData,
    kvMetadata: geoParquetMetadata(collection)
  }))
}

export async function exportGeoLayer(request: GeoExportRequest, layer: GeoLayer): Promise<GeoExportPayload> {
  if (layer.kind === 'raster' || !layer.collection) {
    throw new Error('GeoTIFF 第一版仅支持读取展示，不能导出为矢量格式')
  }

  const collection = layer.collection
  if (request.format === 'geojson') {
    return {
      fileName: request.fileName,
      bytes: encodeText(JSON.stringify(collection, null, 2)),
      mimeType: 'application/geo+json'
    }
  }
  if (request.format === 'topojson') {
    const { topology } = await import('topojson-server')
    return {
      fileName: request.fileName,
      bytes: encodeText(JSON.stringify(topology({ layer: collection as never }), null, 2)),
      mimeType: 'application/json'
    }
  }
  if (request.format === 'csv') {
    return { fileName: request.fileName, bytes: encodeText(await collectionToCsv(collection)), mimeType: 'text/csv' }
  }
  if (request.format === 'kml') {
    const { toKML } = await import('@placemarkio/tokml')
    return { fileName: request.fileName, bytes: encodeText(toKML(collection)), mimeType: 'application/vnd.google-earth.kml+xml' }
  }
  if (request.format === 'svg') {
    return { fileName: request.fileName, bytes: encodeText(await collectionToSvg(collection)), mimeType: 'image/svg+xml' }
  }
  if (request.format === 'flatgeobuf') {
    const { geojson: flatgeobufGeojson } = await import('flatgeobuf')
    return { fileName: request.fileName, bytes: flatgeobufGeojson.serialize(collection), mimeType: 'application/octet-stream' }
  }
  if (request.format === 'shapefile') {
    const shpwrite = await import('@mapbox/shp-write')
    const zipBytes = await shpwrite.zip<'uint8array'>(collection, {
      outputType: 'uint8array',
      compression: 'DEFLATE',
      filename: request.fileName.replace(/\.zip$/i, '')
    })
    return { fileName: request.fileName, bytes: zipBytes, mimeType: 'application/zip' }
  }
  if (request.format === 'geoparquet') {
    return {
      fileName: request.fileName,
      bytes: await collectionToGeoParquetBytes(collection),
      mimeType: 'application/vnd.apache.parquet'
    }
  }
  if (request.format === 'geopackage') {
    return {
      fileName: request.fileName,
      bytes: await collectionToGeoPackageBytes(collection, request.fileName),
      mimeType: 'application/geopackage+sqlite3'
    }
  }
  throw new Error('暂不支持该导出格式')
}

function ensureVectorCollection(layer: GeoLayer): GeoFeatureCollection {
  if (layer.kind !== 'vector' || !layer.collection) {
    throw new Error('当前操作只支持矢量图层')
  }
  return layer.collection
}

function featureCollectionOf(features: GeoFeature[]): GeoFeatureCollection {
  return { type: 'FeatureCollection', features: features.filter((feature) => feature.geometry) }
}

function polygonClipFeature(turf: TurfModule, feature: GeoFeature, clip: GeoFeature): GeoFeature | null {
  const geometryType = feature.geometry?.type
  if (!geometryType) return null
  if (geometryType === 'Polygon' || geometryType === 'MultiPolygon') {
    const result = turf.intersect(turf.featureCollection([feature, clip]) as never) as GeoFeature | null
    return result ? { ...result, properties: feature.properties ?? {} } : null
  }
  return turf.booleanIntersects(feature as never, clip as never) ? feature : null
}

function polygonEraseFeature(turf: TurfModule, feature: GeoFeature, clip: GeoFeature): GeoFeature | null {
  const geometryType = feature.geometry?.type
  if (!geometryType) return null
  if (geometryType === 'Polygon' || geometryType === 'MultiPolygon') {
    const result = turf.difference(turf.featureCollection([feature, clip]) as never) as GeoFeature | null
    return result ? { ...result, properties: feature.properties ?? {} } : null
  }
  return turf.booleanIntersects(feature as never, clip as never) ? null : feature
}

function unionClipLayer(turf: TurfModule, collection: GeoFeatureCollection): GeoFeature {
  const polygonFeatures = collection.features.filter((feature) => {
    const type = feature.geometry?.type
    return type === 'Polygon' || type === 'MultiPolygon'
  })
  if (polygonFeatures.length === 0) throw new Error('裁剪/擦除范围需要面要素')
  if (polygonFeatures.length === 1) return polygonFeatures[0]
  const merged = turf.union(turf.featureCollection(polygonFeatures) as never) as GeoFeature | null
  if (!merged) throw new Error('裁剪范围合并失败')
  return merged
}

function runClipOrErase(turf: TurfModule, request: GeoOperationRequest, erase: boolean): GeoLayer {
  if (!request.clipLayer) throw new Error('缺少裁剪/擦除范围图层')
  const target = ensureVectorCollection(request.layer)
  const clip = unionClipLayer(turf, ensureVectorCollection(request.clipLayer))
  const features = target.features.flatMap((feature): GeoFeature[] => {
    const next = erase ? polygonEraseFeature(turf, feature, clip) : polygonClipFeature(turf, feature, clip)
    return next ? [next] : []
  })
  return createDerivedLayer(request.layer, erase ? '擦除' : '裁剪', featureCollectionOf(features))
}

function createDerivedLayer(source: GeoLayer, suffix: string, collection: GeoFeatureCollection): GeoLayer {
  return {
    ...source,
    id: nanoid(),
    name: `${source.name} · ${suffix}`,
    kind: 'vector',
    collection,
    featureCount: collection.features.length,
    bbox: getCollectionBBox(collection),
    warnings: []
  }
}

function runMerge(turf: TurfModule, request: GeoOperationRequest): GeoLayer {
  const collection = ensureVectorCollection(request.layer)
  const field = String(request.options.field ?? '').trim()
  const groups = new Map<string, GeoFeature[]>()
  collection.features.forEach((feature) => {
    const key = field ? String(feature.properties?.[field] ?? '') : '全部'
    groups.set(key, [...(groups.get(key) ?? []), feature])
  })

  const mergedFeatures: GeoFeature[] = []
  groups.forEach((features, key) => {
    const polygonFeatures = features.filter((feature) => {
      const type = feature.geometry?.type
      return type === 'Polygon' || type === 'MultiPolygon'
    })
    if (polygonFeatures.length > 0) {
      const geometry = polygonFeatures.length === 1
        ? polygonFeatures[0]
        : turf.union(turf.featureCollection(polygonFeatures) as never) as GeoFeature | null
      if (geometry) {
        mergedFeatures.push({ ...geometry, properties: field ? { [field]: key, count: features.length } : { count: features.length } })
      }
      return
    }
    mergedFeatures.push(...features.map((feature) => ({ ...feature, properties: { ...(feature.properties ?? {}), count: features.length } })))
  })

  return createDerivedLayer(request.layer, '合并', featureCollectionOf(mergedFeatures))
}

function buildParser(): Parser {
  const parser = new Parser({
    operators: {
      assignment: false,
      logical: true,
      comparison: true,
      concatenate: false
    }
  })
  return parser
}

function runFilter(request: GeoOperationRequest): GeoLayer {
  const collection = ensureVectorCollection(request.layer)
  const expression = String(request.options.expression ?? '').trim()
  if (!expression) throw new Error('请输入筛选表达式')
  const compiled = buildParser().parse(expression)
  const features = collection.features.filter((feature) => Boolean(compiled.evaluate(feature.properties ?? {})))
  return createDerivedLayer(request.layer, '筛选', featureCollectionOf(features))
}

function runCalculate(request: GeoOperationRequest): GeoLayer {
  const collection = cloneCollection(ensureVectorCollection(request.layer))
  const field = String(request.options.field ?? '').trim()
  const expression = String(request.options.expression ?? '').trim()
  if (!field || !expression) throw new Error('字段名和计算表达式不能为空')
  const compiled = buildParser().parse(expression)
  collection.features.forEach((feature) => {
    feature.properties = {
      ...(feature.properties ?? {}),
      [field]: compiled.evaluate(feature.properties ?? {})
    }
  })
  return createDerivedLayer(request.layer, `计算 ${field}`, collection)
}

function runRenameField(request: GeoOperationRequest): GeoLayer {
  const collection = cloneCollection(ensureVectorCollection(request.layer))
  const from = String(request.options.from ?? '').trim()
  const to = String(request.options.to ?? '').trim()
  if (!from || !to) throw new Error('原字段和新字段不能为空')
  collection.features.forEach((feature) => {
    if (!feature.properties || !(from in feature.properties)) return
    feature.properties[to] = feature.properties[from]
    delete feature.properties[from]
  })
  return createDerivedLayer(request.layer, `字段 ${from}→${to}`, collection)
}

function runDropField(request: GeoOperationRequest): GeoLayer {
  const collection = cloneCollection(ensureVectorCollection(request.layer))
  const field = String(request.options.field ?? '').trim()
  if (!field) throw new Error('字段名不能为空')
  collection.features.forEach((feature) => {
    if (feature.properties) delete feature.properties[field]
  })
  return createDerivedLayer(request.layer, `删除 ${field}`, collection)
}

function runSort(request: GeoOperationRequest): GeoLayer {
  const collection = cloneCollection(ensureVectorCollection(request.layer))
  const field = String(request.options.field ?? '').trim()
  const direction = request.options.direction === 'desc' ? -1 : 1
  if (!field) throw new Error('排序字段不能为空')
  collection.features.sort((left, right) => {
    const leftValue = left.properties?.[field]
    const rightValue = right.properties?.[field]
    return String(leftValue ?? '').localeCompare(String(rightValue ?? ''), 'zh-CN', { numeric: true }) * direction
  })
  return createDerivedLayer(request.layer, `排序 ${field}`, collection)
}

function transformCoordinates(geometry: Geometry, transform: (point: Position) => Position): Geometry {
  const transformNested = (value: unknown): unknown => {
    if (Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number') {
      return transform(value as Position)
    }
    if (Array.isArray(value)) return value.map(transformNested)
    return value
  }

  if (geometry.type === 'GeometryCollection') {
    return {
      type: 'GeometryCollection',
      geometries: geometry.geometries.map((item) => transformCoordinates(item, transform))
    }
  }
  return { ...geometry, coordinates: transformNested(geometry.coordinates) as never }
}

async function runProject(request: GeoOperationRequest): Promise<GeoLayer> {
  const { default: proj4 } = await import('proj4')
  const collection = cloneCollection(ensureVectorCollection(request.layer))
  const from = String(request.options.from ?? request.layer.crs ?? 'EPSG:4326').trim()
  const to = String(request.options.to ?? 'EPSG:3857').trim()
  if (!from || !to) throw new Error('源坐标系和目标坐标系不能为空')
  const transform = proj4(from, to)
  collection.features.forEach((feature) => {
    if (feature.geometry) {
      feature.geometry = transformCoordinates(feature.geometry, (point) => {
        const [x, y] = transform.forward([point[0], point[1]])
        return point.length > 2 ? [x, y, ...point.slice(2)] : [x, y]
      })
    }
  })
  const layer = createDerivedLayer(request.layer, `投影 ${to}`, collection)
  layer.crs = to
  return layer
}

export async function runGeoOperation(request: GeoOperationRequest): Promise<GeoOperationResult> {
  try {
    const collection = ensureVectorCollection(request.layer)
    const turf = await import('@turf/turf')
    let layer: GeoLayer
    if (request.type === 'simplify') {
      const tolerance = Number(request.options.tolerance ?? 0.01)
      layer = createDerivedLayer(
        request.layer,
        '简化',
        turf.simplify(collection as never, { tolerance, highQuality: true, mutate: false }) as GeoFeatureCollection
      )
    } else if (request.type === 'clip') {
      layer = runClipOrErase(turf, request, false)
    } else if (request.type === 'erase') {
      layer = runClipOrErase(turf, request, true)
    } else if (request.type === 'merge') {
      layer = runMerge(turf, request)
    } else if (request.type === 'filter') {
      layer = runFilter(request)
    } else if (request.type === 'calculate') {
      layer = runCalculate(request)
    } else if (request.type === 'rename-field') {
      layer = runRenameField(request)
    } else if (request.type === 'drop-field') {
      layer = runDropField(request)
    } else if (request.type === 'sort') {
      layer = runSort(request)
    } else if (request.type === 'project') {
      layer = await runProject(request)
    } else if (request.type === 'buffer') {
      const distance = Number(request.options.distance ?? 1)
      const units = String(request.options.units ?? 'kilometers') as TurfUnits
      const buffered = turf.buffer(collection as never, distance, { units }) as GeoFeatureCollection | undefined
      layer = createDerivedLayer(request.layer, '缓冲区', buffered ?? { type: 'FeatureCollection', features: [] })
    } else {
      throw new Error('未知地理处理操作')
    }
    return { success: true, message: '处理完成', layer }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : '处理失败' }
  }
}

export function getLayerFields(layer: GeoLayer | null): string[] {
  if (!layer?.collection) return []
  const fields = new Set<string>()
  layer.collection.features.slice(0, 200).forEach((feature) => {
    Object.keys(feature.properties ?? {}).forEach((field) => fields.add(field))
  })
  return [...fields].sort((left, right) => left.localeCompare(right, 'zh-CN'))
}

export function getExportExtension(format: GeoDataFormat): string {
  if (format === 'shapefile') return 'zip'
  if (format === 'topojson') return 'topojson'
  if (format === 'flatgeobuf') return 'fgb'
  if (format === 'geoparquet') return 'parquet'
  if (format === 'geopackage') return 'gpkg'
  return format
}
