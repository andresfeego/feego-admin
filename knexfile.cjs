// knexfile.cjs
// Uses the same DB_* env vars as server.js (.env loaded by your process manager / systemd)

module.exports = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    timezone: 'Z',
  },
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations',
  },
}
