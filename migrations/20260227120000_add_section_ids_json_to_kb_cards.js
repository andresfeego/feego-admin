exports.up = async function up(knex) {
  const has = await knex.schema.hasColumn('kb_cards', 'section_ids_json')
  if (!has) {
    await knex.schema.alterTable('kb_cards', (table) => {
      table.text('section_ids_json').nullable()
    })
  }
}

exports.down = async function down(knex) {
  const has = await knex.schema.hasColumn('kb_cards', 'section_ids_json')
  if (has) {
    await knex.schema.alterTable('kb_cards', (table) => {
      table.dropColumn('section_ids_json')
    })
  }
}
