exports.up = async function up(knex) {
  const has = await knex.schema.hasColumn('infra_projects', 'color_hex')
  if (!has) {
    await knex.schema.table('infra_projects', (t) => {
      t.string('color_hex', 16).nullable()
    })
  }
}

exports.down = async function down(knex) {
  const has = await knex.schema.hasColumn('infra_projects', 'color_hex')
  if (has) {
    await knex.schema.table('infra_projects', (t) => {
      t.dropColumn('color_hex')
    })
  }
}
