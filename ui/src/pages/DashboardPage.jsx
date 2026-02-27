import React from 'react'
import { api } from '../lib/api'

import { Card } from '../components/ui.jsx'

function Tile({ title, value }) {
  return (
    <Card className="p-4 transition-all duration-200 ease-out hover:shadow-lg">
      <div className="text-xs leading-4 feego-muted">{title}</div>
      <div className="mt-2 text-2xl leading-8 font-bold">{value}</div>
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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[32px] leading-[40px] font-bold">Dashboard</div>
          <div className="text-sm leading-5 text-slate-400">Estado del servidor</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <Tile title="Servidor" value={st ? (st.hostname + ' · ' + st.uptime) : '…'} />
        <Tile title="Memoria" value={st ? st.mem : '…'} />
        <Tile title="Carga" value={st ? st.load : '…'} />
      </div>
    </div>
  )
}
