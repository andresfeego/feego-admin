import React from 'react'
import { api } from '../lib/api'

function Icon({ kind }) {
  const map = {
    image: '🖼️',
    pdf: '📄',
    text: '📝',
    file: '📦',
  }
  return <span className="w-6 inline-block">{map[kind] || map.file}</span>
}

export default function UploadsPage() {
  const [items, setItems] = React.useState([])
  const [loading, setLoading] = React.useState(true)

  const inputRef = React.useRef(null)
  const [queue, setQueue] = React.useState([]) // [{id,name,size,progress,status,error}]
  const [uploading, setUploading] = React.useState(false)

  async function refresh() {
    setLoading(true)
    const r = await api('/api/uploads/list')
    if (r.ok) setItems(r.data.items || [])
    setLoading(false)
  }

  React.useEffect(() => {
    refresh()
  }, [])

  async function del(name) {
    if (!confirm('¿Eliminar ' + name + '?')) return
    const r = await api('/api/uploads/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (r.ok) refresh()
    else alert('Error eliminando')
  }

  function addFiles(files) {
    const arr = Array.from(files || [])
    if (arr.length === 0) return
    const now = Date.now()
    setQueue((q) => [
      ...q,
      ...arr.map((f, i) => ({
        id: now + '-' + i + '-' + Math.random().toString(16).slice(2),
        file: f,
        name: f.name,
        size: f.size,
        progress: 0,
        status: 'queued', // queued|uploading|done|error
        error: null,
      })),
    ])
  }

  function humanSize(n) {
    const u = ['B', 'KB', 'MB', 'GB']
    let x = n
    let i = 0
    while (x >= 1024 && i < u.length - 1) {
      x /= 1024
      i++
    }
    return x.toFixed(i === 0 ? 0 : 1) + u[i]
  }

  function uploadOne(item) {
    return new Promise((resolve) => {
      const fd = new FormData()
      fd.append('file', item.file)

      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/uploads')
      xhr.withCredentials = true

      xhr.upload.onprogress = (evt) => {
        if (!evt.lengthComputable) return
        const pct = Math.round((evt.loaded / evt.total) * 100)
        setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, progress: pct } : x)))
      }

      xhr.onreadystatechange = () => {
        if (xhr.readyState !== 4) return
        if (xhr.status >= 200 && xhr.status < 300) {
          setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, status: 'done', progress: 100 } : x)))
          resolve(true)
        } else {
          setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, status: 'error', error: 'HTTP ' + xhr.status } : x)))
          resolve(false)
        }
      }

      xhr.onerror = () => {
        setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, status: 'error', error: 'network' } : x)))
        resolve(false)
      }

      setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, status: 'uploading', progress: 0 } : x)))
      xhr.send(fd)
    })
  }

  async function startUpload() {
    if (uploading) return
    const pending = queue.filter((x) => x.status === 'queued' || x.status === 'error')
    if (pending.length === 0) return

    setUploading(true)
    try {
      for (const it of pending) {
        // eslint-disable-next-line no-await-in-loop
        await uploadOne(it)
      }
      await refresh()
    } finally {
      setUploading(false)
    }
  }

  function clearDone() {
    setQueue((q) => q.filter((x) => x.status !== 'done'))
  }

  function removeFromQueue(id) {
    if (uploading) return
    setQueue((q) => q.filter((x) => x.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xl font-black">Uploads</div>
          <div className="text-xs text-slate-400">Inventario en disco</div>
        </div>
        <button className="px-3 py-2 rounded-lg border border-white/10 bg-white/5" onClick={refresh}>Actualizar</button>
      </div>

      {/* Uploader (multi-file, per-file progress, sequential) */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-extrabold">Subir archivos</div>
            <div className="text-xs text-slate-400">Multiarchivo con porcentaje por archivo (se suben 1 por 1)</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
            <button className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10" onClick={() => inputRef.current && inputRef.current.click()}>
              Seleccionar
            </button>
            <button className={`px-3 py-2 rounded-lg font-bold ${uploading ? 'bg-blue-600/50' : 'bg-blue-600 hover:bg-blue-500'}`} disabled={uploading} onClick={startUpload}>
              {uploading ? 'Subiendo…' : 'Subir'}
            </button>
            <button className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10" onClick={clearDone}>
              Limpiar
            </button>
          </div>
        </div>

        {queue.length > 0 && (
          <div className="mt-4 space-y-2">
            {queue.slice(-20).map((q) => (
              <div key={q.id} className="rounded-xl border border-white/10 bg-black/20 p-3 relative">
                <button
                  className={`absolute top-2 right-2 w-7 h-7 rounded-lg border ${uploading || q.status === 'uploading' ? 'border-white/10 bg-white/5 opacity-60 cursor-not-allowed' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                  title={uploading || q.status === 'uploading' ? 'No disponible mientras sube' : 'Quitar de la cola'}
                  disabled={uploading || q.status === 'uploading'}
                  onClick={() => removeFromQueue(q.id)}
                >
                  ✕
                </button>

                <div className="flex items-center justify-between gap-3 pr-10">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{q.name}</div>
                    <div className="text-xs text-slate-400">{humanSize(q.size)} · {q.status}{q.error ? ` · ${q.error}` : ''}</div>
                  </div>
                  <div className="text-xs text-slate-300 w-10 text-right">{q.progress}%</div>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-2 bg-blue-500" style={{ width: q.progress + '%' }} />
                </div>
              </div>
            ))}
            {queue.length > 20 && (
              <div className="text-xs text-slate-400">Mostrando las últimas 20 seleccionadas…</div>
            )}
          </div>
        )}
      </div>

      {/* Inventory */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm min-w-[780px]">
            <thead className="text-xs text-slate-400">
              <tr className="border-b border-white/10">
                <th className="text-left p-3">Archivo</th>
                <th className="text-left p-3">Tamaño</th>
                <th className="text-left p-3">Modificado</th>
                <th className="text-left p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="p-3 text-slate-400" colSpan={4}>Cargando…</td></tr>
              ) : items.length === 0 ? (
                <tr><td className="p-3 text-slate-400" colSpan={4}>Sin archivos</td></tr>
              ) : (
                items.map((it) => (
                  <tr key={it.name} className="border-b border-white/5">
                    <td className="p-3 font-semibold">
                      <Icon kind={it.kind} /> {it.name}
                    </td>
                    <td className="p-3 text-slate-300">{it.sizeHuman}</td>
                    <td className="p-3 text-slate-300">{it.mtimeHuman}</td>
                    <td className="p-3">
                      <div className="flex gap-2 flex-wrap">
                        <a className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5" target="_blank" href={`/api/uploads/view?name=${encodeURIComponent(it.name)}`}>Ver</a>
                        <a className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5" href={`/api/uploads/download?name=${encodeURIComponent(it.name)}`}>Descargar</a>
                        <button className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-200" onClick={() => del(it.name)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
