import React from 'react'
import { Settings2, Sun, Moon, Monitor, Check, Palette } from 'lucide-react'
import { useTheme } from '../lib/theme-provider.jsx'
import OperationsHeader from '../components/OperationsHeader'
import './AdminPages.scss'

const themes = [
  { value: 'light', name: 'Claro', description: 'Superficies claras y alto contraste.', Icon: Sun },
  { value: 'dark', name: 'Oscuro', description: 'Fondos oscuros para trabajar con poca luz.', Icon: Moon },
  { value: 'system', name: 'Sistema', description: 'Sigue la apariencia de tu dispositivo.', Icon: Monitor },
]
export default function SettingsPage() {
  const { theme, setTheme, systemTheme } = useTheme()
  return <div className="ops-page settings-page">
    <OperationsHeader icon={Settings2} eyebrow="PREFERENCIAS" title="Configuración" description="Personaliza tu espacio de trabajo." />
    <section className="settings-appearance">
      <div className="settings-section-heading"><span className="ops-section-label"><Palette size={19} />Apariencia</span><span className="ops-muted">Tema de la interfaz</span></div>
      <div className="theme-options" role="group" aria-label="Tema de la interfaz">{themes.map(({ value, name, description, Icon }) => <button key={value} type="button" className={`theme-option${(theme || 'light') === value ? ' is-selected' : ''}`} aria-pressed={(theme || 'light') === value} onClick={() => setTheme(value)}>
        <div className={`theme-preview theme-preview--${value}`} aria-hidden="true"><div className="theme-preview-nav"><i /><i /><i /></div><div className="theme-preview-content"><i /><div><i /><i /></div><i /></div></div>
        <div className="theme-option-title"><Icon size={18} /><strong>{name}</strong>{(theme || 'light') === value && <Check size={17} />}</div><p>{description}</p>
      </button>)}</div>
      <p className="settings-theme-status" role="status"><Check size={14} />Se aplica al instante{theme === 'system' ? ` · Sistema en modo ${systemTheme === 'dark' ? 'oscuro' : 'claro'}` : ''}</p>
    </section>
  </div>
}
