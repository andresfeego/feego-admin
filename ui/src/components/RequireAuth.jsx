import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function RequireAuth({ children }) {
  const { loading, user } = useAuth()
  const loc = useLocation()

  if (loading) {
    return <div className="text-sm text-slate-400">Cargando…</div>
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  }

  return children
}
