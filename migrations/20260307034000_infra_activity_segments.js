exports.up = async function up(knex) {
  const has = await knex.schema.hasTable('infra_activity_segments')
  if (!has) {
    await knex.schema.createTable('infra_activity_segments', (t) => {
      t.increments('id').primary()
      t.date('day').notNullable().index() // Bogota day bucket
      t.string('project_slug', 64).notNullable().index()
      t.string('source', 32).notNullable().defaultTo('unknown') // exec|chat|manual
      t.datetime('start_at').notNullable().index() // UTC
      t.datetime('end_at').notNullable() // UTC
      t.integer('minutes').notNullable().defaultTo(0)
      t.text('notes').notNullable().defaultTo('')
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())

      // common lookups
      t.index(['day', 'project_slug'])
      t.index(['project_slug', 'start_at'])
    })
  }
}

exports.down = async function down(knex) {
  const has = await knex.schema.hasTable('infra_activity_segments')
  if (has) await knex.schema.dropTable('infra_activity_segments')
}
