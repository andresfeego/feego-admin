/**
 * Baseline migration.
 *
 * This repo already has a live schema in MariaDB.
 * We start tracking migrations from this point forward without changing existing tables.
 */

exports.up = async function up(knex) {
  // no-op (baseline)
}

exports.down = async function down(knex) {
  // no-op
}
