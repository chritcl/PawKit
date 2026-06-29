import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import type { FeatureCollection } from 'geojson'
import type { GeoFilePayload, GeoLayer } from '../../../shared/types'
import {
  addPropertyField,
  detectGeoFormat,
  dropPropertyField,
  exportGeoLayer,
  formatGeometryCellValue,
  formatPropertyCellValue,
  getLayerFields,
  getMapDataProjection,
  importGeoFiles,
  normalizeGeoBytes,
  normalizeGeoJsonInput,
  parseGeometryCellValue,
  parsePropertyCellValue,
  renamePropertyField,
  runGeoOperation,
  setFeatureGeometry,
  setFeatureProperty,
  updateGeoLayerCollection,
  validateGeoOperationRequest
} from './geospatial'
import { getNextActiveLayerAfterRemoval } from '../pages/tools/geospatial/page-helpers'

vi.mock('flatgeobuf', () => {
  throw new Error('GeoJSON 不应加载 FlatGeobuf')
})

vi.mock('shapefile', () => {
  throw new Error('GeoJSON 不应加载 Shapefile')
})

vi.mock('@mapbox/shp-write', () => {
  throw new Error('GeoJSON 不应加载 Shapefile 写出库')
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
    expect(detectGeoFormat('roads.gpkg')).toBeNull()
    expect(detectGeoFormat('cities.parquet')).toBeNull()
    expect(detectGeoFormat('image.tiff')).toBeNull()
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

  it('扫描完整图层字段而不是只扫描前 200 条', () => {
    const collection: FeatureCollection = {
      type: 'FeatureCollection',
      features: Array.from({ length: 205 }, (_, index) => ({
        type: 'Feature',
        properties: index === 204 ? { lateField: '后置字段' } : { name: `记录 ${index + 1}` },
        geometry: { type: 'Point', coordinates: [index, index] }
      }))
    }

    expect(getLayerFields(layer(collection))).toContain('lateField')
  })

  it('格式化和解析属性单元格时尽量保留 JSON 类型', () => {
    expect(formatPropertyCellValue({ parent: { adcode: 39916 } })).toBe('{"parent":{"adcode":39916}}')
    expect(parsePropertyCellValue('42.5', 1)).toBe(42.5)
    expect(parsePropertyCellValue('false', true)).toBe(false)
    expect(parsePropertyCellValue('[1,2,3]', [])).toEqual([1, 2, 3])
    expect(parsePropertyCellValue('{"adcode":39916}', { adcode: 0 })).toEqual({ adcode: 39916 })
    expect(parsePropertyCellValue('001', '原始字符串')).toBe('001')
    expect(() => parsePropertyCellValue('{bad}', {})).toThrow('对象或数组属性必须输入有效 JSON')
  })

  it('格式化和解析几何 WKT 单元格', () => {
    const pointText = formatGeometryCellValue(pointCollection.features[0].geometry)
    const line = parseGeometryCellValue('LINESTRING (120 30, 121 31)')
    const polygon = parseGeometryCellValue('POLYGON ((0 0, 1 0, 1 1, 0 0))')
    const multiPolygonText = formatGeometryCellValue(multiPolygonCollection.features[0].geometry)

    expect(pointText).toBe('POINT (116.4074 39.9042)')
    expect(parseGeometryCellValue(pointText)).toEqual(pointCollection.features[0].geometry)
    expect(formatGeometryCellValue(line)).toBe('LINESTRING (120 30, 121 31)')
    expect(formatGeometryCellValue(polygon)).toBe('POLYGON ((0 0, 1 0, 1 1, 0 0))')
    expect(parseGeometryCellValue(multiPolygonText)).toEqual(multiPolygonCollection.features[0].geometry)
    expect(() => parseGeometryCellValue('NOT_A_WKT')).toThrow('WKT 格式无效')
    expect(() => parseGeometryCellValue('POINT EMPTY')).toThrow('几何不能为空')
  })

  it('编辑几何单元格并同步图层边界', () => {
    const changedGeometry = setFeatureGeometry(pointCollection, 0, parseGeometryCellValue('POINT (100 20)'))
    const geometry = changedGeometry.features[0].geometry
    const nextLayer = updateGeoLayerCollection(layer(pointCollection), changedGeometry)

    if (geometry?.type !== 'Point') throw new Error('应该是点几何')
    expect(geometry.coordinates).toEqual([100, 20])
    expect(pointCollection.features[0].geometry).toEqual({ type: 'Point', coordinates: [116.4074, 39.9042] })
    expect(nextLayer.featureCount).toBe(2)
    expect(nextLayer.bbox).toEqual([100, 20, 121.4737, 31.2304])
  })

  it('从 CSV 自动识别经纬度列', async () => {
    const result = await importGeoFiles([
      file('cities.csv', 'name,lon,lat\n北京,116.4074,39.9042\n上海,121.4737,31.2304')
    ])

    expect(result.layers[0].featureCount).toBe(2)
    expect(result.layers[0].collection?.features[1].geometry?.type).toBe('Point')
  })

  it('从 CSV WKT 字段导入几何', async () => {
    const result = await importGeoFiles([
      file('routes.csv', 'name,geometry\n一号线,"LINESTRING (116.1 39.1, 116.2 39.2)"')
    ])

    expect(result.warnings).toEqual([])
    expect(result.layers[0].featureCount).toBe(1)
    expect(result.layers[0].collection?.features[0].geometry?.type).toBe('LineString')
    expect(result.layers[0].collection?.features[0].properties?.name).toBe('一号线')
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
    expect(projected.layer?.crs).toBe('EPSG:3857')
    expect(getMapDataProjection(projected.layer)).toBe('EPSG:3857')
  })

  it('前置校验地理处理参数', async () => {
    const source = layer(pointCollection)

    expect(() => validateGeoOperationRequest({
      type: 'buffer',
      layer: source,
      options: { distance: Number.NaN, units: 'kilometers' }
    })).toThrow('缓冲距离必须是有效数字')

    expect((await runGeoOperation({
      type: 'simplify',
      layer: source,
      options: { tolerance: -1 }
    })).message).toBe('简化容差不能小于 0')

    expect((await runGeoOperation({
      type: 'calculate',
      layer: source,
      options: { field: '', expression: 'population * 2' }
    })).message).toBe('请输入要写入的字段名')

    expect((await runGeoOperation({
      type: 'sort',
      layer: source,
      options: { field: '' }
    })).message).toBe('请选择排序字段')
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

  it('导入边界数据时保留可见提示', async () => {
    const csv = await importGeoFiles([
      file('mixed.csv', 'name,lon,lat\n有效,120,30\n无效,x,30')
    ])
    expect(csv.layers[0].featureCount).toBe(1)
    expect(csv.layers[0].warnings).toContain('部分 CSV 行的经纬度字段无效，已跳过')

    const geojson = await importGeoFiles([
      file('mixed.geojson', JSON.stringify({
        type: 'FeatureCollection',
        features: [
          pointCollection.features[0],
          { type: 'Feature', properties: { name: '空几何' }, geometry: null }
        ]
      }))
    ])
    expect(geojson.layers[0].featureCount).toBe(1)
    expect(geojson.layers[0].warnings).toContain('已跳过 1 个无效 GeoJSON 要素')
  })

  it('删除图层后选择相邻图层', () => {
    const layers: GeoLayer[] = [
      { ...layer(pointCollection), id: 'a', name: 'A' },
      { ...layer(pointCollection), id: 'b', name: 'B' },
      { ...layer(pointCollection), id: 'c', name: 'C' }
    ]

    expect(getNextActiveLayerAfterRemoval(layers, 'b', 'b')?.id).toBe('c')
    expect(getNextActiveLayerAfterRemoval(layers, 'c', 'c')?.id).toBe('b')
    expect(getNextActiveLayerAfterRemoval(layers, 'a', 'b')?.id).toBe('b')
  })

  it('重型地理格式不再导入', async () => {
    const result = await importGeoFiles([{
      name: 'cities.parquet',
      path: 'cities.parquet',
      bytes: encoder.encode('PAR1'),
      size: 4
    }])

    expect(result.layers).toEqual([])
    expect(result.warnings).toEqual(['cities.parquet 格式暂不支持'])
  })
})
