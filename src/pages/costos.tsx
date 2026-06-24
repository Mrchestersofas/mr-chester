import { useEffect, useState } from 'react'
import { supabase, Pedido } from '@/lib/supabase'

const COSTOS_REFERENCIA: Record<string, { materiales: number; manoObra: number }> = {
  'Chester 3 puestos':   { materiales: 687200, manoObra: 280000 },
  'Chester 2 puestos':   { materiales: 480000, manoObra: 200000 },
  'Love seat':           { materiales: 370000, manoObra: 150000 },
  'Esquinero modular':   { materiales: 1350000, manoObra: 500000 },
  'Sofá cama 2 puestos': { materiales: 600000, manoObra: 180000 },
  'Sofá cama 3 puestos': { materiales: 780000, manoObra: 250000 },
  'Personalizado':       { materiales: 600000, manoObra: 220000 },
}

export default function Costos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('pedidos')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setPedidos(data || [])
        setLoading(false)
      })
  }, [])

  const totalVentas = pedidos.reduce((s, p) => s + Number(p.precio_venta), 0)
  const totalCosto = pedidos.reduce((s, p) => {
    const c = COSTOS_REFERENCIA[p.tipo_sofa] ?? { materiales: 600000, manoObra: 220000 }
    return s + c.materiales + c.manoObra
  }, 0)
  const utilidad = totalVentas - totalCosto
  const margenPromedio = totalVentas > 0 ? ((utilidad / totalVentas) * 100) : 0

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-medium mb-1">Costos y márgenes</h1>
      <p className="text-sm text-gray-400 mb-6">Basado en costos de referencia por tipo de sofá. Actualiza los costos reales en Materiales.</p>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="text-xs text-gray-400 mb-1">Total ventas registradas</div>
          <div className="text-xl font-medium">${totalVentas.toLocaleString('es-CO')}</div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-400 mb-1">Costo total estimado</div>
          <div className="text-xl font-medium text-red-600">${totalCosto.toLocaleString('es-CO')}</div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-400 mb-1">Utilidad estimada</div>
          <div className="text-xl font-medium text-green-600">${utilidad.toLocaleString('es-CO')}</div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-400 mb-1">Margen promedio</div>
          <div className="text-xl font-medium text-purple-600">{margenPromedio.toFixed(1)}%</div>
        </div>
      </div>

      {/* Costos de referencia por tipo */}
      <div className="card mb-5">
        <h2 className="text-sm font-medium mb-4">Costos de referencia por tipo de sofá</h2>
        <table>
          <thead>
            <tr>
              <th>Tipo de sofá</th>
              <th>Materiales est.</th>
              <th>Mano de obra est.</th>
              <th>Costo total est.</th>
              <th>Precio venta sugerido</th>
              <th>Margen sugerido</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(COSTOS_REFERENCIA).map(([tipo, c]) => {
              const costo = c.materiales + c.manoObra
              const sugerido = costo * 3.2
              const margen = ((sugerido - costo) / sugerido * 100)
              return (
                <tr key={tipo}>
                  <td className="font-medium">{tipo}</td>
                  <td>${c.materiales.toLocaleString('es-CO')}</td>
                  <td>${c.manoObra.toLocaleString('es-CO')}</td>
                  <td className="font-medium">${costo.toLocaleString('es-CO')}</td>
                  <td className="text-green-700 font-medium">${Math.round(sugerido).toLocaleString('es-CO')}</td>
                  <td className="text-purple-700">{margen.toFixed(0)}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pedidos con margen individual */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-medium">Margen por pedido</h2>
        </div>
        {loading ? (
          <p className="p-6 text-sm text-gray-400 text-center">Cargando...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Tipo</th>
                <th>Precio venta</th>
                <th>Costo est.</th>
                <th>Utilidad est.</th>
                <th>Margen</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map(p => {
                const c = COSTOS_REFERENCIA[p.tipo_sofa] ?? { materiales: 600000, manoObra: 220000 }
                const costo = c.materiales + c.manoObra
                const venta = Number(p.precio_venta)
                const util = venta - costo
                const margen = venta > 0 ? (util / venta * 100) : 0
                return (
                  <tr key={p.id}>
                    <td className="font-medium text-purple-700">{p.numero}</td>
                    <td>{p.tipo_sofa}</td>
                    <td className="font-medium">${venta.toLocaleString('es-CO')}</td>
                    <td className="text-red-500">${costo.toLocaleString('es-CO')}</td>
                    <td className="text-green-600 font-medium">${util.toLocaleString('es-CO')}</td>
                    <td>
                      <span className={`badge ${margen > 50 ? 'badge-ready' : margen > 30 ? 'badge-warning' : 'badge-urgent'}`}>
                        {margen.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
