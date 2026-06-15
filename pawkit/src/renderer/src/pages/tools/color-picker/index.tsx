import { PointerEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  ClipboardCopy,
  Code2,
  Contrast,
  FileJson,
  Library,
  Palette,
  Pipette,
  Search,
  Star,
  Trash2
} from 'lucide-react'
import { ColorRecord, HSL, RGB } from '../../../../../shared/types'
import {
  ColorHarmonyGroup,
  compositeColor,
  generateColorHarmonyGroups,
  generateColorScale,
  generateCssVar,
  generateJsonToken,
  generateTailwindSnippet,
  getContrastRatio,
  getReadableTextColor,
  hexToRgb,
  hslToRgb,
  hsvToRgb,
  isValidHsl,
  isValidRgb,
  parseHexColor,
  rgbaToHex8,
  rgbToHex,
  rgbToHsl,
  rgbToHsv
} from '../../../utils/color'

type WorkspaceTab = 'formats' | 'palette' | 'contrast' | 'library'
type LibrarySort = 'recent' | 'created' | 'hue'

interface DraftValues {
  hex: string
  r: string
  g: string
  b: string
  rgbAlpha: string
  h: string
  s: string
  l: string
  hslAlpha: string
}

interface OutputFormat {
  id: string
  label: string
  value: string
  long?: boolean
  icon?: typeof ClipboardCopy
}

const black: RGB = { r: 0, g: 0, b: 0 }
const white: RGB = { r: 255, g: 255, b: 255 }
const tabs: Array<{ id: WorkspaceTab; label: string; icon: typeof Code2 }> = [
  { id: 'formats', label: '格式', icon: Code2 },
  { id: 'palette', label: '色板', icon: Palette },
  { id: 'contrast', label: '对比度', icon: Contrast },
  { id: 'library', label: '颜色库', icon: Library }
]

function formatAlpha(alpha: number): string {
  return Number(alpha.toFixed(2)).toString()
}

function formatRgb(rgb: RGB): string {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
}

function formatRgba(rgb: RGB, alpha: number): string {
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${formatAlpha(alpha)})`
}

function formatHsl(hsl: HSL): string {
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`
}

function formatHsla(hsl: HSL, alpha: number): string {
  return `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${formatAlpha(alpha)})`
}

function createDrafts(rgb: RGB, hsl: HSL, alpha: number): DraftValues {
  return {
    hex: alpha < 1 ? rgbaToHex8(rgb.r, rgb.g, rgb.b, alpha) : rgbToHex(rgb.r, rgb.g, rgb.b),
    r: String(rgb.r),
    g: String(rgb.g),
    b: String(rgb.b),
    rgbAlpha: String(Math.round(alpha * 100)),
    h: String(hsl.h),
    s: String(hsl.s),
    l: String(hsl.l),
    hslAlpha: String(Math.round(alpha * 100))
  }
}

function recordKey(record: Pick<ColorRecord, 'hex' | 'alpha'>): string {
  return `${record.hex.toLowerCase()}-${formatAlpha(record.alpha ?? 1)}`
}

function sourceLabel(source?: ColorRecord['source']): string {
  if (source === 'screen') return '屏幕取色'
  if (source === 'favorite') return '收藏'
  if (source === 'recent') return '最近使用'
  return '手动调整'
}

function exportHarmony(group: ColorHarmonyGroup, mode: 'css' | 'json'): string {
  if (mode === 'json') {
    return JSON.stringify(Object.fromEntries(group.colors.map((item, index) => [
      index === 0 ? 'base' : `color${index}`,
      item.hex
    ])), null, 2)
  }
  return group.colors.map((item, index) => (
    `--color-${group.id}-${index === 0 ? 'base' : index}: ${item.hex};`
  )).join('\n')
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
}

// 调色板工具组件
export function ColorPickerPage(): JSX.Element {
  const [rgb, setRgb] = useState<RGB>({ r: 22, g: 119, b: 255 })
  const [hsl, setHsl] = useState<HSL>({ h: 215, s: 100, l: 54 })
  const [alpha, setAlpha] = useState(1)
  const [drafts, setDrafts] = useState<DraftValues>(() => createDrafts(rgb, hsl, alpha))
  const [draftError, setDraftError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('formats')
  const [defaultFormat, setDefaultFormat] = useState(() => localStorage.getItem('color.defaultFormat') ?? 'HEX')
  const [expandedFormats, setExpandedFormats] = useState<string[]>([])
  const [feedback, setFeedback] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [favorites, setFavorites] = useState<ColorRecord[]>([])
  const [recent, setRecent] = useState<ColorRecord[]>([])
  const [librarySearch, setLibrarySearch] = useState('')
  const [librarySort, setLibrarySort] = useState<LibrarySort>('recent')
  const [previewHex, setPreviewHex] = useState<string | null>(null)
  const [contrastForeground, setContrastForeground] = useState('#000000')
  const [contrastBackground, setContrastBackground] = useState('#1677ff')
  const [contrastBase, setContrastBase] = useState('#ffffff')

  const hex = rgbToHex(rgb.r, rgb.g, rgb.b)
  const hex8 = rgbaToHex8(rgb.r, rgb.g, rgb.b, alpha)
  const hsv = useMemo(() => rgbToHsv(rgb.r, rgb.g, rgb.b), [rgb])
  const currentCssColor = alpha < 1 ? formatRgba(rgb, alpha) : hex
  const currentKey = `${hex}-${formatAlpha(alpha)}`

  const showFeedback = useCallback((message: string): void => {
    setFeedback(message)
    window.setTimeout(() => setFeedback((current) => current === message ? null : current), 2200)
  }, [])

  const persist = useCallback((key: 'color.favorites' | 'color.recent', value: ColorRecord[]): void => {
    window.electronAPI?.setting?.set(key, value).catch(() => {})
  }, [])

  const addToRecent = useCallback((record: ColorRecord): void => {
    const key = recordKey(record)
    const nextRecent = [record, ...recent.filter((item) => recordKey(item) !== key)].slice(0, 30)
    setRecent(nextRecent)
    persist('color.recent', nextRecent)
  }, [persist, recent])

  const applyColor = useCallback((
    nextRgb: RGB,
    nextAlpha = alpha,
    options?: { remember?: boolean; source?: ColorRecord['source']; message?: string }
  ): void => {
    const normalizedAlpha = Math.max(0, Math.min(1, nextAlpha))
    const nextHsl = rgbToHsl(nextRgb.r, nextRgb.g, nextRgb.b)
    const nextHex = rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b)
    setRgb(nextRgb)
    setHsl(nextHsl)
    setAlpha(normalizedAlpha)
    setDrafts(createDrafts(nextRgb, nextHsl, normalizedAlpha))
    setDraftError(null)
    setContrastBackground(normalizedAlpha < 1 ? rgbaToHex8(nextRgb.r, nextRgb.g, nextRgb.b, normalizedAlpha) : nextHex)
    if (options?.remember) {
      addToRecent({
        hex: nextHex,
        rgb: nextRgb,
        hsl: nextHsl,
        alpha: normalizedAlpha,
        createdAt: new Date().toISOString(),
        source: options.source ?? 'manual'
      })
    }
    if (options?.message) showFeedback(options.message)
  }, [addToRecent, alpha, showFeedback])

  useEffect(() => {
    if (!window.electronAPI?.setting) return
    window.electronAPI.setting.get<ColorRecord[]>('color.favorites').then((data) => {
      if (Array.isArray(data)) setFavorites(data)
    }).catch(() => {})
    window.electronAPI.setting.get<ColorRecord[]>('color.recent').then((data) => {
      if (!Array.isArray(data)) return
      setRecent(data)
    }).catch(() => {})
  }, [])

  const commitHex = (): void => {
    const parsed = parseHexColor(drafts.hex)
    if (!parsed) {
      setDraftError('请输入有效的 HEX、HEX8 或短格式颜色值')
      return
    }
    applyColor(parsed.rgb, parsed.alpha, { remember: true, message: '颜色值已更新' })
  }

  const commitRgb = (): void => {
    const values = [drafts.r, drafts.g, drafts.b].map((value) => Number(value))
    const nextAlpha = Number(drafts.rgbAlpha)
    if (!isValidRgb(values[0], values[1], values[2]) || !Number.isFinite(nextAlpha) || nextAlpha < 0 || nextAlpha > 100) {
      setDraftError('RGB 必须是 0–255 的整数，透明度必须是 0–100')
      return
    }
    applyColor({ r: values[0], g: values[1], b: values[2] }, nextAlpha / 100, {
      remember: true,
      message: 'RGBA 已更新'
    })
  }

  const commitHsl = (): void => {
    const values = [drafts.h, drafts.s, drafts.l].map((value) => Number(value))
    const nextAlpha = Number(drafts.hslAlpha)
    if (!isValidHsl(values[0], values[1], values[2]) || !Number.isFinite(nextAlpha) || nextAlpha < 0 || nextAlpha > 100) {
      setDraftError('H 必须是 0–360，S、L 和透明度必须是 0–100')
      return
    }
    applyColor(hslToRgb(values[0], values[1], values[2]), nextAlpha / 100, {
      remember: true,
      message: 'HSLA 已更新'
    })
  }

  const writeClipboard = useCallback(async (text: string): Promise<void> => {
    if (window.electronAPI?.clipboard?.writeText) {
      await window.electronAPI.clipboard.writeText(text)
      return
    }
    await navigator.clipboard?.writeText(text)
  }, [])

  const outputFormats = useMemo<OutputFormat[]>(() => [
    { id: 'HEX', label: 'HEX', value: hex },
    { id: 'HEX8', label: 'HEX8', value: hex8 },
    { id: 'RGB', label: 'RGB', value: formatRgb(rgb) },
    { id: 'RGBA', label: 'RGBA', value: formatRgba(rgb, alpha) },
    { id: 'HSL', label: 'HSL', value: formatHsl(hsl) },
    { id: 'HSLA', label: 'HSLA', value: formatHsla(hsl, alpha) },
    { id: 'CSS', label: 'CSS 变量', value: generateCssVar(hex, rgb, hsl, alpha), long: true, icon: Code2 },
    { id: 'Tailwind', label: 'Tailwind 色阶', value: generateTailwindSnippet(hex), long: true, icon: Code2 },
    { id: 'JSON', label: 'JSON Token', value: generateJsonToken(hex, rgb, hsl, alpha), long: true, icon: FileJson }
  ], [alpha, hex, hex8, hsl, rgb])

  const handleCopy = useCallback(async (format: OutputFormat): Promise<void> => {
    await writeClipboard(format.value)
    setDefaultFormat(format.id)
    localStorage.setItem('color.defaultFormat', format.id)
    addToRecent({
      hex,
      rgb,
      hsl,
      alpha,
      createdAt: new Date().toISOString(),
      source: 'recent'
    })
    showFeedback(`${format.label} 已复制`)
  }, [addToRecent, alpha, hex, hsl, rgb, showFeedback, writeClipboard])

  const handleDefaultCopy = useCallback((): void => {
    const format = outputFormats.find((item) => item.id === defaultFormat) ?? outputFormats[0]
    void handleCopy(format)
  }, [defaultFormat, handleCopy, outputFormats])

  const isFavorite = favorites.some((item) => recordKey(item) === currentKey)

  const handleFavorite = useCallback((): void => {
    const exists = favorites.some((item) => recordKey(item) === currentKey)
    const nextFavorites = exists
      ? favorites.filter((item) => recordKey(item) !== currentKey)
      : [{
        hex,
        rgb,
        hsl,
        alpha,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: 'favorite' as const
      }, ...favorites]
    setFavorites(nextFavorites)
    persist('color.favorites', nextFavorites)
    if (!exists) {
      addToRecent({
        hex,
        rgb,
        hsl,
        alpha,
        createdAt: new Date().toISOString(),
        source: 'favorite'
      })
    }
    showFeedback(exists ? '已取消收藏' : '已收藏当前颜色')
  }, [addToRecent, alpha, currentKey, favorites, hex, hsl, persist, rgb, showFeedback])

  const handlePickScreenColor = useCallback(async (): Promise<void> => {
    if (!window.electronAPI?.screenshot?.pickScreenColor) {
      showFeedback('当前环境无法启动屏幕取色')
      return
    }
    setCapturing(true)
    try {
      const response = await window.electronAPI.screenshot.pickScreenColor()
      if (response.status === 'picked' && response.result) {
        applyColor(response.result.rgb, 1, {
          remember: true,
          source: 'screen',
          message: `已从当前屏幕取色 ${response.result.hex}`
        })
      } else {
        showFeedback(response.message)
      }
    } catch {
      showFeedback('当前屏幕取色失败')
    } finally {
      setCapturing(false)
    }
  }, [applyColor, showFeedback])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isTextEditingTarget(event.target)) return
      if (event.ctrlKey && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        handleDefaultCopy()
        return
      }
      if (event.key.toLowerCase() === 'p') {
        event.preventDefault()
        void handlePickScreenColor()
        return
      }
      if (event.key.toLowerCase() === 'f') {
        event.preventDefault()
        handleFavorite()
        return
      }
      const tabIndex = Number(event.key) - 1
      if (tabIndex >= 0 && tabIndex < tabs.length) {
        setActiveTab(tabs[tabIndex].id)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleDefaultCopy, handleFavorite, handlePickScreenColor])

  const updateSaturationValue = (event: PointerEvent<HTMLDivElement>): void => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const nextSaturation = Math.round(Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * 100)
    const nextValue = Math.round((1 - Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))) * 100)
    applyColor(hsvToRgb(hsv.h, nextSaturation, nextValue), alpha)
  }

  const handleSaturationPointer = (event: PointerEvent<HTMLDivElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId)
    updateSaturationValue(event)
  }

  const handleRangeKey = (kind: 'hue' | 'alpha', event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : -1
    const step = event.shiftKey ? 10 : 1
    event.preventDefault()
    if (kind === 'hue') {
      const nextHue = (hsv.h + direction * step + 360) % 360
      applyColor(hsvToRgb(nextHue, hsv.s, hsv.v), alpha)
    } else {
      applyColor(rgb, Math.max(0, Math.min(1, alpha + direction * step / 100)))
    }
  }

  const scale = useMemo(() => generateColorScale(hex), [hex])
  const harmonyGroups = useMemo(() => generateColorHarmonyGroups(hex), [hex])

  const applyPaletteColor = (nextHex: string): void => {
    const nextRgb = hexToRgb(nextHex)
    if (!nextRgb) return
    applyColor(nextRgb, alpha, { remember: true, message: `已设为当前颜色 ${nextHex}` })
    setPreviewHex(null)
  }

  const previewRgb = previewHex ? hexToRgb(previewHex) : null

  const contrastResult = useMemo(() => {
    const foreground = parseHexColor(contrastForeground) ?? { rgb: black, alpha: 1 }
    const background = parseHexColor(contrastBackground) ?? { rgb, alpha }
    const base = parseHexColor(contrastBase)?.rgb ?? white
    const opaqueBackground = compositeColor(background.rgb, background.alpha, base)
    const opaqueForeground = compositeColor(foreground.rgb, foreground.alpha, opaqueBackground)
    return {
      ratio: getContrastRatio(opaqueForeground, opaqueBackground),
      foreground: rgbToHex(opaqueForeground.r, opaqueForeground.g, opaqueForeground.b),
      background: rgbToHex(opaqueBackground.r, opaqueBackground.g, opaqueBackground.b)
    }
  }, [alpha, contrastBackground, contrastBase, contrastForeground, rgb])

  const filteredFavorites = useMemo(() => {
    const query = librarySearch.trim().toLowerCase()
    const matched = favorites.filter((item) => {
      const haystack = [item.hex, item.name ?? '', ...(item.tags ?? [])].join(' ').toLowerCase()
      return !query || haystack.includes(query)
    })
    return [...matched].sort((a, b) => {
      if (librarySort === 'hue') return a.hsl.h - b.hsl.h
      if (librarySort === 'created') return a.createdAt.localeCompare(b.createdAt)
      return (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt)
    })
  }, [favorites, librarySearch, librarySort])

  const updateFavoriteMeta = (key: string, patch: Pick<ColorRecord, 'name' | 'tags'>): void => {
    const nextFavorites = favorites.map((item) => recordKey(item) === key ? { ...item, ...patch } : item)
    setFavorites(nextFavorites)
    persist('color.favorites', nextFavorites)
  }

  const selectRecord = (record: ColorRecord): void => {
    applyColor(record.rgb, record.alpha ?? 1, { message: `已加载 ${record.name || record.hex}` })
    if (favorites.some((item) => recordKey(item) === recordKey(record))) {
      const nextFavorites = favorites.map((item) => (
        recordKey(item) === recordKey(record) ? { ...item, updatedAt: new Date().toISOString() } : item
      ))
      setFavorites(nextFavorites)
      persist('color.favorites', nextFavorites)
    }
  }

  const removeRecent = (key: string): void => {
    const nextRecent = recent.filter((item) => recordKey(item) !== key)
    setRecent(nextRecent)
    persist('color.recent', nextRecent)
  }

  const renderFormats = (): JSX.Element => (
    <div className="color-format-list">
      {outputFormats.map((format) => {
        const Icon = format.icon ?? ClipboardCopy
        const expanded = expandedFormats.includes(format.id)
        return (
          <div key={format.id} className="color-format-row">
            <button className="color-format-copy" onClick={() => void handleCopy(format)} title={`复制 ${format.label}`}>
              <span className="color-format-label">
                <Icon className="h-4 w-4" />
                {format.label}
              </span>
              <code className={format.long && !expanded ? 'color-format-value color-format-value-clamped' : 'color-format-value'}>
                {format.value}
              </code>
              {defaultFormat === format.id && <span className="meta-badge meta-badge-blue">默认</span>}
              <ClipboardCopy className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" />
            </button>
            {format.long && (
              <button
                className="color-format-expand"
                onClick={() => setExpandedFormats((current) => (
                  current.includes(format.id) ? current.filter((item) => item !== format.id) : [...current, format.id]
                ))}
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                {expanded ? '收起' : '展开'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )

  const renderPalette = (): JSX.Element => (
    <div className="color-tab-stack">
      {previewHex && previewRgb && (
        <div className="color-palette-preview">
          <span className="color-mini-swatch" style={{ backgroundColor: previewHex }} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">正在预览 {previewHex}</div>
            <div className="text-xs text-[color:var(--text-muted)]">点击其他色块继续比较，确认后再替换当前颜色</div>
          </div>
          <button className="toolbar-button-primary" onClick={() => applyPaletteColor(previewHex)}>设为当前色</button>
        </div>
      )}

      <section>
        <div className="color-section-heading">
          <div>
            <h3>开发色阶</h3>
            <p>单击预览，双击设为当前颜色</p>
          </div>
          <button className="toolbar-button" onClick={() => void writeClipboard(generateTailwindSnippet(hex)).then(() => showFeedback('Tailwind 色阶已复制'))}>
            <ClipboardCopy className="h-4 w-4" />
            复制色阶
          </button>
        </div>
        <div className="color-scale-grid">
          {scale.map((item) => (
            <button
              key={item.label}
              className={`color-scale-item ${previewHex === item.hex ? 'color-swatch-selected' : ''}`}
              onClick={() => setPreviewHex(item.hex)}
              onDoubleClick={() => applyPaletteColor(item.hex)}
              title={`${item.label} · ${item.hex}`}
            >
              <span style={{ backgroundColor: item.hex }} />
              <strong>{item.label}</strong>
              <code>{item.hex}</code>
              {previewHex === item.hex && <Check className="color-swatch-check h-4 w-4" />}
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="color-section-heading">
          <div>
            <h3>配色关系</h3>
            <p>按完整关系组查看并导出</p>
          </div>
        </div>
        <div className="color-harmony-grid">
          {harmonyGroups.map((group) => (
            <div key={group.id} className="color-harmony-group">
              <div className="color-harmony-title">
                <strong>{group.label}</strong>
                <div>
                  <button onClick={() => void writeClipboard(exportHarmony(group, 'css')).then(() => showFeedback(`${group.label} CSS 已复制`))}>CSS</button>
                  <button onClick={() => void writeClipboard(exportHarmony(group, 'json')).then(() => showFeedback(`${group.label} JSON 已复制`))}>JSON</button>
                </div>
              </div>
              <div className="color-harmony-strip">
                {group.colors.map((item) => (
                  <button
                    key={`${group.id}-${item.hex}`}
                    style={{ backgroundColor: item.hex }}
                    onClick={() => setPreviewHex(item.hex)}
                    onDoubleClick={() => applyPaletteColor(item.hex)}
                    title={`${item.label} · ${item.hex}`}
                  >
                    {previewHex === item.hex && <Check className="h-4 w-4" />}
                  </button>
                ))}
              </div>
              <div className="color-harmony-values">{group.colors.map((item) => <code key={item.hex}>{item.hex}</code>)}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )

  const renderContrast = (): JSX.Element => {
    const checks = [
      { label: '普通文本 AA', threshold: 4.5 },
      { label: '普通文本 AAA', threshold: 7 },
      { label: '大文本 AA', threshold: 3 }
    ]
    const previewStyle = { color: contrastResult.foreground, backgroundColor: contrastResult.background }
    return (
      <div className="color-tab-stack">
        <div className="color-contrast-controls">
          <label>
            <span>前景色</span>
            <input className="field-input font-mono" value={contrastForeground} onChange={(event) => setContrastForeground(event.target.value)} />
          </label>
          <button
            className="icon-button color-swap-button"
            onClick={() => {
              setContrastForeground(contrastBackground)
              setContrastBackground(contrastForeground)
            }}
            title="交换前景色和背景色"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
          <label>
            <span>背景色</span>
            <input className="field-input font-mono" value={contrastBackground} onChange={(event) => setContrastBackground(event.target.value)} />
          </label>
          <label>
            <span>透明合成底色</span>
            <input className="field-input font-mono" value={contrastBase} onChange={(event) => setContrastBase(event.target.value)} />
          </label>
        </div>

        <div className="color-contrast-summary">
          <div>
            <span>对比度</span>
            <strong>{contrastResult.ratio}:1</strong>
          </div>
          {checks.map((item) => (
            <div key={item.label} className={contrastResult.ratio >= item.threshold ? 'tone-surface-success' : 'tone-surface-danger'}>
              <span>{item.label}</span>
              <strong>{contrastResult.ratio >= item.threshold ? '通过' : '不通过'}</strong>
            </div>
          ))}
        </div>

        <div className="color-component-preview" style={previewStyle}>
          <div>
            <span className="text-xs opacity-70">真实组件预览</span>
            <h3>清晰的界面从可靠对比度开始</h3>
            <p>这是一段普通正文，用于检查长时间阅读时的可读性和视觉舒适度。</p>
            <a>查看详细规范</a>
          </div>
          <div className="color-preview-actions">
            <button style={{ color: contrastResult.background, backgroundColor: contrastResult.foreground }}>主要操作</button>
            <button className="color-preview-secondary">次要操作</button>
            <button disabled>禁用操作</button>
          </div>
        </div>
      </div>
    )
  }

  const renderLibrary = (): JSX.Element => (
    <div className="color-tab-stack">
      <div className="color-library-toolbar">
        <label className="color-library-search">
          <Search className="h-4 w-4" />
          <input value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="搜索名称、标签或颜色值" />
        </label>
        <select className="field-select" value={librarySort} onChange={(event) => setLibrarySort(event.target.value as LibrarySort)}>
          <option value="recent">最近使用</option>
          <option value="created">最早收藏</option>
          <option value="hue">按色相排序</option>
        </select>
      </div>

      <section>
        <div className="color-section-heading">
          <div>
            <h3>收藏颜色</h3>
            <p>{filteredFavorites.length} 个结果，可直接编辑名称和标签</p>
          </div>
        </div>
        {filteredFavorites.length === 0 ? (
          <div className="color-library-empty">
            <Star className="h-5 w-5" />
            <span>{favorites.length === 0 ? '还没有收藏颜色，按 F 收藏当前颜色' : '没有匹配的收藏颜色'}</span>
          </div>
        ) : (
          <div className="color-library-list">
            {filteredFavorites.map((record) => {
              const key = recordKey(record)
              return (
                <div key={key} className="color-library-row">
                  <button className="color-library-swatch" style={{ backgroundColor: record.alpha && record.alpha < 1 ? formatRgba(record.rgb, record.alpha) : record.hex }} onClick={() => selectRecord(record)} title="加载颜色" />
                  <div className="color-library-fields">
                    <input
                      value={record.name ?? ''}
                      onChange={(event) => updateFavoriteMeta(key, { name: event.target.value, tags: record.tags })}
                      placeholder={record.hex}
                    />
                    <input
                      value={(record.tags ?? []).join(', ')}
                      onChange={(event) => updateFavoriteMeta(key, {
                        name: record.name,
                        tags: event.target.value.split(',').map((item) => item.trim()).filter(Boolean)
                      })}
                      placeholder="标签，用逗号分隔"
                    />
                  </div>
                  <div className="color-library-meta">
                    <code>{record.alpha && record.alpha < 1 ? rgbaToHex8(record.rgb.r, record.rgb.g, record.rgb.b, record.alpha) : record.hex}</code>
                    <span>{sourceLabel(record.source)}</span>
                  </div>
                  <button className="icon-button" onClick={() => void writeClipboard(record.hex).then(() => showFeedback('收藏颜色已复制'))} title="复制颜色">
                    <ClipboardCopy className="h-4 w-4" />
                  </button>
                  <button className="icon-button icon-button-danger" onClick={() => {
                    const next = favorites.filter((item) => recordKey(item) !== key)
                    setFavorites(next)
                    persist('color.favorites', next)
                    showFeedback('收藏颜色已删除')
                  }} title="删除收藏">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <div className="color-section-heading">
          <div>
            <h3>最近颜色</h3>
            <p>{recent.length} 条记录，仅在确认、复制、收藏或取色后写入</p>
          </div>
          {recent.length > 0 && (
            <button className="toolbar-button-danger" onClick={() => {
              setRecent([])
              persist('color.recent', [])
              showFeedback('最近颜色已清空')
            }}>
              <Trash2 className="h-4 w-4" />
              清空
            </button>
          )}
        </div>
        {recent.length === 0 ? (
          <div className="color-library-empty">完成一次取色、复制或收藏后，颜色会出现在这里</div>
        ) : (
          <div className="color-recent-grid">
            {recent.map((record) => {
              const key = recordKey(record)
              return (
                <div key={`${key}-${record.createdAt}`} className="color-recent-item">
                  <button style={{ backgroundColor: record.alpha && record.alpha < 1 ? formatRgba(record.rgb, record.alpha) : record.hex }} onClick={() => selectRecord(record)} title="加载颜色" />
                  <code>{record.alpha && record.alpha < 1 ? rgbaToHex8(record.rgb.r, record.rgb.g, record.rgb.b, record.alpha) : record.hex}</code>
                  <span>{sourceLabel(record.source)}</span>
                  <button onClick={() => removeRecent(key)} title="删除记录"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )

  return (
    <div className="color-workbench">
      <aside className="color-control-panel glass-panel">
        <div className="color-current-heading">
          <div>
            <span>当前颜色</span>
            <strong>{alpha < 1 ? hex8 : hex}</strong>
          </div>
          <span className="meta-badge meta-badge-neutral">{Math.round(alpha * 100)}% 不透明</span>
        </div>

        <div className="color-current-preview checkerboard">
          <div style={{ backgroundColor: currentCssColor }}>
            <div className="color-preview-black">
              <strong>Aa</strong>
              <span>黑色文字</span>
            </div>
            <div className="color-preview-white">
              <strong>Aa</strong>
              <span>白色文字</span>
            </div>
          </div>
        </div>

        <div
          className="color-saturation-field"
          style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
          onPointerDown={handleSaturationPointer}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) updateSaturationValue(event)
          }}
          title="拖动调整饱和度和明度"
        >
          <span className="color-saturation-white" />
          <span className="color-saturation-black" />
          <span className="color-field-handle" style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%` }} />
        </div>

        <div className="color-range-group">
          <label><span>色相</span><code>{hsv.h}°</code></label>
          <input
            className="color-hue-range"
            type="range"
            min="0"
            max="359"
            value={hsv.h}
            onChange={(event) => applyColor(hsvToRgb(Number(event.target.value), hsv.s, hsv.v), alpha)}
            onKeyDown={(event) => handleRangeKey('hue', event)}
          />
        </div>
        <div className="color-range-group">
          <label><span>透明度</span><code>{Math.round(alpha * 100)}%</code></label>
          <div className="checkerboard color-alpha-track">
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(alpha * 100)}
              style={{ '--alpha-color': hex } as React.CSSProperties}
              onChange={(event) => applyColor(rgb, Number(event.target.value) / 100)}
              onKeyDown={(event) => handleRangeKey('alpha', event)}
            />
          </div>
        </div>

        <div className="color-input-stack">
          <label>
            <span>HEX / HEX8</span>
            <input
              className="field-input font-mono"
              value={drafts.hex}
              onChange={(event) => setDrafts((current) => ({ ...current, hex: event.target.value }))}
              onBlur={commitHex}
              onKeyDown={(event) => { if (event.key === 'Enter') commitHex() }}
            />
          </label>
          <div className="color-input-row">
            <span>RGBA</span>
            {(['r', 'g', 'b', 'rgbAlpha'] as const).map((key, index) => (
              <input
                key={key}
                className="field-input font-mono"
                value={drafts[key]}
                onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value }))}
                onBlur={commitRgb}
                onKeyDown={(event) => { if (event.key === 'Enter') commitRgb() }}
                aria-label={['红色', '绿色', '蓝色', '透明度'][index]}
              />
            ))}
          </div>
          <div className="color-input-row">
            <span>HSLA</span>
            {(['h', 's', 'l', 'hslAlpha'] as const).map((key, index) => (
              <input
                key={key}
                className="field-input font-mono"
                value={drafts[key]}
                onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value }))}
                onBlur={commitHsl}
                onKeyDown={(event) => { if (event.key === 'Enter') commitHsl() }}
                aria-label={['色相', '饱和度', '亮度', '透明度'][index]}
              />
            ))}
          </div>
          {draftError && <div className="color-input-error">{draftError}</div>}
        </div>

        <div className="color-primary-actions">
          <button className="toolbar-button-primary" onClick={handleDefaultCopy} title="复制默认格式 · Ctrl+C">
            <ClipboardCopy className="h-4 w-4" />
            复制 {defaultFormat}
          </button>
          <select value={defaultFormat} onChange={(event) => {
            setDefaultFormat(event.target.value)
            localStorage.setItem('color.defaultFormat', event.target.value)
          }} title="选择默认复制格式">
            {outputFormats.map((format) => <option key={format.id} value={format.id}>{format.label}</option>)}
          </select>
          <button className="toolbar-button" onClick={() => void handlePickScreenColor()} disabled={capturing} title="当前屏幕取色 · P">
            <Pipette className="h-4 w-4" />
            {capturing ? '取色中' : '当前屏幕取色'}
          </button>
          <button className={`toolbar-button ${isFavorite ? 'tone-surface-warning' : ''}`} onClick={handleFavorite} title="收藏当前颜色 · F">
            <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
            {isFavorite ? '已收藏' : '收藏'}
          </button>
        </div>
      </aside>

      <section className="color-task-panel glass-panel">
        <div className="color-task-header">
          <div className="segmented-control color-task-tabs">
            {tabs.map((tab, index) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  className={`segmented-item ${activeTab === tab.id ? 'segmented-item-active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  title={`${tab.label} · ${index + 1}`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
          <div className="color-task-status">
            <span className="color-mini-swatch checkerboard"><i style={{ backgroundColor: currentCssColor }} /></span>
            <code>{alpha < 1 ? hex8 : hex}</code>
            <span>{getReadableTextColor(compositeColor(rgb, alpha, white)) === '#000000' ? '推荐黑字' : '推荐白字'}</span>
          </div>
        </div>
        <div className="color-task-content">
          {activeTab === 'formats' && renderFormats()}
          {activeTab === 'palette' && renderPalette()}
          {activeTab === 'contrast' && renderContrast()}
          {activeTab === 'library' && renderLibrary()}
        </div>
      </section>

      {feedback && (
        <div className="color-feedback">
          <Check className="h-4 w-4 tone-success" />
          {feedback}
        </div>
      )}
    </div>
  )
}
