import type { ReactNode } from 'react'
import { Minus, Plus } from 'lucide-react'

interface StyleNumberStepperProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
}

interface StyleColorControlProps {
  label: string
  value: string
  onChange: (value: string) => void
}

interface StyleToggleButtonProps {
  label: string
  active: boolean
  showLabel?: boolean
  onClick: () => void
  children: ReactNode
}

interface StyleActionButtonProps {
  label: string
  onClick: () => void
  children: ReactNode
}

interface StyleSegmentedControlProps {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}

export function StyleNumberStepper({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange
}: StyleNumberStepperProps): JSX.Element {
  const commit = (nextValue: number): void => {
    onChange(clampNumber(nextValue, min, max))
  }

  return (
    <div className="screenshot-number-control">
      <span className="screenshot-control-label">{label}</span>
      <div className="screenshot-number-capsule">
        <button
          type="button"
          aria-label={`${label}减小`}
          disabled={value <= min}
          onClick={() => commit(value - step)}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <label className="screenshot-number-value">
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            step={step}
            value={value}
            aria-label={label}
            onChange={(event) => commit(Number(event.target.value))}
          />
          {unit && <span>{unit}</span>}
        </label>
        <button
          type="button"
          aria-label={`${label}增大`}
          disabled={value >= max}
          onClick={() => commit(value + step)}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export function StyleColorControl({
  label,
  value,
  onChange
}: StyleColorControlProps): JSX.Element {
  return (
    <label className="screenshot-color-control" title={`${label} ${value}`}>
      <span className="screenshot-control-label">{label}</span>
      <span className="screenshot-color-capsule">
        <span className="screenshot-color-chip" style={{ backgroundColor: value }} />
        <input
          type="color"
          value={value}
          aria-label={label}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </label>
  )
}

export function StyleToggleButton({
  label,
  active,
  showLabel = true,
  onClick,
  children
}: StyleToggleButtonProps): JSX.Element {
  return (
    <button
      type="button"
      className={`screenshot-style-button ${active ? 'is-active' : ''}`}
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
    >
      {children}
      {showLabel && <span>{label}</span>}
    </button>
  )
}

export function StyleActionButton({
  label,
  onClick,
  children
}: StyleActionButtonProps): JSX.Element {
  return (
    <button
      type="button"
      className="screenshot-style-button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
      <span>{label}</span>
    </button>
  )
}

export function StyleSegmentedControl({
  label,
  value,
  options,
  onChange
}: StyleSegmentedControlProps): JSX.Element {
  return (
    <div className="screenshot-segmented-control" role="group" aria-label={label}>
      <span className="screenshot-control-label">{label}</span>
      <div className="screenshot-segmented-options">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? 'is-active' : ''}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}
