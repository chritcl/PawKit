import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import {
  ClipboardCopy,
  Download,
  Eraser,
  Pencil,
  QrCode,
  RotateCcw,
  Star,
  Trash2
} from 'lucide-react'
import {
  QrCodeErrorCorrectionLevel,
  QrCodeHistoryItem,
  QrCodeStyleSettings,
  QrCodeTemplateType
} from '../../../../../shared/types'
import {
  buildQrCodePayload,
  clearUnfavoriteQrCodeHistory,
  createQrCodeHistoryItem,
  defaultQrCodeStyle,
  normalizeQrCodeStyle,
  removeQrCodeHistoryItem,
  toggleQrCodeFavorite,
  upsertQrCodeHistory
} from '../../../utils/qrcode'
import { useAppStore } from '../../../stores/app-store'

const templateOptions: Array<{ id: QrCodeTemplateType; label: string }> = [
  { id: 'text', label: '文本' },
  { id: 'url', label: 'URL' },
  { id: 'wifi', label: 'WiFi' },
  { id: 'vcard', label: '名片' }
]

const errorCorrectionOptions: Array<{ id: QrCodeErrorCorrectionLevel; label: string }> = [
  { id: 'L', label: '低' },
  { id: 'M', label: '中' },
  { id: 'Q', label: '较高' },
  { id: 'H', label: '高' }
]

const encryptionOptions = [
  { id: 'WPA', label: 'WPA/WPA2' },
  { id: 'WEP', label: 'WEP' },
  { id: 'nopass', label: '无密码' }
]

const initialFields: Record<QrCodeTemplateType, Record<string, string>> = {
  text: { text: '' },
  url: { url: '' },
  wifi: { ssid: '', password: '', encryption: 'WPA', hidden: 'false' },
  vcard: { name: '', phone: '', email: '', org: '', url: '' }
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function shortPreview(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  return compact.length > 96 ? `${compact.slice(0, 96)}...` : compact || '空内容'
}

function getTemplateLabel(template: QrCodeTemplateType): string {
  return templateOptions.find((item) => item.id === template)?.label ?? '二维码'
}

function validateFields(template: QrCodeTemplateType, fields: Record<string, string>): string | null {
  if (template === 'text' && !fields.text?.trim()) return '请输入文本内容'
  if (template === 'url') {
    if (!fields.url?.trim()) return '请输入 URL'
    try {
      new URL(fields.url.trim())
    } catch {
      return '请输入完整 URL，例如 https://example.com'
    }
  }
  if (template === 'wifi' && !fields.ssid?.trim()) return '请输入 WiFi 名称'
  if (template === 'vcard' && !fields.name?.trim() && !fields.phone?.trim() && !fields.email?.trim()) {
    return '名片至少填写姓名、电话或邮箱'
  }
  return null
}

async function renderQrCode(payload: string, style: QrCodeStyleSettings): Promise<string> {
  return QRCode.toDataURL(payload, {
    width: style.size,
    margin: style.margin,
    errorCorrectionLevel: style.errorCorrectionLevel,
    color: {
      dark: style.darkColor,
      light: style.lightColor
    }
  })
}

// 二维码工具组件
export function QRCodeToolPage(): JSX.Element {
  const qrcodeHistoryLimit = useAppStore((state) => state.qrcodeHistoryLimit)
  const [template, setTemplate] = useState<QrCodeTemplateType>('text')
  const [fields, setFields] = useState<Record<string, string>>(initialFields.text)
  const [style, setStyle] = useState<QrCodeStyleSettings>(defaultQrCodeStyle)
  const [history, setHistory] = useState<QrCodeHistoryItem[]>([])
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [payload, setPayload] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  useEffect(() => {
    window.electronAPI?.setting?.get<QrCodeHistoryItem[]>('qrcode.history').then((data) => {
      if (Array.isArray(data)) {
        setHistory(data)
      }
    }).catch(() => {})
  }, [])

  const favoriteCount = useMemo(() => history.filter((item) => item.favorite).length, [history])

  const persistHistory = (nextHistory: QrCodeHistoryItem[]): void => {
    setHistory(nextHistory)
    window.electronAPI?.setting?.set('qrcode.history', nextHistory).catch(() => {})
  }

  const setField = (key: string, value: string): void => {
    setFields((current) => ({ ...current, [key]: value }))
  }

  const updateStyle = (patch: Partial<QrCodeStyleSettings>): void => {
    setStyle((current) => normalizeQrCodeStyle({ ...current, ...patch }))
  }

  const switchTemplate = (nextTemplate: QrCodeTemplateType): void => {
    setTemplate(nextTemplate)
    setFields(initialFields[nextTemplate])
    setPayload('')
    setQrDataUrl(null)
    setError(null)
    setMessage(null)
  }

  const handleGenerate = async (): Promise<void> => {
    const validationError = validateFields(template, fields)
    if (validationError) {
      setError(validationError)
      setMessage(null)
      setQrDataUrl(null)
      return
    }

    const nextPayload = buildQrCodePayload(template, fields)
    const nextStyle = normalizeQrCodeStyle(style)

    try {
      const nextDataUrl = await renderQrCode(nextPayload, nextStyle)
      const item = createQrCodeHistoryItem(template, fields, nextStyle)
      const nextHistory = upsertQrCodeHistory(history, item, qrcodeHistoryLimit)
      setPayload(nextPayload)
      setStyle(nextStyle)
      setQrDataUrl(nextDataUrl)
      persistHistory(nextHistory)
      setMessage('二维码已生成')
      setError(null)
    } catch {
      setQrDataUrl(null)
      setMessage(null)
      setError('生成二维码失败')
    }
  }

  const handleCopy = async (): Promise<void> => {
    if (!qrDataUrl) return
    try {
      const success = await window.electronAPI?.screenshot?.copyImageToClipboard(qrDataUrl)
      setMessage(success ? '二维码图片已复制到剪贴板' : null)
      setError(success ? null : '复制二维码图片失败')
    } catch {
      setMessage(null)
      setError('复制二维码图片失败')
    }
  }

  const handleSave = async (): Promise<void> => {
    if (!qrDataUrl) return
    try {
      const result = await window.electronAPI?.screenshot?.saveImage(qrDataUrl)
      if (result?.success) {
        setMessage(`二维码图片已保存到：${result.path}`)
        setError(null)
      } else {
        setMessage(result?.message ?? '保存已取消')
      }
    } catch {
      setMessage(null)
      setError('保存二维码图片失败')
    }
  }

  const handleEditHistory = async (item: QrCodeHistoryItem): Promise<void> => {
    const nextStyle = normalizeQrCodeStyle(item.style)
    setTemplate(item.template)
    setFields({ ...initialFields[item.template], ...item.fields })
    setStyle(nextStyle)
    setPayload(item.payload)
    setMessage('已载入历史记录')
    setError(null)

    try {
      setQrDataUrl(await renderQrCode(item.payload, nextStyle))
    } catch {
      setQrDataUrl(null)
      setError('历史记录预览生成失败')
    }
  }

  const handleToggleFavorite = (id: string): void => {
    persistHistory(toggleQrCodeFavorite(history, id))
  }

  const handleRemove = (id: string): void => {
    persistHistory(removeQrCodeHistoryItem(history, id))
  }

  const handleClearUnfavorite = (): void => {
    persistHistory(clearUnfavoriteQrCodeHistory(history))
    setShowClearConfirm(false)
  }

  const handleReset = (): void => {
    setFields(initialFields[template])
    setStyle(defaultQrCodeStyle)
    setPayload('')
    setQrDataUrl(null)
    setError(null)
    setMessage(null)
  }

  return (
    <div className="flex h-full min-h-[620px] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex flex-wrap rounded-lg border border-white/10 bg-white/5 p-1">
          {templateOptions.map((option) => (
            <button
              key={option.id}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                template === option.id ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => switchTemplate(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {message && <span className="text-sm text-gray-400">{message}</span>}
          {error && <span className="text-sm text-red-400">{error}</span>}
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
            onClick={handleReset}
          >
            <RotateCcw className="h-4 w-4" />
            重置
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-sky-500/20 px-4 py-2 text-sm text-sky-200 hover:bg-sky-500/30"
            onClick={handleGenerate}
          >
            <QrCode className="h-4 w-4" />
            生成
          </button>
        </div>
      </div>

      <div className="grid flex-1 gap-4 overflow-hidden pt-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="min-h-0 space-y-4 overflow-auto pr-1">
          <section className="rounded-lg border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <h3 className="font-medium">{getTemplateLabel(template)}内容</h3>
            <div className="mt-4">{renderTemplateFields(template, fields, setField)}</div>
          </section>

          <section className="rounded-lg border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <h3 className="font-medium">样式参数</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="text-sm text-gray-400">
                尺寸
                <input
                  type="number"
                  min={128}
                  max={1024}
                  step={16}
                  value={style.size}
                  onChange={(event) => updateStyle({ size: Number(event.target.value) })}
                  className="mt-2 w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none"
                />
              </label>
              <label className="text-sm text-gray-400">
                边距
                <input
                  type="number"
                  min={0}
                  max={8}
                  value={style.margin}
                  onChange={(event) => updateStyle({ margin: Number(event.target.value) })}
                  className="mt-2 w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none"
                />
              </label>
              <label className="text-sm text-gray-400">
                前景色
                <div className="mt-2 flex gap-2">
                  <input
                    type="color"
                    value={style.darkColor}
                    onChange={(event) => updateStyle({ darkColor: event.target.value })}
                    className="h-10 w-12 rounded border border-white/10 bg-white/5"
                  />
                  <input
                    type="text"
                    value={style.darkColor}
                    onChange={(event) => updateStyle({ darkColor: event.target.value })}
                    className="min-w-0 flex-1 rounded border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white focus:border-white/20 focus:outline-none"
                  />
                </div>
              </label>
              <label className="text-sm text-gray-400">
                背景色
                <div className="mt-2 flex gap-2">
                  <input
                    type="color"
                    value={style.lightColor}
                    onChange={(event) => updateStyle({ lightColor: event.target.value })}
                    className="h-10 w-12 rounded border border-white/10 bg-white/5"
                  />
                  <input
                    type="text"
                    value={style.lightColor}
                    onChange={(event) => updateStyle({ lightColor: event.target.value })}
                    className="min-w-0 flex-1 rounded border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white focus:border-white/20 focus:outline-none"
                  />
                </div>
              </label>
            </div>

            <div className="mt-4">
              <div className="text-sm text-gray-400">纠错级别</div>
              <div className="mt-2 flex flex-wrap rounded-lg border border-white/10 bg-black/20 p-1">
                {errorCorrectionOptions.map((option) => (
                  <button
                    key={option.id}
                    className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
                      style.errorCorrectionLevel === option.id
                        ? 'bg-white/15 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    onClick={() => updateStyle({ errorCorrectionLevel: option.id })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="grid min-h-0 gap-4 overflow-hidden lg:grid-cols-[0.9fr_1.1fr]">
          <section className="flex min-h-0 flex-col rounded-lg border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-medium">预览</h3>
              <div className="flex gap-2">
                <button
                  className="rounded p-2 text-gray-500 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
                  onClick={handleCopy}
                  disabled={!qrDataUrl}
                  title="复制图片"
                >
                  <ClipboardCopy className="h-4 w-4" />
                </button>
                <button
                  className="rounded p-2 text-gray-500 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
                  onClick={handleSave}
                  disabled={!qrDataUrl}
                  title="保存 PNG"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-1 items-center justify-center rounded-lg border border-dashed border-white/10 bg-black/20 p-4">
              {qrDataUrl ? (
                <div className="rounded bg-white p-3">
                  <img src={qrDataUrl} alt="二维码预览" className="h-64 w-64 object-contain" />
                </div>
              ) : (
                <div className="text-center text-sm text-gray-500">
                  <QrCode className="mx-auto mb-3 h-8 w-8" />
                  生成后在这里预览
                </div>
              )}
            </div>
            <div className="mt-4 rounded border border-white/10 bg-black/20 p-3">
              <div className="text-xs text-gray-500">Payload</div>
              <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-gray-300">
                {payload || buildQrCodePayload(template, fields) || '等待输入'}
              </pre>
            </div>
          </section>

          <section className="flex min-h-0 flex-col rounded-lg border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-medium">最近记录</h3>
                <div className="mt-1 text-xs text-gray-500">
                  {history.length} 条 · {favoriteCount} 收藏 · 上限 {qrcodeHistoryLimit}
                </div>
              </div>
              <button
                className="rounded p-2 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                onClick={() => setShowClearConfirm(true)}
                disabled={history.every((item) => item.favorite)}
                title="清空非收藏"
              >
                <Eraser className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-auto pr-1">
              {history.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-gray-500">
                  暂无二维码记录
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-white/10 bg-black/20 p-3 transition-colors hover:bg-white/10"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded border border-white/10 bg-white/10 px-2 py-0.5 text-xs text-gray-300">
                              {getTemplateLabel(item.template)}
                            </span>
                            <span className="text-xs text-gray-500">{formatTime(item.updatedAt)}</span>
                          </div>
                          <div className="mt-2 truncate text-sm font-medium">{item.title}</div>
                          <div className="mt-1 line-clamp-2 break-all text-xs text-gray-500">
                            {shortPreview(item.payload)}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            className="rounded p-1.5 text-gray-500 hover:bg-white/10 hover:text-white"
                            onClick={() => handleEditHistory(item)}
                            title="重新编辑"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            className={`rounded p-1.5 hover:bg-yellow-500/10 hover:text-yellow-400 ${
                              item.favorite ? 'text-yellow-400' : 'text-gray-500'
                            }`}
                            onClick={() => handleToggleFavorite(item.id)}
                            title={item.favorite ? '取消收藏' : '收藏'}
                          >
                            <Star className={`h-4 w-4 ${item.favorite ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            className="rounded p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
                            onClick={() => handleRemove(item.id)}
                            title="删除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-96 rounded-lg border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
            <h3 className="text-lg font-semibold">确认清空</h3>
            <p className="mt-2 text-sm text-gray-400">此操作会删除所有非收藏二维码记录，收藏记录会保留。</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
                onClick={() => setShowClearConfirm(false)}
              >
                取消
              </button>
              <button
                className="rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-400 hover:bg-red-500/30"
                onClick={handleClearUnfavorite}
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function renderTemplateFields(
  template: QrCodeTemplateType,
  fields: Record<string, string>,
  setField: (key: string, value: string) => void
): JSX.Element {
  if (template === 'url') {
    return (
      <label className="block text-sm text-gray-400">
        URL
        <input
          value={fields.url ?? ''}
          onChange={(event) => setField('url', event.target.value)}
          placeholder="https://example.com"
          className="mt-2 w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-white/20 focus:outline-none"
        />
      </label>
    )
  }

  if (template === 'wifi') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm text-gray-400">
          WiFi 名称
          <input
            value={fields.ssid ?? ''}
            onChange={(event) => setField('ssid', event.target.value)}
            className="mt-2 w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none"
          />
        </label>
        <label className="text-sm text-gray-400">
          密码
          <input
            type="password"
            value={fields.password ?? ''}
            onChange={(event) => setField('password', event.target.value)}
            className="mt-2 w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none"
          />
        </label>
        <label className="text-sm text-gray-400">
          加密方式
          <select
            value={fields.encryption ?? 'WPA'}
            onChange={(event) => setField('encryption', event.target.value)}
            className="mt-2 w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none"
          >
            {encryptionOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pt-7 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={fields.hidden === 'true'}
            onChange={(event) => setField('hidden', event.target.checked ? 'true' : 'false')}
            className="h-4 w-4 accent-sky-500"
          />
          隐藏网络
        </label>
      </div>
    )
  }

  if (template === 'vcard') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm text-gray-400">
          姓名
          <input
            value={fields.name ?? ''}
            onChange={(event) => setField('name', event.target.value)}
            className="mt-2 w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none"
          />
        </label>
        <label className="text-sm text-gray-400">
          电话
          <input
            value={fields.phone ?? ''}
            onChange={(event) => setField('phone', event.target.value)}
            className="mt-2 w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none"
          />
        </label>
        <label className="text-sm text-gray-400">
          邮箱
          <input
            value={fields.email ?? ''}
            onChange={(event) => setField('email', event.target.value)}
            className="mt-2 w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none"
          />
        </label>
        <label className="text-sm text-gray-400">
          组织
          <input
            value={fields.org ?? ''}
            onChange={(event) => setField('org', event.target.value)}
            className="mt-2 w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none"
          />
        </label>
        <label className="text-sm text-gray-400 md:col-span-2">
          主页
          <input
            value={fields.url ?? ''}
            onChange={(event) => setField('url', event.target.value)}
            placeholder="https://example.com"
            className="mt-2 w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-white/20 focus:outline-none"
          />
        </label>
      </div>
    )
  }

  return (
    <label className="block text-sm text-gray-400">
      文本
      <textarea
        value={fields.text ?? ''}
        onChange={(event) => setField('text', event.target.value)}
        placeholder="输入要写入二维码的文本"
        className="mt-2 h-36 w-full resize-none rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-white/20 focus:outline-none"
      />
    </label>
  )
}
