import { useState, useEffect, useRef } from 'react'
import { hexToRgb, rgbToHex, rgbToHsl, hslToRgb, isValidHex, isValidRgb, isValidHsl, generateCssVar } from '../../../utils/color'
import { RGB, HSL, ColorRecord } from '../../../../../shared/types'

// 调色板工具组件
export function ColorPickerPage(): JSX.Element {
  // 当前颜色
  const [hex, setHex] = useState('#1677ff')
  const [rgb, setRgb] = useState<RGB>({ r: 22, g: 119, b: 255 })
  const [hsl, setHsl] = useState<HSL>({ h: 210, s: 100, l: 54 })

  // 输入状态
  const [hexInput, setHexInput] = useState('#1677ff')
  const [rgbR, setRgbR] = useState('22')
  const [rgbG, setRgbG] = useState('119')
  const [rgbB, setRgbB] = useState('255')
  const [hslH, setHslH] = useState('210')
  const [hslS, setHslS] = useState('100')
  const [hslL, setHslL] = useState('54')

  // 错误状态
  const [hexError, setHexError] = useState<string | null>(null)
  const [rgbError, setRgbError] = useState<string | null>(null)
  const [hslError, setHslError] = useState<string | null>(null)

  // 收藏和最近颜色
  const [favorites, setFavorites] = useState<ColorRecord[]>([])
  const [recent, setRecent] = useState<ColorRecord[]>([])

  // 使用 ref 避免无限循环
  const recentRef = useRef<ColorRecord[]>([])

  // 加载收藏和最近颜色
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

  // 添加到最近颜色（使用 ref 避免依赖状态）
  const addToRecent = (record: ColorRecord): void => {
    const newRecent = [record, ...recentRef.current.filter((r) => r.hex !== record.hex)].slice(0, 20)
    recentRef.current = newRecent
    setRecent(newRecent)
    window.electronAPI?.setting?.set('color.recent', newRecent)
  }

  // 更新颜色（从 HEX）
  const updateFromHex = (value: string): void => {
    setHexInput(value)
    if (isValidHex(value)) {
      const cleanHex = value.startsWith('#') ? value : `#${value}`
      const rgbResult = hexToRgb(cleanHex)
      if (rgbResult) {
        const hslResult = rgbToHsl(rgbResult.r, rgbResult.g, rgbResult.b)
        setHex(cleanHex)
        setRgb(rgbResult)
        setHsl(hslResult)
        setRgbR(String(rgbResult.r))
        setRgbG(String(rgbResult.g))
        setRgbB(String(rgbResult.b))
        setHslH(String(hslResult.h))
        setHslS(String(hslResult.s))
        setHslL(String(hslResult.l))
        setHexError(null)
        addToRecent({ hex: cleanHex, rgb: rgbResult, hsl: hslResult, createdAt: new Date().toISOString() })
      } else {
        setHexError('无效的 HEX 颜色值')
      }
    } else {
      setHexError('请输入有效的 HEX 颜色值（如 #1677ff）')
    }
  }

  // 更新颜色（从 RGB）
  const updateFromRgb = (r: string, g: string, b: string): void => {
    setRgbR(r)
    setRgbG(g)
    setRgbB(b)
    const rn = parseInt(r)
    const gn = parseInt(g)
    const bn = parseInt(b)
    if (isValidRgb(rn, gn, bn)) {
      const hexResult = rgbToHex(rn, gn, bn)
      const hslResult = rgbToHsl(rn, gn, bn)
      setHex(hexResult)
      setRgb({ r: rn, g: gn, b: bn })
      setHsl(hslResult)
      setHexInput(hexResult)
      setHslH(String(hslResult.h))
      setHslS(String(hslResult.s))
      setHslL(String(hslResult.l))
      setRgbError(null)
      addToRecent({ hex: hexResult, rgb: { r: rn, g: gn, b: bn }, hsl: hslResult, createdAt: new Date().toISOString() })
    } else {
      setRgbError('RGB 值必须是 0-255 的整数')
    }
  }

  // 更新颜色（从 HSL）
  const updateFromHsl = (h: string, s: string, l: string): void => {
    setHslH(h)
    setHslS(s)
    setHslL(l)
    const hn = parseInt(h)
    const sn = parseInt(s)
    const ln = parseInt(l)
    if (isValidHsl(hn, sn, ln)) {
      const rgbResult = hslToRgb(hn, sn, ln)
      const hexResult = rgbToHex(rgbResult.r, rgbResult.g, rgbResult.b)
      setHex(hexResult)
      setRgb(rgbResult)
      setHsl({ h: hn, s: sn, l: ln })
      setHexInput(hexResult)
      setRgbR(String(rgbResult.r))
      setRgbG(String(rgbResult.g))
      setRgbB(String(rgbResult.b))
      setHslError(null)
      addToRecent({ hex: hexResult, rgb: rgbResult, hsl: { h: hn, s: sn, l: ln }, createdAt: new Date().toISOString() })
    } else {
      setHslError('H 值 0-360，S/L 值 0-100')
    }
  }

  // 复制颜色值
  const handleCopy = async (text: string): Promise<void> => {
    await window.electronAPI?.clipboard?.writeText(text)
  }

  // 收藏颜色
  const handleFavorite = (): void => {
    const record: ColorRecord = { hex, rgb, hsl, createdAt: new Date().toISOString() }
    const exists = favorites.some((f) => f.hex === hex)
    let newFavorites: ColorRecord[]
    if (exists) {
      newFavorites = favorites.filter((f) => f.hex !== hex)
    } else {
      newFavorites = [record, ...favorites]
    }
    setFavorites(newFavorites)
    window.electronAPI?.setting?.set('color.favorites', newFavorites)
  }

  // 从收藏/最近选择颜色
  const selectColor = (record: ColorRecord): void => {
    setHex(record.hex)
    setRgb(record.rgb)
    setHsl(record.hsl)
    setHexInput(record.hex)
    setRgbR(String(record.rgb.r))
    setRgbG(String(record.rgb.g))
    setRgbB(String(record.rgb.b))
    setHslH(String(record.hsl.h))
    setHslS(String(record.hsl.s))
    setHslL(String(record.hsl.l))
  }

  // CSS 变量
  const cssVar = generateCssVar(hex, rgb)
  const isFavorite = favorites.some((f) => f.hex === hex)

  return (
    <div className="space-y-6">
      {/* 颜色预览 */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div
            className="h-20 w-20 rounded-lg border border-white/10"
            style={{ backgroundColor: hex }}
          />
          <div className="flex-1">
            <div className="text-lg font-medium">{hex}</div>
            <div className="text-sm text-gray-400">
              RGB({rgb.r}, {rgb.g}, {rgb.b}) | HSL({hsl.h}, {hsl.s}%, {hsl.l}%)
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className={`rounded-lg px-3 py-2 text-sm ${isFavorite ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/10 hover:bg-white/20'}`}
              onClick={handleFavorite}
            >
              {isFavorite ? '取消收藏' : '收藏'}
            </button>
            <button
              className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
              onClick={() => handleCopy(hex)}
            >
              复制 HEX
            </button>
            <button
              className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
              onClick={() => handleCopy(`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`)}
            >
              复制 RGB
            </button>
          </div>
        </div>
      </div>

      {/* 输入区域 */}
      <div className="grid grid-cols-3 gap-4">
        {/* HEX 输入 */}
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
          <label className="text-sm text-gray-400">HEX</label>
          <input
            type="text"
            value={hexInput}
            onChange={(e) => updateFromHex(e.target.value)}
            className="mt-2 w-full rounded border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm focus:border-white/20 focus:outline-none"
          />
          {hexError && <div className="mt-1 text-xs text-red-400">{hexError}</div>}
        </div>

        {/* RGB 输入 */}
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
          <label className="text-sm text-gray-400">RGB</label>
          <div className="mt-2 flex gap-2">
            <input
              type="number"
              value={rgbR}
              onChange={(e) => updateFromRgb(e.target.value, rgbG, rgbB)}
              className="w-full rounded border border-white/10 bg-white/5 px-2 py-2 font-mono text-sm focus:border-white/20 focus:outline-none"
              placeholder="R"
            />
            <input
              type="number"
              value={rgbG}
              onChange={(e) => updateFromRgb(rgbR, e.target.value, rgbB)}
              className="w-full rounded border border-white/10 bg-white/5 px-2 py-2 font-mono text-sm focus:border-white/20 focus:outline-none"
              placeholder="G"
            />
            <input
              type="number"
              value={rgbB}
              onChange={(e) => updateFromRgb(rgbR, rgbG, e.target.value)}
              className="w-full rounded border border-white/10 bg-white/5 px-2 py-2 font-mono text-sm focus:border-white/20 focus:outline-none"
              placeholder="B"
            />
          </div>
          {rgbError && <div className="mt-1 text-xs text-red-400">{rgbError}</div>}
        </div>

        {/* HSL 输入 */}
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
          <label className="text-sm text-gray-400">HSL</label>
          <div className="mt-2 flex gap-2">
            <input
              type="number"
              value={hslH}
              onChange={(e) => updateFromHsl(e.target.value, hslS, hslL)}
              className="w-full rounded border border-white/10 bg-white/5 px-2 py-2 font-mono text-sm focus:border-white/20 focus:outline-none"
              placeholder="H"
            />
            <input
              type="number"
              value={hslS}
              onChange={(e) => updateFromHsl(hslH, e.target.value, hslL)}
              className="w-full rounded border border-white/10 bg-white/5 px-2 py-2 font-mono text-sm focus:border-white/20 focus:outline-none"
              placeholder="S"
            />
            <input
              type="number"
              value={hslL}
              onChange={(e) => updateFromHsl(hslH, hslS, e.target.value)}
              className="w-full rounded border border-white/10 bg-white/5 px-2 py-2 font-mono text-sm focus:border-white/20 focus:outline-none"
              placeholder="L"
            />
          </div>
          {hslError && <div className="mt-1 text-xs text-red-400">{hslError}</div>}
        </div>
      </div>

      {/* CSS 变量 */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">CSS 变量</span>
          <button
            className="rounded px-2 py-1 text-xs text-gray-500 hover:text-white"
            onClick={() => handleCopy(cssVar)}
          >
            复制
          </button>
        </div>
        <pre className="mt-2 rounded bg-black/20 p-3 font-mono text-sm">{cssVar}</pre>
      </div>

      {/* 收藏颜色 */}
      {favorites.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <h3 className="font-medium">收藏颜色</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {favorites.map((record) => (
              <button
                key={record.hex}
                className="h-8 w-8 rounded border border-white/10 transition-transform hover:scale-110"
                style={{ backgroundColor: record.hex }}
                onClick={() => selectColor(record)}
                title={record.hex}
              />
            ))}
          </div>
        </div>
      )}

      {/* 最近颜色 */}
      {recent.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <h3 className="font-medium">最近颜色</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {recent.map((record) => (
              <button
                key={record.hex + record.createdAt}
                className="h-8 w-8 rounded border border-white/10 transition-transform hover:scale-110"
                style={{ backgroundColor: record.hex }}
                onClick={() => selectColor(record)}
                title={record.hex}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
