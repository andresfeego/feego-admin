const mariadb = require('mariadb')
require('dotenv').config()

function stripCheckbox(s) {
  return String(s || '').replace(/^\[\s*[xX]?\s*\]\s*/, '')
}

function parseGoalsFromSummary(summary) {
  const txt = String(summary || '').replace(/\r\n/g, '\n')
  // Parse block starting at "## Metas" until next "## " heading or end-of-string.
  const m = txt.match(/(^|\n)##\s+Metas\b[^\n]*\n([\s\S]*?)(?=\n##\s+|\n?$)/)
  if (!m) return []
  const body = String(m[2] || '').trim()
  if (!body) return []

  return body
    .split(/\n/)
    .map((l) => String(l || '').trim())
    .filter(Boolean)
    .map((l) => {
      let x = l.replace(/^[-*]\s*/, '')
      x = stripCheckbox(x)
      return x.trim()
    })
    .filter(Boolean)
}

async function main() {
  const day = process.argv[2]
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    console.error('Usage: node scripts/diary_convert_goals_from_summary.js YYYY-MM-DD')
    process.exit(2)
  }

  const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    connectionLimit: 2,
  })

  let conn
  try {
    conn = await pool.getConnection()

    const rows = await conn.query(
      'SELECT summary_md, raw_transcript, source, created_by FROM infra_diary_daily WHERE day=? LIMIT 1',
      [day]
    )

    if (!rows.length) {
      console.log('No infra_diary_daily row for', day)
      return
    }

    const summary = rows[0].summary_md
    const goals = parseGoalsFromSummary(summary)

    // Insert raw entry
    const rawText = String(rows[0].raw_transcript || summary || '').trim() || String(summary || '').trim()
    const rawKind = 'goals'
    const channel = String(rows[0].source || 'whatsapp')
    const createdBy = String(rows[0].created_by || 'andres')

    const rawRes = await conn.query(
      `INSERT INTO infra_diary_raw (day, raw_kind, channel, raw_text, created_by, created_at)
       VALUES (STR_TO_DATE(?, '%Y-%m-%d'), ?, ?, ?, ?, NOW())`,
      [day, rawKind, channel, rawText, createdBy]
    )

    const rawId = Number(rawRes.insertId)

    await conn.query('DELETE FROM infra_diary_goals WHERE day=STR_TO_DATE(?, "%Y-%m-%d")', [day])

    let idx = 0
    for (const g of goals) {
      idx += 1
      await conn.query(
        `INSERT INTO infra_diary_goals (day, text, status, sort_order, raw_id, created_at, updated_at)
         VALUES (STR_TO_DATE(?, '%Y-%m-%d'), ?, 'todo', ?, ?, NOW(), NOW())`,
        [day, g, idx * 10, rawId]
      )
    }

    console.log('OK converted', { day, goals: goals.length, rawId })
  } finally {
    if (conn) conn.release()
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
