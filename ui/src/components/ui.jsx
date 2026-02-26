import React from 'react'

export function Card({ className = '', children }) {
  return <div className={`feego-card rounded-2xl p-4 ${className}`}>{children}</div>
}

export function Button({ variant = 'primary', className = '', ...props }) {
  const base = 'feego-btn inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-extrabold transition'
  const v = variant === 'ghost'
    ? 'feego-btn-ghost'
    : variant === 'outline'
      ? 'feego-btn-outline'
      : 'feego-btn-primary'
  return <button className={`${base} ${v} ${className}`} {...props} />
}

export function Input({ className = '', ...props }) {
  return <input className={`feego-input w-full px-3 py-2 rounded-xl text-sm ${className}`} {...props} />
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={`feego-input w-full px-3 py-2 rounded-xl text-sm ${className}`} {...props} />
}

export function SectionTitle({ title, subtitle }) {
  return (
    <div>
      <div className="text-2xl font-black tracking-tight">{title}</div>
      {subtitle ? <div className="mt-1 text-sm feego-muted">{subtitle}</div> : null}
    </div>
  )
}
