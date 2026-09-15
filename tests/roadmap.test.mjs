import test from 'node:test'
import assert from 'node:assert/strict'
import { metrics, sectionGroups, cardPayload } from '../ui/src/lib/roadmap.mjs'
import progress from '../lib/kanban-progress.cjs'
const now = Date.parse('2026-09-15T12:00:00Z')
const card = (id, pct, extra = {}) => ({ id, board: 'ideas', progress_pct: pct, ...extra })
test('project average counts unique active tasks, including zero', () => {
  const tasks = [card(1, 0), card(2, 50), card(3, 100), card(2, 50), card(4, 100, { board: 'archived' })]
  assert.deepEqual(metrics(tasks, now), { total: 3, progress: 50, weekly: 0, touched: 0, todo: 1, doing: 1, done: 1 })
  assert.equal(metrics([]).progress, 0)
})
test('weekly uses inclusive seven day boundary, excludes future and missing timestamps', () => {
  const tasks = [card(1, 20, { updated_at: new Date(now).toISOString() }), card(2, 60, { updated_at: new Date(now - 7 * 86400000).toISOString() }), card(3, 100, { updated_at: new Date(now + 1).toISOString() }), card(4, 100), card(5, 100, { updated_at: new Date(now - 7 * 86400000 - 1).toISOString() })]
  assert.equal(metrics(tasks, now).weekly, 40)
  assert.equal(metrics(tasks, now).touched, 2)
})
test('multi-section membership does not inflate project average and unresolved sections remain visible', () => {
  const tasks = [card(1, 50, { section_ids: [1, 2] }), card(2, 0), card(3, 100, { section_ids: [99] })]
  const groups = sectionGroups(tasks, [{ id: 1 }, { id: 2 }])
  assert.deepEqual(groups.map(g => g.cards.length), [1, 1, 2])
  assert.equal(metrics(tasks).progress, 50)
})
test('payload preserves nullable metadata and labels when changing progress', () => {
  const payload = cardPayload(card(1, 30, { title: 'Task', notes: 'Keep', section_id: 2, section_ids: [2, 3], labels: ['urgent'], due_at: '2026-09-15T12:00:00Z' }), { progress_pct: 60, sync_progress: true })
  assert.equal(payload.notes, 'Keep')
  assert.deepEqual(payload.section_ids, [2, 3])
  assert.deepEqual(payload.labels, ['urgent'])
  assert.equal(payload.progress_pct, 60)
})
test('progress ranges are explicit and invalid percentages are rejected', () => {
  assert.deepEqual([0, 1, 50, 99, 100].map(progress.progressStatus), ['todo', 'doing', 'doing', 'doing', 'done'])
  for (const value of [-1, 101, 0.5, null, '', '50', NaN]) assert.equal(progress.validProgress(value), false)
})

test('section ordering moves completed tasks below unfinished, preserving both relative orders', async () => {
  const { orderedSectionTasks } = await import('../ui/src/lib/roadmap.mjs')
  const tasks = [card(1, 100, { roadmap_order: { 7: 1, 8: 3 } }), card(2, 20, { roadmap_order: { 7: 2, 8: 0 } }), card(3, 0, { roadmap_order: { 7: 0, 8: 2 } }), card(4, 100, { roadmap_order: { 7: 3, 8: 1 } })]
  assert.deepEqual(orderedSectionTasks(tasks, 7).pending.map(c => c.id), [3, 2])
  assert.deepEqual(orderedSectionTasks(tasks, 7).completed.map(c => c.id), [1, 4])
  assert.deepEqual(orderedSectionTasks(tasks, 8).completed.map(c => c.id), [4, 1])
})

test('archived sections include archived tasks only, multi-section membership and orphan fallback', async () => {
  const { archivedSectionGroups } = await import('../ui/src/lib/roadmap.mjs')
  const sections = [{id:7,name:'Desarrollo',icon:'Code2'},{id:8,name:'Soporte',icon:'Wrench'}]
  const tasks = [{id:1,board:'archived',section_ids:[7,8]}, {id:2,board:'archived',section_id:7}, {id:3,board:'archived',section_ids:[99]}, {id:4,board:'kanban',section_ids:[7]}, {id:1,board:'archived',section_ids:[7,8]}]
  const groups = archivedSectionGroups(tasks, sections)
  assert.deepEqual(groups.map(g=>g.cards.map(c=>c.id)), [[1,2],[1],[3]])
  assert.equal(groups[0].icon,'Code2')
  assert.equal(groups[2].name,'Sin sección')
})
