import TaskWorkTimer from './TaskWorkTimer'
import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Icons from 'lucide-react'
import { Button, Input } from './ui'
import { ProgressBar } from './ProgressControl'
import { archivedSectionGroups, progressValue, formatProgress } from '../lib/roadmap.mjs'
import { api } from '../lib/api'
import './ArchivedTasksDialog.scss'
export default function ArchivedTasksDialog({ open, onOpenChange, project, cards, sections, refresh, onEditCard }) {
  const [query,setQuery]=React.useState('')
  const [busy,setBusy]=React.useState(null)
  const lock=React.useRef(false)
  const [error,setError]=React.useState('')
  React.useEffect(()=>{if(open){setQuery('');setError('')}},[open])
  const archived=cards.filter(c=>c.board==='archived')
  const groups=archivedSectionGroups(archived,sections).map(g=>({...g,cards:g.cards.filter(c=>c.title.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>(a.sort||0)-(b.sort||0)||a.id-b.id)})).filter(g=>g.cards.length)
  async function restore(card) {
    if(lock.current)return
    lock.current=true;setBusy(card.id);setError('')
    try {const r=await api('/api/kanban/move',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:card.id,board:'ideas',status:'n/a'})});if(!r.ok||!r.data?.ok)throw Error('No se pudo restaurar la tarea. Intenta de nuevo.');await refresh()}
    catch(e){setError(e.message || 'Error de conexión')}
    finally{setBusy(null);lock.current=false}
  }
  return <Dialog.Root open={open} onOpenChange={v=>{if(!busy)onOpenChange(v)}}><Dialog.Portal><Dialog.Overlay className="feego-overlay archived-tasks-overlay" /><Dialog.Content className="feego-modal archived-tasks-dialog">
    <header className="archived-tasks-header"><span className="archived-tasks-emblem"><Icons.Archive size={23} /></span><div><Dialog.Title>Tareas archivadas</Dialog.Title><Dialog.Description>{project.name} · {archived.length} {archived.length===1?'tarea':'tareas'}</Dialog.Description></div><Dialog.Close asChild><Button variant="ghost" disabled={!!busy} aria-label="Cerrar tareas archivadas"><Icons.X size={19} /></Button></Dialog.Close></header>
    <div className="archived-tasks-body"><label className="archived-tasks-search"><Icons.Search size={17} /><Input aria-label="Buscar tarea archivada" placeholder="Buscar tarea" value={query} onChange={e=>setQuery(e.target.value)} /></label>{error && <p role="alert" className="archived-tasks-error">{error}</p>}
    {groups.map(group=>{const Icon=Icons[group.icon] || Icons.Tag;return <section key={group.id} className="archived-tasks-section" aria-label={group.name}><h3><Icon size={17} />{group.name}<span>{group.cards.length}</span></h3>{group.cards.map(card=><div key={card.id} className="archived-task-row"><div><button className="archived-task-title" disabled={!!busy} onClick={()=>{onOpenChange(false);onEditCard(card)}}>{card.title}</button><span className="archived-task-meta"><Icons.Archive size={12} />Archivada{card.due_at && <time dateTime={card.due_at}>{new Date(card.due_at).toLocaleDateString('es-CO')}</time>}</span><TaskWorkTimer card={card} /></div><div className="archived-task-progress"><span>{formatProgress(progressValue(card.progress_pct))}</span><ProgressBar value={progressValue(card.progress_pct)} /></div><div className="archived-task-actions"><Button variant="ghost" title="Editar tarea" aria-label={`Editar archivada ${card.title}`} disabled={!!busy} onClick={()=>{onOpenChange(false);onEditCard(card)}}><Icons.Pencil size={16} /></Button><Button variant="outline" title="Devolver a Roadmap" aria-label={`Restaurar ${card.title} a Roadmap`} disabled={!!busy} onClick={()=>restore(card)}>{busy===card.id ? <Icons.LoaderCircle size={16} className="animate-spin" /> : <Icons.ArchiveRestore size={16} />}</Button></div></div>)}</section>})}
    {!groups.length && <div className="archived-tasks-empty"><Icons.Archive size={30} /><p>{query ? 'No hay tareas que coincidan con la búsqueda.' : 'No hay tareas archivadas en este proyecto.'}</p></div>}</div>
    <footer><Button variant="outline" disabled={!!busy} onClick={()=>onOpenChange(false)}>Cerrar</Button></footer>
  </Dialog.Content></Dialog.Portal></Dialog.Root>
}
