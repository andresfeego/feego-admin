import TaskWorkTimer from '../components/TaskWorkTimer'
import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Icons from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import ImageCropModal from '../components/ImageCropModal.jsx'
import styles from './KanbanPage.module.scss'
import './KanbanWorkspace.scss'
import RoadmapView from '../components/RoadmapView'
import NewTaskDialog from '../components/NewTaskDialog'
import EditTaskDialog from '../components/EditTaskDialog'
import { Button, Input, Textarea } from '../components/ui'
import '../components/ProjectEditor.scss'
import ProgressControl, { ProgressBar } from '../components/ProgressControl'
import { cardPayload, progressValue } from '../lib/roadmap.mjs'
import { Link } from 'react-router-dom'

import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  pointerWithin,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'



const PRIORITY_OPTIONS = [
  { value: 1, label: 'Alta', icon: 'Flame' },
  { value: 2, label: 'Media', icon: 'Sparkles' },
  { value: 3, label: 'Baja', icon: 'Leaf' },
]


function projectAvatar(p) {
  if (p.logo_path) return `/api/kanban/project/logo?name=${encodeURIComponent(p.logo_path)}`
  return null
}

function sectionListForProject(state, projectId) {
  if (!projectId) return []
  return (state.sections || []).filter(s => Number(s.project_id) === Number(projectId))
}

function ProjectAvatar({ src, sizeClass = 'w-9 h-9', iconClass = 'w-4 h-4 text-slate-400' }) {
  const [hasError, setHasError] = React.useState(false)

  React.useEffect(() => {
    setHasError(false)
  }, [src])

  return (
    <div className={`${sizeClass} rounded-full border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center shrink-0`}>
      {src && !hasError ? (
        <img src={src} className="w-full h-full object-cover" alt="" onError={() => setHasError(true)} />
      ) : src && hasError ? (
        <Icons.X className={iconClass} />
      ) : (
        <Icons.Image className={iconClass} />
      )}
    </div>
  )
}

function formatDueShort(isoDate) {
  if (!isoDate) return null
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
}

function ProjectLogoPicker({ logoPath, previewUrl, onPick, aspect = 1 }) {
  const inputRef = React.useRef(null)
  const url = previewUrl ? previewUrl : (logoPath ? `/api/kanban/project/logo?name=${encodeURIComponent(logoPath)}` : null)

  const [cropOpen, setCropOpen] = React.useState(false)
  const [pendingFile, setPendingFile] = React.useState(null)

  return (
    <div className="mt-3 flex justify-center">
      <div className="relative w-24 h-24">
        <ProjectAvatar src={url} sizeClass="w-24 h-24" iconClass="w-9 h-9 text-slate-400" />

        <button
          onClick={() => inputRef.current && inputRef.current.click()}
          className="absolute right-0 bottom-0 w-9 h-9 rounded-full border border-white/10 bg-slate-950/80 hover:bg-white/10 flex items-center justify-center"
          title="Cambiar imagen"
        >
          <Icons.Pencil className="w-4 h-4" />
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files && e.target.files[0]
            if (!f) return
            setPendingFile(f)
            setCropOpen(true)
            e.target.value = ''
          }}
        />

        <ImageCropModal
          open={cropOpen}
          onOpenChange={setCropOpen}
          file={pendingFile}
          aspect={aspect}
          title="Recortar logo"
          outputType="image/png"
          onDone={(blob) => {
            if (!blob) return
            const cropped = new File([blob], (pendingFile?.name || 'logo') + '.png', { type: blob.type || 'image/png' })
            const preview = URL.createObjectURL(blob)
            onPick(cropped, preview)
            setPendingFile(null)
          }}
        />
      </div>
    </div>
  )
}

function DroppableColumn({ id, header, children }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div className="kanban-column">
      <div className={`kanban-column-surface${isOver ? ' is-over' : ''}`}>
        {header}
        <div ref={setNodeRef} className="kanban-dropzone">
          {children}
        </div>
      </div>
    </div>
  )
}

function CardVisual({ c, handle, onOpen, logoSrc = null, draggingOverlay = false, style = {}, setNodeRef = undefined, dragHandleProps = {} }) {
  const [actionBusy, setActionBusy] = React.useState(false)
  async function runAction(action) { setActionBusy(true); try { await handle(action, c) } finally { setActionBusy(false) } }
  const due = formatDueShort(c.due_at)
  const priority = PRIORITY_OPTIONS.find(p => p.value === Number(c.priority))
  const PriorityIcon = priority ? Icons[priority.icon] : null
  const cardSections = c.sections?.length ? c.sections : c.section_name ? [{id:`legacy-${c.id}`,icon:c.section_icon || 'Tag',name:c.section_name,color:c.section_color}] : []
  const labels = Array.isArray(c.labels) ? c.labels : []
  return <article ref={setNodeRef} style={style} className={`kanban-task${draggingOverlay ? ' is-dragging' : ''}`} onClick={() => onOpen(c)}>
    <div className="kanban-task-top"><div className="kanban-task-project"><ProjectAvatar src={logoSrc} sizeClass="w-7 h-7" iconClass="w-4 h-4" /><span>{c.project_name || 'Sin proyecto'}</span></div><button type="button" className="kanban-task-grip" title="Arrastrar" onClick={e => e.stopPropagation()} {...dragHandleProps} aria-label={`Mover ${c.title}`}><Icons.GripVertical size={18} /></button></div>
    <button type="button" className="kanban-task-title" onClick={e=>{e.stopPropagation();onOpen(c)}}>{c.title}</button>
    {!(c.board === 'kanban' && c.status === 'todo') && <div className="kanban-task-progress"><ProgressBar value={progressValue(c.progress_pct)} label={`Progreso de ${c.title}`} /><strong>{progressValue(c.progress_pct)}%</strong></div>}
    {!!cardSections.length && <div className="kanban-task-sections">{cardSections.map(sec=>{const Icon=Icons[sec.icon] || Icons.Tag;return <span key={sec.id} title={sec.name}><Icon size={13} style={{color:sec.color || undefined}} />{sec.name}</span>})}</div>}
    {!!labels.length && <div className="kanban-task-labels">{labels.slice(0,2).map(label=><span key={label}>{label}</span>)}{labels.length>2 && <span>+{labels.length-2}</span>}</div>}
    <TaskWorkTimer card={c} /><footer className="kanban-task-footer">{priority && <span className="kanban-task-priority" data-priority={priority.value}><PriorityIcon size={14} />{priority.label}</span>}{due && <span className="kanban-task-due"><Icons.CalendarDays size={13} />{due}</span>}{c.board === 'kanban' && c.status === 'todo' && <button type="button" className="kanban-task-return" title="Devolver a planificación de Roadmap" aria-label={`Devolver ${c.title} a Roadmap`} disabled={actionBusy} onClick={e=>{e.stopPropagation();runAction('toRoadmap')}}><Icons.Undo2 size={17} /></button>}{c.status === 'done' && <button type="button" className="kanban-task-archive" title="Archivar tarea" aria-label={`Archivar ${c.title}`} disabled={actionBusy} onClick={e=>{e.stopPropagation();runAction('archive')}}><Icons.Archive size={17} /></button>}</footer>
  </article>
}

function SortableCard({ c, handle, onOpen, logoSrc = null }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `card:${c.id}` })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: 1,
    zIndex: isDragging ? 60 : 1,
    pointerEvents: isDragging ? 'none' : undefined,
  }

  return (
    <CardVisual
      c={c}
      handle={handle}
      onOpen={onOpen}
      logoSrc={logoSrc}
      setNodeRef={setNodeRef}
      style={{ ...style, borderColor: 'var(--feego-border)' }}
      dragHandleProps={{ ...listeners, ...attributes }}
      draggingOverlay={isDragging}
    />
  )
}

export default function KanbanPage() { return <KanbanWorkspace /> }

export function KanbanWorkspace({ roadmap = false }) {
  const [state, setState] = React.useState({ projects: [], sections: [], cards: [] })
  const stateRef = React.useRef(state)
  stateRef.current = state
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [savingCard, setSavingCard] = React.useState(false)
  const [movePrompt, setMovePrompt] = React.useState(null)
  const [moveValue, setMoveValue] = React.useState('')
  const moveResolve = React.useRef(null)
  const dragBusy = React.useRef(false)
  function finishMove(value) {
    moveResolve.current?.(value)
    moveResolve.current = null
    setMovePrompt(null)
  }
  React.useEffect(() => () => { moveResolve.current?.(null) }, [])
  function askMoveProgress(card) {
    setMovePrompt(card)
    setMoveValue('')
    return new Promise(resolve => { moveResolve.current = resolve })
  }
  const dragOriginContainerRef = React.useRef(null)

  const [newProjectOpen, setNewProjectOpen] = React.useState(false)
  const [projectName, setProjectName] = React.useState('')

  const [editOpen, setEditOpen] = React.useState(false)
  const [edit, setEdit] = React.useState({ id: 0, name: '', description: '', logo_path: null, priority: null })
  const [editLogoFile, setEditLogoFile] = React.useState(null)
  const [editLogoPreview, setEditLogoPreview] = React.useState(null)

  const [secName, setSecName] = React.useState('')
  const [secColor, setSecColor] = React.useState('#64748b')
  const [secIcon, setSecIcon] = React.useState('Tag')
  const [iconPickerOpen, setIconPickerOpen] = React.useState(false)
  const [iconPickerTarget, setIconPickerTarget] = React.useState('create')
  const [iconSearch, setIconSearch] = React.useState('')
  const [secEditOpen, setSecEditOpen] = React.useState(false)
  const [secEdit, setSecEdit] = React.useState({ id: 0, name: '', color: '#64748b', icon: 'Tag' })

  const [cardOpen, setCardOpen] = React.useState(false)
  const [cardEdit, setCardEdit] = React.useState({ id: 0, title: '', notes: '', project_id: null, section_id: null, section_ids: [], due_at: null, priority: null, labels: [] })

  const [newCardOpen, setNewCardOpen] = React.useState(false)
  const [newCard, setNewCard] = React.useState({ title: '', notes: '', project_id: null, section_id: null, section_ids: [], due_at: null, priority: 3 })

  function openNewCard(project_id = null) {
    setNewCard({ title: '', notes: '', project_id, section_id: null, section_ids: [], priority: 3, labels: [] })
    setNewCardOpen(true)
  }

  const sensors = useSensors(
    // iOS Safari: TouchSensor can interfere with horizontal scroll; PointerSensor works better.
    useSensor(PointerSensor, { activationConstraint: { distance: 12 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      const r = await api('/api/kanban/state')
      if (!r.ok || !r.data?.ok) throw new Error('No se pudieron cargar los datos')
      const receivedAt = Date.now()
      const next = { ...r.data, cards: r.data.cards.map(card => ({ ...card, work_received_at: receivedAt })) }
      stateRef.current = next
      setState(next)
    } catch (e) { setError(e.message || 'No se pudo conectar con el servidor') }
    finally { setLoading(false) }
  }

  React.useEffect(() => {
    refresh()
  }, [])

  async function createProject() {
    const name = projectName.trim()
    if (!name) return
    const r = await api('/api/kanban/project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (r.ok) {
      setProjectName('')
      setNewProjectOpen(false)
      refresh()
    } else alert('Error creando proyecto')
  }

  const quickLocks = React.useRef(new Set())
  async function quick(act, c) {
    if (quickLocks.current.has(c.id)) return
    if (act === 'toRoadmap' && (c.board !== 'kanban' || c.status !== 'todo')) return
    const destination = act === 'toRoadmap' ? { board: 'ideas', status: 'n/a' }
      : act === 'archive' ? { board: 'archived', status: 'n/a' }
      : act === 'toTodo' ? { board: 'kanban', status: 'todo' } : null
    if (!destination) return
    quickLocks.current.add(c.id)
    try {
      const r = await api('/api/kanban/move', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, ...destination }) })
      if (!r.ok || !r.data?.ok) throw Error('No se pudo mover la tarea. Intenta de nuevo.')
      await refresh()
      if (act === 'toRoadmap') toast.success('Tarea devuelta a la planificación de Roadmap')
    } catch (e) { toast.error(e.message || 'No se pudo conectar con el servidor') }
    finally { quickLocks.current.delete(c.id) }
  }

  function containerIdForCard(c) {
    if (c.board === 'ideas') return `ideas:project:${c.project_id}`
    if (c.board === 'archived') return `archived:project:${c.project_id}`
    return `kanban:${c.status}`
  }

  function parseContainer(containerId) {
    if (containerId.startsWith('ideas:project:')) return { board: 'ideas', project_id: Number(containerId.split(':').pop()), status: 'n/a' }
    if (containerId.startsWith('archived:project:')) return { board: 'archived', project_id: Number(containerId.split(':').pop()), status: 'n/a' }
    if (containerId.startsWith('kanban:')) return { board: 'kanban', project_id: undefined, status: containerId.split(':')[1] }
    return null
  }

  function cardsInContainer(containerId) {
    let out = stateRef.current.cards.filter((c) => containerIdForCard(c) === containerId)

    out.sort((a, b) => (a.sort || 0) - (b.sort || 0))
    return out
  }

  function containersForView() { return ['kanban:todo', 'kanban:doing', 'kanban:done'] }

  function onDragStart(event) {
    if (dragBusy.current) return
    const activeId = String(event.active?.id || '')
    if (!activeId.startsWith('card:')) return
    const cardId = Number(activeId.split(':')[1])
    const c = state.cards.find((x) => Number(x.id) === cardId)
    if (!c) return
    dragOriginContainerRef.current = containerIdForCard(c)
  }

  function onDragCancel() {
    dragOriginContainerRef.current = null
    refresh()
  }

  function onDragOver(event) {
    if (dragBusy.current) return
    const { active, over } = event
    if (!over) return

    const activeId = String(active?.id || '')
    const overId = String(over?.id || '')
    if (!activeId.startsWith('card:')) return

    const cardId = Number(activeId.split(':')[1])
    const activeCard = stateRef.current.cards.find((x) => Number(x.id) === cardId)
    if (!activeCard) return

    let toContainer = overId
    if (overId.startsWith('card:')) {
      const overCardId = Number(overId.split(':')[1])
      const overCard = stateRef.current.cards.find((x) => Number(x.id) === overCardId)
      if (!overCard) return
      toContainer = containerIdForCard(overCard)
    }

    const toInfo = parseContainer(toContainer)
    if (!toInfo) return

    const currentContainer = containerIdForCard(activeCard)
    if (currentContainer === toContainer) return

    {
      const prev = stateRef.current
      const nextCards = prev.cards.map((card) => {
        if (Number(card.id) !== Number(cardId)) return card
        return {
          ...card,
          board: toInfo.board,
          status: toInfo.status,
          project_id: toInfo.project_id !== undefined ? toInfo.project_id : card.project_id,
          section_id: toInfo.project_id !== undefined ? null : card.section_id,
          section_ids: toInfo.project_id !== undefined ? [] : (card.section_ids || []),
          section_name: toInfo.project_id !== undefined ? null : card.section_name,
          section_color: toInfo.project_id !== undefined ? null : card.section_color,
          section_icon: toInfo.project_id !== undefined ? null : card.section_icon,
          sections: toInfo.project_id !== undefined ? [] : (card.sections || []),
        }
      })
      const next = { ...prev, cards: nextCards }
      stateRef.current = next
      setState(next)
    }
  }

  async function onDragEnd(event) {
    if (dragBusy.current) return
    dragBusy.current = true
    try {
    const { active, over } = event
    if (!over) {
      dragOriginContainerRef.current = null
      refresh()
      return
    }

    const activeId = String(active.id)
    const overId = String(over.id)
    if (!activeId.startsWith('card:')) return

    const cardId = Number(activeId.split(':')[1])
    const c = stateRef.current.cards.find((x) => Number(x.id) === cardId)
    if (!c) return
    const fromContainer = dragOriginContainerRef.current || containerIdForCard(c)
    dragOriginContainerRef.current = null
    const fromInfo = parseContainer(fromContainer)
    if (!fromInfo) return

    // If dropped over a card, infer the container from that card; otherwise overId is a container id
    let toContainer = overId
    let overCardId = null
    if (overId.startsWith('card:')) {
      overCardId = Number(overId.split(':')[1])
      const oc = stateRef.current.cards.find((x) => Number(x.id) === overCardId)
      if (!oc) return
      toContainer = containerIdForCard(oc)
    }

    const toInfo = parseContainer(toContainer)
    if (!toInfo) return
    const sameContainer = fromContainer === toContainer
    let moveProgress
    if (!sameContainer && toInfo.board === 'kanban') {
      moveProgress = toInfo.status === 'done' ? 100 : toInfo.status === 'todo' ? 0 : progressValue(c.progress_pct)
      if (toInfo.status === 'doing' && (moveProgress === 0 || moveProgress === 100)) {
        moveProgress = await askMoveProgress(c)
        if (moveProgress === null) { await refresh(); return }
      }
    }

    const fromCards = cardsInContainer(fromContainer)
    const toCards = sameContainer ? fromCards : cardsInContainer(toContainer)
    const overSortableIndexRaw = over?.data?.current?.sortable?.index
    const overSortableIndex = Number.isInteger(overSortableIndexRaw) ? Number(overSortableIndexRaw) : null

    const computeInsertIndex = (list) => {
      if (overSortableIndex != null) {
        const clamped = Math.max(0, Math.min(overSortableIndex, list.length))
        return clamped
      }
      if (overCardId != null) {
        const idx = list.findIndex((x) => Number(x.id) === Number(overCardId))
        return idx >= 0 ? idx : list.length
      }
      return list.length
    }

    const persistContainerOrder = async (containerInfo, orderedCards, movedCardOverrides = null) => {
      for (let i = 0; i < orderedCards.length; i += 1) {
        const card = orderedCards[i]
        const body = {
          id: card.id,
          board: containerInfo.board,
          status: containerInfo.status,
          sort: i,
        }

        // Only include project_id when we intentionally move a card across projects.
        if (movedCardOverrides && Number(card.id) === Number(movedCardOverrides.id) && movedCardOverrides.project_id !== undefined) {
          body.project_id = movedCardOverrides.project_id
        }

        if (movedCardOverrides && Number(card.id) === Number(movedCardOverrides.id) && movedCardOverrides.progress_pct !== undefined) {
          body.progress_pct = movedCardOverrides.progress_pct
        }
        const result = await api('/api/kanban/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!result.ok) throw new Error('No se pudo guardar el movimiento')
      }
    }

    if (sameContainer) {
      const activeIndex = fromCards.findIndex((x) => Number(x.id) === Number(c.id))
      if (activeIndex < 0) return
      const overIndex = overSortableIndex != null
        ? Math.max(0, Math.min(overSortableIndex, fromCards.length - 1))
        : (overCardId != null
          ? fromCards.findIndex((x) => Number(x.id) === Number(overCardId))
          : fromCards.length - 1)
      if (overIndex < 0 || activeIndex === overIndex) return

      const reordered = arrayMove(fromCards, activeIndex, overIndex)
      await persistContainerOrder(toInfo, reordered)
      refresh()
      return
    }

    // Cross-container move: remove from source, insert at destination index, then persist both lists.
    const remainingFrom = fromCards.filter((x) => Number(x.id) !== Number(c.id))
    const nextTo = toCards.filter((x) => Number(x.id) !== Number(c.id))
    const insertIndex = computeInsertIndex(nextTo)
    const movedCard = { ...c, board: toInfo.board, status: toInfo.status, project_id: toInfo.project_id ?? c.project_id }
    nextTo.splice(insertIndex, 0, movedCard)

    // First persist destination so moved card gets its new container + sort.
    await persistContainerOrder(
      toInfo,
      nextTo,
      { id: c.id, project_id: toInfo.project_id, progress_pct: moveProgress }
    )
    // Then compact source sorts.
    await persistContainerOrder(fromInfo, remainingFrom)

    refresh()
    return

    } catch (e) { toast.error(e.message || 'No se pudo guardar el movimiento'); await refresh() }
    finally { dragBusy.current = false }
  }

  function openEditProject(p) {
    setEdit({ id: p.id, name: p.name, description: p.description || '', logo_path: p.logo_path || null, priority: p.priority ?? null })
    setEditLogoFile(null)
    setEditLogoPreview(null)
    setSecName('')
    setSecColor('#64748b')
    setSecIcon('Tag')
    setSecEditOpen(false)
    setIconPickerOpen(false)
    setIconSearch('')
    setEditOpen(true)
  }

  function openEditCard(c) {
    setCardEdit({
      id: c.id,
      title: c.title || '',
      notes: c.notes || '',
      project_id: c.project_id || null,
      section_id: c.section_id || null,
      section_ids: Array.isArray(c.section_ids)
        ? c.section_ids
        : (Array.isArray(c.sections) ? c.sections.map((s) => Number(s.id)).filter(Boolean) : (c.section_id ? [Number(c.section_id)] : [])),
      due_at: c.due_at || null,
      priority: [1, 2, 3].includes(Number(c.priority)) ? Number(c.priority) : null,
      labels: Array.isArray(c.labels) ? c.labels : [],
      progress_pct: progressValue(c.progress_pct),
      work_elapsed_ms: c.work_elapsed_ms,
      work_total_ms: c.work_total_ms,
      work_started_at: c.work_started_at,
      work_sampled_at: c.work_sampled_at,
      work_received_at: c.work_received_at,
      sync_progress: false,
      board: c.board,
      status: c.status,
    })
    setCardOpen(true)
  }

  const saveTaskLock = React.useRef(false)
  async function saveEditedTask(task) {
    if (saveTaskLock.current) return
    if (!Number.isInteger(task.progress_pct) || task.progress_pct < 0 || task.progress_pct > 100) { toast.error('Usa un porcentaje entero entre 0 y 100'); return }
    saveTaskLock.current = true; setSavingCard(true)
    try {
      const payload = cardPayload(task, { sync_progress: canEditProgress && task.sync_progress })
      if (!canEditProgress || !task.sync_progress) delete payload.progress_pct
      const r = await api('/api/kanban/card/update', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) })
      if (!r.ok) { toast.error(r.status === 409 ? 'No se pudo guardar. Actualiza los datos e intenta de nuevo.' : 'No se pudo guardar la tarea'); return }
      setCardOpen(false); await refresh()
    } catch { toast.error('No se pudo conectar para guardar la tarea') }
    finally { saveTaskLock.current = false; setSavingCard(false) }
  }

  async function archiveCardFromModal() {
    if (!cardEdit.id) return
    const r = await api('/api/kanban/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cardEdit.id, board: 'archived', status: 'n/a' }),
    })
    if (!r.ok) return alert('Error archivando tarjeta')
    setCardOpen(false)
    refresh()
  }

  const deleteTaskLock = React.useRef(false)
  async function deleteCardFromModal() {
    if (!cardEdit.id || deleteTaskLock.current) return false
    deleteTaskLock.current = true
    try {
      const r = await api(`/api/kanban/card?id=${encodeURIComponent(cardEdit.id)}`, { method: 'DELETE' })
      if (!r.ok || !r.data?.ok) throw new Error('No se pudo eliminar la tarea. Intenta de nuevo.')
      stateRef.current = { ...stateRef.current, cards: stateRef.current.cards.filter(card => card.id !== cardEdit.id) }
      setState(stateRef.current)
      setCardOpen(false)
      await refresh()
      toast.success('Tarea eliminada', { duration: 3000 })
      return true
    } finally { deleteTaskLock.current = false }
  }

  async function saveProject() {
    const name = edit.name.trim()
    if (!name) return

    const r = await api('/api/kanban/project/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: edit.id, name, description: edit.description || '', priority: edit.priority }),
    })
    if (!r.ok) return alert('Error guardando proyecto')

    if (editLogoFile) {
      const fd = new FormData()
      fd.append('project_id', String(edit.id))
      fd.append('logo', editLogoFile)
      const r2 = await fetch('/api/kanban/project/logo', { method: 'POST', credentials: 'include', body: fd })
      if (!r2.ok) return alert('Error subiendo logo')
    }

    setEditOpen(false)
    refresh()
  }

  async function deleteProjectPermanent() {
    if (!edit.id) return
    const r = await api(`/api/kanban/project/permanent?id=${encodeURIComponent(edit.id)}`, { method: 'DELETE' })
    if (!r.ok) {
      toast.error('Error eliminando proyecto')
      return
    }
    toast.success('Proyecto eliminado definitivamente')
    setEditOpen(false)
    refresh()
  }

  function confirmDeleteProjectPermanent() {
    if (!edit.id) return
    toast.custom((t) => (
      <div
        className="feego-modal rounded-xl p-3 border border-white/10 max-w-sm"
        style={{
          animation: t.visible
            ? 'toast-in 220ms cubic-bezier(0.16, 1, 0.3, 1) forwards'
            : 'toast-out 180ms ease-in forwards',
        }}
      >
        <div className="font-bold text-sm">¿Eliminar definitivamente?</div>
        <div className="text-xs text-slate-400 mt-1">
          Se eliminará el proyecto <b>{edit.name}</b> junto con todas sus tarjetas y secciones.
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button
            className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs"
            onClick={() => toast.dismiss(t.id)}
          >
            No
          </button>
          <button
            className={`${styles.dangerAction} px-2.5 py-1.5 rounded-lg text-xs font-semibold`}
            onClick={async () => {
              toast.dismiss(t.id)
              await deleteProjectPermanent()
            }}
          >
            Sí, eliminar
          </button>
        </div>
      </div>
    ), { duration: 12000 })
  }

  const iconSeeds = [
    // base
    'Tag','Briefcase','Wrench','Globe','ShoppingCart','Home','Users','User','Rocket','Megaphone',
    'Camera','Video','FileText','Folder','Book','GraduationCap','Heart','Star','Gift','Bell',
    'Calendar','Clock','Phone','Mail','MapPin','Bolt','Flame','Lightbulb','Shield','CreditCard',
    'Hammer','Building2','Truck','Store','Package','DollarSign','PiggyBank','ChartLine','Target','CheckCircle2',
    // tech/web/mobile/infra
    'Laptop','Monitor','MonitorSmartphone','Smartphone','Tablet','Server','Database','Cpu','Code2','Terminal',
    'Binary','Network','Wifi','Bluetooth','Cloud','CloudCog','CloudUpload','CloudDownload','HardDrive','HardDriveUpload',
    'HardDriveDownload','Usb','Cable','Router','Webhook','AppWindow','PanelsTopLeft','Bug','BugPlay','ShieldCheck',
    'ShieldAlert','Lock','KeyRound','Fingerprint','QrCode','ScanLine','FileCode2','GitBranch','GitCommitHorizontal','GitPullRequest',
    'Container','Boxes','PackageSearch','Braces','Component','Workflow','Waypoints','Activity','Gauge','BarChart3',
    'LineChart','PieChart','Search','Sparkles','Zap','BrainCircuit','Bot','Brain','Microscope','TestTube2',
    // personal/home
    'House','HousePlus','Bed','Bath','Sofa','CookingPot','UtensilsCrossed','Refrigerator','WashingMachine','Lamp',
    'LightbulbOff','ShowerHead','Toilet','Archive','ArchiveRestore','ClipboardList','ListTodo','NotebookPen','StickyNote','BookOpen',
    'Broom','BrushCleaning','WandSparkles','SprayCan','PackageOpen','Warehouse','DoorOpen','DoorClosed','PanelsLeftBottom','GalleryVerticalEnd',
    'Trees','Flower2','Sun','Moon','CloudSun','Umbrella','Car','Bike','Bus','MapPinned'
  ]

  const iconCatalog = React.useMemo(() => {
    const all = Object.keys(Icons || {})
    const techMatchers = [/Phone|Smart|Tablet|Laptop|Monitor|Screen|Code|Terminal|Server|Database|Cloud|Git|Cpu|Wifi|Bluetooth|Network|Webhook|App|Window|Shield|Lock|Key|Bug|Bot|Chart|Gauge|Activity|Sparkles|Zap/i]
    const homeMatchers = [/Home|House|Bed|Bath|Sofa|Cook|Utensil|Refrigerator|Washing|Lamp|Shower|Toilet|Broom|Brush|Spray|Door|Garage|Warehouse|Archive|Clipboard|List|Note|Book|Sun|Moon|Tree|Flower|Car|Bike|Bus/i]
    const scored = all
      .filter((name) => /^[A-Z]/.test(name))
      .map((name) => ({
        name,
        score: (techMatchers.some((r) => r.test(name)) ? 2 : 0) + (homeMatchers.some((r) => r.test(name)) ? 2 : 0),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .map((x) => x.name)

    const merged = [...iconSeeds, ...scored]
    const uniq = []
    const seen = new Set()
    for (const n of merged) {
      if (!seen.has(n) && Icons[n]) {
        seen.add(n)
        uniq.push(n)
      }
      if (uniq.length >= 150) break
    }
    return uniq
  }, [])

  const filteredIconCatalog = React.useMemo(() => {
    const q = String(iconSearch || '').trim().toLowerCase()
    if (!q) return iconCatalog
    return iconCatalog.filter((n) => n.toLowerCase().includes(q))
  }, [iconCatalog, iconSearch])


  function renderProjectIcons() {
    return <div className="project-icon-picker" role="group" aria-label="Iconos de sección">
      <label htmlFor="project-icon-search"><Icons.Search size={15} />Buscar icono</label>
      <Input id="project-icon-search" value={iconSearch} onChange={e => setIconSearch(e.target.value)} placeholder="Ej: Code, Wrench, Book…" />
      <div className="project-icon-grid">{filteredIconCatalog.map(name => <button type="button" key={name} title={name} aria-label={name} aria-pressed={(iconPickerTarget === 'edit' ? secEdit.icon : secIcon) === name} onClick={() => {
        if (iconPickerTarget === 'edit') setSecEdit(prev => ({ ...prev, icon: name }))
        else setSecIcon(name)
        setIconPickerOpen(false); setIconSearch('')
      }}><IconByName name={name} /></button>)}{!filteredIconCatalog.length && <p>Sin resultados</p>}</div>
    </div>
  }

  function IconByName({ name, className, style }) {
    const C = Icons[name] || Icons.Tag
    return <C className={className || 'w-4 h-4'} style={style} />
  }

  async function addSection() {
    const name = secName.trim()
    if (!name) return
    const r = await api('/api/kanban/sections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: edit.id, name, color: secColor, icon: secIcon }),
    })
    if (!r.ok) return alert('Error creando sección')
    setSecName('')
    refresh()
  }

  function openEditSection(s) {
    setSecEdit({ id: s.id, name: s.name, color: s.color || '#64748b', icon: s.icon || 'Tag' })
    setIconPickerOpen(false)
    setIconSearch('')
    setSecEditOpen(true)
  }

  async function saveSection() {
    const name = secEdit.name.trim()
    if (!name) return
    const r = await api('/api/kanban/sections/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: secEdit.id, name, color: secEdit.color, icon: secEdit.icon }),
    })
    if (!r.ok) {
      if (r.status === 409 || r.data?.error === 'duplicate_section_name') {
        return alert('Ya existe una sección con ese nombre en el proyecto.')
      }
      if (r.status === 404 || r.data?.error === 'section_not_found') {
        return alert('La sección ya no existe o fue archivada.')
      }
      return alert(`Error guardando sección (${r.status})`)
    }
    setSecEditOpen(false)
    refresh()
  }

  async function deleteSection(id) {
    if (!confirm('¿Eliminar sección?')) return
    const r = await api('/api/kanban/sections/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (!r.ok) return alert('Error eliminando sección')
    refresh()
  }

  const canEditProgress = !roadmap && cardEdit.board === 'kanban' && cardEdit.status === 'doing'
  const containers = containersForView()

  return (
    <div className={roadmap ? "space-y-4" : "kanban-workspace"}>
      <div className={roadmap ? "hidden" : "kanban-toolbar"}>
        <div><div className="kanban-eyebrow">EJECUCIÓN DIARIA</div><h1>Kanban</h1><p>{state.cards.filter(c => c.board === 'kanban').length} tareas en el tablero</p></div>
        <div className="kanban-toolbar-actions">
          <Button variant="outline" aria-label="Actualizar Kanban" title="Actualizar" onClick={refresh} disabled={loading}><Icons.RefreshCw size={18} /></Button>
          <Link to="/roadmap" className="feego-btn feego-btn-outline kanban-roadmap-link"><Icons.Map size={17} />Roadmap</Link>
            <Dialog.Root open={newProjectOpen} onOpenChange={setNewProjectOpen}>
              <Dialog.Trigger asChild>
                <Button><Icons.FolderPlus size={17} />Nuevo proyecto</Button>
              </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="feego-overlay fixed inset-0 z-[70]" />
              <Dialog.Content className="feego-modal z-[71] max-h-[85dvh] overflow-y-auto fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md rounded-2xl p-4">
                <Dialog.Title className="font-extrabold">Nuevo proyecto</Dialog.Title>
                <div className="text-xs text-slate-400 mt-1">Solo nombre por ahora.</div>
                <input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2" placeholder="Ej: Mako" />
                <div className="mt-4 flex justify-end gap-2">
                  <Dialog.Close asChild>
                    <button className="px-3 py-2 rounded-lg border border-white/10 bg-white/5">Cancelar</button>
                  </Dialog.Close>
                  <button onClick={createProject} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold">Crear</button>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>

      {roadmap ? <RoadmapView state={state} loading={loading} error={error} refresh={refresh}
        onNewProject={() => setNewProjectOpen(true)} onEditProject={openEditProject} onNewCard={openNewCard} onEditCard={openEditCard} /> : loading ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : (
        <div className="kanban-board">
          {/* Full-width viewport container; horizontal scroll ONLY inside this container */}
          <DndContext
            sensors={sensors}
            collisionDetection={(args) => {
              const byPointer = pointerWithin(args)
              return byPointer.length > 0 ? byPointer : closestCorners(args)
            }}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragCancel={onDragCancel}
            onDragEnd={onDragEnd}
          >
            <div
              className="kanban-columns"
              style={{
                WebkitOverflowScrolling: 'touch',
                overflowAnchor: 'none',
                overscrollBehaviorX: 'contain',
              }}
            >
              {containers.map((cid, colIndex) => {
                const info = parseContainer(cid)
                const cards = cardsInContainer(cid)
                const st = cid.split(':')[1]
                const title = st === 'todo' ? 'Por hacer' : st === 'doing' ? 'Haciendo' : 'Hecho'
                const StatusIcon = st === 'todo' ? Icons.CircleDashed : st === 'doing' ? Icons.LoaderCircle : Icons.CircleCheck
                const header = <div className="kanban-column-header" data-status={st}><StatusIcon size={19} /><h2>{title}</h2><span>{cards.length}</span></div>
                const items = cards.map((c) => `card:${c.id}`)

                return (
                  <SortableContext key={cid} id={cid} items={items}>
                    <DroppableColumn
                      id={cid}
                      header={header}
                    >
                      {cards.map((c) => {
                        const pMeta = (state.projects || []).find((p) => Number(p.id) === Number(c.project_id))
                        const logoSrc = pMeta ? projectAvatar(pMeta) : null
                        return <SortableCard key={c.id} c={c} handle={quick} onOpen={openEditCard} logoSrc={logoSrc} />
                      })}
                    </DroppableColumn>
                  </SortableContext>
                )
              })}
            </div>

          </DndContext>
        </div>
      )}

      {!roadmap && error && <div role="alert" className="p-4 text-red-500">{error} <button onClick={refresh}>Reintentar</button></div>}
      <Dialog.Root open={!!movePrompt} onOpenChange={open => { if (!open) finishMove(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="feego-overlay fixed inset-0 z-50" />
          <Dialog.Content aria-describedby={undefined} className="feego-modal fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md rounded-2xl p-5">
            <Dialog.Title className="font-bold mb-3">Progreso al pasar a Haciendo</Dialog.Title>
            <p className="text-sm feego-muted mb-4">{movePrompt?.title}</p>
            <ProgressControl label="Porcentaje en proceso" min={1} max={99} value={moveValue} onChange={setMoveValue} />
            <div className="flex justify-end gap-2 mt-4">
              <button className="feego-btn feego-btn-outline rounded-lg px-3 py-2" onClick={() => finishMove(null)}>Cancelar</button>
              <button className="feego-btn feego-btn-primary rounded-lg px-3 py-2" disabled={!Number.isInteger(moveValue) || moveValue < 1 || moveValue > 99} onClick={() => finishMove(moveValue)}>Guardar movimiento</button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <NewTaskDialog open={newCardOpen} onOpenChange={setNewCardOpen} task={newCard} setTask={setNewCard} projects={state.projects} sections={state.sections} onCreated={refresh} />

      <EditTaskDialog open={cardOpen} onOpenChange={setCardOpen} task={cardEdit} setTask={setCardEdit} projects={state.projects} sections={state.sections} canEditProgress={canEditProgress} saving={savingCard} onSave={saveEditedTask} onArchive={archiveCardFromModal} onDelete={deleteCardFromModal} />

      {/* Keep section and icon editing in one dialog so choosing an icon cannot dismiss its parent. */}
      <Dialog.Root open={editOpen} onOpenChange={setEditOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="feego-overlay project-editor-overlay" />
          <Dialog.Content className="feego-modal project-editor">
            <header className="project-editor-header">
              <span className="project-editor-emblem"><Icons.FolderPen size={24} /></span>
              <div><Dialog.Title>Editar proyecto</Dialog.Title><Dialog.Description>Identidad y secciones del proyecto.</Dialog.Description></div>
              <Dialog.Close asChild><Button type="button" variant="ghost" aria-label="Cerrar proyecto"><Icons.X size={19} /></Button></Dialog.Close>
            </header>
            <div className="project-editor-body">
              <div className="project-editor-identity">
                <div className="project-editor-logo"><ProjectLogoPicker logoPath={edit.logo_path} previewUrl={editLogoPreview} onPick={(file, preview) => { setEditLogoFile(file); setEditLogoPreview(preview) }} /><span>Imagen del proyecto</span></div>
                <div><label htmlFor="project-edit-name">Nombre del proyecto</label><Input id="project-edit-name" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} maxLength={255} />
                  <label htmlFor="project-edit-description">Descripción <span>Opcional</span></label><Textarea id="project-edit-description" value={edit.description} onChange={e => setEdit({ ...edit, description: e.target.value })} rows={2} /></div>
              </div>
              <section className="project-editor-priority"><h3><Icons.Flag size={16} />Prioridad del proyecto</h3><div className="new-task-priorities" role="group" aria-label="Prioridad del proyecto">
                <button type="button" className="new-task-badge" aria-pressed={edit.priority == null} onClick={() => setEdit(p => ({...p, priority:null}))}><Icons.Minus size={15} />Sin prioridad</button>
                {PRIORITY_OPTIONS.map(p => <button type="button" key={p.value} className="new-task-badge" data-priority={p.value} aria-pressed={edit.priority === p.value} onClick={() => setEdit(v => ({...v, priority:p.value}))}><IconByName name={p.icon} />{p.label}</button>)}
              </div></section>
              <section className="project-editor-sections">
                <h3><Icons.Tags size={18} />Secciones <span>{sectionListForProject(state, edit.id).length}</span></h3>
                <div className="project-section-list">
                  {sectionListForProject(state, edit.id).map(s => <button type="button" key={s.id} aria-pressed={secEditOpen && secEdit.id === s.id} onClick={() => openEditSection(s)} className="project-section-chip" aria-label={`Editar sección ${s.name}`}>
                    <IconByName name={s.icon} style={{ color: s.color || undefined }} /><span>{s.name}</span><Icons.Pencil size={13} />
                  </button>)}
                  {!sectionListForProject(state, edit.id).length && <p className="feego-muted">Aún no hay secciones.</p>}
                </div>
                {secEditOpen ? <div className="project-section-editor" role="group" aria-label="Editar sección">
                  <h4>Editar sección</h4>
                  <label htmlFor="section-edit-name">Nombre</label><Input id="section-edit-name" value={secEdit.name} onChange={e => setSecEdit({ ...secEdit, name: e.target.value })} />
                  <div className="project-section-tools">
                    <label className="project-color-control">Color<input aria-label="Color de sección" type="color" value={secEdit.color} onChange={e => setSecEdit({ ...secEdit, color: e.target.value })} /></label>
                    <Button type="button" variant="outline" aria-label="Elegir icono de sección" aria-expanded={iconPickerOpen && iconPickerTarget === 'edit'} onClick={() => { setIconPickerTarget('edit'); setIconSearch(''); setIconPickerOpen(v => !v || iconPickerTarget !== 'edit') }}><IconByName name={secEdit.icon} style={{color:secEdit.color}} />{secEdit.icon}<Icons.ChevronDown size={14} /></Button>
                  </div>
                  {iconPickerOpen && iconPickerTarget === 'edit' && renderProjectIcons()}
                  <div className="project-section-actions"><Button type="button" variant="ghost" className="project-delete" aria-label="Eliminar sección" onClick={() => deleteSection(secEdit.id)}><Icons.Trash2 size={16} /></Button><Button type="button" variant="outline" onClick={() => { setSecEditOpen(false); setIconPickerOpen(false) }}>Cancelar sección</Button><Button type="button" disabled={!secEdit.name.trim()} onClick={saveSection}><Icons.Check size={16} />Guardar sección</Button></div>
                </div> : <div className="project-section-create">
                  <label htmlFor="section-new-name">Nueva sección</label>
                  <div className="project-section-create-row"><Input id="section-new-name" placeholder="Nombre de la sección" value={secName} onChange={e => setSecName(e.target.value)} />
                    <input type="color" aria-label="Color de nueva sección" value={secColor} onChange={e => setSecColor(e.target.value)} />
                    <Button type="button" variant="outline" aria-label="Elegir icono de nueva sección" aria-expanded={iconPickerOpen && iconPickerTarget === 'create'} onClick={() => { setIconPickerTarget('create'); setIconSearch(''); setIconPickerOpen(v => !v || iconPickerTarget !== 'create') }}><IconByName name={secIcon} style={{color:secColor}} /></Button>
                    <Button type="button" disabled={!secName.trim()} onClick={addSection}><Icons.Plus size={16} />Agregar</Button>
                  </div>
                  {iconPickerOpen && iconPickerTarget === 'create' && renderProjectIcons()}
                </div>}
              </section>
            </div>
            <footer className="project-editor-footer"><Button type="button" variant="ghost" className="project-delete" aria-label="Eliminar definitivamente proyecto" onClick={confirmDeleteProjectPermanent}><Icons.Trash2 size={18} /></Button><Dialog.Close asChild><Button type="button" variant="outline">Cancelar</Button></Dialog.Close><Button type="button" disabled={!edit.name.trim()} onClick={saveProject}><Icons.Check size={17} />Guardar proyecto</Button></footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
