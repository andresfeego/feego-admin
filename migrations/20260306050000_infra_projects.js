exports.up = async function up(knex) {
  const has = await knex.schema.hasTable('infra_projects')
  if (!has) {
    await knex.schema.createTable('infra_projects', (t) => {
      t.increments('id').primary()
      t.string('slug', 64).notNullable().unique()
      t.string('name', 255).notNullable()
      t.string('status', 32).notNullable().defaultTo('active') // active|archived

      t.string('repo_url', 1024).nullable()
      t.text('domains_json').nullable()
      t.text('branches_json').nullable()
      t.text('policies_md').nullable()
      t.text('notes_md').nullable()

      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
    })
  }
}

exports.down = async function down(knex) {
  const has = await knex.schema.hasTable('infra_projects')
  if (has) await knex.schema.dropTable('infra_projects')
}
