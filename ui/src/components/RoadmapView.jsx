import React from 'react'
import * as Icons from 'lucide-react'
import { useSearchParams, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Plus, RefreshCw, Settings2, Pencil, Play, Folder, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { metrics, sectionGroups, taskState, progressValue, formatProgress } from '../lib/roadmap.mjs'
import { ProgressBar } from './ProgressControl'
import { Button, Input } from './ui'
import './RoadmapView.scss'
import TaskStatus from './TaskStatus'
import RoadmapTaskList from './RoadmapTaskList'
import ProjectOrderDialog from './ProjectOrderDialog'
import ArchivedTasksDialog from './ArchivedTasksDialog'

function ProjectLogo({ project, className = '' }) {
  const [failed, setFailed] = React.useState(false)
  React.useEffect(() => setFailed(false), [project.logo_path])
  return <span className={`roadmap-logo ${className}`}>{project.logo_path && !failed
    ? <img src={`/api/kanban/project/logo?name=${encodeURIComponent(project.logo_path)}`} alt="" onError={() => setFailed(true)} />
    : <Folder size={22} aria-hidden="true" />}</span>
}
function Counts({ data }) {
  return <dl className="roadmap-counts">{[['Tareas', data.total], ['Pendientes', data.todo], ['En proceso', data.doing], ['Completadas', data.done]].map(([label, value]) => <div key={label}><dd>{value}</dd><dt>{label}</dt></div>)}</dl>
}

export default function RoadmapView({ state, loading, error, refresh, onNewProject, onEditProject, onNewCard, onEditCard }) {
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('project')
  const projects = state.cards.some(c => c.project_id == null)
    ? [...state.projects, { id: 'unassigned', name: 'Sin proyecto', virtual: true }] : state.projects
  const belongs = (card, id) => id === 'unassigned' ? card.project_id == null : String(card.project_id) === String(id)
  const project = projects.find(p => String(p.id) === selectedId)
  const [archiveOpen, setArchiveOpen] = React.useState(false)
  const [orderOpen, setOrderOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [busy, setBusy] = React.useState({})
  const busyRef = React.useRef(new Set())
  const projectCards = state.cards.filter(c => belongs(c, selectedId) && c.board !== 'archived')
  const summary = metrics(projectCards)
  const sections = state.sections.filter(s => String(s.project_id) === selectedId)
  const groups = sectionGroups(projectCards, sections)
  async function archiveTask(card) {
    if (busyRef.current.has(card.id) || taskState(card) !== 'done') return
    busyRef.current.add(card.id)
    setBusy(b => ({ ...b, [card.id]: true }))
    try {
      const r = await api('/api/kanban/move', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: card.id, board: 'archived', status: 'n/a' }),
      })
      if (!r.ok || !r.data?.ok) throw new Error('No se pudo archivar la tarea')
      await refresh()
      toast.success('Tarea archivada')
    } catch (e) { toast.error(e.message || 'No se pudo conectar con el servidor') }
    finally { busyRef.current.delete(card.id); setBusy(b => ({ ...b, [card.id]: false })) }
  }
  async function sendToKanban(card) {
    if (busyRef.current.has(card.id) || taskState(card) !== 'todo' || (card.board === 'kanban' && card.status === 'todo')) return
    busyRef.current.add(card.id)
    setBusy(b => ({ ...b, [card.id]: true }))
    try {
      const r = await api('/api/kanban/move', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: card.id, board: 'kanban', status: 'todo', progress_pct: 0 }),
      })
      if (!r.ok || !r.data?.ok) throw new Error('No se pudo pasar la tarea a Kanban')
      await refresh()
      toast.success('Tarea enviada a Kanban')
    } catch (e) { toast.error(e.message || 'No se pudo conectar con el servidor') }
    finally { busyRef.current.delete(card.id); setBusy(b => ({ ...b, [card.id]: false })) }
  }
  return <section className="roadmap" aria-label="Roadmap">
    <header className="roadmap-toolbar">
      <div className="flex items-center gap-3 min-w-0">
        {selectedId && <Button variant="ghost" aria-label="Volver a proyectos" onClick={() => { setParams({}); setQuery('') }}><ArrowLeft size={18} /></Button>}
        {project && <ProjectLogo project={project} className="roadmap-header-logo" />}
        <div className="roadmap-heading-text"><div className="roadmap-eyebrow">PLANIFICACIÓN POR PROYECTO</div><h1>{project?.name || 'Roadmap'}</h1></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={refresh} disabled={loading} title="Refrescar" aria-label="Refrescar"><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></Button>
        {!selectedId && <Button variant="outline" title="Ordenar proyectos" aria-label="Ordenar proyectos" disabled={loading || !state.projects.length} onClick={() => setOrderOpen(true)}><Icons.ListOrdered size={18} /></Button>}
        {project ? <>
          {!project.virtual && <Button variant="outline" onClick={() => onEditProject(project)}><Settings2 size={17} />Proyecto y secciones</Button>}
          <Button onClick={() => onNewCard(project.virtual ? null : project.id)}><Plus size={17} />Nueva tarea</Button>
        </> : <Button onClick={onNewProject}><Plus size={17} />Nuevo proyecto</Button>}
      </div>
    </header>
    <ProjectOrderDialog open={orderOpen} onOpenChange={setOrderOpen} projects={state.projects} refresh={refresh} />
    {error && <div className="roadmap-error" role="alert">{error} <Button variant="ghost" onClick={refresh}>Reintentar</Button></div>}
    {loading && !state.projects.length && <p role="status">Cargando proyectos…</p>}
    {selectedId && !project && !loading && <div className="roadmap-empty">Este proyecto no está disponible. <Button variant="outline" onClick={() => setParams({})}>Ver proyectos</Button></div>}
    {!selectedId && <>
      <label className="roadmap-search"><Search size={18} /><Input aria-label="Buscar proyecto" placeholder="Buscar proyecto" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <div className="roadmap-grid">{projects.filter(p => p.name.toLowerCase().includes(query.toLowerCase())).map(p => {
        const cards = state.cards.filter(c => belongs(c, p.id))
        const data = metrics(cards)
        const projectSections = sectionGroups(cards, state.sections.filter(s => Number(s.project_id) === Number(p.id))).filter(s => s.cards.length)
        return <button className="roadmap-project" key={p.id} onClick={() => { setParams({ project: String(p.id) }); setQuery('') }}>
          <div className="roadmap-project-heading"><ProjectLogo project={p} /><h2>{p.name}</h2>{[1,2,3].includes(p.priority) && <span className="roadmap-task-priority" data-priority={p.priority} title={`Prioridad ${p.priority === 1 ? 'alta' : p.priority === 2 ? 'media' : 'baja'}`}>{p.priority === 1 ? <Icons.Flame size={17} /> : p.priority === 2 ? <Icons.Sparkles size={17} /> : <Icons.Leaf size={17} />}</span>}<ArrowRight size={18} /></div>
          <div className="roadmap-progress-heading"><strong>{formatProgress(data.progress)}</strong><span>{data.total ? 'Avance general' : 'Sin tareas'}</span></div>
          <ProgressBar value={data.progress} label={`Progreso de ${p.name}`} /><Counts data={data} />
          <div className="roadmap-section-summary">{projectSections.slice(0, 3).map(s => { const SectionIcon = Icons[s.icon] || Icons.Tag; return <span key={s.id}><span className="roadmap-section-summary-name"><SectionIcon size={14} aria-hidden="true" /><span>{s.name}</span></span><b>{s.cards.length} · {formatProgress(metrics(s.cards).progress)}</b></span> })}{projectSections.length > 3 && <small>+{projectSections.length - 3} secciones</small>}</div>
        </button>
      })}</div>
      {!loading && !state.projects.length && <div className="roadmap-empty">Todavía no hay proyectos. Crea el primero para organizar tus tareas.</div>}
    </>}
    {project && <>
      <div className="roadmap-overview">
        <div><div className="roadmap-eyebrow">AVANCE GENERAL</div><strong className="roadmap-big-progress">{formatProgress(summary.progress)}</strong><ProgressBar value={summary.progress} /><Counts data={summary} /></div>
        <div className="roadmap-week"><div className="roadmap-eyebrow">ÚLTIMOS 7 DÍAS</div><strong>{summary.touched ? formatProgress(summary.weekly) : '—'}</strong><p>{summary.touched ? 'Promedio de tareas actualizadas · 7 días' : 'Sin actividad · 7 días'}</p><span>{summary.touched} {summary.touched === 1 ? 'tarea actualizada' : 'tareas actualizadas'}</span></div>
      </div>
      <div className="roadmap-toolbar"><h2>Tareas por sección</h2><label className="roadmap-search"><Search size={18} /><Input aria-label="Buscar tarea" placeholder="Buscar tarea" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
      {groups.filter(g => g.id !== 'none' || g.cards.length).map(group => {
        const visible = group.cards.filter(c => c.title.toLowerCase().includes(query.toLowerCase()))
        if (query && !visible.length) return null
        const SectionIcon = Icons[group.icon] || Icons.Tag
        return <section className="roadmap-section" key={group.id} aria-label={group.name}>
          <header><h3><SectionIcon size={18} aria-hidden="true" />{group.name}</h3><span>{group.cards.length} {group.cards.length === 1 ? 'tarea' : 'tareas'} · {formatProgress(metrics(group.cards).progress)}</span></header>
          {!visible.length && <p className="roadmap-empty">Sin tareas en esta sección</p>}
          <RoadmapTaskList cards={group.cards} sectionId={group.id} projectId={project.virtual ? null : project.id} query={query} refresh={refresh} renderCard={card => {
            const value = progressValue(card.progress_pct)
            const priority = { 1: { Icon: Icons.Flame, label: 'Alta' }, 2: { Icon: Icons.Sparkles, label: 'Media' }, 3: { Icon: Icons.Leaf, label: 'Baja' } }[card.priority]
            return <div className="roadmap-task" key={card.id}>
              <div className="min-w-0"><button className="roadmap-task-title" onClick={() => onEditCard(card)}>{card.title}</button><div className="roadmap-task-meta"><TaskStatus state={taskState(card)} />{card.board === 'ideas' && <span>Planificación</span>}{card.due_at && <time dateTime={card.due_at}>{new Date(card.due_at).toLocaleDateString('es-CO')}</time>}</div></div>
              <span className="roadmap-task-priority" data-priority={card.priority} title={priority ? `Prioridad ${priority.label.toLowerCase()}` : undefined}>{priority && <priority.Icon size={18} role="img" aria-label={`Prioridad ${priority.label.toLowerCase()}`} />}</span>
              <div className="roadmap-task-progress" aria-label={`Avance de ${card.title}: ${value}%`}><span>{formatProgress(value)}</span><ProgressBar value={value} label={`Progreso de ${card.title}`} /></div>
              <div className="roadmap-task-actions">
                {taskState(card) === 'done' && <Button variant="outline" aria-label={`Archivar ${card.title}`} title="Archivar tarea" disabled={busy[card.id]} onClick={() => archiveTask(card)}><Icons.Archive size={17} /></Button>}
                {taskState(card) === 'todo' && <Button variant="outline" aria-label={`${card.board === 'kanban' && card.status === 'todo' ? 'Ya está en Por hacer' : 'Pasar a Por hacer en Kanban'}: ${card.title}`} title={card.board === 'kanban' && card.status === 'todo' ? 'Ya está en Por hacer de Kanban' : 'Pasar a Por hacer en Kanban'} disabled={busy[card.id] || (card.board === 'kanban' && card.status === 'todo')} onClick={() => sendToKanban(card)}><Play size={17} /></Button>}
                <Button variant="ghost" aria-label={`Editar ${card.title}`} title="Editar tarea" onClick={() => onEditCard(card)}><Pencil size={17} /></Button>
              </div>
            </div>
          }} />
        </section>
      })}
      {!projectCards.length && <div className="roadmap-empty">Sin tareas. Agrega la primera con Nueva tarea.</div>}
      <footer className="roadmap-project-footer"><Button variant="outline" onClick={() => setArchiveOpen(true)}><Icons.Archive size={17} />Tareas archivadas</Button><Link className="feego-btn feego-btn-outline" to="/kanban"><Icons.Columns3 size={17} />Abrir Kanban</Link></footer>
      <ArchivedTasksDialog open={archiveOpen} onOpenChange={setArchiveOpen} project={project} cards={state.cards.filter(c=>belongs(c,selectedId))} sections={sections} refresh={refresh} onEditCard={onEditCard} />
    </>}
  </section>
}
