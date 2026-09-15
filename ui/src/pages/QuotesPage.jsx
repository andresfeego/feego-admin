import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Eye, FileText, Link2, Pencil, Plus, Share2, X, Settings, Search, RefreshCw, Download, CalendarDays, Package, Users, ArrowUpDown } from 'lucide-react'

import QuoteSettingsDialog from '../components/QuoteSettingsDialog.jsx'
import { Button, Input } from '../components/ui'
import './QuotesPage.scss'

function cls(...a){ return a.filter(Boolean).join(' ') }

function makeEmptyItem() {
  return {
    name: '',
    qty: 1,
    unitPrice: 0,
    imageUrls: [],
    imageUrlDraft: '',
    showUrlInput: false,
    isDragOver: false,
    uploading: false,
  }
}

function normalizeImageUrl(raw) {
  const v = String(raw || '').trim()
  if (!v) return ''
  if (v.startsWith('data:image/')) return v
  if (v.startsWith('//')) return `https:${v}`
  if (v.startsWith('https://www.google.com/imgres?') || v.startsWith('http://www.google.com/imgres?')) {
    try {
      const u = new URL(v)
      const imgurl = u.searchParams.get('imgurl') || u.searchParams.get('imgrefurl')
      if (imgurl) return normalizeImageUrl(imgurl)
    } catch {}
  }
  if (v.startsWith('http://') || v.startsWith('https://')) return v
  if (v.startsWith('/api/uploads/view?') || v.startsWith('/content/uploads/')) return v
  if (v.startsWith('/')) {
    const firstChunk = v.slice(1).split('/')[0] || ''
    // Some drag sources provide '/domain.com/path' without protocol.
    if (firstChunk.includes('.')) return `https://${v.slice(1)}`
    return ''
  }
  return ''
}

function looksLikeImageUrl(url) {
  const u = String(url || '').trim().toLowerCase()
  if (!u) return false
  if (u.startsWith('data:image/')) return true
  if (u.startsWith('/api/uploads/view?') || u.startsWith('/content/uploads/')) return true
  if (/\.(png|jpe?g|webp|gif|bmp|svg|heic|heif|avif|tif|tiff)(\?|$)/i.test(u)) return true
  // CDN/image transforms often omit extension in final segment but include image hints in query/path.
  if (u.includes('is/image/') || u.includes('image') || u.includes('$q') || u.includes('format=')) return true
  return false
}

function mergeImageUrls(current, incoming) {
  const out = []
  const seen = new Set()
  for (const u of [...current, ...incoming]) {
    const n = normalizeImageUrl(u)
    if (!n || seen.has(n)) continue
    seen.add(n)
    out.push(n)
    if (out.length >= 10) break
  }
  return out
}

function extractDroppedUrls(dataTransfer) {
  const candidates = []

  const pushCandidate = (raw, source) => {
    const normalized = normalizeImageUrl(raw)
    if (!normalized) return
    candidates.push({ url: normalized, source, isImageLike: looksLikeImageUrl(normalized) })
  }

  const uriList = String(dataTransfer.getData('text/uri-list') || '')
  if (uriList) {
    for (const line of uriList.split('\n')) {
      const v = line.trim()
      if (!v || v.startsWith('#')) continue
      pushCandidate(v, 'uri-list')
    }
  }

  const plain = String(dataTransfer.getData('text/plain') || '').trim()
  if (plain) pushCandidate(plain, 'text-plain')

  const html = String(dataTransfer.getData('text/html') || '')
  if (html) {
    const imgMatches = Array.from(html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi))
    for (const m of imgMatches) {
      if (m && m[1]) pushCandidate(m[1], 'html-img')
    }
    const aMatches = Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi))
    for (const a of aMatches) {
      if (a && a[1]) pushCandidate(a[1], 'html-a')
    }
  }

  const unique = []
  const seen = new Set()
  // Priority: explicit image URLs from HTML, then any image-like URL, then generic links.
  const ordered = [
    ...candidates.filter((c) => c.source === 'html-img'),
    ...candidates.filter((c) => c.source !== 'html-img' && c.isImageLike),
    ...candidates.filter((c) => !c.isImageLike),
  ]
  for (const c of ordered) {
    if (seen.has(c.url)) continue
    seen.add(c.url)
    unique.push(c.url)
  }
  return unique
}

function collectDropDebug(dataTransfer) {
  const types = Array.from(dataTransfer?.types || [])
  const files = Array.from(dataTransfer?.files || []).map((f) => ({
    name: String(f.name || ''),
    type: String(f.type || ''),
    size: Number(f.size || 0),
    lastModified: Number(f.lastModified || 0),
  }))
  const items = Array.from(dataTransfer?.items || []).map((it, idx) => ({
    index: idx,
    kind: String(it?.kind || ''),
    type: String(it?.type || ''),
  }))
  const textPlain = String(dataTransfer?.getData?.('text/plain') || '')
  const textUriList = String(dataTransfer?.getData?.('text/uri-list') || '')
  const textHtml = String(dataTransfer?.getData?.('text/html') || '')

  return {
    types,
    files,
    items,
    textPlain,
    textUriList,
    textHtmlPreview: textHtml.slice(0, 1200),
  }
}

function canRenderImageUrl(url, timeoutMs = 3500) {
  return new Promise((resolve) => {
    const v = String(url || '').trim()
    if (!v) return resolve(false)
    const img = new Image()
    let done = false
    const finish = (ok) => {
      if (done) return
      done = true
      try {
        img.onload = null
        img.onerror = null
      } catch {}
      resolve(Boolean(ok))
    }
    const to = setTimeout(() => finish(false), timeoutMs)
    img.onload = () => { clearTimeout(to); finish(true) }
    img.onerror = () => { clearTimeout(to); finish(false) }
    img.src = v
  })
}

function mapQuoteItemsToForm(items) {
  const src = Array.isArray(items) ? items : []
  if (!src.length) return [makeEmptyItem()]
  return src.map((it) => ({
    ...makeEmptyItem(),
    name: String(it?.name || ''),
    qty: Number(it?.qty || 1),
    unitPrice: Number(it?.unitPrice || 0),
    imageUrls: Array.isArray(it?.imageUrls)
      ? it.imageUrls
      : (it?.imageUrl ? [String(it.imageUrl)] : []),
  }))
}

function NewQuoteForm({ onSaved, onClose, initialQuote = null }) {
  const isEdit = Boolean(initialQuote && initialQuote.id)
  const [customer, setCustomer] = React.useState('')
  const [date, setDate] = React.useState(new Date().toISOString().slice(0,10))
  const [notes, setNotes] = React.useState('')
  const [totalize, setTotalize] = React.useState(true)
  const [items, setItems] = React.useState([makeEmptyItem()])
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

  React.useEffect(() => {
    if (!isEdit) {
      setCustomer('')
      setDate(new Date().toISOString().slice(0,10))
      setNotes('')
      setTotalize(true)
      setItems([makeEmptyItem()])
      return
    }
    setCustomer(String(initialQuote?.customer || ''))
    setDate(String(initialQuote?.date || new Date().toISOString().slice(0,10)))
    setNotes(String(initialQuote?.notes || ''))
    setTotalize(initialQuote?.totalize !== false)
    setItems(mapQuoteItemsToForm(initialQuote?.items))
  }, [initialQuote?.id, isEdit])

  function setItem(i, patch){
    setItems(prev => prev.map((x,idx)=> idx===i? {...x, ...patch}: x))
  }

  function addImageUrlToItem(i, rawUrl) {
    const url = normalizeImageUrl(rawUrl)
    if (!url) return
    setItems((prev) => prev.map((x, idx) => {
      if (idx !== i) return x
      return {
        ...x,
        imageUrls: mergeImageUrls(x.imageUrls || [], [url]),
        imageUrlDraft: '',
        showUrlInput: false,
      }
    }))
  }

  function removeImageFromItem(i, imageUrl) {
    setItems((prev) => prev.map((x, idx) => {
      if (idx !== i) return x
      return { ...x, imageUrls: (x.imageUrls || []).filter((u) => u !== imageUrl) }
    }))
  }

  async function uploadImageFile(file) {
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetch('/api/uploads', { method: 'POST', credentials: 'include', body: fd })
    const t = await r.text()
    let data = {}
    try { data = JSON.parse(t) } catch { data = {} }
    if (!r.ok || !data?.file?.name) {
      throw new Error(`upload_failed_${r.status || 0}_${data?.error || 'unknown'}`)
    }
    return `/api/uploads/view?name=${encodeURIComponent(data.file.name)}`
  }

  async function materializeImageUrl(url, indexHint = 0) {
    const v = String(url || '')
    if (!v.startsWith('data:image/')) return v
    const m = v.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/)
    const mime = m ? m[1] : 'image/png'
    const ext = mime.split('/')[1] || 'png'
    const file = await fetch(v)
      .then((r) => r.blob())
      .then((b) => new File([b], `drop_${Date.now()}_${indexHint}.${ext}`, { type: mime }))
    return uploadImageFile(file)
  }

  async function uploadImageFromUrl(url) {
    const r = await fetch('/api/uploads/from-url', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    const t = await r.text()
    let data = {}
    try { data = JSON.parse(t) } catch { data = {} }
    if (!r.ok || !data?.file?.name) {
      throw new Error(`upload_url_failed_${r.status || 0}_${data?.error || 'unknown'}`)
    }
    return `/api/uploads/view?name=${encodeURIComponent(data.file.name)}`
  }

  async function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result || ''))
      fr.onerror = () => reject(new Error('read_failed'))
      fr.readAsDataURL(file)
    })
  }

  async function onDropImages(i, e) {
    e.preventDefault()
    e.stopPropagation()
    setItem(i, { isDragOver: false, uploading: true })

    try {
      const dropDebug = collectDropDebug(e.dataTransfer)
      const debugEnabled = (() => {
        try {
          return window.location.search.includes('dropdebug=1') || localStorage.getItem('feegoDropDebug') === '1'
        } catch {
          return false
        }
      })()
      try {
        window.__feegoLastDropDebug = dropDebug
      } catch {}
      console.groupCollapsed('[QuotesDropDebug] dataTransfer snapshot')
      console.log(dropDebug)
      console.groupEnd()
      if (debugEnabled) {
        setMsg('Drop debug capturado. Revisa consola y window.__feegoLastDropDebug')
      }

      const droppedUrls = extractDroppedUrls(e.dataTransfer)
      const fileUrls = []
      const rawFiles = Array.from(e.dataTransfer?.files || [])
      const itemFiles = Array.from(e.dataTransfer?.items || [])
        .filter((it) => it && it.kind === 'file')
        .map((it) => it.getAsFile())
        .filter(Boolean)
      const files = [...rawFiles, ...itemFiles]
      const uniqueImageFiles = []
      const seenFileSig = new Set()

      for (const f of files) {
        const isImageByType = String(f.type || '').startsWith('image/')
        const isImageByName = /\.(png|jpe?g|webp|gif|bmp|svg|heic|heif|avif|tif|tiff)$/i.test(String(f.name || ''))
        if (!isImageByType && !isImageByName) continue
        const sig = `${f.name}::${f.size}::${f.lastModified}`
        if (seenFileSig.has(sig)) continue
        seenFileSig.add(sig)
        uniqueImageFiles.push(f)
      }

      let uploadFailures = 0
      for (const f of uniqueImageFiles) {
        try {
          const uploadedUrl = await uploadImageFile(f)
          fileUrls.push(uploadedUrl)
        } catch (_err) {
          uploadFailures += 1
          // fallback for local drags if upload endpoint fails in current env
          try {
            const dataUrl = await fileToDataUrl(f)
            if (dataUrl.startsWith('data:image/')) fileUrls.push(dataUrl)
          } catch {}
        }
      }

      // If browser provides local files, use those only.
      // Dragging from web pages often includes an extra URL that can be broken/hotlink-blocked.
      let next = fileUrls.length > 0 ? fileUrls : []
      if (next.length === 0 && droppedUrls.length > 0) {
        let chosenUrl = ''
        for (const cand of droppedUrls.slice(0, 6)) {
          // Google results often include both page URL and image URL: pick the first that truly renders.
          const ok = await canRenderImageUrl(cand)
          if (ok) {
            chosenUrl = cand
            break
          }
        }
        if (!chosenUrl) chosenUrl = droppedUrls[0]

        // Prefer storing remote image locally to avoid hotlink/403 issues in previews.
        try {
          const localUrl = await uploadImageFromUrl(chosenUrl)
          next = [localUrl]
        } catch {
          next = [chosenUrl]
        }
      }
      if (next.length === 0) {
        setMsg(uploadFailures > 0
          ? 'No se pudo subir la imagen arrastrada.'
          : 'No se detectaron imágenes válidas para agregar.')
      } else {
        setItems((prev) => prev.map((x, idx) => idx === i
          ? { ...x, imageUrls: mergeImageUrls(x.imageUrls || [], next) }
          : x
        ))
        if (uploadFailures > 0) setMsg('Algunas imágenes no se pudieron subir.')
      }
    } catch (_err) {
      setMsg('No se pudo agregar una de las imágenes.')
    } finally {
      setItem(i, { uploading: false })
    }
  }

  async function create(){
    setBusy(true); setMsg('')
    try{
      const preparedItems = []
      for (let idx = 0; idx < items.length; idx += 1) {
        const x = items[idx]
        if (!String(x.name || '').trim()) continue
        const rawUrls = Array.isArray(x.imageUrls) ? x.imageUrls : []
        const persistedUrls = []
        for (let j = 0; j < rawUrls.length; j += 1) {
          const persisted = await materializeImageUrl(rawUrls[j], j)
          if (persisted) persistedUrls.push(persisted)
        }
        preparedItems.push({
          name: x.name,
          qty: Number(x.qty || 1),
          unitPrice: Number(x.unitPrice || 0),
          imageUrls: persistedUrls,
        })
      }

      const payload = {
        customer,
        date,
        notes,
        totalize,
        items: preparedItems,
      }
      const url = isEdit ? `/api/quotes/${encodeURIComponent(initialQuote.id)}` : '/api/quotes'
      const method = isEdit ? 'PUT' : 'POST'
      const r = await j(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)})
      setMsg(isEdit ? 'Cotización actualizada' : 'Cotización creada')
      onSaved?.(r.quote)
      if (!isEdit) {
        setCustomer('')
        setNotes('')
        setTotalize(true)
        setItems([makeEmptyItem()])
      }
      onClose?.()
    }catch(e){
      setMsg('Error creando cotización' + (e?.message ? ` (${e.message})` : ''))
    }finally{
      setBusy(false)
    }
  }

  return (
      <div>
      <div className="quote-form-heading"><span className="quote-document-icon"><FileText size={23} /></span><div><Dialog.Title>{isEdit ? 'Editar cotización' : 'Nueva cotización'}</Dialog.Title><Dialog.Description>Datos del cliente y productos de la propuesta.</Dialog.Description></div><button type="button" onClick={onClose} aria-label="Cerrar cotización"><X size={20} /></button></div>


      {msg && <div className="mt-4 text-sm text-slate-200">{msg}</div>}

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div>
          <div className="text-sm leading-5 text-slate-400">Cotizado a</div>
          <input value={customer} onChange={e=>setCustomer(e.target.value)} className="mt-2 w-full px-4 py-2 rounded-xl bg-black/20 border border-white/10 text-white" placeholder="Persona o empresa" />
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
            <div key={i} className="quote-form-product">
              <h3>Producto {i + 1}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <div className="text-sm leading-5 text-slate-400">Producto</div>
                  <input value={it.name} onChange={e=>setItem(i,{name:e.target.value})} className="mt-2 w-full px-4 py-2 rounded-xl bg-black/20 border border-white/10 text-white" />
                </div>
                <div>
                  <div className="text-sm leading-5 text-slate-400">Cantidad</div>
                  <input value={it.qty} onChange={e=>setItem(i,{qty:e.target.value})} type="number" className="mt-2 w-full px-4 py-2 rounded-xl bg-black/20 border border-white/10 text-white" />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm leading-5 text-slate-400">Valor unidad</div>
                  <input value={it.unitPrice} onChange={e=>setItem(i,{unitPrice:e.target.value})} type="number" className="mt-2 w-full px-4 py-2 rounded-xl bg-black/20 border border-white/10 text-white" />
                </div>
                <div className="flex items-end">
                  <div className="text-sm text-slate-400">Subtotal: {(Number(it.qty||0)*Number(it.unitPrice||0)).toLocaleString('es-CO')}</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-sm leading-5 text-slate-400 mb-2">Imágenes</div>
                <div
                  onDragOver={(e) => { e.preventDefault(); setItem(i, { isDragOver: true }) }}
                  onDragLeave={(e) => { e.preventDefault(); setItem(i, { isDragOver: false }) }}
                  onDrop={(e) => onDropImages(i, e)}
                  className={cls(
                    'w-full rounded-xl border border-dashed p-3 transition-all duration-200',
                    it.isDragOver ? 'border-indigo-400 bg-indigo-500/10' : 'border-white/20 bg-black/20'
                  )}
                >
                  <div className="text-xs text-slate-400">Arrastra imagen(s) desde internet o desde tu equipo y suéltalas aquí.</div>
                  {it.uploading && <div className="mt-2 text-xs text-slate-300">Subiendo imagen...</div>}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(it.imageUrls || []).map((url) => (
                      <div key={url} className="relative h-20 w-20 rounded-lg overflow-hidden border border-white/10 bg-black/30">
                        <img
                          src={url}
                          alt="preview"
                          className="h-full w-full object-cover"
                          onError={() => {
                            removeImageFromItem(i, url)
                            setMsg('Se descartó una imagen inválida.')
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => removeImageFromItem(i, url)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/75 hover:bg-black text-white inline-flex items-center justify-center"
                          title="Quitar"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {(!it.imageUrls || it.imageUrls.length === 0) && (
                      <div className="text-sm text-slate-400 py-2">Sin imágenes</div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setItem(i, { showUrlInput: !it.showUrlInput })}
                      className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-semibold inline-flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar imagen
                    </button>
                  </div>

                  {it.showUrlInput && (
                    <div className="mt-3 flex flex-col md:flex-row gap-2">
                      <input
                        value={it.imageUrlDraft || ''}
                        onChange={(e) => setItem(i, { imageUrlDraft: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-black/20 border border-white/10 text-white"
                        placeholder="https://..."
                      />
                      <button
                        type="button"
                        onClick={() => addImageUrlToItem(i, it.imageUrlDraft)}
                        className="px-3 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold"
                      >
                        Añadir
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end">
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

        <div className="quote-form-totals">
          <button onClick={()=>setItems(prev=>[...prev, makeEmptyItem()])} className="px-4 py-2 rounded-xl border border-white/10 transition-all duration-200 ease-out hover:bg-white/5 text-sm font-bold">+ Agregar item</button>
          <label className="ml-auto inline-flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={totalize}
              onChange={(e) => setTotalize(Boolean(e.target.checked))}
              className="h-4 w-4 accent-indigo-500"
            />
            Totalizar cotización
          </label>
          <div className="text-base leading-6 font-bold">TOTAL: {totalize ? total.toLocaleString('es-CO') : '-----'}</div>
        </div>
      </div>

      <div className="quote-form-footer">
        <button onClick={onClose} className="px-4 py-2 rounded-xl border border-white/10 transition-all duration-200 ease-out hover:bg-white/5 text-sm font-bold">Cancelar</button>
        <button
          onClick={create}
          disabled={busy}
          className={cls('px-4 py-2 rounded-xl font-bold text-sm transition-all duration-200 ease-out', busy ? 'bg-slate-700 text-slate-300' : 'bg-indigo-500 hover:bg-indigo-400 text-white')}
        >
          {busy ? 'Guardando…' : (isEdit ? 'Guardar cambios' : 'Guardar')}
        </button>
      </div>
    </div>
  )
}

export default function QuotesPage() {
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [sort, setSort] = React.useState('newest')
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState('')
  const [list, setList] = React.useState([])
  const [open, setOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [editingQuote, setEditingQuote] = React.useState(null)
  const [previewQuote, setPreviewQuote] = React.useState(null)
  const [shareMsg, setShareMsg] = React.useState('')

  async function j(url, opts){
    const r = await fetch(url, { credentials:'include', ...opts })
    const t = await r.text()
    let data={}
    try{ data=JSON.parse(t) }catch{ data={ raw:t } }
    if(!r.ok) throw Object.assign(new Error('http '+r.status), {status:r.status, data})
    return data
  }

  async function refresh(){
    setLoading(true); setLoadError('')
    try { const r = await j('/api/quotes'); setList(r.items || []) }
    catch { setLoadError('No se pudieron cargar las cotizaciones. Intenta refrescar.') }
    finally { setLoading(false) }
  }

  React.useEffect(()=>{ refresh().catch(()=>{}) },[])

  const quoteDate = q => String(q.date || q.createdAt || '').slice(0, 10)
  const displayDate = q => { const d = quoteDate(q); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : 'Sin fecha' }
  const visibleQuotes = [...list].filter(q => `${q.customer || ''} ${(q.items || []).map(i => i.name).join(' ')}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a,b) => sort === 'customer' ? String(a.customer || '').localeCompare(String(b.customer || ''), 'es') : sort === 'oldest' ? quoteDate(a).localeCompare(quoteDate(b)) : quoteDate(b).localeCompare(quoteDate(a)))
  const customers = new Set(list.map(q => String(q.customer || '').trim().toLocaleLowerCase()).filter(Boolean)).size
  const totalFor = q => (q.items || []).reduce((sum, i) => sum + Number(i.qty || 0) * Number(i.unitPrice || 0), 0).toLocaleString('es-CO', { maximumFractionDigits: 2 })

  async function shareQuotePdf(quote) {
    if (!quote?.id) return
    setShareMsg('')
    const pdfPath = `/api/quotes/${quote.id}/pdf`

    try {
      const resp = await fetch(pdfPath, { credentials: 'include' })
      if (!resp.ok) throw new Error('pdf_fetch_failed')
      const blob = await resp.blob()
      const safeCustomer = String(quote.customer || 'cliente').replace(/[^a-z0-9]+/gi, '_')
      const file = new File([blob], `cotizacion_${safeCustomer}_${quote.id}.pdf`, { type: 'application/pdf' })

      if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        await navigator.share({ title: `Cotización ${quote.customer || ''}`, files: [file] })
        return
      }
    } catch (_e) {
      // fallback below
    }

    const absolute = `${window.location.origin}${pdfPath}`
    try {
      if (navigator.share) {
        await navigator.share({ title: `Cotización ${quote.customer || ''}`, url: absolute })
        return
      }
    } catch (_e) {
      // fallback below
    }

    try {
      await navigator.clipboard.writeText(absolute)
      setShareMsg('Enlace copiado al portapapeles.')
    } catch (_e) {
      setShareMsg('No se pudo compartir automáticamente. Copia este enlace: ' + absolute)
    }
  }

  return (
    <div className="quotes-page">
      <div>
        <header className="quotes-header">
          <div>
            <div className="quotes-eyebrow">GESTIÓN COMERCIAL</div><h1>Cotizaciones</h1><p>Propuestas, productos y documentos.</p>
          </div>

          <div className="quotes-header-actions">
          <Button type="button" variant="outline" aria-label="Refrescar cotizaciones" title="Refrescar" disabled={loading} onClick={refresh}><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></Button>
          <Button type="button" variant="outline" aria-label="Configuración de cotizaciones" title="Configuración de cotizaciones" onClick={() => setSettingsOpen(true)}><Settings size={19} /></Button>
          <QuoteSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
              <Button><Plus size={18} />Nueva cotización</Button>
            </Dialog.Trigger>

            <Dialog.Portal>
              <Dialog.Overlay className="feego-overlay fixed inset-0 z-[70]" />
              <Dialog.Content className="feego-modal quote-form-dialog z-[71] fixed left-1/2 top-1/2 w-[95vw] max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-2xl p-4 md:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <NewQuoteForm
                  onSaved={async ()=>{ await refresh().catch(()=>{}); }}
                  onClose={()=>setOpen(false)}
                />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          </div>

          <Dialog.Root open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditingQuote(null) }}>
            <Dialog.Portal>
              <Dialog.Overlay className="feego-overlay fixed inset-0 z-[70]" />
              <Dialog.Content className="feego-modal quote-form-dialog z-[71] fixed left-1/2 top-1/2 w-[95vw] max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-2xl p-4 md:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <NewQuoteForm
                  initialQuote={editingQuote}
                  onSaved={async ()=>{ await refresh().catch(()=>{}); }}
                  onClose={()=>setEditOpen(false)}
                />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </header>

        <div className="quotes-summary"><div><FileText size={19} /><strong>{list.length}</strong><span>Cotizaciones</span></div><div><Users size={19} /><strong>{customers}</strong><span>{customers === 1 ? 'Cliente' : 'Clientes'}</span></div><span className="quotes-summary-note">Hasta 200 cotizaciones recientes</span></div>
        <section className="quotes-list" aria-label="Listado de cotizaciones">
          <div className="quotes-list-toolbar"><h2>Cotizaciones recientes <span>{visibleQuotes.length}</span></h2><div className="quotes-filters"><label className="quotes-search"><Search size={17} /><Input aria-label="Buscar cotización" placeholder="Buscar cliente o producto" value={query} onChange={e => setQuery(e.target.value)} /></label><label className="quotes-sort"><ArrowUpDown size={16} /><select aria-label="Ordenar cotizaciones" value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Más recientes</option><option value="oldest">Más antiguas</option><option value="customer">Cliente A–Z</option></select></label></div></div>
          {loadError && <div role="alert" className="quotes-error">{loadError}<Button variant="outline" onClick={refresh}>Reintentar</Button></div>}
          {loading && !list.length ? <div className="quotes-empty" role="status"><RefreshCw size={24} className="animate-spin" />Cargando cotizaciones…</div> : <>
            <div className="quotes-table-heading" aria-hidden="true"><span>Cliente</span><span>Fecha</span><span>Productos</span><span>Total</span><span>Acciones</span></div>
            {visibleQuotes.map(q => <article key={q.id} className="quote-row">
              <div className="quote-customer"><span className="quote-document-icon"><FileText size={22} /></span><div><button onClick={() => { setShareMsg(''); setPreviewQuote(q) }}>{q.customer || 'Sin cliente'}</button><span>Cotización · PDF</span></div></div>
              <div className="quote-date"><CalendarDays size={15} /><time dateTime={quoteDate(q) || undefined}>{displayDate(q)}</time></div>
              <div className="quote-products"><Package size={15} /><span>{q.items?.length || 0} <span className="quote-mobile-label">productos</span></span></div>
              <div className="quote-total"><small className="quote-mobile-label">Total</small>{q.totalize === false ? <span className="quote-no-total">Sin totalizar</span> : <strong>{totalFor(q)}</strong>}</div>
              <div className="quote-actions"><Button variant="outline" title="Vista previa" aria-label={`Vista previa de ${q.customer}`} onClick={() => { setShareMsg(''); setPreviewQuote(q) }}><Eye size={17} /></Button><Button variant="ghost" title="Editar" aria-label={`Editar cotización de ${q.customer}`} onClick={() => { setEditingQuote(q); setEditOpen(true) }}><Pencil size={17} /></Button><a className="quote-download" href={`/api/quotes/${q.id}/pdf?download=1`} target="_blank" rel="noreferrer" title="Descargar PDF" aria-label={`Descargar PDF de ${q.customer}`}><Download size={17} /></a></div>
            </article>)}
            {!visibleQuotes.length && <div className="quotes-empty"><FileText size={30} /><h3>{query ? 'Sin coincidencias' : 'Tu primera cotización empieza aquí'}</h3><p>{query ? 'Prueba con otro cliente o producto.' : 'Crea una propuesta y consulta su PDF en este listado.'}</p><Button variant="outline" onClick={() => query ? setQuery('') : setOpen(true)}>{query ? 'Limpiar búsqueda' : 'Crear cotización'}</Button></div>}
          </>}
        </section>
      </div>

      <Dialog.Root open={Boolean(previewQuote)} onOpenChange={(o) => { if (!o) { setPreviewQuote(null); setShareMsg('') } }}>
        <Dialog.Portal>
          <Dialog.Overlay className="feego-overlay fixed inset-0 z-[70]" />
          <Dialog.Content className="feego-modal quote-preview-dialog z-[71] fixed left-1/2 top-1/2 w-[96vw] max-w-6xl h-[88vh] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-4 shadow-2xl flex flex-col">
            <div className="quote-preview-header">
              <div>
                <Dialog.Title className="text-lg font-bold">Vista previa PDF</Dialog.Title>
                <div className="text-sm text-slate-400">{previewQuote?.customer || ''}</div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewQuote ? `/api/quotes/${previewQuote.id}/pdf?download=1` : '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold inline-flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Descargar
                </a>
                <button
                  onClick={() => shareQuotePdf(previewQuote)}
                  className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-semibold inline-flex items-center gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  Compartir
                </button>
                <Dialog.Close asChild><Button variant="ghost" aria-label="Cerrar vista previa"><X size={19} /></Button></Dialog.Close>
              </div>
            </div>

            {shareMsg && (
              <div className="mt-3 text-sm text-slate-300 rounded-lg border border-white/10 bg-white/5 px-3 py-2 inline-flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                {shareMsg}
              </div>
            )}

            <div className="mt-4 flex-1 rounded-xl border border-white/10 overflow-hidden bg-black/30">
              {previewQuote && (
                <iframe
                  title={`PDF ${previewQuote.id}`}
                  src={`/api/quotes/${previewQuote.id}/pdf`}
                  className="w-full h-full"
                />
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
