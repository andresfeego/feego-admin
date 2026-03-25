import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function RequireAuth({ children }) {
  const { loading, user } = useAuth()
  const loc = useLocation()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />

  if (user.mustChange && loc.pathname !== '/login') {
    return <Navigate to="/login" replace />
  }

  return children
}
