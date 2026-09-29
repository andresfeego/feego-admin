import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {buildQuote,seedQuote,QUOTE_ID} from '../scripts/seed_gustavo_espejo_quote.mjs'
import {serviceTotals,milestoneAmounts} from '../shared/service-quotes.mjs'
test('Gustavo proposal has the agreed commercial terms',()=>{
 const q=buildQuote();assert.equal(q.customer,'Gustavo Espejo');assert.equal(q.notes,'');assert.equal(q.validityDays,15);assert.equal(q.service.timeline,'30 días.');assert.equal(q.service.recurringTerms,'No aplica.');assert.equal(q.service.pricingMode,'global');assert.deepEqual(serviceTotals(q.service),{initial:5000000,monthly:0});assert.deepEqual(milestoneAmounts(q.service).map(x=>x.amount),[1500000,1500000,2000000]);assert.equal(q.service.modules.length,11)
})
test('seed inserts once, preserves existing and edited records, and backs up',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'feego-seed-'))
 try {
  const file=path.join(dir,'quotes.json'),existing={id:'other',customer:'Keep me'};await fs.writeFile(file,JSON.stringify([existing]));assert.equal((await seedQuote(dir)).created,true)
  const list=JSON.parse(await fs.readFile(file));assert.equal(list.length,2);assert.deepEqual(list[1],existing);list[0].notes='User edit';await fs.writeFile(file,JSON.stringify(list));assert.equal((await seedQuote(dir)).created,false)
  const next=JSON.parse(await fs.readFile(file));assert.equal(next.find(q=>q.id===QUOTE_ID).notes,'User edit');assert.equal(next.length,2);assert.equal((await fs.readdir(dir)).filter(x=>x.startsWith('quotes.before-')).length,1)
 }finally{await fs.rm(dir,{recursive:true,force:true})}
})
test('invalid quote store is never replaced',async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'feego-seed-invalid-'));try{const file=path.join(dir,'quotes.json');await fs.writeFile(file,'broken');await assert.rejects(seedQuote(dir));assert.equal(await fs.readFile(file,'utf8'),'broken')}finally{await fs.rm(dir,{recursive:true,force:true})}})
