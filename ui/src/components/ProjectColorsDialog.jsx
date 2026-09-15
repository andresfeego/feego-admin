import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Palette, X, Check, RotateCcw } from 'lucide-react'
import { api } from '../lib/api'
import { Button } from './ui'
import '../pages/AdminPages.scss'

function ProjectColorLogo({ project }) {
  const [failed, setFailed] = React.useState(false)
  return project.logo_url && !failed ? <img src={project.logo_url} alt="" onError={() => setFailed(true)} /> : (project.name || project.slug).slice(0, 1).toUpperCase()
}

export default function ProjectColorsDialog({ open, onOpenChange, onSaved }) {
  const [projects, setProjects] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(null)
  const [message, setMessage] = React.useState('')
  const [error, setError] = React.useState('')
  React.useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true); setError(''); setMessage(''); setProjects([])
    api('/api/infra/projects').then(r => {
      if (!active) return
      if (!r.ok) throw new Error('No se pudieron cargar los proyectos.')
      setProjects((r.data.projects || []).map(p => ({ ...p, color_hex: p.color_hex || '' })))
    }).catch(() => { if (active) setError('No se pudieron cargar los proyectos. Cierra y vuelve a abrir para reintentar.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [open])
  function change(slug, color) { setProjects(rows => rows.map(p => p.slug === slug ? { ...p, color_hex: color } : p)) }
  async function save(project) {
    if (saving) return
    const raw = project.color_hex.trim()
    const color = raw ? '#' + raw.replace(/^#/, '') : null
    setError(''); setMessage('')
    if (color && !/^#[\da-f]{6}$/i.test(color)) { setError('Usa un color hexadecimal de seis caracteres, como #2563EB.'); return }
    setSaving(project.slug)
    try {
      const r = await api('/api/infra/projects/' + encodeURIComponent(project.slug), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ color_hex: color }) })
      if (!r.ok) throw new Error()
      change(project.slug, color || '')
      setMessage(`Color de ${project.name || project.slug} guardado.`)
      await onSaved?.()
    } catch { setError('No se pudo guardar el color. Intenta de nuevo.') }
    finally { setSaving(null) }
  }
  return <Dialog.Root open={open} onOpenChange={next => { if (!saving) onOpenChange(next) }}><Dialog.Portal>
    <Dialog.Overlay className="ops-dialog-overlay" />
    <Dialog.Content className="ops-dialog">
      <header><span className="ops-heading-icon"><Palette size={23} /></span><div><Dialog.Title>Configuración de Dashboard VPS</Dialog.Title><Dialog.Description>Colores de proyectos para actividad y analíticas.</Dialog.Description></div><Dialog.Close asChild><Button variant="ghost" aria-label="Cerrar configuración" disabled={!!saving}><X size={19} /></Button></Dialog.Close></header>
      <div className="ops-dialog-body">
        {loading && <p role="status" className="ops-muted">Cargando proyectos…</p>}
        {!loading && !error && !projects.length && <p className="ops-empty">No hay proyectos registrados.</p>}
        <fieldset disabled={!!saving} className="project-colors-list">{projects.map(p => <div className="project-color-row" key={p.slug}>
          <span className="project-color-avatar" style={{ borderColor: /^#[\da-f]{6}$/i.test(p.color_hex) ? p.color_hex : undefined }}>{<ProjectColorLogo project={p} />}</span>
          <div className="project-color-name"><strong>{p.name || p.slug}</strong><small>{p.slug}</small></div>
          <div className="project-color-controls"><input type="color" aria-label={`Color de ${p.name}`} value={/^#[\da-f]{6}$/i.test(p.color_hex) ? p.color_hex : '#2563eb'} onChange={e => change(p.slug, e.target.value)} />
          <input className="feego-input" aria-label={`Código de color de ${p.name}`} placeholder="Automático" value={p.color_hex} onChange={e => change(p.slug, e.target.value)} maxLength={7} spellCheck={false} />
          <Button variant="ghost" title="Usar color automático" aria-label={`Color automático para ${p.name}`} onClick={() => change(p.slug, '')}><RotateCcw size={16} /></Button>
          <Button variant="outline" onClick={() => save(p)}><Check size={16} />{saving === p.slug ? 'Guardando…' : 'Guardar'}</Button></div>
        </div>)}</fieldset>
        {error && <p role="alert" className="ops-danger mt-4">{error}</p>}{message && <p role="status" className="ops-success mt-4">{message}</p>}
      </div><footer><Dialog.Close asChild><Button variant="outline" disabled={!!saving}>Listo</Button></Dialog.Close></footer>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>
}
