import React from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, NotebookPen, CloudUpload, Map, Columns3, FileText, Settings2, PanelLeftClose, PanelLeftOpen, LogOut, Layers3 } from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import './AppSidebar.scss'

const navigation = [
  { to: '/roadmap', label: 'Roadmap', Icon: Map },
  { to: '/kanban', label: 'Kanban', Icon: Columns3 },
  { to: '/dashboard', label: 'Dashboard VPS', Icon: LayoutDashboard },
  { to: '/diario', label: 'Diario', Icon: NotebookPen },
  { to: '/uploads', label: 'Uploads', Icon: CloudUpload },
  { to: '/quotes', label: 'Cotizaciones', Icon: FileText },
  { to: '/settings', label: 'Configuración', Icon: Settings2 },
]
export function NavigationItems({ collapsed = false, onNavigate, id }) {
  return <nav id={id} className="admin-navigation" aria-label="Menú principal">{navigation.map(({ to, label, Icon }) => <NavLink key={to} to={to} end onClick={onNavigate} aria-label={label} title={collapsed ? label : undefined} className={({ isActive }) => `admin-nav-item${isActive ? ' is-active' : ''}`}><Icon size={19} strokeWidth={1.8} aria-hidden="true" />{!collapsed && <span>{label}</span>}</NavLink>)}</nav>
}
export default function AppSidebar() {
  const { user, logout } = useAuth()
  const [collapsed, setCollapsed] = React.useState(() => { try { return localStorage.getItem('feego.sidebar.collapsed') === 'true' } catch { return false } })
  function toggle() { setCollapsed(value => { const next = !value; try { localStorage.setItem('feego.sidebar.collapsed', String(next)) } catch {} return next }) }
  return <div className={`admin-sidebar-slot${collapsed ? ' is-collapsed' : ''}`}><aside className={`feego-sidebar admin-sidebar${collapsed ? ' is-collapsed' : ''}`} aria-label="Barra lateral">
    <div className="admin-sidebar-brand"><span className="admin-brand-mark"><Layers3 size={22} /></span>{!collapsed && <div><strong>Feego<span>Admin</span></strong><small>Espacio de trabajo</small></div>}</div>
    <div className="admin-sidebar-section">{!collapsed && <span>Navegación</span>}</div><button type="button" className="admin-sidebar-toggle" onClick={toggle} aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'} title={collapsed ? 'Expandir menú' : 'Colapsar menú'} aria-expanded={!collapsed} aria-controls="desktop-navigation">{collapsed ? <PanelLeftOpen size={21.6} /> : <PanelLeftClose size={21.6} />}</button>
    <NavigationItems collapsed={collapsed} id="desktop-navigation" />
    {user && <footer className="admin-sidebar-account"><div className="admin-account-identity" title={collapsed ? user.username : undefined}><span className="admin-user-avatar">{user.username?.slice(0, 2).toUpperCase()}</span>{!collapsed && <div><strong>{user.username}</strong><small>Sesión activa</small></div>}</div><button type="button" className="admin-logout" onClick={logout} aria-label="Salir" title={collapsed ? 'Salir' : undefined}><LogOut size={18} />{!collapsed && <span>Salir</span>}</button></footer>}
  </aside></div>
}
