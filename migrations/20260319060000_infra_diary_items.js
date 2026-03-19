exports.up = async function up(knex) {
  const has = await knex.schema.hasTable('infra_diary_items')
  if (!has) {
    await knex.schema.createTable('infra_diary_items', (t) => {
      t.string('slug', 64).primary()
      t.string('name', 255).notNullable()
      // lucide-react icon name (e.g. Home, Bike, Dumbbell)
      t.string('icon', 64).notNullable().defaultTo('X')
      t.integer('sort_order').notNullable().defaultTo(100)
      t.string('status', 32).notNullable().defaultTo('active') // active|archived
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())

      t.index(['status', 'sort_order'])
    })
  }
}

exports.down = async function down(knex) {
  const has = await knex.schema.hasTable('infra_diary_items')
  if (has) await knex.schema.dropTable('infra_diary_items')
}
