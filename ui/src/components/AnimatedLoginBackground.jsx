import React from 'react'
import './AnimatedLoginBackground.css'

export default function AnimatedLoginBackground({ children, className = '' }) {
  return (
    <div className={`alb-root ${className}`}>
      <div aria-hidden className="alb-base-gradient" />
      <div aria-hidden className="alb-blob alb-blob-a" />
      <div aria-hidden className="alb-blob alb-blob-b" />
      <div aria-hidden className="alb-blob alb-blob-c" />
      <div aria-hidden className="alb-noise" />
      <div className="alb-content">{children}</div>
    </div>
  )
}
