import { useEffect, type MutableRefObject } from 'react'
import OlFeature from 'ol/Feature'
import GeoJSON from 'ol/format/GeoJSON'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import type { Geometry as OlGeometry } from 'ol/geom'
import type { GeoLayer } from '../../../../../shared/types'
import { getMapDataProjection } from '../../../utils/geospatial'

const geoJsonFormat = new GeoJSON()

interface MapLayerSyncOptions {
  layers: GeoLayer[]
  activeLayerId: string | null
  vectorSourceRef: MutableRefObject<VectorSource<OlFeature<OlGeometry>> | null>
  vectorLayerRef: MutableRefObject<VectorLayer<VectorSource<OlFeature<OlGeometry>>> | null>
  fitAfterRenderRef: MutableRefObject<boolean>
  fitMapToSource: () => void
  featureKey: (layerId: string, featureIndex: number) => string
}

export function useMapLayerSync({
  layers,
  activeLayerId,
  vectorSourceRef,
  vectorLayerRef,
  fitAfterRenderRef,
  fitMapToSource,
  featureKey
}: MapLayerSyncOptions): void {
  useEffect(() => {
    const source = vectorSourceRef.current
    const layer = vectorLayerRef.current
    if (!source || !layer) return
    source.clear()

    layers.forEach((geoLayer) => {
      if (!geoLayer.visible) return
      const features = geoJsonFormat.readFeatures(geoLayer.collection, {
        dataProjection: getMapDataProjection(geoLayer),
        featureProjection: 'EPSG:3857'
      }) as OlFeature<OlGeometry>[]
      features.forEach((feature, index) => {
        feature.set('__pawkitLayerId', geoLayer.id)
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
  }, [featureKey, fitAfterRenderRef, fitMapToSource, layers, vectorLayerRef, vectorSourceRef])

  useEffect(() => {
    vectorLayerRef.current?.changed()
  }, [activeLayerId, vectorLayerRef])
}
