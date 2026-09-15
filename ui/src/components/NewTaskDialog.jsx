import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Icons from 'lucide-react'
import { api } from '../lib/api'
import { Button, Input, Textarea } from './ui'
import './NewTaskDialog.scss'
import Logo from './TaskProjectLogo'

function localDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const priorities = [{ value: 1, name: 'Alta', Icon: Icons.Flame }, { value: 2, name: 'Media', Icon: Icons.Sparkles }, { value: 3, name: 'Baja', Icon: Icons.Leaf }]
export default function NewTaskDialog({ open, onOpenChange, task, setTask, projects, sections, onCreated }) {
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')
  const savingRef = React.useRef(false)
  React.useEffect(() => { if (open) setError('') }, [open])
  const available = sections.filter(s => Number(s.project_id) === Number(task.project_id))
  const selected = task.section_ids || []
  async function submit(e) {
    e.preventDefault()
    if (savingRef.current || !task.title.trim()) return
    savingRef.current = true; setSaving(true); setError('')
    try {
      const r = await api('/api/kanban/card', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...task, title: task.title.trim(), section_id: selected[0] || null, section_ids: selected, board: 'ideas', status: 'n/a', progress_pct: 0 }) })
      if (!r.ok || !r.data?.ok) throw Error('No se pudo crear la tarea. Revisa los datos e intenta de nuevo.')
      onOpenChange(false)
      await onCreated()
    } catch (e) { setError(e.message || 'No se pudo conectar con el servidor') }
    finally { savingRef.current = false; setSaving(false) }
  }
  return <Dialog.Root open={open} onOpenChange={value => { if (!saving) onOpenChange(value) }}><Dialog.Portal>
    <Dialog.Overlay className="feego-overlay new-task-overlay" />
    <Dialog.Content className="feego-modal new-task-modal">
      <form onSubmit={submit}>
        <header className="new-task-header"><span className="new-task-heading-icon"><Icons.ListPlus size={24} /></span><div><Dialog.Title>Nueva tarea</Dialog.Title><Dialog.Description>Organiza el próximo paso de tu proyecto.</Dialog.Description></div><Dialog.Close asChild><Button variant="ghost" type="button" disabled={saving} aria-label="Cerrar nueva tarea"><Icons.X size={19} /></Button></Dialog.Close></header>
        <div className="new-task-body"><fieldset disabled={saving}>
          <label className="new-task-label" htmlFor="new-task-title">Título</label><Input id="new-task-title" className="new-task-title" placeholder="¿Qué vamos a hacer?" value={task.title} onChange={e => setTask(t => ({ ...t, title: e.target.value }))} required maxLength={255} />
          <section><h3><Icons.Folders size={16} />Proyecto</h3><div className="new-task-projects" role="group" aria-label="Proyecto">
            {[...projects, { id: null, name: 'Sin proyecto' }].map(p => <button type="button" key={p.id || 'none'} className="new-task-project" aria-pressed={task.project_id === p.id} onClick={() => setTask(t => ({ ...t, project_id: p.id, section_id: null, section_ids: [] }))}>
              <span className="new-task-project-logo"><Logo project={p} /></span><span>{p.name}</span><Icons.Check size={15} className="new-task-selection" />
            </button>)}
          </div></section>
          <section className="new-task-date"><label className="new-task-label" htmlFor="new-task-date"><Icons.CalendarDays size={16} />Fecha límite <span>Opcional</span></label><Input id="new-task-date" type="datetime-local" value={localDate(task.due_at)} onChange={e => setTask(t => ({ ...t, due_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} /></section>
          <section><h3><Icons.Tags size={16} />Secciones <span>Opcional · puedes elegir varias</span></h3><div className="new-task-badges" role="group" aria-label="Secciones">
            <button type="button" className="new-task-badge" aria-pressed={!selected.length} onClick={() => setTask(t => ({ ...t, section_id: null, section_ids: [] }))}><Icons.Minus size={14} />Sin sección</button>
            {available.map(s => { const Icon = Icons[s.icon] || Icons.Tag; const checked = selected.includes(s.id); return <button type="button" className="new-task-badge" key={s.id} aria-pressed={checked} onClick={() => setTask(t => { const ids = checked ? selected.filter(id => id !== s.id) : [...selected, s.id]; return { ...t, section_id: ids[0] || null, section_ids: ids } })}><Icon size={14} /><span>{s.name}</span>{checked && <Icons.Check size={13} />}</button> })}
          </div></section>
          <section><h3><Icons.Flag size={16} />Prioridad</h3><div className="new-task-priorities" role="group" aria-label="Prioridad">{priorities.map(({value, name, Icon}) => <button key={value} type="button" className="new-task-badge" data-priority={value} aria-pressed={task.priority === value} onClick={() => setTask(t => ({ ...t, priority: value }))}><Icon size={16} />{name}</button>)}</div></section>

          <label className="new-task-label" htmlFor="new-task-notes"><Icons.AlignLeft size={16} />Notas <span>Opcional</span></label><Textarea id="new-task-notes" rows={3} placeholder="Detalles, contexto o próximos pasos…" value={task.notes || ''} onChange={e => setTask(t => ({ ...t, notes: e.target.value }))} />
        </fieldset>{error && <p className="new-task-error" role="alert">{error}</p>}</div>
        <footer className="new-task-footer"><span><Icons.CircleDashed size={15} />Se agrega a Roadmap</span><Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={saving || !task.title.trim()}><Icons.Plus size={17} />{saving ? 'Creando…' : 'Crear tarea'}</Button></footer>
      </form>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>
}
