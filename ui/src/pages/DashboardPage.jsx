import React from 'react'
import { api } from '../lib/api'
import { Card } from '../components/ui.jsx'

function Tile({ title, value, sub }) {
  return (
    <Card className="p-4">
      <div className="text-xs feego-muted">{title}</div>
      <div className="mt-2 text-2xl font-bold break-words">{value}</div>
      {sub ? <div className="mt-2 text-xs text-slate-400 break-words">{sub}</div> : null}
    </Card>
  )
}

function Section({ title, children }) {
  const [open, setOpen] = React.useState(true)
  return (
    <Card className="p-4">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between">
        <div className="text-lg font-bold">{title}</div>
        <div className="text-sm text-slate-400">{open ? 'Ocultar' : 'Mostrar'}</div>
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </Card>
  )
}

function Pre({ text }) {
  return (
    <pre className="text-xs leading-5 p-3 rounded-xl bg-black/30 border border-white/10 overflow-auto max-h-[420px]">
      {text || '—'}
    </pre>
  )
}

export default function DashboardPage() {
  const [st, setSt] = React.useState(null)
  const [ov, setOv] = React.useState(null)
  const [err, setErr] = React.useState(null)

  async function refresh() {
    setErr(null)
    const r1 = await api('/api/status')
    if (r1.ok) setSt(r1.data)

    const r2 = await api('/api/system/overview')
    if (r2.ok) setOv(r2.data)
    else setErr(r2.error || 'No se pudo cargar overview')
  }

  React.useEffect(() => {
    refresh()
    const t = setInterval(refresh, 10_000)
    return () => clearInterval(t)
  }, [])

  const uptimeHuman = (sec) => {
    if (!sec && sec !== 0) return '—'
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    return `${h}h ${m}m`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[32px] leading-[40px] font-bold">Dashboard</div>
          <div className="text-sm leading-5 text-slate-400">Estado del VPS (solo lectura)</div>
        </div>
        <button className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10" onClick={refresh}>
          Refrescar
        </button>
      </div>

      {err ? <div className="text-sm text-red-300">{err}</div> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <Tile title="Servidor" value={st ? (st.hostname + ' · ' + st.uptime) : '…'} />
        <Tile title="Memoria" value={st ? st.mem : '…'} />
        <Tile title="Carga" value={st ? st.load : '…'} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Tile title="CPU" value={ov ? `${ov.cpuCount} cores` : '…'} sub={ov ? `load: ${ov.load?.map((x) => x.toFixed(2)).join(' / ')}` : ''} />
        <Tile title="Uptime" value={ov ? uptimeHuman(ov.uptimeSec) : '…'} sub={ov ? ov.now : ''} />
        <Tile title="IP pública" value={ov ? (ov.publicIp || '—') : '…'} />
      </div>

      <Section title="Servicios">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {(ov?.services || []).map((s) => (
            <div key={s.name} className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5">
              <div className="font-mono text-sm">{s.name}</div>
              <div className={`text-sm font-semibold ${s.active === 'active' ? 'text-emerald-300' : 'text-amber-300'}`}>{s.active}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Disco (df -h)">
        <Pre text={ov?.disk} />
      </Section>

      <Section title="Docker">
        <div className="space-y-3">
          <div>
            <div className="text-xs feego-muted mb-1">docker system df</div>
            <Pre text={ov?.docker?.systemDf} />
          </div>
          <div>
            <div className="text-xs feego-muted mb-1">docker stats (snapshot)</div>
            <Pre text={ov?.docker?.stats} />
          </div>
          <div>
            <div className="text-xs feego-muted mb-1">docker ps</div>
            <Pre text={ov?.docker?.ps} />
          </div>
        </div>
      </Section>

      <Section title="SSL (Let’s Encrypt)">
        <div className="space-y-2">
          {(ov?.certs || []).length === 0 ? <div className="text-sm text-slate-400">No hay certificados detectados.</div> : null}
          {(ov?.certs || []).map((c) => (
            <div key={c.domain} className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5">
              <div className="font-mono text-sm">{c.domain}</div>
              <div className="text-xs text-slate-300">{c.notAfter}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Red">
        <Pre text={ov ? JSON.stringify({ ports: ov.ports, net: ov.net }, null, 2) : '…'} />
      </Section>

      <Section title="Raw overview (debug)">
        <Pre text={ov ? JSON.stringify(ov, null, 2) : '…'} />
      </Section>
    </div>
  )
}
