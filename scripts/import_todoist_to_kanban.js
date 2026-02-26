#!/usr/bin/env node
/*
  One-shot import of Todoist projects + active tasks into FeegoAdmin Kanban tables.
  - Creates kb_projects from Todoist projects
  - Creates kb_cards for tasks, all into board='ideas'
  - Stores todoist ids for traceability

  Usage:
    node import_todoist_to_kanban.js --wipe

  Reads TODOIST_TOKEN from /root/.openclaw/workspace/.secrets/todoist.env
*/

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mariadb');

const argv = new Set(process.argv.slice(2));
const WIPE = argv.has('--wipe');

dotenv.config({ path: '/root/.openclaw/workspace/.secrets/todoist.env' });
const TODOIST_TOKEN = process.env.TODOIST_TOKEN;
if (!TODOIST_TOKEN) {
  console.error('Missing TODOIST_TOKEN in todoist.env');
  process.exit(1);
}

async function tFetch(url, opts = {}) {
  const r = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${TODOIST_TOKEN}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`Todoist HTTP ${r.status} ${url} :: ${txt}`);
  }
  return r.json();
}

function safeStr(x) {
  return (x == null) ? '' : String(x);
}

async function main() {
  // DB creds from feego-admin .env
  const envPath = '/opt/feego-admin/.env';
  const envRaw = fs.readFileSync(envPath, 'utf-8');
  const env = Object.fromEntries(envRaw.split(/\r?\n/).filter(Boolean).map(line => {
    const i = line.indexOf('=');
    return [line.slice(0, i), line.slice(i + 1)];
  }));

  const pool = mysql.createPool({
    host: env.DB_HOST || '127.0.0.1',
    user: env.DB_USER,
    password: env.DB_PASS,
    database: env.DB_NAME,
    connectionLimit: 5,
  });

  const conn = await pool.getConnection();
  try {
    if (WIPE) {
      console.log('Wiping kb_cards + kb_projects…');
      await conn.query('DELETE FROM kb_cards');
      await conn.query('DELETE FROM kb_projects');
    }

    console.log('Fetching Todoist projects…');
    const projectsRes = await tFetch('https://api.todoist.com/api/v1/projects');
    const projects = projectsRes && projectsRes.results ? projectsRes.results : [];

    console.log('Fetching Todoist tasks (active)…');
    // /tasks returns active tasks by default
    const tasksRes = await tFetch('https://api.todoist.com/api/v1/tasks');
    const tasks = tasksRes && tasksRes.results ? tasksRes.results : [];

    // sections mapping
    const sectionById = new Map();
    try {
      const sectionsRes = await tFetch('https://api.todoist.com/api/v1/sections');
      const sections = sectionsRes && sectionsRes.results ? sectionsRes.results : [];
      for (const s of sections) sectionById.set(s.id, s.name);
    } catch (e) {
      console.log('Sections endpoint failed (continuing without section names):', e.message);
    }

    // Insert projects
    const projIdMap = new Map();
    let sort = 0;
    for (const p of projects) {
      const name = safeStr(p.name).trim();
      if (!name) continue;
      const r = await conn.query(
        'INSERT INTO kb_projects (name, sort, archived, description, logo_path, todoist_project_id) VALUES (?,?,?,?,?,?)',
        [name, sort++, 0, '', null, safeStr(p.id)]
      );
      // mariadb driver returns insertId
      projIdMap.set(safeStr(p.id), Number(r.insertId));
    }

    // Insert tasks as cards in board=ideas
    console.log(`Importing ${tasks.length} tasks…`);
    let cardSortByProj = new Map();

    for (const t of tasks) {
      const title = safeStr(t.content).trim();
      if (!title) continue;
      const todoProjId = safeStr(t.project_id);
      const kbProjId = projIdMap.get(todoProjId) || null;
      const sName = t.section_id ? (sectionById.get(t.section_id) || null) : null;
      let dueAt = null;
      if (t.due) {
        const v = t.due.datetime || t.due.date;
        if (v) {
          // Todoist v1 sometimes returns ISO-like strings (including for recurring) in due.date.
          // Normalize to MariaDB DATETIME: 'YYYY-MM-DD HH:MM:SS'
          if (typeof v === 'string' && v.includes('T')) {
            dueAt = v.replace('T', ' ').slice(0, 19);
          } else if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
            dueAt = v + ' 09:00:00';
          }
        }
      }

      const s = cardSortByProj.get(kbProjId) || 0;
      cardSortByProj.set(kbProjId, s + 1);

      await conn.query(
        'INSERT INTO kb_cards (title, notes, project_id, board, status, sort, due_at, todoist_task_id, section_name) VALUES (?,?,?,?,?,?,?,?,?)',
        [title, safeStr(t.description || ''), kbProjId, 'ideas', 'n/a', s, dueAt, safeStr(t.id), sName]
      );
    }

    console.log('Done.');
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
