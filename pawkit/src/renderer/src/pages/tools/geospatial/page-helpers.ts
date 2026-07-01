import type { GeoLayer } from '../../../../../shared/types'

export function areStringArraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index])
}

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

export function getValidFeatureSelectionKeys(layerId: string, keys: string[], featureCount: number): string[] {
  const prefix = `${layerId}:`
  const seen = new Set<string>()
  return keys.filter((key) => {
    if (seen.has(key) || !key.startsWith(prefix)) return false
    const index = Number(key.slice(prefix.length))
    if (!Number.isInteger(index) || index < 0 || index >= featureCount) return false
    seen.add(key)
    return true
  })
}

interface FeatureSelectionOptions {
  layerId: string
  featureIndex: number
  featureCount: number
  currentKeys: string[]
  toggle: boolean
}

export function getNextFeatureSelectionKeys({
  layerId,
  featureIndex,
  featureCount,
  currentKeys,
  toggle
}: FeatureSelectionOptions): string[] {
  const validKeys = getValidFeatureSelectionKeys(layerId, currentKeys, featureCount)
  if (!Number.isInteger(featureIndex) || featureIndex < 0 || featureIndex >= featureCount) {
    return validKeys
  }

  const key = `${layerId}:${featureIndex}`
  if (!toggle) return [key]
  if (validKeys.includes(key)) return validKeys.filter((item) => item !== key)
  return [...validKeys, key]
}
