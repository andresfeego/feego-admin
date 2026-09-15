import React from 'react'
import { CircleDashed, LoaderCircle, CircleCheck } from 'lucide-react'
import './TaskStatus.scss'

const states = {
  todo: { label: 'Pendiente', Icon: CircleDashed },
  doing: { label: 'En proceso', Icon: LoaderCircle },
  done: { label: 'Completada', Icon: CircleCheck },
}
export default function TaskStatus({ state }) {
  const { label, Icon } = states[state] || states.todo
  return <span className="feego-task-status" data-status={state}><Icon size={14} aria-hidden="true" />{label}</span>
}
