import { useEffect, useState } from 'react'
import { supabase, Pedido, OrderStatus } from '@/lib/supabase'
import { EstadoBadge, PrioridadBadge } from '@/components/Badges'
import Link from 'next/link'
import { Plus, Search, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'

const ESTADOS: { value: string; label: string }[] = [
  { value: '',               label: 'Todos los estados' },
  { value: 'pendiente',      label: 'Pendiente' },
  { value: 'estructura',     label: 'Estructura' },
  { value: 'tapizado',       label: 'Tapizado' },
  { value: 'costura',        label: 'Costura' },
  { value: 'control_calidad',label: 'Control calidad' },
  { value: 'listo',          label: 'Listo' },
  { value: 'entregado',      label: 'Entregado' },
]

function semaforo(fechaEntrega: string, estado: string) {
  if (estado === 'entregado') return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const entrega = new Date(fechaEntrega); entrega.setHours(0, 0, 0, 0)
  const dias = Math.ceil((entrega.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  if (dias < 0) return { color: '#ef4444', titulo: `Vencido hace ${Math.abs(dias)} día(s)` }
  if (dias <= 3) return { color: '#f59e0b', titulo: `Vence en ${dias} día(s)` }
  return { color: '#22c55e', titulo: `${dias} día(s) restantes` }
}

export default function Pedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [eliminando, setEliminando] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState<Pedido | null>(null)

  async function cargar() {
    setLoading(true)
    let q = supabase
      .from('pedidos')
      .select('*, cliente:clientes(*)')
      .order('fecha_entrega', { ascending: true })
    if (filtroEstado) q = q.eq('estado', filtroEstado)
    const { data } = await q
    setPedidos(data || [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [filtroEstado])

  const filtrados = pedidos.filter(p =>
    p.numero.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.tipo_sofa.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.cliente as any)?.nombre?.toLowerCase().includes(busqueda.toLowerCase())
  )

  async function cambiarEstado(id: string, nuevoEstado: OrderStatus) {
    await supabase.from('pedidos').update({ estado: nuevoEstado }).eq('id', id)
    cargar()
  }

  async function eliminarPedido(pedido: Pedido) {
    setEliminando(pedido.id)
    try {
      // Borrar programación asociada primero (si existe)
      await supabase.from('programacion_produccion').delete().eq('pedido_id', pedido.id)
    } catch (e) {
      // ignorar si no hay programación
    }
    try {
      await supabase.from('pedidos').delete().eq('id', pedido.id)
    } catch (e) {
      console.error('Error eliminando pedido:', e)
    }
    setEliminando(null)
    setConfirmar(null)
    cargar()
  }
    setEliminando(pedido.id)
    // Borrar programación asociada primero
    await supabase.from('programacion_produccion').delete().eq('pedido_id', pedido.id)
    // Borrar el pedido
    await supabase.from('pedidos').delete().eq('id', pedido.id)
    setEliminando(null)
    setConfirmar(null)
    cargar()
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Modal de confirmación */}
      {confirmar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setConfirmar(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 rounded-full p-2">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <h3 className="font-semibold text-gray-800">¿Eliminar pedido?</h3>
            </div>
            <p className="text-sm text-gray-600 mb-1">
              Vas a eliminar el pedido <b className="text-purple-700">{confirmar.numero}</b> — {confirmar.tipo_sofa}
            </p>
            <p className="text-xs text-gray-400 mb-6">
              Esto también borrará su programación de producción. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmar(null)}
                className="btn flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={() => eliminarPedido(confirmar)}
                disabled={eliminando === confirmar.id}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {eliminando === confirmar.id ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium">Pedidos</h1>
        <Link href="/pedidos/nuevo" className="btn btn-primary">
          <Plus size={15} /> Nuevo pedido
        </Link>
      </div>

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por número, producto o cliente..."
            className="pl-9"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          className="w-48"
        >
          {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-gray-400 text-center">Cargando...</p>
        ) : filtrados.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-400 mb-3">No hay pedidos con ese criterio.</p>
            <Link href="/pedidos/nuevo" className="btn btn-primary">
              <Plus size={14} /> Crear primer pedido
            </Link>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Producto</th>
                <th>Material / Color</th>
                <th>Entrega</th>
                <th>Prioridad</th>
                <th>Estado</th>
                <th>Precio</th>
                <th>Avanzar etapa</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(p => {
                const s = semaforo(p.fecha_entrega, p.estado)
                return (
                  <tr key={p.id}>
                    <td><span className="font-medium text-purple-700">{p.numero}</span></td>
                    <td>{(p.cliente as any)?.nombre || '—'}</td>
                    <td>{p.tipo_sofa}</td>
                    <td className="text-gray-500">{p.material} / {p.color}</td>
                    <td className="text-sm">
                      <div className="flex items-center gap-1.5">
                        {s && (
                          <span
                            title={s.titulo}
                            style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, display: 'inline-block', flexShrink: 0 }}
                          />
                        )}
                        {format(parseISO(p.fecha_entrega), 'dd/MM/yyyy')}
                      </div>
                    </td>
                    <td><PrioridadBadge prioridad={p.prioridad} /></td>
                    <td><EstadoBadge estado={p.estado} /></td>
                    <td className="font-medium">${Number(p.precio_venta).toLocaleString('es-CO')}</td>
                    <td>
                      {p.estado !== 'entregado' && (
                        <select
                          className="text-xs py-1 w-36"
                          value={p.estado}
                          onChange={e => cambiarEstado(p.id, e.target.value as OrderStatus)}
                        >
                          {ESTADOS.filter(e => e.value).map(e =>
                            <option key={e.value} value={e.value}>{e.label}</option>
                          )}
                        </select>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={() => setConfirmar(p)}
                        className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded"
                        title="Eliminar pedido"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-3">{filtrados.length} pedidos</p>
    </div>
  )
}