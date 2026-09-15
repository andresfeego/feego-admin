import React from 'react'

export default function OperationsHeader({ icon: Icon, eyebrow, title, description, children }) {
  return <header className="ops-header"><div className="ops-heading"><span className="ops-heading-icon"><Icon size={23} strokeWidth={1.8} /></span><div><div className="ops-eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div></div><div className="ops-header-actions">{children}</div></header>
}
