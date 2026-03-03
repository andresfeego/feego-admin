import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Card, Button, Input } from '../components/ui.jsx'
import AnimatedLoginBackgroundV3 from '../components/AnimatedLoginBackgroundV3.jsx'

export default function LoginPage() {
  const { user, login } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const from = loc.state?.from || '/dashboard'

  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [msg, setMsg] = React.useState('')
  const formRef = React.useRef(null)

  React.useEffect(() => {
    if (user) nav(from, { replace: true })
  }, [user])

  async function onSubmit(e) {
    e.preventDefault()
    setMsg('')
    const r = await login(username.trim(), password)
    if (!r.ok) setMsg('Usuario o clave incorrectos')
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

          <form ref={formRef} onSubmit={onSubmit} className="mt-4 space-y-3">
            <Input
              placeholder="Usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={onEnterSubmit}
            />
            <Input
              placeholder="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={onEnterSubmit}
            />
            {msg && <div className="text-sm text-red-600">{msg}</div>}
            <Button className="w-full" type="submit">Entrar</Button>
          </form>
        </Card>
      </div>
    </AnimatedLoginBackgroundV3>
  )
}
