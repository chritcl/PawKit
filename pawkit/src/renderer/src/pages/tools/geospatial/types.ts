export type DrawMode = 'select' | 'modify' | 'draw-point' | 'draw-line' | 'draw-polygon' | 'draw-rectangle'
export type StatusKind = 'idle' | 'success' | 'warning' | 'error'
export type OperationPanelId = 'geometry' | 'attributes' | 'projection'
export type AttributePanelMode = 'table' | 'json'
export type BasemapMode = 'offline' | 'osm'

export const operationTabs: Array<{
  id: OperationPanelId
  label: string
  title: string
  description: string
  disabledHint: string
}> = [
  {
    id: 'geometry',
    label: '几何',
    title: '几何处理',
    description: '对当前图层做简化、缓冲、裁剪、擦除和按字段融合，结果会生成新图层。',
    disabledHint: '导入或新建一个矢量图层后，才能执行几何处理。'
  },
  {
    id: 'attributes',
    label: '属性',
    title: '属性处理',
    description: '按表达式筛选记录、计算字段、派生重命名、派生删除和字段排序。',
    disabledHint: '当前图层没有可处理的属性字段时，只能先在属性表新增字段。'
  },
  {
    id: 'projection',
    label: '投影',
    title: '坐标系转换',
    description: '把当前图层从源 CRS 转到目标 CRS，默认支持 EPSG:4326、EPSG:3857 和完整 Proj4。',
    disabledHint: '导入或新建一个矢量图层后，才能转换坐标系。'
  }
]

export interface WorkStatus {
  kind: StatusKind
  message: string
}
