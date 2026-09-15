import React from 'react'
import { Timer, Pause, CircleCheck } from 'lucide-react'
import './TaskWorkTimer.scss'
export function formatWorkTime(milliseconds) {
  const seconds = Math.floor(Math.max(0, Number(milliseconds) || 0) / 1000)
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
export default function TaskWorkTimer({ card, detailed = false }) {
  const running = !!card.work_started_at
  const total = Number(card.work_total_ms ?? card.work_elapsed_ms ?? 0)
  const anchor = React.useMemo(() => card.work_received_at ?? Date.now(), [card.work_received_at, card.work_sampled_at, card.work_started_at, total])
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    setNow(Date.now())
    if (!running) return
    const tick = () => setNow(Date.now())
    const interval = setInterval(tick, 1000)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', tick) }
  }, [running, anchor])
  const value = formatWorkTime(total + (running ? Math.max(0, now - anchor) : 0))
  const complete = card.status === 'done' || Number(card.progress_pct) === 100
  const label = running ? 'En curso' : complete ? 'Finalizado' : total ? 'Pausado' : 'Sin iniciar'
  const Icon = running ? Timer : complete ? CircleCheck : Pause
  return <span className={`task-work-timer${running ? ' is-running' : ''}${detailed ? ' is-detailed' : ''}`} title={`Tiempo de trabajo · ${label}`} aria-label={`Tiempo de trabajo: ${value} · ${label}`}><Icon size={14} /><span>{detailed && <small>Tiempo de trabajo · {label}</small>}<strong>{value}</strong></span></span>
}
