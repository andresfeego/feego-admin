// Explicit opt-in integration test; writes temporary fixtures only to restored localhost MariaDB.
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const mysql = require('mysql2/promise');
(async () => {
  const config = require('../knexfile.cjs').connection;
  assert.equal(config.host, '127.0.0.1'); assert.equal(config.port, 3308);
  assert.equal(config.database, 'feegosystem_admin_db');
  if (!process.env.FEEGO_TEST_PASSWORD) throw Error('Set FEEGO_TEST_PASSWORD for the local test account');
  const c = await mysql.createConnection(config);
  const base = 'http://127.0.0.1:3030';
  let cookie, pid;
  async function request(path, body, method = 'POST') {
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await r.json();
    return { status: r.status, data, cookie: r.headers.get('set-cookie') };
  }
  async function ok(path, body, method) { const r = await request(path, body, method); assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.ok, true); return r.data; }
  try {
    const login = await request('/api/login', { username: 'FeegoAdmin', password: process.env.FEEGO_TEST_PASSWORD });
    assert.equal(login.status, 200); cookie = login.cookie.split(';')[0];
    const name = `__roadmap_test_${Date.now()}`;
    await ok('/api/kanban/project', { name });
    [[{ id: pid }]] = await c.query('SELECT id FROM kb_projects WHERE name=?', [name]);
    await ok('/api/kanban/project/update', { id: pid, name, description: 'Temporary integration fixture' });
    await ok('/api/kanban/sections', { project_id: pid, name: 'One', color: '#2563eb', icon: 'Tag' });
    await ok('/api/kanban/sections', { project_id: pid, name: 'Two', color: '#2563eb', icon: 'Tag' });
    const [sections] = await c.query('SELECT id FROM kb_sections WHERE project_id=? ORDER BY id', [pid]);
    const ids = sections.map(s => Number(s.id));
    const payload = { title: 'Temporary task', notes: 'Preserve these notes', project_id: pid, section_id: ids[0], section_ids: ids, due_at: '2026-10-01T15:30:00.000Z', priority: 2, labels: ['test', 'keep'], progress_pct: 0 };
    await ok('/api/kanban/card', { ...payload, board: 'ideas', status: 'n/a' });
    [[{ id: payload.id }]] = await c.query('SELECT id FROM kb_cards WHERE project_id=?', [pid]);
    async function current() { return (await ok('/api/kanban/state', null, 'GET')).cards.find(x => x.id === payload.id); }
    for (const [pct, status] of [[35, 'doing'], [100, 'done'], [0, 'todo']]) {
      await ok('/api/kanban/card/update', { ...payload, progress_pct: pct, sync_progress: true });
      const saved = await current();
      assert.equal(saved.progress_pct, pct); assert.equal(saved.status, status); assert.equal(saved.board, 'kanban');
      assert.deepEqual(saved.section_ids, ids); assert.deepEqual(saved.labels, payload.labels);
      assert.equal(saved.notes, payload.notes); assert.equal(saved.due_at, payload.due_at);
      const [[db]] = await c.query('SELECT progress_pct FROM kb_cards WHERE id=?', [payload.id]); assert.equal(db.progress_pct, pct);
    }
    await ok('/api/kanban/card/update', { ...payload, progress_pct: 45, sync_progress: true });
    const { progress_pct, ...legacy } = payload;
    await ok('/api/kanban/card/update', { ...legacy, title: 'Metadata only' });
    assert.equal((await current()).progress_pct, 45);
    for (const value of [-1, 101, 1.5, null]) assert.equal((await request('/api/kanban/card/update', { ...payload, progress_pct: value })).status, 400);
    assert.equal((await request('/api/kanban/move', { id: payload.id, board: 'kanban', status: 'doing', progress_pct: 0 })).status, 400);
    await ok('/api/kanban/move', { id: payload.id, board: 'kanban', status: 'done', progress_pct: 100 });
    assert.equal((await current()).progress_pct, 100);
    await ok('/api/kanban/move', { id: payload.id, board: 'kanban', status: 'doing', progress_pct: 55 });
    assert.deepEqual((await current()).section_ids, ids);
    await ok('/api/kanban/move', { id: payload.id, board: 'archived', status: 'n/a' });
    assert.equal((await current()).progress_pct, 55);
    await ok('/api/kanban/card/update', { ...payload, progress_pct: 55, sync_progress: true });
    assert.equal((await current()).board, 'archived');
    await ok('/api/kanban/sections/update', { id: ids[0], name: 'Renamed', color: '#2563eb', icon: 'Tag' });
    await ok('/api/kanban/sections/delete', { id: ids[1] });
    assert.deepEqual((await current()).section_ids, [ids[0]]);
    // Validate the correction migration without changing existing user cards.
    await c.query("UPDATE kb_cards SET board='kanban', status='done', progress_pct=0, updated_at='2026-01-01 00:00:00' WHERE id=?", [payload.id]);
    const knex = require('knex')(require('../knexfile.cjs'));
    try { await require('../migrations/20260915060000_backfill_done_progress').up(knex); } finally { await knex.destroy(); }
    const saved = await current(); assert.equal(saved.progress_pct, 100); assert.equal(saved.updated_at, '2026-01-01T00:00:00.000Z');
    // Reordering only unfinished tasks keeps completed slots, other sections and timestamps.
    for (const title of ['Order A', 'Order B', 'Order Done']) await ok('/api/kanban/card', { ...payload, title, section_id: ids[0], section_ids: [ids[0]], board: 'ideas', status: 'n/a' });
    const [fixtures] = await c.query('SELECT id, title FROM kb_cards WHERE project_id=? ORDER BY id', [pid]);
    const aid = fixtures.find(x => x.title === 'Order A').id;
    const bid = fixtures.find(x => x.title === 'Order B').id;
    const did = fixtures.find(x => x.title === 'Order Done').id;
    await c.query('UPDATE kb_cards SET progress_pct=100 WHERE id=?', [did]);
    for (const [rank, id] of [aid, payload.id, bid, did].entries()) await c.query('UPDATE kb_cards SET roadmap_order_json=?, updated_at="2026-01-01 00:00:00" WHERE id=?', [JSON.stringify({ [ids[0]]: rank, 777: 42 }), id]);
    await ok('/api/roadmap/reorder', { project_id: pid, section_id: ids[0], ordered_ids: [bid, aid] });
    const result = (await ok('/api/kanban/state', null, 'GET')).cards.filter(x => x.project_id === pid);
    for (const [rank, id] of [bid, payload.id, aid, did].entries()) {
      const row = result.find(x => x.id === id);
      assert.equal(row.roadmap_order[ids[0]], rank);
      assert.equal(row.roadmap_order[777], 42);
      assert.equal(row.updated_at, '2026-01-01T00:00:00.000Z');
    }
    assert.equal((await request('/api/roadmap/reorder', { project_id: pid, section_id: ids[0], ordered_ids: [bid, aid, did] })).status, 409);
    assert.equal((await request('/api/roadmap/reorder', { project_id: pid, section_id: ids[0], ordered_ids: [aid, aid] })).status, 400);
    console.log('PASS: section order persists, completed slots are stable, other sections/dates preserved, invalid or completed IDs rejected.');
    console.log('PASS: local login, project/section/task CRUD, persisted progress, metadata preservation, atomic moves, archive, validation and migration dates.');
  } finally {
    if (pid) { await c.query('DELETE FROM kb_cards WHERE project_id=?', [pid]); await c.query('DELETE FROM kb_sections WHERE project_id=?', [pid]); await c.query('DELETE FROM kb_projects WHERE id=?', [pid]); }
    if (cookie) await request('/api/logout');
    await c.end();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
