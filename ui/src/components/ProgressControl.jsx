import React from 'react'
import { Input } from './ui.jsx'

export function ProgressBar({ value, label = 'Progreso' }) {
  return <progress className="feego-progress" aria-label={label} value={value} max="100" />
}
export default function ProgressControl({ value, onChange, disabled = false, label = 'Progreso', min = 0, max = 100 }) {
  const id = React.useId()
  return <div className="flex items-center gap-2 min-w-0">
    <input className="min-w-0 flex-1" aria-label={`${label} deslizador`} type="range" min={min} max={max} step="1" value={value === '' ? min : value} disabled={disabled} onChange={e => onChange(Number(e.target.value))} style={{ accentColor: 'var(--feego-primary)' }} />
    <label className="sr-only" htmlFor={id}>{label}</label>
    <Input id={id} className="!w-20 shrink-0" type="number" min={min} max={max} step="1" value={value} disabled={disabled} onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
    <span className="feego-muted">%</span>
  </div>
}
