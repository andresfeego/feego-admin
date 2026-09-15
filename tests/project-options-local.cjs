require('dotenv').config({quiet:true});
const assert=require('node:assert/strict');
(async()=>{
 const config=require('../knexfile.cjs').connection;assert.equal(config.host,'127.0.0.1');assert.equal(config.port,3308);
 if(!process.env.FEEGO_TEST_PASSWORD)throw Error('Set local test password');
 const c=await require('mysql2/promise').createConnection(config);let cookie;const fixtures=[];let original=[];
 async function req(url,body,method=body?'POST':'GET') {const r=await fetch('http://127.0.0.1:3030'+url,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')}}
 try {
 const login=await req('/api/login',{username:'FeegoAdmin',password:process.env.FEEGO_TEST_PASSWORD});assert.equal(login.status,200);cookie=login.cookie.split(';')[0];
 [original]=await c.query('SELECT id,sort FROM kb_projects WHERE archived=0 ORDER BY sort,id');
 for(let i=0;i<2;i++){const name=`__project_options_${Date.now()}_${i}`;assert.equal((await req('/api/kanban/project',{name})).status,200);const [[row]]=await c.query('SELECT id,name FROM kb_projects WHERE name=?',[name]);fixtures.push(row)}
 const p=fixtures[0];const payload={id:p.id,name:p.name,description:'Local test'};
 for(const priority of [1,2,3,null]) {assert.equal((await req('/api/kanban/project/update',{...payload,priority})).status,200);const state=await req('/api/kanban/state');assert.equal(state.data.projects.find(x=>x.id===p.id).priority,priority)}
 assert.equal((await req('/api/kanban/project/update',{...payload,priority:7})).status,400);
 await req('/api/kanban/project/update',{...payload,priority:1});await req('/api/kanban/project/update',payload);const [[row]]=await c.query('SELECT priority FROM kb_projects WHERE id=?',[p.id]);assert.equal(row.priority,1);
 const ids=[...original.map(x=>x.id),fixtures[1].id,fixtures[0].id];assert.equal((await req('/api/kanban/projects/reorder',{ordered_ids:ids})).status,200);
 assert.deepEqual((await req('/api/kanban/state')).data.projects.map(p=>p.id),ids);
 assert.equal((await req('/api/kanban/projects/reorder',{ordered_ids:[...ids,ids[0]]})).status,400);
 assert.equal((await req('/api/kanban/projects/reorder',{ordered_ids:ids.slice(1)})).status,409);
 assert.deepEqual((await req('/api/kanban/state')).data.projects.map(p=>p.id),ids);
 console.log('PASS: persisted project order; duplicate/stale lists rejected; priorities 1/2/3/null; omitted priority preserved.');
 } finally {for(const p of fixtures)await c.query('DELETE FROM kb_projects WHERE id=? AND name=?',[p.id,p.name]);for(let i=0;i<original.length;i++)await c.query('UPDATE kb_projects SET sort=? WHERE id=? AND sort=?',[original[i].sort,original[i].id,i]);await c.end()}
})().catch(e=>{console.error(e);process.exitCode=1});
