exports.up = async knex => {
  await knex.schema.alterTable('kb_projects', t => t.integer('priority').unsigned().nullable());
};
exports.down = async knex => {
  await knex.schema.alterTable('kb_projects', t => t.dropColumn('priority'));
};
