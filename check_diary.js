require('dotenv').config({path:'/opt/feego-admin/.env'});
const utc=new Date('2026-04-25T04:30:00Z');
const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(utc);
const get=(t)=>parts.find(p=>p.type===t)?.value;
const day=`${get('year')}-${get('month')}-${get('day')}`;
const mysql=require('mysql2/promise');
(async()=>{
  const conn=await mysql.createConnection({
    host:process.env.DB_HOST||'127.0.0.1',
    port:Number(process.env.DB_PORT||3306),
    user:process.env.DB_USER,
    password:process.env.DB_PASS,
    database:process.env.DB_NAME
  });
  const [rows]=await conn.execute('SELECT id, day, summary_md FROM infra_diary_daily WHERE day = ? LIMIT 1',[day]);
  await conn.end();
  const hasSummary=rows.length>0 && rows[0].summary_md && String(rows[0].summary_md).trim().length>0;
  console.log(JSON.stringify({day,exists:rows.length>0,hasSummary}));
})().catch(e=>{console.error('ERR:'+e.message);process.exit(1);});
