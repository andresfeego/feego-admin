import React from 'react'
import Holidays from 'date-holidays'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
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

  const [recentOpen, setRecentOpen] = React.useState(false)
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[32px] leading-[40px] font-bold">Diario</div>
          <div className="text-sm leading-5 text-slate-400">Resumen diario por fecha (texto). Fuente: entradas guardadas en BD.</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
            onClick={async () => {
              try {
                setRecentLoading(true)
                const r = await api('/api/infra/diary/recent?limit=10')
                if (r.ok) setRecent(r.data.entries || [])
                setRecentOpen(true)
              } finally {
                setRecentLoading(false)
              }
            }}
          >
            {recentLoading ? 'Cargando…' : 'Ver últimos 10 días'}
          </button>
        </div>
      </div>

      <Card className="p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-200 font-bold">{monthLabelBogota(activeDate)}</div>
          <div className="text-xs text-slate-400">Click en un día para ver el resumen</div>
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
                if (r.ok) {
                  setDayEntry(r.data.entry)
                  setDayOpen(true)
                } else {
                  setDayEntry({ day, summary_md: '', updated_at: null })
                  setDayOpen(true)
                }
              } catch {
                setDayEntry({ day, summary_md: '', updated_at: null })
                setDayOpen(true)
              }
            }}
          />
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
              <div className="text-xs text-slate-400">Resumen (texto)</div>
              <div className="mt-3">
                <pre className="text-sm leading-6 p-3 rounded-xl bg-black/30 border border-white/10 overflow-auto whitespace-pre-wrap">{(dayEntry.summary_md || '—').trim() || '—'}</pre>
              </div>
            </Card>
          </div>
        )}
      </Modal>

      <Modal open={recentOpen} onClose={() => setRecentOpen(false)} title="Últimos 10 días">
        <div className="space-y-3">
          {!recent || recent.length === 0 ? <div className="text-sm text-slate-400">—</div> : null}
          {(recent || []).map((e) => (
            <Card key={e.day} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-mono text-sm text-slate-200">{e.day}</div>
                <div className="text-xs text-slate-400">{e.updated_at ? fmtBogota(e.updated_at) : ''}</div>
              </div>
              <pre className="mt-3 text-sm leading-6 p-3 rounded-xl bg-black/30 border border-white/10 overflow-auto whitespace-pre-wrap">{(e.summary_md || '—').trim() || '—'}</pre>
            </Card>
          ))}
        </div>
      </Modal>
    </div>
  )
}
