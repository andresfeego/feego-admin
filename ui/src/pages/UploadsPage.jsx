import React from 'react'
import { CloudUpload, Image, FileText, FileCode2, FileArchive, RefreshCw, FolderOpen, Upload, ListX, Eye, Download, Trash2, X } from 'lucide-react'
import OperationsHeader from '../components/OperationsHeader'
import './AdminPages.scss'
import { api } from '../lib/api'

function Icon({ kind }) {
  const Glyph = ({ image: Image, pdf: FileText, text: FileCode2, file: FileArchive })[kind] || FileArchive
  return <span className={`upload-file-icon upload-file-icon--${kind || 'file'}`}><Glyph size={19} strokeWidth={1.7} aria-hidden="true" /></span>
}

function fileKindByExt(ext) {
  const x = String(ext || '').toLowerCase()
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(x)) return 'image'
  if (x === 'pdf') return 'pdf'
  if (['txt', 'log', 'md', 'json', 'csv', 'sql', 'xml', 'yml', 'yaml', 'env'].includes(x)) return 'text'
  return 'file'
}

export default function UploadsPage() {
  const [items, setItems] = React.useState([])
  const [loading, setLoading] = React.useState(true)

  const inputRef = React.useRef(null)
  const [queue, setQueue] = React.useState([]) // [{id,name,size,progress,status,error}]
  const [uploading, setUploading] = React.useState(false)
  const [previewOpen, setPreviewOpen] = React.useState(false)
  const [previewItem, setPreviewItem] = React.useState(null)
  const [previewLoading, setPreviewLoading] = React.useState(false)
  const [previewText, setPreviewText] = React.useState('')
  const [previewError, setPreviewError] = React.useState('')

  async function refresh() {
    setLoading(true)
    const r = await api('/api/uploads/list')
    if (r.ok) {
      const raw = r.data.items || []
      const normalized = raw.map((it) => ({
        ...it,
        kind: it.kind || fileKindByExt(it.ext),
        sizeHuman: it.sizeHuman || humanSize(Number(it.size || 0)),
        mtimeHuman: it.mtimeHuman || (it.mtime ? new Date(Number(it.mtime)).toLocaleString('es-CO') : '—'),
      }))
      setItems(normalized)
    }
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
        leaving: false,
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
          markDoneAndAutoHide(item.id)
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

  function statusLabel(status) {
    if (status === 'queued') return 'pendiente'
    if (status === 'uploading') return 'subiendo'
    if (status === 'done') return 'completado'
    if (status === 'error') return 'error'
    return status || '—'
  }

  function markDoneAndAutoHide(id) {
    setQueue((q) => q.map((x) => (x.id === id ? { ...x, status: 'done', progress: 100 } : x)))
    setTimeout(() => {
      setQueue((q) => q.map((x) => (x.id === id ? { ...x, leaving: true } : x)))
    }, 2700)
    setTimeout(async () => {
      setQueue((q) => q.filter((x) => x.id !== id))
      await refresh()
    }, 3000)
  }

  function previewMode(item) {
    if (!item) return 'unsupported'
    const ext = String(item.ext || '').toLowerCase()
    if (ext === 'pdf') return 'pdf'
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return 'image'
    if (['txt', 'log', 'md', 'json', 'csv', 'sql', 'xml', 'yml', 'yaml', 'env'].includes(ext)) return 'text'
    if (Number(item.size || 0) <= 1024 * 1024) return 'text'
    return 'unsupported'
  }

  async function openPreview(item) {
    setPreviewItem(item)
    setPreviewOpen(true)
    setPreviewText('')
    setPreviewError('')
    const mode = previewMode(item)
    if (mode !== 'text') return
    setPreviewLoading(true)
    try {
      const r = await fetch(`/api/uploads/view?name=${encodeURIComponent(item.name)}`, { credentials: 'include' })
      if (!r.ok) throw new Error('http ' + r.status)
      const text = await r.text()
      setPreviewText(text)
    } catch (_e) {
      setPreviewError('No fue posible cargar la vista previa de texto.')
    } finally {
      setPreviewLoading(false)
    }
  }

  return (
    <div className="ops-page uploads-page space-y-6">
      <OperationsHeader icon={CloudUpload} eyebrow="ARCHIVOS" title="Uploads" description={`${items.length} archivos disponibles`}>
        <button className="ops-button" onClick={refresh} disabled={loading}><RefreshCw size={16} />Actualizar</button>
      </OperationsHeader>

      {/* Uploader (multi-file, per-file progress, sequential) */}
      <div className="rounded-2xl border ops-border ops-surface backdrop-blur-xl p-4 md:p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-extrabold">Subir archivos</div>
            <div className="text-sm leading-5 ops-muted">Selecciona archivos y revisa su progreso de carga.</div>
          </div>
          <div className="flex gap-4 flex-wrap">
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
            <button className="px-4 py-2 rounded-lg border ops-border ops-surface transition-all duration-200 ease-out hover:bg-white/10" onClick={() => inputRef.current && inputRef.current.click()}>
              <FolderOpen size={16} /> Seleccionar
            </button>
            <button className={`px-4 py-2 rounded-lg font-bold transition-all duration-200 ease-out ops-primary`} disabled={uploading} onClick={startUpload}>
              <Upload size={16} />{uploading ? 'Subiendo…' : 'Subir'}
            </button>
            <button className="px-4 py-2 rounded-lg border ops-border ops-surface transition-all duration-200 ease-out hover:bg-white/10" onClick={clearDone}>
              <ListX size={16} /> Limpiar
            </button>
          </div>
        </div>

        {queue.length > 0 && (
          <div className="mt-4 space-y-4">
            {queue.slice(-20).map((q) => (
              <div
                key={q.id}
                className={`upload-queue-item rounded-xl border ops-border ops-inset p-4 relative ${q.leaving ? 'upload-queue-item--leaving' : ''}`}
              >
                <button
                  className={`absolute top-2 right-2 w-8 h-8 rounded-lg border ${uploading || q.status === 'uploading' ? 'ops-border ops-surface opacity-60 cursor-not-allowed' : 'ops-border ops-surface hover:bg-white/10'}`}
                  title={uploading || q.status === 'uploading' ? 'No disponible mientras sube' : 'Quitar de la cola'}
                  disabled={uploading || q.status === 'uploading'}
                  onClick={() => removeFromQueue(q.id)}
                >
                  <X size={16} />
                </button>

                <div className="flex items-center justify-between gap-4 pr-10">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{q.name}</div>
                    <div className="text-sm leading-5 ops-muted">{humanSize(q.size)} · {statusLabel(q.status)}{q.error ? ` · ${q.error}` : ''}</div>
                  </div>
                  <div className={`text-sm w-24 text-right ${q.status === 'done' ? 'ops-success' : 'ops-muted'}`}>
                    {q.status === 'done' ? 'Completado' : `${q.progress}%`}
                  </div>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className={`h-2 transition-[width,background-color] duration-200 ease-out ${q.status === 'done' ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: q.progress + '%' }} />
                </div>
              </div>
            ))}
            {queue.length > 20 && (
              <div className="text-sm ops-muted">Mostrando las últimas 20 seleccionadas…</div>
            )}
          </div>
        )}
      </div>

      {/* Inventory */}
      <div className="rounded-2xl border ops-border ops-surface backdrop-blur-xl overflow-hidden">
        <div className="hidden md:block overflow-auto">
          <table className="w-full text-sm min-w-[800px] table-fixed">
            <colgroup>
              <col style={{ width: '50%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '290px' }} />
            </colgroup>
            <thead className="text-xs ops-muted">
              <tr className="border-b ops-border">
                <th className="text-left p-4">Archivo</th>
                <th className="text-left p-4">Tamaño</th>
                <th className="text-left p-4">Modificado</th>
                <th className="text-left p-4 whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="p-4 ops-muted" colSpan={4}>Cargando…</td></tr>
              ) : items.length === 0 ? (
                <tr><td className="p-4 ops-muted" colSpan={4}>Sin archivos</td></tr>
              ) : (
                items.map((it) => (
                  <tr key={it.name} className="border-b ops-border">
                    <td className="p-4 font-semibold">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon kind={it.kind} />
                        <span className="truncate block" title={it.name}>{it.name}</span>
                      </div>
                    </td>
                    <td className="p-4 ops-muted">{it.sizeHuman}</td>
                    <td className="p-4 ops-muted">{it.mtimeHuman || '—'}</td>
                    <td className="p-4 w-[290px] max-w-[290px]">
                      <div className="flex gap-2 whitespace-nowrap">
                        <button
                          className="px-4 py-2 rounded-lg border ops-border ops-surface transition-all duration-200 ease-out hover:bg-white/10"
                          onClick={() => openPreview(it)}
                        >
                          <Eye size={15} /> Ver
                        </button>
                        <a className="px-4 py-2 rounded-lg border ops-border ops-surface transition-all duration-200 ease-out hover:bg-white/10" href={`/api/uploads/download?name=${encodeURIComponent(it.name)}`}><Download size={15} />Descargar</a>
                        <button className="px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 ops-danger transition-all duration-200 ease-out hover:bg-red-500/20" onClick={() => del(it.name)} aria-label={`Eliminar ${it.name}`}><Trash2 size={15} />Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden p-4 space-y-4">
          {loading ? (
            <div className="text-sm ops-muted">Cargando…</div>
          ) : items.length === 0 ? (
            <div className="text-sm ops-muted">Sin archivos</div>
          ) : (
            items.map((it) => (
              <div key={it.name} className="rounded-xl border ops-border ops-inset p-4">
                <div className="flex items-start gap-2 min-w-0">
                  <Icon kind={it.kind} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate" title={it.name}>{it.name}</div>
                    <div className="mt-2 text-sm ops-muted">{it.sizeHuman}</div>
                    <div className="text-sm ops-muted">{it.mtimeHuman || '—'}</div>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    className="flex-1 text-center px-4 py-2 rounded-lg border ops-border ops-surface transition-all duration-200 ease-out hover:bg-white/10"
                    onClick={() => openPreview(it)}
                  >
                    <Eye size={15} /> Ver
                  </button>
                  <a className="flex-1 text-center px-4 py-2 rounded-lg border ops-border ops-surface transition-all duration-200 ease-out hover:bg-white/10" href={`/api/uploads/download?name=${encodeURIComponent(it.name)}`}><Download size={15} />Descargar</a>
                  <button className="flex-1 px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 ops-danger transition-all duration-200 ease-out hover:bg-red-500/20" onClick={() => del(it.name)} aria-label={`Eliminar ${it.name}`}><Trash2 size={15} />Eliminar</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {previewOpen && previewItem && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setPreviewOpen(false)} />
          <div role="dialog" aria-modal="true" aria-label={previewItem.name} className="upload-preview-dialog absolute left-1/2 top-1/2 w-[96vw] max-w-5xl h-[88vh] -translate-x-1/2 -translate-y-1/2 rounded-2xl border ops-border ops-surface backdrop-blur-xl p-4 md:p-6 flex flex-col">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xl leading-8 font-bold truncate">{previewItem.name}</div>
                <div className="text-sm leading-5 ops-muted">
                  {previewItem.sizeHuman} · {previewItem.mtimeHuman || '—'} · {String(previewItem.ext || '').toUpperCase() || 'FILE'}
                </div>
              </div>
              <div className="flex gap-2">
                <a
                  className="px-4 py-2 rounded-lg border ops-border ops-surface hover:bg-white/10"
                  target="_blank"
                  rel="noreferrer"
                  href={`/api/uploads/view?name=${encodeURIComponent(previewItem.name)}`}
                >
                  Abrir
                </a>
                <a
                  className="px-4 py-2 rounded-lg border ops-border ops-surface hover:bg-white/10"
                  href={`/api/uploads/download?name=${encodeURIComponent(previewItem.name)}`}
                >
                  Descargar
                </a>
                <button className="px-4 py-2 rounded-lg border ops-border ops-surface hover:bg-white/10" onClick={() => setPreviewOpen(false)}>
                  Cerrar
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-xl border ops-border ops-inset flex-1 min-h-0 overflow-hidden">
              {previewMode(previewItem) === 'pdf' && (
                <iframe
                  title={previewItem.name}
                  className="w-full h-full"
                  src={`/api/uploads/view?name=${encodeURIComponent(previewItem.name)}`}
                />
              )}

              {previewMode(previewItem) === 'image' && (
                <div className="w-full h-full overflow-auto p-4 flex items-start justify-center">
                  <img
                    src={`/api/uploads/view?name=${encodeURIComponent(previewItem.name)}`}
                    alt={previewItem.name}
                    className="max-w-full h-auto rounded-lg border ops-border"
                  />
                </div>
              )}

              {previewMode(previewItem) === 'text' && (
                <div className="w-full h-full overflow-auto p-4">
                  {previewLoading ? (
                    <div className="text-sm ops-muted">Cargando vista previa…</div>
                  ) : previewError ? (
                    <div className="text-sm ops-danger">{previewError}</div>
                  ) : (
                    <pre className="text-sm leading-6 whitespace-pre-wrap break-words ops-text">{previewText}</pre>
                  )}
                </div>
              )}

              {previewMode(previewItem) === 'unsupported' && (
                <div className="w-full h-full p-6 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-lg font-bold">Vista previa no disponible para este tipo</div>
                    <div className="mt-2 text-sm ops-muted">
                      Puedes abrirlo en una pestaña nueva o descargarlo.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
