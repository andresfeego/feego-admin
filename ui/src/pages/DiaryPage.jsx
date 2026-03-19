import React from 'react'
import Holidays from 'date-holidays'
import Calendar from 'react-calendar'
import '../styles/calendar-min.css'
import { api } from '../lib/api.js'

function Card({ className = '', children }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/5 ${className}`}>{children}</div>
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} />
      <div className="fixed z-50 inset-0 grid place-items-center p-4">
        <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4 p-4 border-b border-white/10">
            <div className="font-bold text-slate-100">{title}</div>
            <button className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10" onClick={onClose}>Cerrar</button>
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
  const [dayRowsLoading, setDayRowsLoading] = React.useState(false)

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

  React.useEffect(() => {
    loadSummary()
  }, [])

  const hasDay = (day) => {
    const rec = (summary && summary.days ? summary.days : []).find((x) => x.day === day)
    return !!(rec && rec.hasSummary)
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[32px] leading-[40px] font-bold">Diario</div>
        <div className="text-sm leading-5 text-slate-400">Resumen diario por fecha (texto). Fuente: entradas guardadas en BD.</div>
      </div>

      <Card className="p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-slate-200 font-bold">{monthLabelBogota(activeDate)}</div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-400">Click en un día para ver el resumen</div>
            <button
              className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs"
              onClick={async () => { await loadSummary() }}
              disabled={loading}
              title="Actualizar la vista del calendario"
            >
              {loading ? "Actualizando…" : "Refrescar calendario"}
            </button>
          </div>
        </div>

        <div className="mt-3">
          {loading ? <div className="text-sm text-slate-400 p-3">Cargando…</div> : null}
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

        <div className="mt-4 border-t border-white/10 pt-4">
          <button
            className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
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
              {!recent || recent.length === 0 ? <div className="text-sm text-slate-400">—</div> : null}
              {(recent || []).map((e) => (
                <details key={e.day} className="group rounded-xl border border-white/10 bg-white/5">
                  <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between gap-3">
                    <div className="font-mono text-sm text-slate-200">{e.day}</div>
                    <div className="text-xs text-slate-400">{e.updated_at ? fmtBogota(e.updated_at) : ''}</div>
                  </summary>
                  <div className="px-4 pb-4">
                    <pre className="text-sm leading-6 p-3 rounded-xl bg-black/30 border border-white/10 overflow-auto whitespace-pre-wrap">{(e.summary_md || '—').trim() || '—'}</pre>
                  </div>
                </details>
              ))}
            </div>
          ) : null}
        </div>
      </Card>

      <Modal open={dayOpen} onClose={() => setDayOpen(false)} title={dayEntry ? ('Diario ' + dayEntry.day) : 'Diario'}>
        {!dayEntry ? null : (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="text-xs text-slate-400">Actualizado</div>
              <div className="mt-1 text-sm text-slate-200 font-mono">{dayEntry.updated_at ? fmtBogota(dayEntry.updated_at) : '—'}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-slate-400">Ítems (visual)</div>
              {dayRowsLoading ? <div className="mt-2 text-sm text-slate-400">Cargando…</div> : null}
              {!dayRowsLoading && (!dayRows || dayRows.length === 0) ? <div className="mt-2 text-sm text-slate-400">—</div> : null}

              {dayRows && dayRows.length ? (
                <div className="mt-3 overflow-auto rounded-xl border border-white/10">
                  <table className="w-full text-sm">
                    <thead className="bg-white/5">
                      <tr className="text-left">                        <th className="p-3">Ítem</th>
                        <th className="p-3 w-[180px]">Horas</th>
                        <th className="p-3">Comentario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayRows.map((r) => {
                        return (
                          <tr key={r.slug} className="border-t border-white/10">
                            <td className="p-3 font-medium text-slate-100">{r.name}</td>
                            <td className="p-3 font-mono text-xs text-slate-300">{r.range || '—'}</td>
                            <td className="p-3 text-slate-300">{r.comment || '—'}</td>
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
