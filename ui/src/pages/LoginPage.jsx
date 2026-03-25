import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Card, Button, Input } from '../components/ui.jsx'
import AnimatedLoginBackgroundV3 from '../components/AnimatedLoginBackgroundV3.jsx'
import { api } from '../lib/api.js'

export default function LoginPage() {
  const { user, login, refresh } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const from = loc.state?.from || '/dashboard'

  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [msg, setMsg] = React.useState('')

  const [mustChange, setMustChange] = React.useState(false)
  const [newPassword, setNewPassword] = React.useState('')

  const formRef = React.useRef(null)

  React.useEffect(() => {
    if (user && !user.mustChange) nav(from, { replace: true })
    if (user && user.mustChange) setMustChange(true)
  }, [user])

  async function onSubmit(e) {
    e.preventDefault()
    setMsg('')
    const r = await login(username.trim(), password)
    if (!r.ok) {
      setMsg('Usuario o clave incorrectos')
      return
    }
    if (r.data?.mustChange) {
      setMustChange(true)
      setMsg('Estás usando una contraseña temporal. Debes cambiarla.')
    }
  }

  async function onChangePassword(e) {
    e.preventDefault()
    setMsg('')
    if (newPassword.trim().length < 10) {
      setMsg('La nueva contraseña debe tener al menos 10 caracteres')
      return
    }
    const r = await api('/api/account/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: newPassword.trim() }),
    })
    if (!r.ok) {
      setMsg('No se pudo cambiar la contraseña')
      return
    }
    await refresh()
    nav(from, { replace: true })
  }

  function onEnterSubmit(e) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    formRef.current?.requestSubmit()
  }

  return (
    <AnimatedLoginBackgroundV3>
      <div className="relative z-10 w-[92vw] max-w-md">
        <Card className="p-5 md:p-6 bg-white/70 backdrop-blur-[3px]">
          <div className="mb-4 flex items-center justify-center">
            <img
              src="/api/public/branding/logo"
              alt="Feego"
              className="max-h-16 w-auto object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          </div>
          <div className="text-xl font-black text-center">Iniciar sesión</div>
          <div className="text-xs feego-muted mt-1 text-center">Feego Admin</div>

          {!mustChange ? (
            <form ref={formRef} onSubmit={onSubmit} className="mt-4 space-y-3">
              <Input placeholder="Usuario" value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={onEnterSubmit} />
              <Input placeholder="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={onEnterSubmit} />
              {msg && <div className="text-sm text-red-600">{msg}</div>}
              <Button className="w-full" type="submit">Entrar</Button>
            </form>
          ) : (
            <form onSubmit={onChangePassword} className="mt-4 space-y-3">
              <div className="text-sm text-slate-700">Estás usando una contraseña temporal. Debes cambiarla.</div>
              <Input placeholder="Nueva contraseña" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              {msg && <div className="text-sm text-red-600">{msg}</div>}
              <Button className="w-full" type="submit">Guardar nueva contraseña</Button>
            </form>
          )}
        </Card>
      </div>
    </AnimatedLoginBackgroundV3>
  )
}
