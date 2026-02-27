import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'

function cls(...a){ return a.filter(Boolean).join(' ') }

function NewQuoteForm({ onCreated, onClose }) {
  const [customer, setCustomer] = React.useState('')
  const [date, setDate] = React.useState(new Date().toISOString().slice(0,10))
  const [notes, setNotes] = React.useState('')
  const [items, setItems] = React.useState([{ name: '', qty: 1, unitPrice: 0, imageUrl: '' }])
  const [busy, setBusy] = React.useState(false)
  const [msg, setMsg] = React.useState('')

  async function j(url, opts){
    const r = await fetch(url, { credentials:'include', ...opts })
    const t = await r.text()
    let data={}
    try{ data=JSON.parse(t) }catch{ data={ raw:t } }
    if(!r.ok) throw Object.assign(new Error('http '+r.status), {status:r.status, data})
    return data
  }

  const total = items.reduce((acc,it)=> acc + (Number(it.qty||0)*Number(it.unitPrice||0)), 0)

  function setItem(i, patch){
    setItems(prev => prev.map((x,idx)=> idx===i? {...x, ...patch}: x))
  }

  async function create(){
    setBusy(true); setMsg('')
    try{
      const payload = {
        customer,
        date,
        notes,
        items: items.filter(x=>String(x.name||'').trim()).map(x=>({
          name: x.name,
          qty: Number(x.qty||1),
          unitPrice: Number(x.unitPrice||0),
          imageUrl: x.imageUrl,
        }))
      }
      const r = await j('/api/quotes', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)})
      setMsg('Cotización creada')
      onCreated?.(r.quote)
      // auto open pdf
      window.open(`/api/quotes/${r.quote.id}/pdf`, '_blank')
      // reset + close
      setCustomer(''); setNotes(''); setItems([{ name: '', qty: 1, unitPrice: 0, imageUrl: '' }])
      onClose?.()
    }catch(e){
      setMsg('Error creando cotización')
    }finally{
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="text-2xl leading-8 font-bold">Nueva cotización</div>
      <div className="mt-2 text-sm leading-5 text-slate-400">Crea la cotización y descarga el PDF.</div>

      {msg && <div className="mt-4 text-sm text-slate-200">{msg}</div>}

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div>
          <div className="text-sm leading-5 text-slate-400">Cotizado a</div>
          <input value={customer} onChange={e=>setCustomer(e.target.value)} className="mt-2 w-full px-4 py-2 rounded-xl bg-black/20 border border-white/10 text-white" placeholder="MOBA" />
        </div>
        <div>
          <div className="text-sm leading-5 text-slate-400">Fecha</div>
          <input value={date} onChange={e=>setDate(e.target.value)} type="date" className="mt-2 w-full px-4 py-2 rounded-xl bg-black/20 border border-white/10 text-white" />
        </div>
      </div>

      <div className="mt-4">
        <div className="text-sm leading-5 text-slate-400">Notas (opcional)</div>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} className="mt-2 w-full px-4 py-2 rounded-xl bg-black/20 border border-white/10 text-white" placeholder="Condiciones, garantía, etc." />
      </div>

      <div className="mt-4">
        <div className="font-bold">Items</div>
        <div className="mt-4 space-y-4">
          {items.map((it, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm leading-5 text-slate-400">Producto</div>
                  <input value={it.name} onChange={e=>setItem(i,{name:e.target.value})} className="mt-2 w-full px-4 py-2 rounded-xl bg-black/20 border border-white/10 text-white" />
                </div>
                <div>
                  <div className="text-sm leading-5 text-slate-400">URL imagen (opcional)</div>
                  <input value={it.imageUrl} onChange={e=>setItem(i,{imageUrl:e.target.value})} className="mt-2 w-full px-4 py-2 rounded-xl bg-black/20 border border-white/10 text-white" placeholder="https://..." />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm leading-5 text-slate-400">Cantidad</div>
                  <input value={it.qty} onChange={e=>setItem(i,{qty:e.target.value})} type="number" className="mt-2 w-full px-4 py-2 rounded-xl bg-black/20 border border-white/10 text-white" />
                </div>
                <div>
                  <div className="text-sm leading-5 text-slate-400">Valor unidad</div>
                  <input value={it.unitPrice} onChange={e=>setItem(i,{unitPrice:e.target.value})} type="number" className="mt-2 w-full px-4 py-2 rounded-xl bg-black/20 border border-white/10 text-white" />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-4">
                <div className="text-sm text-slate-400">Subtotal: {(Number(it.qty||0)*Number(it.unitPrice||0)).toLocaleString('es-CO')}</div>
                <button
                  onClick={()=> setItems(prev => prev.filter((_,idx)=>idx!==i))}
                  className="text-sm px-4 py-2 rounded-lg border border-white/10 transition-all duration-200 ease-out hover:bg-white/5"
                  disabled={items.length===1}
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-4 items-center">
          <button onClick={()=>setItems(prev=>[...prev,{name:'',qty:1,unitPrice:0,imageUrl:''}])} className="px-4 py-2 rounded-xl border border-white/10 transition-all duration-200 ease-out hover:bg-white/5 text-sm font-bold">+ Agregar item</button>
          <div className="ml-auto text-base leading-6 font-bold">TOTAL: {total.toLocaleString('es-CO')}</div>
        </div>
      </div>

      <div className="mt-6 flex gap-4 justify-end">
        <button onClick={onClose} className="px-4 py-2 rounded-xl border border-white/10 transition-all duration-200 ease-out hover:bg-white/5 text-sm font-bold">Cancelar</button>
        <button
          onClick={create}
          disabled={busy}
          className={cls('px-4 py-2 rounded-xl font-bold text-sm transition-all duration-200 ease-out', busy ? 'bg-slate-700 text-slate-300' : 'bg-indigo-500 hover:bg-indigo-400 text-white')}
        >
          {busy ? 'Generando…' : 'Crear + PDF'}
        </button>
      </div>
    </div>
  )
}

export default function QuotesPage() {
  const [list, setList] = React.useState([])
  const [open, setOpen] = React.useState(false)

  async function j(url, opts){
    const r = await fetch(url, { credentials:'include', ...opts })
    const t = await r.text()
    let data={}
    try{ data=JSON.parse(t) }catch{ data={ raw:t } }
    if(!r.ok) throw Object.assign(new Error('http '+r.status), {status:r.status, data})
    return data
  }

  async function refresh(){
    const r = await j('/api/quotes')
    setList(r.items || [])
  }

  React.useEffect(()=>{ refresh().catch(()=>{}) },[])

  return (
    <div className="px-4 md:px-6 lg:px-8 2xl:px-12 py-4 md:py-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between gap-4 md:gap-6 flex-wrap">
          <div>
            <div className="text-[32px] leading-[40px] font-bold">Cotizaciones</div>
            <div className="text-sm leading-5 text-slate-400">Lista + Nueva cotización (modal) + PDF.</div>
          </div>

          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
              <button className="px-4 py-2 rounded-xl font-bold text-sm bg-indigo-500 hover:bg-indigo-400 text-white transition-all duration-200 ease-out">
                + Nueva cotización
              </button>
            </Dialog.Trigger>

            <Dialog.Portal>
              <Dialog.Overlay className="feego-overlay fixed inset-0" />
              <Dialog.Content className="feego-modal fixed left-1/2 top-1/2 w-[95vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-2xl p-4 md:p-6 shadow-2xl">
                <NewQuoteForm
                  onCreated={async ()=>{ await refresh().catch(()=>{}); }}
                  onClose={()=>setOpen(false)}
                />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6">
          <div className="text-xl leading-8 font-bold">Cotizaciones recientes</div>
          <div className="mt-2 text-sm leading-5 text-slate-400">Descarga PDF con un clic.</div>
          <div className="mt-4 space-y-4">
            {list.map(q => (
              <div key={q.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xl leading-8 font-bold">{q.customer}</div>
                    <div className="text-sm leading-5 text-slate-400">{q.date || q.createdAt?.slice(0,10)} • {q.items?.length || 0} items</div>
                  </div>
                  <a
                    className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold transition-all duration-200 ease-out"
                    href={`/api/quotes/${q.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    PDF
                  </a>
                </div>
              </div>
            ))}
            {!list.length && <div className="text-sm leading-5 text-slate-400">Aún no hay cotizaciones.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
