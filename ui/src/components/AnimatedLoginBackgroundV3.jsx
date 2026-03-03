import React from 'react'
import './AnimatedLoginBackgroundV3.css'

export default function AnimatedLoginBackgroundV3({ children, className = '' }) {
  return (
    <div className={`alb3-root ${className}`}>
      <div className="alb3-wave" aria-hidden />
      <div className="alb3-wave" aria-hidden />
      <div className="alb3-wave" aria-hidden />
      <div className="alb3-content">{children}</div>
    </div>
  )
}

