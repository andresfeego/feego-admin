import React from 'react'
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './lib/auth.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import LoginPage from './pages/LoginPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import UploadsPage from './pages/UploadsPage.jsx'
import KanbanPage from './pages/KanbanPage.jsx'
import MarketingPage from './pages/MarketingPage.jsx'
import QuotesPage from './pages/QuotesPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'

function Sidebar() {
  const loc = useLocation()
  const { user, logout } = useAuth()
  const active = (p) => (loc.pathname === p ? 'feego-nav-active' : 'border-transparent')

  return (
    <aside className="feego-sidebar w-64 shrink-0 border-r border-white/10 bg-white/5 backdrop-blur-xl p-4 hidden md:block">
      <div className="font-extrabold tracking-wide mb-4">Feego Admin</div>
      {user ? (
        <div className="rounded-xl border border-white/10 bg-black/20 p-3 mb-4">
          <div className="text-xs text-slate-400">Sesión</div>
          <div className="font-bold">{user.username}</div>
          <button onClick={logout} className="mt-3 w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10">
            Salir
          </button>
        </div>
      ) : (
        <div className="text-xs text-slate-400 mb-4">No autenticado</div>
      )}

      <div className="text-xs text-slate-400 mb-3">Menú</div>
      <nav className="space-y-2">
        <Link className={`block rounded-lg px-3 py-2 border ${active('/dashboard')}`} to="/dashboard">Dashboard</Link>
        <Link className={`block rounded-lg px-3 py-2 border ${active('/uploads')}`} to="/uploads">Uploads</Link>
        <Link className={`block rounded-lg px-3 py-2 border ${active('/kanban')}`} to="/kanban">Kanban</Link>
        <Link className={`block rounded-lg px-3 py-2 border ${active('/site')}`} to="/site">Sitio (FeegoSystem)</Link>
        <Link className={`block rounded-lg px-3 py-2 border ${active('/quotes')}`} to="/quotes">Cotizaciones</Link>
        <Link className={`block rounded-lg px-3 py-2 border ${active('/settings')}`} to="/settings">Configuración</Link>
      </nav>
    </aside>
  )
}

function MobileHeader() {
  const [open, setOpen] = React.useState(false)
  const { user, logout } = useAuth()
  return (
    <>
      <div className="feego-mobile-header md:hidden fixed top-0 left-0 right-0 h-14 z-50 flex items-center gap-3 px-3 bg-gradient-to-r from-slate-950 to-slate-900 border-b border-white/10">
        <button onClick={() => setOpen(true)} className="text-2xl leading-none">☰</button>
        <div className="font-bold">Feego Admin</div>
      </div>
      {open && (
        <>
          <div onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/50" />
          <div className="feego-mobile-drawer fixed z-50 top-14 left-0 w-72 h-[calc(100vh-3.5rem)] bg-slate-950/80 backdrop-blur-xl border-r border-white/10 p-4">
            {user && (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3 mb-4">
                <div className="text-xs text-slate-400">Sesión</div>
                <div className="font-bold">{user.username}</div>
                <button onClick={() => { logout(); setOpen(false) }} className="mt-3 w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10">
                  Salir
                </button>
              </div>
            )}

            <div className="text-xs text-slate-400 mb-3">Menú</div>
            <nav className="space-y-2">
              <Link onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 border border-white/10 bg-white/5" to="/dashboard">Dashboard</Link>
              <Link onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 border border-white/10 bg-white/5" to="/uploads">Uploads</Link>
              <Link onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 border border-white/10 bg-white/5" to="/kanban">Kanban</Link>
              <Link onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 border border-white/10 bg-white/5" to="/site">Sitio (FeegoSystem)</Link>
              <Link onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 border border-white/10 bg-white/5" to="/quotes">Cotizaciones</Link>
              <Link onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 border border-white/10 bg-white/5" to="/settings">Configuración</Link>
            </nav>
          </div>
        </>
      )}
    </>
  )
}

function Layout() {
  const { loading, user } = useAuth()

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const origFetch = window.fetch.bind(window)
    window.fetch = async (...args) => {
      const res = await origFetch(...args)
      try {
        const input = args[0]
        const url = typeof input === 'string'
          ? input
          : (input && typeof input.url === 'string' ? input.url : '')
        const isApi = url.startsWith('/api/') || url.includes('/api/')
        if (res.status === 401 && isApi && window.location.pathname !== '/login') {
          window.location.assign('/login')
        }
      } catch {}
      return res
    }
    return () => {
      window.fetch = origFetch
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-slate-400">
        Cargando...
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <main className="min-h-screen max-w-full overflow-x-hidden">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <MobileHeader />
      <div className="flex min-h-screen md:pt-0 pt-14">
        <Sidebar />
        <main className="flex-1 p-4 md:p-6 lg:p-8 2xl:p-12 max-w-full overflow-x-hidden">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Navigate to="/dashboard" replace />} />
            <Route path="/site" element={<RequireAuth><MarketingPage /></RequireAuth>} />
            <Route path="/quotes" element={<RequireAuth><QuotesPage /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />

            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <DashboardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/uploads"
              element={
                <RequireAuth>
                  <UploadsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/kanban"
              element={
                <RequireAuth>
                  <KanbanPage />
                </RequireAuth>
              }
            />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Layout />
      <Toaster position="bottom-center" />
    </AuthProvider>
  )
}
