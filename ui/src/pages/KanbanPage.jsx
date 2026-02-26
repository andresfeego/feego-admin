import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Icons from 'lucide-react'
import { api } from '../lib/api'
import ImageCropModal from '../components/ImageCropModal.jsx'

import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  DragOverlay,
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

function ProjectLogoPicker({ logoPath, previewUrl, onPick, aspect = 1 }) {
  const inputRef = React.useRef(null)
  const url = previewUrl ? previewUrl : (logoPath ? `/api/kanban/project/logo?name=${encodeURIComponent(logoPath)}` : null)

  const [cropOpen, setCropOpen] = React.useState(false)
  const [pendingFile, setPendingFile] = React.useState(null)

  return (
    <div className="mt-3 flex justify-center">
      <div className="relative w-24 h-24">
        <div className="w-24 h-24 rounded-full overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center">
          {url ? (
            <img src={url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-white/10" />
          )}
        </div>

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

function DroppableColumn({ id, header, children }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div className="w-72 shrink-0">
      <div className={`rounded-2xl border p-3 min-h-[60vh] ${isOver ? 'border-blue-400/50 bg-blue-500/10' : 'border-white/10 bg-black/20'}`}>
        {header}
        <div ref={setNodeRef} className="mt-3 space-y-2 min-h-[40vh]">
          {children}
        </div>
      </div>
    </div>
  )
}

function SortableCard({ c, handle, onOpen, draggingOverlay = false }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `card:${c.id}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // when dragging, hide the original and rely on DragOverlay for a pinned-to-cursor feel
    opacity: draggingOverlay ? 1 : (isDragging ? 0.15 : 1),
  }

  const due = c.due_at ? new Date(c.due_at).toLocaleString() : null
  const sub = c.section_name ? c.section_name : (c.project_name ? c.project_name : '—')

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        borderColor: 'var(--feego-border)',
      }}
      className={
        "relative rounded-2xl border bg-white/5 p-3 pb-14 cursor-pointer " +
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
          {...listeners}
          {...attributes}
        >
          ⠿
        </button>
        <div className="min-w-0 flex-1">
          <div className="font-bold break-words">{c.title}</div>
          <div className="text-xs text-slate-400">{sub}{c.board === 'kanban' ? ` · ${c.status}` : ''}</div>
          {due && <div className="text-xs text-slate-300 mt-1">🗓 {due}</div>}
        </div>
      </div>

      {/* corner action */}
      {c.board === 'ideas' && (
        <button
          className="absolute right-3 bottom-3 w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 border border-blue-300/20 flex items-center justify-center"
          title="Pasar a Por hacer"
          onClick={(e) => { e.stopPropagation(); handle('toTodo', c) }}
        >
          →
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

export default function KanbanPage() {
  const [idx, setIdx] = React.useState(1)
  const [state, setState] = React.useState({ projects: [], sections: [], cards: [] })
  const [loading, setLoading] = React.useState(true)

  const [activeCardId, setActiveCardId] = React.useState(null)

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
  const [secEditOpen, setSecEditOpen] = React.useState(false)
  const [secEdit, setSecEdit] = React.useState({ id: 0, name: '', color: '#64748b', icon: 'Tag' })

  const [cardOpen, setCardOpen] = React.useState(false)
  const [cardEdit, setCardEdit] = React.useState({ id: 0, title: '', notes: '', project_id: null, section_id: null, due_at: null, priority: null, labels: [] })

  const [newCardOpen, setNewCardOpen] = React.useState(false)
  const [newCard, setNewCard] = React.useState({ title: '', notes: '', project_id: null, section_id: null, priority: null })

  function openNewCard(project_id = null) {
    setNewCard({ title: '', notes: '', project_id, section_id: null, priority: null })
    setNewCardOpen(true)
  }

  // per-column section filter (Ideas board only): { [projectId]: sectionName|'__ALL__'|'__NONE__' }
  const [sectionFilterByProject, setSectionFilterByProject] = React.useState({})

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
      const sel = sectionFilterByProject[pid] || '__ALL__'
      if (sel === '__NONE__') {
        out = out.filter((c) => !c.section_name)
      } else if (sel !== '__ALL__') {
        out = out.filter((c) => (c.section_name || '') === sel)
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
    const { active } = event
    const activeId = String(active.id)
    if (activeId.startsWith('card:')) {
      setActiveCardId(Number(activeId.split(':')[1]))
    }
  }

  function onDragCancel() {
    setActiveCardId(null)
  }

  async function onDragEnd(event) {
    const { active, over } = event
    setActiveCardId(null)
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)
    if (!activeId.startsWith('card:')) return

    const cardId = Number(activeId.split(':')[1])
    const c = state.cards.find((x) => Number(x.id) === cardId)
    if (!c) return

    // If dropped over a card, infer the container from that card; otherwise overId is a container id
    let toContainer = overId
    if (overId.startsWith('card:')) {
      const overCardId = Number(overId.split(':')[1])
      const oc = state.cards.find((x) => Number(x.id) === overCardId)
      if (!oc) return
      toContainer = containerIdForCard(oc)
    }

    const toInfo = parseContainer(toContainer)
    if (!toInfo) return

    // append by default
    const toCards = cardsInContainer(toContainer)
    const newSort = toCards.length

    await api('/api/kanban/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: c.id,
        board: toInfo.board,
        status: toInfo.status,
        project_id: toInfo.project_id,
        sort: newSort,
      }),
    })

    refresh()
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
      due_at: c.due_at || null,
      priority: c.priority || null,
      labels: Array.isArray(c.labels) ? c.labels : [],
    })
    setCardOpen(true)
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

  const iconCatalog = [
    'Tag','Briefcase','Wrench','Globe','ShoppingCart','Home','Users','User','Rocket','Megaphone',
    'Camera','Video','FileText','Folder','Book','GraduationCap','Heart','Star','Gift','Bell',
    'Calendar','Clock','Phone','Mail','MapPin','Bolt','Flame','Lightbulb','Shield','CreditCard',
    'Hammer','Building2','Truck','Store','Package','DollarSign','PiggyBank','ChartLine','Target','CheckCircle2'
  ]

  function IconByName({ name, className }) {
    const C = Icons[name] || Icons.Tag
    return <C className={className || 'w-4 h-4'} />
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
    if (!r.ok) return alert('Error guardando sección')
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
    <div className="space-y-4">
      {/* Header: arrows+title centered; buttons below */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-center gap-2 w-full overflow-hidden">
          <ArrowBtn onClick={() => setIdx((idx + boards.length - 1) % boards.length)}>‹</ArrowBtn>
          <div className="font-black text-lg text-center min-w-[140px]">{boards[idx].title}</div>
          <ArrowBtn onClick={() => setIdx((idx + 1) % boards.length)}>›</ArrowBtn>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Dialog.Root open={newProjectOpen} onOpenChange={setNewProjectOpen}>
              <Dialog.Trigger asChild>
                <button className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold">Nuevo proyecto</button>
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

          <div className="text-xs text-slate-400">Tip: usa el ícono ⠿ de cada tarjeta para arrastrar (mejor en móvil).</div>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : (
        <div className="w-full max-w-full md:rounded-2xl md:border md:border-white/10 md:bg-white/5 md:backdrop-blur-xl md:p-4 p-0 -mx-4 md:mx-0">
          {/* Full-width viewport container; horizontal scroll ONLY inside this container */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragCancel={onDragCancel}
            onDragEnd={onDragEnd}
          >
            <div
              className="w-full max-w-full flex gap-3 overflow-x-scroll overflow-y-hidden pb-6 px-2"
              style={{
                WebkitOverflowScrolling: 'touch',
                overflowAnchor: 'none',
                overscrollBehaviorX: 'contain',
              }}
            >
              {containers.map((cid) => {
                const info = parseContainer(cid)
                let header = null
                if (cid.startsWith('kanban:')) {
                  const st = cid.split(':')[1]
                  const title = st === 'todo' ? 'Por hacer' : st === 'doing' ? 'Haciendo' : 'Hecho'
                  header = (
                    <div>
                      <div className="font-extrabold">{title}</div>
                      <div className="text-xs text-slate-400">{viewKey}</div>
                    </div>
                  )
                } else {
                  const pid = Number(cid.split(':').pop())
                  const p = state.projects.find((x) => Number(x.id) === pid)
                  const img = p ? projectAvatar(p) : null
                  header = (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-full border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center shrink-0">
                          {img ? (
                            <img src={img} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <div className="w-full h-full bg-white/10" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold truncate">{p?.name || 'Proyecto'}</div>
                          <div className="text-xs text-slate-400">{viewKey === 'ideas' ? 'Ideas' : 'Archivadas'}</div>
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
                                      className="px-3 py-2 text-sm rounded-lg hover:bg-white/10"
                                      onSelect={(e) => { e.preventDefault(); setSectionFilterByProject((m) => ({ ...m, [p.id]: sec.name })) }}
                                    >
                                      {sec.name}
                                    </DropdownMenu.Item>
                                  ))}
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Root>

                          {/* edit project */}
                          <button onClick={() => openEditProject(p)} className="px-2 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10" title="Editar proyecto">
                            ✎
                          </button>
                        </div>
                      )}
                    </div>
                  )
                }

                const cards = cardsInContainer(cid)
                const items = cards.map((c) => `card:${c.id}`)

                return (
                  <SortableContext key={cid} id={cid} items={items}>
                    <DroppableColumn id={cid} header={header}>
                      {cards.map((c) => (
                        <SortableCard key={c.id} c={c} handle={quick} onOpen={openEditCard} />
                      ))}
                    </DroppableColumn>
                  </SortableContext>
                )
              })}
            </div>

            <DragOverlay dropAnimation={null}>
              {activeCardId ? (
                <div className="w-72">
                  <SortableCard
                    c={state.cards.find((x) => Number(x.id) === Number(activeCardId)) || { id: activeCardId, title: '…' }}
                    handle={() => {}}
                    onOpen={() => {}}
                    draggingOverlay
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      {/* New card modal */}
      <Dialog.Root open={newCardOpen} onOpenChange={setNewCardOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="feego-overlay fixed inset-0" />
          <Dialog.Content className="feego-modal fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md rounded-2xl p-4">
            <Dialog.Title className="font-extrabold">Nueva tarjeta</Dialog.Title>
            <div className="text-xs text-slate-400 mt-1">Se crea en el tablero <b>ideas</b>.</div>

            <div className="mt-3 space-y-3">
              <div>
                <div className="text-xs text-slate-400">Título</div>
                <input value={newCard.title} onChange={(e) => setNewCard({ ...newCard, title: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-400">Proyecto</div>
                  <select value={newCard.project_id || ''} onChange={(e) => {
                    const pid = e.target.value ? Number(e.target.value) : null;
                    setNewCard({ ...newCard, project_id: pid, section_id: null });
                  }} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                    <option value="">(sin proyecto)</option>
                    {(state.projects || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Sección</div>
                  <select value={newCard.section_id || ''} onChange={(e) => setNewCard({ ...newCard, section_id: e.target.value ? Number(e.target.value) : null })} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                    <option value="">Sin sección</option>
                    {sectionListForProject(state, newCard.project_id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-400">Prioridad</div>
                  <select value={newCard.priority || ''} onChange={(e) => setNewCard({ ...newCard, priority: e.target.value ? Number(e.target.value) : null })} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                    <option value="">—</option>
                    <option value="1">P1</option>
                    <option value="2">P2</option>
                    <option value="3">P3</option>
                    <option value="4">P4</option>
                  </select>
                </div>
                <div />
              </div>

              <div>
                <div className="text-xs text-slate-400">Notas</div>
                <textarea value={newCard.notes} onChange={(e) => setNewCard({ ...newCard, notes: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2" rows={4} />
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
                  board: 'ideas',
                  status: 'todo',
                };
                if(!payload.title){ alert('Falta el título'); return; }
                const r = await api('/api/kanban/card/create', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
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
          <Dialog.Content className="feego-modal fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md rounded-2xl p-4">
            <Dialog.Title className="font-extrabold">Editar tarjeta</Dialog.Title>
            <div className="text-xs text-slate-400 mt-1">Edición completa (guardado en BD).</div>

            <div className="mt-3 space-y-3">
              <div>
                <div className="text-xs text-slate-400">Título</div>
                <input value={cardEdit.title} onChange={(e) => setCardEdit({ ...cardEdit, title: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-400">Proyecto</div>
                  <select value={cardEdit.project_id || ''} onChange={(e) => {
                    const pid = e.target.value ? Number(e.target.value) : null;
                    setCardEdit({ ...cardEdit, project_id: pid, section_id: null });
                  }} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                    <option value="">(sin proyecto)</option>
                    {(state.projects || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Sección</div>
                  <select value={cardEdit.section_id || ''} onChange={(e) => setCardEdit({ ...cardEdit, section_id: e.target.value ? Number(e.target.value) : null })} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                    <option value="">Sin sección</option>
                    {sectionListForProject(state, cardEdit.project_id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-400">Fecha (due)</div>
                  <input value={cardEdit.due_at ? cardEdit.due_at.slice(0,16) : ''} onChange={(e) => {
                    const v = e.target.value;
                    setCardEdit({ ...cardEdit, due_at: v ? new Date(v).toISOString() : null });
                  }} type="datetime-local" className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2" />
                </div>
                <div>
                  <div className="text-xs text-slate-400">Prioridad</div>
                  <select value={cardEdit.priority || ''} onChange={(e) => setCardEdit({ ...cardEdit, priority: e.target.value ? Number(e.target.value) : null })} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                    <option value="">—</option>
                    <option value="1">P1</option>
                    <option value="2">P2</option>
                    <option value="3">P3</option>
                    <option value="4">P4</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-400">Labels (separadas por coma)</div>
                <input value={(cardEdit.labels || []).join(', ')} onChange={(e) => setCardEdit({ ...cardEdit, labels: e.target.value.split(',').map(x=>x.trim()).filter(Boolean) })} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2" placeholder="ej: urgente, clientes" />
              </div>

              <div>
                <div className="text-xs text-slate-400">Notas</div>
                <textarea value={cardEdit.notes} onChange={(e) => setCardEdit({ ...cardEdit, notes: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2" rows={4} />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button className="px-3 py-2 rounded-lg border border-white/10 bg-white/5">Cancelar</button>
              </Dialog.Close>
              <button onClick={async ()=>{
                const r = await api('/api/kanban/card/update', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(cardEdit) });
                if(!r.ok){ alert('Error guardando'); return; }
                setCardOpen(false);
                refresh();
              }} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold">Guardar</button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Edit project modal */}
      <Dialog.Root open={editOpen} onOpenChange={setEditOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="feego-overlay fixed inset-0" />
          <Dialog.Content className="feego-modal fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md rounded-2xl p-4">
            <Dialog.Title className="font-extrabold">Editar proyecto</Dialog.Title>
            <div className="text-xs text-slate-400 mt-1">Logo + nombre + descripción + secciones.</div>

            {/* Logo picker (hidden input) */}
            <ProjectLogoPicker
              logoPath={edit.logo_path}
              previewUrl={editLogoPreview}
              onPick={(file, preview) => { setEditLogoFile(file); setEditLogoPreview(preview); }}
            />

            <div className="mt-3 space-y-3">
              <div>
                <div className="text-xs text-slate-400">Nombre</div>
                <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2" />
              </div>
              <div>
                <div className="text-xs text-slate-400">Descripción</div>
                <textarea value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2" rows={3} />
              </div>

              {/* Sections manager */}
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="text-xs text-slate-400">Secciones</div>

                <div className="mt-2 flex gap-2">
                  <input value={secName} onChange={(e)=>setSecName(e.target.value)} className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2" placeholder="Ej: QMT" />
                  <input value={secColor} onChange={(e)=>setSecColor(e.target.value)} type="color" className="w-12 h-10 rounded-lg border border-white/10 bg-black/30" title="Color" />
                  <button onClick={()=>setIconPickerOpen(true)} className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10" title="Icono">
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
                      style={{ borderColor: s.color || 'rgba(255,255,255,0.12)' }}
                      title="Editar sección"
                    >
                      <IconByName name={s.icon} className="w-4 h-4" />
                      <span className="text-sm font-semibold">{s.name}</span>
                    </button>
                  ))}
                  {sectionListForProject(state, edit.id).length === 0 && (
                    <div className="text-xs text-slate-400">Aún no hay secciones.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button className="px-3 py-2 rounded-lg border border-white/10 bg-white/5">Cancelar</button>
              </Dialog.Close>
              <button onClick={saveProject} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold">Guardar</button>
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
                        onClick={()=>{ setSecIcon(n); setIconPickerOpen(false); }}
                        className={`rounded-xl border p-2 hover:bg-white/10 ${secIcon===n ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/10 bg-white/5'}`}
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
                      <div className="text-xs text-slate-400">Nombre</div>
                      <input value={secEdit.name} onChange={(e)=>setSecEdit({ ...secEdit, name: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2" />
                    </div>
                    <div className="flex items-center gap-2">
                      <input value={secEdit.color} onChange={(e)=>setSecEdit({ ...secEdit, color: e.target.value })} type="color" className="w-12 h-10 rounded-lg border border-white/10 bg-black/30" />
                      <button onClick={()=>{ setSecIcon(secEdit.icon); setIconPickerOpen(true); }} className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10">
                        <IconByName name={secEdit.icon} className="w-5 h-5" />
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
