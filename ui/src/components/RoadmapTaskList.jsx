import React from 'react'
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, CircleCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { orderedSectionTasks } from '../lib/roadmap.mjs'

function SortableTask({ card, disabled, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id, disabled })
  return <div ref={setNodeRef} className={`roadmap-sortable ${isDragging ? 'is-dragging' : ''}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
    <button type="button" className="roadmap-drag-handle" {...attributes} {...listeners} aria-label={`Ordenar ${card.title}`} title={disabled ? 'Borra la búsqueda para ordenar' : 'Arrastrar para ordenar'} disabled={disabled}><GripVertical size={18} /></button>{children}
  </div>
}
export default function RoadmapTaskList({ cards, sectionId, projectId, query, renderCard, refresh }) {
  const { pending, completed } = orderedSectionTasks(cards, sectionId)
  const [draft, setDraft] = React.useState(null)
  const [saving, setSaving] = React.useState(false)
  const lock = React.useRef(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const filtered = c => c.title.toLowerCase().includes(query.toLowerCase())
  const active = (draft || pending).filter(filtered)
  const done = completed.filter(filtered)
  async function reorder({ active: dragged, over }) {
    if (!over || dragged.id === over.id || lock.current || query) return
    const from = pending.findIndex(c => c.id === dragged.id)
    const to = pending.findIndex(c => c.id === over.id)
    if (from < 0 || to < 0) return
    const next = arrayMove(pending, from, to)
    lock.current = true; setSaving(true); setDraft(next)
    try {
      const r = await api('/api/roadmap/reorder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_id: projectId, section_id: sectionId === 'none' ? null : sectionId, ordered_ids: next.map(c => c.id) }) })
      if (!r.ok || !r.data?.ok) throw Error(r.status === 409 ? 'Las tareas cambiaron. Actualiza la lista e intenta de nuevo.' : 'No se pudo guardar el orden')
      await refresh()
      toast.success('Orden guardado')
    } catch (e) { toast.error(e.message || 'No se pudo guardar el orden'); await refresh() }
    finally { setDraft(null); setSaving(false); lock.current = false }
  }
  return <div aria-busy={saving}>
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorder}>
      <SortableContext items={active.map(c => c.id)} strategy={verticalListSortingStrategy}>
        {active.map(card => <SortableTask key={card.id} card={card} disabled={saving || !!query}>{renderCard(card)}</SortableTask>)}
      </SortableContext>
    </DndContext>
    {!!done.length && <div className="roadmap-completed"><h4><CircleCheck size={15} />Completadas <span>{done.length}</span></h4>{done.map(card => <div className="roadmap-completed-row" key={card.id}>{renderCard(card)}</div>)}</div>}
  </div>
}
