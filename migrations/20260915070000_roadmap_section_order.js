exports.up = async knex => {
  await knex.schema.alterTable('kb_cards', t => t.json('roadmap_order_json').nullable());
};
exports.down = async knex => {
  await knex.schema.alterTable('kb_cards', t => t.dropColumn('roadmap_order_json'));
};
