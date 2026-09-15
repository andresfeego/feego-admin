import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ListOrdered, Check, X, Folder } from 'lucide-react'
import { Button } from './ui'
import { api } from '../lib/api'
import './ProjectOrderDialog.scss'
function ProjectRow({ project, index, disabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id, disabled })
  const [failed, setFailed] = React.useState(false)
  return <li ref={setNodeRef} className={`project-order-row${isDragging ? ' is-dragging' : ''}`} style={{transform:CSS.Transform.toString(transform),transition}}><button type="button" className="project-order-grip" {...attributes} {...listeners} aria-label={`Ordenar ${project.name}`} disabled={disabled}><GripVertical size={20} /></button><span className="project-order-number">{index + 1}</span><span className="roadmap-logo">{project.logo_path && !failed ? <img src={`/api/kanban/project/logo?name=${encodeURIComponent(project.logo_path)}`} alt="" onError={() => setFailed(true)} /> : <Folder size={20} />}</span><strong>{project.name}</strong></li>
}
export default function ProjectOrderDialog({ open, onOpenChange, projects, refresh }) {
  const [draft, setDraft] = React.useState([])
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')
  const lock = React.useRef(false)
  const sensors = useSensors(useSensor(PointerSensor,{activationConstraint:{distance:6}}),useSensor(KeyboardSensor,{coordinateGetter:sortableKeyboardCoordinates}))
  React.useEffect(() => { if(open){setDraft(projects);setError('')} }, [open])
  async function save() {
    if(lock.current)return
    lock.current=true;setSaving(true);setError('')
    try {
      const r=await api('/api/kanban/projects/reorder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ordered_ids:draft.map(p=>p.id)})})
      if(!r.ok || !r.data?.ok)throw Error(r.status===409 ? 'Los proyectos cambiaron. Cierra, actualiza y vuelve a ordenar.' : 'No se pudo guardar el orden. Intenta de nuevo.')
      await refresh();onOpenChange(false)
    }catch(e){setError(e.message || 'No se pudo conectar con el servidor')}
    finally{lock.current=false;setSaving(false)}
  }
  return <Dialog.Root open={open} onOpenChange={v=>{if(!saving)onOpenChange(v)}}><Dialog.Portal><Dialog.Overlay className="feego-overlay project-order-overlay" /><Dialog.Content className="feego-modal project-order-dialog">
    <header><span className="project-order-emblem"><ListOrdered size={23} /></span><div><Dialog.Title>Ordenar proyectos</Dialog.Title><Dialog.Description>Arrastra desde el asa para cambiar la posición.</Dialog.Description></div><Dialog.Close asChild><Button type="button" variant="ghost" disabled={saving} aria-label="Cerrar orden de proyectos"><X size={18} /></Button></Dialog.Close></header>
    <div className="project-order-body"><DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({active,over})=>{if(!over || saving)return;setDraft(list=>{const from=list.findIndex(p=>p.id===active.id),to=list.findIndex(p=>p.id===over.id);return from<0||to<0?list:arrayMove(list,from,to)})}}><SortableContext items={draft.map(p=>p.id)} strategy={verticalListSortingStrategy}><ol>{draft.map((project,index)=><ProjectRow key={project.id} project={project} index={index} disabled={saving} />)}</ol></SortableContext></DndContext>{!draft.length && <p>No hay proyectos para ordenar.</p>}{error && <p className="project-order-error" role="alert">{error}</p>}</div>
    <footer><Button type="button" variant="outline" disabled={saving} onClick={()=>onOpenChange(false)}>Cancelar</Button><Button type="button" disabled={saving || !draft.length} onClick={save}><Check size={17} />{saving?'Guardando…':'Guardar orden'}</Button></footer>
  </Dialog.Content></Dialog.Portal></Dialog.Root>
}
