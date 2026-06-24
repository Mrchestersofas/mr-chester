import { useEffect, useState } from 'react'
import { supabase, Pedido, Material } from '@/lib/supabase'
import { EstadoBadge, PrioridadBadge } from '@/components/Badges'
import Link from 'next/link'
import { AlertTriangle, Package, ClipboardList, Wrench, DollarSign, Plus } from 'lucide-react'
import { format, differenceInDays, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Dashboard() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [materiales, setMateriales] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: m }] = await Promise.all([
        supabase.from('pedidos').select('*, cliente:clientes(*)').order('created_at', { ascending: false }).limit(10),
        supabase.from('materiales').select('*').order('nombre'),
      ])
      setPedidos(p || [])
      setMateriales(m || [])
      setLoading(false)
    }
    load()
  }, [])

  const activos = pedidos.filter(p => !['entregado'].includes(p.estado))
  const enProd  = pedidos.filter(p => ['estructura','tapizado','costura','control_calidad'].includes(p.estado))
  const alertas = materiales.filter(m => m.stock_actual < m.stock_minimo)
  const totalMes = pedidos.reduce((s, p) => s + Number(p.precio_venta), 0)

  const diasRestantes = (fecha: string) => differenceInDays(parseISO(fecha), new Date())

  if (loading) return (
    <div className="flex items-center justify-center h-screen text-gray-400 text-sm">
      Cargando...
    </div>
  )

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
          </p>
        </div>
        <Link href="/pedidos/nuevo" className="btn btn-primary">
          <Plus size={15} /> Nuevo pedido
        </Link>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList size={15} className="text-gray-400" />
            <span className="text-xs text-gray-400">Pedidos activos</span>
          </div>
          <div className="text-2xl font-medium">{activos.length}</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <Wrench size={15} className="text-gray-400" />
            <span className="text-xs text-gray-400">En producción</span>
          </div>
          <div className="text-2xl font-medium">{enProd.length}</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <Package size={15} className="text-gray-400" />
            <span className="text-xs text-gray-400">Alertas de stock</span>
          </div>
          <div className="text-2xl font-medium text-amber-600">{alertas.length}</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={15} className="text-gray-400" />
            <span className="text-xs text-gray-400">Ingresos registrados</span>
          </div>
          <div className="text-2xl font-medium">
            ${(totalMes / 1_000_000).toFixed(1)}M
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        {/* Pedidos recientes */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium">Pedidos recientes</h2>
            <Link href="/pedidos" className="text-xs text-purple-600 hover:underline">Ver todos</Link>
          </div>
          {pedidos.slice(0,6).map(p => (
            <div key={p.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
              <span className="text-xs font-medium text-gray-500 w-16">{p.numero}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{p.tipo_sofa} — {p.color}</p>
                <p className="text-xs text-gray-400">{(p.cliente as any)?.nombre}</p>
              </div>
              <EstadoBadge estado={p.estado} />
            </div>
          ))}
          {pedidos.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">No hay pedidos aún. <Link href="/pedidos/nuevo" className="text-purple-600 underline">Crear primero</Link></p>
          )}
        </div>

        {/* Alertas de materiales */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium">Alertas de compras hoy</h2>
            <Link href="/materiales" className="text-xs text-purple-600 hover:underline">Ver inventario</Link>
          </div>
          {alertas.length === 0 ? (
            <div className="text-sm text-green-600 bg-green-50 rounded-lg px-4 py-3">
              ✓ Todo el inventario está en niveles correctos.
            </div>
          ) : (
            alertas.map(m => (
              <div key={m.id} className="flex items-start gap-3 bg-amber-50 rounded-lg px-3 py-2.5 mb-2">
                <AlertTriangle size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">{m.nombre}</p>
                  <p className="text-xs text-amber-600">
                    Stock: {m.stock_actual} {m.unidad} — Mínimo: {m.stock_minimo} {m.unidad}
                  </p>
                </div>
              </div>
            ))
          )}

          {/* Entregas próximas */}
          <h2 className="text-sm font-medium mt-5 mb-3">Entregas próximas</h2>
          {pedidos
            .filter(p => p.estado !== 'entregado')
            .sort((a,b) => new Date(a.fecha_entrega).getTime() - new Date(b.fecha_entrega).getTime())
            .slice(0,4)
            .map(p => {
              const dias = diasRestantes(p.fecha_entrega)
              return (
                <div key={p.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <span className="text-xs font-medium text-gray-500 w-16">{p.numero}</span>
                  <span className="text-xs flex-1 truncate">{p.tipo_sofa}</span>
                  <span className={`text-xs font-medium ${dias <= 2 ? 'text-red-600' : dias <= 5 ? 'text-amber-600' : 'text-gray-500'}`}>
                    {dias < 0 ? 'Vencido' : dias === 0 ? 'Hoy' : `${dias} días`}
                  </span>
                </div>
              )
          })}
        </div>
      </div>
    </div>
  )
}
