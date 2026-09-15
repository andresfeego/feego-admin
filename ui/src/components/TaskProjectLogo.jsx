import React from 'react'
import { Folder } from 'lucide-react'
export default function TaskProjectLogo({ project }) {
  const [failed, setFailed] = React.useState(false)
  React.useEffect(() => setFailed(false), [project.logo_path])
  return project.logo_path && !failed
    ? <img src={`/api/kanban/project/logo?name=${encodeURIComponent(project.logo_path)}`} alt="" onError={() => setFailed(true)} />
    : <Folder size={21} />
}
