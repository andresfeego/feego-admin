const mariadb = require('mariadb');
require('dotenv').config();

const items = [
  // Projects as items
  { slug: 'altezza', name: 'Altezza', icon: 'PartyPopper', sort_order: 10 },
  { slug: 'mako', name: 'Mako', icon: 'Raccoon', sort_order: 20 },
  { slug: 'sisproind', name: 'Sisproind', icon: 'GraduationCap', sort_order: 30 },
  { slug: 'viralco', name: 'Viralco', icon: 'Camera', sort_order: 40 },
  { slug: 'feego', name: 'Feego', icon: 'Terminal', sort_order: 50 },
  { slug: 'davivienda', name: 'Davivienda', icon: 'Briefcase', sort_order: 60 },

  // Life items
  { slug: 'casa', name: 'Casa', icon: 'Home', sort_order: 70 },
  { slug: 'kinky', name: 'Kinky', icon: 'Bike', sort_order: 80 },
  { slug: 'gimnasio', name: 'Gimnasio', icon: 'Dumbbell', sort_order: 90 },
  { slug: 'perritos', name: 'Perritos', icon: 'Dog', sort_order: 100 },
];

async function main() {
  const pool = mariadb.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'feego_admin',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'feegosystem_admin_db',
    connectionLimit: 2,
  });

  let conn;
  try {
    conn = await pool.getConnection();

    // Ensure table exists (migration may not have run yet)
    await conn.query(`CREATE TABLE IF NOT EXISTS infra_diary_items (
      slug VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      icon VARCHAR(64) NOT NULL DEFAULT 'X',
      sort_order INT NOT NULL DEFAULT 100,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_status_sort (status, sort_order)
    )`);

    for (const it of items) {
      await conn.query(
        `INSERT INTO infra_diary_items (slug, name, icon, sort_order, status)
         VALUES (?,?,?,?, 'active')
         ON DUPLICATE KEY UPDATE name=VALUES(name), icon=VALUES(icon), sort_order=VALUES(sort_order), status='active'`,
        [it.slug, it.name, it.icon, it.sort_order]
      );
    }

    console.log('OK: seeded infra_diary_items', items.length);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
