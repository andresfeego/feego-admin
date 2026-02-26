#!/usr/bin/env node
/*
  Migrates kb_cards.section_name -> kb_sections + kb_cards.section_id
  - For each (project_id, section_name) create a kb_sections row if not exists
  - Set kb_cards.section_id accordingly
*/

const fs = require('fs');
const mysql = require('mariadb');

function parseEnv(p) {
  const raw = fs.readFileSync(p, 'utf-8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i === -1) continue;
    out[line.slice(0, i)] = line.slice(i + 1);
  }
  return out;
}

async function main() {
  const env = parseEnv('/opt/feego-admin/.env');
  const pool = mysql.createPool({
    host: env.DB_HOST || '127.0.0.1',
    user: env.DB_USER,
    password: env.DB_PASS,
    database: env.DB_NAME,
    connectionLimit: 5,
  });

  const conn = await pool.getConnection();
  try {
    const rows = await conn.query(
      "SELECT DISTINCT project_id, section_name FROM kb_cards WHERE board='ideas' AND section_name IS NOT NULL AND section_name <> ''"
    );

    const sectionIdByKey = new Map();

    let sort = 0;
    for (const r of rows) {
      const projectId = Number(r.project_id);
      const name = String(r.section_name);
      const key = projectId + '::' + name;

      // upsert
      await conn.query(
        'INSERT IGNORE INTO kb_sections (project_id, name, color, icon, sort) VALUES (?,?,?,?,?)',
        [projectId, name, '#64748b', 'Tag', sort++]
      );

      const got = await conn.query('SELECT id FROM kb_sections WHERE project_id=? AND name=? LIMIT 1', [projectId, name]);
      sectionIdByKey.set(key, Number(got[0].id));
    }

    for (const [key, sid] of sectionIdByKey.entries()) {
      const [projectIdStr, name] = key.split('::');
      const projectId = Number(projectIdStr);
      await conn.query(
        'UPDATE kb_cards SET section_id=? WHERE project_id=? AND section_name=?',
        [sid, projectId, name]
      );
    }

    console.log('ok', { sectionsCreated: sectionIdByKey.size });
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
