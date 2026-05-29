import { useEffect, useRef, useState } from 'react'
import { ClipboardCopy, FileJson, Palette, Pipette, Star } from 'lucide-react'
import {
  generateColorHarmony,
  generateColorScale,
  generateCssVar,
  generateJsonToken,
  generateTailwindSnippet,
  getContrastLevel,
  getContrastRatio,
  getReadableTextColor,
  hexToRgb,
  hslToRgb,
  isValidHex,
  isValidHsl,
  isValidRgb,
  rgbToHex,
  rgbToHsl
} from '../../../utils/color'
import { ColorRecord, HSL, RGB } from '../../../../../shared/types'

const black: RGB = { r: 0, g: 0, b: 0 }
const white: RGB = { r: 255, g: 255, b: 255 }

function formatRgb(rgb: RGB): string {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
}

function formatHsl(hsl: HSL): string {
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`
}

// 调色板工具组件
export function ColorPickerPage(): JSX.Element {
  const [hex, setHex] = useState('#1677ff')
  const [rgb, setRgb] = useState<RGB>({ r: 22, g: 119, b: 255 })
  const [hsl, setHsl] = useState<HSL>({ h: 210, s: 100, l: 54 })

  const [hexInput, setHexInput] = useState('#1677ff')
  const [rgbR, setRgbR] = useState('22')
  const [rgbG, setRgbG] = useState('119')
  const [rgbB, setRgbB] = useState('255')
  const [hslH, setHslH] = useState('210')
  const [hslS, setHslS] = useState('100')
  const [hslL, setHslL] = useState('54')

  const [hexError, setHexError] = useState<string | null>(null)
  const [rgbError, setRgbError] = useState<string | null>(null)
  const [hslError, setHslError] = useState<string | null>(null)
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null)
  const [pickerMessage, setPickerMessage] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)

  const [favorites, setFavorites] = useState<ColorRecord[]>([])
  const [recent, setRecent] = useState<ColorRecord[]>([])
  const recentRef = useRef<ColorRecord[]>([])

  useEffect(() => {
    if (window.electronAPI?.setting) {
      window.electronAPI.setting.get<ColorRecord[]>('color.favorites').then((data) => {
        if (data) setFavorites(data)
      })
      window.electronAPI.setting.get<ColorRecord[]>('color.recent').then((data) => {
        if (data) {
          setRecent(data)
          recentRef.current = data
        }
      })
    }
  }, [])

  // 添加到最近颜色
  const addToRecent = (record: ColorRecord): void => {
    const newRecent = [record, ...recentRef.current.filter((item) => item.hex !== record.hex)].slice(0, 20)
    recentRef.current = newRecent
    setRecent(newRecent)
    window.electronAPI?.setting?.set('color.recent', newRecent)
  }

  // 同步所有颜色状态
  const applyColor = (nextHex: string, source: ColorRecord['source'] = 'manual', shouldRemember = true): void => {
    const nextRgb = hexToRgb(nextHex)
    if (!nextRgb) return

    const normalizedHex = rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b)
    const nextHsl = rgbToHsl(nextRgb.r, nextRgb.g, nextRgb.b)

    setHex(normalizedHex)
    setRgb(nextRgb)
    setHsl(nextHsl)
    setHexInput(normalizedHex)
    setRgbR(String(nextRgb.r))
    setRgbG(String(nextRgb.g))
    setRgbB(String(nextRgb.b))
    setHslH(String(nextHsl.h))
    setHslS(String(nextHsl.s))
    setHslL(String(nextHsl.l))
    setHexError(null)
    setRgbError(null)
    setHslError(null)

    if (shouldRemember) {
      addToRecent({
        hex: normalizedHex,
        rgb: nextRgb,
        hsl: nextHsl,
        createdAt: new Date().toISOString(),
        source
      })
    }
  }

  // 更新颜色（从 HEX）
  const updateFromHex = (value: string): void => {
    setHexInput(value)
    if (!isValidHex(value)) {
      setHexError('请输入有效的 HEX 颜色值（如 #1677ff）')
      return
    }

    const cleanHex = value.startsWith('#') ? value : `#${value}`
    applyColor(cleanHex, 'manual')
  }

  // 更新颜色（从 RGB）
  const updateFromRgb = (r: string, g: string, b: string): void => {
    setRgbR(r)
    setRgbG(g)
    setRgbB(b)
    const rn = Number.parseInt(r, 10)
    const gn = Number.parseInt(g, 10)
    const bn = Number.parseInt(b, 10)

    if (!isValidRgb(rn, gn, bn)) {
      setRgbError('RGB 值必须是 0-255 的整数')
      return
    }

    applyColor(rgbToHex(rn, gn, bn), 'manual')
  }

  // 更新颜色（从 HSL）
  const updateFromHsl = (h: string, s: string, l: string): void => {
    setHslH(h)
    setHslS(s)
    setHslL(l)
    const hn = Number.parseInt(h, 10)
    const sn = Number.parseInt(s, 10)
    const ln = Number.parseInt(l, 10)

    if (!isValidHsl(hn, sn, ln)) {
      setHslError('H 值 0-360，S/L 值 0-100')
      return
    }

    const nextRgb = hslToRgb(hn, sn, ln)
    applyColor(rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b), 'manual')
  }

  // 复制颜色值
  const handleCopy = async (label: string, text: string): Promise<void> => {
    await window.electronAPI?.clipboard?.writeText(text)
    setCopiedLabel(label)
    window.setTimeout(() => setCopiedLabel(null), 1500)
  }

  // 收藏颜色
  const handleFavorite = (): void => {
    const record: ColorRecord = {
      hex,
      rgb,
      hsl,
      createdAt: new Date().toISOString(),
      source: 'favorite'
    }
    const exists = favorites.some((item) => item.hex === hex)
    const newFavorites = exists
      ? favorites.filter((item) => item.hex !== hex)
      : [record, ...favorites]

    setFavorites(newFavorites)
    window.electronAPI?.setting?.set('color.favorites', newFavorites)
  }

  // 从收藏或最近选择颜色
  const selectColor = (record: ColorRecord): void => {
    applyColor(record.hex, record.source ?? 'recent', false)
  }

  // 启动全屏滴管取色
  const handlePickScreenColor = async (): Promise<void> => {
    if (!window.electronAPI?.screenshot?.pickScreenColor) {
      setPickerMessage('请重启应用以加载新 preload')
      return
    }

    setCapturing(true)
    setPickerMessage(null)
    try {
      const response = await window.electronAPI.screenshot.pickScreenColor()
      if (response.status === 'picked' && response.result) {
        applyColor(response.result.hex, 'screen')
        setPickerMessage(response.message)
      } else {
        setPickerMessage(response.message)
      }
    } catch {
      setPickerMessage('取色失败')
    } finally {
      setCapturing(false)
    }
  }

  const cssVar = generateCssVar(hex, rgb, hsl)
  const tailwindSnippet = generateTailwindSnippet(hex)
  const jsonToken = generateJsonToken(hex, rgb, hsl)
  const scale = generateColorScale(hex)
  const harmony = generateColorHarmony(hex)
  const blackRatio = getContrastRatio(black, rgb)
  const whiteRatio = getContrastRatio(white, rgb)
  const readableText = getReadableTextColor(rgb)
  const readableRatio = readableText === '#000000' ? blackRatio : whiteRatio
  const isFavorite = favorites.some((item) => item.hex === hex)

  const outputFormats = [
    { label: 'HEX', value: hex },
    { label: 'RGB', value: formatRgb(rgb) },
    { label: 'HSL', value: formatHsl(hsl) },
    { label: 'CSS 变量', value: cssVar },
    { label: 'Tailwind', value: tailwindSnippet },
    { label: 'JSON token', value: jsonToken }
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-4">
            <div
              className="h-24 w-24 rounded-lg border border-white/10"
              style={{ backgroundColor: hex }}
            />
            <div className="min-w-0 flex-1">
              <div className="font-mono text-2xl font-semibold">{hex}</div>
              <div className="mt-1 text-sm text-gray-400">
                {formatRgb(rgb)} · {formatHsl(hsl)}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                    isFavorite ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/10 hover:bg-white/20'
                  }`}
                  onClick={handleFavorite}
                >
                  <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
                  {isFavorite ? '取消收藏' : '收藏'}
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
                  onClick={() => handleCopy('HEX', hex)}
                >
                  <ClipboardCopy className="h-4 w-4" />
                  {copiedLabel === 'HEX' ? '已复制' : '复制 HEX'}
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
                  onClick={handlePickScreenColor}
                  disabled={capturing}
                >
                  <Pipette className="h-4 w-4" />
                  {capturing ? '取色中...' : '屏幕取色'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          className="rounded-lg border border-white/10 p-6"
          style={{ backgroundColor: hex, color: readableText }}
        >
          <div className="text-sm opacity-80">对比度预览</div>
          <div className="mt-4 text-3xl font-semibold">Aa 颜色可读性</div>
          <div className="mt-3 text-sm opacity-80">
            推荐文字 {readableText} · {readableRatio}:1 · {getContrastLevel(readableRatio)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
          <label className="text-sm text-gray-400">HEX</label>
          <input
            type="text"
            value={hexInput}
            onChange={(event) => updateFromHex(event.target.value)}
            className="mt-2 w-full rounded border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm focus:border-white/20 focus:outline-none"
          />
          {hexError && <div className="mt-1 text-xs text-red-400">{hexError}</div>}
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
          <label className="text-sm text-gray-400">RGB</label>
          <div className="mt-2 flex gap-2">
            <input
              type="number"
              value={rgbR}
              onChange={(event) => updateFromRgb(event.target.value, rgbG, rgbB)}
              className="w-full rounded border border-white/10 bg-white/5 px-2 py-2 font-mono text-sm focus:border-white/20 focus:outline-none"
              placeholder="R"
            />
            <input
              type="number"
              value={rgbG}
              onChange={(event) => updateFromRgb(rgbR, event.target.value, rgbB)}
              className="w-full rounded border border-white/10 bg-white/5 px-2 py-2 font-mono text-sm focus:border-white/20 focus:outline-none"
              placeholder="G"
            />
            <input
              type="number"
              value={rgbB}
              onChange={(event) => updateFromRgb(rgbR, rgbG, event.target.value)}
              className="w-full rounded border border-white/10 bg-white/5 px-2 py-2 font-mono text-sm focus:border-white/20 focus:outline-none"
              placeholder="B"
            />
          </div>
          {rgbError && <div className="mt-1 text-xs text-red-400">{rgbError}</div>}
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
          <label className="text-sm text-gray-400">HSL</label>
          <div className="mt-2 flex gap-2">
            <input
              type="number"
              value={hslH}
              onChange={(event) => updateFromHsl(event.target.value, hslS, hslL)}
              className="w-full rounded border border-white/10 bg-white/5 px-2 py-2 font-mono text-sm focus:border-white/20 focus:outline-none"
              placeholder="H"
            />
            <input
              type="number"
              value={hslS}
              onChange={(event) => updateFromHsl(hslH, event.target.value, hslL)}
              className="w-full rounded border border-white/10 bg-white/5 px-2 py-2 font-mono text-sm focus:border-white/20 focus:outline-none"
              placeholder="S"
            />
            <input
              type="number"
              value={hslL}
              onChange={(event) => updateFromHsl(hslH, hslS, event.target.value)}
              className="w-full rounded border border-white/10 bg-white/5 px-2 py-2 font-mono text-sm focus:border-white/20 focus:outline-none"
              placeholder="L"
            />
          </div>
          {hslError && <div className="mt-1 text-xs text-red-400">{hslError}</div>}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-medium">屏幕取色</h3>
            {pickerMessage && <span className="text-sm text-gray-400">{pickerMessage}</span>}
          </div>
          <button
            className="mt-4 flex h-40 w-full items-center justify-center rounded-lg border border-dashed border-white/15 bg-white/5 text-gray-300 transition-colors hover:bg-white/10 disabled:cursor-wait disabled:opacity-70"
            onClick={handlePickScreenColor}
            disabled={capturing}
          >
            <div className="flex flex-col items-center gap-3">
              <Pipette className="h-7 w-7" />
              <span className="text-sm">{capturing ? '取色中...' : '启动全屏滴管'}</span>
            </div>
          </button>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <h3 className="font-medium">开发格式</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {outputFormats.map((item) => (
              <div key={item.label} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-400">{item.label}</span>
                  <button
                    className="rounded p-1.5 text-gray-500 hover:bg-white/10 hover:text-white"
                    onClick={() => handleCopy(item.label, item.value)}
                    title="复制"
                  >
                    {item.label === 'JSON token' ? (
                      <FileJson className="h-4 w-4" />
                    ) : (
                      <ClipboardCopy className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-gray-300">
                  {item.value}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-gray-400" />
            <h3 className="font-medium">色阶</h3>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-2 md:grid-cols-10">
            {scale.map((item) => (
              <button
                key={item.label}
                className="overflow-hidden rounded border border-white/10 text-left transition-transform hover:scale-105"
                onClick={() => applyColor(item.hex, 'manual')}
                title={item.hex}
              >
                <div className="h-12" style={{ backgroundColor: item.hex }} />
                <div className="bg-black/20 px-2 py-1">
                  <div className="text-xs text-gray-300">{item.label}</div>
                  <div className="truncate font-mono text-[11px] text-gray-500">{item.hex}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <h3 className="font-medium">配色建议</h3>
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
            {harmony.map((item) => (
              <button
                key={item.label}
                className="overflow-hidden rounded-lg border border-white/10 text-left transition-transform hover:scale-105"
                onClick={() => applyColor(item.hex, 'manual')}
                title={item.hex}
              >
                <div className="h-14" style={{ backgroundColor: item.hex }} />
                <div className="bg-black/20 px-3 py-2">
                  <div className="text-sm text-gray-300">{item.label}</div>
                  <div className="font-mono text-xs text-gray-500">{item.hex}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <h3 className="font-medium">对比度</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div
            className="rounded-lg border border-white/10 p-4 text-black"
            style={{ backgroundColor: hex }}
          >
            <div className="text-sm opacity-60">黑色文字</div>
            <div className="mt-2 text-2xl font-semibold">Aa {blackRatio}:1</div>
            <div className="mt-1 text-sm opacity-60">{getContrastLevel(blackRatio)}</div>
          </div>
          <div
            className="rounded-lg border border-white/10 p-4 text-white"
            style={{ backgroundColor: hex }}
          >
            <div className="text-sm opacity-70">白色文字</div>
            <div className="mt-2 text-2xl font-semibold">Aa {whiteRatio}:1</div>
            <div className="mt-1 text-sm opacity-70">{getContrastLevel(whiteRatio)}</div>
          </div>
        </div>
      </div>

      {(favorites.length > 0 || recent.length > 0) && (
        <div className="grid gap-4 xl:grid-cols-2">
          {favorites.length > 0 && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <h3 className="font-medium">收藏颜色</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {favorites.map((record) => (
                  <button
                    key={record.hex}
                    className="h-9 w-9 rounded border border-white/10 transition-transform hover:scale-110"
                    style={{ backgroundColor: record.hex }}
                    onClick={() => selectColor(record)}
                    title={record.hex}
                  />
                ))}
              </div>
            </div>
          )}

          {recent.length > 0 && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <h3 className="font-medium">最近颜色</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {recent.map((record) => (
                  <button
                    key={`${record.hex}-${record.createdAt}`}
                    className="h-9 w-9 rounded border border-white/10 transition-transform hover:scale-110"
                    style={{ backgroundColor: record.hex }}
                    onClick={() => selectColor(record)}
                    title={record.hex}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
