import { APP_NAME, APP_VERSION } from '../../../../shared/constants'

// 状态栏组件
export function StatusBar(): JSX.Element {
  return (
    <div className="glass-status flex h-7 items-center justify-between border-x-0 border-b-0 px-4 text-[11px] text-[color:var(--text-muted)]">
      <span>
        {APP_NAME} v{APP_VERSION}
      </span>
      <span>
        Alt + Space 切换窗口
      </span>
    </div>
  )
}
