require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const session = require('express-session');
const bcrypt = require('bcrypt');
const mariadb = require('mariadb');
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const sharp = require('sharp');
const httpProxy = require('http-proxy');
const cookieParser = require('cookie-parser');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3030;
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
const DB_NAME = process.env.DB_NAME || 'feegosystem_admin_db';
const DB_USER = process.env.DB_USER || 'feego_admin';
const DB_PASS = process.env.DB_PASS || '';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const UI_DIST_DIR = process.env.UI_DIST_DIR || '/opt/feego-admin/ui/dist';
const UI_DIST_ASSETS_DIR = process.env.UI_DIST_ASSETS_DIR || path.join(UI_DIST_DIR, 'assets');
function getDataRoot() {
  return process.env.FEEGO_DATA_ROOT || path.resolve(process.cwd(), 'data');
}

const INFRA_ICONS_DIR = path.join(getDataRoot(), 'infra-icons');
fs.mkdirSync(INFRA_ICONS_DIR, { recursive: true });

// TEMP: large limit while migrating sites
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/root/.openclaw/workspace/uploads/andres/inbox';
const MAX_FILE_MB = process.env.MAX_FILE_MB ? Number(process.env.MAX_FILE_MB) : 2048;

// Canonical runbook/context file for the VPS (editable from dashboard)
const VPS_MD_PATH = process.env.VPS_MD_PATH || '/root/.openclaw/workspace/memory/vps.md';
const VPS_MD_MAX_BYTES = process.env.VPS_MD_MAX_BYTES ? Number(process.env.VPS_MD_MAX_BYTES) : 400_000; // ~400KB


// Context docs (editable from dashboard)
const CONTEXT_ROOT = process.env.CONTEXT_ROOT || '/root/.openclaw/workspace/context';
const CONTEXT_MAX_BYTES = process.env.CONTEXT_MAX_BYTES ? Number(process.env.CONTEXT_MAX_BYTES) : 500_000; // ~500KB per file
const CONTEXT_FILES = {
  vps: { label: 'VPS', rel: 'VPS.md' },
  mako: { label: 'Mako', rel: 'proyectos/mako.md' },
  altezza: { label: 'Altezza', rel: 'proyectos/altezza.md' },
  feego: { label: 'Feego', rel: 'proyectos/feego.md' },
  sisproind: { label: 'Sisproind', rel: 'proyectos/sisproind.md' },
  mercypersonalizados: { label: 'Mercy Personalizados', rel: 'proyectos/mercypersonalizados.md' },
  comopreparar: { label: 'ComoPreparar', rel: 'proyectos/comopreparar.md' },
};
function contextPathForKey(key) {
  const spec = CONTEXT_FILES[key];
  if (!spec) return null;
  const full = path.resolve(CONTEXT_ROOT, spec.rel);
  // ensure within root
  const root = path.resolve(CONTEXT_ROOT) + path.sep;
  if (!full.startsWith(root)) return null;
  return full;
}

function contextKeyForProjectSlug(slug) {
  if (!slug) return null;
  if (slug === 'altezza') return 'altezza';
  if (slug === 'mako') return 'mako';
  if (slug === 'feego') return 'feego';
  if (slug === 'sisproind') return 'sisproind';
  if (slug === 'mercypersonalizados') return 'mercypersonalizados';
  if (slug === 'comopreparar') return 'comopreparar';
  return null;
}

function designRulesPathForProjectSlug(slug) {
  // For now: only Altezza (Mievento) is supported
  if (slug === 'altezza') return '/opt/stacks/mievento/lab/app/docs/design/RULES.md';
  return null;
}

function extractPendientes(md) {
  const text = String(md || '');
  const lines = text.split(/\n/);
  let inPend = false;
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^#\s+Pendientes\b/.test(l.trim())) { inPend = true; continue; }
    if (inPend && /^#\s+/.test(l.trim())) break;
    if (!inPend) continue;
    const m = l.match(/\[(PENDIENTE|COMPROBAR)\]\s*(.+)$/i);
    if (m) items.push({ tag: m[1].toUpperCase(), text: m[2].trim() });
    else if (l.trim().startsWith('- ')) items.push({ tag: 'ITEM', text: l.trim().slice(2).trim() });
  }
  return items;
}


fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const pool = mariadb.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
  connectionLimit: 5,
});

const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  name: 'feego.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 1000 * 60 * 60 * 6 }
}));

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  res.status(401).json({ ok: false, error: 'unauthorized' });
}

function normalizeMountPath(rawPath, fallback) {
  const source = (rawPath || fallback || '').trim();
  if (!source) return fallback;
  const withLeadingSlash = source.startsWith('/') ? source : `/${source}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, '');
  return withoutTrailingSlash || '/';
}

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ADMIN_BASE_PATH = normalizeMountPath(process.env.ADMIN_BASE_PATH, '/administracion');
const ADMIN_ASSETS_PATH = `${ADMIN_BASE_PATH}/assets`;
const ADMIN_BASE_REGEX = new RegExp(`^${escapeRegExp(ADMIN_BASE_PATH)}\\/(.*)$`);

function page(html) {
  return `<!doctype html><html lang="es"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Feego Admin</title>
<style>
body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:radial-gradient(circle at 20% 10%, #1b2a4a 0%, #0b1020 40%, #070a12 100%);color:#e5e7eb;}
.wrap{display:flex;min-height:100vh;}
.sidebar{width:260px;background:rgba(255,255,255,.06);backdrop-filter:blur(14px);border-right:1px solid rgba(255,255,255,.08);padding:18px;}
.brand{font-weight:800;letter-spacing:.5px;margin-bottom:18px;}
.nav a{display:block;padding:10px 10px;border-radius:10px;color:#e5e7eb;text-decoration:none;margin-bottom:6px;background:transparent;border:1px solid transparent}
.nav a.active{background:rgba(37,99,235,.16);border-color:rgba(37,99,235,.35)}
.card{background:rgba(255,255,255,.06);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.10);border-radius:14px;padding:14px;}
.main{flex:1;padding:22px;}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;}
@media(max-width:900px){
  .grid{grid-template-columns:1fr;}
  .sidebar{
    display:block;
    position:fixed;
    top:56px;
    left:0;
    height:calc(100% - 56px);
    transform:translateX(-110%);
    transition:transform .18s ease;
    z-index:999;
    width:260px;
  }
}
.btn{background:#2563eb;border:0;color:white;padding:10px 12px;border-radius:10px;font-weight:700;cursor:pointer;}
.btn2{background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.12);color:white;padding:10px 12px;border-radius:10px;font-weight:700;cursor:pointer;}
.input{width:100%;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.25);color:#fff;}
.small{color:#9ca3af;font-size:12px;}
a{color:#93c5fd}
.prog{height:10px;background:rgba(255,255,255,.10);border-radius:999px;overflow:hidden}
.prog > div{height:100%;width:0%;background:linear-gradient(90deg,#2563eb,#22c55e);}
.table{width:100%;border-collapse:collapse}
.table td,.table th{padding:10px;border-bottom:1px solid rgba(255,255,255,.08);text-align:left;font-size:13px}
.row{display:flex;gap:10px;align-items:center}
</style></head><body>
  <div id="mobile-header" style="display:none;position:fixed;top:0;left:0;right:0;height:56px;background:linear-gradient(90deg,#0b1226,#12203a);z-index:999;padding:8px 12px;align-items:center;display:flex;gap:10px;">
    <button id="hamburger" aria-label="Abrir menú" style="background:transparent;border:0;color:#fff;font-size:22px;">☰</button>
    <div style="flex:1;font-weight:700;color:#e5e7eb">Feego Admin</div>
  </div>
  <div id="mobile-backdrop" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:998"></div>
  ${html}
  <script>
    // Mobile sidebar toggle
    (function(){
      function isMobile(){ return window.innerWidth <= 900; }
      function showHeaderIfMobile(){
        var h=document.getElementById('mobile-header');
        if(!h) return;
        h.style.display = isMobile() ? 'flex' : 'none';
        var wrap=document.querySelector('.wrap');
        if(!isMobile()){ document.getElementById('mobile-backdrop').style.display='none'; wrap.style.marginTop='0'; }
        else { wrap.style.marginTop='56px'; }
      }
      window.addEventListener('resize', showHeaderIfMobile);
      document.addEventListener('DOMContentLoaded', function(){
        showHeaderIfMobile();
        var btn=document.getElementById('hamburger');
        var side=document.querySelector('.sidebar');
        var backdrop=document.getElementById('mobile-backdrop');
        if(!btn||!side||!backdrop) return;
        btn.addEventListener('click', function(){
          // open
          side.style.transform = 'translateX(0)';
          backdrop.style.display='block';
        });
        backdrop.addEventListener('click', function(){
          // close
          side.style.transform = 'translateX(-110%)';
          backdrop.style.display='none';
        });
      });
    })();
  </script>
</body></html>`;
}

function loginCard() {
  return `
  <div id="loginCard" class="card" style="max-width:420px;display:none">
    <div style="font-weight:800;margin-bottom:10px">Iniciar sesión</div>
    <label class="small">Usuario</label>
    <input class="input" id="u" placeholder="FeegoAdmin" />
    <div style="height:8px"></div>
    <label class="small">Contraseña</label>
    <input class="input" id="p" type="password" placeholder="••••••••" />
    <div style="height:12px"></div>
    <button class="btn" id="login">Entrar</button>
    <div class="small" id="msg" style="margin-top:10px"></div>
  </div>`;
}

function shellJs() {
  return `
<script>
async function j(url, opts){
  const r = await fetch(url, {credentials:'include', ...opts});
  const t = await r.text();
  let data={};
  try{data=JSON.parse(t)}catch(e){data={raw:t}}
  return {ok:r.ok, status:r.status, data};
}
async function refreshCommon(){
  const s = await j('/api/session');
  const sessEl=document.getElementById('sess');
  const logout=document.getElementById('logout');
  const loginCard=document.getElementById('loginCard');
  if(s.ok && s.data.authenticated){
    sessEl.textContent = 'Autenticado como ' + s.data.username;
    if(loginCard) loginCard.style.display='none';
    if(logout) { logout.style.display='inline-block'; logout.onclick = async ()=>{ await j('/api/logout',{method:'POST'}); location.reload(); }; }
    return true;
  }
  sessEl.textContent='No autenticado';
  if(loginCard) loginCard.style.display='block';
  if(logout) logout.style.display='none';
  return false;
}
async function wireLogin(){
  const btn=document.getElementById('login');
  if(!btn) return;
  btn.onclick = async ()=>{
    const u=document.getElementById('u').value.trim();
    const p=document.getElementById('p').value;
    const r = await j('/api/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username:u,password:p})});
    document.getElementById('msg').textContent = r.ok ? 'OK' : ('Error (' + r.status + ')');
    if(r.ok) location.reload();
  };
}
</script>`;
}

// React UI (SPA)
// Serve React under ADMIN_BASE_PATH; keep SSR at /administracion-legacy while migrating.
app.use(ADMIN_ASSETS_PATH, express.static(UI_DIST_ASSETS_DIR));
app.use(ADMIN_BASE_PATH, express.static(UI_DIST_DIR));
app.get(ADMIN_BASE_REGEX, (req, res) => res.sendFile(path.join(UI_DIST_DIR, 'index.html')));

// Temporary: keep old /ui path for quick testing
app.use('/assets', express.static(UI_DIST_ASSETS_DIR));
app.use('/ui', express.static(UI_DIST_DIR));
app.get(/^\/ui\/(.*)$/, (req, res) => res.sendFile(path.join(UI_DIST_DIR, 'index.html')));

app.get('/', (req, res) => res.redirect(ADMIN_BASE_PATH));

app.get('/administracion-legacy', (req, res) => {
  res.type('html').send(page(`
<div class="wrap">
  <aside class="sidebar">
    <div class="brand">Feego Admin</div>
    <div class="card">
      <div style="font-weight:700">Sesión</div>
      <div class="small" id="sess">cargando…</div>
      <div style="height:10px"></div>
      <button class="btn" id="logout" style="display:none">Salir</button>
    </div>
    <div style="height:14px"></div>
    <div class="nav">
      <a href="${ADMIN_BASE_PATH}" class="active">Dashboard</a>
      <a href="${ADMIN_BASE_PATH}/uploads">Uploads</a>
      <a href="${ADMIN_BASE_PATH}/kanban">Kanban</a>
    </div>
  </aside>
  <main class="main">
    <h2 style="margin:0 0 10px 0">Dashboard</h2>
    <div class="small" style="margin-bottom:14px">Prioridad: login + uploads nativos.</div>
    ${loginCard()}
    <div id="dash" style="display:none">
      <div class="grid">
        <div class="card"><div style="font-weight:800">Servidor</div><div class="small" id="srv">cargando…</div></div>
        <div class="card"><div style="font-weight:800">Memoria</div><div class="small" id="mem">cargando…</div></div>
        <div class="card"><div style="font-weight:800">Carga</div><div class="small" id="load">cargando…</div></div>
      </div>
    </div>
  </main>
</div>
${shellJs()}
<script>
(async ()=>{
  const authed = await refreshCommon();
  await wireLogin();
  if(!authed) return;
  document.getElementById('dash').style.display='block';
  const st = await j('/api/status');
  if(st.ok){
    document.getElementById('srv').textContent = st.data.hostname + ' · uptime ' + st.data.uptime;
    document.getElementById('mem').textContent = st.data.mem;
    document.getElementById('load').textContent = st.data.load;
  }
})();
</script>`));
});

app.get('/administracion-legacy/uploads', (req, res) => {
  res.type('html').send(page(`
<div class="wrap">
  <aside class="sidebar">
    <div class="brand">Feego Admin</div>
    <div class="card">
      <div style="font-weight:700">Sesión</div>
      <div class="small" id="sess">cargando…</div>
      <div style="height:10px"></div>
      <button class="btn" id="logout" style="display:none">Salir</button>
    </div>
    <div style="height:14px"></div>
    <div class="nav">
      <a href="${ADMIN_BASE_PATH}">Dashboard</a>
      <a href="${ADMIN_BASE_PATH}/uploads" class="active">Uploads</a>
      <a href="${ADMIN_BASE_PATH}/kanban">Kanban</a>
    </div>
  </aside>
  <main class="main">
    <h2 style="margin:0 0 10px 0">Uploads</h2>
    <div class="small" style="margin-bottom:14px">Subida estable (1 archivo a la vez). Límite temporal por archivo: ~${MAX_FILE_MB}MB.</div>

    ${loginCard()}

    <div id="wrap" style="display:none">
      <div class="card">
        <div class="row">
          <input id="files" class="input" type="file" multiple />
          <button id="uploadBtn" class="btn">Upload</button>
        </div>
        <div class="small" id="upmsg" style="margin-top:10px"></div>
        <div style="height:10px"></div>
        <div id="sel" class="small"></div>
      </div>

      <div style="height:14px"></div>
      <div class="card">
        <div class="row" style="justify-content:space-between">
          <div style="font-weight:800">Archivos en carpeta</div>
          <button id="refresh" class="btn2">Refrescar</button>
        </div>
        <div style="height:10px"></div>
        <table class="table">
          <thead><tr><th>Tipo</th><th>Nombre</th><th>Ext</th><th>Tamaño</th><th>Fecha</th><th>Acciones</th></tr></thead>
          <tbody id="list"><tr><td class="small" colspan="6">cargando…</td></tr></tbody>
        </table>
      </div>
    </div>

      <div id="modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;">
        <div style="max-width:1100px;margin:4vh auto;">
          <div class="card" style="padding:12px 12px;display:flex;justify-content:space-between;align-items:center;gap:10px">
            <div>
              <div style="font-weight:900" id="mtitle">Visor</div>
              <div class="small" id="msub"></div>
            </div>
            <div class="row">
              <a class="btn2" id="mdownload" target="_blank">Descargar</a>
              <button class="btn" id="mclose">Cerrar</button>
            </div>
          </div>
          <div class="card" style="margin-top:12px">
            <div id="mbody" class="small">cargando…</div>
          </div>
        </div>
      </div>
  </main>
</div>
${shellJs()}
<script>
function fmtBytes(n){
  const u=['B','KB','MB','GB','TB'];
  let i=0; let x=n;
  while(x>=1024 && i<u.length-1){x/=1024; i++;}
  return x.toFixed(i===0?0:1)+' '+u[i];
}
function iconForExt(ext){
  ext=(ext||'').toLowerCase();
  if(ext==='pdf') return '📄';
  if(['doc','docx','rtf'].includes(ext)) return '📝';
  if(['xls','xlsx','csv'].includes(ext)) return '📊';
  if(['zip','rar','7z','tar','gz'].includes(ext)) return '🗜️';
  if(['sql'].includes(ext)) return '🛢️';
  if(['png','jpg','jpeg','webp','gif'].includes(ext)) return '🖼️';
  if(['mp4','mov','mkv','avi','webm'].includes(ext)) return '🎞️';
  if(['txt','log','md'].includes(ext)) return '📃';
  return '📁';
}

function renderSelected(files){
  const el=document.getElementById('sel');
  if(!files || !files.length){ el.innerHTML=''; return; }
  const rows=['<table class="table"><thead><tr><th>Archivo</th><th>Ext</th><th>Tamaño</th><th>Progreso</th><th>Estado</th></tr></thead><tbody>'];
  for(let i=0;i<files.length;i++){
    const f=files[i];
    const ext=(f.name.split('.').pop()||'').toLowerCase();
    rows.push('<tr><td>'+f.name+'</td><td>'+ext+'</td><td>'+fmtBytes(f.size)+'</td>'+
      '<td><div class="prog"><div id="p_'+i+'"></div></div> <span class="small" id="pp_'+i+'"></span></td>'+
      '<td class="small" id="st_'+i+'">pendiente</td></tr>');
  }
  rows.push('</tbody></table>');
  el.innerHTML=rows.join('');
}

async function loadList(){
  const r = await j('/api/uploads/list');
  const tb=document.getElementById('list');
  if(!r.ok){ tb.innerHTML='<tr><td class="small" colspan="6">error</td></tr>'; return; }
  if(!r.data.items.length){ tb.innerHTML='<tr><td class="small" colspan="6">vacío</td></tr>'; return; }
  tb.innerHTML = r.data.items.map(it=>{
    const d=new Date(it.mtime);
    const icon=iconForExt(it.ext);
    const dl='/api/uploads/download?name='+encodeURIComponent(it.name);
    return '<tr><td>'+icon+'</td><td>'+it.name+'</td><td>'+ (it.ext||'') +'</td><td>'+fmtBytes(it.size)+'</td><td>'+d.toLocaleString()+'</td><td>' +
      '<a href="#" data-act="view" data-name="'+encodeURIComponent(it.name)+'">Ver</a> · ' +
      '<a href="'+dl+'">Descargar</a> · ' +
      '<a href="#" data-act="del" data-name="'+encodeURIComponent(it.name)+'">Eliminar</a>' +
      '</td></tr>';
  }).join('');
}

function uploadOne(file, idx){
  return new Promise((resolve)=>{
    const fd=new FormData();
    fd.append('file', file);
    const xhr=new XMLHttpRequest();
    xhr.open('POST','/api/uploads');
    xhr.withCredentials=true;
    xhr.upload.onprogress = (e)=>{
      if(e.lengthComputable){
        const pct=Math.round((e.loaded/e.total)*100);
        const bar=document.getElementById('p_'+idx);
        const pp=document.getElementById('pp_'+idx);
        if(bar) bar.style.width=pct+'%';
        if(pp) pp.textContent=pct+'%';
      }
    };
    xhr.onload = ()=>{
      const st=document.getElementById('st_'+idx);
      if(st) st.textContent = xhr.status===200 ? 'OK' : ('Error '+xhr.status);
      resolve(xhr.status===200);
    };
    xhr.onerror = ()=>{ const st=document.getElementById('st_'+idx); if(st) st.textContent='Error red'; resolve(false); };
    xhr.send(fd);
  });
}

async function uploadSequential(files){
  document.getElementById('upmsg').textContent='';
  for(let i=0;i<files.length;i++){
    const st=document.getElementById('st_'+i);
    if(st) st.textContent='subiendo…';
    await uploadOne(files[i], i);
  }
  document.getElementById('upmsg').textContent='Listo.';
  await loadList();
}

(async ()=>{
  const authed = await refreshCommon();
  await wireLogin();
  if(!authed) return;
  document.getElementById('wrap').style.display='block';

  const input=document.getElementById('files');
  input.onchange = ()=>renderSelected(Array.from(input.files||[]));

  document.getElementById('uploadBtn').onclick = async ()=>{
    const files=Array.from(input.files||[]);
    if(!files.length) return;
    renderSelected(files);
    await uploadSequential(files);
    input.value='';
    renderSelected([]);
  };

  

  function showModal(title, sub, bodyHtml, downloadUrl){
    const m=document.getElementById('modal');
    document.getElementById('mtitle').textContent=title||'Visor';
    document.getElementById('msub').textContent=sub||'';
    document.getElementById('mbody').innerHTML=bodyHtml||'';
    const dl=document.getElementById('mdownload');
    dl.href = downloadUrl || '#';
    m.style.display='block';
  }
  function hideModal(){
    document.getElementById('modal').style.display='none';
  }
  document.getElementById('mclose').onclick = hideModal;
  document.getElementById('modal').onclick = (e)=>{ if(e.target.id==='modal') hideModal(); };

  async function viewFile(name){
    const decoded = decodeURIComponent(name);
    const ext = (decoded.split('.').pop()||'').toLowerCase();
    const dl = '/api/uploads/download?name=' + encodeURIComponent(decoded);
    const view = '/api/uploads/view?name=' + encodeURIComponent(decoded);

    if(['png','jpg','jpeg','webp','gif'].includes(ext)){
      showModal(decoded, 'Imagen', '<img src="'+view+'" style="max-width:100%;border-radius:10px"/>', dl);
      return;
    }
    if(ext==='pdf'){
      showModal(decoded, 'PDF', '<iframe src="'+view+'" style="width:100%;height:75vh;border:0;border-radius:10px;background:rgba(0,0,0,.25)"></iframe>', dl);
      return;
    }

    const r = await fetch(view, {credentials:'include'});
    const txt = await r.text();
    if(!r.ok){
      showModal(decoded, 'No se pudo abrir', '<div class="small">'+txt+'</div>', dl);
      return;
    }
    const esc = txt.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    showModal(decoded, 'Texto', '<pre style="white-space:pre-wrap;word-break:break-word;margin:0">'+esc+'</pre>', dl);
  }

  async function deleteFile(name){
    const decoded = decodeURIComponent(name);
    if(!confirm('Eliminar: ' + decoded + ' ?')) return;
    const r = await j('/api/uploads/delete', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name: decoded})});
    if(!r.ok){
      alert('Error al eliminar (' + r.status + ')');
      return;
    }
    await loadList();
  }

  document.getElementById('list').onclick = async (e)=>{
    const a = e.target.closest('a');
    if(!a) return;
    const act = a.getAttribute('data-act');
    const name = a.getAttribute('data-name');
    if(!act || !name) return;
    e.preventDefault();
    if(act==='view') return viewFile(name);
    if(act==='del') return deleteFile(name);
  };

document.getElementById('refresh').onclick = loadList;
  await loadList();
})();
</script>`));
});


app.get('/administracion-legacy/kanban', (req, res) => {
  res.type('html').send(page(`
<div class="wrap">
  <aside class="sidebar">
    <div class="brand">Feego Admin</div>
    <div class="card">
      <div style="font-weight:700">Sesión</div>
      <div class="small" id="sess">cargando…</div>
      <div style="height:10px"></div>
      <button class="btn" id="logout" style="display:none">Salir</button>
    </div>
    <div style="height:14px"></div>
    <div class="nav">
      <a href="${ADMIN_BASE_PATH}">Dashboard</a>
      <a href="${ADMIN_BASE_PATH}/uploads">Uploads</a>
      <a href="${ADMIN_BASE_PATH}/kanban" class="active">Kanban</a>
    </div>
  </aside>

  <main class="main">
    <h2 style="margin:0 0 10px 0">Kanban</h2>
    <div class="small" style="margin-bottom:14px">MVP: 3 tableros (Ideas por proyecto · Kanban · Archivadas por proyecto). Arrastrable (drag & drop) y optimizado para móvil.</div>

    ${loginCard()}

    <div id="wrap" style="display:none">
      <div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <div class="row" style="flex:1;min-width:260px">
          <button class="btn2" id="prev">←</button>
          <div style="font-weight:900" id="boardTitle">Ideas</div>
          <button class="btn2" id="next">→</button>
          <div class="small" id="boardIdx" style="margin-left:10px"></div>
        </div>
        <div class="row" style="gap:10px">
          <button class="btn2" id="newProject">+ Proyecto</button>
          <button class="btn" id="newCard">+ Tarjeta</button>
        </div>
      </div>

      <div style="height:14px"></div>

      <div id="boards" style="position:relative;overflow:hidden">
        <div id="track" style="display:flex;transition:transform .22s ease;gap:14px;">
          <div class="card" style="min-width:100%">
            <div class="small" style="margin-bottom:10px">Tablero 1: Ideas por proyecto</div>
            <div id="ideas" style="display:flex;gap:12px;overflow:auto;padding-bottom:8px"></div>
          </div>

          <div class="card" style="min-width:100%">
            <div class="small" style="margin-bottom:10px">Tablero 2: Kanban</div>
            <div id="kanban" style="display:flex;gap:12px;overflow:auto;padding-bottom:8px"></div>
          </div>

          <div class="card" style="min-width:100%">
            <div class="small" style="margin-bottom:10px">Tablero 3: Archivadas por proyecto</div>
            <div id="archived" style="display:flex;gap:12px;overflow:auto;padding-bottom:8px"></div>
          </div>
        </div>
      </div>

      <div style="height:10px"></div>
      <div class="small">Tip: en móvil puedes deslizar horizontalmente dentro de las columnas; y el menú se abre con ☰.</div>
    </div>
  </main>
</div>

<!-- SortableJS (CDN) -->
<script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js"></script>

${shellJs()}
<script>
const BOARDS = [
  { key:'ideas', title:'Ideas' },
  { key:'kanban', title:'Kanban' },
  { key:'archived', title:'Archivadas' },
];
let boardIndex = 0;

function setBoard(idx){
  boardIndex = (idx + BOARDS.length) % BOARDS.length;
  document.getElementById('boardTitle').textContent = BOARDS[boardIndex].title;
  document.getElementById('boardIdx').textContent = (boardIndex+1) + ' / ' + BOARDS.length;
  document.getElementById('track').style.transform = 'translateX(' + (-boardIndex*100) + '%)';
}

function colHtml(title, subtitle, colKey){
  return (
    '<div style="min-width:280px;max-width:320px;flex:0 0 auto">' +
      '<div class="card" style="padding:10px 10px">' +
        '<div style="font-weight:900">' + title + '</div>' +
        '<div class="small">' + (subtitle || '') + '</div>' +
        '<div style="height:8px"></div>' +
        '<div data-col="' + colKey + '" class="kb-col" style="min-height:80px;display:flex;flex-direction:column;gap:8px"></div>' +
      '</div>' +
    '</div>'
  );
}

function cardHtml(c){
  const proj = c.project_name ? ('<span class="small" style="opacity:.9">' + c.project_name + '</span>') : '';
  const meta = '<div class="small">' + proj + '</div>';
  const btn = (c.board==='ideas')
    ? ('<button class="btn2" data-act="toTodo" data-id="' + c.id + '">Pasar a Por hacer</button>')
    : ((c.board==='kanban' && c.status==='done')
      ? ('<button class="btn2" data-act="archive" data-id="' + c.id + '">Archivar</button>')
      : '');

  return (
    '<div class="card kb-card" data-id="' + c.id + '" style="padding:10px">' +
      '<div style="font-weight:800">' + c.title + '</div>' +
      meta +
      '<div style="height:8px"></div>' +
      '<div class="row" style="justify-content:space-between">' +
        '<div></div>' +
        btn +
      '</div>' +
    '</div>'
  );
}

async function loadState(){
  const r = await j('/api/kanban/state');
  if(!r.ok) throw new Error('state');
  return r.data;
}

function mountBoards(state){
  // Build columns
  const ideasEl=document.getElementById('ideas');
  const archEl=document.getElementById('archived');
  ideasEl.innerHTML='';
  archEl.innerHTML='';

  // project columns
  for(const p of state.projects){
    ideasEl.insertAdjacentHTML('beforeend', colHtml(p.name, 'Ideas', 'ideas:project:'+p.id));
    archEl.insertAdjacentHTML('beforeend', colHtml(p.name, 'Archivadas', 'archived:project:'+p.id));
  }

  // kanban columns
  const kan=document.getElementById('kanban');
  kan.innerHTML='';
  kan.insertAdjacentHTML('beforeend', colHtml('Por hacer','', 'kanban:todo'));
  kan.insertAdjacentHTML('beforeend', colHtml('Haciendo','', 'kanban:doing'));
  kan.insertAdjacentHTML('beforeend', colHtml('Hecho','', 'kanban:done'));

  // Fill cards
  const byCol={};
  for(const c of state.cards){
    let key='';
    if(c.board==='ideas') key='ideas:project:'+c.project_id;
    else if(c.board==='archived') key='archived:project:'+c.project_id;
    else key='kanban:'+c.status;
    byCol[key]=byCol[key]||[];
    byCol[key].push(c);
  }
  // sort by sort field
  for(const k of Object.keys(byCol)) byCol[k].sort((a,b)=> (a.sort||0)-(b.sort||0));

  document.querySelectorAll('.kb-col').forEach(col=>{
    const k=col.getAttribute('data-col');
    const items=byCol[k]||[];
    col.innerHTML = items.map(cardHtml).join('');
  });

  // Actions
  document.querySelectorAll('.kb-card button[data-act]').forEach(btn=>{
    btn.onclick = async (e)=>{
      e.stopPropagation();
      const act=btn.getAttribute('data-act');
      const id=Number(btn.getAttribute('data-id'));
      if(act==='toTodo'){
        await j('/api/kanban/move', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id, board:'kanban', status:'todo'})});
      } else if(act==='archive'){
        await j('/api/kanban/move', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id, board:'archived', status:'n/a'})});
      }
      refresh();
    };
  });

  // Drag & drop
  document.querySelectorAll('.kb-col').forEach(col=>{
    new Sortable(col, {
      group: 'kb',
      animation: 150,
      ghostClass: 'kb-ghost',
      onEnd: async (evt)=>{
        const cardId = Number(evt.item.getAttribute('data-id'));
        const colKey = evt.to.getAttribute('data-col');
        // compute new sort as index
        const newSort = evt.newIndex;
        const payload = { id: cardId, sort: newSort };
        if(colKey.startsWith('ideas:project:')){
          payload.board='ideas'; payload.status='n/a'; payload.project_id=Number(colKey.split(':').pop());
        } else if(colKey.startsWith('archived:project:')){
          payload.board='archived'; payload.status='n/a'; payload.project_id=Number(colKey.split(':').pop());
        } else if(colKey==='kanban:todo' || colKey==='kanban:doing' || colKey==='kanban:done'){
          payload.board='kanban'; payload.status=colKey.split(':')[1];
        }
        await j('/api/kanban/move', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
        // We won't refresh to keep UI snappy, but it is fine to refresh.
      }
    });
  });
}

async function refresh(){
  const st = await loadState();
  mountBoards(st);
}

(async ()=>{
  const authed = await refreshCommon();
  await wireLogin();
  if(!authed) return;
  document.getElementById('wrap').style.display='block';

  document.getElementById('prev').onclick = ()=>setBoard(boardIndex-1);
  document.getElementById('next').onclick = ()=>setBoard(boardIndex+1);
  setBoard(0);

  document.getElementById('newProject').onclick = async ()=>{
    const name = prompt('Nombre del proyecto');
    if(!name) return;
    const r = await j('/api/kanban/project', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name})});
    if(!r.ok) alert('Error creando proyecto');
    await refresh();
  };

  document.getElementById('newCard').onclick = async ()=>{
    const title = prompt('Título de la tarjeta');
    if(!title) return;
    // create in current board, default project is first
    const st = await loadState();
    const first = st.projects[0];
    if(!first){ alert('Crea un proyecto primero'); return; }
    const boardKey = BOARDS[boardIndex].key;
    let payload = { title, project_id: first.id, board:'ideas', status:'n/a' };
    if(boardKey==='kanban') payload = { title, project_id: first.id, board:'kanban', status:'todo' };
    if(boardKey==='archived') payload = { title, project_id: first.id, board:'archived', status:'n/a' };
    const r = await j('/api/kanban/card', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
    if(!r.ok) alert('Error creando tarjeta');
    await refresh();
  };

  await refresh();
})();
</script>`));
});


// --- API ---

// --- Quotes (simple JSON store + PDF generator) ---
const QUOTES_DIR = process.env.QUOTES_DIR || path.join(getDataRoot(), 'cotizaciones');

// --- phpMyAdmin temporary token gate (Nginx auth_request) ---
// (moved below after FEEGO_DATA_ROOT is defined)
const QUOTES_FILE = path.join(QUOTES_DIR, 'quotes.json');
fs.mkdirSync(QUOTES_DIR, { recursive: true });
if (!fs.existsSync(QUOTES_FILE)) fs.writeFileSync(QUOTES_FILE, '[]');

async function readQuotes() {
  const raw = await fs.promises.readFile(QUOTES_FILE, 'utf8');
  try { return JSON.parse(raw); } catch { return []; }
}
async function writeQuotes(list) {
  await fs.promises.writeFile(QUOTES_FILE, JSON.stringify(list, null, 2), 'utf8');
}
function safeMoney(n) {
  const x = Number(n || 0);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.round(x));
}

function defaultBranding() {
  return {
    companyName: 'Feego',
    legalName: 'Feego',
    nit: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    quoteTitle: 'COTIZACION',
    validityDays: 15,
    paymentTerms: '50% anticipo y 50% contra entrega.',
    notesFooter: 'Gracias por confiar en Feego.',
    warrantyParagraph: 'Todos los equipos cuentan con una garantia limitada sujeta a diagnostico tecnico y condiciones de uso.',
    signerName: '',
    signerRole: '',
    accentColor: '#1f4db6',
  };
}

function getBrandingPaths() {
  const root = getDataRoot();
  return {
    dir: path.join(root, 'branding'),
    configFile: path.join(root, 'branding', 'branding.json'),
    logoFile: path.join(root, 'branding', 'logo.png'),
    signatureFile: path.join(root, 'branding', 'signature.png'),
  };
}

async function readBranding() {
  const { configFile } = getBrandingPaths();
  try {
    const raw = await fs.promises.readFile(configFile, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...defaultBranding(), ...(parsed || {}) };
  } catch {
    return defaultBranding();
  }
}

async function writeBranding(next) {
  const { dir, configFile } = getBrandingPaths();
  await fs.promises.mkdir(dir, { recursive: true });
  const merged = { ...defaultBranding(), ...(next || {}) };
  await fs.promises.writeFile(configFile, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

function hexToRgbSafe(hex, fallback = [31, 77, 182]) {
  const h = String(hex || '').trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return fallback;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function drawWrappedText(page, text, x, y, maxWidth, lineHeight, font, size, color) {
  const out = [];
  const words = String(text || '').split(/\s+/).filter(Boolean);
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      line = test;
    } else {
      if (line) out.push(line);
      line = w;
    }
  }
  if (line) out.push(line);
  let yy = y;
  for (const l of out) {
    page.drawText(l, { x, y: yy, size, font, color });
    yy -= lineHeight;
  }
  return yy;
}

app.get('/api/quotes', requireAuth, async (req, res) => {
  try {
    const q = await readQuotes();
    q.sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
    res.json({ ok: true, items: q.slice(0, 200) });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

app.post('/api/quotes', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const customer = String(body.customer || '').trim();
    const date = String(body.date || '').trim();
    const notes = String(body.notes || '').trim();
    const totalize = body.totalize !== false;
    const items = Array.isArray(body.items) ? body.items : [];
    if (!customer) return res.status(400).json({ ok: false, error: 'missing_customer' });

    const cleanedItems = items
      .map((it) => ({
        name: String(it.name || '').trim(),
        qty: safeMoney(it.qty || 1) || 1,
        unitPrice: safeMoney(it.unitPrice || 0),
        imageUrls: (() => {
          const raw = Array.isArray(it.imageUrls) ? it.imageUrls : [it.imageUrl];
          return raw
            .map((u) => String(u || '').trim())
            .filter(Boolean)
            .slice(0, 10);
        })(),
      }))
      .map((it) => ({ ...it, imageUrl: it.imageUrls[0] || '' }))
      .filter((it) => it.name);

    const id = crypto.randomBytes(8).toString('hex');
    const createdAt = new Date().toISOString();
    const quote = { id, customer, date, notes, totalize, items: cleanedItems, createdAt, createdBy: req.session.username || 'unknown' };

    const list = await readQuotes();
    list.unshift(quote);
    await writeQuotes(list);

    res.json({ ok: true, quote });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

app.get('/api/quotes/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id || '');
  const list = await readQuotes();
  const q = list.find(x => x.id === id);
  if (!q) return res.status(404).json({ ok: false, error: 'not_found' });
  res.json({ ok: true, quote: q });
});

app.put('/api/quotes/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id || '');
  try {
    const body = req.body || {};
    const customer = String(body.customer || '').trim();
    const date = String(body.date || '').trim();
    const notes = String(body.notes || '').trim();
    const totalize = body.totalize !== false;
    const items = Array.isArray(body.items) ? body.items : [];
    if (!customer) return res.status(400).json({ ok: false, error: 'missing_customer' });

    const cleanedItems = items
      .map((it) => ({
        name: String(it.name || '').trim(),
        qty: safeMoney(it.qty || 1) || 1,
        unitPrice: safeMoney(it.unitPrice || 0),
        imageUrls: (() => {
          const raw = Array.isArray(it.imageUrls) ? it.imageUrls : [it.imageUrl];
          return raw
            .map((u) => String(u || '').trim())
            .filter(Boolean)
            .slice(0, 10);
        })(),
      }))
      .map((it) => ({ ...it, imageUrl: it.imageUrls[0] || '' }))
      .filter((it) => it.name);

    const list = await readQuotes();
    const idx = list.findIndex((x) => String(x.id) === id);
    if (idx < 0) return res.status(404).json({ ok: false, error: 'not_found' });

    const prev = list[idx] || {};
    const updated = {
      ...prev,
      customer,
      date,
      notes,
      totalize,
      items: cleanedItems,
      updatedAt: new Date().toISOString(),
      updatedBy: req.session.username || 'unknown',
    };
    list[idx] = updated;
    await writeQuotes(list);
    res.json({ ok: true, quote: updated });
  } catch {
    res.status(500).json({ ok: false });
  }
});

app.get('/api/quotes/:id/pdf', requireAuth, async (req, res) => {
  const id = String(req.params.id || '');
  const list = await readQuotes();
  const q = list.find(x => x.id === id);
  if (!q) return res.status(404).send('not_found');
  const forceDownload = String((req.query && req.query.download) || '') === '1';

  const branding = await readBranding();
  const [r, g, b] = hexToRgbSafe(branding.accentColor);
  const accent = rgb(r / 255, g / 255, b / 255);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const PAGE_W = 612;
  const PAGE_H = 792;
  const margin = 38;
  const footerReserved = 56;
  const footerLineY = 34;

  function drawCommonFooter(pageObj) {
    const { width } = pageObj.getSize();
    pageObj.drawLine({
      start: { x: margin, y: footerLineY + 20 },
      end: { x: width - margin, y: footerLineY + 20 },
      thickness: 1,
      color: rgb(0.88, 0.9, 0.94),
    });
    if (branding.notesFooter) {
      pageObj.drawText(String(branding.notesFooter).slice(0, 130), {
        x: margin,
        y: footerLineY + 6,
        size: 8,
        font,
        color: rgb(0.35, 0.4, 0.48),
      });
    }
    if (branding.address) {
      pageObj.drawText(String(branding.address).slice(0, 130), {
        x: margin,
        y: footerLineY - 6,
        size: 8,
        font,
        color: rgb(0.35, 0.4, 0.48),
      });
    }
  }

  function newPage() {
    const p = doc.addPage([PAGE_W, PAGE_H]);
    drawCommonFooter(p);
    return p;
  }

  async function embedAnyImage(url, reqObj) {
    const raw = String(url || '').trim();
    if (!raw) return null;
    let buf = null;
    try {
      if (raw.startsWith('data:image/')) {
        const b64 = raw.split(',')[1] || '';
        if (b64) buf = Buffer.from(b64, 'base64');
      } else if (raw.startsWith('/api/uploads/view?')) {
        const u = new URL(`http://localhost${raw}`);
        const name = String(u.searchParams.get('name') || '');
        if (name && !name.includes('..') && !name.includes('/') && !name.includes('\\')) {
          const full = path.join(UPLOAD_DIR, name);
          buf = await fs.promises.readFile(full);
        }
      } else if (raw.startsWith('/content/uploads/')) {
        const name = path.basename(raw);
        const full = path.join(UPLOAD_DIR, name);
        buf = await fs.promises.readFile(full);
      } else if (raw.startsWith('http://') || raw.startsWith('https://')) {
        const rmt = await fetch(raw, { headers: { 'User-Agent': 'FeegoAdmin/1.0' } });
        if (rmt.ok) buf = Buffer.from(await rmt.arrayBuffer());
      }
      if (!buf || !buf.length) return null;
      const png = await sharp(buf).rotate().png({ compressionLevel: 9 }).toBuffer();
      const img = await doc.embedPng(png);
      return img;
    } catch {
      return null;
    }
  }

  const imageCache = new Map();
  async function getImage(url) {
    if (!url) return null;
    if (imageCache.has(url)) return imageCache.get(url);
    const img = await embedAnyImage(url, req);
    imageCache.set(url, img);
    return img;
  }

  // First page
  const page = newPage();
  const { width, height } = page.getSize();
  let y = height - margin;

  page.drawRectangle({ x: 0, y: height - 132, width, height: 132, color: rgb(0.97, 0.98, 1) });
  page.drawRectangle({ x: 0, y: height - 8, width, height: 8, color: accent });

  try {
    const { logoFile } = getBrandingPaths();
    const logoBuf = await fs.promises.readFile(logoFile);
    const logoImage = await doc.embedPng(logoBuf);
    const maxW = 110;
    const maxH = 58;
    const scale = Math.min(maxW / logoImage.width, maxH / logoImage.height, 1);
    const w = logoImage.width * scale;
    const h = logoImage.height * scale;
    page.drawImage(logoImage, { x: width - margin - w, y: height - 88 - (h / 2), width: w, height: h });
  } catch {}

  page.drawText(String(branding.quoteTitle || 'COTIZACION').toUpperCase(), {
    x: margin, y: height - 62, size: 22, font: fontBold, color: accent,
  });
  page.drawText(`No. ${id.slice(0, 8).toUpperCase()}`, {
    x: margin, y: height - 82, size: 10, font, color: rgb(0.3, 0.35, 0.45),
  });

  // 2-column company header
  const headerBottom = height - 132;
  const infoTopY = headerBottom + 44;
  const col1x = margin;
  const col2x = margin + 260;
  const leftInfo = [
    String(branding.legalName || branding.companyName || 'Feego'),
    branding.nit ? `NIT: ${branding.nit}` : '',
    branding.phone ? `Tel: ${branding.phone}` : '',
  ].filter(Boolean);
  const rightInfo = [
    branding.email ? `Email: ${branding.email}` : '',
    branding.website ? `Web: ${branding.website}` : '',
  ].filter(Boolean);
  let ly = infoTopY;
  for (const line of leftInfo.slice(0, 4)) { page.drawText(line, { x: col1x, y: ly, size: 9, font, color: rgb(0.25, 0.28, 0.35) }); ly -= 12; }
  let ry = infoTopY;
  for (const line of rightInfo.slice(0, 4)) { page.drawText(line, { x: col2x, y: ry, size: 9, font, color: rgb(0.25, 0.28, 0.35) }); ry -= 12; }

  y = headerBottom - 16;
  page.drawRectangle({ x: margin, y: y - 58, width: width - margin * 2, height: 58, color: rgb(0.99, 0.99, 1) });
  page.drawRectangle({ x: margin, y: y - 58, width: width - margin * 2, height: 58, borderColor: rgb(0.9, 0.92, 0.96), borderWidth: 1 });
  page.drawText('CLIENTE', { x: margin + 12, y: y - 16, size: 9, font: fontBold, color: rgb(0.45, 0.5, 0.6) });
  page.drawText(String(q.customer || 'N/A').slice(0, 70), { x: margin + 12, y: y - 32, size: 12, font: fontBold, color: rgb(0.12, 0.14, 0.18) });
  page.drawText(`Fecha: ${q.date || new Date().toLocaleDateString('es-CO')}`, { x: width - margin - 170, y: y - 24, size: 10, font, color: rgb(0.22, 0.25, 0.3) });
  y -= 78;

  const colItem = margin + 10;
  const colQty = width - margin - 175;
  const colUnit = width - margin - 120;
  const colTotal = width - margin - 58;
  page.drawRectangle({ x: margin, y: y - 20, width: width - margin * 2, height: 20, color: accent });
  page.drawText('ITEM', { x: colItem, y: y - 14, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('CANT.', { x: colQty, y: y - 14, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('UNIT.', { x: colUnit, y: y - 14, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('TOTAL', { x: colTotal, y: y - 14, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  y -= 24;

  let grand = 0;
  const shouldTotalize = q.totalize !== false;
  const rows = (q.items || []).slice(0, 35);
  for (let idx = 0; idx < rows.length; idx += 1) {
    const it = rows[idx];
    const qty = safeMoney(it.qty || 1) || 1;
    const unit = safeMoney(it.unitPrice || 0);
    const total = qty * unit;
    grand += total;
    const rowBg = idx % 2 === 0 ? rgb(0.985, 0.988, 0.995) : rgb(1, 1, 1);
    page.drawRectangle({ x: margin, y: y - 20, width: width - margin * 2, height: 20, color: rowBg });
    page.drawRectangle({ x: margin, y: y - 20, width: width - margin * 2, height: 20, borderColor: rgb(0.93, 0.94, 0.97), borderWidth: 0.6 });
    page.drawText(`${idx + 1}. ${String(it.name || '').slice(0, 65)}`, { x: colItem, y: y - 14, size: 9, font, color: rgb(0.12, 0.14, 0.18) });
    page.drawText(String(qty), { x: colQty + 4, y: y - 14, size: 9, font, color: rgb(0.12, 0.14, 0.18) });
    page.drawText(unit.toLocaleString('es-CO'), { x: colUnit - 2, y: y - 14, size: 9, font, color: rgb(0.12, 0.14, 0.18) });
    page.drawText(total.toLocaleString('es-CO'), { x: colTotal - 2, y: y - 14, size: 9, font: fontBold, color: rgb(0.12, 0.14, 0.18) });
    y -= 20;
    if (y < 220) break;
  }

  y -= 12;
  page.drawRectangle({ x: width - margin - 250, y: y - 52, width: 250, height: 52, color: rgb(0.97, 0.98, 1) });
  page.drawRectangle({ x: width - margin - 250, y: y - 52, width: 250, height: 52, borderColor: rgb(0.88, 0.9, 0.95), borderWidth: 1 });
  page.drawText('TOTAL COTIZACION', { x: width - margin - 238, y: y - 20, size: 10, font: fontBold, color: rgb(0.28, 0.31, 0.38) });
  page.drawText(shouldTotalize ? grand.toLocaleString('es-CO') : '-----', { x: width - margin - 110, y: y - 38, size: 16, font: fontBold, color: accent });
  y -= 70;

  if (q.notes) {
    page.drawText('Notas', { x: margin, y, size: 10, font: fontBold, color: rgb(0.3, 0.35, 0.45) });
    y -= 16;
    y = drawWrappedText(page, String(q.notes), margin, y, width - margin * 2, 12, font, 9, rgb(0.2, 0.24, 0.3));
    y -= 16;
  }

  const validityDays = Number(branding.validityDays || 0);
  const validity = Number.isFinite(validityDays) && validityDays > 0 ? `${validityDays} dias` : 'N/A';
  const lineY = Math.max(footerReserved + 120, y - 12);
  page.drawLine({ start: { x: margin, y: lineY }, end: { x: width - margin, y: lineY }, thickness: 1, color: rgb(0.86, 0.89, 0.94) });
  let txtY = lineY - 14;
  page.drawText(`Validez: ${validity}`, { x: margin, y: txtY, size: 9, font: fontBold, color: rgb(0.28, 0.31, 0.38) });
  txtY -= 16;
  const conditionsText = String(branding.paymentTerms || '').trim();
  if (conditionsText) {
    page.drawText('Condiciones:', { x: margin, y: txtY, size: 9, font: fontBold, color: rgb(0.28, 0.31, 0.38) });
    txtY = drawWrappedText(page, conditionsText, margin + 78, txtY, width - margin * 2 - 82, 10.5, font, 8.6, rgb(0.28, 0.31, 0.38));
    txtY -= 10;
  }
  const warrantyText = String(branding.warrantyParagraph || '').trim();
  if (warrantyText) {
    page.drawText('Garantia', { x: margin, y: txtY, size: 9, font: fontBold, color: rgb(0.3, 0.35, 0.45) });
    txtY = drawWrappedText(page, warrantyText, margin + 54, txtY, width - margin * 2 - 58, 10.5, font, 8.6, rgb(0.35, 0.4, 0.48));
    txtY -= 8;
  }

  // centered signature around 120px under last paragraph
  const signatureLineY = Math.max(footerReserved + 24, txtY - 120);
  const sigW = 200;
  const sigX = (width - sigW) / 2;
  const sigY = signatureLineY + 4;
  try {
    const { signatureFile } = getBrandingPaths();
    const sigBuf = await fs.promises.readFile(signatureFile);
    const sigImg = await doc.embedPng(sigBuf);
    const maxW = 180;
    const maxH = 54;
    const scale = Math.min(maxW / sigImg.width, maxH / sigImg.height, 1);
    const sw = sigImg.width * scale;
    const sh = sigImg.height * scale;
    page.drawImage(sigImg, { x: sigX + (sigW - sw) / 2, y: sigY, width: sw, height: sh });
  } catch {}
  page.drawLine({ start: { x: sigX, y: signatureLineY }, end: { x: sigX + sigW, y: signatureLineY }, thickness: 1, color: rgb(0.8, 0.83, 0.88) });
  if (branding.signerName) page.drawText(String(branding.signerName).slice(0, 48), { x: sigX, y: signatureLineY - 12, size: 8, font: fontBold, color: rgb(0.25, 0.3, 0.38) });
  if (branding.signerRole) page.drawText(String(branding.signerRole).slice(0, 54), { x: sigX, y: signatureLineY - 22, size: 8, font, color: rgb(0.35, 0.4, 0.48) });

  // Annex pages with item images
  const itemsForAnnex = (q.items || []).map((it, idx) => ({
    idx,
    name: String(it.name || ''),
    imageUrls: Array.isArray(it.imageUrls) ? it.imageUrls.filter(Boolean) : (it.imageUrl ? [String(it.imageUrl)] : []),
  })).filter((it) => it.imageUrls.length > 0);

  if (itemsForAnnex.length > 0) {
    let p = newPage();
    let py = PAGE_H - margin;
    p.drawText('ANEXO FOTOGRAFICO', { x: margin, y: py - 4, size: 14, font: fontBold, color: accent });
    py -= 24;

    const contentBottom = footerReserved + 20;
    const availableW = PAGE_W - margin * 2;

    for (const it of itemsForAnnex) {
      const titleH = 22;
      if (py - titleH < contentBottom) {
        p = newPage();
        py = PAGE_H - margin;
      }
      p.drawRectangle({ x: margin, y: py - titleH, width: availableW, height: titleH, color: rgb(0.92, 0.95, 1) });
      p.drawRectangle({ x: margin, y: py - titleH, width: availableW, height: titleH, borderColor: rgb(0.8, 0.86, 0.96), borderWidth: 1 });
      p.drawText(`ITEM ${it.idx + 1}: ${it.name}`.slice(0, 110), { x: margin + 10, y: py - 15, size: 10, font: fontBold, color: rgb(0.18, 0.26, 0.45) });
      py -= (titleH + 10);

      if (it.imageUrls.length === 1) {
        const img = await getImage(it.imageUrls[0]);
        if (img) {
          const maxW = availableW * 0.7;
          const maxH = 280;
          const s = Math.min(maxW / img.width, maxH / img.height, 1);
          const iw = img.width * s;
          const ih = img.height * s;
          if (py - ih < contentBottom) {
            p = newPage();
            py = PAGE_H - margin;
          }
          p.drawRectangle({ x: (PAGE_W - iw) / 2 - 4, y: py - ih - 4, width: iw + 8, height: ih + 8, color: rgb(0.98, 0.99, 1) });
          p.drawRectangle({ x: (PAGE_W - iw) / 2 - 4, y: py - ih - 4, width: iw + 8, height: ih + 8, borderColor: rgb(0.86, 0.9, 0.96), borderWidth: 1 });
          p.drawImage(img, { x: (PAGE_W - iw) / 2, y: py - ih, width: iw, height: ih });
          py -= (ih + 16);
        } else {
          p.drawText('No se pudo cargar la imagen.', { x: margin, y: py - 12, size: 9, font, color: rgb(0.45, 0.45, 0.5) });
          py -= 20;
        }
      } else {
        const gap = 12;
        const boxW = (availableW - gap) / 2;
        const boxH = 170;
        for (let i = 0; i < it.imageUrls.length; i += 2) {
          if (py - boxH < contentBottom) {
            p = newPage();
            py = PAGE_H - margin;
          }
          for (let c = 0; c < 2; c += 1) {
            const idx2 = i + c;
            if (idx2 >= it.imageUrls.length) continue;
            const x = margin + c * (boxW + gap);
            p.drawRectangle({ x, y: py - boxH, width: boxW, height: boxH, color: rgb(0.98, 0.99, 1) });
            p.drawRectangle({ x, y: py - boxH, width: boxW, height: boxH, borderColor: rgb(0.86, 0.9, 0.96), borderWidth: 1 });
            const img = await getImage(it.imageUrls[idx2]);
            if (!img) continue;
            const s = Math.min((boxW - 10) / img.width, (boxH - 10) / img.height, 1);
            const iw = img.width * s;
            const ih = img.height * s;
            p.drawImage(img, { x: x + (boxW - iw) / 2, y: py - boxH + (boxH - ih) / 2, width: iw, height: ih });
          }
          py -= (boxH + 12);
        }
      }
      py -= 8;
    }
  }

  const pdfBytes = await doc.save();
  res.setHeader('Content-Type', 'application/pdf');
  const filename = `cotizacion_${q.customer.replace(/[^a-z0-9]+/gi,'_')}_${id}.pdf`;
  res.setHeader('Content-Disposition', `${forceDownload ? 'attachment' : 'inline'}; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.end(Buffer.from(pdfBytes));
});

const brandingUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

app.get('/api/branding', requireAuth, async (req, res) => {
  try {
    const branding = await readBranding();
    const { logoFile, signatureFile } = getBrandingPaths();
    const hasLogo = await fs.promises.stat(logoFile).then(() => true).catch(() => false);
    const hasSignature = await fs.promises.stat(signatureFile).then(() => true).catch(() => false);
    res.json({ ok: true, branding, hasLogo, hasSignature });
  } catch {
    res.status(500).json({ ok: false });
  }
});

app.post('/api/branding', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const next = {
      companyName: String(body.companyName || '').trim(),
      legalName: String(body.legalName || '').trim(),
      nit: String(body.nit || '').trim(),
      email: String(body.email || '').trim(),
      phone: String(body.phone || '').trim(),
      website: String(body.website || '').trim(),
      address: String(body.address || '').trim(),
      quoteTitle: String(body.quoteTitle || '').trim() || 'COTIZACION',
      validityDays: Math.max(0, Number(body.validityDays || 0) || 0),
      paymentTerms: String(body.paymentTerms || '').trim(),
      notesFooter: String(body.notesFooter || '').trim(),
      warrantyParagraph: String(body.warrantyParagraph || '').trim(),
      signerName: String(body.signerName || '').trim(),
      signerRole: String(body.signerRole || '').trim(),
      accentColor: /^#[0-9a-fA-F]{6}$/.test(String(body.accentColor || '').trim()) ? String(body.accentColor).trim() : '#1f4db6',
    };
    const branding = await writeBranding(next);
    res.json({ ok: true, branding });
  } catch {
    res.status(500).json({ ok: false });
  }
});

app.post('/api/branding/logo', requireAuth, brandingUpload.single('logo'), async (req, res) => {
  const f = req.file;
  if (!f || !f.buffer) return res.status(400).json({ ok: false, error: 'no_file' });
  try {
    const { dir, logoFile } = getBrandingPaths();
    await fs.promises.mkdir(dir, { recursive: true });
    await sharp(f.buffer)
      .rotate()
      .resize({ width: 1200, height: 400, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toFile(logoFile);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

app.get('/api/branding/logo', requireAuth, async (req, res) => {
  try {
    const { logoFile } = getBrandingPaths();
    const st = await fs.promises.stat(logoFile);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', String(st.size));
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(logoFile).pipe(res);
  } catch {
    res.status(404).end();
  }
});


// Public infra icons
app.get('/api/public/infra-icons/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').replace(/[^a-z0-9_-]/gi, '');
    const file = path.join(INFRA_ICONS_DIR, slug + '.png');
    const st = await fs.promises.stat(file);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', String(st.size));
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    res.status(404).end();
  }
});

app.get('/api/public/branding/logo', async (req, res) => {
  try {
    const { logoFile } = getBrandingPaths();
    const st = await fs.promises.stat(logoFile);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', String(st.size));
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(logoFile).pipe(res);
  } catch {
    res.status(404).end();
  }
});

app.post('/api/branding/signature', requireAuth, brandingUpload.single('signature'), async (req, res) => {
  const f = req.file;
  if (!f || !f.buffer) return res.status(400).json({ ok: false, error: 'no_file' });
  try {
    const { dir, signatureFile } = getBrandingPaths();
    await fs.promises.mkdir(dir, { recursive: true });
    await sharp(f.buffer)
      .rotate()
      .resize({ width: 900, height: 260, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toFile(signatureFile);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

app.get('/api/branding/signature', requireAuth, async (req, res) => {
  try {
    const { signatureFile } = getBrandingPaths();
    const st = await fs.promises.stat(signatureFile);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', String(st.size));
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(signatureFile).pipe(res);
  } catch {
    res.status(404).end();
  }
});


app.get('/api/session', (req, res) => {
  if (req.session && req.session.userId) return res.json({ authenticated: true, username: req.session.username });
  res.json({ authenticated: false });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ ok: false });
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query('SELECT id, username, password_hash FROM users WHERE username=? LIMIT 1', [username]);
    if (!rows.length) return res.status(401).json({ ok: false });
    const u = rows[0];
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ ok: false });
    req.session.userId = Number(u.id);
    req.session.username = u.username;
    req.session.save((err) => {
      if (err) return res.status(500).json({ ok: false });
      res.json({ ok: true });
    });
  } catch (e) {
    res.status(500).json({ ok: false });
  } finally {
    if (conn) conn.release();
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/status', requireAuth, (req, res) => {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const pct = Math.round((used / total) * 100);
  const memStr = (used / 1024 / 1024 / 1024).toFixed(1) + 'Gi usados / ' + (total / 1024 / 1024 / 1024).toFixed(1) + 'Gi total (' + pct + '%)';
  const load = os.loadavg().map(x => x.toFixed(2)).join(', ');
  res.json({ hostname: os.hostname(), uptime: Math.round(os.uptime() / 60) + 'm', mem: memStr, load });
});

// Deploy verification (public, no auth)
app.get('/api/__version', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  let sha = process.env.APP_SHA || null;
  try {
    if (!sha) {
      const { execSync } = require('child_process');
      sha = execSync('git -C /opt/feego-admin rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    }
  } catch (e) {}

  res.json({
    app: process.env.APP_NAME || 'feegoadmin',
    env: process.env.APP_ENV || 'prod',
    sha,
    builtAt: process.env.BUILT_AT || null,
  });
});

// VPS runbook/context (vps.md)
app.get('/api/vps-md', requireAuth, async (req, res) => {
  try {
    const st = await fs.promises.stat(VPS_MD_PATH);
    if (st.size > VPS_MD_MAX_BYTES) return res.status(413).json({ ok: false, error: 'file_too_large', size: st.size });
    const content = await fs.promises.readFile(VPS_MD_PATH, 'utf8');
    res.json({ ok: true, path: VPS_MD_PATH, mtimeMs: st.mtimeMs, size: st.size, content });
  } catch (e) {
    if (e && e.code === 'ENOENT') return res.status(404).json({ ok: false, error: 'not_found' });
    res.status(500).json({ ok: false, error: 'read_failed' });
  }
});

app.put('/api/vps-md', requireAuth, async (req, res) => {
  try {
    const content = (req.body && typeof req.body.content === 'string') ? req.body.content : null;
    if (content === null) return res.status(400).json({ ok: false, error: 'missing_content' });
    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > VPS_MD_MAX_BYTES) return res.status(413).json({ ok: false, error: 'content_too_large', size: bytes });

    // Backup (best-effort)
    try {
      const dir = path.dirname(VPS_MD_PATH);
      const base = path.basename(VPS_MD_PATH, path.extname(VPS_MD_PATH));
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const backup = path.join(dir, base + '.bak-' + ts + '.md');
      await fs.promises.copyFile(VPS_MD_PATH, backup);
    } catch (e) {}

    await fs.promises.mkdir(path.dirname(VPS_MD_PATH), { recursive: true });
    await fs.promises.writeFile(VPS_MD_PATH, content, 'utf8');
    const st = await fs.promises.stat(VPS_MD_PATH);
    res.json({ ok: true, path: VPS_MD_PATH, mtimeMs: st.mtimeMs, size: st.size });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'write_failed' });
  }
});


// Context docs API
app.get('/api/context/files', requireAuth, (req, res) => {
  const files = Object.entries(CONTEXT_FILES).map(([key, v]) => ({ key, label: v.label, rel: v.rel }));
  res.json({ ok: true, root: CONTEXT_ROOT, files });
});

app.get('/api/context/file', requireAuth, async (req, res) => {
  try {
    const key = String(req.query.key || '').trim();
    const full = contextPathForKey(key);
    if (!full) return res.status(400).json({ ok: false, error: 'bad_key' });
    const st = await fs.promises.stat(full);
    if (st.size > CONTEXT_MAX_BYTES) return res.status(413).json({ ok: false, error: 'file_too_large', size: st.size });
    const content = await fs.promises.readFile(full, 'utf8');
    res.json({ ok: true, key, path: full, rel: CONTEXT_FILES[key].rel, label: CONTEXT_FILES[key].label, mtimeMs: st.mtimeMs, size: st.size, content });
  } catch (e) {
    if (e && e.code === 'ENOENT') return res.status(404).json({ ok: false, error: 'not_found' });
    res.status(500).json({ ok: false, error: 'read_failed' });
  }
});

app.put('/api/context/file', requireAuth, async (req, res) => {
  try {
    const key = String(req.query.key || '').trim();
    const full = contextPathForKey(key);
    if (!full) return res.status(400).json({ ok: false, error: 'bad_key' });

    const content = (req.body && typeof req.body.content === 'string') ? req.body.content : null;
    if (content === null) return res.status(400).json({ ok: false, error: 'missing_content' });

    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > CONTEXT_MAX_BYTES) return res.status(413).json({ ok: false, error: 'content_too_large', size: bytes });

    await fs.promises.mkdir(path.dirname(full), { recursive: true });

    // backup best-effort
    try {
      const dir = path.dirname(full);
      const base = path.basename(full, path.extname(full));
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const backup = path.join(dir, base + '.bak-' + ts + '.md');
      await fs.promises.copyFile(full, backup);
    } catch (e) {}

    await fs.promises.writeFile(full, content, 'utf8');
    const st = await fs.promises.stat(full);
    res.json({ ok: true, key, path: full, rel: CONTEXT_FILES[key].rel, label: CONTEXT_FILES[key].label, mtimeMs: st.mtimeMs, size: st.size });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'write_failed' });
  }
});

// Infra projects (dashboard)
app.get('/api/infra/projects', requireAuth, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query('SELECT slug, name, status, repo_url, domains_json, branches_json, policies_md, notes_md, color_hex FROM infra_projects ORDER BY name ASC');

    const projects = await Promise.all((rows || []).map(async (r) => {
      let domains = []; let branches = [];
      try { domains = r.domains_json ? JSON.parse(r.domains_json) : []; } catch (e) {}
      try { branches = r.branches_json ? JSON.parse(r.branches_json) : []; } catch (e) {}

      let pending_count = 0;
      try {
        const key = contextKeyForProjectSlug(r.slug);
        const full = contextPathForKey(key);
        if (full) {
          const md = await fs.promises.readFile(full, 'utf8');
          pending_count = extractPendientes(md).length;
        }
      } catch (e) {}

      return {
        slug: r.slug,
        name: r.name,
        status: r.status,
        repo_url: r.repo_url || null,
        domains,
        branches,
        policies_md: r.policies_md || '',
        notes_md: r.notes_md || '',
        logo_url: '/api/public/infra-icons/' + r.slug,
        color_hex: r.color_hex || null,
        pending_count,
      };
    }));

    res.json({ ok: true, projects });
  } catch (e) {
    res.status(500).json({ ok: false });
  } finally {
    if (conn) conn.release();
  }
});

app.get('/api/infra/projects/:slug', requireAuth, async (req, res) => {
  let conn;
  try {
    const slug = String(req.params.slug || '');
    conn = await pool.getConnection();
    const rows = await conn.query('SELECT slug, name, status, repo_url, domains_json, branches_json, policies_md, notes_md, color_hex FROM infra_projects WHERE slug=? LIMIT 1', [slug]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
    const r = rows[0];
    let domains=[]; let branches=[];
    try { domains = r.domains_json ? JSON.parse(r.domains_json) : []; } catch (e) {}
    try { branches = r.branches_json ? JSON.parse(r.branches_json) : []; } catch (e) {}
    res.json({
      ok: true,
      project: {
        slug: r.slug,
        name: r.name,
        status: r.status,
        repo_url: r.repo_url || null,
        domains,
        branches,
        policies_md: r.policies_md || '',
        notes_md: r.notes_md || '',
        logo_url: '/api/public/infra-icons/' + r.slug,
        color_hex: r.color_hex || null,
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false });
  } finally {
    if (conn) conn.release();
  }
});


// Infra activity (calendar)
app.get('/api/infra/activity/summary', requireAuth, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const meta = await conn.query("SELECT value FROM infra_activity_meta WHERE `key`='last_computed_at' LIMIT 1");
    const rows = await conn.query("SELECT DATE_FORMAT(day,'%Y-%m-%d') AS day, minutes_total, minutes_by_project_json, source FROM infra_activity_daily ORDER BY day ASC");
    const days = rows.map((r) => {
      let byProject = {};
      try {
        byProject = r.minutes_by_project_json ? JSON.parse(r.minutes_by_project_json) : {};
      } catch (e) {}
      return {
        day: r.day,
        minutes_total: r.minutes_total,
        byProject,
        source: r.source,
      };
    });
    res.json({ ok: true, last_computed_at: meta[0] ? meta[0].value : null, days });
  } catch (e) {
    res.status(500).json({ ok: false });
  } finally {
    if (conn) conn.release();
  }
});

app.get('/api/infra/activity/day', requireAuth, async (req, res) => {
  let conn;
  try {
    const day = String(req.query.day || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return res.status(400).json({ ok: false, error: 'bad_day' });
    conn = await pool.getConnection();
    const rows = await conn.query(
      'SELECT day, minutes_total, minutes_by_project_json, source, events_count, updated_at FROM infra_activity_daily WHERE day=? LIMIT 1',
      [day],
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
    const r = rows[0];
    let byProject = {};
    try {
      byProject = r.minutes_by_project_json ? JSON.parse(r.minutes_by_project_json) : {};
    } catch (e) {}
    res.json({ ok: true, day, minutes_total: r.minutes_total, byProject, source: r.source, events_count: r.events_count, updated_at: r.updated_at });
  } catch (e) {
    res.status(500).json({ ok: false });
  } finally {
    if (conn) conn.release();
  }
});


app.post('/api/infra/activity/manual', requireAuth, async (req, res) => {
  let conn;
  try {
    const day = String((req.body && req.body.day) || '').trim();
    const project_slug = String((req.body && (req.body.project_slug || req.body.project)) || 'unknown').trim() || 'unknown';
    const minutes = Math.max(0, Math.min(24 * 60, Number((req.body && req.body.minutes) ?? 0) || 0));
    const title = String((req.body && req.body.title) || 'Registro manual').trim() || 'Registro manual';
    const notes = String((req.body && req.body.notes) || '').trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return res.status(400).json({ ok: false, error: 'bad_day' });
    if (!minutes) return res.status(400).json({ ok: false, error: 'bad_minutes' });

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // persist manual event (audit trail)
    await conn.query(
      'INSERT INTO infra_activity_manual_events (day, project_slug, minutes, title, notes, source, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [day, project_slug, minutes, title, notes, 'manual', String(req.session && req.session.user && req.session.user.username || 'admin')],
    );

    // upsert daily aggregate
    const rows = await conn.query('SELECT minutes_total, minutes_by_project_json, source, events_count FROM infra_activity_daily WHERE day=? LIMIT 1', [day]);
    let minutes_total = minutes;
    let byProject = { [project_slug]: minutes };
    let source = 'manual';
    let events_count = 1;

    if (rows.length) {
      const r = rows[0];
      minutes_total = (Number(r.minutes_total) || 0) + minutes;
      events_count = (Number(r.events_count) || 0) + 1;
      source = (r.source && r.source !== 'unknown' && r.source !== 'manual') ? 'mixed' : 'manual';
      try { byProject = r.minutes_by_project_json ? JSON.parse(r.minutes_by_project_json) : {}; } catch (e) { byProject = {}; }
      byProject[project_slug] = (Number(byProject[project_slug]) || 0) + minutes;
      await conn.query(
        'UPDATE infra_activity_daily SET minutes_total=?, minutes_by_project_json=?, source=?, events_count=?, updated_at=NOW() WHERE day=?',
        [minutes_total, JSON.stringify(byProject), source, events_count, day],
      );
    } else {
      await conn.query(
        'INSERT INTO infra_activity_daily (day, minutes_total, minutes_by_project_json, source, events_count, updated_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [day, minutes_total, JSON.stringify(byProject), source, events_count],
      );
    }

    await conn.commit();
    res.json({ ok: true, day, minutes_total, byProject, source });
  } catch (e) {
    try { if (conn) await conn.rollback(); } catch (e2) {}
    res.status(500).json({ ok: false, error: 'manual_insert_failed' });
  } finally {
    if (conn) conn.release();
  }
});

app.post('/api/infra/activity/recompute', requireAuth, async (req, res) => {
  try {
    // Run recompute script (fast enough for manual refresh)
    const { execSync } = require('child_process');
    execSync('node scripts/recompute_activity.js', { cwd: '/opt/feego-admin', stdio: 'ignore', timeout: 60_000 });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});


// Project context markdown (source of truth)
app.get('/api/infra/projects/:slug/md', requireAuth, async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();
    const key = contextKeyForProjectSlug(slug);
    const full = contextPathForKey(key);
    if (!full) return res.status(404).json({ ok: false, error: 'no_md' });
    const st = await fs.promises.stat(full);
    if (st.size > CONTEXT_MAX_BYTES) return res.status(413).json({ ok: false, error: 'file_too_large', size: st.size });
    const content = await fs.promises.readFile(full, 'utf8');
    const pendientes = extractPendientes(content);
    res.json({ ok: true, slug, path: full, mtimeMs: st.mtimeMs, size: st.size, content, pendientes });
  } catch (e) {
    if (e && e.code === 'ENOENT') return res.status(404).json({ ok: false, error: 'not_found' });
    res.status(500).json({ ok: false, error: 'read_failed' });
  }
});

// Project design rules (read from LAB checkout)
app.get('/api/infra/projects/:slug/design-rules', requireAuth, async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();
    const full = designRulesPathForProjectSlug(slug);
    if (!full) return res.status(404).json({ ok: false, error: 'no_rules' });
    const st = await fs.promises.stat(full);
    if (st.size > CONTEXT_MAX_BYTES) return res.status(413).json({ ok: false, error: 'file_too_large', size: st.size });
    const content = await fs.promises.readFile(full, 'utf8');
    res.json({ ok: true, slug, source: 'lab', path: full, mtimeMs: st.mtimeMs, size: st.size, content });
  } catch (e) {
    if (e && e.code === 'ENOENT') return res.status(404).json({ ok: false, error: 'not_found' });
    res.status(500).json({ ok: false, error: 'read_failed' });
  }
});


// System overview (read-only)
app.get('/api/system/overview', requireAuth, async (req, res) => {
  try {
    const { execSync } = require('child_process');

    const now = new Date().toISOString();
    const hostname = os.hostname();
    const uptimeSec = os.uptime();
    const load = os.loadavg();
    const cpuCount = (os.cpus() || []).length;

    const mem = { total: os.totalmem(), free: os.freemem() };

    function sh(cmd) {
      return execSync(cmd, { encoding: 'utf8' }).trim();
    }

    let disk = null;
    try { disk = sh('df -h'); } catch (e) {}

    const ifaces = os.networkInterfaces();
    const net = Object.fromEntries(Object.entries(ifaces).map(([k, arr]) => [
      k,
      (arr || []).filter((x) => !x.internal).map((x) => ({ address: x.address, family: x.family, mac: x.mac }))
    ]));

    let publicIp = null;
    try { publicIp = sh('curl -s https://api.ipify.org'); } catch (e) {}

    let ports = null;
    try {
      ports = sh("ss -ltn | awk 'NR>1 {print $4}' | sed 's/.*://' | sort -n | uniq");
    } catch (e) {}

    const docker = { systemDf: null, stats: null, ps: null };
    try { docker.systemDf = sh('docker system df'); } catch (e) {}
    try { docker.stats = sh("docker stats --no-stream --format '{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.PIDs}}'"); } catch (e) {}
    try { docker.ps = sh("docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}'"); } catch (e) {}

    const services = ['nginx.service', 'feego-admin.service', 'backend-sisproind.service', 'openclaw-gateway.service'];
    const svc = [];
    for (const name of services) {
      let active = 'unknown';
      try { active = sh('systemctl is-active ' + name + ' || true'); } catch (e) {}
      svc.push({ name, active });
    }

    const certs = [];
    try {
      const list = sh('ls -1 /etc/letsencrypt/live 2>/dev/null || true');
      const domains = list.split(/\n+/).filter(Boolean);
      for (const d of domains) {
        try {
          const exp = sh('openssl x509 -enddate -noout -in /etc/letsencrypt/live/' + d + '/fullchain.pem | cut -d= -f2');
          certs.push({ domain: d, notAfter: exp });
        } catch (e) {}
      }
    } catch (e) {}

    res.json({
      ok: true,
      now,
      hostname,
      uptimeSec,
      cpuCount,
      load,
      mem,
      publicIp,
      net,
      ports,
      disk,
      docker,
      services: svc,
      certs,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e && e.message) ? e.message : 'system_overview_failed' });
  }
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safe = (file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, stamp + '__' + safe);
    }
  }),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024 },
});

function extFromImageContentType(ct) {
  const t = String(ct || '').toLowerCase().split(';')[0].trim();
  if (t === 'image/jpeg') return 'jpg';
  if (t === 'image/png') return 'png';
  if (t === 'image/webp') return 'webp';
  if (t === 'image/gif') return 'gif';
  if (t === 'image/bmp') return 'bmp';
  if (t === 'image/svg+xml') return 'svg';
  if (t === 'image/heic') return 'heic';
  if (t === 'image/heif') return 'heif';
  if (t === 'image/avif') return 'avif';
  if (t === 'image/tiff') return 'tiff';
  return '';
}

function extFromRemoteUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const ext = path.extname(u.pathname || '').replace('.', '').toLowerCase();
    if (['jpg','jpeg','png','webp','gif','bmp','svg','heic','heif','avif','tif','tiff'].includes(ext)) {
      if (ext === 'jpeg') return 'jpg';
      if (ext === 'tif') return 'tiff';
      return ext;
    }
    return '';
  } catch {
    return '';
  }
}

app.post('/api/uploads', requireAuth, upload.single('file'), async (req, res) => {
  const f = req.file;
  if (!f) return res.status(400).json({ ok: false, error: 'no_file' });
  const item = { name: f.filename, size: f.size };
  try {
    const conn = await pool.getConnection();
    try {
      await conn.query('INSERT INTO audit_log (user_id, action, detail, ip) VALUES (?,?,?,?)', [req.session.userId, 'upload', JSON.stringify([item]), req.ip]);
    } finally {
      conn.release();
    }
  } catch (_e) {}
  res.json({ ok: true, file: item });
});

app.post('/api/uploads/from-url', requireAuth, async (req, res) => {
  const rawUrl = String((req.body && req.body.url) || '').trim();
  if (!rawUrl) return res.status(400).json({ ok: false, error: 'missing_url' });

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return res.status(400).json({ ok: false, error: 'bad_url' });
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ ok: false, error: 'bad_protocol' });
  }

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(parsed.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'FeegoAdmin/1.0' },
    });
    if (!r.ok) return res.status(400).json({ ok: false, error: 'fetch_failed', status: r.status });

    const ct = String(r.headers.get('content-type') || '').toLowerCase();
    if (ct && !ct.startsWith('image/')) return res.status(400).json({ ok: false, error: 'not_image' });

    const ab = await r.arrayBuffer();
    const buf = Buffer.from(ab);
    if (!buf.length) return res.status(400).json({ ok: false, error: 'empty_file' });
    if (buf.length > MAX_FILE_MB * 1024 * 1024) {
      return res.status(413).json({ ok: false, error: 'file_too_large', maxMb: MAX_FILE_MB });
    }

    const ext = extFromImageContentType(ct) || extFromRemoteUrl(parsed.toString()) || 'jpg';
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${stamp}__remote_${crypto.randomBytes(5).toString('hex')}.${ext}`;
    const full = path.join(UPLOAD_DIR, filename);
    await fs.promises.writeFile(full, buf);

    res.json({ ok: true, file: { name: filename, size: buf.length } });
  } catch (e) {
    if (e && e.name === 'AbortError') return res.status(408).json({ ok: false, error: 'timeout' });
    return res.status(500).json({ ok: false, error: 'fetch_exception' });
  } finally {
    clearTimeout(timeout);
  }
});

app.get('/api/uploads/list', requireAuth, async (req, res) => {
  try {
    const entries = await fs.promises.readdir(UPLOAD_DIR, { withFileTypes: true });
    const items = [];
    for (const e of entries) {
      if (!e.isFile()) continue;
      const full = path.join(UPLOAD_DIR, e.name);
      const st = await fs.promises.stat(full);
      const ext = path.extname(e.name).replace('.', '').toLowerCase();
      items.push({ name: e.name, ext, size: st.size, mtime: st.mtimeMs });
    }
    items.sort((a, b) => b.mtime - a.mtime);
    res.json({ ok: true, items: items.slice(0, 500) });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

app.get('/api/uploads/download', requireAuth, async (req, res) => {
  const name = String(req.query.name || '');
  if (!name) return res.status(400).send('missing');
  if (name.includes('..') || name.includes('/') || name.includes('\\')) return res.status(400).send('bad_name');
  const full = path.join(UPLOAD_DIR, name);
  try {
    const st = await fs.promises.stat(full);
    if (!st.isFile()) return res.status(404).send('not_found');

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(st.size));
    res.setHeader('Content-Disposition', 'attachment; filename="' + name.replace(/"/g, '') + '"');

    const stream = fs.createReadStream(full);
    stream.on('error', () => res.status(404).end('not_found'));
    stream.pipe(res);
  } catch (e) {
    res.status(404).send('not_found');
  }
});



app.post('/api/uploads/delete', requireAuth, async (req, res) => {
  const name = String((req.body && req.body.name) || '');
  if (!name) return res.status(400).json({ ok: false, error: 'missing' });
  if (name.includes('..') || name.includes('/') || name.includes('\\')) return res.status(400).json({ ok: false, error: 'bad_name' });
  const full = path.join(UPLOAD_DIR, name);
  try {
    const st = await fs.promises.stat(full);
    if (!st.isFile()) return res.status(404).json({ ok: false, error: 'not_found' });
    await fs.promises.unlink(full);
    try {
      const conn = await pool.getConnection();
      try {
        await conn.query('INSERT INTO audit_log (user_id, action, detail, ip) VALUES (?,?,?,?)', [req.session.userId, 'delete', JSON.stringify({ name: name, size: st.size }), req.ip]);
      } finally {
        conn.release();
      }
    } catch (_e) {}
    res.json({ ok: true });
  } catch (e) {
    res.status(404).json({ ok: false, error: 'not_found' });
  }
});

app.get('/api/uploads/view', requireAuth, async (req, res) => {
  const name = String(req.query.name || '');
  if (!name) return res.status(400).send('missing');
  if (name.includes('..') || name.includes('/') || name.includes('\\')) return res.status(400).send('bad_name');
  const full = path.join(UPLOAD_DIR, name);
  try {
    const st = await fs.promises.stat(full);
    if (!st.isFile()) return res.status(404).send('not_found');

    const ext = path.extname(name).replace('.', '').toLowerCase();

    if (['png','jpg','jpeg','webp','gif','pdf','heic','heif','avif','tif','tiff'].includes(ext)) {
      const ct = (
        ext === 'pdf' ? 'application/pdf' :
        ext === 'heic' ? 'image/heic' :
        ext === 'heif' ? 'image/heif' :
        ext === 'avif' ? 'image/avif' :
        (ext === 'tif' || ext === 'tiff') ? 'image/tiff' :
        ext === 'png' ? 'image/png' :
        (ext === 'webp' ? 'image/webp' :
        (ext === 'gif' ? 'image/gif' : 'image/jpeg'))
      );
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', ct);
      res.setHeader('Content-Length', String(st.size));
      res.setHeader('Content-Disposition', 'inline; filename="' + name.replace(/"/g, '') + '"');
      const stream = fs.createReadStream(full);
      stream.on('error', () => res.status(404).end('not_found'));
      return stream.pipe(res);
    }

    if (['txt','log','md','json','csv','sql','xml','yml','yaml','env'].includes(ext) || st.size < 1024*1024) {
      const buf = await fs.promises.readFile(full);
      const sliced = buf.slice(0, 1024*1024);
      res.type('text/plain').send(sliced.toString('utf-8'));
      return;
    }

    return res.status(415).send('unsupported');
  } catch (e) {
    res.status(404).send('not_found');
  }
});



async function hasSectionIdsJsonColumn(conn) {
  try {
    const rows = await conn.query("SHOW COLUMNS FROM kb_cards LIKE 'section_ids_json'");
    if (Array.isArray(rows) && rows.length > 0) return true;
    // Auto-heal in local/dev: create the column if missing so multi-section persistence works.
    await conn.query('ALTER TABLE kb_cards ADD COLUMN section_ids_json TEXT NULL');
    return true;
  } catch (_e) {
    return false;
  }
}

app.get('/api/kanban/state', requireAuth, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const supportsSectionIdsJson = await hasSectionIdsJsonColumn(conn);
    const projects = await conn.query('SELECT id, name, sort, description, logo_path FROM kb_projects WHERE archived=0 ORDER BY sort ASC, id ASC');
    const sections = await conn.query('SELECT id, project_id, name, color, icon, sort FROM kb_sections WHERE archived=0 ORDER BY project_id ASC, sort ASC, id ASC');
    const cards = supportsSectionIdsJson
      ? await conn.query('SELECT id, title, notes, project_id, board, status, sort, due_at, section_id, section_name, section_ids_json, priority, labels_json FROM kb_cards ORDER BY board ASC, status ASC, sort ASC, id ASC')
      : await conn.query('SELECT id, title, notes, project_id, board, status, sort, due_at, section_id, section_name, priority, labels_json FROM kb_cards ORDER BY board ASC, status ASC, sort ASC, id ASC');

    const pmap = { };
    for (const p of projects) pmap[p.id] = p.name;

    const smap = { };
    const smapByProjectAndName = { };
    const sectionKey = (projectId, sectionName) => `${Number(projectId) || 0}::${String(sectionName || '').trim().toLowerCase()}`;
    for (const s of sections) {
      const normalized = { id: Number(s.id), project_id: Number(s.project_id), name: s.name, color: s.color, icon: s.icon, sort: s.sort };
      smap[s.id] = normalized;
      smapByProjectAndName[sectionKey(s.project_id, s.name)] = normalized;
    }

    const outCards = cards.map(c => {
      const parsedSectionIds = (() => {
        try {
          const arr = c.section_ids_json ? JSON.parse(c.section_ids_json) : [];
          if (!Array.isArray(arr)) return [];
          return arr.map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0);
        } catch {
          return [];
        }
      })();
      const sectionsResolvedByIds = parsedSectionIds.map((sid) => smap[sid]).filter(Boolean);
      const sectionsResolvedByNames = (() => {
        const raw = String(c.section_name || '').trim();
        if (!raw) return [];
        const names = raw.includes('||')
          ? raw.split('||').map((n) => String(n || '').trim()).filter(Boolean)
          : [];
        return names
          .map((name) => smapByProjectAndName[sectionKey(c.project_id, name)])
          .filter(Boolean);
      })();
      const secById = c.section_id ? smap[c.section_id] : null;
      const secByName = (!secById && c.section_name)
        ? smapByProjectAndName[sectionKey(c.project_id, c.section_name)]
        : null;
      const sec = secById || secByName || null;
      const cardSections = sectionsResolvedByIds.length > 0
        ? sectionsResolvedByIds
        : (sectionsResolvedByNames.length > 0
          ? sectionsResolvedByNames
          : (sec ? [sec] : []));
      return {
        id: Number(c.id),
        title: c.title,
        notes: c.notes || '',
        project_id: c.project_id ? Number(c.project_id) : null,
        project_name: c.project_id ? pmap[c.project_id] : null,
        board: c.board,
        status: c.status,
        sort: c.sort,
        due_at: c.due_at ? new Date(c.due_at).toISOString() : null,
        section_id: cardSections[0] ? Number(cardSections[0].id) : (c.section_id ? Number(c.section_id) : null),
        section_name: sec ? sec.name : (c.section_name || null),
        section_color: sec ? sec.color : null,
        section_icon: sec ? sec.icon : null,
        section_ids: cardSections.map((s) => Number(s.id)),
        sections: cardSections.map((s) => ({ id: Number(s.id), name: s.name, color: s.color, icon: s.icon })),
        priority: c.priority == null ? null : Number(c.priority),
        labels: (() => { try { return c.labels_json ? JSON.parse(c.labels_json) : []; } catch { return []; } })(),
      };
    });

    res.json({
      ok: true,
      projects: projects.map(p => ({ id: Number(p.id), name: p.name, sort: p.sort, description: p.description || '', logo_path: p.logo_path || null })),
      sections: sections.map(s => ({ id: Number(s.id), project_id: Number(s.project_id), name: s.name, color: s.color, icon: s.icon, sort: s.sort })),
      cards: outCards,
    });
  } catch (e) {
    console.error('kanban/state error', e);
    res.status(500).json({ ok: false });
  } finally {
    if (conn) conn.release();
  }
});

app.post('/api/kanban/project', requireAuth, async (req, res) => {
  const name = String((req.body && req.body.name) || '').trim();
  if (!name) return res.status(400).json({ ok: false });
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query('INSERT INTO kb_projects (name, sort, description, logo_path) VALUES (?, 9999, \'\', NULL)', [name]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false });
  } finally {
    if (conn) conn.release();
  }
});

// FeegoAdmin persistent data
// - VPS/prod: set FEEGO_DATA_ROOT to something like /srv/feego-data/feego-admin
// - Local dev: defaults to <repo>/data
const FEEGO_DATA_ROOT = getDataRoot();
const KANBAN_LOGO_DIR = path.join(FEEGO_DATA_ROOT, 'project-logos');
fs.mkdirSync(KANBAN_LOGO_DIR, { recursive: true });
fs.mkdirSync(path.join(FEEGO_DATA_ROOT, 'branding'), { recursive: true });

// --- phpMyAdmin temporary token gate (Nginx auth_request) ---
const PMA_TOKEN_FILE = path.join(FEEGO_DATA_ROOT, 'pma-token.json');
async function readPmaToken() {
  try {
    const raw = await fs.promises.readFile(PMA_TOKEN_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function pmaTokenOk(token, obj) {
  if (!token) return false;
  if (!obj || !obj.token || !obj.expiresAt) return false;
  if (token !== obj.token) return false;
  if (Date.now() > Number(obj.expiresAt)) return false;
  return true;
}

app.get('/internal/pma-auth', async (req, res) => {
  // only allow local calls
  const ip = (req.ip || '').replace('::ffff:', '');
  if (ip !== '127.0.0.1' && ip !== '::1') return res.status(403).end();
  const token = String((req.query && req.query.token) || req.get('X-Access-Token') || '');
  const obj = await readPmaToken();
  if (!pmaTokenOk(token, obj)) return res.status(401).end();
  return res.status(204).end();
});

// Reverse proxy to local phpMyAdmin (keeps token gating entirely in backend)
const pmaProxy = httpProxy.createProxyServer({
  target: 'http://127.0.0.1:9091',
  changeOrigin: true,
  xfwd: true,
  selfHandleResponse: true,
});

app.use('/pma', async (req, res) => {
  const obj = await readPmaToken();

  const qsToken = String((req.query && req.query.token) || '');
  const cookieToken = String((req.cookies && req.cookies.pma_token) || '');
  const token = qsToken || cookieToken;

  if (!pmaTokenOk(token, obj)) {
    return res.status(404).send('Not Found');
  }

  const cookieMaxAge = Math.max(0, Number(obj.expiresAt) - Date.now());
  const setCookie = qsToken && pmaTokenOk(qsToken, obj)
    ? `pma_token=${encodeURIComponent(qsToken)}; Max-Age=${Math.floor(cookieMaxAge/1000)}; Path=/; HttpOnly; SameSite=Strict`
    : null;

  // one-off response handler
  const onProxyRes = (proxyRes, req2, res2) => {
    // copy status + headers
    res2.statusCode = proxyRes.statusCode || 200;

    const headers = { ...proxyRes.headers };
    // append our cookie without clobbering existing cookies
    if (setCookie) {
      const existing = headers['set-cookie'];
      if (Array.isArray(existing)) headers['set-cookie'] = [...existing, setCookie];
      else if (typeof existing === 'string') headers['set-cookie'] = [existing, setCookie];
      else headers['set-cookie'] = [setCookie];
    }

    Object.entries(headers).forEach(([k, v]) => {
      if (v != null) res2.setHeader(k, v);
    });

    proxyRes.pipe(res2);
  };

  pmaProxy.once('proxyRes', onProxyRes);
  pmaProxy.web(req, res);
});

const kanbanLogoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

app.post('/api/kanban/project/update', requireAuth, async (req, res) => {
  const id = Number((req.body && req.body.id) || 0);
  const name = String((req.body && req.body.name) || '').trim();
  const description = String((req.body && req.body.description) || '').trim();
  if (!id || !name) return res.status(400).json({ ok: false });
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query('UPDATE kb_projects SET name=?, description=? WHERE id=? AND archived=0', [name, description, id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false });
  } finally {
    if (conn) conn.release();
  }
});

app.post('/api/kanban/project/logo', requireAuth, kanbanLogoUpload.single('logo'), async (req, res) => {
  const id = Number((req.body && req.body.project_id) || 0);
  const f = req.file;
  if (!id || !f || !f.buffer) return res.status(400).json({ ok: false });

  let conn;
  try {
    // Convert to WEBP + compress + enforce square output for logos
    const filename = `project_${id}_${Date.now()}.webp`;
    const outPath = path.join(KANBAN_LOGO_DIR, filename);

    await sharp(f.buffer)
      .rotate()
      .resize({ width: 512, height: 512, fit: 'cover' })
      .webp({ quality: 82, effort: 5 })
      .toFile(outPath);

    conn = await pool.getConnection();
    const rel = `project-logos/${filename}`;
    await conn.query('UPDATE kb_projects SET logo_path=? WHERE id=? AND archived=0', [rel, id]);

    res.json({ ok: true, filename, path: rel });
  } catch (e) {
    res.status(500).json({ ok: false });
  } finally {
    if (conn) conn.release();
  }
});

app.get('/api/kanban/project/logo', requireAuth, async (req, res) => {
  const name = String((req.query && req.query.name) || '');
  // allow subpaths like project-logos/<file>, but prevent traversal
  if (!name || name.includes('..') || name.includes('\\')) return res.status(400).end();

  const full = path.resolve(FEEGO_DATA_ROOT, name);
  if (!full.startsWith(path.resolve(FEEGO_DATA_ROOT) + path.sep)) return res.status(400).end();

  try {
    const st = await fs.promises.stat(full);
    res.setHeader('Content-Length', st.size);
    res.setHeader('Cache-Control', 'no-store');
    // best-effort content type
    const ext = path.extname(full).toLowerCase();
    const ct = ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : (ext === '.gif' ? 'image/gif' : 'image/jpeg'));
    res.setHeader('Content-Type', ct);
    fs.createReadStream(full).pipe(res);
  } catch {
    res.status(404).end();
  }
});

app.delete('/api/kanban/project', requireAuth, async (req, res) => {
  const id = Number((req.query && req.query.id) || 0);
  if (!id) return res.status(400).json({ ok: false });
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query('UPDATE kb_projects SET archived=1 WHERE id=?', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false });
  } finally {
    if (conn) conn.release();
  }
});

app.delete('/api/kanban/project/permanent', requireAuth, async (req, res) => {
  const id = Number((req.query && req.query.id) || 0);
  if (!id) return res.status(400).json({ ok: false });
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    await conn.query('DELETE FROM kb_cards WHERE project_id=?', [id]);
    await conn.query('DELETE FROM kb_sections WHERE project_id=?', [id]);
    await conn.query('DELETE FROM kb_projects WHERE id=?', [id]);
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    try { if (conn) await conn.rollback(); } catch {}
    res.status(500).json({ ok: false });
  } finally {
    if (conn) conn.release();
  }
});

app.post('/api/kanban/card', requireAuth, async (req, res) => {
  const title = String((req.body && req.body.title) || '').trim();
  const project_id = Number((req.body && req.body.project_id) || 0) || null;
  const board = String((req.body && req.body.board) || 'ideas');
  const statusRaw = String((req.body && req.body.status) || 'n/a');
  const status = board === 'ideas' ? 'n/a' : statusRaw;
  const section_ids_raw = Array.isArray(req.body && req.body.section_ids) ? req.body.section_ids : [];
  const section_id_raw = (req.body && req.body.section_id != null) ? Number(req.body.section_id) : null;
  const section_ids = Array.from(new Set(
    [
      ...section_ids_raw.map((x) => Number(x)),
      ...(section_id_raw ? [section_id_raw] : []),
    ].filter((x) => Number.isInteger(x) && x > 0)
  ));
  if (!title) return res.status(400).json({ ok: false });
  let conn;
  try {
    conn = await pool.getConnection();
    let insertSort = 9999;
    if (board === 'ideas') {
      const rows = await conn.query(
        'SELECT MIN(sort) AS min_sort FROM kb_cards WHERE board=? AND ((project_id IS NULL AND ? IS NULL) OR project_id=?)',
        [board, project_id, project_id]
      );
      const minSort = Number(rows && rows[0] ? rows[0].min_sort : NaN);
      insertSort = Number.isFinite(minSort) ? (minSort - 1) : 0;
    }
    const supportsSectionIdsJson = await hasSectionIdsJsonColumn(conn);
    let sectionRows = [];
    if (section_ids.length > 0) {
      sectionRows = await conn.query(`SELECT id, project_id, name FROM kb_sections WHERE archived=0 AND id IN (${section_ids.map(() => '?').join(',')})`, section_ids);
      const validIds = new Set((sectionRows || []).filter((r) => Number(r.project_id) === Number(project_id)).map((r) => Number(r.id)));
      if (validIds.size !== section_ids.length) {
        return res.status(400).json({ ok: false, error: 'section_project_mismatch' });
      }
    }
    const primarySectionId = section_ids.length > 0 ? section_ids[0] : null;
    if (supportsSectionIdsJson) {
      await conn.query(
        'INSERT INTO kb_cards (title, project_id, board, status, sort, section_id, section_ids_json) VALUES (?,?,?,?,?,?,?)',
        [title, project_id, board, status, insertSort, primarySectionId, JSON.stringify(section_ids)]
      );
    } else {
      const namesById = new Map((sectionRows || []).map((r) => [Number(r.id), String(r.name || '')]));
      const sectionNameList = section_ids.map((sid) => namesById.get(Number(sid))).filter(Boolean);
      const sectionNameSerialized = sectionNameList.length > 0 ? sectionNameList.join(' || ') : null;
      await conn.query(
        'INSERT INTO kb_cards (title, project_id, board, status, sort, section_id, section_name) VALUES (?,?,?,?,?,?,?)',
        [title, project_id, board, status, insertSort, primarySectionId, sectionNameSerialized]
      );
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false });
  } finally {
    if (conn) conn.release();
  }
});

app.post('/api/kanban/move', requireAuth, async (req, res) => {
  const id = Number((req.body && req.body.id) || 0);
  if (!id) return res.status(400).json({ ok: false });
  const board = String((req.body && req.body.board) || 'kanban');
  const status = String((req.body && req.body.status) || 'n/a');
  const project_id = (req.body && req.body.project_id != null) ? Number(req.body.project_id) : undefined;
  const sort = (req.body && req.body.sort != null) ? Number(req.body.sort) : undefined;

  let conn;
  try {
    conn = await pool.getConnection();
    const supportsSectionIdsJson = await hasSectionIdsJsonColumn(conn);
    const fields = ['board=?', 'status=?'];
    const params = [board, status];
    if (project_id !== undefined) { fields.push('project_id=?'); params.push(project_id || null); }
    // when moving between projects, section may become invalid -> clear
    if (project_id !== undefined) {
      fields.push('section_id=?'); params.push(null);
      if (supportsSectionIdsJson) {
        fields.push('section_ids_json=?'); params.push('[]');
      }
    }
    if (sort !== undefined) { fields.push('sort=?'); params.push(sort); }
    params.push(id);
    await conn.query('UPDATE kb_cards SET ' + fields.join(', ') + ' WHERE id=?', params);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false });
  } finally {
    if (conn) conn.release();
  }
});

app.post('/api/kanban/card/update', requireAuth, async (req, res) => {
  const id = Number((req.body && req.body.id) || 0);
  if (!id) return res.status(400).json({ ok: false });
  const title = String((req.body && req.body.title) || '').trim();
  const notes = String((req.body && req.body.notes) || '');
  const project_id = (req.body && req.body.project_id != null) ? Number(req.body.project_id) : null;
  const section_id = (req.body && req.body.section_id != null) ? Number(req.body.section_id) : null;
  const section_ids_raw = Array.isArray(req.body && req.body.section_ids) ? req.body.section_ids : [];
  const section_ids = Array.from(new Set(
    [
      ...section_ids_raw.map((x) => Number(x)),
      ...(section_id ? [section_id] : []),
    ].filter((x) => Number.isInteger(x) && x > 0)
  ));
  const due_at_raw = (req.body && req.body.due_at) ? String(req.body.due_at) : null; // UI sends ISO
  const due_at = (() => {
    if (!due_at_raw) return null;
    // MariaDB DATETIME expects 'YYYY-MM-DD HH:MM:SS'
    const d = new Date(due_at_raw);
    if (isNaN(d.getTime())) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  })();
  const priority = (req.body && req.body.priority != null) ? Number(req.body.priority) : null;
  const labels = (req.body && req.body.labels) ? req.body.labels : [];

  if (!title) return res.status(400).json({ ok: false });

  let conn;
  try {
    conn = await pool.getConnection();
    const supportsSectionIdsJson = await hasSectionIdsJsonColumn(conn);
    let sectionRows = [];
    // validate sections belong to project (if provided)
    if (section_ids.length > 0) {
      sectionRows = await conn.query(`SELECT id, project_id, name FROM kb_sections WHERE archived=0 AND id IN (${section_ids.map(() => '?').join(',')})`, section_ids);
      const validIds = new Set((sectionRows || []).filter((r) => Number(r.project_id) === Number(project_id)).map((r) => Number(r.id)));
      if (validIds.size !== section_ids.length) {
        return res.status(400).json({ ok: false, error: 'section_project_mismatch' });
      }
    }

    const labels_json = JSON.stringify(Array.isArray(labels) ? labels : []);
    const primarySectionId = section_ids.length > 0 ? section_ids[0] : null;
    if (supportsSectionIdsJson) {
      await conn.query(
        'UPDATE kb_cards SET title=?, notes=?, project_id=?, section_id=?, section_ids_json=?, due_at=?, priority=?, labels_json=? WHERE id=?',
        [title, notes, project_id, primarySectionId, JSON.stringify(section_ids), due_at, priority, labels_json, id]
      );
    } else {
      const namesById = new Map((sectionRows || []).map((r) => [Number(r.id), String(r.name || '')]));
      const sectionNameList = section_ids.map((sid) => namesById.get(Number(sid))).filter(Boolean);
      const sectionNameSerialized = sectionNameList.length > 0 ? sectionNameList.join(' || ') : null;
      await conn.query(
        'UPDATE kb_cards SET title=?, notes=?, project_id=?, section_id=?, section_name=?, due_at=?, priority=?, labels_json=? WHERE id=?',
        [title, notes, project_id, primarySectionId, sectionNameSerialized, due_at, priority, labels_json, id]
      );
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('kanban/card/update error', e);
    res.status(500).json({ ok: false, error: 'server_error' });
  } finally {
    if (conn) conn.release();
  }
});

app.delete('/api/kanban/card', requireAuth, async (req, res) => {
  const id = Number((req.query && req.query.id) || 0);
  if (!id) return res.status(400).json({ ok: false });
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query('DELETE FROM kb_cards WHERE id=?', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false });
  } finally {
    if (conn) conn.release();
  }
});

app.get('/api/kanban/sections', requireAuth, async (req, res) => {
  const project_id = Number((req.query && req.query.project_id) || 0);
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = project_id
      ? await conn.query('SELECT id, project_id, name, color, icon, sort FROM kb_sections WHERE archived=0 AND project_id=? ORDER BY sort ASC, id ASC', [project_id])
      : await conn.query('SELECT id, project_id, name, color, icon, sort FROM kb_sections WHERE archived=0 ORDER BY project_id ASC, sort ASC, id ASC');
    res.json({ ok: true, sections: rows.map(r => ({ id: Number(r.id), project_id: Number(r.project_id), name: r.name, color: r.color, icon: r.icon, sort: r.sort })) });
  } catch {
    res.status(500).json({ ok: false });
  } finally {
    if (conn) conn.release();
  }
});

app.post('/api/kanban/sections', requireAuth, async (req, res) => {
  const project_id = Number((req.body && req.body.project_id) || 0);
  const name = String((req.body && req.body.name) || '').trim();
  const color = String((req.body && req.body.color) || '#64748b');
  const icon = String((req.body && req.body.icon) || 'Tag');
  if (!project_id || !name) return res.status(400).json({ ok: false });
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query('INSERT INTO kb_sections (project_id, name, color, icon, sort) VALUES (?,?,?,?,9999)', [project_id, name, color, icon]);
    res.json({ ok: true });
  } catch (e) {
    if (e && e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ ok: false, error: 'duplicate_section_name' });
    }
    console.error('kanban/sections create error', e);
    res.status(500).json({ ok: false, error: 'server_error' });
  } finally {
    if (conn) conn.release();
  }
});

app.post('/api/kanban/sections/update', requireAuth, async (req, res) => {
  const id = Number((req.body && req.body.id) || 0);
  const name = String((req.body && req.body.name) || '').trim();
  const color = String((req.body && req.body.color) || '#64748b');
  const icon = String((req.body && req.body.icon) || 'Tag');
  if (!id || !name) return res.status(400).json({ ok: false });
  let conn;
  try {
    conn = await pool.getConnection();
    const result = await conn.query('UPDATE kb_sections SET name=?, color=?, icon=? WHERE id=? AND archived=0', [name, color, icon, id]);
    if (!result || !result.affectedRows) return res.status(404).json({ ok: false, error: 'section_not_found' });
    res.json({ ok: true });
  } catch (e) {
    if (e && e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ ok: false, error: 'duplicate_section_name' });
    }
    console.error('kanban/sections update error', e);
    res.status(500).json({ ok: false, error: 'server_error' });
  } finally {
    if (conn) conn.release();
  }
});

app.post('/api/kanban/sections/delete', requireAuth, async (req, res) => {
  const id = Number((req.body && req.body.id) || 0);
  if (!id) return res.status(400).json({ ok: false });
  let conn;
  try {
    conn = await pool.getConnection();
    const supportsSectionIdsJson = await hasSectionIdsJsonColumn(conn);
    await conn.query('UPDATE kb_sections SET archived=1 WHERE id=?', [id]);
    await conn.query('UPDATE kb_cards SET section_id=NULL WHERE section_id=?', [id]);
    if (supportsSectionIdsJson) {
      const cardsWithSections = await conn.query('SELECT id, section_ids_json FROM kb_cards WHERE section_ids_json IS NOT NULL AND section_ids_json <> \'\'');
      for (const card of cardsWithSections) {
        let arr = [];
        try {
          arr = Array.isArray(card.section_ids_json) ? card.section_ids_json : JSON.parse(card.section_ids_json || '[]');
        } catch {
          arr = [];
        }
        const next = (Array.isArray(arr) ? arr : [])
          .map((x) => Number(x))
          .filter((x) => Number.isInteger(x) && x > 0 && x !== id);
        await conn.query('UPDATE kb_cards SET section_ids_json=? WHERE id=?', [JSON.stringify(next), Number(card.id)]);
      }
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  } finally {
    if (conn) conn.release();
  }
});

app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ ok: false, error: 'file_too_large', maxMb: MAX_FILE_MB });
  }
  next(err);
});

app.listen(PORT, '0.0.0.0', () => console.log('Feego Admin listening on', PORT));
