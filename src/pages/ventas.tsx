// @ts-nocheck
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TrendingUp, DollarSign, AlertCircle, ShoppingBag } from 'lucide-react'

/* Ventas: se elige el año y el mes (o "todo el año"). Todo lo de arriba
   (totales, canales, referencias y la lista) se calcula para ese periodo.
   La cartera de abajo es siempre la de hoy (todo lo pendiente por cobrar). */

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MESES_L = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const CANALES = { tienda_85: 'Tienda 85', whatsapp: 'WhatsApp', instagram: 'Instagram', falabella: 'Falabella', web: 'Página web' }

function fmtCOP(n) { return '$' + Math.round(Number(n || 0)).toLocaleString('es-CO') }
function hoyCol() { return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10) }
// Fecha del pedido como texto AAAA-MM-DD (sin líos de zona horaria)
function fechaDe(p) {
  if (p.fecha_pedido) return String(p.fecha_pedido).slice(0, 10)
  if (p.created_at) return new Date(new Date(p.created_at).getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10)
  return ''
}
const anioDe = p => Number(fechaDe(p).slice(0, 4))
const mesDe = p => Number(fechaDe(p).slice(5, 7)) - 1
const total = ps => ps.reduce((s, p) => s + Number(p.precio_venta || 0), 0)
const fLinda = iso => iso ? `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]}` : '—'

export default function Ventas() {
  const hoy = hoyCol()
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [anio, setAnio] = useState(Number(hoy.slice(0, 4)))
  const [mes, setMes] = useState(Number(hoy.slice(5, 7)) - 1) // -1 = todo el año

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

  if (loading) return <div className='p-6 text-center text-gray-400'>Cargando ventas...</div>

  const delAnio = pedidos.filter(p => anioDe(p) === anio)
  const periodo = mes === -1 ? delAnio : delAnio.filter(p => mesDe(p) === mes)
  const nombrePeriodo = mes === -1 ? `todo ${anio}` : `${MESES_L[mes]} ${anio}`

  // Mes anterior (para comparar), cruzando el año si es enero
  const antAnio = mes === 0 ? anio - 1 : anio
  const antMes = mes === 0 ? 11 : mes - 1
  const anterior = mes === -1 ? [] : pedidos.filter(p => anioDe(p) === antAnio && mesDe(p) === antMes)
  const totalPeriodo = total(periodo)
  const totalAnterior = total(anterior)
  const variacion = totalAnterior > 0 ? ((totalPeriodo - totalAnterior) / totalAnterior) * 100 : null

  const compras = new Set(periodo.map(p => p.grupo || p.numero)).size
  const unidades = periodo.reduce((s, p) => s + Number(p.cantidad || 1), 0)
  const ticket = compras ? totalPeriodo / compras : 0
  const abonosPeriodo = periodo.reduce((s, p) => s + Number(p.abono || 0), 0)

  const ventasPorMes = Array.from({ length: 12 }, (_, i) => {
    const ps = delAnio.filter(p => mesDe(p) === i)
    return { i, mes: MESES[i], total: total(ps), cantidad: new Set(ps.map(p => p.grupo || p.numero)).size }
  })
  const maxVenta = Math.max(...ventasPorMes.map(v => v.total), 1)

  const porCanal = {}
  for (const p of periodo) {
    const k = p.canal || 'sin'
    if (!porCanal[k]) porCanal[k] = { total: 0, compras: new Set() }
    porCanal[k].total += Number(p.precio_venta || 0)
    porCanal[k].compras.add(p.grupo || p.numero)
  }
  const canales = Object.entries(porCanal).sort((a, b) => b[1].total - a[1].total)

  const porReferencia = {}
  for (const p of periodo) {
    const ref = p.tipo_sofa || 'Sin referencia'
    if (!porReferencia[ref]) porReferencia[ref] = { cantidad: 0, total: 0 }
    porReferencia[ref].cantidad += Number(p.cantidad || 1)
    porReferencia[ref].total += Number(p.precio_venta || 0)
  }
  const referencias = Object.entries(porReferencia).sort((a, b) => b[1].total - a[1].total)

  const lista = [...periodo].sort((a, b) => fechaDe(b).localeCompare(fechaDe(a)) || String(b.numero).localeCompare(String(a.numero)))

  const cartera = pedidos
    .filter(p => p.estado !== 'entregado' && (Number(p.precio_venta || 0) - Number(p.abono || 0)) > 0)
    .sort((a, b) => (Number(b.precio_venta) - Number(b.abono)) - (Number(a.precio_venta) - Number(a.abono)))
  const totalCartera = cartera.reduce((s, p) => s + Number(p.precio_venta || 0) - Number(p.abono || 0), 0)

  const anios = Array.from(new Set([...pedidos.map(anioDe).filter(Boolean), Number(hoy.slice(0, 4))])).sort()

  return (
    <div className='p-6 max-w-6xl mx-auto'>
      <div className='flex flex-wrap items-center justify-between gap-3 mb-6'>
        <div>
          <h1 className='text-xl font-medium'>Ventas</h1>
          <p className='text-sm text-gray-400 mt-1'>Ventas de {nombrePeriodo} y cartera</p>
        </div>
        <div className='flex gap-2'>
          <select value={mes} onChange={e => setMes(Number(e.target.value))} className='text-sm border rounded-lg px-3 py-1.5'>
            <option value={-1}>Todo el año</option>
            {MESES_L.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={anio} onChange={e => setAnio(Number(e.target.value))} className='text-sm border rounded-lg px-3 py-1.5'>
            {anios.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* Métricas del periodo */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-6'>
        <div className='card'>
          <div className='flex items-center gap-2 mb-2'><DollarSign size={15} className='text-gray-400' /><span className='text-xs text-gray-400'>Ventas {mes === -1 ? 'del año' : 'del mes'}</span></div>
          <div className='text-2xl font-medium'>{fmtCOP(totalPeriodo)}</div>
          {variacion !== null && (
            <div className={`text-xs mt-1 ${variacion >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {variacion >= 0 ? '▲' : '▼'} {Math.abs(variacion).toFixed(1)}% vs {MESES_L[antMes].toLowerCase()}
            </div>
          )}
        </div>
        <div className='card'>
          <div className='flex items-center gap-2 mb-2'><ShoppingBag size={15} className='text-gray-400' /><span className='text-xs text-gray-400'>Compras</span></div>
          <div className='text-2xl font-medium'>{compras}</div>
          <div className='text-xs text-gray-400 mt-1'>{unidades} unidades · ticket {fmtCOP(ticket)}</div>
        </div>
        <div className='card'>
          <div className='flex items-center gap-2 mb-2'><TrendingUp size={15} className='text-green-500' /><span className='text-xs text-gray-400'>Abonos de esas ventas</span></div>
          <div className='text-2xl font-medium text-green-600'>{fmtCOP(abonosPeriodo)}</div>
          <div className='text-xs text-gray-400 mt-1'>Saldo: {fmtCOP(totalPeriodo - abonosPeriodo)}</div>
        </div>
        <div className='card'>
          <div className='flex items-center gap-2 mb-2'><AlertCircle size={15} className='text-red-400' /><span className='text-xs text-gray-400'>Cartera pendiente (hoy)</span></div>
          <div className='text-2xl font-medium text-red-500'>{fmtCOP(totalCartera)}</div>
          <div className='text-xs text-gray-400 mt-1'>{cartera.length} pedidos</div>
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-5 mb-5'>
        {/* Gráfico por mes: toca una barra para ver ese mes */}
        <div className='card md:col-span-1'>
          <h2 className='text-sm font-medium mb-4'>Ventas por mes {anio}</h2>
          <div className='flex items-end gap-1' style={{ height: '150px' }}>
            {ventasPorMes.map(v => (
              <button key={v.i} type='button' onClick={() => setMes(v.i)} className='flex-1 flex flex-col items-center gap-1'
                title={`${MESES_L[v.i]}: ${fmtCOP(v.total)} (${v.cantidad} compras)`}>
                <div className='w-full flex items-end' style={{ height: '115px' }}>
                  <div className={`w-full rounded-t-sm ${v.i === mes ? 'bg-purple-600' : 'bg-purple-200'}`}
                    style={{ height: `${Math.max((v.total / maxVenta) * 100, v.total > 0 ? 5 : 0)}%` }} />
                </div>
                <span className={`text-gray-500 ${v.i === mes ? 'font-bold text-purple-700' : ''}`} style={{ fontSize: '9px' }}>{v.mes}</span>
              </button>
            ))}
          </div>
          <p className='mt-3 text-xs text-gray-400'>Toca un mes para verlo.</p>
        </div>

        {/* Por canal */}
        <div className='card'>
          <h2 className='text-sm font-medium mb-4'>Por canal</h2>
          {canales.length === 0 ? <p className='text-sm text-gray-400 text-center py-8'>Sin ventas en {nombrePeriodo}</p> : (
            <div className='space-y-3'>
              {canales.map(([k, d]) => (
                <div key={k}>
                  <div className='flex items-center justify-between mb-1'>
                    <span className='text-xs text-gray-700 font-medium'>{CANALES[k] || (k === 'sin' ? 'Sin canal' : k)}</span>
                    <span className='text-xs text-gray-400'>{d.compras.size} compras · {fmtCOP(d.total)} · {Math.round((d.total / (totalPeriodo || 1)) * 100)}%</span>
                  </div>
                  <div className='w-full bg-gray-100 rounded-full h-1.5'>
                    <div className='bg-purple-400 h-1.5 rounded-full' style={{ width: `${(d.total / (canales[0][1].total || 1)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Por referencia */}
        <div className='card'>
          <h2 className='text-sm font-medium mb-4'>Por referencia</h2>
          {referencias.length === 0 ? <p className='text-sm text-gray-400 text-center py-8'>Sin ventas en {nombrePeriodo}</p> : (
            <div className='space-y-3'>
              {referencias.slice(0, 8).map(([ref, d]) => (
                <div key={ref}>
                  <div className='flex items-center justify-between mb-1'>
                    <span className='text-xs text-gray-700 truncate flex-1 font-medium'>{ref}</span>
                    <span className='text-xs text-gray-400 ml-2 flex-shrink-0'>{d.cantidad} uds · {fmtCOP(d.total)}</span>
                  </div>
                  <div className='w-full bg-gray-100 rounded-full h-1.5'>
                    <div className='bg-purple-400 h-1.5 rounded-full' style={{ width: `${(d.total / (referencias[0][1].total || 1)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lista de ventas del periodo */}
      <div className='card mb-5'>
        <div className='flex items-center justify-between mb-4'>
          <h2 className='text-sm font-medium'>Ventas de {nombrePeriodo}</h2>
          <span className='text-xs text-gray-400'>{lista.length} productos</span>
        </div>
        {lista.length === 0 ? <p className='text-sm text-gray-400 text-center py-8'>No hay ventas en {nombrePeriodo}.</p> : (
          <div className='overflow-x-auto'>
            <table>
              <thead>
                <tr><th>Pedido</th><th>Fecha</th><th>Cliente</th><th>Producto</th><th>Canal</th><th>Total</th><th>Abono</th><th>Saldo</th></tr>
              </thead>
              <tbody>
                {lista.map(p => {
                  const saldo = Number(p.precio_venta || 0) - Number(p.abono || 0)
                  return (
                    <tr key={p.id}>
                      <td className='font-medium text-purple-700 whitespace-nowrap'>{p.numero}</td>
                      <td className='text-sm text-gray-500 whitespace-nowrap'>{fLinda(fechaDe(p))}</td>
                      <td>{p.cliente?.nombre || '—'}</td>
                      <td>{p.tipo_sofa}{Number(p.cantidad) > 1 ? ` × ${p.cantidad}` : ''}</td>
                      <td className='text-sm text-gray-500'>{CANALES[p.canal] || '—'}</td>
                      <td className='whitespace-nowrap'>{fmtCOP(p.precio_venta)}</td>
                      <td className='text-green-600 whitespace-nowrap'>{fmtCOP(p.abono)}</td>
                      <td className={`whitespace-nowrap ${saldo > 0 ? 'text-red-500' : 'text-gray-400'}`}>{fmtCOP(saldo)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className='text-right text-sm font-semibold text-gray-600 pt-3'>Total:</td>
                  <td className='font-bold pt-3 whitespace-nowrap'>{fmtCOP(totalPeriodo)}</td>
                  <td className='font-bold text-green-600 pt-3 whitespace-nowrap'>{fmtCOP(abonosPeriodo)}</td>
                  <td className='font-bold text-red-600 pt-3 whitespace-nowrap'>{fmtCOP(totalPeriodo - abonosPeriodo)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Cartera de hoy */}
      <div className='card'>
        <div className='flex items-center justify-between mb-4'>
          <h2 className='text-sm font-medium'>Cartera — Saldos pendientes (hoy)</h2>
          <span className='text-xs text-gray-400'>{cartera.length} pedidos</span>
        </div>
        {cartera.length === 0 ? (
          <div className='text-center py-8 text-green-600'><p className='text-sm'>✓ No hay saldos pendientes</p></div>
        ) : (
          <div className='overflow-x-auto'>
            <table>
              <thead>
                <tr><th>Pedido</th><th>Cliente</th><th>Producto</th><th>Fecha pedido</th><th>Total</th><th>Abono</th><th>Saldo</th></tr>
              </thead>
              <tbody>
                {cartera.map(p => {
                  const saldo = Number(p.precio_venta || 0) - Number(p.abono || 0)
                  return (
                    <tr key={p.id}>
                      <td className='font-medium text-purple-700'>{p.numero}</td>
                      <td>{p.cliente?.nombre || '—'}</td>
                      <td>{p.tipo_sofa}</td>
                      <td className='text-sm text-gray-500'>{fLinda(fechaDe(p))}</td>
                      <td>{fmtCOP(p.precio_venta)}</td>
                      <td className='text-green-600'>{fmtCOP(p.abono)}</td>
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
