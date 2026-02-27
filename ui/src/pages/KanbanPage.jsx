import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Icons from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import ImageCropModal from '../components/ImageCropModal.jsx'
import styles from './KanbanPage.module.scss'

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

const boards = [
  { key: 'ideas', title: 'Ideas' },
  { key: 'kanban', title: 'Kanban' },
  { key: 'archived', title: 'Archivadas' },
]

const fieldLabelClass = 'text-[11px] uppercase tracking-wide text-slate-400'
const fieldInputClass = 'mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2'
const panelClass = 'rounded-xl border border-white/10 bg-black/20 p-3'
const PRIORITY_OPTIONS = [
  { value: 1, label: 'Alta' },
  { value: 2, label: 'Media' },
  { value: 3, label: 'Baja' },
]

function getPriorityMeta(priority) {
  if (Number(priority) === 1) return { label: 'Alta', className: 'border-red-300/30 bg-red-500/15 text-red-200' }
  if (Number(priority) === 2) return { label: 'Media', className: 'border-amber-300/30 bg-amber-500/15 text-amber-200' }
  if (Number(priority) === 3) return { label: 'Baja', className: 'border-blue-300/30 bg-blue-500/15 text-blue-200' }
  return null
}

function ArrowBtn({ children, onClick }) {
  return (
    <button onClick={onClick} className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10">
      {children}
    </button>
  )
}

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
          onDone={(blob) => {
            if (!blob) return
            const cropped = new File([blob], (pendingFile?.name || 'logo') + '.jpg', { type: blob.type || 'image/jpeg' })
            const preview = URL.createObjectURL(blob)
            onPick(cropped, preview)
            setPendingFile(null)
          }}
        />
      </div>
    </div>
  )
}

function DroppableColumn({ id, header, children, className = '', fluid = false }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div className={`${fluid ? 'min-w-0 flex-1' : 'w-72 shrink-0'} ${className}`}>
      <div className={`rounded-2xl border p-4 min-h-[60vh] ${isOver ? 'border-blue-400/50 bg-blue-500/10' : 'border-white/10 bg-black/20'}`}>
        {header}
        <div ref={setNodeRef} className="mt-4 space-y-2 min-h-[40vh]">
          {children}
        </div>
      </div>
    </div>
  )
}

function CardVisual({ c, handle, onOpen, draggingOverlay = false, style = {}, setNodeRef = undefined, dragHandleProps = {} }) {
  const due = formatDueShort(c.due_at)
  const sub = c.project_name ? c.project_name : '—'
  const priority = getPriorityMeta(c.priority)
  const legacySection = (c.section_icon || c.section_name)
    ? [{ id: `legacy-${c.id}`, icon: c.section_icon || 'Tag', color: c.section_color || undefined, name: c.section_name || 'Sección' }]
    : []
  const cardSections = Array.isArray(c.sections) && c.sections.length > 0 ? c.sections : legacySection
  const labels = Array.isArray(c.labels) ? c.labels.slice(0, 2) : []
  const moreLabels = Array.isArray(c.labels) && c.labels.length > 2 ? c.labels.length - 2 : 0

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        borderColor: 'var(--feego-border)',
      }}
      className={
        `relative overflow-hidden rounded-2xl border p-4 pb-14 cursor-pointer transition-all duration-200 ease-out ${
          c.board === 'kanban'
            ? 'bg-white/10 shadow-sm hover:shadow-lg'
            : 'bg-white/5'
        } ` +
        (draggingOverlay ? 'shadow-2xl ring-2 ring-blue-400/40' : '')
      }
      onClick={() => onOpen(c)}
    >
      <div className="flex items-start gap-2">
        <button
          className="mt-0.5 px-2 py-1 rounded-lg border border-white/10 bg-black/30 text-slate-300"
          style={{ touchAction: 'none' }}
          title="Arrastrar"
          onClick={(e) => e.stopPropagation()}
          {...dragHandleProps}
        >
          ⠿
        </button>
        <div className="min-w-0 flex-1">
          <div className="font-bold break-words">{c.title}</div>
          <div className="text-xs text-slate-400 mt-0.5">{sub}{c.board === 'kanban' ? ` · ${c.status}` : ''}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {priority && (
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${priority.className}`}>
                {priority.label}
              </span>
            )}
            {labels.map((lb) => (
              <span key={lb} className="px-2 py-0.5 rounded-md text-[11px] border border-white/10 bg-white/5 text-slate-300">
                {lb}
              </span>
            ))}
            {moreLabels > 0 && (
              <span className="px-2 py-0.5 rounded-md text-[11px] border border-white/10 bg-white/5 text-slate-400">
                +{moreLabels}
              </span>
            )}
            {due && (
              <span className="px-2 py-0.5 rounded-md text-[11px] border border-white/10 bg-black/30 text-slate-300">
                🗓 {due}
              </span>
            )}
          </div>
          {cardSections.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {cardSections.map((sec) => {
                const SIcon = sec.icon && Icons[sec.icon] ? Icons[sec.icon] : Icons.Tag
                return (
                  <SIcon
                    key={sec.id}
                    className="w-4 h-4"
                    style={{ color: sec.color || undefined }}
                    title={sec.name || 'Sección'}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* corner action */}
      {c.board === 'ideas' && (
        <button
          className={styles.ideasCornerAction}
          title="Pasar a Por hacer"
          onClick={(e) => { e.stopPropagation(); handle('toTodo', c) }}
        >
          <Icons.ArrowRight className="w-4 h-4" />
        </button>
      )}

      {c.board === 'kanban' && c.status === 'done' && (
        <button
          className="absolute right-3 bottom-3 w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 flex items-center justify-center"
          title="Archivar"
          onClick={(e) => { e.stopPropagation(); handle('archive', c) }}
        >
          ⤵
        </button>
      )}
    </div>
  )
}

function SortableCard({ c, handle, onOpen }) {
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
      setNodeRef={setNodeRef}
      style={{ ...style, borderColor: 'var(--feego-border)' }}
      dragHandleProps={{ ...listeners, ...attributes }}
      draggingOverlay={isDragging}
    />
  )
}

export default function KanbanPage() {
  const [idx, setIdx] = React.useState(1)
  const [state, setState] = React.useState({ projects: [], sections: [], cards: [] })
  const [loading, setLoading] = React.useState(true)
  const dragOriginContainerRef = React.useRef(null)

  const [newProjectOpen, setNewProjectOpen] = React.useState(false)
  const [projectName, setProjectName] = React.useState('')

  const [editOpen, setEditOpen] = React.useState(false)
  const [edit, setEdit] = React.useState({ id: 0, name: '', description: '', logo_path: null })
  const [editLogoFile, setEditLogoFile] = React.useState(null)
  const [editLogoPreview, setEditLogoPreview] = React.useState(null)

  const [secName, setSecName] = React.useState('')
  const [secColor, setSecColor] = React.useState('#64748b')
  const [secIcon, setSecIcon] = React.useState('Tag')
  const [iconPickerOpen, setIconPickerOpen] = React.useState(false)
  const [iconPickerTarget, setIconPickerTarget] = React.useState('create')
  const [secEditOpen, setSecEditOpen] = React.useState(false)
  const [secEdit, setSecEdit] = React.useState({ id: 0, name: '', color: '#64748b', icon: 'Tag' })

  const [cardOpen, setCardOpen] = React.useState(false)
  const [cardEdit, setCardEdit] = React.useState({ id: 0, title: '', notes: '', project_id: null, section_id: null, section_ids: [], due_at: null, priority: null, labels: [] })

  const [newCardOpen, setNewCardOpen] = React.useState(false)
  const [newCard, setNewCard] = React.useState({ title: '', notes: '', project_id: null, section_id: null, section_ids: [], priority: null })

  function openNewCard(project_id = null) {
    setNewCard({ title: '', notes: '', project_id, section_id: null, section_ids: [], priority: null })
    setNewCardOpen(true)
  }

  // per-column section filter (Ideas board only): { [projectId]: sectionName|'__ALL__'|'__NONE__' }
  const [sectionFilterByProject, setSectionFilterByProject] = React.useState({})
  // per-column priority filter (Ideas board only): { [projectId]: priority|'__ALL__' }
  const [priorityFilterByProject, setPriorityFilterByProject] = React.useState({})

  const sensors = useSensors(
    // iOS Safari: TouchSensor can interfere with horizontal scroll; PointerSensor works better.
    useSensor(PointerSensor, { activationConstraint: { distance: 12 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  async function refresh() {
    setLoading(true)
    const r = await api('/api/kanban/state')
    if (r.ok) setState(r.data)
    setLoading(false)
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

  async function quick(act, c) {
    if (act === 'toTodo') {
      await api('/api/kanban/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id, board: 'kanban', status: 'todo' }),
      })
    }
    if (act === 'archive') {
      await api('/api/kanban/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id, board: 'archived', status: 'n/a' }),
      })
    }
    refresh()
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
    let out = state.cards.filter((c) => containerIdForCard(c) === containerId)

    // Ideas: apply section filter per project column
    if (boards[idx].key === 'ideas' && containerId.startsWith('ideas:project:')) {
      const pid = Number(containerId.split(':').pop())
      const sectionSel = sectionFilterByProject[pid] || '__ALL__'
      const prioritySel = priorityFilterByProject[pid] || '__ALL__'

      if (sectionSel === '__NONE__') {
        out = out.filter((c) => !c.section_name)
      } else if (sectionSel !== '__ALL__') {
        out = out.filter((c) => (c.section_name || '') === sectionSel)
      }

      if (prioritySel !== '__ALL__') {
        out = out.filter((c) => Number(c.priority) === Number(prioritySel))
      }
    }

    out.sort((a, b) => (a.sort || 0) - (b.sort || 0))
    return out
  }

  function containersForView() {
    const k = boards[idx].key
    if (k === 'kanban') return ['kanban:todo', 'kanban:doing', 'kanban:done']
    if (k === 'ideas') return state.projects.map((p) => `ideas:project:${p.id}`)
    return state.projects.map((p) => `archived:project:${p.id}`)
  }

  function onDragStart(event) {
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
    const { active, over } = event
    if (!over) return

    const activeId = String(active?.id || '')
    const overId = String(over?.id || '')
    if (!activeId.startsWith('card:')) return

    const cardId = Number(activeId.split(':')[1])
    const activeCard = state.cards.find((x) => Number(x.id) === cardId)
    if (!activeCard) return

    let toContainer = overId
    if (overId.startsWith('card:')) {
      const overCardId = Number(overId.split(':')[1])
      const overCard = state.cards.find((x) => Number(x.id) === overCardId)
      if (!overCard) return
      toContainer = containerIdForCard(overCard)
    }

    const toInfo = parseContainer(toContainer)
    if (!toInfo) return

    const currentContainer = containerIdForCard(activeCard)
    if (currentContainer === toContainer) return

    setState((prev) => {
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
      return { ...prev, cards: nextCards }
    })
  }

  async function onDragEnd(event) {
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
    const c = state.cards.find((x) => Number(x.id) === cardId)
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
      const oc = state.cards.find((x) => Number(x.id) === overCardId)
      if (!oc) return
      toContainer = containerIdForCard(oc)
    }

    const toInfo = parseContainer(toContainer)
    if (!toInfo) return
    const sameContainer = fromContainer === toContainer

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

        await api('/api/kanban/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
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
      { id: c.id, project_id: toInfo.project_id }
    )
    // Then compact source sorts.
    await persistContainerOrder(fromInfo, remainingFrom)

    refresh()
    return

  }

  function openEditProject(p) {
    setEdit({ id: p.id, name: p.name, description: p.description || '', logo_path: p.logo_path || null })
    setEditLogoFile(null)
    setEditLogoPreview(null)
    setSecName('')
    setSecColor('#64748b')
    setSecIcon('Tag')
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
    })
    setCardOpen(true)
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

  async function deleteCardFromModal() {
    if (!cardEdit.id) return
    const r = await api(`/api/kanban/card?id=${encodeURIComponent(cardEdit.id)}`, { method: 'DELETE' })
    if (!r.ok) {
      toast.error('Error eliminando tarjeta')
      return
    }
    toast.success('Tarjeta eliminada')
    setCardOpen(false)
    refresh()
  }

  function confirmDeleteCardFromModal() {
    if (!cardEdit.id) return
    toast.custom((t) => (
      <div
        className="feego-modal rounded-xl p-3 border border-white/10 max-w-sm"
        style={{
          animation: t.visible
            ? 'toast-in 220ms cubic-bezier(0.16, 1, 0.3, 1) forwards'
            : 'toast-out 180ms ease-in forwards',
        }}
      >
        <div className="font-bold text-sm">¿Eliminar tarjeta definitivamente?</div>
        <div className="text-xs text-slate-400 mt-1">
          Esta acción no se puede deshacer.
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
              await deleteCardFromModal()
            }}
          >
            Sí, eliminar
          </button>
        </div>
      </div>
    ), { duration: 12000 })
  }

  async function saveProject() {
    const name = edit.name.trim()
    if (!name) return

    const r = await api('/api/kanban/project/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: edit.id, name, description: edit.description || '' }),
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

  const iconCatalog = [
    'Tag','Briefcase','Wrench','Globe','ShoppingCart','Home','Users','User','Rocket','Megaphone',
    'Camera','Video','FileText','Folder','Book','GraduationCap','Heart','Star','Gift','Bell',
    'Calendar','Clock','Phone','Mail','MapPin','Bolt','Flame','Lightbulb','Shield','CreditCard',
    'Hammer','Building2','Truck','Store','Package','DollarSign','PiggyBank','ChartLine','Target','CheckCircle2'
  ]

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

  const viewKey = boards[idx].key
  const containers = containersForView()

  return (
    <div className="space-y-4 -mx-4 md:-mx-6">
      {/* Header: arrows+title centered; buttons below */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-center gap-2 w-full overflow-hidden">
          <ArrowBtn onClick={() => setIdx((idx + boards.length - 1) % boards.length)}>‹</ArrowBtn>
          <div className="font-black text-lg text-center min-w-[140px]">{boards[idx].title}</div>
          <ArrowBtn onClick={() => setIdx((idx + 1) % boards.length)}>›</ArrowBtn>
        </div>

        <div className="flex items-center justify-end mr-8">
            <Dialog.Root open={newProjectOpen} onOpenChange={setNewProjectOpen}>
              <Dialog.Trigger asChild>
                <button className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold">Nuevo proyecto</button>
              </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="feego-overlay fixed inset-0" />
              <Dialog.Content className="feego-modal fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md rounded-2xl p-4">
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

      {loading ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : (
        <div className="w-full max-w-full md:rounded-2xl md:border md:border-white/10 md:bg-white/5 md:backdrop-blur-xl p-0">
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
              className={`w-full max-w-full flex gap-4 overflow-y-hidden pb-6 ${viewKey === 'kanban' ? 'overflow-x-auto lg:overflow-x-hidden' : 'overflow-x-scroll'}`}
              style={{
                WebkitOverflowScrolling: 'touch',
                overflowAnchor: 'none',
                overscrollBehaviorX: 'contain',
              }}
            >
              {containers.map((cid, colIndex) => {
                const info = parseContainer(cid)
                const cards = cardsInContainer(cid)
                let header = null
                if (cid.startsWith('kanban:')) {
                  const st = cid.split(':')[1]
                  const title = st === 'todo' ? 'Por hacer' : st === 'doing' ? 'Haciendo' : 'Hecho'
                  const tone = st === 'todo'
                    ? 'border-blue-400/30 bg-blue-500/15 text-blue-200'
                    : st === 'doing'
                      ? 'border-amber-400/30 bg-amber-500/15 text-amber-200'
                      : 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200'
                  header = (
                    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold">{title}</div>
                          <div className="text-xs text-slate-400">Kanban</div>
                        </div>
                        <span className={`px-2 py-2 min-w-8 text-center rounded-lg text-xs font-semibold border ${tone}`}>
                          {cards.length}
                        </span>
                      </div>
                    </div>
                  )
                } else {
                  const pid = Number(cid.split(':').pop())
                  const p = state.projects.find((x) => Number(x.id) === pid)
                  const img = p ? projectAvatar(p) : null
                  header = (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <ProjectAvatar src={img} />
                        <div className="min-w-0">
                          <div className="font-extrabold truncate">{p?.name || 'Proyecto'}</div>
                          <div className="text-xs text-slate-400">
                            {viewKey === 'ideas' ? 'Ideas' : 'Archivadas'} · {cards.length}
                          </div>
                          {p?.description && (
                            <div className="text-[11px] text-slate-400 truncate">{p.description}</div>
                          )}
                        </div>
                      </div>

                      {(viewKey === 'ideas') && p && (
                        <div className="flex items-center gap-2">
                          {/* add card (ideas) */}
                          <button
                            onClick={() => openNewCard(p.id)}
                            className="px-2 py-1 rounded-lg border border-white/10 bg-emerald-600/20 hover:bg-emerald-600/30"
                            title="Agregar tarjeta"
                          >
                            <Icons.Plus className="w-4 h-4" />
                          </button>

                          {/* section filter per project column */}
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                              <button className="px-2 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10" title="Filtrar por sección">
                                <Icons.Filter className="w-4 h-4" />
                              </button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.Content sideOffset={6} className="feego-modal max-h-[60vh] overflow-auto rounded-2xl p-1">
                                <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-slate-400">Sección</div>
                                <DropdownMenu.Item
                                  className="px-3 py-2 text-sm rounded-lg hover:bg-white/10"
                                  onSelect={(e) => { e.preventDefault(); setSectionFilterByProject((m) => ({ ...m, [p.id]: '__ALL__' })) }}
                                >
                                  Todas
                                </DropdownMenu.Item>
                                <DropdownMenu.Item
                                  className="px-3 py-2 text-sm rounded-lg hover:bg-white/10"
                                  onSelect={(e) => { e.preventDefault(); setSectionFilterByProject((m) => ({ ...m, [p.id]: '__NONE__' })) }}
                                >
                                  Sin sección
                                </DropdownMenu.Item>
                                <div className="h-px bg-white/10 my-1" />
                                {sectionListForProject(state, p.id)
                                  .map((sec) => (
                                    <DropdownMenu.Item
                                      key={sec.id}
                                      className="px-3 py-2 text-sm rounded-lg hover:bg-white/10 flex items-center gap-2"
                                      onSelect={(e) => { e.preventDefault(); setSectionFilterByProject((m) => ({ ...m, [p.id]: sec.name })) }}
                                    >
                                      <IconByName name={sec.icon} className="w-4 h-4 shrink-0" style={{ color: sec.color || undefined }} />
                                      <span className="truncate">{sec.name}</span>
                                    </DropdownMenu.Item>
                                  ))}
                                <div className="h-px bg-white/10 my-1" />
                                <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-slate-400">Prioridad</div>
                                <DropdownMenu.Item
                                  className="px-3 py-2 text-sm rounded-lg hover:bg-white/10"
                                  onSelect={(e) => { e.preventDefault(); setPriorityFilterByProject((m) => ({ ...m, [p.id]: '__ALL__' })) }}
                                >
                                  Todas
                                </DropdownMenu.Item>
                                {PRIORITY_OPTIONS.map((opt) => (
                                  <DropdownMenu.Item
                                    key={opt.value}
                                    className="px-3 py-2 text-sm rounded-lg hover:bg-white/10"
                                    onSelect={(e) => { e.preventDefault(); setPriorityFilterByProject((m) => ({ ...m, [p.id]: opt.value })) }}
                                  >
                                    {opt.label}
                                  </DropdownMenu.Item>
                                ))}
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Root>

                          {/* edit project */}
                          <button onClick={() => openEditProject(p)} className="px-2 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10" title="Editar proyecto">
                            <Icons.Pencil className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                }
                const items = cards.map((c) => `card:${c.id}`)

                return (
                  <SortableContext key={cid} id={cid} items={items}>
                    <DroppableColumn
                      id={cid}
                      header={header}
                      fluid={viewKey === 'kanban'}
                      className={`${colIndex === 0 ? 'ml-4' : ''} ${colIndex === containers.length - 1 ? 'mr-4' : ''}`}
                    >
                      {cards.map((c) => (
                        <SortableCard key={c.id} c={c} handle={quick} onOpen={openEditCard} />
                      ))}
                    </DroppableColumn>
                  </SortableContext>
                )
              })}
            </div>

          </DndContext>
        </div>
      )}

      {/* New card modal */}
      <Dialog.Root open={newCardOpen} onOpenChange={setNewCardOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="feego-overlay fixed inset-0" />
          <Dialog.Content className="feego-modal fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-2xl rounded-2xl p-4">
            <Dialog.Title className="font-extrabold">Nueva tarjeta</Dialog.Title>
            <div className="text-xs text-slate-400 mt-1">Se crea en el tablero <b>ideas</b>.</div>

            <div className="mt-3 space-y-3">
              <div className={panelClass}>
                <div className="text-sm font-semibold">Detalles</div>
                <div className="mt-3">
                  <div className={fieldLabelClass}>Título</div>
                  <input value={newCard.title} onChange={(e) => setNewCard({ ...newCard, title: e.target.value })} className={fieldInputClass} />
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className={fieldLabelClass}>Proyecto</div>
                  <select value={newCard.project_id || ''} onChange={(e) => {
                    const pid = e.target.value ? Number(e.target.value) : null;
                    setNewCard({ ...newCard, project_id: pid, section_id: null, section_ids: [] });
                  }} className={fieldInputClass}>
                    <option value="">(sin proyecto)</option>
                    {(state.projects || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  </div>
                  <div>
                    <div className={fieldLabelClass}>Sección</div>
                    <select value={newCard.section_id || ''} onChange={(e) => {
                      const sid = e.target.value ? Number(e.target.value) : null
                      setNewCard({ ...newCard, section_id: sid, section_ids: sid ? [sid] : [] })
                    }} className={fieldInputClass}>
                      <option value="">Sin sección</option>
                      {sectionListForProject(state, newCard.project_id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className={fieldLabelClass}>Prioridad</div>
                    <select value={newCard.priority || ''} onChange={(e) => setNewCard({ ...newCard, priority: e.target.value ? Number(e.target.value) : null })} className={fieldInputClass}>
                      <option value="">—</option>
                      {PRIORITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div />
                </div>
              </div>

              <div className={panelClass}>
                <div className={fieldLabelClass}>Notas</div>
                <textarea value={newCard.notes} onChange={(e) => setNewCard({ ...newCard, notes: e.target.value })} className={fieldInputClass} rows={4} />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button className="px-3 py-2 rounded-lg border border-white/10 bg-white/5">Cancelar</button>
              </Dialog.Close>
              <button onClick={async ()=>{
                const payload = {
                  title: (newCard.title || '').trim(),
                  notes: newCard.notes || '',
                  project_id: newCard.project_id,
                  section_id: newCard.section_id,
                  priority: newCard.priority,
                  section_ids: Array.isArray(newCard.section_ids) ? newCard.section_ids : [],
                  board: 'ideas',
                  status: 'todo',
                };
                if(!payload.title){ alert('Falta el título'); return; }
                const r = await api('/api/kanban/card', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
                if(!r.ok){ alert('Error creando tarjeta'); return; }
                setNewCardOpen(false);
                refresh();
              }} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold">Crear</button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Edit card modal */}
      <Dialog.Root open={cardOpen} onOpenChange={setCardOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="feego-overlay fixed inset-0" />
          <Dialog.Content className="feego-modal fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-2xl rounded-2xl p-4">
            <Dialog.Title className="font-extrabold">Editar tarjeta</Dialog.Title>
            <div className="text-xs text-slate-400 mt-1">Edición completa (guardado en BD).</div>

            <div className="mt-3 space-y-3">
              <div className={panelClass}>
                <div className="text-sm font-semibold">Detalles</div>
                <div className="mt-3">
                  <div className={fieldLabelClass}>Título</div>
                  <input value={cardEdit.title} onChange={(e) => setCardEdit({ ...cardEdit, title: e.target.value })} className={fieldInputClass} />
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className={fieldLabelClass}>Proyecto</div>
                  <select value={cardEdit.project_id || ''} onChange={(e) => {
                    const pid = e.target.value ? Number(e.target.value) : null;
                    setCardEdit({ ...cardEdit, project_id: pid, section_id: null, section_ids: [] });
                  }} className={fieldInputClass}>
                    <option value="">(sin proyecto)</option>
                    {(state.projects || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  </div>
                  <div>
                    <div className={fieldLabelClass}>Sección</div>
                    <div className="mt-1 flex flex-wrap gap-2 rounded-lg border border-white/10 bg-black/30 p-2 min-h-[42px]">
                      {sectionListForProject(state, cardEdit.project_id).map((s) => {
                        const selected = Array.isArray(cardEdit.section_ids) && cardEdit.section_ids.includes(Number(s.id))
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              const current = Array.isArray(cardEdit.section_ids) ? cardEdit.section_ids : []
                              const next = selected
                                ? current.filter((id) => Number(id) !== Number(s.id))
                                : [...current, Number(s.id)]
                              setCardEdit({
                                ...cardEdit,
                                section_ids: next,
                                section_id: next.length > 0 ? next[0] : null,
                              })
                            }}
                            className={`px-2 py-1 rounded-md border text-xs inline-flex items-center gap-1 ${selected ? 'bg-white/10' : 'bg-white/5'}`}
                            style={{ borderColor: selected ? 'var(--color-accent)' : (s.color || 'rgba(255,255,255,0.12)') }}
                            title={s.name}
                          >
                            <IconByName name={s.icon} className="w-3.5 h-3.5" style={{ color: s.color || undefined }} />
                            <span>{s.name}</span>
                          </button>
                        )
                      })}
                      {sectionListForProject(state, cardEdit.project_id).length === 0 && (
                        <div className="text-xs text-slate-400">Sin secciones disponibles</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className={panelClass}>
                <div className="text-sm font-semibold">Planificación</div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className={fieldLabelClass}>Fecha límite</div>
                    <input value={cardEdit.due_at ? cardEdit.due_at.slice(0,16) : ''} onChange={(e) => {
                      const v = e.target.value;
                      setCardEdit({ ...cardEdit, due_at: v ? new Date(v).toISOString() : null });
                    }} type="datetime-local" className={fieldInputClass} />
                  </div>
                  <div>
                    <div className={fieldLabelClass}>Prioridad</div>
                    <select value={cardEdit.priority || ''} onChange={(e) => setCardEdit({ ...cardEdit, priority: e.target.value ? Number(e.target.value) : null })} className={fieldInputClass}>
                      <option value="">—</option>
                      {PRIORITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <div className={fieldLabelClass}>Labels (separadas por coma)</div>
                    <input value={(cardEdit.labels || []).join(', ')} onChange={(e) => setCardEdit({ ...cardEdit, labels: e.target.value.split(',').map(x=>x.trim()).filter(Boolean) })} className={fieldInputClass} placeholder="ej: urgente, clientes" />
                  </div>
                </div>
              </div>

              <div className={panelClass}>
                <div className={fieldLabelClass}>Notas</div>
                <textarea value={cardEdit.notes} onChange={(e) => setCardEdit({ ...cardEdit, notes: e.target.value })} className={fieldInputClass} rows={4} />
              </div>
            </div>

            <div className="mt-4 flex justify-between gap-2">
              <div className="flex gap-2">
                <button
                  onClick={archiveCardFromModal}
                  className="w-9 h-9 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 inline-flex items-center justify-center"
                  title="Archivar tarjeta"
                >
                  <Icons.Archive className="w-4 h-4" />
                </button>
                <button
                  onClick={confirmDeleteCardFromModal}
                  className={`${styles.dangerAction} w-9 h-9 rounded-lg inline-flex items-center justify-center`}
                  title="Eliminar tarjeta"
                >
                  <Icons.Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2">
                <Dialog.Close asChild>
                  <button className="px-3 py-2 rounded-lg border border-white/10 bg-white/5">Cancelar</button>
                </Dialog.Close>
                <button onClick={async ()=>{
                  const r = await api('/api/kanban/card/update', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(cardEdit) });
                  if(!r.ok){
                    if (r.status === 409 || r.data?.error === 'multi_section_requires_migration') {
                      alert('Para guardar múltiples secciones por tarjeta, ejecuta "npm run migrate" en backend y reinicia el servidor.')
                      return
                    }
                    alert('Error guardando')
                    return
                  }
                  setCardOpen(false);
                  refresh();
                }} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold">Guardar</button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Edit project modal */}
      <Dialog.Root open={editOpen} onOpenChange={setEditOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="feego-overlay fixed inset-0" />
          <Dialog.Content className="feego-modal fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-2xl rounded-2xl p-4">
            <Dialog.Title className="font-extrabold">Editar proyecto</Dialog.Title>

            {/* Logo picker (hidden input) */}
            <ProjectLogoPicker
              logoPath={edit.logo_path}
              previewUrl={editLogoPreview}
              onPick={(file, preview) => { setEditLogoFile(file); setEditLogoPreview(preview); }}
            />

            <div className="mt-3 space-y-3">
              <div className={panelClass}>
                <div className="text-sm font-semibold">Identidad</div>
                <div className="mt-3">
                  <div className={fieldLabelClass}>Nombre</div>
                  <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={fieldInputClass} />
                </div>
                <div className="mt-3">
                  <div className={fieldLabelClass}>Descripción</div>
                  <textarea value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} className={fieldInputClass} rows={3} />
                </div>
              </div>

              {/* Sections manager */}
              <div className={panelClass}>
                <div className="text-sm font-semibold">Secciones</div>

                <div className="mt-2 flex gap-2">
                  <input value={secName} onChange={(e)=>setSecName(e.target.value)} className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2" placeholder="Ej: QMT" />
                  <input value={secColor} onChange={(e)=>setSecColor(e.target.value)} type="color" className="w-12 h-10 rounded-lg border border-white/10 bg-black/30" title="Color" />
                  <button
                    onClick={() => { setIconPickerTarget('create'); setIconPickerOpen(true) }}
                    className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
                    title="Icono"
                  >
                    <IconByName name={secIcon} className="w-5 h-5" />
                  </button>
                  <button onClick={addSection} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold">Agregar</button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {sectionListForProject(state, edit.id).map(s => (
                    <button
                      key={s.id}
                      onClick={()=>openEditSection(s)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-white/5 hover:bg-white/10"
                      style={{ borderColor: 'var(--feego-border)' }}
                      title="Editar sección"
                    >
                      <IconByName name={s.icon} className="w-4 h-4" style={{ color: s.color || undefined }} />
                      <span className="text-sm font-semibold">{s.name}</span>
                    </button>
                  ))}
                  {sectionListForProject(state, edit.id).length === 0 && (
                    <div className="text-xs text-slate-400">Aún no hay secciones.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-between gap-2">
              <button
                onClick={confirmDeleteProjectPermanent}
                className={`${styles.dangerAction} w-9 h-9 rounded-lg inline-flex items-center justify-center`}
                title="Eliminar definitivamente proyecto"
              >
                <Icons.Trash2 className="w-4 h-4" />
              </button>
              <div className="flex gap-2">
                <Dialog.Close asChild>
                  <button className="px-3 py-2 rounded-lg border border-white/10 bg-white/5">Cancelar</button>
                </Dialog.Close>
                <button onClick={saveProject} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold">Guardar</button>
              </div>
            </div>

            {/* Icon Picker Modal */}
            <Dialog.Root open={iconPickerOpen} onOpenChange={setIconPickerOpen}>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/60" />
                <Dialog.Content className="feego-modal fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-lg rounded-2xl p-4">
                  <Dialog.Title className="font-extrabold">Escoge un icono</Dialog.Title>
                  <div className="text-xs text-slate-400 mt-1">Colección curada (Lucide).</div>
                  <div className="mt-3 grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-[55vh] overflow-auto">
                    {iconCatalog.map(n => (
                      <button
                        key={n}
                        onClick={() => {
                          if (iconPickerTarget === 'edit') {
                            setSecEdit((prev) => ({ ...prev, icon: n }))
                          } else {
                            setSecIcon(n)
                          }
                          setIconPickerOpen(false)
                        }}
                        className={`rounded-xl border p-2 hover:bg-white/10 ${
                          (iconPickerTarget === 'edit' ? secEdit.icon : secIcon) === n
                            ? 'border-blue-500/50 bg-blue-500/10'
                            : 'border-white/10 bg-white/5'
                        }`}
                        title={n}
                      >
                        <IconByName name={n} className="w-5 h-5 mx-auto" />
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Dialog.Close asChild>
                      <button className="px-3 py-2 rounded-lg border border-white/10 bg-white/5">Cerrar</button>
                    </Dialog.Close>
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>

            {/* Edit Section Modal */}
            <Dialog.Root open={secEditOpen} onOpenChange={setSecEditOpen}>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/60" />
                <Dialog.Content className="feego-modal fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md rounded-2xl p-4">
                  <Dialog.Title className="font-extrabold">Editar sección</Dialog.Title>
                  <div className="mt-3 space-y-3">
                    <div>
                      <div className={fieldLabelClass}>Nombre</div>
                      <input value={secEdit.name} onChange={(e)=>setSecEdit({ ...secEdit, name: e.target.value })} className={fieldInputClass} />
                    </div>
                    <div className="flex items-center gap-2">
                      <input value={secEdit.color} onChange={(e)=>setSecEdit({ ...secEdit, color: e.target.value })} type="color" className="w-12 h-10 rounded-lg border border-white/10 bg-black/30" />
                      <button
                        onClick={() => { setIconPickerTarget('edit'); setIconPickerOpen(true) }}
                        className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
                      >
                        <IconByName name={secEdit.icon} className="w-5 h-5" style={{ color: secEdit.color || undefined }} />
                      </button>
                      <div className="text-xs text-slate-400">Icono: {secEdit.icon}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-between gap-2">
                    <button onClick={()=>deleteSection(secEdit.id)} className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-200">Eliminar</button>
                    <div className="flex gap-2">
                      <Dialog.Close asChild>
                        <button className="px-3 py-2 rounded-lg border border-white/10 bg-white/5">Cancelar</button>
                      </Dialog.Close>
                      <button onClick={saveSection} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold">Guardar</button>
                    </div>
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
