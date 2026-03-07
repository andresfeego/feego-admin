exports.up = async function up(knex) {
  const has = await knex.schema.hasTable('infra_activity_manual_events')
  if (!has) {
    await knex.schema.createTable('infra_activity_manual_events', (t) => {
      t.increments('id').primary()
      t.date('day').notNullable().index()
      t.string('project_slug', 64).notNullable().defaultTo('unknown')
      t.integer('minutes').notNullable().defaultTo(0)
      t.string('title', 160).notNullable().defaultTo('Registro manual')
      t.text('notes').notNullable().defaultTo('')
      t.string('source', 32).notNullable().defaultTo('manual')
      t.string('created_by', 64).notNullable().defaultTo('admin')
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
    })
  }
}

exports.down = async function down(knex) {
  const has = await knex.schema.hasTable('infra_activity_manual_events')
  if (has) await knex.schema.dropTable('infra_activity_manual_events')
}
