require('dotenv').config();
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

function isoUtcNow() {
  return new Date().toISOString();
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function dayKey(dt) {
  // dt is Date
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseJsonLines(p) {
  if (!fs.existsSync(p)) return [];
  const lines = fs.readFileSync(p, 'utf8').split(/\n/).filter(Boolean);
  const out = [];
  for (const line of lines) {
    try {
      out.push(JSON.parse(line));
    } catch {}
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
  // heuristic by command paths
  if (cmd.includes('/opt/stacks/mievento')) return 'altezza';
  if (cmd.includes('/opt/feego-admin')) return 'feego';
  return 'other';
}

function computeMinutesByDayFromExec(events) {
  // expects {ts, tool, workdir, command}
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

  const byDay = new Map();

  let prev = null;
  for (const e of execEvents) {
    if (prev) {
      const gap = e.dt - prev.dt;
      if (gap > 0 && gap <= gapMs) {
        const minutes = gap / 60000;
        const dk = dayKey(prev.dt);
        if (!byDay.has(dk)) byDay.set(dk, { minutes_total: 0, minutes_by_project: {}, events_count: 0 });
        const rec = byDay.get(dk);
        rec.minutes_total += minutes;
        rec.minutes_by_project[prev.project] = (rec.minutes_by_project[prev.project] || 0) + minutes;
      }
    }
    // count event itself
    const dk2 = dayKey(e.dt);
    if (!byDay.has(dk2)) byDay.set(dk2, { minutes_total: 0, minutes_by_project: {}, events_count: 0 });
    byDay.get(dk2).events_count += 1;

    prev = e;
  }

  return byDay;
}

function unzipReadChat(zipPath) {
  if (!fs.existsSync(zipPath)) return null;
  // Use system unzip to avoid deps
  try {
    const buf = child_process.execSync(`unzip -p ${JSON.stringify(zipPath)} ${WHATSAPP_CHAT_FILE}`, { maxBuffer: 50 * 1024 * 1024 });
    return buf.toString('utf8');
  } catch (e) {
    return null;
  }
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
    // WhatsApp export is local-time; we keep it as naive and treat as local. We'll store by DATE only.
    // We'll interpret as UTC for consistent day buckets; this is approximate.
    return new Date(Date.UTC(yyyy, mm - 1, dd, hh, mi, ss));
  }

  for (const raw of lines) {
    const line = raw.replace(/\u202f|\xa0/g, ' ');
    const m = line.match(re);
    if (!m) continue;
    const dt = parseDt(m[1], m[2]);
    if (!dt) continue;
    msgs.push({ dt, author: m[3].trim(), content: m[4].trim().toLowerCase() });
  }
  msgs.sort((a, b) => a.dt - b.dt);
  return msgs;
}

function computeMinutesByDayFromChat(msgs) {
  const gapMs = GAP_MIN * 60 * 1000;
  const byDay = new Map();

  const keywords = {
    mako: ['mako', 'lab-mako', 'mako.guru'],
    altezza: ['altezza', 'mievento', 'lab-mievento', 'altezzaeventos'],
    feego: ['feego', 'feegoadmin', 'admin.feegosystem', 'feegosystem'],
    sisproind: ['sisproind', 'sispro'],
    mercypersonalizados: ['mercy', 'mercypersonalizados'],
    comopreparar: ['comopreparar'],
  };

  function inferProjectWeights(contents) {
    const counts = {};
    for (const c of contents) {
      for (const [proj, ks] of Object.entries(keywords)) {
        if (ks.some((k) => c.includes(k))) counts[proj] = (counts[proj] || 0) + 1;
      }
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (!total) return { other: 1 };
    const weights = {};
    for (const [k, v] of Object.entries(counts)) weights[k] = v / total;
    return weights;
  }

  // group contents by day
  const contentsByDay = new Map();
  for (const m of msgs) {
    const dk = dayKey(m.dt);
    if (!contentsByDay.has(dk)) contentsByDay.set(dk, []);
    contentsByDay.get(dk).push(m.content);
  }

  // compute active minutes by gaps
  let prev = null;
  for (const m of msgs) {
    if (!byDay.has(dayKey(m.dt))) byDay.set(dayKey(m.dt), { minutes_total: 0, minutes_by_project: {}, events_count: 0 });
    byDay.get(dayKey(m.dt)).events_count += 1;

    if (prev) {
      const gap = m.dt - prev.dt;
      if (gap > 0 && gap <= gapMs) {
        const minutes = gap / 60000;
        const dk = dayKey(prev.dt);
        byDay.get(dk).minutes_total += minutes;
      }
    }
    prev = m;
  }

  // distribute minutes_total into projects by weights
  for (const [dk, rec] of byDay.entries()) {
    const weights = inferProjectWeights(contentsByDay.get(dk) || []);
    for (const [proj, w] of Object.entries(weights)) {
      rec.minutes_by_project[proj] = (rec.minutes_by_project[proj] || 0) + rec.minutes_total * w;
    }
  }

  return byDay;
}

async function upsertDaily(pool, rows, source, computedAtIso) {
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
         VALUES (?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE minutes_total=VALUES(minutes_total), minutes_by_project_json=VALUES(minutes_by_project_json), source=VALUES(source), events_count=VALUES(events_count), updated_at=VALUES(updated_at)`,
        [day, minutes_total, JSON.stringify(minutes_by_project), source, rec.events_count || 0, new Date()]
      );
    }

    await conn.query(
      `INSERT INTO infra_activity_meta (\`key\`, value, updated_at) VALUES ('last_computed_at', ?, ?)
       ON DUPLICATE KEY UPDATE value=VALUES(value), updated_at=VALUES(updated_at)`,
      [computedAtIso, new Date()]
    );
  } finally {
    if (conn) conn.release();
  }
}

async function main() {
  const computedAtIso = isoUtcNow();

  const execEvents = parseJsonLines(OPENCLAW_AUDIT_PATH);
  const execByDay = computeMinutesByDayFromExec(execEvents);

  const chatText = unzipReadChat(WHATSAPP_ZIP_PATH);
  const chatMsgs = chatText ? parseWhatsappMessages(chatText) : [];
  const chatByDay = chatMsgs.length ? computeMinutesByDayFromChat(chatMsgs) : new Map();

  // merge: prefer exec if day exists in execByDay
  const merged = new Map();
  const allDays = new Set([...execByDay.keys(), ...chatByDay.keys()]);
  for (const d of allDays) {
    if (execByDay.has(d)) {
      merged.set(d, { ...execByDay.get(d), source: 'exec' });
    } else {
      merged.set(d, { ...chatByDay.get(d), source: 'chat' });
    }
  }

  // upsert to DB
  const pool = mariadb.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    connectionLimit: 3,
  });

  try {
    // write per-source rows
    const rowsExec = new Map();
    const rowsChat = new Map();
    for (const [day, rec] of merged.entries()) {
      if ((rec.source || '').startsWith('exec')) rowsExec.set(day, rec);
      else rowsChat.set(day, rec);
    }

    await upsertDaily(pool, rowsChat, 'chat', computedAtIso);
    await upsertDaily(pool, rowsExec, 'exec', computedAtIso);

    console.log('OK recompute', { days: merged.size, computedAtIso });
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
