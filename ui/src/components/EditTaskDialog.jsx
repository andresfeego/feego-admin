import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Icons from 'lucide-react'
import { Button, Input, Textarea } from './ui'
import Logo from './TaskProjectLogo'
import ProgressControl, { ProgressBar } from './ProgressControl'
import { progressValue, taskState } from '../lib/roadmap.mjs'
import TaskStatus from './TaskStatus'
import './NewTaskDialog.scss'
import './EditTaskDialog.scss'
const priorities = [{value:1,name:'Alta',Icon:Icons.Flame},{value:2,name:'Media',Icon:Icons.Sparkles},{value:3,name:'Baja',Icon:Icons.Leaf}]
function localDate(value) {
  if(!value)return ''
  const date=new Date(value)
  if(Number.isNaN(date.getTime()))return ''
  const pad=n=>String(n).padStart(2,'0')
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
export default function EditTaskDialog({ open, onOpenChange, task, setTask, projects, sections, canEditProgress, saving, onSave, onArchive, onDelete }) {
  const [labelsText,setLabelsText]=React.useState('')
  const [actionBusy,setActionBusy]=React.useState(false)
  React.useEffect(()=>{if(open)setLabelsText((task.labels || []).join(', '))},[open,task.id])
  const disabled=saving || actionBusy
  const available=sections.filter(s=>Number(s.project_id)===Number(task.project_id))
  const selected=(task.section_ids || []).map(Number)
  async function submit(e) {e.preventDefault();if(disabled || !task.title.trim())return;await onSave({...task,title:task.title.trim(),labels:labelsText.split(',').map(v=>v.trim()).filter(Boolean)})}
  async function archive(){setActionBusy(true);try{await onArchive()}finally{setActionBusy(false)}}
  return <Dialog.Root open={open} onOpenChange={v=>{if(!disabled)onOpenChange(v)}}><Dialog.Portal><Dialog.Overlay className="feego-overlay new-task-overlay" /><Dialog.Content className="feego-modal new-task-modal edit-task-modal">
    <form onSubmit={submit}><header className="new-task-header"><span className="new-task-heading-icon"><Icons.ListChecks size={24} /></span><div><Dialog.Title>Editar tarea</Dialog.Title><Dialog.Description>Actualiza los detalles y la planificación.</Dialog.Description></div><Dialog.Close asChild><Button variant="ghost" type="button" disabled={disabled} aria-label="Cerrar edición de tarea"><Icons.X size={19} /></Button></Dialog.Close></header>
    <div className="new-task-body"><fieldset disabled={disabled}>
      <label className="new-task-label" htmlFor="edit-task-title">Título</label><Input id="edit-task-title" className="new-task-title" value={task.title || ''} onChange={e=>setTask(t=>({...t,title:e.target.value}))} required maxLength={255} />
      <section className="edit-task-progress"><div className="edit-task-progress-heading"><h3><Icons.ChartNoAxesCombined size={16} />Avance</h3>{task.board==='archived' ? <span><Icons.Archive size={14} />Archivada</span> : <TaskStatus state={taskState(task)} />}</div>{canEditProgress ? <ProgressControl label="Progreso de la tarea" value={task.progress_pct ?? 0} onChange={value=>setTask(t=>({...t,progress_pct:value,sync_progress:true}))} disabled={disabled} /> : <div className="edit-task-progress-readonly"><ProgressBar value={progressValue(task.progress_pct)} label="Avance de la tarea" /><strong>{progressValue(task.progress_pct)}%</strong></div>}</section>
      <section><h3><Icons.Folders size={16} />Proyecto</h3><div className="new-task-projects" role="group" aria-label="Proyecto de la tarea">{[...projects,{id:null,name:'Sin proyecto'}].map(p=><button type="button" key={p.id || 'none'} className="new-task-project" aria-pressed={task.project_id===p.id} onClick={()=>{if(task.project_id!==p.id)setTask(t=>({...t,project_id:p.id,section_id:null,section_ids:[]}))}}><span className="new-task-project-logo"><Logo project={p} /></span><span>{p.name}</span><Icons.Check size={15} className="new-task-selection" /></button>)}</div></section>
      <section className="new-task-date"><label className="new-task-label" htmlFor="edit-task-date"><Icons.CalendarDays size={16} />Fecha límite <span>Opcional</span></label><Input id="edit-task-date" type="datetime-local" value={localDate(task.due_at)} onChange={e=>setTask(t=>({...t,due_at:e.target.value ? new Date(e.target.value).toISOString() : null}))} /></section>
      <section><h3><Icons.Tags size={16} />Secciones <span>Opcional · puedes elegir varias</span></h3><div className="new-task-badges" role="group" aria-label="Secciones de la tarea"><button type="button" className="new-task-badge" aria-pressed={!selected.length} onClick={()=>setTask(t=>({...t,section_id:null,section_ids:[]}))}><Icons.Minus size={14} />Sin sección</button>{available.map(s=>{const Icon=Icons[s.icon] || Icons.Tag;const checked=selected.includes(Number(s.id));return <button type="button" key={s.id} className="new-task-badge" aria-pressed={checked} onClick={()=>setTask(t=>{const ids=checked ? selected.filter(id=>id!==Number(s.id)) : [...selected,Number(s.id)];return {...t,section_id:ids[0] || null,section_ids:ids}})}><Icon size={14} /><span>{s.name}</span>{checked && <Icons.Check size={13} />}</button>})}</div></section>
      <section><h3><Icons.Flag size={16} />Prioridad</h3><div className="new-task-priorities" role="group" aria-label="Prioridad de la tarea"><button type="button" className="new-task-badge" aria-pressed={task.priority==null} onClick={()=>setTask(t=>({...t,priority:null}))}><Icons.Minus size={14} />Sin prioridad</button>{priorities.map(({value,name,Icon})=><button type="button" key={value} className="new-task-badge" data-priority={value} aria-pressed={task.priority===value} onClick={()=>setTask(t=>({...t,priority:value}))}><Icon size={16} />{name}</button>)}</div></section>
      <section><label className="new-task-label" htmlFor="edit-task-labels"><Icons.Tag size={16} />Etiquetas <span>Opcional</span></label><Input id="edit-task-labels" value={labelsText} onChange={e=>setLabelsText(e.target.value)} placeholder="Urgente, clientes…" aria-describedby="edit-task-labels-hint" /><p id="edit-task-labels-hint" className="edit-task-hint">Separadas por comas.</p></section>
      <label className="new-task-label" htmlFor="edit-task-notes"><Icons.AlignLeft size={16} />Notas <span>Opcional</span></label><Textarea id="edit-task-notes" rows={3} value={task.notes || ''} onChange={e=>setTask(t=>({...t,notes:e.target.value}))} placeholder="Detalles, contexto o próximos pasos…" />
    </fieldset></div>
    <footer className="new-task-footer edit-task-footer"><div className="edit-task-tools">{task.board!=='archived' && <Button type="button" variant="ghost" title="Archivar tarea" aria-label="Archivar tarea" disabled={disabled} onClick={archive}><Icons.Archive size={18} /></Button>}<Button type="button" variant="ghost" className="edit-task-delete" title="Eliminar tarea" aria-label="Eliminar tarea" disabled={disabled} onClick={onDelete}><Icons.Trash2 size={18} /></Button></div><div className="edit-task-save-actions"><Button type="button" variant="outline" disabled={disabled} onClick={()=>onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={disabled || !task.title?.trim()}><Icons.Check size={17} />{saving?'Guardando…':'Guardar cambios'}</Button></div></footer>
    </form></Dialog.Content></Dialog.Portal></Dialog.Root>
}
