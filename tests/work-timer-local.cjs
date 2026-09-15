// Explicit opt-in. Only writes disposable fixtures in restored local MariaDB.
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
(async () => {
  const config = require('../knexfile.cjs').connection;
  assert.equal(config.host, '127.0.0.1'); assert.equal(config.port, 3308);
  if (!process.env.FEEGO_TEST_PASSWORD) throw Error('Set FEEGO_TEST_PASSWORD');
  const db = await require('mysql2/promise').createConnection(config);
  let cookie, id;
  const title = `__timer_test_${Date.now()}`;
  async function request(path, body, method = 'POST') {
    const r = await fetch('http://127.0.0.1:3030' + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!cookie) cookie = r.headers.get('set-cookie')?.split(';')[0];
    const data = await r.json(); assert.equal(r.status, 200, JSON.stringify(data)); assert.equal(data.ok, true); return data;
  }
  const state = async () => (await request('/api/kanban/state', null, 'GET')).cards.find(c => c.id === id);
  const move = (status, board = 'kanban', extra = {}) => request('/api/kanban/move', { id, board, status, ...extra });
  const age = () => db.query('UPDATE kb_cards SET work_started_at=DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 120 SECOND), updated_at=updated_at WHERE id=?', [id]);
  function paused(c) { assert.equal(c.work_started_at, null); assert.equal(c.work_total_ms, c.work_elapsed_ms); }
  try {
    await request('/api/login', { username: 'FeegoAdmin', password: process.env.FEEGO_TEST_PASSWORD });
    await request('/api/kanban/card', { title, board: 'kanban', status: 'todo', progress_pct: 0 });
    [[{ id }]] = await db.query('SELECT id FROM kb_cards WHERE title=?', [title]);
    let c = await state(); paused(c); assert.equal(c.work_total_ms, 0);
    await move('doing'); c = await state(); assert.ok(c.work_started_at);
    await age(); const start = (await state()).work_started_at;
    await request('/api/kanban/card/update', { id, title, notes: 'edit', progress_pct: 45 });
    assert.equal((await state()).work_started_at, start, 'Metadata/progress edits must not reset start');
    await move('doing', 'kanban', { sort: 5 }); assert.equal((await state()).work_started_at, start);
    await Promise.all([move('todo'), move('todo')]); c = await state(); paused(c);
    assert.ok(c.work_elapsed_ms >= 120000 && c.work_elapsed_ms < 125000, 'Concurrent stops must accumulate once');
    const first = c.work_elapsed_ms;
    await move('todo'); assert.equal((await state()).work_elapsed_ms, first);
    await move('doing'); await age();
    await request('/api/kanban/card/update', { id, title, progress_pct: 100, sync_progress: true });
    c = await state(); paused(c); assert.equal(c.status, 'done'); assert.ok(c.work_elapsed_ms >= first + 120000);
    const second = c.work_elapsed_ms;
    await move('doing'); c = await state(); assert.ok(c.work_started_at); assert.equal(c.progress_pct, 99);
    await age(); await move('done'); c = await state(); paused(c); assert.ok(c.work_elapsed_ms >= second + 120000);
    await move('doing', 'kanban', { progress_pct: 35 }); await age();
    await move('n/a', 'ideas'); c = await state(); paused(c);
    await move('doing', 'kanban', { progress_pct: 50 }); await age();
    await move('n/a', 'archived'); c = await state(); paused(c); const archived = c.work_elapsed_ms;
    await request('/api/kanban/card/update', { id, title, progress_pct: 30, sync_progress: true, work_elapsed_ms: 1, work_started_at: '2020-01-01' });
    c = await state(); paused(c); assert.equal(c.work_elapsed_ms, archived); assert.equal(c.board, 'archived');
    await move('doing', 'kanban', { progress_pct: 30 }); await age();
    await request('/api/kanban/card/update', { id, title, progress_pct: 100 }); c = await state(); paused(c);
    // Invalid edits must not mutate timing.
    const r = await fetch('http://127.0.0.1:3030/api/kanban/card/update', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ id, title, progress_pct: 101 }) });
    assert.equal(r.status, 400); assert.equal((await state()).work_elapsed_ms, c.work_elapsed_ms);
    // Creating directly in Doing starts timing atomically too.
    await request('/api/kanban/card', { title: title + '_direct', board: 'kanban', status: 'doing', progress_pct: 20 });
    const direct = (await request('/api/kanban/state', null, 'GET')).cards.find(c => c.title === title + '_direct');
    assert.ok(direct.work_started_at); assert.ok(direct.work_total_ms >= 0);
    console.log('PASS: timer start, same-column reorder/edit, concurrent pause, resume, 100%, done, reopen, roadmap, archive, readback, creation and ignored client timing.');
  } finally {
    await db.query('DELETE FROM kb_cards WHERE title IN (?,?)', [title, title + '_direct']); await db.end();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
