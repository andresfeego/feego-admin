import React from 'react'
import { NotebookPen, CalendarDays, RefreshCw } from 'lucide-react'
import OperationsHeader from '../components/OperationsHeader'
import './AdminPages.scss'
import Holidays from 'date-holidays'
import Calendar from 'react-calendar'
import '../styles/calendar-min.css'
import { api } from '../lib/api.js'

function Card({ className = '', children }) {
  return <div className={`rounded-2xl border ops-border ops-surface ${className}`}>{children}</div>
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} />
      <div className="fixed z-50 inset-0 grid place-items-center p-4" onClick={onClose}>
        <div className="diary-day-dialog w-full max-w-3xl rounded-2xl border ops-border ops-surface" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
          <div className="flex items-center justify-between gap-4 p-4 border-b ops-border">
            <div className="text-xl font-bold ops-text">{title}</div>
            <button className="px-3 py-2 rounded-lg border ops-border ops-surface hover:bg-white/10" onClick={onClose}>Cerrar</button>
          </div>
          <div className="p-4">{children}</div>
        </div>
      </div>
    </>
  )
}

const TZ_BOGOTA = 'America/Bogota'

function dayKeyBogota(d) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ_BOGOTA }).format(d)
}

function fmtBogota(iso) {
  try {
    const dt = new Date(iso)
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: TZ_BOGOTA,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(dt)
  } catch {
    return String(iso || '—')
  }
}

function recentLabelBogota(dayIso) {
  try {
    const tz = 'America/Bogota'
    const parts = String(dayIso || '').split('-')
    const Y = Number(parts[0] || 0)
    const M = Number(parts[1] || 1)
    const D = Number(parts[2] || 1)
    const dt = new Date(Date.UTC(Y, M - 1, D, 12, 0, 0))
    const wdRaw = new Intl.DateTimeFormat('es-CO', { timeZone: tz, weekday: 'short' }).format(dt)
    const key = wdRaw.toLowerCase().replace('.', '')
    const map = { lun: 'Lun', mar: 'Mar', mié: 'Mie', mie: 'Mie', jue: 'Jue', vie: 'Vie', sáb: 'Sab', sab: 'Sab', dom: 'Dom' }
    const W = map[key] || (wdRaw.charAt(0).toUpperCase() + wdRaw.slice(1, 3).toLowerCase())
    const dd = String(D).padStart(2, '0')
    const mm = String(M).padStart(2, '0')
    const yyyy = String(Y).padStart(4, '0')
    return W + ' ' + dd + '-' + mm + '-' + yyyy
  } catch {
    return String(dayIso || '')
  }
}
function extractGoals(md) {
  const txt = String(md || '').split('\r\n').join('\n').trim()
  if (!txt) return ''

  const m = txt.match(/(^|\n)##\s+Metas\b([\s\S]*?)(?=\n##\s+|$)/m)
  const body = m ? String(m[2] || '').trim() : txt
  if (!body) return ''

  return body
    .split('\n')
    .map((l) => String(l || '').trim())
    .filter(Boolean)
    .map((l) => l.replace(/^[-*]\s*/, '').replace(/^\[[ xX]\]\s*/, ''))
    .join('\n')
}
function prettyDayTitleBogota(dayIso) {
  try {
    const tz='America/Bogota'
    const parts=String(dayIso||'').split('-')
    const Y=Number(parts[0]||0)
    const M=Number(parts[1]||1)
    const D=Number(parts[2]||1)
    const dt=new Date(Date.UTC(Y, M-1, D, 12, 0, 0))
    const month = new Intl.DateTimeFormat('es-CO', { timeZone: tz, month: 'long' }).format(dt)
    const m = month ? (month.charAt(0).toUpperCase() + month.slice(1)) : ''
    return String(D) + ' ' + m
  } catch {
    return String(dayIso || '')
  }
}
function monthLabelBogota(date) {
  try {
    return new Intl.DateTimeFormat('es-CO', { timeZone: TZ_BOGOTA, month: 'long', year: 'numeric' }).format(date)
  } catch {
    return ''
  }
}

export default function DiaryPage() {
  const [summary, setSummary] = React.useState(null)
  const [loading, setLoading] = React.useState(false)
  const [activeDate, setActiveDate] = React.useState(new Date())

  const [dayOpen, setDayOpen] = React.useState(false)
  const [dayEntry, setDayEntry] = React.useState(null)
  const [dayRows, setDayRows] = React.useState([])
  const [dayGoals, setDayGoals] = React.useState([])
  const [editingGoalId, setEditingGoalId] = React.useState(null)
  const [editingGoalText, setEditingGoalText] = React.useState('')
  const [dayGoalsLoading, setDayGoalsLoading] = React.useState(false)
  const [dayRowsLoading, setDayRowsLoading] = React.useState(false)
  const [newGoalText, setNewGoalText] = React.useState('')
  const [creatingGoal, setCreatingGoal] = React.useState(false)

  const [recentExpanded, setRecentExpanded] = React.useState(false)
  const [recent, setRecent] = React.useState([])
  const [recentLoading, setRecentLoading] = React.useState(false)

  async function loadSummary() {
    try {
      setLoading(true)
      const r = await api('/api/infra/diary/summary')
      if (r.ok) setSummary(r.data)
    } finally {
      setLoading(false)
    }
  }

  async function loadDayRowsFor(day) {
    await loadDayRowsFor(day)
  }

  async function loadDayGoalsFor(day) {
    try {
      setDayGoalsLoading(true)
      const rr = await api('/api/infra/diary/goals?day=' + encodeURIComponent(day))
      if (rr.ok) setDayGoals(rr.data.goals || [])
      else setDayGoals([])
    } finally {
      setDayGoalsLoading(false)
    }
  }

  async function toggleGoal(id, done) {
    try {
      await api('/api/infra/diary/goals/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, done }),
      })
    } finally {
      if (dayEntry?.day) await loadDayGoalsFor(dayEntry.day)
    }
  }

  async function updateGoalText(id, text) {
    const t = String(text || '').trim()
    if (!t) return
    await api('/api/infra/diary/goals/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, text: t }),
    })
    if (dayEntry?.day) await loadDayGoalsFor(dayEntry.day)
  }


  async function createGoalForDay(day, text) {
    const t = String(text || '').trim()
    if (!day || !t) return
    try {
      setCreatingGoal(true)
      await api('/api/infra/diary/goals/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day, text: t }),
      })
      setNewGoalText('')
    } finally {
      setCreatingGoal(false)
      if (dayEntry?.day) await loadDayGoalsFor(dayEntry.day)
    }
  }


  React.useEffect(() => {
    loadSummary()
  }, [])

  const hasDay = (day) => {
    const rec = (summary && summary.days ? summary.days : []).find((x) => x.day === day)
    return !!(rec && rec.hasSummary)
  }

  return (
    <div className="ops-page diary-page space-y-6">
      <OperationsHeader icon={NotebookPen} eyebrow="REGISTRO DE ACTIVIDAD" title="Diario" description="Resumen del día, metas y seguimiento." />

      <Card className="diary-calendar-panel p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="ops-section-label"><CalendarDays size={18} />{monthLabelBogota(activeDate)}</div>
          <div className="flex items-center gap-2">
            <div className="text-xs ops-muted">Selecciona un día</div>
            <button
              className="px-3 py-2 rounded-lg border ops-border ops-surface hover:bg-white/10 text-xs"
              onClick={async () => { await loadSummary() }}
              disabled={loading}
              title="Actualizar la vista del calendario"
            >
              <RefreshCw size={15} />{loading ? "Actualizando…" : "Actualizar"}
            </button>
          </div>
        </div>

        <div className="mt-3">
          {loading ? <div className="text-sm ops-muted p-3">Cargando…</div> : null}
          <Calendar
            className="feego-calendar"
            value={activeDate}
            onActiveStartDateChange={({ activeStartDate }) => {
              if (activeStartDate) setActiveDate(activeStartDate)
            }}
            calendarType="iso8601"
            showNeighboringMonth={true}
            tileClassName={({ date, view }) => {
              if (view !== 'month') return null
              const day = dayKeyBogota(date)
              return hasDay(day) ? 'feego-cal level-3' : 'feego-cal level-0'
            }}
            tileContent={({ date, view }) => {
              if (view !== 'month') return null
              const hd = new Holidays('CO')
              const hols = hd.isHoliday(date)
              const holidayName = Array.isArray(hols) && hols.length ? hols[0].name : null
              return (
                <div className="w-full h-full">
                  {holidayName ? (
                    <div className="feego-cal-holiday" title={holidayName}>
                      {holidayName}
                    </div>
                  ) : null}
                </div>
              )
            }}
            onClickDay={async (date) => {
              const day = dayKeyBogota(date)
              try {
                const r = await api('/api/infra/diary/day?day=' + encodeURIComponent(day))
                try {
                  setDayRowsLoading(true)
                  const rr = await api('/api/infra/diary/day-items?day=' + encodeURIComponent(day))
                  if (rr.ok) setDayRows(rr.data.rows || [])
                  else setDayRows([])
                } finally {
                  setDayRowsLoading(false)
                }

                await loadDayGoalsFor(day)
                if (r.ok) {
                  setDayEntry(r.data.entry)
                  setDayOpen(true)
                } else {
                  setDayEntry({ day, summary_md: '', updated_at: null })
                  setDayRows([])
                  setDayOpen(true)
                }
              } catch {
                setDayEntry({ day, summary_md: '', updated_at: null })
                setDayRows([])
                setDayOpen(true)
              }
            }}
          />
        </div>

        <div className="mt-4 border-t ops-border pt-4">
          <button
            className="px-3 py-2 rounded-lg border ops-border ops-surface hover:bg-white/10"
            onClick={async () => {
              if (!recentExpanded) {
                try {
                  setRecentLoading(true)
                  const r = await api('/api/infra/diary/recent?limit=10')
                  if (r.ok) setRecent(r.data.entries || [])
                } finally {
                  setRecentLoading(false)
                }
              }
              setRecentExpanded((v) => !v)
            }}
          >
            {recentLoading ? 'Cargando…' : (recentExpanded ? 'Ocultar últimos 10 días' : 'Ver últimos 10 días')}
          </button>

          {recentExpanded ? (
            <div className="mt-4 space-y-2">
              {!recent || recent.length === 0 ? <div className="text-sm ops-muted">—</div> : null}
              {(recent || []).map((e) => (
                <details key={e.day} className="group rounded-xl border ops-border ops-surface">
                  <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between gap-3">
                    <div className="font-mono text-sm ops-text">{recentLabelBogota(e.day)}</div>
                  </summary>
                  <div className="px-4 pb-4">
                    <pre className="text-sm leading-6 p-3 rounded-xl ops-inset border ops-border overflow-auto whitespace-pre-wrap">{(e.summary_md || '—').trim() || '—'}</pre>
                  </div>
                </details>
              ))}
            </div>
          ) : null}
        </div>
      </Card>

      <Modal open={dayOpen} onClose={() => setDayOpen(false)} title={dayEntry ? prettyDayTitleBogota(dayEntry.day) : 'Diario'}>
        {!dayEntry ? null : (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs ops-muted">Metas</div>
                <div className="flex items-center gap-2">
                  <input
                    className="px-3 py-2 rounded-lg border ops-border ops-inset ops-text text-xs min-w-[220px]"
                    placeholder="Agregar meta manual"
                    value={newGoalText}
                    onChange={(e) => setNewGoalText(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        await createGoalForDay(dayEntry?.day, newGoalText)
                      }
                    }}
                  />
                  <button
                    className="px-3 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs"
                    onClick={async () => await createGoalForDay(dayEntry?.day, newGoalText)}
                    disabled={creatingGoal}
                  >
                    {creatingGoal ? 'Guardando…' : '+ Agregar meta'}
                  </button>
                  <button className="px-3 py-2 rounded-lg border ops-border ops-surface hover:bg-white/10 text-xs" onClick={() => dayEntry?.day ? loadDayGoalsFor(dayEntry.day) : null}>
                    Refrescar
                  </button>
                </div>
              </div>

              {dayGoalsLoading ? <div className="mt-2 text-sm ops-muted">Cargando…</div> : null}
              {!dayGoalsLoading && (!dayGoals || dayGoals.length === 0) ? <div className="mt-2 text-sm ops-muted">—</div> : null}

              {dayGoals && dayGoals.length ? (
                <div className="mt-3 space-y-2">
                  {dayGoals.map((g) => (
                    <div key={g.id} className="flex items-center gap-3 p-3 rounded-xl border ops-border ops-inset">
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-emerald-500"
                        checked={g.status === 'done'}
                        onChange={(e) => toggleGoal(g.id, e.target.checked)}
                      />

                      {editingGoalId === g.id ? (
                        <input
                          className="flex-1 px-3 py-2 rounded-xl border ops-border ops-inset ops-text text-sm"
                          value={editingGoalText}
                          autoFocus
                          onChange={(e) => setEditingGoalText(e.target.value)}
                          onBlur={async () => {
                            const next = editingGoalText
                            setEditingGoalId(null)
                            setEditingGoalText('')
                            await updateGoalText(g.id, next)
                          }}
                          onKeyDown={async (e) => {
                            if (e.key === 'Escape') {
                              setEditingGoalId(null)
                              setEditingGoalText('')
                            }
                            if (e.key === 'Enter') {
                              const next = editingGoalText
                              setEditingGoalId(null)
                              setEditingGoalText('')
                              await updateGoalText(g.id, next)
                            }
                          }}
                        />
                      ) : (
                        <div className={"flex-1 text-sm " + (g.status === 'done' ? 'line-through ops-muted' : 'ops-text')}>{g.text}</div>
                      )}

                      <button
                        type="button"
                        className="shrink-0 w-9 h-9 grid place-items-center rounded-xl border ops-border ops-surface hover:bg-white/10"
                        title="Editar"
                        onClick={() => {
                          setEditingGoalId(g.id)
                          setEditingGoalText(g.text || '')
                        }}
                      >
                        ✎
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>

<Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs ops-muted">Ítems (visual)</div>
                <button className="px-3 py-2 rounded-lg border ops-border ops-surface hover:bg-white/10 text-xs" onClick={() => dayEntry?.day ? loadDayRowsFor(dayEntry.day) : null}>
                  Refrescar
                </button>
              </div>
              {dayRowsLoading ? <div className="mt-2 text-sm ops-muted">Cargando…</div> : null}
              {!dayRowsLoading && (!dayRows || dayRows.length === 0) ? <div className="mt-2 text-sm ops-muted">—</div> : null}

              {dayRows && dayRows.length ? (
                <div className="mt-3 overflow-auto rounded-xl border ops-border">
                  <table className="w-full text-sm">
                    <thead className="ops-surface">
                      <tr className="text-left">                        <th className="p-3">Ítem</th>
                        <th className="p-3 w-[180px]">Horas</th>
                        <th className="p-3">Comentario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayRows.map((r) => {
                        return (
                          <tr key={r.slug} className="border-t ops-border">
                            <td className="p-3 font-medium ops-text">{r.name}</td>
                            <td className="p-3 font-mono text-xs ops-muted">{r.range || '—'}</td>
                            <td className="p-3 ops-muted">{r.comment || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </Card>

            
          </div>
        )}
      </Modal>
    </div>
  )
}
