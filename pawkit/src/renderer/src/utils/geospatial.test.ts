import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import type { FeatureCollection } from 'geojson'
import type { GeoFilePayload, GeoLayer } from '../../../shared/types'
import {
  addPropertyField,
  detectGeoFormat,
  dropPropertyField,
  exportGeoLayer,
  importGeoFiles,
  normalizeGeoBytes,
  normalizeGeoJsonInput,
  renamePropertyField,
  runGeoOperation,
  setFeatureProperty,
  updateGeoLayerCollection
} from './geospatial'

vi.mock('@ngageoint/geopackage', () => {
  throw new Error('GeoJSON 不应加载 GeoPackage')
})

vi.mock('flatgeobuf', () => {
  throw new Error('GeoJSON 不应加载 FlatGeobuf')
})

vi.mock('shapefile', () => {
  throw new Error('GeoJSON 不应加载 Shapefile')
})

vi.mock('@mapbox/shp-write', () => {
  throw new Error('GeoJSON 不应加载 Shapefile 写出库')
})

vi.mock('geotiff', () => {
  throw new Error('GeoJSON 不应加载 GeoTIFF')
})

const encoder = new TextEncoder()

function file(name: string, text: string): GeoFilePayload {
  const bytes = encoder.encode(text)
  return {
    name,
    path: name,
    bytes,
    size: bytes.byteLength
  }
}

function layer(collection: FeatureCollection): GeoLayer {
  return {
    id: 'layer-1',
    name: '测试图层',
    kind: 'vector',
    format: 'geojson',
    visible: true,
    featureCount: collection.features.length,
    collection,
    crs: 'EPSG:4326'
  }
}

const pointCollection: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: '北京', population: 2189 },
      geometry: { type: 'Point', coordinates: [116.4074, 39.9042] }
    },
    {
      type: 'Feature',
      properties: { name: '上海', population: 2487 },
      geometry: { type: 'Point', coordinates: [121.4737, 31.2304] }
    }
  ]
}

const multiPolygonCollection: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        acroutes: [39914, 39915, 39916, 39959],
        adcode: -39959,
        areaId: 39959,
        centroid: [111.63301, 29.44756],
        level: 'district',
        name: '安福镇',
        parent: { adcode: 39916 }
      },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [[
            [111.58722, 29.39288],
            [111.7047, 29.39288],
            [111.7047, 29.51124],
            [111.58722, 29.51124],
            [111.58722, 29.39288]
          ]]
        ]
      }
    }
  ]
}

describe('地理空间工具函数', () => {
  it('识别常见地理数据格式', () => {
    expect(detectGeoFormat('roads.geojson')).toBe('geojson')
    expect(detectGeoFormat('districts.topojson')).toBe('topojson')
    expect(detectGeoFormat('table.csv')).toBe('csv')
    expect(detectGeoFormat('image.tiff')).toBe('geotiff')
    expect(detectGeoFormat('unknown.bin')).toBeNull()
  })

  it('导入 GeoJSON 并保留中文属性', async () => {
    const result = await importGeoFiles([
      file('cities.geojson', JSON.stringify(pointCollection))
    ])

    expect(result.warnings).toEqual([])
    expect(result.layers).toHaveLength(1)
    expect(result.layers[0].featureCount).toBe(2)
    expect(result.layers[0].collection?.features[0].properties?.name).toBe('北京')
  })

  it('导入 MultiPolygon GeoJSON 并计算边界', async () => {
    const result = await importGeoFiles([
      file('afz.geojson', JSON.stringify(multiPolygonCollection))
    ])

    expect(result.warnings).toEqual([])
    expect(result.layers).toHaveLength(1)
    expect(result.layers[0].featureCount).toBe(1)
    expect(result.layers[0].bbox).toEqual([111.58722, 29.39288, 111.7047, 29.51124])
    expect(result.layers[0].collection?.features[0].geometry?.type).toBe('MultiPolygon')
    expect(result.layers[0].collection?.features[0].properties?.name).toBe('安福镇')
  })

  it('规范化不同来源的地理二进制数据', () => {
    const fromArrayBuffer = normalizeGeoBytes(new Uint8Array([1, 2, 3]).buffer)
    const fromUint8Array = normalizeGeoBytes(new Uint8Array([4, 5, 6]))
    const crossRealm = runInNewContext('new Uint8Array([7, 8, 9])') as Uint8Array
    const fromCrossRealm = normalizeGeoBytes(crossRealm)

    expect([...fromArrayBuffer]).toEqual([1, 2, 3])
    expect([...fromUint8Array]).toEqual([4, 5, 6])
    expect([...fromCrossRealm]).toEqual([7, 8, 9])
  })

  it('规范化 JSON 编辑输入并拒绝无效要素', () => {
    const wrappedFeature = normalizeGeoJsonInput({
      type: 'Feature',
      properties: { name: '点' },
      geometry: { type: 'Point', coordinates: [120, 30] }
    })
    const wrappedGeometry = normalizeGeoJsonInput({
      type: 'LineString',
      coordinates: [[120, 30], [121, 31]]
    })

    expect(wrappedFeature.features).toHaveLength(1)
    expect(wrappedFeature.features[0].properties?.name).toBe('点')
    expect(wrappedGeometry.features[0].geometry.type).toBe('LineString')
    expect(() => normalizeGeoJsonInput({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: null }]
    })).toThrow('FeatureCollection 中包含无效要素')
  })

  it('编辑属性字段并同步图层统计', () => {
    const source = layer(pointCollection)
    const changedCell = setFeatureProperty(pointCollection, 0, 'name', '北京市')
    const addedField = addPropertyField(changedCell, 'checked', true)
    const renamedField = renamePropertyField(addedField, 'checked', 'enabled')
    const droppedField = dropPropertyField(renamedField, 'population')
    const nextLayer = updateGeoLayerCollection(source, droppedField)

    expect(droppedField.features[0].properties?.name).toBe('北京市')
    expect(droppedField.features[0].properties?.enabled).toBe(true)
    expect(droppedField.features[0].properties?.population).toBeUndefined()
    expect(nextLayer.featureCount).toBe(2)
    expect(nextLayer.bbox).toEqual([116.4074, 31.2304, 121.4737, 39.9042])
  })

  it('从 CSV 自动识别经纬度列', async () => {
    const result = await importGeoFiles([
      file('cities.csv', 'name,lon,lat\n北京,116.4074,39.9042\n上海,121.4737,31.2304')
    ])

    expect(result.layers[0].featureCount).toBe(2)
    expect(result.layers[0].collection?.features[1].geometry?.type).toBe('Point')
  })

  it('执行属性筛选、计算字段和投影转换', async () => {
    const source = layer(pointCollection)
    const filtered = await runGeoOperation({
      type: 'filter',
      layer: source,
      options: { expression: 'population > 2200' }
    })

    expect(filtered.success).toBe(true)
    expect(filtered.layer?.featureCount).toBe(1)
    expect(filtered.layer?.collection?.features[0].properties?.name).toBe('上海')

    const calculated = await runGeoOperation({
      type: 'calculate',
      layer: source,
      options: { field: 'rankScore', expression: 'population * 2' }
    })

    expect(calculated.layer?.collection?.features[0].properties?.rankScore).toBe(4378)
    expect(calculated.layer?.id).not.toBe(source.id)
    expect(source.collection?.features[0].properties?.rankScore).toBeUndefined()

    const projected = await runGeoOperation({
      type: 'project',
      layer: source,
      options: { from: 'EPSG:4326', to: 'EPSG:3857' }
    })

    const coordinates = projected.layer?.collection?.features[0].geometry?.type === 'Point'
      ? projected.layer.collection.features[0].geometry.coordinates
      : null
    expect(coordinates?.[0]).toBeGreaterThan(10000000)
  })

  it('执行缓冲区和裁剪操作', async () => {
    const source = layer(pointCollection)
    const buffered = await runGeoOperation({
      type: 'buffer',
      layer: source,
      options: { distance: 10, units: 'kilometers' }
    })

    expect(buffered.success).toBe(true)
    expect(buffered.layer?.collection?.features[0].geometry?.type).toBe('Polygon')
    expect(buffered.layer?.id).not.toBe(source.id)
    expect(source.collection?.features[0].geometry?.type).toBe('Point')

    const clipLayer = layer({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[[115, 38], [118, 38], [118, 41], [115, 41], [115, 38]]]
          }
        }
      ]
    })
    const clipped = await runGeoOperation({
      type: 'clip',
      layer: source,
      clipLayer,
      options: {}
    })

    expect(clipped.success).toBe(true)
    expect(clipped.layer?.featureCount).toBe(1)
    expect(clipped.layer?.collection?.features[0].properties?.name).toBe('北京')

    const erased = await runGeoOperation({
      type: 'erase',
      layer: source,
      clipLayer,
      options: {}
    })
    expect(erased.success).toBe(true)
    expect(erased.layer?.featureCount).toBe(1)
    expect(erased.layer?.collection?.features[0].properties?.name).toBe('上海')

    const merged = await runGeoOperation({
      type: 'merge',
      layer: layer(multiPolygonCollection),
      options: { field: 'level' }
    })
    expect(merged.success).toBe(true)
    expect(merged.layer?.id).not.toBe('layer-1')
    expect(merged.layer?.collection?.features[0].properties?.count).toBe(1)
  })

  it('导出 CSV 和 SVG', async () => {
    const source = layer(pointCollection)
    const csv = await exportGeoLayer({ layerId: source.id, format: 'csv', fileName: 'cities.csv' }, source)
    const svg = await exportGeoLayer({ layerId: source.id, format: 'svg', fileName: 'cities.svg' }, source)

    expect(new TextDecoder().decode(csv.bytes)).toContain('geometry')
    expect(new TextDecoder().decode(svg.bytes)).toContain('<svg')
  })

  it('导出 GeoParquet 后可以重新导入', async () => {
    const source = layer(pointCollection)
    const payload = await exportGeoLayer({ layerId: source.id, format: 'geoparquet', fileName: 'cities.parquet' }, source)
    const result = await importGeoFiles([{
      name: payload.fileName,
      path: payload.fileName,
      bytes: payload.bytes ?? new Uint8Array(),
      size: payload.bytes?.byteLength ?? 0
    }])

    expect(result.warnings).toEqual([])
    expect(result.layers[0].featureCount).toBe(2)
    expect(result.layers[0].collection?.features[0].properties?.name).toBe('北京')
  })
})
