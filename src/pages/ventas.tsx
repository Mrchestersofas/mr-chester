import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TrendingUp, DollarSign, AlertCircle } from 'lucide-react'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function fmtCOP(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO')
}

export default function Ventas() {
  const [pedidos, setPedidos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [anio, setAnio] = useState(new Date().getFullYear())

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('pedidos')
      .select('*, cliente:clientes(nombre)')
      .neq('estado', 'cancelado')
      .order('fecha_pedido', { ascending: true })
    setPedidos(data || [])
    setLoading(false)
  }

  const pedidosAnio = pedidos.filter(p => {
    const fecha = p.fecha_pedido || p.created_at
    return fecha && new Date(fecha).getFullYear() === anio
  })

  const mesActual = new Date().getMonth()

  const pedidosMes = pedidosAnio.filter(p => {
    const fecha = p.fecha_pedido || p.created_at
    return fecha && new Date(fecha).getMonth() === mesActual
  })

  const pedidosMesAnterior = pedidosAnio.filter(p => {
    const fecha = p.fecha_pedido || p.created_at
    return fecha && new Date(fecha).getMonth() === mesActual - 1
  })

  const totalMes = pedidosMes.reduce((s, p) => s + Number(p.precio_venta || 0), 0)
  const totalMesAnterior = pedidosMesAnterior.reduce((s, p) => s + Number(p.precio_venta || 0), 0)
  const totalAnio = pedidosAnio.reduce((s, p) => s + Number(p.precio_venta || 0), 0)
  const totalAbonos = pedidosAnio.reduce((s, p) => s + Number(p.abono || 0), 0)
  const variacion = totalMesAnterior > 0 ? ((totalMes - totalMesAnterior) / totalMesAnterior) * 100 : 0

  const ventasPorMes = Array.from({ length: 12 }, (_, i) => {
    const ps = pedidosAnio.filter(p => {
      const fecha = p.fecha_pedido || p.created_at
      return fecha && new Date(fecha).getMonth() === i
    })
    return {
      mes: MESES[i],
      total: ps.reduce((s, p) => s + Number(p.precio_venta || 0), 0),
      cantidad: ps.length,
    }
  })

  const maxVenta = Math.max(...ventasPorMes.map(v => v.total), 1)

  const porReferencia: Record<string, { cantidad: number; total: number }> = {}
  for (const p of pedidosAnio) {
    const ref = p.tipo_sofa || 'Sin referencia'
    if (!porReferencia[ref]) porReferencia[ref] = { cantidad: 0, total: 0 }
    porReferencia[ref].cantidad += Number(p.cantidad || 1)
    porReferencia[ref].total += Number(p.precio_venta || 0)
  }
  const referencias = Object.entries(porReferencia).sort((a, b) => b[1].total - a[1].total)

  const cartera = pedidos
    .filter(p => p.estado !== 'entregado' && (Number(p.precio_venta || 0) - Number(p.abono || 0)) > 0)
    .sort((a, b) => (Number(b.precio_venta) - Number(b.abono)) - (Number(a.precio_venta) - Number(a.abono)))

  const totalCartera = cartera.reduce((s, p) => s + Number(p.precio_venta || 0) - Number(p.abono || 0), 0)

  if (loading) return <div className='p-6 text-center text-gray-400'>Cargando ventas...</div>

  return (
    <div className='p-6 max-w-6xl mx-auto'>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-xl font-medium'>Ventas</h1>
          <p className='text-sm text-gray-400 mt-1'>Resumen comercial y cartera</p>
        </div>
        <select
          value={anio}
          onChange={e => setAnio(Number(e.target.value))}
          className='text-sm border rounded-lg px-3 py-1.5'
        >
          {[2024, 2025, 2026, 2027].map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {/* Métricas */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-6'>
        <div className='card'>
          <div className='flex items-center gap-2 mb-2'>
            <DollarSign size={15} className='text-gray-400' />
            <span className='text-xs text-gray-400'>Ventas del mes</span>
          </div>
          <div className='text-2xl font-medium'>{fmtCOP(totalMes)}</div>
          {totalMesAnterior > 0 && (
            <div className={`text-xs mt-1 ${variacion >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {variacion >= 0 ? '▲' : '▼'} {Math.abs(variacion).toFixed(1)}% vs mes anterior
            </div>
          )}
          <div className='text-xs text-gray-400 mt-0.5'>{pedidosMes.length} pedidos</div>
        </div>
        <div className='card'>
          <div className='flex items-center gap-2 mb-2'>
            <TrendingUp size={15} className='text-gray-400' />
            <span className='text-xs text-gray-400'>Total año {anio}</span>
          </div>
          <div className='text-2xl font-medium'>{fmtCOP(totalAnio)}</div>
          <div className='text-xs text-gray-400 mt-1'>{pedidosAnio.length} pedidos</div>
        </div>
        <div className='card'>
          <div className='flex items-center gap-2 mb-2'>
            <DollarSign size={15} className='text-green-500' />
            <span className='text-xs text-gray-400'>Abonos recibidos</span>
          </div>
          <div className='text-2xl font-medium text-green-600'>{fmtCOP(totalAbonos)}</div>
          <div className='text-xs text-gray-400 mt-1'>año {anio}</div>
        </div>
        <div className='card'>
          <div className='flex items-center gap-2 mb-2'>
            <AlertCircle size={15} className='text-red-400' />
            <span className='text-xs text-gray-400'>Cartera pendiente</span>
          </div>
          <div className='text-2xl font-medium text-red-500'>{fmtCOP(totalCartera)}</div>
          <div className='text-xs text-gray-400 mt-1'>{cartera.length} pedidos</div>
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-5 mb-5'>

        {/* Gráfico barras por mes */}
        <div className='card'>
          <h2 className='text-sm font-medium mb-4'>Ventas mensuales {anio}</h2>
          <div className='flex items-end gap-1' style={{ height: '150px' }}>
            {ventasPorMes.map((v, i) => (
              <div key={i} className='flex-1 flex flex-col items-center gap-1'>
                <div className='w-full flex items-end' style={{ height: '115px' }}>
                  <div
                    className={`w-full rounded-t-sm ${i === mesActual ? 'bg-purple-500' : 'bg-purple-200'}`}
                    style={{ height: `${Math.max((v.total / maxVenta) * 100, v.total > 0 ? 5 : 0)}%` }}
                    title={`${v.mes}: ${fmtCOP(v.total)} (${v.cantidad} pedidos)`}
                  />
                </div>
                <span className='text-xs text-gray-400' style={{ fontSize: '9px' }}>{v.mes}</span>
              </div>
            ))}
          </div>
          <div className='mt-3 flex items-center gap-4 text-xs text-gray-400'>
            <span className='flex items-center gap-1'><span className='w-3 h-3 rounded-sm bg-purple-500 inline-block'></span> Mes actual</span>
            <span className='flex items-center gap-1'><span className='w-3 h-3 rounded-sm bg-purple-200 inline-block'></span> Otros meses</span>
          </div>
        </div>

        {/* Por referencia */}
        <div className='card'>
          <h2 className='text-sm font-medium mb-4'>Ventas por referencia</h2>
          {referencias.length === 0 ? (
            <p className='text-sm text-gray-400 text-center py-8'>Sin datos para {anio}</p>
          ) : (
            <div className='space-y-3'>
              {referencias.slice(0, 8).map(([ref, data]) => (
                <div key={ref}>
                  <div className='flex items-center justify-between mb-1'>
                    <span className='text-xs text-gray-700 truncate flex-1 font-medium'>{ref}</span>
                    <span className='text-xs text-gray-400 ml-2 flex-shrink-0'>{data.cantidad} uds · {fmtCOP(data.total)}</span>
                  </div>
                  <div className='w-full bg-gray-100 rounded-full h-1.5'>
                    <div
                      className='bg-purple-400 h-1.5 rounded-full'
                      style={{ width: `${(data.total / (referencias[0][1].total || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cartera */}
      <div className='card'>
        <div className='flex items-center justify-between mb-4'>
          <h2 className='text-sm font-medium'>Cartera — Saldos pendientes</h2>
          <span className='text-xs text-gray-400'>{cartera.length} clientes</span>
        </div>
        {cartera.length === 0 ? (
          <div className='text-center py-8 text-green-600'>
            <p className='text-sm'>✓ No hay saldos pendientes</p>
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Producto</th>
                  <th>Fecha pedido</th>
                  <th>Total</th>
                  <th>Abono</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {cartera.map(p => {
                  const saldo = Number(p.precio_venta || 0) - Number(p.abono || 0)
                  return (
                    <tr key={p.id}>
                      <td className='font-medium text-purple-700'>{p.numero}</td>
                      <td>{(p.cliente as any)?.nombre || '—'}</td>
                      <td>{p.tipo_sofa}</td>
                      <td className='text-sm text-gray-500'>
                        {p.fecha_pedido ? new Date(p.fecha_pedido + 'T12:00:00').toLocaleDateString('es-CO') : '—'}
                      </td>
                      <td>{fmtCOP(Number(p.precio_venta || 0))}</td>
                      <td className='text-green-600'>{fmtCOP(Number(p.abono || 0))}</td>
                      <td className='font-semibold text-red-500'>{fmtCOP(saldo)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} className='text-right text-sm font-semibold text-gray-600 pt-3'>Total cartera:</td>
                  <td className='font-bold text-red-600 pt-3'>{fmtCOP(totalCartera)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}