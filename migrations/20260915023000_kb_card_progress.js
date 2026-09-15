exports.up = async function up(knex) {
  const hasProgress = await knex.schema.hasColumn('kb_cards', 'progress_pct')
  if (!hasProgress) {
    await knex.schema.alterTable('kb_cards', (table) => {
      table.integer('progress_pct').notNullable().defaultTo(0)
    })
  }
}

exports.down = async function down(knex) {
  const hasProgress = await knex.schema.hasColumn('kb_cards', 'progress_pct')
  if (hasProgress) {
    await knex.schema.alterTable('kb_cards', (table) => {
      table.dropColumn('progress_pct')
    })
  }
}
