import React from 'react'
import Calendar from 'react-calendar'
import Holidays from 'date-holidays'
import '../styles/calendar-min.css'
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

function bytesHuman(n) {
  if (n === null || n === undefined) return '—'
  const u = ['B','KB','MB','GB','TB']
  let i=0
  let v=Number(n)
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${u[i]}`
}



function mdSectionReplace(md, header, newBody) {
  const lines = String(md || '').split(/\n/)
  const startIdx = lines.findIndex((l) => l.trim() === header.trim())
  if (startIdx === -1) return null

  let endIdx = lines.length
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) { endIdx = i; break }
  }

  const before = lines.slice(0, startIdx).join('\n')
  const after = lines.slice(endIdx).join('\n')
  const body = [header, '', newBody.trimEnd(), '', ''].join('\n')
  return [before.trimEnd(), body, after.trimStart()].filter(Boolean).join('\n') + '\n'
}

function parseVpsMd(md) {
  const text = String(md || '')
  const out = {
    migrated: { makoLabUrl: 'https://lab-mako.mako.guru', makoProdUrl: 'https://mako.guru' },
    mievento: { labBackendName: 'backend-altezza', labPort: '3022', prodProxyUrl: 'feegosystem.com/proxyPassthrough.php?path=/api/responseAltezza' },
    sisproind: {
      prodService: 'backend-sisproind', prodPort: '3021', prodDb: 'feegosys_sisproind', prodDataRoot: '/srv/sisproind/plataforma',
      labService: 'backend-sisproind-lab', labPort: '3031', labDb: 'feegosys_sisproind_lab', labDataRoot: '/srv/sisproind/plataforma-lab',
    },
    mako: {
      backendLabPort: '3032', backendLabDb: 'feegosys_mako_lab', backendProdPort: '3033', backendProdDb: 'feegosys_mako_prod',
      frontLabPort: '3102', frontProdPort: '3103',
      notes: 'scrAppServer servido estático en cada ambiente y Next/Image unoptimized para eliminar URLs legacy.',
    },
    pending: { otherLines: '' },
  }

  function pick(re, fallback) {
    const m = text.match(re)
    return m && m[1] ? String(m[1]).trim() : fallback
  }

  out.migrated.makoLabUrl = pick(/LAB:\s*(https?:\/\/[^\s)]+)/i, out.migrated.makoLabUrl)
  out.migrated.makoProdUrl = pick(/PROD:\s*(https?:\/\/[^\s)]+)/i, out.migrated.makoProdUrl)
  out.mievento.labBackendName = pick(/LAB\s*→\s*([^\n(]+)/i, out.mievento.labBackendName)
  out.mievento.labPort = pick(/\((\d{2,5})\)\s*✅/i, out.mievento.labPort)
  out.mievento.prodProxyUrl = pick(/proxy\s+([^\s]+proxyPassthrough\.php[^\s]+)/i, out.mievento.prodProxyUrl)
  out.sisproind.prodPort = pick(/PROD[^\n]*?:\s*(\d{2,5}),\s*DB\s*`feegosys_sisproind`/i, out.sisproind.prodPort)
  out.sisproind.labPort = pick(/LAB[^\n]*?:\s*(\d{2,5}),\s*DB\s*`feegosys_sisproind_lab`/i, out.sisproind.labPort)
  out.mako.backendLabPort = pick(/LAB\s*(\d{2,5})\s*→\s*DB\s*`feegosys_mako_lab`/i, out.mako.backendLabPort)
  out.mako.backendProdPort = pick(/PROD\s*(\d{2,5})\s*→\s*DB\s*`feegosys_mako_prod`/i, out.mako.backendProdPort)
  out.mako.frontLabPort = pick(/Front:[\s\S]*?LAB\s*(\d{2,5})/i, out.mako.frontLabPort)
  out.mako.frontProdPort = pick(/Front:[\s\S]*?PROD\s*(\d{2,5})/i, out.mako.frontProdPort)

  return out
}

function buildStatusSectionMd(m) {
  const labUrl = (m && m.migrated && m.migrated.makoLabUrl) ? m.migrated.makoLabUrl : 'https://lab-mako.mako.guru'
  const prodUrl = (m && m.migrated && m.migrated.makoProdUrl) ? m.migrated.makoProdUrl : 'https://mako.guru'
  return [
    '> Regla operativa: **Wipi NO modifica PROD directo**. Solo LAB; a PROD pasa por **PR** revisado por Andres.',
    '',
    '### Migrados (en VPS)',
    '- `comopreparar.co` (WordPress)',
    '- `altezzaeventos.in` (WordPress)',
    '- `mievento.altezzaeventos.in` (Next.js)',
    '- `feegoadmin` (Node) — expuesto en `https://admin.feegosystem.com/administracion/`',
    '- `mercypersonalizados.com` (WordPress)',
    '- `sisproind.com` (WordPress)',
    '- `mako` (backend + frontend)',
    '  - LAB: `' + labUrl + '`',
    '  - PROD: `' + prodUrl + '` (+ `www`)',
    '',
    '### Detalle rápido por proyecto',
    '',
    '**Mievento**',
    '- LAB → ' + (m?.mievento?.labBackendName || 'backend-altezza') + ' (' + (m?.mievento?.labPort || '3022') + ') ✅',
    '- PROD → aún usa proxy `' + (m?.mievento?.prodProxyUrl || 'feegosystem.com/proxyPassthrough.php?path=/api/responseAltezza') + '` ⏳',
    '',
    '**SISPROIND**',
    '- PROD ' + (m?.sisproind?.prodService || 'backend-sisproind') + ': ' + (m?.sisproind?.prodPort || '3021') + ', DB `' + (m?.sisproind?.prodDb || 'feegosys_sisproind') + '`, data root `' + (m?.sisproind?.prodDataRoot || '/srv/sisproind/plataforma') + '`',
    '- LAB ' + (m?.sisproind?.labService || 'backend-sisproind-lab') + ': ' + (m?.sisproind?.labPort || '3031') + ', DB `' + (m?.sisproind?.labDb || 'feegosys_sisproind_lab') + '`, data root `' + (m?.sisproind?.labDataRoot || '/srv/sisproind/plataforma-lab') + '`',
    '',
    '**MAKO**',
    '- Backend:',
    '  - LAB ' + (m?.mako?.backendLabPort || '3032') + ' → DB `' + (m?.mako?.backendLabDb || 'feegosys_mako_lab') + '`',
    '  - PROD ' + (m?.mako?.backendProdPort || '3033') + ' → DB `' + (m?.mako?.backendProdDb || 'feegosys_mako_prod') + '`',
    '- Front:',
    '  - LAB ' + (m?.mako?.frontLabPort || '3102'),
    '  - PROD ' + (m?.mako?.frontProdPort || '3103'),
    '- ' + (m?.mako?.notes || 'scrAppServer servido estático en cada ambiente y Next/Image unoptimized para eliminar URLs legacy.'),
    '',
    '### Pendientes',
    '- Backend/API de Altezza (Node, actualmente en cPanel)',
    '- servicio backend (proxy `3020/8443`) — falta documentar nombre, repo, dominios y runbook',
  ].filter(Boolean).join('\n')
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-0 p-4 md:p-10 flex items-start justify-center overflow-auto">
        <Card className="w-full max-w-3xl p-5 md:p-6 relative">
          <div className="flex items-start justify-between gap-4">
            <div className="text-xl font-bold">{title}</div>
            <button className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10" onClick={onClose}>
              Cerrar
            </button>
          </div>
          <div className="mt-4">{children}</div>
        </Card>
      </div>
    </div>
  )
}

function parseMdSections(md) {
  const text = String(md || '')
  const lines = text.split(/\n/)
  const sections = []
  let current = null
  for (const line of lines) {
    const m = line.match(/^#\s+(.+)\s*$/)
    if (m) {
      if (current) sections.push(current)
      current = { title: m[1].trim(), body: '' }
      continue
    }
    if (!current) continue
    current.body += (current.body ? '\n' : '') + line
  }
  if (current) sections.push(current)
  return sections
}

function ProjectCard({ p, onClick }) {
  const statusColor =
    p.status === 'migrated'
      ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/25'
      : p.status === 'pending'
        ? 'bg-amber-500/15 text-amber-200 border-amber-500/25'
        : 'bg-sky-500/15 text-sky-200 border-sky-500/25'

  return (
    <button onClick={onClick} className="text-left group">
      <Card className="p-4 hover:bg-white/10 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 overflow-hidden flex items-center justify-center">
            {p.logo_url ? <img src={p.logo_url} alt={p.name} className="w-full h-full object-contain" /> : <div className="text-xs text-slate-400">—</div>}
          </div>
          <div className="min-w-0">
            <div className="font-bold truncate">{p.name}</div>
            <div className={'mt-1 inline-flex items-center px-2 py-0.5 text-[11px] rounded-full border ' + statusColor}>{p.status}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {typeof p.pending_count === 'number' && p.pending_count > 0 ? (
            <div className="inline-flex items-center px-2 py-0.5 text-[11px] rounded-full border border-amber-500/25 bg-amber-500/10 text-amber-200">
              Pendientes: {p.pending_count}
            </div>
          ) : null}
        </div>
        <div className="mt-3 text-xs text-slate-300 flex flex-col gap-1">
          {(p.domains || []).slice(0, 3).map((d) => (
            <a key={d} className="font-mono truncate text-slate-200 hover:text-white" href={(d.startsWith('http://') || d.startsWith('https://')) ? d : ('https://' + d)} target="_blank" rel="noreferrer">
              <span className="inline-flex items-center gap-1">
                <span className="text-slate-400">↗</span>
                <span>{d}</span>
              </span>
            </a>
          ))}
          {(p.domains || []).length > 3 ? <div className="text-slate-400">+{(p.domains || []).length - 3} más</div> : null}
        </div>
      </Card>
    </button>
  )
}


function formatMinutes(mins) {
  const m = Number(mins || 0)
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h <= 0) return `${r} min`
  if (r === 0) return `${h} h`
  return `${h} h ${r} min`
}

function makeHashColor(key) {
  const s = String(key || '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  const r = 80 + (h & 0x7f)
  const g = 80 + ((h >>> 7) & 0x7f)
  const b = 80 + ((h >>> 14) & 0x7f)
  return `rgb(${r}, ${g}, ${b})`
}

function Pie({ data, total, colors }) {
  const entries = Object.entries(data || {}).filter(([,v]) => Number(v) > 0)
  const sum = total || entries.reduce((a,[,v])=>a+Number(v||0),0)
  const cx = 64, cy = 64, r = 56
  let a0 = -Math.PI / 2

  function arcPath(aStart, aEnd) {
    const x1 = cx + r * Math.cos(aStart)
    const y1 = cy + r * Math.sin(aStart)
    const x2 = cx + r * Math.cos(aEnd)
    const y2 = cy + r * Math.sin(aEnd)
    const large = (aEnd - aStart) > Math.PI ? 1 : 0
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
  }

  return (
    <svg width={128} height={128} viewBox="0 0 128 128" className="rounded-xl bg-black/20 border border-white/10">
      {entries.length === 0 ? (
        <circle cx={cx} cy={cy} r={r} fill="rgba(255,255,255,0.06)" />
      ) : (
        entries.map(([k, v]) => {
          const frac = sum ? Number(v) / sum : 0
          const a1 = a0 + frac * Math.PI * 2
          const fill = (colors && colors[k]) || makeHashColor(k)
          const d = arcPath(a0, a1)
          a0 = a1
          return <path key={k} d={d} fill={fill} />
        })
      )}
      <circle cx={cx} cy={cy} r={28} fill="rgba(0,0,0,0.55)" />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.9)" fontSize="11" fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace">
        {formatMinutes(sum)}
      </text>
    </svg>
  )
}

export default function DashboardPage() {
  const [st, setSt] = React.useState(null)
  const [ov, setOv] = React.useState(null)
  const [err, setErr] = React.useState(null)

  const [infraProjects, setInfraProjects] = React.useState([])
  const [projectsLoading, setProjectsLoading] = React.useState(false)

  const [activitySummary, setActivitySummary] = React.useState(null)
  const [activityLoading, setActivityLoading] = React.useState(false)
  const [activityRecomputing, setActivityRecomputing] = React.useState(false)
  const [activityDay, setActivityDay] = React.useState(null)
  const [activityDayOpen, setActivityDayOpen] = React.useState(false)
  const [activityActiveDate, setActivityActiveDate] = React.useState(new Date())
  const [activeProject, setActiveProject] = React.useState(null)
  const [activeProjectMd, setActiveProjectMd] = React.useState(null)
  const [activeProjectMdLoading, setActiveProjectMdLoading] = React.useState(false)
  const [activeProjectRules, setActiveProjectRules] = React.useState(null)
  const [activeProjectRulesLoading, setActiveProjectRulesLoading] = React.useState(false)

  const [ctxFiles, setCtxFiles] = React.useState([])
  const [ctxKey, setCtxKey] = React.useState('vps')
  const [ctxText, setCtxText] = React.useState('')
  const [ctxMeta, setCtxMeta] = React.useState(null)
  const [ctxLoading, setCtxLoading] = React.useState(false)
  const [ctxSaving, setCtxSaving] = React.useState(false)
  const [ctxDirty, setCtxDirty] = React.useState(false)

  const [vpsLoading, setVpsLoading] = React.useState(false)
  const [vpsSaving, setVpsSaving] = React.useState(false)
  const [vpsDirty, setVpsDirty] = React.useState(false)
  const [vpsMeta, setVpsMeta] = React.useState(null)
  const [vpsText, setVpsText] = React.useState('')
  const [vpsModel, setVpsModel] = React.useState(parseVpsMd(''))

  async function refreshStats() {
    setErr(null)
    const r1 = await api('/api/status')
    if (r1.ok) setSt(r1.data)

    const r2 = await api('/api/system/overview')
    if (r2.ok) setOv(r2.data)
    else setErr(r2.error || 'No se pudo cargar overview')
  }

  async function refreshProjects({ showOverlay } = {}) {
    try {
      if (showOverlay) setProjectsLoading(true)
      const r3 = await api('/api/infra/projects')
      if (r3.ok) {
        const base = r3.data.projects || []
        const enriched = await Promise.all(base.map(async (proj) => {
          try {
            const rmd = await api('/api/infra/projects/' + encodeURIComponent(proj.slug) + '/md')
            if (rmd.ok) {
              const pendientes = (rmd.data && rmd.data.pendientes) ? rmd.data.pendientes : []
              return { ...proj, pending_count: pendientes.length }
            }
          } catch {}
          return proj
        }))
        setInfraProjects(enriched)
      }
    } finally {
      if (showOverlay) setProjectsLoading(false)
    }
  }

  React.useEffect(() => {
    refreshStats()
    refreshProjects({ showOverlay: false })
    ;(async () => {
      try {
        setActivityLoading(true)
        const ra = await api('/api/infra/activity/summary')
        if (ra.ok) setActivitySummary(ra.data)
      } finally {
        setActivityLoading(false)
      }
    })()
    const t = setInterval(refreshStats, 10_000)
    return () => clearInterval(t)
  }, [])

  React.useEffect(() => {
    (async () => {
      try {
        const r = await api('/api/context/files')
        if (r.ok) setCtxFiles(r.data.files || [])
      } catch {}
    })()
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
        <button className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10" onClick={async () => { await refreshStats(); await refreshProjects({ showOverlay: true }) }}>
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


      

      <Section title="Proyectos">
        <div className="relative">
                {!projectsLoading && (infraProjects || []).length === 0 ? <div className="text-sm text-slate-400">No hay proyectos registrados.</div> : null}

          {projectsLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
              <div className="text-sm text-slate-200">Cargando proyectos…</div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(infraProjects || []).map((p) => (
            <ProjectCard key={p.slug} p={p} onClick={async () => {
              setActiveProject(p)
              setActiveProjectMd(null)
              setActiveProjectRules(null)
              try {
                setActiveProjectMdLoading(true)
                const r = await api('/api/infra/projects/' + encodeURIComponent(p.slug) + '/md')
                if (r.ok) setActiveProjectMd(r.data)
                if (p.slug === 'altezza') {
                  try {
                    setActiveProjectRulesLoading(true)
                    const rr = await api('/api/infra/projects/' + encodeURIComponent(p.slug) + '/design-rules')
                    if (rr.ok) setActiveProjectRules(rr.data)
                  } finally {
                    setActiveProjectRulesLoading(false)
                  }
                }
              } finally {
                setActiveProjectMdLoading(false)
              }
            }} />
          ))}
          </div>
        </div>
      </Section>

      <Modal open={!!activeProject} onClose={() => { setActiveProject(null); setActiveProjectMd(null); setActiveProjectRules(null) }} title={activeProject ? activeProject.name : ''}>
        {!activeProject ? null : (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="text-xs feego-muted">GitHub</div>
              <div className="mt-2 text-sm">
                {activeProject.repo_url ? (
                  <a className="underline" href={activeProject.repo_url} target="_blank" rel="noreferrer">{activeProject.repo_url}</a>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-xs feego-muted">Dominios</div>
              <div className="mt-2 space-y-1">
                {(activeProject.domains || []).map((d) => (
                  <div key={d} className="font-mono text-sm">{d}</div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-xs feego-muted">Pendientes</div>
              {activeProjectMd && (activeProjectMd.pendientes || []).length ? (
                <div className="mt-2 space-y-2">
                  {(activeProjectMd.pendientes || []).map((it, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-mono text-xs text-slate-400">[{it.tag}]</span>{' '}
                      <span className="text-slate-200">{it.text}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-sm text-slate-400">—</div>
              )}
            </Card>

            <Card className="p-4">
              <div className="text-xs feego-muted">Detalle (por secciones)</div>
              {activeProjectMdLoading ? <div className="mt-2 text-sm text-slate-400">Cargando .md…</div> : null}
              {activeProjectMd && activeProjectMd.content ? (
                <div className="mt-3 space-y-2">
                  {parseMdSections(activeProjectMd.content).map((s, i) => (
                    <details key={i} className="group rounded-xl border border-white/10 bg-white/5">
                      <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between gap-3">
                        <div className="font-bold">{s.title}</div>
                        <div className="text-xs text-slate-400 group-open:hidden">Abrir</div>
                        <div className="text-xs text-slate-400 hidden group-open:block">Cerrar</div>
                      </summary>
                      <div className="px-4 pb-4">
                        <pre className="text-xs leading-5 p-3 rounded-xl bg-black/30 border border-white/10 overflow-auto whitespace-pre-wrap">{(s.body || '—').trim()}</pre>
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-sm text-slate-400">—</div>
              )}
            </Card>

            <Card className="p-4">
              <div className="text-xs feego-muted">Reglas de diseño (repo)</div>
              <div className="mt-1 text-xs text-slate-400">Fuente: checkout LAB en el VPS (cuando exista).</div>
              {activeProjectRulesLoading ? <div className="mt-2 text-sm text-slate-400">Cargando reglas…</div> : null}
              {activeProjectRules && activeProjectRules.path ? <div className="mt-2 text-xs text-slate-400 font-mono">{activeProjectRules.path}</div> : null}

              {activeProjectRules && activeProjectRules.content ? (
                <div className="mt-3 space-y-2">
                  {parseMdSections(activeProjectRules.content).map((s, i) => (
                    <details key={i} className="group rounded-xl border border-white/10 bg-white/5">
                      <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between gap-3">
                        <div className="font-bold">{s.title}</div>
                        <div className="text-xs text-slate-400 group-open:hidden">Abrir</div>
                        <div className="text-xs text-slate-400 hidden group-open:block">Cerrar</div>
                      </summary>
                      <div className="px-4 pb-4">
                        <pre className="text-xs leading-5 p-3 rounded-xl bg-black/30 border border-white/10 overflow-auto whitespace-pre-wrap">{(s.body || '—').trim()}</pre>
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-sm text-slate-400">Por definir.</div>
              )}
            </Card>
          </div>
        )}
      </Modal>


            <Section title="Actividad">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-300">
            Bitácora (chat histórico + comandos OpenClaw). Última actualización:{' '}
            <span className="font-mono text-xs text-slate-200">
              {activitySummary && activitySummary.last_computed_at ? activitySummary.last_computed_at : '—'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
              onClick={async () => {
                try {
                  setActivityLoading(true)
                  const ra = await api('/api/infra/activity/summary')
                  if (ra.ok) setActivitySummary(ra.data)
                } finally {
                  setActivityLoading(false)
                }
              }}
              disabled={activityLoading || activityRecomputing}
            >
              Refrescar
            </button>
            <button
              className="px-3 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/15 hover:bg-emerald-500/20 text-emerald-100"
              onClick={async () => {
                try {
                  setActivityRecomputing(true)
                  const rr = await api('/api/infra/activity/recompute', { method: 'POST' })
                  if (rr.ok) {
                    const ra = await api('/api/infra/activity/summary')
                    if (ra.ok) setActivitySummary(ra.data)
                  }
                } finally {
                  setActivityRecomputing(false)
                }
              }}
              disabled={activityLoading || activityRecomputing}
            >
              {activityRecomputing ? 'Actualizando…' : 'Actualizar (recalcular)'}
            </button>
          </div>
        </div>

        <div className="mt-4">
          {activityLoading ? <div className="text-sm text-slate-400">Cargando actividad…</div> : null}
          {!activityLoading && (!activitySummary || !(activitySummary.days || []).length) ? (
            <div className="text-sm text-slate-400">—</div>
          ) : null}

          {!activityLoading && activitySummary && (activitySummary.days || []).length ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-200 font-bold">
                  {activityActiveDate.toLocaleString('es-CO', { month: 'long', year: 'numeric' })}
                </div>
                <div className="text-xs text-slate-400">Semana inicia: lunes</div>
              </div>

              <div className="mt-3">
                <Calendar
                  className="feego-calendar"
                  value={activityActiveDate}
                  onActiveStartDateChange={({ activeStartDate }) => {
                    if (activeStartDate) setActivityActiveDate(activeStartDate)
                  }}
                  calendarType="iso8601"
                  showNeighboringMonth={true}
                  tileClassName={({ date, view }) => {
                    if (view !== 'month') return null
                    const day = date.toISOString().slice(0, 10)
                    const rec = (activitySummary.days || []).find((x) => x.day === day)
                    const minutes = rec ? rec.minutes_total : 0
                    // GitHub-like discrete intensity (minutes)
                    // level-0: 0
                    // level-1: 1..59
                    // level-2: 60..179
                    // level-3: 180..359
                    // level-4: 360+ (6h+)  (cap at 12h in meaning, but level stays 4)
                    let level = 0
                    if (minutes > 0 && minutes < 60) level = 1
                    else if (minutes < 180) level = 2
                    else if (minutes < 360) level = 3
                    else level = 4
                    return 'feego-cal level-' + level
                  }}
                  onClickDay={async (date) => {
                    const day = date.toISOString().slice(0, 10)
                    try {
                      const rd = await api('/api/infra/activity/day?day=' + encodeURIComponent(day))
                      if (rd.ok) {
                        setActivityDay(rd.data)
                        setActivityDayOpen(true)
                      } else {
                        setActivityDay({ day, minutes_total: 0, byProject: {}, source: 'none' })
                        setActivityDayOpen(true)
                      }
                    } catch {
                      setActivityDay({ day, minutes_total: 0, byProject: {}, source: 'none' })
                      setActivityDayOpen(true)
                    }
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
                />
              </div>
            </div>
          ) : null}
        </div>

        <Modal open={activityDayOpen} onClose={() => setActivityDayOpen(false)} title={activityDay ? 'Actividad ' + activityDay.day : 'Actividad'}>
          {!activityDay ? null : (
            <div className="space-y-4">
              <Card className="p-4">
                <div className="text-xs feego-muted">Resumen</div>
                <div className="mt-2 text-sm text-slate-200">
                  {formatMinutes(activityDay.minutes_total)} · fuente: <span className="font-mono">{activityDay.source}</span>
                </div>
              </Card>

              <Card className="p-4">
                <div className="text-xs feego-muted">Por proyecto (aprox)</div>
                <div className="mt-3 space-y-2">
                  {Object.entries(activityDay.byProject || {})
                    .sort((a, b) => (b[1] || 0) - (a[1] || 0))
                    .map(([k, v]) => {
                      const pct = activityDay.minutes_total ? Math.round((v / activityDay.minutes_total) * 100) : 0
                      return (
                        <div key={k} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-white/5 border border-white/10">
                          <div className="font-mono text-sm">{k}</div>
                          <div className="text-xs text-slate-200">{pct}% · {formatMinutes(v)}</div>
                        </div>
                      )
                    })}
                </div>
              </Card>
            </div>
          )}
        </Modal>
      </Section>

<Section title="Contexto (VPS / Proyectos)">
        <div className="text-sm text-slate-300">
          Edita los documentos de contexto del VPS por archivo (sin mezclar todo en uno).
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl border border-white/10 bg-white/5">
            <div className="text-xs feego-muted">Archivos</div>
            <div className="mt-2 space-y-1">
              {(ctxFiles || []).length === 0 ? <div className="text-xs text-slate-400">(vacío)</div> : null}
              {(ctxFiles || []).map((f) => (
                <button
                  key={f.key}
                  onClick={async () => {
                    try {
                      setErr(null)
                      setCtxKey(f.key)
                      setCtxLoading(true)
                      const r = await api('/api/context/file?key=' + encodeURIComponent(f.key))
                      if (!r.ok) throw new Error(r.data && r.data.error ? r.data.error : ('HTTP ' + r.status))
                      setCtxText(r.data.content || '')
                      setCtxMeta({ key: f.key, label: r.data.label, path: r.data.path, size: r.data.size, mtimeMs: r.data.mtimeMs })
                      setCtxDirty(false)
                    } catch (e) {
                      setErr(String(e && e.message ? e.message : e))
                    } finally {
                      setCtxLoading(false)
                    }
                  }}
                  className={
                    'w-full text-left px-3 py-2 rounded-lg border transition-colors ' +
                    (ctxKey === f.key ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-black/20 hover:bg-white/5')
                  }
                >
                  <div className="text-sm font-bold">{f.label}</div>
                  <div className="text-[11px] text-slate-400 font-mono">{f.rel}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 p-3 rounded-xl border border-white/10 bg-white/5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs feego-muted">Editor</div>
                <div className="text-[11px] text-slate-400">
                  {ctxMeta ? (
                    <span className="font-mono">{ctxMeta.path}</span>
                  ) : (
                    <span>Selecciona un archivo</span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <button
                  className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
                  onClick={async () => {
                    try {
                      setErr(null)
                      setCtxLoading(true)
                      const r = await api('/api/context/file?key=' + encodeURIComponent(ctxKey))
                      if (!r.ok) throw new Error(r.data && r.data.error ? r.data.error : ('HTTP ' + r.status))
                      setCtxText(r.data.content || '')
                      setCtxMeta({ key: ctxKey, label: r.data.label, path: r.data.path, size: r.data.size, mtimeMs: r.data.mtimeMs })
                      setCtxDirty(false)
                    } catch (e) {
                      setErr(String(e && e.message ? e.message : e))
                    } finally {
                      setCtxLoading(false)
                    }
                  }}
                  disabled={ctxLoading || ctxSaving}
                >
                  {ctxLoading ? 'Cargando…' : 'Recargar'}
                </button>

                <button
                  className="px-3 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/15 hover:bg-emerald-500/20 text-emerald-100"
                  onClick={async () => {
                    try {
                      setErr(null)
                      setCtxSaving(true)
                      const r = await api('/api/context/file?key=' + encodeURIComponent(ctxKey), {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content: ctxText }),
                      })
                      if (!r.ok) throw new Error(r.data && r.data.error ? r.data.error : ('HTTP ' + r.status))
                      setCtxMeta({ key: ctxKey, label: r.data.label, path: r.data.path, size: r.data.size, mtimeMs: r.data.mtimeMs })
                      setCtxDirty(false)
                    } catch (e) {
                      setErr(String(e && e.message ? e.message : e))
                    } finally {
                      setCtxSaving(false)
                    }
                  }}
                  disabled={ctxSaving || ctxLoading || !ctxDirty}
                >
                  {ctxSaving ? 'Guardando…' : 'Guardar'}
                </button>

                <div className="text-[11px] text-slate-400">
                  {ctxDirty ? 'cambios sin guardar' : 'ok'}
                  {ctxMeta ? ' · ' + bytesHuman(ctxMeta.size) : ''}
                </div>
              </div>
            </div>

            <div className="mt-3">
              <textarea
                value={ctxText}
                onChange={(e) => {
                  setCtxText(e.target.value)
                  setCtxDirty(true)
                }}
                className="w-full min-h-[42vh] p-3 rounded-xl bg-black/30 border border-white/10 font-mono text-xs leading-5"
                placeholder="Selecciona un archivo a la izquierda…"
                spellCheck={false}
              />
            </div>
          </div>
        </div>
      </Section>

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

      <Section title="VPS.md (runbook)">
        <div className="text-sm text-slate-300">
          Editor estructurado (acordeones por proyecto). Al guardar, se re-genera el bloque de <span className="font-mono">Status de migraciones</span> en el Markdown.
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
            onClick={async () => {
              try {
                setErr(null)
                setVpsLoading(true)
                const r = await api('/api/vps-md')
                if (!r.ok) throw new Error(r.data && r.data.error ? r.data.error : ('HTTP ' + r.status))
                setVpsMeta({ path: r.data.path, size: r.data.size, mtimeMs: r.data.mtimeMs })
                const raw = r.data.content || ''
                setVpsText(raw)
                setVpsModel(parseVpsMd(raw))
                setVpsDirty(false)
              } catch (e) {
                setErr(String(e && e.message ? e.message : e))
              } finally {
                setVpsLoading(false)
              }
            }}
            disabled={vpsLoading || vpsSaving}
          >
            {vpsLoading ? 'Cargando…' : 'Cargar'}
          </button>

          <button
            className="px-3 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/15 hover:bg-emerald-500/20 text-emerald-100"
            onClick={async () => {
              try {
                setErr(null)
                setVpsSaving(true)

                const statusBody = buildStatusSectionMd(vpsModel)
                const replaced = mdSectionReplace(vpsText, '## Status de migraciones (canonical)', statusBody)
                const nextMd = replaced || [
                  String(vpsText || '').trimEnd(),
                  '',
                  '## Status de migraciones (canonical)',
                  '',
                  statusBody,
                  '',
                ].join('\n')

                const r = await api('/api/vps-md', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ content: nextMd }),
                })
                if (!r.ok) throw new Error(r.data && r.data.error ? r.data.error : ('HTTP ' + r.status))

                setVpsMeta({ path: r.data.path, size: r.data.size, mtimeMs: r.data.mtimeMs })
                setVpsText(nextMd)
                setVpsDirty(false)
              } catch (e) {
                setErr(String(e && e.message ? e.message : e))
              } finally {
                setVpsSaving(false)
              }
            }}
            disabled={vpsSaving || vpsLoading || !vpsDirty}
          >
            {vpsSaving ? 'Guardando…' : 'Guardar'}
          </button>

          {vpsMeta ? (
            <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
              <span className="font-mono">{vpsMeta.path}</span>
              <span>·</span>
              <span>{bytesHuman(vpsMeta.size)}</span>
              <span>·</span>
              <span>{vpsMeta.mtimeMs ? new Date(vpsMeta.mtimeMs).toLocaleString() : '—'}</span>
              <span>·</span>
              <span>{vpsDirty ? 'cambios sin guardar' : 'ok'}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-4 space-y-3">
          <div className="p-4 rounded-xl border border-white/10 bg-white/5">
            <div className="text-xs feego-muted">MAKO (URLs)</div>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-400">LAB URL</div>
                <input
                  value={vpsModel?.migrated?.makoLabUrl || ''}
                  onChange={(e) => {
                    const v = e.target.value
                    setVpsModel((m) => ({ ...m, migrated: { ...m.migrated, makoLabUrl: v } }))
                    setVpsDirty(true)
                  }}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm font-mono"
                />
              </div>
              <div>
                <div className="text-xs text-slate-400">PROD URL</div>
                <input
                  value={vpsModel?.migrated?.makoProdUrl || ''}
                  onChange={(e) => {
                    const v = e.target.value
                    setVpsModel((m) => ({ ...m, migrated: { ...m.migrated, makoProdUrl: v } }))
                    setVpsDirty(true)
                  }}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm font-mono"
                />
              </div>
            </div>
          </div>

          <details className="group p-4 rounded-xl border border-white/10 bg-white/5">
            <summary className="cursor-pointer select-none flex items-center justify-between">
              <div>
                <div className="font-bold">Mievento</div>
                <div className="text-xs text-slate-400">LAB backend/puerto + proxy PROD</div>
              </div>
              <div className="text-xs text-slate-400 group-open:hidden">Abrir</div>
              <div className="text-xs text-slate-400 hidden group-open:block">Cerrar</div>
            </summary>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-400">LAB backend</div>
                <input value={vpsModel?.mievento?.labBackendName || ''} onChange={(e)=>{const v=e.target.value; setVpsModel(m=>({...m, mievento:{...m.mievento, labBackendName:v}})); setVpsDirty(true)}} className="mt-1 w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm font-mono" />
              </div>
              <div>
                <div className="text-xs text-slate-400">LAB puerto</div>
                <input value={vpsModel?.mievento?.labPort || ''} onChange={(e)=>{const v=e.target.value; setVpsModel(m=>({...m, mievento:{...m.mievento, labPort:v}})); setVpsDirty(true)}} className="mt-1 w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm font-mono" />
              </div>
              <div className="md:col-span-2">
                <div className="text-xs text-slate-400">PROD proxy URL</div>
                <input value={vpsModel?.mievento?.prodProxyUrl || ''} onChange={(e)=>{const v=e.target.value; setVpsModel(m=>({...m, mievento:{...m.mievento, prodProxyUrl:v}})); setVpsDirty(true)}} className="mt-1 w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm font-mono" />
              </div>
            </div>
          </details>

          <details className="group p-4 rounded-xl border border-white/10 bg-white/5">
            <summary className="cursor-pointer select-none flex items-center justify-between">
              <div>
                <div className="font-bold">SISPROIND</div>
                <div className="text-xs text-slate-400">Puertos, DB y data roots</div>
              </div>
              <div className="text-xs text-slate-400 group-open:hidden">Abrir</div>
              <div className="text-xs text-slate-400 hidden group-open:block">Cerrar</div>
            </summary>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-400">PROD puerto</div>
                <input value={vpsModel?.sisproind?.prodPort || ''} onChange={(e)=>{const v=e.target.value; setVpsModel(m=>({...m, sisproind:{...m.sisproind, prodPort:v}})); setVpsDirty(true)}} className="mt-1 w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm font-mono" />
              </div>
              <div>
                <div className="text-xs text-slate-400">PROD DB</div>
                <input value={vpsModel?.sisproind?.prodDb || ''} onChange={(e)=>{const v=e.target.value; setVpsModel(m=>({...m, sisproind:{...m.sisproind, prodDb:v}})); setVpsDirty(true)}} className="mt-1 w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm font-mono" />
              </div>
              <div className="md:col-span-2">
                <div className="text-xs text-slate-400">PROD data root</div>
                <input value={vpsModel?.sisproind?.prodDataRoot || ''} onChange={(e)=>{const v=e.target.value; setVpsModel(m=>({...m, sisproind:{...m.sisproind, prodDataRoot:v}})); setVpsDirty(true)}} className="mt-1 w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm font-mono" />
              </div>
              <div>
                <div className="text-xs text-slate-400">LAB puerto</div>
                <input value={vpsModel?.sisproind?.labPort || ''} onChange={(e)=>{const v=e.target.value; setVpsModel(m=>({...m, sisproind:{...m.sisproind, labPort:v}})); setVpsDirty(true)}} className="mt-1 w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm font-mono" />
              </div>
              <div>
                <div className="text-xs text-slate-400">LAB DB</div>
                <input value={vpsModel?.sisproind?.labDb || ''} onChange={(e)=>{const v=e.target.value; setVpsModel(m=>({...m, sisproind:{...m.sisproind, labDb:v}})); setVpsDirty(true)}} className="mt-1 w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm font-mono" />
              </div>
              <div className="md:col-span-2">
                <div className="text-xs text-slate-400">LAB data root</div>
                <input value={vpsModel?.sisproind?.labDataRoot || ''} onChange={(e)=>{const v=e.target.value; setVpsModel(m=>({...m, sisproind:{...m.sisproind, labDataRoot:v}})); setVpsDirty(true)}} className="mt-1 w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm font-mono" />
              </div>
            </div>
          </details>

          <details className="group p-4 rounded-xl border border-white/10 bg-white/5">
            <summary className="cursor-pointer select-none flex items-center justify-between">
              <div>
                <div className="font-bold">MAKO (puertos + nota)</div>
                <div className="text-xs text-slate-400">Backend/front + texto de nota</div>
              </div>
              <div className="text-xs text-slate-400 group-open:hidden">Abrir</div>
              <div className="text-xs text-slate-400 hidden group-open:block">Cerrar</div>
            </summary>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-400">Backend LAB puerto</div>
                <input value={vpsModel?.mako?.backendLabPort || ''} onChange={(e)=>{const v=e.target.value; setVpsModel(m=>({...m, mako:{...m.mako, backendLabPort:v}})); setVpsDirty(true)}} className="mt-1 w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm font-mono" />
              </div>
              <div>
                <div className="text-xs text-slate-400">Backend PROD puerto</div>
                <input value={vpsModel?.mako?.backendProdPort || ''} onChange={(e)=>{const v=e.target.value; setVpsModel(m=>({...m, mako:{...m.mako, backendProdPort:v}})); setVpsDirty(true)}} className="mt-1 w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm font-mono" />
              </div>
              <div>
                <div className="text-xs text-slate-400">Front LAB puerto</div>
                <input value={vpsModel?.mako?.frontLabPort || ''} onChange={(e)=>{const v=e.target.value; setVpsModel(m=>({...m, mako:{...m.mako, frontLabPort:v}})); setVpsDirty(true)}} className="mt-1 w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm font-mono" />
              </div>
              <div>
                <div className="text-xs text-slate-400">Front PROD puerto</div>
                <input value={vpsModel?.mako?.frontProdPort || ''} onChange={(e)=>{const v=e.target.value; setVpsModel(m=>({...m, mako:{...m.mako, frontProdPort:v}})); setVpsDirty(true)}} className="mt-1 w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm font-mono" />
              </div>
              <div className="md:col-span-2">
                <div className="text-xs text-slate-400">Nota</div>
                <textarea value={vpsModel?.mako?.notes || ''} onChange={(e)=>{const v=e.target.value; setVpsModel(m=>({...m, mako:{...m.mako, notes:v}})); setVpsDirty(true)}} className="mt-1 w-full min-h-[90px] px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm" />
              </div>
            </div>
          </details>

          <details className="group p-4 rounded-xl border border-white/10 bg-white/5">
            <summary className="cursor-pointer select-none flex items-center justify-between">
              <div>
                <div className="font-bold">Raw Markdown</div>
                <div className="text-xs text-slate-400">Vista previa del archivo</div>
              </div>
              <div className="text-xs text-slate-400 group-open:hidden">Abrir</div>
              <div className="text-xs text-slate-400 hidden group-open:block">Cerrar</div>
            </summary>
            <div className="mt-3">
              <Pre text={vpsText || '—'} />
            </div>
          </details>
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
