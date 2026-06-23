import type { GeoLayer } from '../../../../../shared/types'

export function getNextActiveLayerAfterRemoval(
  layers: GeoLayer[],
  removedLayerId: string,
  activeLayerId: string | null
): GeoLayer | null {
  if (activeLayerId !== removedLayerId) {
    return layers.find((layer) => layer.id === activeLayerId) ?? null
  }

  const removedIndex = layers.findIndex((layer) => layer.id === removedLayerId)
  if (removedIndex < 0) return layers[0] ?? null
  return layers[removedIndex + 1] ?? layers[removedIndex - 1] ?? null
}
