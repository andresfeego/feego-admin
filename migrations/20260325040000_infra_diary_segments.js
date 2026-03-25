exports.up = async function up(knex) {
  const has = await knex.schema.hasTable('infra_diary_segments')
  if (!has) {
    await knex.schema.createTable('infra_diary_segments', (t) => {
      t.increments('id').primary()
      t.date('day').notNullable().index() // Bogota day bucket
      t.string('item_slug', 64).notNullable().index()
      t.datetime('start_at').nullable().index() // UTC
      t.datetime('end_at').nullable().index()   // UTC
      t.integer('minutes').notNullable().defaultTo(0)
      t.text('notes').notNullable().defaultTo('')
      t.string('source', 32).notNullable().defaultTo('manual') // manual|system
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())

      t.index(['day', 'item_slug'])
    })
  }
}

exports.down = async function down(knex) {
  const has = await knex.schema.hasTable('infra_diary_segments')
  if (has) await knex.schema.dropTable('infra_diary_segments')
}
