import test from 'node:test'
import assert from 'node:assert/strict'
import {serviceTemplate, normalizeServiceQuote, serviceTotals, milestoneAmounts} from '../shared/service-quotes.mjs'
const proposal = () => ({type:'services',service:serviceTemplate('app')})
test('separates fixed/hourly investment from recurring fees',()=>{
 const q=proposal();q.service.modules=[{name:'Fixed',billing:'fixed',unitPrice:1200000},{name:'Hours',billing:'hourly',qty:40,unitPrice:100000},{name:'Monthly',billing:'monthly',unitPrice:300000}]
 assert.deepEqual(serviceTotals(normalizeServiceQuote(q).service),{initial:5200000,monthly:300000})
})
test('requires payment percentages to total 100',()=>{const q=proposal();q.service.milestones[0].percent=30;assert.throws(()=>normalizeServiceQuote(q),/100%/)})
test('allocates rounding remainder without losing cents',()=>{const q=proposal();q.service.modules[0].unitPrice=0.07;const s=normalizeServiceQuote(q).service;assert.equal(Math.round(milestoneAmounts(s).reduce((n,m)=>n+m.amount,0)*100),7)})
test('monthly-only service needs no initial payment milestones',()=>{const q={type:'services',service:serviceTemplate('maintenance')};q.service.modules[0].unitPrice=300000;assert.equal(normalizeServiceQuote(q).service.milestones.length,0)})
test('rejects negative, empty and invalid prices and zero hours',()=>{for(const price of [-1,'',null,'invalid',Infinity]){const q=proposal();q.service.modules[0].unitPrice=price;assert.throws(()=>normalizeServiceQuote(q))}const q=proposal();Object.assign(q.service.modules[0],{billing:'hourly',qty:0});assert.throws(()=>normalizeServiceQuote(q))})
test('legacy quotes remain products',()=>assert.deepEqual(normalizeServiceQuote({}),{type:'products',service:null}))
test('global totals ignore module prices and drive payment milestones',()=>{
 const q=proposal();Object.assign(q.service,{pricingMode:'global',globalInitial:5000000,globalMonthly:250000});q.service.modules[0].unitPrice=999999;
 const s=normalizeServiceQuote(q).service;
 assert.deepEqual(serviceTotals(s),{initial:5000000,monthly:250000});assert.equal(milestoneAmounts(s)[0].amount,2000000)
 assert.equal(s.modules[0].unitPrice,999999)
 assert.equal(serviceTotals({...s,pricingMode:'modules'}).initial,999999)
})
test('global modules require no price or billing fields',()=>{const q=proposal();Object.assign(q.service,{pricingMode:'global',globalInitial:100,modules:[{name:'Development',deliverables:'Portal',deadline:'2 weeks'}]});const s=normalizeServiceQuote(q).service;assert.deepEqual(serviceTotals(s),{initial:100,monthly:0});assert.equal(s.modules[0].name,'Development')})
test('global prices and pricing mode are validated',()=>{for(const value of ['',null,-1,Infinity,'invalid',true,1e13]){const q=proposal();Object.assign(q.service,{pricingMode:'global',globalInitial:value});assert.throws(()=>normalizeServiceQuote(q))}const q=proposal();q.service.pricingMode='other';assert.throws(()=>normalizeServiceQuote(q))})
test('older services default to module pricing',()=>{const q=proposal();q.service.modules[0].unitPrice=123;assert.equal(normalizeServiceQuote(q).service.pricingMode,'modules');assert.equal(serviceTotals(q.service).initial,123)})
