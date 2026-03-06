exports.up = async function up(knex) {
  const has = await knex.schema.hasTable('infra_activity_daily')
  if (!has) {
    await knex.schema.createTable('infra_activity_daily', (t) => {
      t.date('day').primary()
      t.integer('minutes_total').notNullable().defaultTo(0)
      t.text('minutes_by_project_json').notNullable()
      t.string('source', 32).notNullable().defaultTo('unknown') // chat|exec|mixed
      t.integer('events_count').notNullable().defaultTo(0)
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
    })
  }

  const hasMeta = await knex.schema.hasTable('infra_activity_meta')
  if (!hasMeta) {
    await knex.schema.createTable('infra_activity_meta', (t) => {
      t.string('key', 64).primary()
      t.text('value').notNullable()
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
    })
  }
}

exports.down = async function down(knex) {
  const has = await knex.schema.hasTable('infra_activity_daily')
  if (has) await knex.schema.dropTable('infra_activity_daily')
  const hasMeta = await knex.schema.hasTable('infra_activity_meta')
  if (hasMeta) await knex.schema.dropTable('infra_activity_meta')
}
