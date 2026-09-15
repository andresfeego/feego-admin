exports.up = async knex => {
  await knex.schema.alterTable('kb_cards', t => {
    t.bigInteger('work_elapsed_ms').unsigned().notNullable().defaultTo(0);
    t.dateTime('work_started_at', { precision: 3 }).nullable();
  });
  // Start existing active work now; never invent historical time or touch activity dates.
  await knex('kb_cards').where({ board: 'kanban', status: 'doing' }).where('progress_pct', '<', 100)
    .update({ work_started_at: knex.raw('UTC_TIMESTAMP(3)'), updated_at: knex.raw('updated_at') });
};
exports.down = async knex => {
  await knex.schema.alterTable('kb_cards', t => { t.dropColumn('work_started_at'); t.dropColumn('work_elapsed_ms'); });
};
