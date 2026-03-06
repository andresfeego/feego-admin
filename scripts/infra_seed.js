require('dotenv').config();
const mariadb = require('mariadb');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
const DB_NAME = process.env.DB_NAME || 'feegosystem_admin_db';
const DB_USER = process.env.DB_USER || 'feego_admin';
const DB_PASS = process.env.DB_PASS || '';

function getDataRoot() {
  return process.env.FEEGO_DATA_ROOT || path.resolve(process.cwd(), 'data');
}
const INFRA_ICONS_DIR = path.join(getDataRoot(), 'infra-icons');

const PROJECTS = [
  {
    slug: 'altezza',
    name: 'Altezza',
    status: 'migrated',
    repo_url: 'https://github.com/andresfeego/altezza',
    domains: ['altezzaeventos.in', 'mievento.altezzaeventos.in', 'lab-mievento.altezzaeventos.in'],
    branches: [
      { name: 'lab', purpose: 'LAB' },
      { name: 'master', purpose: 'PROD' },
    ],
  },
  {
    slug: 'mako',
    name: 'Mako',
    status: 'migrated',
    repo_url: 'https://github.com/andresfeego/backend-mako',
    domains: ['mako.guru', 'www.mako.guru', 'lab-mako.mako.guru'],
    branches: [
      { name: 'lab', purpose: 'LAB (backend)' },
      { name: 'main', purpose: 'PROD (backend)' },
      { name: 'master', purpose: 'frontend (shared)' },
    ],
  },
  {
    slug: 'feego',
    name: 'Feego',
    status: 'migrated',
    repo_url: 'https://github.com/andresfeego/feego-admin',
    domains: ['feegosystem.com', 'admin.feegosystem.com'],
    branches: [
      { name: 'main', purpose: 'deploy' },
    ],
  },
  {
    slug: 'sisproind',
    name: 'Sisproind',
    status: 'migrated',
    repo_url: null,
    domains: ['sisproind.com', 'www.sisproind.com'],
    branches: [
      { name: 'lab', purpose: 'LAB backend' },
      { name: 'main', purpose: 'PROD backend' },
    ],
  },
  {
    slug: 'mercypersonalizados',
    name: 'Mercy Personalizados',
    status: 'migrated',
    repo_url: null,
    domains: ['mercypersonalizados.com', 'www.mercypersonalizados.com'],
    branches: [],
  },
  {
    slug: 'comopreparar',
    name: 'ComoPreparar',
    status: 'migrated',
    repo_url: null,
    domains: ['comopreparar.co', 'www.comopreparar.co'],
    branches: [],
  },
];

async function fetchFavicon(domain) {
  // Use Google S2 favicon service for consistency across stacks
  const url = 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(domain) + '&sz=128';
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf;
  } catch {
    return null;
  } finally {
    clearTimeout(to);
  }
}

async function ensureIcon(slug, domains) {
  fs.mkdirSync(INFRA_ICONS_DIR, { recursive: true });
  const outPath = path.join(INFRA_ICONS_DIR, slug + '.png');
  if (fs.existsSync(outPath)) return;

  for (const d of domains || []) {
    const ico = await fetchFavicon(d);
    if (!ico) continue;
    try {
      // Some favicons are ICO; sharp can decode many.
      const png = await sharp(ico).resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      fs.writeFileSync(outPath, png);
      return;
    } catch {
      // try next domain
    }
  }

  // fallback: tiny transparent png
  const fallback = await sharp({ create: { width: 128, height: 128, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  fs.writeFileSync(outPath, fallback);
}

async function main() {
  const pool = mariadb.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    connectionLimit: 3,
  });
  let conn;
  try {
    conn = await pool.getConnection();
    for (const p of PROJECTS) {
      await ensureIcon(p.slug, p.domains);

      const now = new Date();
      const domains_json = JSON.stringify(p.domains || []);
      const branches_json = JSON.stringify(p.branches || []);
      const exists = await conn.query('SELECT id FROM infra_projects WHERE slug=? LIMIT 1', [p.slug]);
      if (exists.length) {
        await conn.query(
          'UPDATE infra_projects SET name=?, status=?, repo_url=?, domains_json=?, branches_json=?, updated_at=? WHERE slug=?',
          [p.name, p.status, p.repo_url, domains_json, branches_json, now, p.slug]
        );
      } else {
        await conn.query(
          'INSERT INTO infra_projects (slug, name, status, repo_url, domains_json, branches_json, policies_md, notes_md, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [p.slug, p.name, p.status, p.repo_url, domains_json, branches_json, '', '', now, now]
        );
      }
    }

    console.log('OK: seeded infra_projects and icons');
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
