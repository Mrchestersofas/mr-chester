import { OrderStatus, Priority } from '@/lib/supabase'

const statusConfig: Record<OrderStatus, { label: string; className: string }> = {
  pendiente:       { label: 'Pendiente',       className: 'badge-pending' },
  estructura:      { label: 'Estructura',      className: 'bg-amber-50 text-amber-700' },
  tapizado:        { label: 'Tapizado',        className: 'bg-blue-50 text-blue-700' },
  costura:         { label: 'Costura',         className: 'bg-purple-50 text-purple-700' },
  control_calidad: { label: 'Control calidad', className: 'bg-indigo-50 text-indigo-700' },
  listo:           { label: 'Listo',           className: 'badge-ready' },
  entregado:       { label: 'Entregado',       className: 'bg-gray-100 text-gray-500' },
}

const priorityConfig: Record<Priority, { label: string; className: string }> = {
  normal:  { label: 'Normal',  className: 'badge-pending' },
  alta:    { label: 'Alta',    className: 'badge-warning' },
  urgente: { label: 'Urgente', className: 'badge-urgent' },
}

export function EstadoBadge({ estado }: { estado: OrderStatus }) {
  const config = statusConfig[estado] ?? statusConfig.pendiente
  return <span className={`badge ${config.className}`}>{config.label}</span>
}

export function PrioridadBadge({ prioridad }: { prioridad: Priority }) {
  const config = priorityConfig[prioridad] ?? priorityConfig.normal
  return <span className={`badge ${config.className}`}>{config.label}</span>
}
