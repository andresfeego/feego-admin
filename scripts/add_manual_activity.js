#!/usr/bin/env node

// Usage:
//   node scripts/add_manual_activity.js 2026-03-06 altezza 420 "Trabajo en manual y deploy"
// Minutes is required.

require('dotenv').config()
const knex = require('knex')({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  },
  pool: { min: 0, max: 5 },
})

async function main() {
  const [day, project, minutesRaw, ...rest] = process.argv.slice(2)
  const minutes = Number(minutesRaw || 0)
  const notes = (rest.join(' ') || '').trim()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || ''))) {
    console.error('bad day. expected YYYY-MM-DD')
    process.exit(2)
  }
  if (!project) {
    console.error('missing project slug')
    process.exit(2)
  }
  if (!Number.isFinite(minutes) || minutes <= 0) {
    console.error('bad minutes')
    process.exit(2)
  }

  await knex.transaction(async (trx) => {
    await trx('infra_activity_manual_events').insert({
      day,
      project_slug: project,
      minutes,
      title: 'Registro manual',
      notes,
      source: 'manual',
      created_by: 'whatsapp',
    })

    const existing = await trx('infra_activity_daily').where({ day }).first()
    let byProject = { [project]: minutes }
    let minutes_total = minutes
    let source = 'manual'
    let events_count = 1

    if (existing) {
      minutes_total = Number(existing.minutes_total || 0) + minutes
      events_count = Number(existing.events_count || 0) + 1
      try { byProject = JSON.parse(existing.minutes_by_project_json || '{}') } catch (e) { byProject = {} }
      byProject[project] = Number(byProject[project] || 0) + minutes
      source = (existing.source && existing.source !== 'unknown' && existing.source !== 'manual') ? 'mixed' : 'manual'

      await trx('infra_activity_daily')
        .where({ day })
        .update({
          minutes_total,
          minutes_by_project_json: JSON.stringify(byProject),
          source,
          events_count,
          updated_at: trx.fn.now(),
        })
    } else {
      await trx('infra_activity_daily').insert({
        day,
        minutes_total,
        minutes_by_project_json: JSON.stringify(byProject),
        source,
        events_count,
        updated_at: trx.fn.now(),
      })
    }
  })

  console.log(JSON.stringify({ ok: true, day, project, minutes, notes }))
}

main()
  .catch((e) => {
    console.error('ERROR', e && e.message ? e.message : e)
    process.exit(1)
  })
  .finally(async () => {
    try { await knex.destroy() } catch (e) {}
  })
