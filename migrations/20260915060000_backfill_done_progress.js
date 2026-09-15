exports.up = async function (knex) {
  // Preserve activity dates: this is a data correction, not new work.
  await knex('kb_cards').where({ board: 'kanban', status: 'done' }).whereNot('progress_pct', 100)
    .update({ progress_pct: 100, updated_at: knex.raw('updated_at') });
};
exports.down = async function () {
  // Previous percentages cannot be reconstructed; retain the corrected data.
};
