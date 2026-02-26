import React from 'react'
import { api } from '../lib/api'

import { Card } from '../components/ui.jsx'

function Tile({ title, value }) {
  return (
    <Card className="p-4">
      <div className="text-xs feego-muted">{title}</div>
      <div className="mt-1 font-extrabold">{value}</div>
    </Card>
  )
}

export default function DashboardPage() {
  const [st, setSt] = React.useState(null)

  React.useEffect(() => {
    ;(async () => {
      const r = await api('/api/status')
      if (r.ok) setSt(r.data)
    })()
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xl font-black">Dashboard</div>
          <div className="text-xs text-slate-400">Estado del servidor</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Tile title="Servidor" value={st ? (st.hostname + ' · ' + st.uptime) : '…'} />
        <Tile title="Memoria" value={st ? st.mem : '…'} />
        <Tile title="Carga" value={st ? st.load : '…'} />
      </div>
    </div>
  )
}
