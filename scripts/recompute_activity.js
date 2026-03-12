const fs = require('fs');
const path = require('path');
const mariadb = require('mariadb');
const child_process = require('child_process');

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
const DB_NAME = process.env.DB_NAME || 'feegosystem_admin_db';
const DB_USER = process.env.DB_USER || 'feego_admin';
const DB_PASS = process.env.DB_PASS || '';

const OPENCLAW_AUDIT_PATH = process.env.OPENCLAW_AUDIT_PATH || '/root/.openclaw/logs/dev-activity-exec.jsonl';
const WHATSAPP_ZIP_PATH = process.env.WHATSAPP_CHAT_ZIP_PATH || '/root/.openclaw/workspace/uploads/andres/inbox/2026-03-06T06-35-18-294Z__WhatsApp_Chat_-_Wipi.zip';
const WHATSAPP_CHAT_FILE = '_chat.txt';

const GAP_MIN = process.env.ACTIVITY_GAP_MIN ? Number(process.env.ACTIVITY_GAP_MIN) : 15;

const TZ_BOGOTA = 'America/Bogota';

function isoUtcNow() {
  return new Date().toISOString();
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function dayKeyBogota(dt) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_BOGOTA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dt);
}

function parseJsonLines(p) {
  if (!fs.existsSync(p)) return [];
  const lines = fs.readFileSync(p, 'utf8').split(/\n/).filter(Boolean);
  const out = [];
  for (const line of lines) {
    try { out.push(JSON.parse(line)); } catch {}
  }
  return out;
}

function projectFromWorkdirOrCommand(workdir, command) {
  const wd = workdir || '';
  const cmd = command || '';
  if (wd.startsWith('/opt/feego-admin')) return 'feego';
  if (wd.includes('/opt/stacks/mievento')) return 'altezza';
  if (wd.startsWith('/srv/mako') || cmd.includes('/srv/mako')) return 'mako';
  if (wd.startsWith('/srv/sisproind') || cmd.includes('/srv/sisproind')) return 'sisproind';
  if (cmd.includes('mercypersonalizados')) return 'mercypersonalizados';
  if (cmd.includes('comopreparar')) return 'comopreparar';
  if (cmd.includes('/opt/stacks/mievento')) return 'altezza';
  if (cmd.includes('/opt/feego-admin')) return 'feego';
  return 'other';
}

function computeExecSegments(events) {
  const execEvents = events
    .filter((e) => (e.tool === 'exec' || e.toolName === 'exec') && e.ts)
    .map((e) => {
      const dt = new Date(e.ts);
      return {
        dt,
        command: e.command || '',
        workdir: e.workdir || e.cwd || '',
        project: projectFromWorkdirOrCommand(e.workdir || e.cwd, e.command),
      };
    })
    .filter((e) => !isNaN(e.dt.getTime()))
    .sort((a, b) => a.dt - b.dt);

  const gapMs = GAP_MIN * 60 * 1000;
  const segs = [];

  let prev = null;
  for (const e of execEvents) {
    if (prev) {
      const gap = e.dt - prev.dt;
      if (gap > 0 && gap <= gapMs) {
        segs.push({
          source: 'exec',
          project_slug: prev.project,
          start_at: new Date(prev.dt),
          end_at: new Date(e.dt),
          minutes: Math.max(1, Math.round(gap / 60000)),
          notes: '',
        });
      }
    }
    prev = e;
  }
  return segs;
}

function unzipReadChat(zipPath) {
  if (!fs.existsSync(zipPath)) return null;
  try {
    const buf = child_process.execSync(`unzip -p ${JSON.stringify(zipPath)} ${WHATSAPP_CHAT_FILE}`, { maxBuffer: 50 * 1024 * 1024 });
    return buf.toString('utf8');
  } catch (e) {
    return null;
  }
}

function inferProjectFromText(content) {
  const c = String(content || '').toLowerCase();
  const keywords = {
    mako: ['mako', 'lab-mako', 'mako.guru'],
    altezza: ['altezza', 'mievento', 'lab-mievento', 'altezzaeventos'],
    feego: ['feego', 'feegoadmin', 'admin.feegosystem', 'feegosystem'],
    sisproind: ['sisproind', 'sispro'],
    mercypersonalizados: ['mercy', 'mercypersonalizados'],
    comopreparar: ['comopreparar'],
  };
  for (const [proj, ks] of Object.entries(keywords)) {
    if (ks.some((k) => c.includes(k))) return proj;
  }
  return 'other';
}

function parseWhatsappMessages(text) {
  const lines = String(text || '').split(/\n/);
  const msgs = [];
  const re = /^\[(\d{2}\/\d{2}\/\d{4}),\s*([^\]]+)\]\s*([^:]+):\s*(.*)$/;

  function parseDt(datePart, timePart) {
    const s = String(timePart || '').replace(/\u202f|\xa0/g, ' ').trim();
    const m = s.match(/(\d{1,2}):(\d{2}):(\d{2})\s*([ap])\.m\./i);
    if (!m) return null;
    let hh = Number(m[1]);
    const mi = Number(m[2]);
    const ss = Number(m[3]);
    const ap = m[4].toLowerCase();
    if (ap === 'p' && hh !== 12) hh += 12;
    if (ap === 'a' && hh === 12) hh = 0;
    const [dd, mm, yyyy] = datePart.split('/').map((x) => Number(x));
    // WhatsApp export is local-time (Bogota). We store a Date; bucketing is done in dayKeyBogota().
    return new Date(Date.UTC(yyyy, mm - 1, dd, hh, mi, ss));
  }

  for (const raw of lines) {
    const line = raw.replace(/\u202f|\xa0/g, ' ');
    const m = line.match(re);
    if (!m) continue;
    const dt = parseDt(m[1], m[2]);
    if (!dt) continue;
    msgs.push({ dt, author: m[3].trim(), content: m[4].trim().toLowerCase(), project: inferProjectFromText(m[4]) });
  }
  msgs.sort((a, b) => a.dt - b.dt);
  return msgs;
}

function computeChatSegments(msgs) {
  const gapMs = GAP_MIN * 60 * 1000;
  const segs = [];
  let prev = null;
  for (const m of msgs) {
    if (prev) {
      const gap = m.dt - prev.dt;
      if (gap > 0 && gap <= gapMs) {
        segs.push({
          source: 'chat',
          project_slug: prev.project || 'other',
          start_at: new Date(prev.dt),
          end_at: new Date(m.dt),
          minutes: Math.max(1, Math.round(gap / 60000)),
          notes: '',
        });
      }
    }
    prev = m;
  }
  return segs;
}

function splitSegmentByBogotaDay(seg) {
  // segment is short (<=15m) but can cross midnight; split if needed
  const out = [];
  let start = new Date(seg.start_at);
  const end = new Date(seg.end_at);
  while (start < end) {
    const day = dayKeyBogota(start);
    // compute next bogota midnight in UTC by stepping minutes until day changes (safe for short segments)
    let cursor = new Date(start);
    let last = new Date(start);
    while (cursor < end) {
      last = new Date(cursor);
      cursor = new Date(cursor.getTime() + 60 * 1000);
      if (dayKeyBogota(cursor) !== day) break;
    }
    const partEnd = cursor <= end && dayKeyBogota(cursor) !== day ? cursor : end;
    const minutes = Math.max(1, Math.round((partEnd - start) / 60000));
    out.push({ ...seg, day, start_at: start, end_at: partEnd, minutes });
    start = partEnd;
  }
  return out;
}

function buildDailyFromSegments(segs) {
  const byDay = new Map();
  for (const s of segs) {
    const parts = splitSegmentByBogotaDay(s);
    for (const p of parts) {
      const dk = p.day;
      if (!byDay.has(dk)) byDay.set(dk, { minutes_total: 0, minutes_by_project: {}, events_count: 0 });
      const rec = byDay.get(dk);
      rec.minutes_total += p.minutes;
      rec.minutes_by_project[p.project_slug] = (rec.minutes_by_project[p.project_slug] || 0) + p.minutes;
      rec.events_count += 1;
    }
  }
  return byDay;
}

async function replaceSegments(pool, segs, computedAtIso) {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Replace exec/chat segments for the days we touched.
    const touchedDays = Array.from(new Set(segs.map((s) => dayKeyBogota(s.start_at))));
    if (touchedDays.length) {
      await conn.query(
        `DELETE FROM infra_activity_segments WHERE source IN ('exec','chat') AND day IN (${touchedDays.map(() => '?').join(',')})`,
        touchedDays,
      );
    }

    for (const s of segs) {
      const parts = splitSegmentByBogotaDay(s);
      for (const p of parts) {
        await conn.query(
          'INSERT INTO infra_activity_segments (day, project_slug, source, start_at, end_at, minutes, notes, created_at) VALUES (?,?,?,?,?,?,?,NOW())',
          [p.day, p.project_slug, p.source, p.start_at, p.end_at, p.minutes, p.notes || ''],
        );
      }
    }

    await conn.query(
      `INSERT INTO infra_activity_meta (\`key\`, value, updated_at) VALUES ('last_computed_at', ?, NOW())
       ON DUPLICATE KEY UPDATE value=VALUES(value), updated_at=VALUES(updated_at)`,
      [computedAtIso],
    );

    await conn.commit();
  } catch (e) {
    try { if (conn) await conn.rollback(); } catch {}
    throw e;
  } finally {
    if (conn) conn.release();
  }
}

async function upsertDaily(pool, rows, source) {
  let conn;
  try {
    conn = await pool.getConnection();
    for (const [day, rec] of rows.entries()) {
      const minutes_total = Math.round(rec.minutes_total);
      const minutes_by_project = {};
      for (const [k, v] of Object.entries(rec.minutes_by_project || {})) {
        const mv = Math.round(v);
        if (mv > 0) minutes_by_project[k] = mv;
      }
      await conn.query(
        `INSERT INTO infra_activity_daily (day, minutes_total, minutes_by_project_json, source, events_count, updated_at)
         VALUES (?,?,?,?,?,NOW())
         ON DUPLICATE KEY UPDATE minutes_total=VALUES(minutes_total), minutes_by_project_json=VALUES(minutes_by_project_json), source=VALUES(source), events_count=VALUES(events_count), updated_at=VALUES(updated_at)`,
        [day, minutes_total, JSON.stringify(minutes_by_project), source, rec.events_count || 0]
      );
    }
  } finally {
    if (conn) conn.release();
  }
}

async function main() {
  const computedAtIso = isoUtcNow();

  const execEvents = parseJsonLines(OPENCLAW_AUDIT_PATH);
  const execSegs = computeExecSegments(execEvents);

  const chatText = unzipReadChat(WHATSAPP_ZIP_PATH);
  const chatMsgs = chatText ? parseWhatsappMessages(chatText) : [];
  const chatSegs = chatMsgs.length ? computeChatSegments(chatMsgs) : [];

  const segs = [...execSegs, ...chatSegs];

  const pool = mariadb.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    connectionLimit: 3,
  });

  try {
    // persist segments
    await replaceSegments(pool, segs, computedAtIso);

    // build daily from segments + manual events (manual segments already stored separately)
    const byDay = buildDailyFromSegments(segs);

    // merge manual segments
    let conn;
    try {
      conn = await pool.getConnection();
      const manualRows = await conn.query(
        "SELECT day, project_slug, SUM(minutes) AS minutes, COUNT(*) AS c FROM infra_activity_segments WHERE source='manual' GROUP BY day, project_slug"
      );
      function dayKey(v) {
        if (!v) return '';
        if (v instanceof Date) return v.toISOString().slice(0, 10);
        const s = String(v);
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
        return m ? m[1] : s;
      }

      for (const r of manualRows) {
        const dk = dayKey(r.day);
        const proj = String(r.project_slug || 'unknown');
        const mins = Number(r.minutes || 0) || 0;
        if (!mins) continue;
        if (!byDay.has(dk)) byDay.set(dk, { minutes_total: 0, minutes_by_project: {}, events_count: 0 });
        const rec = byDay.get(dk);
        rec.minutes_total += mins;
        rec.minutes_by_project[proj] = (rec.minutes_by_project[proj] || 0) + mins;
        rec.events_count += Number(r.c || 0) || 0;
      }
    } finally {
      if (conn) conn.release();
    }

    await upsertDaily(pool, byDay, 'segments');

    console.log('OK recompute', { segs: segs.length, days: byDay.size, computedAtIso });
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
