import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Settings, Building2, FileText, Image, PenLine, Upload, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Input, Textarea } from './ui'
import './QuoteSettingsDialog.scss'
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

async function request(url, options) {
  const r = await fetch(url, { credentials: 'include', ...options })
  if (!r.ok) throw new Error('No se pudo guardar. Revisa la conexión e intenta de nuevo.')
  return r.json()
}
function AssetPicker({ kind, label, exists, file, onPick, version }) {
  const [preview, setPreview] = React.useState('')
  React.useEffect(() => { if (!file) { setPreview(''); return } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url) }, [file])
  const src = preview || (exists ? `/api/branding/${kind}?v=${version}` : '')
  return <div className="quote-settings-asset"><div className="quote-settings-preview">{src ? <img src={src} alt={label} /> : <Image size={30} />}</div><div><strong>{label}</strong><p>{file ? file.name : exists ? 'Imagen actual' : 'Sin imagen'}</p><label className="quote-settings-upload"><Upload size={15} />{src ? 'Cambiar imagen' : 'Subir imagen'}<input type="file" accept="image/*" aria-label={`Subir ${label.toLowerCase()}`} onChange={e => { onPick(e.target.files?.[0] || null); e.target.value = '' }} /></label></div></div>
}
export default function QuoteSettingsDialog({ open, onOpenChange }) {
  const [branding, setBranding] = React.useState(emptyBranding)
  const [assets, setAssets] = React.useState({})
  const [logo, setLogo] = React.useState(null)
  const [signature, setSignature] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')
  const [version, setVersion] = React.useState(0)
  const [loaded, setLoaded] = React.useState(false)
  React.useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true); setLoaded(false); setError(''); setLogo(null); setSignature(null)
    request('/api/branding').then(r => { if (active) { setBranding({ ...emptyBranding, ...r.branding }); setAssets(r); setVersion(Date.now()); setLoaded(true) } }).catch(() => { if(active)setError('No se pudo cargar la configuración. Cierra y vuelve a abrir para reintentar.') }).finally(() => { if(active)setLoading(false) })
    return () => { active = false }
  }, [open])
  function field(key, label, { type = 'text', wide = false, multiline = false } = {}) {
    const Component = multiline ? Textarea : Input
    return <label className={wide ? 'quote-settings-wide' : ''} key={key} htmlFor={`quote-brand-${key}`}><span>{label}</span><Component id={`quote-brand-${key}`} type={multiline ? undefined : type} rows={multiline ? 2 : undefined} min={type === 'number' ? 0 : undefined} step={type === 'number' ? 1 : undefined} value={branding[key] ?? ''} onChange={e => setBranding(v => ({ ...v, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))} /></label>
  }
  async function save(e) {
    e.preventDefault(); if(saving || !loaded)return
    if (!/^#[0-9a-f]{6}$/i.test(branding.accentColor)) { setError('El color debe tener formato #RRGGBB.'); return }
    setSaving(true); setError('')
    try {
      await request('/api/branding', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(branding) })
      for(const [kind,file] of [['logo',logo],['signature',signature]]) if(file) { const body = new FormData(); body.append(kind,file); await request(`/api/branding/${kind}`,{method:'POST',body}) }
      toast.success('Configuración de cotizaciones guardada'); onOpenChange(false)
    } catch(e) { setError(`${e.message} Algunos cambios pueden haberse guardado.`) }
    finally { setSaving(false) }
  }
  return <Dialog.Root open={open} onOpenChange={v => { if(!saving)onOpenChange(v) }}><Dialog.Portal><Dialog.Overlay className="feego-overlay quote-settings-overlay" /><Dialog.Content className="feego-modal quote-settings-modal">
    <form onSubmit={save}><header className="quote-settings-header"><span className="quote-settings-emblem"><Settings size={24} /></span><div><Dialog.Title>Configuración de cotizaciones</Dialog.Title><Dialog.Description>Datos e imágenes para los PDF de cotizaciones.</Dialog.Description></div><Dialog.Close asChild><Button type="button" variant="ghost" disabled={saving} aria-label="Cerrar configuración"><X size={19} /></Button></Dialog.Close></header>
    <div className="quote-settings-body">{loading ? <p role="status">Cargando configuración…</p> : loaded && <fieldset disabled={saving}>
      <section><h3><Building2 size={18} />Branding <span>Datos de empresa</span></h3><div className="quote-settings-grid">{field('companyName','Nombre comercial')}{field('legalName','Razón social')}{field('nit','NIT')}{field('phone','Teléfono',{type:'tel'})}{field('email','Correo electrónico',{type:'email'})}{field('website','Sitio web')}{field('address','Dirección',{wide:true})}</div></section>
      <section><h3><FileText size={18} />Documento</h3><div className="quote-settings-grid">{field('quoteTitle','Título del PDF')}{field('validityDays','Validez (días)',{type:'number'})}<label className="quote-settings-wide"><span>Color de énfasis</span><div className="quote-settings-color"><input type="color" aria-label="Elegir color de énfasis" value={/^#[0-9a-f]{6}$/i.test(branding.accentColor) ? branding.accentColor : '#1f4db6'} onChange={e => setBranding(v => ({...v,accentColor:e.target.value}))} /><Input aria-label="Código de color" value={branding.accentColor} onChange={e => setBranding(v => ({...v,accentColor:e.target.value}))} /></div></label>{field('paymentTerms','Condiciones de pago',{multiline:true,wide:true})}{field('warrantyParagraph','Garantía',{multiline:true,wide:true})}{field('notesFooter','Mensaje final',{multiline:true,wide:true})}</div></section>
      <section><h3><Image size={18} />Logo</h3><AssetPicker kind="logo" label="Logo" exists={assets.hasLogo} file={logo} onPick={setLogo} version={version} /></section>
      <section><h3><PenLine size={18} />Firma</h3><div className="quote-settings-grid">{field('signerName','Nombre de quien firma')}{field('signerRole','Cargo')}</div><AssetPicker kind="signature" label="Firma" exists={assets.hasSignature} file={signature} onPick={setSignature} version={version} /></section>
    </fieldset>}{error && <p role="alert" className="quote-settings-error">{error}</p>}</div>
    <footer className="quote-settings-footer"><Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={loading || saving || !loaded}><Check size={17} />{saving ? 'Guardando…' : 'Guardar configuración'}</Button></footer></form>
  </Dialog.Content></Dialog.Portal></Dialog.Root>
}
