import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Card, Button, Input } from '../components/ui.jsx'

export default function LoginPage() {
  const { user, login } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const from = loc.state?.from || '/dashboard'

  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [msg, setMsg] = React.useState('')

  React.useEffect(() => {
    if (user) nav(from, { replace: true })
  }, [user])

  async function onSubmit(e) {
    e.preventDefault()
    setMsg('')
    const r = await login(username.trim(), password)
    if (!r.ok) setMsg('Usuario o clave incorrectos')
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-[92vw] max-w-md">
        <Card className="p-5">
          <div className="text-xl font-black">Iniciar sesión</div>
          <div className="text-xs feego-muted mt-1">Feego Admin</div>

          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <Input placeholder="Usuario" value={username} onChange={(e) => setUsername(e.target.value)} />
            <Input placeholder="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {msg && <div className="text-sm text-red-600">{msg}</div>}
            <Button className="w-full" type="submit">Entrar</Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
