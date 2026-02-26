require('dotenv').config();
const mariadb = require('mariadb');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

(async () => {
  const username = 'FeegoAdmin';
  const email = 'andres.feego@gmail.com';
  const tempPass = crypto.randomBytes(9).toString('base64').replace(/[^a-zA-Z0-9]/g,'').slice(0,14);
  const passHash = await bcrypt.hash(tempPass, 12);

  const pool = mariadb.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'feego_admin',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'feegosystem_admin_db',
    connectionLimit: 1,
  });

  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query('SELECT id FROM users WHERE username=? LIMIT 1', [username]);
    let userId;
    if (rows.length) {
      userId = rows[0].id;
      await conn.query('UPDATE users SET email=?, password_hash=?, must_change_password=1 WHERE id=?', [email, passHash, userId]);
    } else {
      const r = await conn.query('INSERT INTO users (username,email,password_hash,must_change_password) VALUES (?,?,?,1)', [username, email, passHash]);
      userId = Number(r.insertId);
    }

    const raw = crypto.randomBytes(16).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
    await conn.query('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?,?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 2 HOUR))', [userId, tokenHash]);

    console.log('TEMP_PASSWORD=' + tempPass);
    console.log('RESET_TOKEN=' + raw);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
})();
