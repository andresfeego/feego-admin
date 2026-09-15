export function progressValue(value) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0
}
export function taskState(card) {
  if (progressValue(card.progress_pct) === 100 || card.status === 'done') return 'done'
  if (progressValue(card.progress_pct) > 0 || card.status === 'doing') return 'doing'
  return 'todo'
}
export function uniqueActive(cards) {
  return [...new Map(cards.filter(c => c.board !== 'archived').map(c => [Number(c.id), c])).values()]
}
export function metrics(cards, now = Date.now()) {
  const tasks = uniqueActive(cards)
  const average = list => list.length ? list.reduce((n, c) => n + progressValue(c.progress_pct), 0) / list.length : 0
  const recent = tasks.filter(c => {
    const date = c.updated_at ? Date.parse(c.updated_at) : NaN
    return date <= now && date >= now - 7 * 86400000
  })
  return { total: tasks.length, progress: average(tasks), weekly: average(recent), touched: recent.length,
    todo: tasks.filter(c => taskState(c) === 'todo').length,
    doing: tasks.filter(c => taskState(c) === 'doing').length,
    done: tasks.filter(c => taskState(c) === 'done').length }
}
export function sectionGroups(cards, sections) {
  return groupSections(uniqueActive(cards), sections)
}
export function archivedSectionGroups(cards, sections) {
  const tasks = [...new Map(cards.filter(c => c.board === 'archived').map(c => [Number(c.id), c])).values()]
  return groupSections(tasks, sections)
}
function groupSections(tasks, sections) {
  const memberships = c => Array.isArray(c.section_ids) && c.section_ids.length ? c.section_ids.map(Number) : c.section_id ? [Number(c.section_id)] : []
  const known = new Set(sections.map(s => Number(s.id)))
  return [...sections.map(s => ({ ...s, cards: tasks.filter(c => memberships(c).includes(Number(s.id))) })),
    { id: 'none', name: 'Sin sección', cards: tasks.filter(c => !memberships(c).some(id => known.has(id))) }]
}
export function cardPayload(card, overrides = {}) {
  return { id: card.id, title: card.title, notes: card.notes || '', project_id: card.project_id ?? null,
    section_id: card.section_id ?? null, section_ids: card.section_ids || [], due_at: card.due_at || null,
    priority: card.priority ?? null, labels: card.labels || [], progress_pct: progressValue(card.progress_pct), ...overrides }
}
export const formatProgress = value => `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(value)}%`

export function orderedSectionTasks(cards, sectionId) {
  const key = String(sectionId === 'none' || sectionId == null ? 0 : sectionId)
  const rank = card => Number.isFinite(Number(card.roadmap_order?.[key])) ? Number(card.roadmap_order[key]) : Number(card.sort || 0)
  const ordered = [...cards].sort((a, b) => rank(a) - rank(b) || Number(a.id) - Number(b.id))
  return { pending: ordered.filter(c => taskState(c) !== 'done'), completed: ordered.filter(c => taskState(c) === 'done') }
}
