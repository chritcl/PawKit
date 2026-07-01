import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Binary,
  Check,
  Clipboard,
  Copy,
  Download,
  FileImage,
  FolderOpen,
  Image as ImageIcon,
  Info,
  Layers,
  Palette,
  RotateCw,
  Save,
  Scissors,
  Settings2,
  Star,
  Trash2,
  Type,
  Upload
} from 'lucide-react'
import type {
  ColorRecord,
  ImagePaletteColor,
  ImageToolBatchProgress,
  ImageToolFormat,
  ImageToolProcessOptions,
  ImageToolResizeMode,
  ImageToolSourceRef,
  ImageToolWatermarkPosition
} from '../../../../../shared/types'
import { useImageToolStore } from '../../../stores/image-tool-store'

type ImageToolTab = 'basic' | 'format' | 'icon' | 'info' | 'color' | 'encoding' | 'batch'

const tabs: Array<{ id: ImageToolTab; label: string; icon: LucideIcon }> = [
  { id: 'basic', label: '基础处理', icon: Settings2 },
  { id: 'format', label: '格式压缩', icon: FileImage },
  { id: 'icon', label: '图标', icon: Layers },
  { id: 'info', label: '信息', icon: Info },
  { id: 'color', label: '色彩', icon: Palette },
  { id: 'encoding', label: '编码', icon: Binary },
  { id: 'batch', label: '批量', icon: FolderOpen }
]

const imageFormats: ImageToolFormat[] = ['png', 'jpeg', 'webp', 'avif', 'ico']
const iconSizeOptions = [16, 24, 32, 48, 64, 128, 256, 512]
const resizeModes: Array<{ id: ImageToolResizeMode; label: string }> = [
  { id: 'inside', label: '等比缩小' },
  { id: 'cover', label: '覆盖裁切' },
  { id: 'contain', label: '留白适配' },
  { id: 'fill', label: '拉伸填充' }
]
const watermarkPositions: Array<{ id: ImageToolWatermarkPosition; label: string }> = [
  { id: 'bottom-right', label: '右下' },
  { id: 'bottom-left', label: '左下' },
  { id: 'top-right', label: '右上' },
  { id: 'top-left', label: '左上' },
  { id: 'center', label: '居中' }
]

const defaultOptions: ImageToolProcessOptions = {
  format: 'png',
  quality: 82,
  metadataStrategy: 'strip',
  crop: { enabled: false, left: 0, top: 0, width: 300, height: 300 },
  resize: { enabled: false, width: 1024, height: undefined, mode: 'inside', withoutEnlargement: true },
  rotate: 0,
  flip: false,
  flop: false,
  background: { enabled: false, color: '#ffffff' },
  roundedCorners: { enabled: false, radius: 24 },
  watermark: { enabled: false, text: 'PawKit', position: 'bottom-right', opacity: 0.65, fontSize: 28, color: '#ffffff' },
  icon: { sizes: iconSizeOptions, exportPngSet: true }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function colorKey(color: Pick<ColorRecord, 'hex' | 'alpha'>): string {
  return `${color.hex.toLowerCase()}-${color.alpha ?? 1}`
}

function toColorRecord(color: ImagePaletteColor, source: ColorRecord['source']): ColorRecord {
  return {
    hex: color.hex,
    rgb: color.rgb,
    hsl: color.hsl,
    alpha: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source,
    tags: ['图片处理']
  }
}

function SourceCard({
  source,
  selected,
  onSelect,
  onRemove
}: {
  source: ImageToolSourceRef
  selected: boolean
  onSelect: () => void
  onRemove: () => void
}): JSX.Element {
  return (
    <div
      className={`interactive-row flex w-full gap-3 p-3 text-left ${selected ? 'selected-surface' : ''}`}
      onClick={onSelect}
      title={source.name}
      role="button"
      tabIndex={0}
    >
      <img src={source.previewDataUrl} alt={source.name} className="h-14 w-16 shrink-0 rounded object-cover" draggable={false} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{source.name}</span>
        <span className="mt-1 block text-xs text-[color:var(--text-muted)]">
          {source.width} x {source.height} · {formatBytes(source.size)}
        </span>
        <span className="mt-1 block text-xs text-[color:var(--text-muted)]">{source.kind}</span>
      </span>
      <button
        className="icon-button h-8 min-h-8 w-8 min-w-8"
        title="移除"
        onClick={(event) => {
          event.stopPropagation()
          onRemove()
        }}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange
}: {
  label: string
  value: number | undefined
  min?: number
  max?: number
  onChange: (value: number | undefined) => void
}): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-[color:var(--text-muted)]">{label}</span>
      <input
        className="field-input font-mono"
        type="number"
        min={min}
        max={max}
        value={value ?? ''}
        onChange={(event) => {
          const next = event.target.value.trim()
          onChange(next ? Number(next) : undefined)
        }}
      />
    </label>
  )
}

function ToggleRow({
  checked,
  label,
  children,
  onChange
}: {
  checked: boolean
  label: string
  children?: ReactNode
  onChange: (checked: boolean) => void
}): JSX.Element {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-[var(--glass-border)] bg-[var(--soft-surface)] px-3 py-2 text-sm">
      <span className="min-w-0">
        <span className="block font-medium text-[color:var(--text-primary)]">{label}</span>
        {children && <span className="mt-1 block text-xs text-[color:var(--text-muted)]">{children}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  )
}

function PaletteGrid({
  colors,
  onCopy,
  onSave
}: {
  colors: ImagePaletteColor[]
  onCopy: (color: ImagePaletteColor) => void
  onSave: (color: ImagePaletteColor, target: 'recent' | 'favorite') => void
}): JSX.Element {
  if (colors.length === 0) {
    return <div className="empty-state">没有可用色板</div>
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {colors.map((color) => (
        <div key={color.hex} className="soft-panel flex items-center gap-3 p-3">
          <button
            className="h-10 w-10 rounded border border-[var(--glass-border)]"
            style={{ backgroundColor: color.hex }}
            title="复制颜色"
            onClick={() => onCopy(color)}
          />
          <div className="min-w-0 flex-1">
            <code className="block truncate text-xs">{color.hex}</code>
            <span className="text-xs text-[color:var(--text-muted)]">{Math.round(color.ratio * 100)}%</span>
          </div>
          <button className="icon-button h-8 min-h-8 w-8 min-w-8" title="加入最近颜色" onClick={() => onSave(color, 'recent')}>
            <Check className="h-4 w-4" />
          </button>
          <button className="icon-button h-8 min-h-8 w-8 min-w-8" title="收藏颜色" onClick={() => onSave(color, 'favorite')}>
            <Star className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

// 图片处理工具组件
export function ImageToolPage(): JSX.Element {
  const sources = useImageToolStore((state) => state.sources)
  const selectedSourceId = useImageToolStore((state) => state.selectedSourceId)
  const latestResult = useImageToolStore((state) => state.latestResult)
  const addSources = useImageToolStore((state) => state.addSources)
  const selectSource = useImageToolStore((state) => state.selectSource)
  const removeSource = useImageToolStore((state) => state.removeSource)
  const setLatestResult = useImageToolStore((state) => state.setLatestResult)

  const [activeTab, setActiveTab] = useState<ImageToolTab>('basic')
  const [options, setOptions] = useState<ImageToolProcessOptions>(defaultOptions)
  const [dataUrlInput, setDataUrlInput] = useState('')
  const [exportedDataUrl, setExportedDataUrl] = useState('')
  const [message, setMessage] = useState('等待导入图片')
  const [busy, setBusy] = useState(false)
  const [batchProgress, setBatchProgress] = useState<ImageToolBatchProgress | null>(null)

  const selectedSource = useMemo(() => (
    sources.find((source) => source.id === selectedSourceId) ?? sources[0] ?? null
  ), [selectedSourceId, sources])
  const activePalette = latestResult?.palette.length ? latestResult.palette : selectedSource?.palette ?? []
  const compressionRatio = selectedSource && latestResult
    ? Math.round((1 - latestResult.size / selectedSource.size) * 100)
    : null

  useEffect(() => {
    const remove = window.electronAPI?.imageTool?.onBatchProgress?.((progress) => {
      setBatchProgress(progress)
    })
    return () => {
      remove?.()
    }
  }, [])

  const patchOptions = (patch: Partial<ImageToolProcessOptions>): void => {
    setOptions((current) => ({ ...current, ...patch }))
  }

  const writeClipboard = async (text: string, nextMessage: string): Promise<void> => {
    await window.electronAPI.clipboard.writeText(text)
    setMessage(nextMessage)
  }

  const importFiles = async (): Promise<void> => {
    const nextSources = await window.electronAPI.imageTool.openImages()
    addSources(nextSources)
    setMessage(nextSources.length ? `已导入 ${nextSources.length} 张图片` : '没有选择图片')
  }

  const importClipboard = async (): Promise<void> => {
    const source = await window.electronAPI.imageTool.importClipboard()
    if (source) {
      addSources([source])
      setMessage('已导入当前剪贴板图片')
    } else {
      setMessage('当前剪贴板没有图片')
    }
  }

  const importDataUrl = async (): Promise<void> => {
    const source = await window.electronAPI.imageTool.importDataUrl(dataUrlInput, `data-url-${Date.now()}.png`)
    if (source) {
      addSources([source])
      setMessage('Data URL 图片已导入')
    } else {
      setMessage('Data URL 无效或不是图片')
    }
  }

  const processCurrent = async (nextOptions = options): Promise<void> => {
    const source = selectedSource
    if (!source) {
      setMessage('请先导入图片')
      return
    }
    setBusy(true)
    setExportedDataUrl('')
    try {
      const response = await window.electronAPI.imageTool.process({
        sourceId: source.id,
        options: nextOptions
      })
      if (response.success && response.result) {
        setLatestResult(response.result)
        setMessage(response.message)
      } else {
        setMessage(response.message)
      }
    } catch {
      setMessage('图片处理失败')
    } finally {
      setBusy(false)
    }
  }

  const copyResult = async (): Promise<void> => {
    if (!latestResult) return
    const result = await window.electronAPI.imageTool.copyResult(latestResult.id)
    setMessage(result.message)
  }

  const saveResult = async (): Promise<void> => {
    if (!latestResult) return
    const result = await window.electronAPI.imageTool.saveResult(latestResult.id)
    setMessage(result.message)
  }

  const exportResultDataUrl = async (): Promise<void> => {
    if (!latestResult) return
    const dataUrl = await window.electronAPI.imageTool.exportDataUrl(latestResult.id)
    if (dataUrl) {
      setExportedDataUrl(dataUrl)
      await writeClipboard(dataUrl, 'Data URL 已复制')
    } else {
      setMessage('导出 Data URL 失败')
    }
  }

  const processBatch = async (): Promise<void> => {
    if (sources.length === 0) {
      setMessage('请先导入要批量处理的图片')
      return
    }
    setBusy(true)
    setBatchProgress({ total: sources.length, completed: 0 })
    try {
      const response = await window.electronAPI.imageTool.processBatch({
        sourceIds: sources.map((source) => source.id),
        options
      })
      setMessage(response.message)
    } catch {
      setMessage('批量处理失败')
    } finally {
      setBusy(false)
    }
  }

  const copyColor = async (color: ImagePaletteColor): Promise<void> => {
    await writeClipboard(color.hex, `${color.hex} 已复制`)
  }

  const saveColor = async (color: ImagePaletteColor, target: 'recent' | 'favorite'): Promise<void> => {
    const key = target === 'favorite' ? 'color.favorites' : 'color.recent'
    const current = await window.electronAPI.setting.get<ColorRecord[]>(key)
    const record = toColorRecord(color, target === 'favorite' ? 'favorite' : 'image')
    const next = [record, ...(Array.isArray(current) ? current.filter((item) => colorKey(item) !== colorKey(record)) : [])].slice(0, target === 'favorite' ? 200 : 30)
    await window.electronAPI.setting.set(key, next)
    setMessage(target === 'favorite' ? '颜色已加入收藏' : '颜色已加入最近颜色')
  }

  const renderBasicTab = (): JSX.Element => (
    <div className="space-y-4">
      <section className="space-y-3">
        <div className="panel-header px-0"><span className="flex items-center gap-2"><Scissors className="h-4 w-4" />裁剪</span></div>
        <ToggleRow checked={options.crop?.enabled ?? false} label="启用裁剪" onChange={(enabled) => patchOptions({ crop: { ...(options.crop ?? defaultOptions.crop!), enabled } })}>
          按像素输入选区，基于导入图片尺寸
        </ToggleRow>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="左侧 X" value={options.crop?.left} min={0} onChange={(value) => patchOptions({ crop: { ...(options.crop ?? defaultOptions.crop!), left: value ?? 0 } })} />
          <NumberField label="顶部 Y" value={options.crop?.top} min={0} onChange={(value) => patchOptions({ crop: { ...(options.crop ?? defaultOptions.crop!), top: value ?? 0 } })} />
          <NumberField label="宽度" value={options.crop?.width} min={1} onChange={(value) => patchOptions({ crop: { ...(options.crop ?? defaultOptions.crop!), width: value ?? 1 } })} />
          <NumberField label="高度" value={options.crop?.height} min={1} onChange={(value) => patchOptions({ crop: { ...(options.crop ?? defaultOptions.crop!), height: value ?? 1 } })} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="panel-header px-0"><span className="flex items-center gap-2"><ImageIcon className="h-4 w-4" />尺寸</span></div>
        <ToggleRow checked={options.resize?.enabled ?? false} label="启用尺寸调整" onChange={(enabled) => patchOptions({ resize: { ...(options.resize ?? defaultOptions.resize!), enabled } })}>
          不填写某一边时按比例推导
        </ToggleRow>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="宽度" value={options.resize?.width} min={1} onChange={(value) => patchOptions({ resize: { ...(options.resize ?? defaultOptions.resize!), width: value } })} />
          <NumberField label="高度" value={options.resize?.height} min={1} onChange={(value) => patchOptions({ resize: { ...(options.resize ?? defaultOptions.resize!), height: value } })} />
        </div>
        <select className="field-select w-full" value={options.resize?.mode ?? 'inside'} onChange={(event) => patchOptions({ resize: { ...(options.resize ?? defaultOptions.resize!), mode: event.target.value as ImageToolResizeMode } })}>
          {resizeModes.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
        </select>
        <ToggleRow checked={options.resize?.withoutEnlargement ?? true} label="禁止放大小图" onChange={(enabled) => patchOptions({ resize: { ...(options.resize ?? defaultOptions.resize!), withoutEnlargement: enabled } })} />
      </section>

      <section className="space-y-3">
        <div className="panel-header px-0"><span className="flex items-center gap-2"><RotateCw className="h-4 w-4" />旋转与外观</span></div>
        <NumberField label="旋转角度" value={options.rotate ?? 0} onChange={(value) => patchOptions({ rotate: value ?? 0 })} />
        <div className="grid grid-cols-2 gap-2">
          <ToggleRow checked={options.flip ?? false} label="垂直翻转" onChange={(enabled) => patchOptions({ flip: enabled })} />
          <ToggleRow checked={options.flop ?? false} label="水平翻转" onChange={(enabled) => patchOptions({ flop: enabled })} />
        </div>
        <ToggleRow checked={options.background?.enabled ?? false} label="背景色填充透明区域" onChange={(enabled) => patchOptions({ background: { ...(options.background ?? defaultOptions.background!), enabled } })} />
        <input className="field-input h-10" type="color" value={options.background?.color ?? '#ffffff'} onChange={(event) => patchOptions({ background: { ...(options.background ?? defaultOptions.background!), color: event.target.value } })} />
        <ToggleRow checked={options.roundedCorners?.enabled ?? false} label="圆角图片" onChange={(enabled) => patchOptions({ roundedCorners: { ...(options.roundedCorners ?? defaultOptions.roundedCorners!), enabled } })} />
        <NumberField label="圆角半径" value={options.roundedCorners?.radius} min={1} onChange={(value) => patchOptions({ roundedCorners: { ...(options.roundedCorners ?? defaultOptions.roundedCorners!), radius: value ?? 1 } })} />
      </section>

      <section className="space-y-3">
        <div className="panel-header px-0"><span className="flex items-center gap-2"><Type className="h-4 w-4" />水印</span></div>
        <ToggleRow checked={options.watermark?.enabled ?? false} label="添加文字水印" onChange={(enabled) => patchOptions({ watermark: { ...(options.watermark ?? defaultOptions.watermark!), enabled } })} />
        <input className="field-input" value={options.watermark?.text ?? ''} onChange={(event) => patchOptions({ watermark: { ...(options.watermark ?? defaultOptions.watermark!), text: event.target.value } })} placeholder="水印文字" />
        <div className="grid grid-cols-2 gap-2">
          <select className="field-select" value={options.watermark?.position ?? 'bottom-right'} onChange={(event) => patchOptions({ watermark: { ...(options.watermark ?? defaultOptions.watermark!), position: event.target.value as ImageToolWatermarkPosition } })}>
            {watermarkPositions.map((position) => <option key={position.id} value={position.id}>{position.label}</option>)}
          </select>
          <input className="field-input h-10" type="color" value={options.watermark?.color ?? '#ffffff'} onChange={(event) => patchOptions({ watermark: { ...(options.watermark ?? defaultOptions.watermark!), color: event.target.value } })} />
          <NumberField label="字号" value={options.watermark?.fontSize} min={8} onChange={(value) => patchOptions({ watermark: { ...(options.watermark ?? defaultOptions.watermark!), fontSize: value ?? 28 } })} />
          <NumberField label="不透明度 0-1" value={options.watermark?.opacity} min={0} max={1} onChange={(value) => patchOptions({ watermark: { ...(options.watermark ?? defaultOptions.watermark!), opacity: value ?? 0.65 } })} />
        </div>
      </section>
    </div>
  )

  const renderFormatTab = (): JSX.Element => (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-xs text-[color:var(--text-muted)]">输出格式</span>
        <select className="field-select w-full" value={options.format} onChange={(event) => patchOptions({ format: event.target.value as ImageToolFormat })}>
          {imageFormats.map((format) => <option key={format} value={format}>{format.toUpperCase()}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 flex justify-between text-xs text-[color:var(--text-muted)]"><span>质量</span><strong>{options.quality}</strong></span>
        <input className="w-full" type="range" min={1} max={100} value={options.quality} onChange={(event) => patchOptions({ quality: Number(event.target.value) })} />
      </label>
      <ToggleRow checked={options.metadataStrategy === 'keep'} label="保留元数据" onChange={(enabled) => patchOptions({ metadataStrategy: enabled ? 'keep' : 'strip' })}>
        默认移除 EXIF 和其他元数据
      </ToggleRow>
      <button className="toolbar-button-primary w-full" disabled={busy || !selectedSource} onClick={() => void processCurrent()}>
        <Download className="h-4 w-4" />处理当前图片
      </button>
      {latestResult && (
        <div className="grid grid-cols-3 gap-2">
          <button className="toolbar-button" onClick={() => void copyResult()}><Copy className="h-4 w-4" />复制</button>
          <button className="toolbar-button" onClick={() => void saveResult()}><Save className="h-4 w-4" />保存</button>
          <button className="toolbar-button" onClick={() => void exportResultDataUrl()}><Binary className="h-4 w-4" />Data URL</button>
        </div>
      )}
    </div>
  )

  const renderIconTab = (): JSX.Element => (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {iconSizeOptions.map((size) => {
          const checked = options.icon?.sizes.includes(size) ?? true
          return (
            <label key={size} className="soft-panel flex items-center gap-2 p-2 text-xs">
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => {
                  const current = options.icon?.sizes ?? iconSizeOptions
                  const next = event.target.checked ? [...current, size] : current.filter((item) => item !== size)
                  patchOptions({ icon: { ...(options.icon ?? defaultOptions.icon!), sizes: next } })
                }}
              />
              {size}
            </label>
          )
        })}
      </div>
      <ToggleRow checked={options.icon?.exportPngSet ?? true} label="批量时导出 PNG 尺寸包" onChange={(enabled) => patchOptions({ icon: { ...(options.icon ?? defaultOptions.icon!), exportPngSet: enabled } })} />
      <button
        className="toolbar-button-primary w-full"
        disabled={busy || !selectedSource}
        onClick={() => {
          const nextOptions = { ...options, format: 'ico' as const }
          setOptions(nextOptions)
          void processCurrent(nextOptions)
        }}
      >
        <Layers className="h-4 w-4" />生成 ICO
      </button>
    </div>
  )

  const renderInfoTab = (): JSX.Element => {
    const target = latestResult ?? selectedSource
    if (!target) return <div className="empty-state">导入图片后查看元信息</div>
    const rows = [
      ['格式', target.metadata.format],
      ['MIME', target.metadata.mimeType],
      ['尺寸', `${target.width} x ${target.height}`],
      ['大小', formatBytes(target.size)],
      ['色彩空间', target.metadata.colorSpace ?? '未知'],
      ['通道', target.metadata.channels ?? '未知'],
      ['透明通道', target.metadata.hasAlpha ? '有' : '无'],
      ['方向', target.metadata.orientation ?? '无']
    ]
    return (
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="soft-panel flex justify-between gap-3 p-3 text-sm">
            <span className="text-[color:var(--text-muted)]">{label}</span>
            <strong className="break-all text-right font-mono text-xs">{value}</strong>
          </div>
        ))}
      </div>
    )
  }

  const renderColorTab = (): JSX.Element => (
    <div className="space-y-4">
      {selectedSource?.dominantColor && (
        <div className="soft-panel flex items-center gap-3 p-3">
          <span className="h-12 w-12 rounded border border-[var(--glass-border)]" style={{ backgroundColor: selectedSource.dominantColor.hex }} />
          <div>
            <div className="text-sm font-medium">图片主色</div>
            <code className="text-xs">{selectedSource.dominantColor.hex}</code>
          </div>
        </div>
      )}
      <PaletteGrid colors={activePalette} onCopy={(color) => void copyColor(color)} onSave={(color, target) => void saveColor(color, target)} />
    </div>
  )

  const renderEncodingTab = (): JSX.Element => (
    <div className="space-y-4">
      <textarea
        className="editor-textarea min-h-32"
        value={dataUrlInput}
        onChange={(event) => setDataUrlInput(event.target.value)}
        placeholder="粘贴图片 Data URL 后导入"
      />
      <button className="toolbar-button w-full" onClick={() => void importDataUrl()}><Upload className="h-4 w-4" />导入 Data URL</button>
      <button className="toolbar-button w-full" disabled={!latestResult} onClick={() => void exportResultDataUrl()}><Copy className="h-4 w-4" />复制结果 Data URL</button>
      {exportedDataUrl && (
        <textarea className="editor-textarea min-h-32" readOnly value={exportedDataUrl} />
      )}
    </div>
  )

  const renderBatchTab = (): JSX.Element => (
    <div className="space-y-4">
      <div className="soft-panel p-3 text-sm text-[color:var(--text-secondary)]">
        当前将处理 {sources.length} 张图片，输出到你选择的新目录，不会覆盖原图。
      </div>
      {batchProgress && (
        <div className="soft-panel p-3">
          <div className="mb-2 flex justify-between text-xs text-[color:var(--text-muted)]">
            <span>{batchProgress.currentName ?? '批量处理'}</span>
            <span>{batchProgress.completed} / {batchProgress.total}</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-[var(--input-surface)]">
            <div
              className="h-full bg-[rgb(var(--color-primary-rgb))]"
              style={{ width: `${batchProgress.total ? Math.round(batchProgress.completed / batchProgress.total * 100) : 0}%` }}
            />
          </div>
        </div>
      )}
      <button className="toolbar-button-primary w-full" disabled={busy || sources.length === 0} onClick={() => void processBatch()}>
        <FolderOpen className="h-4 w-4" />选择目录并批量处理
      </button>
    </div>
  )

  const renderActiveTab = (): JSX.Element => {
    if (activeTab === 'basic') return renderBasicTab()
    if (activeTab === 'format') return renderFormatTab()
    if (activeTab === 'icon') return renderIconTab()
    if (activeTab === 'info') return renderInfoTab()
    if (activeTab === 'color') return renderColorTab()
    if (activeTab === 'encoding') return renderEncodingTab()
    return renderBatchTab()
  }

  return (
    <div className="tool-page">
      <div className="toolbar-surface tool-toolbar">
        <button className="toolbar-button-primary" onClick={() => void importFiles()}><Upload className="h-4 w-4" />导入图片</button>
        <button className="toolbar-button" onClick={() => void importClipboard()}><Clipboard className="h-4 w-4" />剪贴板图片</button>
        <div className="toolbar-push text-xs text-[color:var(--text-muted)]">{message}</div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(320px,1fr)_390px] gap-4">
        <aside className="editor-surface tool-panel overflow-hidden">
          <div className="panel-header"><span>图片源</span><span className="text-xs text-[color:var(--text-muted)]">{sources.length} 张</span></div>
          <div className="panel-body h-full space-y-2 overflow-auto p-3">
            {sources.length === 0 ? (
              <div className="empty-state flex-col gap-2">
                <ImageIcon className="h-8 w-8" />
                <span>导入文件、剪贴板图片或 Data URL</span>
              </div>
            ) : sources.map((source) => (
              <SourceCard
                key={source.id}
                source={source}
                selected={source.id === selectedSource?.id}
                onSelect={() => selectSource(source.id)}
                onRemove={() => removeSource(source.id)}
              />
            ))}
          </div>
        </aside>

        <section className="editor-surface tool-panel min-w-0 overflow-hidden">
          <div className="panel-header">
            <span>{latestResult ? '处理结果' : '图片预览'}</span>
            {compressionRatio !== null && <span className="text-xs text-[color:var(--text-muted)]">{compressionRatio >= 0 ? `压缩 ${compressionRatio}%` : `增大 ${Math.abs(compressionRatio)}%`}</span>}
          </div>
          <div className="panel-body flex min-h-0 flex-1 flex-col gap-3 p-4">
            {selectedSource ? (
              <>
                <div className="min-h-0 flex-1 rounded-lg border border-[var(--glass-border)] bg-[var(--soft-surface)] p-3">
                  <img
                    src={latestResult?.previewDataUrl ?? selectedSource.previewDataUrl}
                    alt={latestResult?.name ?? selectedSource.name}
                    className="h-full w-full object-contain"
                    draggable={false}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="soft-panel p-3">
                    <span className="text-xs text-[color:var(--text-muted)]">原图</span>
                    <strong className="mt-1 block">{selectedSource.width} x {selectedSource.height}</strong>
                    <span className="text-xs text-[color:var(--text-muted)]">{formatBytes(selectedSource.size)}</span>
                  </div>
                  <div className="soft-panel p-3">
                    <span className="text-xs text-[color:var(--text-muted)]">结果</span>
                    <strong className="mt-1 block">{latestResult ? `${latestResult.width} x ${latestResult.height}` : '尚未处理'}</strong>
                    <span className="text-xs text-[color:var(--text-muted)]">{latestResult ? formatBytes(latestResult.size) : options.format.toUpperCase()}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state flex-1 flex-col gap-2">
                <FileImage className="h-10 w-10" />
                <span>图片处理工作台为空</span>
              </div>
            )}
          </div>
        </section>

        <aside className="editor-surface tool-panel min-w-0 overflow-hidden">
          <div className="panel-header"><span>处理参数</span>{busy && <span className="text-xs text-[color:var(--text-muted)]">处理中...</span>}</div>
          <div className="panel-body flex min-h-0 flex-col">
            <div className="segmented-control segmented-scroll m-3 mb-0">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    className={`segmented-item ${activeTab === tab.id ? 'segmented-item-active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                    title={tab.label}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                )
              })}
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-3">
              {renderActiveTab()}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
