exports.up = async function up(knex) {
  const has = await knex.schema.hasTable('infra_diary_daily')
  if (!has) {
    await knex.schema.createTable('infra_diary_daily', (t) => {
      t.date('day').primary() // Bogota day bucket
      t.text('summary_md').notNullable().defaultTo('')
      t.text('raw_transcript').notNullable().defaultTo('')
      t.string('source', 32).notNullable().defaultTo('manual') // manual|whatsapp|system
      t.string('created_by', 64).notNullable().defaultTo('admin')
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
    })
  }
}

exports.down = async function down(knex) {
  const has = await knex.schema.hasTable('infra_diary_daily')
  if (has) await knex.schema.dropTable('infra_diary_daily')
}
