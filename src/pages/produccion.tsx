import { useEffect, useState } from 'react'
import { supabase, Pedido, OrderStatus } from '@/lib/supabase'
import { EstadoBadge, PrioridadBadge } from '@/components/Badges'
import { format, parseISO, differenceInDays } from 'date-fns'

const ETAPAS: { value: OrderStatus; label: string; color: string }[] = [
  { value: 'pendiente',       label: 'Pendiente',      color: 'bg-gray-100' },
  { value: 'estructura',      label: 'Estructura',     color: 'bg-amber-100' },
  { value: 'tapizado',        label: 'Tapizado',       color: 'bg-blue-100' },
  { value: 'costura',         label: 'Costura',        color: 'bg-purple-100' },
  { value: 'control_calidad', label: 'Control calidad',color: 'bg-indigo-100' },
  { value: 'listo',           label: 'Listo',          color: 'bg-green-100' },
]

export default function Produccion() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)

  async function cargar() {
    const { data } = await supabase
      .from('pedidos')
      .select('*, cliente:clientes(*)')
      .not('estado', 'eq', 'entregado')
      .order('fecha_entrega', { ascending: true })
    setPedidos(data || [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  async function avanzarEtapa(pedido: Pedido) {
    const orden: OrderStatus[] = ['pendiente','estructura','tapizado','costura','control_calidad','listo','entregado']
    const idx = orden.indexOf(pedido.estado)
    if (idx < orden.length - 1) {
      await supabase.from('pedidos').update({ estado: orden[idx + 1] }).eq('id', pedido.id)
      cargar()
    }
  }

  // Agrupa pedidos por etapa
  const porEtapa = ETAPAS.map(etapa => ({
    ...etapa,
    pedidos: pedidos.filter(p => p.estado === etapa.value)
  }))

  const diasRestantes = (fecha: string) => differenceInDays(parseISO(fecha), new Date())

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium">Programación de producción</h1>
          <p className="text-sm text-gray-400">{pedidos.length} pedidos activos</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : (
        <>
          {/* Kanban por etapa */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            {porEtapa.map(etapa => (
              <div key={etapa.value}>
                <div className={`rounded-lg px-3 py-2 mb-2 ${etapa.color}`}>
                  <p className="text-xs font-medium text-gray-700">{etapa.label}</p>
                  <p className="text-xl font-medium">{etapa.pedidos.length}</p>
                </div>
                <div className="space-y-2">
                  {etapa.pedidos.map(p => {
                    const dias = diasRestantes(p.fecha_entrega)
                    return (
                      <div key={p.id} className="card p-3 text-xs space-y-1">
                        <p className="font-medium text-purple-700">{p.numero}</p>
                        <p className="text-gray-600 truncate">{p.tipo_sofa}</p>
                        <p className="text-gray-400">{(p.cliente as any)?.nombre}</p>
                        <p className={`font-medium ${dias <= 2 ? 'text-red-600' : dias <= 5 ? 'text-amber-600' : 'text-gray-500'}`}>
                          {dias < 0 ? '⚠ Vencido' : dias === 0 ? 'Entrega hoy' : `${dias} días`}
                        </p>
                        {etapa.value !== 'listo' && (
                          <button
                            className="btn text-xs py-0.5 px-2 w-full justify-center mt-1"
                            onClick={() => avanzarEtapa(p)}
                          >
                            Avanzar →
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Tabla con todos los pedidos ordenados por fecha */}
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-medium">Orden de producción — por fecha de entrega</h2>
            </div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Producto</th>
                  <th>Material</th>
                  <th>Etapa actual</th>
                  <th>Prioridad</th>
                  <th>Fecha entrega</th>
                  <th>Días restantes</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p, i) => {
                  const dias = diasRestantes(p.fecha_entrega)
                  return (
                    <tr key={p.id}>
                      <td className="text-gray-400 text-xs">{i + 1}</td>
                      <td className="font-medium text-purple-700">{p.numero}</td>
                      <td>{(p.cliente as any)?.nombre || '—'}</td>
                      <td>{p.tipo_sofa}</td>
                      <td className="text-gray-400">{p.material} / {p.color}</td>
                      <td><EstadoBadge estado={p.estado} /></td>
                      <td><PrioridadBadge prioridad={p.prioridad} /></td>
                      <td>{format(parseISO(p.fecha_entrega), 'dd/MM/yyyy')}</td>
                      <td>
                        <span className={`text-sm font-medium ${dias < 0 ? 'text-red-600' : dias <= 3 ? 'text-amber-600' : 'text-gray-600'}`}>
                          {dias < 0 ? `${Math.abs(dias)} días vencido` : dias === 0 ? 'Hoy' : `${dias} días`}
                        </span>
                      </td>
                      <td>
                        {p.estado !== 'listo' && p.estado !== 'entregado' && (
                          <button className="btn text-xs py-1 px-3" onClick={() => avanzarEtapa(p)}>
                            Avanzar etapa →
                          </button>
                        )}
                        {p.estado === 'listo' && (
                          <button className="btn btn-primary text-xs py-1 px-3" onClick={() => avanzarEtapa(p)}>
                            Marcar entregado ✓
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
