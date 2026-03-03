require('dotenv').config();
const mariadb = require('mariadb');
const bcrypt = require('bcrypt');

(async () => {
  const username = process.argv[2] || 'FeegoAdmin';
  const password = process.argv[3] || 'feegoadmin2026';
  const email = process.env.ADMIN_EMAIL || 'andres.feego@gmail.com';

  if (!username || !password) {
    console.error('Usage: node scripts/set_admin_password.js [username] [password]');
    process.exit(1);
  }

  const passHash = await bcrypt.hash(password, 12);

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

    // Try exact username first, then case-insensitive match to recover legacy records.
    let rows = await conn.query('SELECT id, username FROM users WHERE username=? LIMIT 1', [username]);
    if (!rows.length) {
      rows = await conn.query('SELECT id, username FROM users WHERE LOWER(username)=LOWER(?) LIMIT 1', [username]);
    }

    if (rows.length) {
      const userId = Number(rows[0].id);
      await conn.query(
        'UPDATE users SET username=?, email=?, password_hash=?, must_change_password=0 WHERE id=?',
        [username, email, passHash, userId]
      );
      console.log(`UPDATED_USER id=${userId} username=${username}`);
    } else {
      const r = await conn.query(
        'INSERT INTO users (username,email,password_hash,must_change_password) VALUES (?,?,?,0)',
        [username, email, passHash]
      );
      console.log(`CREATED_USER id=${Number(r.insertId)} username=${username}`);
    }

    console.log(`LOGIN_USERNAME=${username}`);
    console.log(`LOGIN_PASSWORD=${password}`);
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
})();
