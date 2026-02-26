import React from 'react'
import { useTheme } from 'next-themes'

function Card({ title, desc, children }) {
  return (
    <div className="feego-card rounded-2xl p-4">
      <div className="font-extrabold">{title}</div>
      {desc && <div className="mt-1 text-sm opacity-70">{desc}</div>}
      <div className="mt-3">{children}</div>
    </div>
  )
}

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={
        "w-full flex items-center justify-between gap-3 rounded-xl px-3 py-3 border transition " +
        (checked ? "bg-indigo-600 text-white border-indigo-700" : "bg-white/60 border-black/10")
      }
    >
      <div className="text-sm font-bold">{label}</div>
      <div
        className={
          "h-6 w-11 rounded-full p-1 transition " +
          (checked ? "bg-white/25" : "bg-black/10")
        }
      >
        <div
          className={
            "h-4 w-4 rounded-full transition " +
            (checked ? "translate-x-5 bg-white" : "translate-x-0 bg-white")
          }
        />
      </div>
    </button>
  )
}

export default function SettingsPage() {
  const { theme, setTheme, systemTheme } = useTheme()
  const current = theme || 'light'
  const isDark = current === 'dark' || (current === 'system' && systemTheme === 'dark')

  return (
    <div className="p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="text-2xl font-black">Configuración</div>
            <div className="text-sm opacity-70">Preferencias del panel (estilo Pinterest en modo claro).</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Card
            title="Tema"
            desc="Modo claro por defecto. Puedes cambiar a oscuro cuando quieras."
          >
            <div className="grid grid-cols-1 gap-2">
              <Switch
                checked={current === 'light'}
                onChange={() => setTheme('light')}
                label="Claro (default)"
              />
              <Switch
                checked={current === 'dark'}
                onChange={() => setTheme('dark')}
                label="Oscuro"
              />
              <Switch
                checked={current === 'system'}
                onChange={() => setTheme('system')}
                label={"Sistema" + (systemTheme ? ` (actual: ${systemTheme})` : '')}
              />
            </div>
          </Card>

          <Card title="Empresa" desc="(Siguiente) Datos para encabezado y firma en cotizaciones.">
            <div className="text-sm opacity-70">Pendiente.</div>
          </Card>

          <Card title="Cotizaciones" desc="(Siguiente) Plantillas, impuestos, validez, condiciones.">
            <div className="text-sm opacity-70">Pendiente.</div>
          </Card>
        </div>
      </div>
    </div>
  )
}
