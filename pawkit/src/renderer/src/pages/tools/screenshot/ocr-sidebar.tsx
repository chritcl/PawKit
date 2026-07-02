import { useCallback, useRef } from 'react'
import { Copy, X, CheckSquare } from 'lucide-react'
import type { OcrOverlayResult } from '../../../../../shared/types'

interface OcrSidebarProps {
  result: OcrOverlayResult
  onClose: () => void
  onCopyAll: () => void
}

export function OcrSidebar({ result, onClose, onCopyAll }: OcrSidebarProps): JSX.Element {
  const textRef = useRef<HTMLTextAreaElement>(null)

  const handleCopySelected = useCallback(() => {
    const textarea = textRef.current
    if (!textarea) return
    const selected = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd)
    if (selected) {
      void window.electronAPI.ocr.copyText(selected)
    }
  }, [])

  return (
    <div className="absolute right-3 top-1/2 z-[200] flex w-[280px] -translate-y-1/2 flex-col rounded-lg border border-white/15 bg-[#101827]/95 shadow-2xl backdrop-blur">
      {/* 标题栏 */}
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-sm font-medium">OCR 识别结果</span>
        <button
          className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-white/10 hover:text-white"
          onClick={onClose}
          title="关闭"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 元信息 */}
      <div className="border-b border-white/10 px-3 py-1.5 text-xs text-slate-400">
        置信度: {Math.round(result.confidence)}% · {result.regions.length} 行
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-1 border-b border-white/10 px-3 py-1.5">
        <button
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
          onClick={onCopyAll}
        >
          <Copy className="h-3 w-3" /> 复制全部
        </button>
        <button
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
          onClick={handleCopySelected}
        >
          <CheckSquare className="h-3 w-3" /> 复制选中
        </button>
      </div>

      {/* 文本区域 */}
      <textarea
        ref={textRef}
        className="m-2 max-h-[60vh] min-h-[120px] flex-1 resize-none rounded border-0 bg-transparent p-2 text-sm text-slate-200 outline-none"
        value={result.fullText}
        readOnly
        wrap="off"
      />
    </div>
  )
}
