import React from 'react'
import { useTheme } from '../lib/theme-provider.jsx'

function Card({ title, desc, children }) {
  return (
    <div className="feego-card rounded-2xl p-4 md:p-6 transition-all duration-200 ease-out hover:shadow-lg">
      <div className="text-xl leading-8 font-bold">{title}</div>
      {desc && <div className="mt-2 text-sm leading-5 opacity-70">{desc}</div>}
      <div className="mt-4">{children}</div>
    </div>
  )
}

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={
        'w-full flex items-center justify-between gap-4 rounded-xl px-4 py-4 border transition-all duration-200 ease-out ' +
        (checked ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white/60 border-black/10')
      }
    >
      <div className="text-sm font-bold">{label}</div>
      <div className={'h-6 w-11 rounded-full p-1 transition ' + (checked ? 'bg-white/25' : 'bg-black/10')}>
        <div className={'h-4 w-4 rounded-full transition ' + (checked ? 'translate-x-5 bg-white' : 'translate-x-0 bg-white')} />
      </div>
    </button>
  )
}

const emptyBranding = {
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
}

export default function SettingsPage() {
  const { theme, setTheme, systemTheme } = useTheme()
  const current = theme || 'light'
  const [branding, setBranding] = React.useState(emptyBranding)
  const [hasLogo, setHasLogo] = React.useState(false)
  const [hasSignature, setHasSignature] = React.useState(false)
  const [logoFile, setLogoFile] = React.useState(null)
  const [signatureFile, setSignatureFile] = React.useState(null)
  const [msg, setMsg] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  const [projects, setProjects] = React.useState([])
  const [projectsLoading, setProjectsLoading] = React.useState(false)
  const [savingColors, setSavingColors] = React.useState(false)

  async function j(url, opts) {
    const r = await fetch(url, { credentials: 'include', ...opts })
    const t = await r.text()
    let data = {}
    try { data = JSON.parse(t) } catch { data = { raw: t } }
    if (!r.ok) throw Object.assign(new Error('http ' + r.status), { status: r.status, data })
    return data
  }

  async function loadBranding() {
    try {
      const r = await j('/api/branding')
      setBranding({ ...emptyBranding, ...(r.branding || {}) })
      setHasLogo(Boolean(r.hasLogo))
      setHasSignature(Boolean(r.hasSignature))
    } catch {
      setMsg('No se pudo cargar branding')
    }
  }


  async function loadProjects() {
    setProjectsLoading(true)
    try {
      const r = await j('/api/infra/projects')
      const list = (r.projects || []).map((p) => ({
        slug: p.slug,
        name: p.name,
        color_hex: p.color_hex || '',
      }))
      setProjects(list)
    } catch {
      // ignore; not critical
    } finally {
      setProjectsLoading(false)
    }
  }

  async function saveProjectColor(slug, color_hex) {
    setSavingColors(true)
    setMsg('')
    try {
      await j('/api/infra/projects/' + encodeURIComponent(slug), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color_hex: color_hex || null }),
      })
      setMsg('Colores actualizados')
      await loadProjects()
    } catch {
      setMsg('Error guardando color')
    } finally {
      setSavingColors(false)
    }
  }

  React.useEffect(() => {
    loadBranding()
    loadProjects()
  }, [])

  async function saveBranding() {
    setSaving(true)
    setMsg('')
    try {
      await j('/api/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...branding }),
      })

      if (logoFile) {
        const fd = new FormData()
        fd.append('logo', logoFile)
        const r2 = await fetch('/api/branding/logo', { method: 'POST', credentials: 'include', body: fd })
        if (!r2.ok) throw new Error('logo_upload_failed')
        setLogoFile(null)
      }

      if (signatureFile) {
        const fd2 = new FormData()
        fd2.append('signature', signatureFile)
        const r3 = await fetch('/api/branding/signature', { method: 'POST', credentials: 'include', body: fd2 })
        if (!r3.ok) throw new Error('signature_upload_failed')
        setSignatureFile(null)
      }

      setMsg('Branding guardado')
      await loadBranding()
    } catch {
      setMsg('Error guardando branding')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 md:px-6 lg:px-8 2xl:px-12 py-4 md:py-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between gap-4 md:gap-6 flex-wrap">
          <div>
            <div className="text-[32px] leading-[40px] font-bold">Configuración</div>
            <div className="text-sm leading-5 opacity-70">Tema y branding para cotizaciones.</div>
          </div>
        </div>

        {!!msg && <div className="mt-4 text-sm">{msg}</div>}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
          <Card title="Tema" desc="Modo claro por defecto. Puedes cambiar a oscuro cuando quieras.">
            <div className="grid grid-cols-1 gap-4">
              <Switch checked={current === 'light'} onChange={() => setTheme('light')} label="Claro (default)" />
              <Switch checked={current === 'dark'} onChange={() => setTheme('dark')} label="Oscuro" />
              <Switch checked={current === 'system'} onChange={() => setTheme('system')} label={'Sistema' + (systemTheme ? ` (actual: ${systemTheme})` : '')} />
            </div>
          </Card>

          <Card title="Branding" desc="Logo y datos de empresa para PDF de cotizaciones.">
            <div className="space-y-3">
              <input value={branding.companyName} onChange={(e) => setBranding({ ...branding, companyName: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-white/10 bg-black/20" placeholder="Nombre comercial" />
              <input value={branding.legalName} onChange={(e) => setBranding({ ...branding, legalName: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-white/10 bg-black/20" placeholder="Razón social" />
              <input value={branding.nit} onChange={(e) => setBranding({ ...branding, nit: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-white/10 bg-black/20" placeholder="NIT" />
              <input value={branding.phone} onChange={(e) => setBranding({ ...branding, phone: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-white/10 bg-black/20" placeholder="Teléfono" />
              <input value={branding.email} onChange={(e) => setBranding({ ...branding, email: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-white/10 bg-black/20" placeholder="Email" />
              <input value={branding.website} onChange={(e) => setBranding({ ...branding, website: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-white/10 bg-black/20" placeholder="Sitio web" />
              <input value={branding.address} onChange={(e) => setBranding({ ...branding, address: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-white/10 bg-black/20" placeholder="Dirección" />
              <div className="grid grid-cols-2 gap-2">
                <input value={branding.quoteTitle} onChange={(e) => setBranding({ ...branding, quoteTitle: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-white/10 bg-black/20" placeholder="Título PDF" />
                <input value={branding.validityDays} type="number" onChange={(e) => setBranding({ ...branding, validityDays: Number(e.target.value || 0) })} className="w-full px-3 py-2 rounded-xl border border-white/10 bg-black/20" placeholder="Validez (días)" />
              </div>
              <input value={branding.accentColor} onChange={(e) => setBranding({ ...branding, accentColor: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-white/10 bg-black/20" placeholder="#1f4db6" />
              <textarea value={branding.paymentTerms} onChange={(e) => setBranding({ ...branding, paymentTerms: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-white/10 bg-black/20" rows={2} placeholder="Condiciones de pago" />
              <textarea value={branding.warrantyParagraph} onChange={(e) => setBranding({ ...branding, warrantyParagraph: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-white/10 bg-black/20" rows={3} placeholder="Párrafo de garantía" />
              <textarea value={branding.notesFooter} onChange={(e) => setBranding({ ...branding, notesFooter: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-white/10 bg-black/20" rows={2} placeholder="Mensaje final" />
              <input value={branding.signerName} onChange={(e) => setBranding({ ...branding, signerName: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-white/10 bg-black/20" placeholder="Nombre de quien firma" />
              <input value={branding.signerRole} onChange={(e) => setBranding({ ...branding, signerRole: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-white/10 bg-black/20" placeholder="Cargo de quien firma" />
            </div>
          </Card>

          <Card title="Proyectos (colores)" desc="Color por proyecto para actividad/analíticas.">
            {projectsLoading ? <div className="text-sm opacity-70">Cargando proyectos…</div> : null}
            {!projectsLoading && !projects.length ? <div className="text-sm opacity-70">—</div> : null}

            <div className="space-y-3">
              {(projects || []).map((p) => (
                <div key={p.slug} className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-black/20">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm truncate">{p.name}</div>
                    <div className="text-xs opacity-70 font-mono">{p.slug}</div>
                  </div>

                  <input
                    type="color"
                    value={(p.color_hex || '#000000').startsWith('#') ? (p.color_hex || '#000000') : ('#' + (p.color_hex || '000000'))}
                    onChange={(e) => {
                      const v = e.target.value
                      setProjects((prev) => prev.map((x) => (x.slug === p.slug ? { ...x, color_hex: v } : x)))
                    }}
                    className="h-10 w-10 rounded-lg border border-white/10 bg-transparent"
                    aria-label={"Color " + p.slug}
                  />

                  <input
                    value={p.color_hex || ''}
                    onChange={(e) => {
                      const v = e.target.value
                      setProjects((prev) => prev.map((x) => (x.slug === p.slug ? { ...x, color_hex: v } : x)))
                    }}
                    className="w-[120px] px-3 py-2 rounded-xl border border-white/10 bg-black/20 font-mono text-xs"
                    placeholder="#RRGGBB"
                  />

                  <button
                    onClick={() => saveProjectColor(p.slug, p.color_hex)}
                    disabled={savingColors}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm"
                    title="Guardar"
                  >
                    {savingColors ? '…' : 'Guardar'}
                  </button>
                </div>
              ))}
            </div>
          </Card>


          <Card title="Logo" desc="Se guarda en data/branding/logo.png y se usa en cotizaciones.">
            <div className="space-y-3">
              <div className="text-sm opacity-80">Logo actual: {hasLogo ? 'Cargado' : 'No cargado'}</div>
              {hasLogo && (
                <img src={'/api/branding/logo?ts=' + Date.now()} alt="Logo" className="max-h-20 object-contain rounded-lg border border-white/10 bg-white/5 p-2" />
              )}
              <input type="file" accept="image/*" onChange={(e) => setLogoFile((e.target.files && e.target.files[0]) || null)} className="w-full text-sm" />
              <button onClick={saveBranding} disabled={saving} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm">
                {saving ? 'Guardando...' : 'Guardar Branding'}
              </button>
            </div>
          </Card>

          <Card title="Firma" desc="Imagen de firma para pie de cotización.">
            <div className="space-y-3">
              <div className="text-sm opacity-80">Firma actual: {hasSignature ? 'Cargada' : 'No cargada'}</div>
              {hasSignature && (
                <img src={'/api/branding/signature?ts=' + Date.now()} alt="Firma" className="max-h-16 object-contain rounded-lg border border-white/10 bg-white/5 p-2" />
              )}
              <input type="file" accept="image/*" onChange={(e) => setSignatureFile((e.target.files && e.target.files[0]) || null)} className="w-full text-sm" />
              <button onClick={saveBranding} disabled={saving} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm">
                {saving ? 'Guardando...' : 'Guardar Firma + Branding'}
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
