import React from 'react'
import './AnimatedLoginBackgroundV2.css'

export default function AnimatedLoginBackgroundV2({ children, className = '' }) {
  return (
    <div className={`alb2-root ${className}`}>
      <div className="alb2-overlay" aria-hidden />
      <div className="alb2-content">{children}</div>
    </div>
  )
}

