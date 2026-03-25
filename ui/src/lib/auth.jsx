import React from 'react'
import { api } from './api'

const AuthCtx = React.createContext(null)

export function AuthProvider({ children }) {
  const [loading, setLoading] = React.useState(true)
  const [user, setUser] = React.useState(null)

  async function refresh() {
    setLoading(true)
    const r = await api('/api/session')
    if (r.ok && r.data?.authenticated) {
      setUser({ username: r.data.username })
    } else {
      setUser(null)
    }
    setLoading(false)
  }

  async function login(username, password) {
    const r = await api('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (r.ok) await refresh()
    return r
  }

  async function logout() {
    await api('/api/logout', { method: 'POST' })
    await refresh()
  }

  React.useEffect(() => {
    refresh()
  }, [])

  return (
    <AuthCtx.Provider value={{ loading, user, refresh, login, logout }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  const v = React.useContext(AuthCtx)
  if (!v) throw new Error('useAuth must be used within AuthProvider')
  return v
}
