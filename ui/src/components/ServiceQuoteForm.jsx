import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Code2, X, Plus, Trash2, Layers3, Flag, ClipboardList, Save } from 'lucide-react'
import { Button, Input, Textarea } from './ui'
import { newService, serviceTemplate, serviceTotals, milestoneAmounts, normalizeServiceQuote } from '../../../shared/service-quotes.mjs'
import './ServiceQuoteForm.scss'
const cash = n => Number(n).toLocaleString('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:2})
export default function ServiceQuoteForm({initialQuote,onSaved,onClose}) {
  const [service,setService]=React.useState(()=>initialQuote?.service || newService())
  const [customer,setCustomer]=React.useState(initialQuote?.customer || '')
  const [date,setDate]=React.useState(initialQuote?.date || new Date().toLocaleDateString('en-CA'))
  const [notes,setNotes]=React.useState(initialQuote?.notes || '')
  const [busy,setBusy]=React.useState(false), [error,setError]=React.useState('')
  const [template,setTemplate]=React.useState('')
  const [confirmTemplate,setConfirmTemplate]=React.useState(false)
  const totals=serviceTotals(service), payments=milestoneAmounts(service)
  const globalPricing = service.pricingMode === 'global'
  const percent=service.milestones.reduce((sum,m)=>sum+Number(m.percent||0),0)
  const patch=(key,value)=>setService(s=>({...s,[key]:value}))
  const modulePatch=(index,key,value)=>setService(s=>({...s,modules:s.modules.map((m,i)=>i===index?{...m,[key]:value}:m)}))
  function changePricing(pricingMode) {
    setService(s=>{const current=serviceTotals(s);return {...s,pricingMode,...(pricingMode==='global'?{globalInitial:s.globalInitial ?? current.initial,globalMonthly:s.globalMonthly ?? current.monthly}:{})}})
  }
  async function save(e) {
    e.preventDefault();if(busy)return
    setError('')
    try {
      if(!customer.trim())throw Error('Indica el cliente de la propuesta.')
      const normalized=normalizeServiceQuote({type:'services',service})
      setBusy(true)
      const r=await fetch(initialQuote?.id?`/api/quotes/${initialQuote.id}`:'/api/quotes',{method:initialQuote?.id?'PUT':'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({...normalized,customer,date,notes,totalize:true,items:[]})})
      const data=await r.json()
      if(!r.ok)throw Error(data.message || 'No se pudo guardar la cotización.')
      onSaved?.(data.quote);onClose?.()
    } catch(e){setError(e.message || 'No se pudo conectar con el servidor.')} finally{setBusy(false)}
  }
  return <form className="service-quote-form" onSubmit={save}>
    <div className="quote-form-heading"><span className="quote-document-icon"><Code2 size={23}/></span><div><Dialog.Title>{initialQuote?'Editar propuesta de software':'Cotización de servicios de software'}</Dialog.Title><Dialog.Description>Alcance, entregables e inversión del proyecto.</Dialog.Description></div><Button type="button" variant="ghost" disabled={busy} onClick={onClose} aria-label="Cerrar cotización"><X size={20}/></Button></div>
    <fieldset disabled={busy}>
      <div className="service-template"><label>Plantilla<select value={template} onChange={e=>{setTemplate(e.target.value);setConfirmTemplate(false)}}><option value="">Seleccionar plantilla</option><option value="web">Sitio web</option><option value="app">Aplicación web</option><option value="integration">Integración</option><option value="maintenance">Mantenimiento</option></select></label><Button type="button" variant="outline" disabled={!template} onClick={()=>setConfirmTemplate(true)}>Usar plantilla</Button></div>
      {confirmTemplate && <div className="service-template-confirm">Reemplazará el alcance, los módulos y los hitos actuales.<Button type="button" variant="outline" onClick={()=>setConfirmTemplate(false)}>Cancelar</Button><Button type="button" onClick={()=>{setService(serviceTemplate(template));setConfirmTemplate(false)}}>Aplicar plantilla</Button></div>}
      <div className="service-grid"><label>Cliente<Input value={customer} onChange={e=>setCustomer(e.target.value)} required maxLength={240}/></label><label>Fecha<Input type="date" value={date} onChange={e=>setDate(e.target.value)} required/></label></div>
      <label>Nombre del proyecto<Input value={service.title} onChange={e=>patch('title',e.target.value)} required maxLength={240}/></label>
      <label>Objetivo<Textarea value={service.objective} onChange={e=>patch('objective',e.target.value)} required rows={2} maxLength={10000}/></label>
      <section className="service-pricing-choice"><h3><Flag size={18}/>Precio de la propuesta</h3>
        <div className="quote-type-picker" role="group" aria-label="Precio de la propuesta">
          <button type="button" aria-pressed={!globalPricing} onClick={()=>changePricing('modules')}><Layers3 size={17}/>Precio por módulo</button>
          <button type="button" aria-pressed={globalPricing} onClick={()=>changePricing('global')}><Flag size={17}/>Precio global</button>
        </div>
        {globalPricing && <div className="service-grid"><label>Inversión total del proyecto · COP<Input type="number" min="0" max="1000000000000" step="0.01" required value={service.globalInitial ?? ''} onChange={e=>patch('globalInitial',e.target.value)}/></label><label>Mensualidad opcional · COP<Input type="number" min="0" max="1000000000000" step="0.01" value={service.globalMonthly ?? 0} onChange={e=>patch('globalMonthly',e.target.value === '' ? 0 : e.target.value)}/></label></div>}
      </section>
      <section><h3><Layers3 size={18}/>Módulos y servicios <span>{globalPricing?'Entregables y plazos':'Valores en COP'}</span></h3>{service.modules.map((m,i)=><div className="service-module" key={i}>
        <div className="service-module-heading"><strong>Módulo {i+1}</strong><Button type="button" variant="ghost" disabled={service.modules.length===1} aria-label={`Quitar módulo ${i+1}`} onClick={()=>patch('modules',service.modules.filter((_,j)=>j!==i))}><Trash2 size={16}/></Button></div>
        <label>Nombre<Input value={m.name} required maxLength={240} onChange={e=>modulePatch(i,'name',e.target.value)}/></label>
        <label>Entregables · uno por línea<Textarea value={m.deliverables} rows={3} maxLength={10000} onChange={e=>modulePatch(i,'deliverables',e.target.value)}/></label>
        <div className="service-grid">{!globalPricing && <label>Modalidad<select value={m.billing} onChange={e=>modulePatch(i,'billing',e.target.value)}><option value="fixed">Precio fijo</option><option value="hourly">Por horas</option><option value="monthly">Mensual</option></select></label>}<label>Plazo estimado<Input value={m.deadline} maxLength={500} placeholder="Ej. 2 semanas" onChange={e=>modulePatch(i,'deadline',e.target.value)}/></label></div>
        {!globalPricing && <div className="service-module-pricing">{m.billing==='hourly' && <label>Horas estimadas<Input type="number" min="0.01" max="100000" step="0.01" required value={m.qty} onChange={e=>modulePatch(i,'qty',e.target.value)}/></label>}<label>{m.billing==='hourly'?'Tarifa por hora':m.billing==='monthly'?'Valor mensual':'Valor del módulo'}<Input type="number" min="0" max="1000000000000" step="0.01" required value={m.unitPrice} onChange={e=>modulePatch(i,'unitPrice',e.target.value)}/></label><strong>{cash(Number(m.unitPrice||0)*(m.billing==='hourly'?Number(m.qty||0):1))}{m.billing==='monthly'?' / mes':''}</strong></div>}
      </div>)}<Button type="button" variant="outline" disabled={service.modules.length>=50} onClick={()=>patch('modules',[...service.modules,{name:'',deliverables:'',deadline:'',billing:'fixed',qty:1,unitPrice:0}])}><Plus size={16}/>Agregar módulo</Button></section>
      <section><h3><ClipboardList size={18}/>Alcance y condiciones</h3><div className="service-grid">{[['includes','Incluye'],['excludes','No incluye'],['responsibilities','Responsabilidades del cliente'],['timeline','Plazo general'],['startCondition','Inicio del plazo'],['support','Soporte posterior'],['changePolicy','Cambios de alcance'],['recurringTerms','Condiciones de la mensualidad']].map(([key,label])=><label key={key}>{label}<Textarea rows={3} maxLength={10000} value={service[key]} onChange={e=>patch(key,e.target.value)}/></label>)}</div></section>
      <section><h3><Flag size={18}/>Pagos por hitos <span>Sobre la inversión inicial</span></h3>{service.milestones.map((m,i)=><div className="service-milestone" key={i}><label>Hito {i+1}<Input value={m.name} maxLength={240} required onChange={e=>patch('milestones',service.milestones.map((x,j)=>i===j?{...x,name:e.target.value}:x))}/></label><label>Porcentaje<Input type="number" min="0.01" max="100" step="0.01" required value={m.percent} onChange={e=>patch('milestones',service.milestones.map((x,j)=>i===j?{...x,percent:e.target.value}:x))}/></label><strong>{Math.abs(percent-100)<0.00001?cash(payments[i].amount):'—'}</strong><Button type="button" variant="ghost" aria-label={`Quitar hito ${i+1}`} onClick={()=>patch('milestones',service.milestones.filter((_,j)=>i!==j))}><Trash2 size={16}/></Button></div>)}<div className="service-hito-footer"><Button type="button" variant="outline" disabled={service.milestones.length>=20} onClick={()=>patch('milestones',[...service.milestones,{name:'',percent:0}])}><Plus size={16}/>Agregar hito</Button><span className={Math.abs(percent-100)<0.00001?'':'service-warning'}>{percent.toLocaleString('es-CO')}% de 100%{!service.milestones.length && !totals.initial?' · Sin pago inicial':''}</span></div></section>
      <label>Notas adicionales<Textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)} maxLength={10000}/></label>
      <div className="service-totals"><div><span>Inversión inicial</span><strong>{cash(totals.initial)}</strong></div><div><span>Recurrente mensual</span><strong>{cash(totals.monthly)}<small> / mes</small></strong></div></div>
    </fieldset>
    {error && <p role="alert" className="service-error">{error}</p>}
    <div className="quote-form-footer"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={busy}><Save size={16}/>{busy?'Guardando…':'Guardar propuesta'}</Button></div>
  </form>
}
