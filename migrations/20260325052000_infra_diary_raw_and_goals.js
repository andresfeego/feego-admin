exports.up = async function up(knex) {
  const hasRaw = await knex.schema.hasTable('infra_diary_raw')
  if (!hasRaw) {
    await knex.schema.createTable('infra_diary_raw', (t) => {
      t.increments('id').primary()
      t.date('day').notNullable().index() // Bogota day bucket
      t.string('raw_kind', 32).notNullable().defaultTo('note') // daily_report|goals|note
      t.string('channel', 32).notNullable().defaultTo('whatsapp')
      t.string('source_message_id', 128).nullable()
      t.longtext('raw_text').notNullable()
      t.string('created_by', 64).notNullable().defaultTo('andres')
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())

      t.index(['day', 'raw_kind'])
    })
  }

  const hasGoals = await knex.schema.hasTable('infra_diary_goals')
  if (!hasGoals) {
    await knex.schema.createTable('infra_diary_goals', (t) => {
      t.increments('id').primary()
      t.date('day').notNullable().index()
      t.text('text').notNullable()
      t.string('status', 16).notNullable().defaultTo('todo') // todo|done|skipped
      t.timestamp('checked_at').nullable()
      t.integer('sort_order').notNullable().defaultTo(100)
      t.integer('raw_id').unsigned().nullable()
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())

      t.index(['day', 'sort_order'])
      t.index(['day', 'status'])
      t.index(['raw_id'])
    })
  }
}

exports.down = async function down(knex) {
  const hasGoals = await knex.schema.hasTable('infra_diary_goals')
  if (hasGoals) await knex.schema.dropTable('infra_diary_goals')

  const hasRaw = await knex.schema.hasTable('infra_diary_raw')
  if (hasRaw) await knex.schema.dropTable('infra_diary_raw')
}
