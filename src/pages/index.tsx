import { useEffect, useState } from 'react'
import { supabase, Pedido } from '@/lib/supabase'
import { EstadoBadge } from '@/components/Badges'
import Link from 'next/link'
import { AlertTriangle, Package, ClipboardList, Wrench, DollarSign, Plus, ShoppingCart, Search, X, Phone, MapPin, User, FileText, Clock } from 'lucide-react'
import { format, differenceInDays, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ETAPAS } from '@/lib/programacion'

const ETAPA_LABEL: Record<string, string> = {
  cola: 'En cola',
  estructura: 'Estructura',
  espumado: 'Espumado',
  corte_tela: 'Corte de tela',
  tapizado: 'Tapizado',
  terminado: 'Terminado',
  control_calidad: 'Control de calidad',
  despacho: 'Despacho',
  completado: 'Entregado',
}

const ETAPA_COLOR: Record<string, { bg: string; text: string }> = {
  cola:            { bg: 'bg-gray-100',   text: 'text-gray-600' },
  estructura:      { bg: 'bg-amber-50',   text: 'text-amber-700' },
  espumado:        { bg: 'bg-blue-50',    text: 'text-blue-700' },
  corte_tela:      { bg: 'bg-purple-50',  text: 'text-purple-700' },
  tapizado:        { bg: 'bg-pink-50',    text: 'text-pink-700' },
  terminado:       { bg: 'bg-indigo-50',  text: 'text-indigo-700' },
  control_calidad: { bg: 'bg-orange-50',  text: 'text-orange-700' },
  despacho:        { bg: 'bg-green-50',   text: 'text-green-700' },
  completado:      { bg: 'bg-green-100',  text: 'text-green-800' },
}

function semaforo(fechaEntrega: string) {
  if (!fechaEntrega) return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const entrega = new Date(fechaEntrega); entrega.setHours(0, 0, 0, 0)
  const dias = Math.ceil((entrega.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  if (dias < 0) return { color: '#ef4444', titulo: `Vencido hace ${Math.abs(dias)} día(s)`, dias }
  if (dias <= 3) return { color: '#f59e0b', titulo: `Vence en ${dias} día(s)`, dias }
  return { color: '#22c55e', titulo: `${dias} día(s) restantes`, dias }
}

function fmtFecha(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

function fmtHora(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function BuscadorPedido() {
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<any[]>([])
  const [buscando, setBuscando] = useState(false)
  const [seleccionado, setSeleccionado] = useState<any | null>(null)
  const [compra, setCompra] = useState<any[]>([])

  // Al abrir un pedido traemos todos los productos de la misma compra para mostrar el saldo completo
  async function elegir(p: any) {
    setSeleccionado(p)
    setCompra([p])
    if (!p.grupo) return
    const { data } = await supabase.from('pedidos').select('id, numero, tipo_sofa, precio_venta, abono, estado').eq('grupo', p.grupo).neq('estado', 'cancelado').order('numero')
    if (data && data.length) setCompra(data)
  }

  useEffect(() => {
    if (busqueda.trim().length < 2) { setResultados([]); return }
    const timer = setTimeout(() => buscar(), 400)
    return () => clearTimeout(timer)
  }, [busqueda])

  async function buscar() {
    setBuscando(true)
    const { data } = await supabase
      .from('pedidos')
      .select('*, cliente:clientes(nombre, cedula, telefono, direccion, ciudad, email), programacion:programacion_produccion(*)')
      .or(`numero.ilike.%${busqueda}%,tipo_sofa.ilike.%${busqueda}%`)
      .neq('estado', 'entregado')
      .limit(5)

    // También buscar por cliente: nombre, cédula/NIT o teléfono
    const t = busqueda.trim().replace(/[%,()]/g, '')
    const dig = t.replace(/\D/g, '')
    const filtros = [`nombre.ilike.%${t}%`]
    if (dig.length >= 4) filtros.push(`cedula.ilike.%${dig}%`, `telefono.ilike.%${dig}%`)
    const { data: clis } = await supabase.from('clientes').select('id').or(filtros.join(',')).limit(30)
    const ids = (clis || []).map((c: any) => c.id)
    const { data: porCliente } = ids.length ? await supabase
      .from('pedidos')
      .select('*, cliente:clientes(nombre, cedula, telefono, direccion, ciudad, email), programacion:programacion_produccion(*)')
      .in('cliente_id', ids)
      .not('estado', 'in', '(entregado,cancelado)')
      .order('created_at', { ascending: false })
      .limit(20) : { data: [] }
    const porClienteFiltrado = porCliente || []

    const todos = [...(data || []), ...porClienteFiltrado]
    const unicos = todos.filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i)
    setResultados(unicos.slice(0, 10))
    setBuscando(false)
  }

  function limpiar() {
    setBusqueda('')
    setResultados([])
    setSeleccionado(null)
  }

  return (
    <div className='mb-6'>
      <div className='bg-white border-2 border-purple-200 rounded-2xl p-4 shadow-sm'>
        <p className='text-xs font-semibold text-purple-600 uppercase tracking-wide mb-3'>🔍 Consulta de estado de pedido</p>
        <div className='relative'>
          <Search size={16} className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400' />
          <input
            type='text'
            placeholder='Buscar por nombre de cliente, número de pedido o modelo...'
            value={busqueda}
            onChange={e => { setBusqueda(e.target.value); setSeleccionado(null) }}
            className='pl-9 pr-9 w-full'
          />
          {busqueda && (
            <button onClick={limpiar} className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600'>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Resultados */}
        {busqueda.length >= 2 && !seleccionado && (
          <div className='mt-3 space-y-2'>
            {buscando && <p className='text-xs text-gray-400 text-center py-2'>Buscando...</p>}
            {!buscando && resultados.length === 0 && (
              <p className='text-xs text-gray-400 text-center py-2'>No se encontraron pedidos activos.</p>
            )}
            {resultados.map(p => {
              const prog = Array.isArray(p.programacion) ? p.programacion[0] : p.programacion
              const s = semaforo(p.fecha_entrega)
              const etapa = prog?.etapa_actual || p.estado
              const color = ETAPA_COLOR[etapa] || ETAPA_COLOR['cola']
              return (
                <button
                  key={p.id}
                  onClick={() => elegir(p)}
                  className='w-full text-left bg-gray-50 hover:bg-purple-50 rounded-xl px-4 py-3 transition-colors border border-transparent hover:border-purple-200'
                >
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <span className='font-semibold text-purple-700 text-sm'>{p.numero}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color.bg} ${color.text}`}>
                        {ETAPA_LABEL[etapa] || etapa}
                      </span>
                      {s && <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />}
                    </div>
                    <span className='text-xs text-gray-400'>{s?.titulo}</span>
                  </div>
                  <p className='text-sm text-gray-600 mt-0.5'>{p.tipo_sofa} — {(p.cliente as any)?.nombre}</p>
                </button>
              )
            })}
          </div>
        )}

        {/* Detalle del pedido seleccionado */}
        {seleccionado && (() => {
          const p = seleccionado
          const prog = Array.isArray(p.programacion) ? p.programacion[0] : p.programacion
          const c = p.cliente
          const s = semaforo(p.fecha_entrega)
          const etapa = prog?.etapa_actual || p.estado
          const color = ETAPA_COLOR[etapa] || ETAPA_COLOR['cola']

          return (
            <div className='mt-4 border-t pt-4'>
              {/* Encabezado resultado */}
              <div className='flex items-center justify-between mb-4'>
                <div className='flex items-center gap-3'>
                  <span className='text-lg font-bold text-purple-700'>{p.numero}</span>
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${color.bg} ${color.text}`}>
                    {ETAPA_LABEL[etapa] || etapa}
                  </span>
                  {s && (
                    <div className='flex items-center gap-1.5'>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                      <span className='text-xs text-gray-500'>{s.titulo}</span>
                    </div>
                  )}
                </div>
                <button onClick={() => setSeleccionado(null)} className='text-gray-400 hover:text-gray-600'><X size={16} /></button>
              </div>

              {/* Info clave */}
              <div className='grid grid-cols-2 gap-3 mb-4'>
                <div className='bg-gray-50 rounded-xl p-3'>
                  <p className='text-xs text-gray-400 mb-0.5'>Modelo</p>
                  <p className='text-sm font-medium'>{p.tipo_sofa}</p>
                </div>
                <div className='bg-gray-50 rounded-xl p-3'>
                  <p className='text-xs text-gray-400 mb-0.5'>Tela</p>
                  <p className='text-sm font-medium'>{p.material || '—'}</p>
                </div>
                <div className='bg-gray-50 rounded-xl p-3'>
                  <p className='text-xs text-gray-400 mb-0.5'>Fecha de entrega prometida</p>
                  <p className={`text-sm font-medium ${s && s.dias < 0 ? 'text-red-600' : s && s.dias <= 3 ? 'text-amber-600' : 'text-gray-800'}`}>
                    {p.fecha_entrega ? new Date(p.fecha_entrega + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                  </p>
                </div>
                <div className='bg-gray-50 rounded-xl p-3'>
                  <p className='text-xs text-gray-400 mb-0.5'>Despacho estimado</p>
                  <p className='text-sm font-medium'>
                    {prog?.fin_despacho ? new Date(prog.fin_despacho).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                  </p>
                </div>
              </div>

              {/* Pago: total, abonado y saldo de toda la compra */}
              {(() => {
                const lineas = compra.length ? compra : [p]
                const total = lineas.reduce((a: number, x: any) => a + Number(x.precio_venta || 0), 0)
                const abonado = lineas.reduce((a: number, x: any) => a + Number(x.abono || 0), 0)
                const saldo = total - abonado
                const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')
                return (
                  <div className={`rounded-xl p-3 mb-4 border ${saldo > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                    <div className='flex items-center justify-between mb-2'>
                      <p className='text-xs font-semibold text-gray-500 uppercase tracking-wide'>
                        <DollarSign size={12} className='inline -mt-0.5' /> Pago{lineas.length > 1 ? ` · compra de ${lineas.length} productos` : ''}
                      </p>
                      {saldo <= 0 && <span className='text-xs font-semibold text-green-700'>✓ Pagado completo</span>}
                    </div>
                    <div className='grid grid-cols-3 gap-2 text-center'>
                      <div><p className='text-xs text-gray-500'>Total</p><p className='text-sm font-semibold'>{$(total)}</p></div>
                      <div><p className='text-xs text-gray-500'>Abonado</p><p className='text-sm font-semibold text-green-700'>{$(abonado)}</p></div>
                      <div><p className='text-xs text-gray-500'>Saldo</p><p className={`text-lg font-bold ${saldo > 0 ? 'text-amber-700' : 'text-green-700'}`}>{$(Math.max(0, saldo))}</p></div>
                    </div>
                    {lineas.length > 1 && (
                      <div className='mt-2 pt-2 border-t border-black/5 space-y-0.5'>
                        {lineas.map((x: any) => (
                          <div key={x.id} className='flex justify-between text-xs text-gray-600'>
                            <span>{x.numero} · {x.tipo_sofa}</span>
                            <span>saldo {$(Math.max(0, Number(x.precio_venta || 0) - Number(x.abono || 0)))}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Inicio en cola */}
              {etapa === 'cola' && prog?.inicio_estructura && (
                <div className='bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 text-sm text-blue-700'>
                  📅 Programado para iniciar producción el <b>{fmtFecha(prog.inicio_estructura)}</b>
                </div>
              )}

              {/* Observaciones */}
              {p.observaciones && (
                <div className='bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4 flex gap-2'>
                  <FileText size={14} className='text-amber-500 mt-0.5 flex-shrink-0' />
                  <p className='text-sm text-gray-700'>{p.observaciones}</p>
                </div>
              )}

              {/* Cliente */}
              <div className='bg-gray-50 rounded-xl p-3 space-y-2'>
                <p className='text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2'>Cliente</p>
                <div className='flex items-center gap-2'>
                  <User size={13} className='text-gray-400' />
                  <span className='text-sm font-medium'>{c?.nombre || '—'}</span>
                  {c?.cedula && <span className='text-xs text-gray-400'>CC {c.cedula}</span>}
                </div>
                {c?.telefono && (
                  <div className='flex items-center gap-2'>
                    <Phone size={13} className='text-gray-400' />
                    <a href={`https://wa.me/57${c.telefono}`} target='_blank' rel='noreferrer' className='text-sm text-green-600 hover:underline'>
                      {c.telefono}
                    </a>
                  </div>
                )}
                {(c?.direccion || c?.ciudad) && (
                  <div className='flex items-center gap-2'>
                    <MapPin size={13} className='text-gray-400' />
                    <span className='text-sm text-gray-600'>{[c?.direccion, c?.ciudad].filter(Boolean).join(', ')}</span>
                  </div>
                )}
              </div>

              {/* Cronograma resumido */}
              {prog && (
                <div className='mt-4'>
                  <p className='text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2'>Cronograma de producción</p>
                  <div className='space-y-1'>
                    {ETAPAS.filter(e => e.key !== 'cola').map(etapaItem => {
                      const inicio = prog[`inicio_${etapaItem.key}`]
                      const fin = prog[`fin_${etapaItem.key}`]
                      const esActual = etapa === etapaItem.key
                      const c2 = ETAPA_COLOR[etapaItem.key]
                      return (
                        <div key={etapaItem.key} className={`flex items-center justify-between rounded-lg px-3 py-1.5 ${esActual ? c2.bg : 'bg-gray-50'}`}>
                          <div className='flex items-center gap-2'>
                            <span className={`w-1.5 h-1.5 rounded-full ${esActual ? 'bg-current' : 'bg-gray-300'} ${esActual ? c2.text : ''}`} />
                            <span className={`text-xs ${esActual ? `font-semibold ${c2.text}` : 'text-gray-500'}`}>{etapaItem.label}</span>
                            {esActual && <span className={`text-xs px-1.5 rounded-full bg-white/60 ${c2.text}`}>En curso</span>}
                          </div>
                          <span className='text-xs text-gray-400'>
                            {inicio ? `${new Date(inicio).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} ${fmtHora(inicio)}` : '—'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  // Compras de hoy (módulo nuevo de Compras: proveedores con días fijos)
  const [comprasHoy, setComprasHoy] = useState<any[]>([])
  const [pedidosCompraHoy, setPedidosCompraHoy] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [resumen, setResumen] = useState<any>({ activos: 0, enProd: 0, ventasMes: 0 })

  useEffect(() => {
    async function load() {
      const hoy = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10)
      const dia = new Date(hoy + 'T12:00:00Z').getUTCDay()
      const [{ data: p }, { data: provs }, { data: hechos }] = await Promise.all([
        supabase.from('pedidos').select('*, cliente:clientes(*)').order('created_at', { ascending: false }).limit(10),
        supabase.from('compra_proveedores').select('*, insumos:compra_insumos(*)').eq('activo', true).order('orden'),
        supabase.from('compra_pedidos').select('proveedor_id, created_at').eq('fecha', hoy),
      ])
      setPedidos(p || [])
      // Contadores reales (no solo los 10 recientes)
      const mesIni = hoy.slice(0, 8) + '01'
      const [{ count: nAct }, { data: prog }, { data: delMes }] = await Promise.all([
        supabase.from('pedidos').select('id', { count: 'exact', head: true }).not('estado', 'in', '(entregado,cancelado)'),
        supabase.from('programacion_produccion').select('etapa_actual, pedido:pedidos(estado)').not('etapa_actual', 'in', '(cola,completado,despacho)'),
        supabase.from('pedidos').select('precio_venta').neq('estado', 'cancelado').gte('fecha_pedido', mesIni).lte('fecha_pedido', hoy),
      ])
      setResumen({
        activos: nAct || 0,
        enProd: (prog || []).filter((x: any) => x.pedido && !['entregado', 'cancelado'].includes(x.pedido.estado)).length,
        ventasMes: (delMes || []).reduce((a: number, x: any) => a + Number(x.precio_venta || 0), 0),
      })
      setComprasHoy((provs || []).filter((x: any) => (x.dias || []).includes(dia)).map((x: any) => ({
        ...x,
        total: (x.insumos || []).filter((i: any) => i.activo).reduce((a: number, i: any) => a + Number(i.precio) * Number(i.cantidad), 0) + Number(x.costo_fijo || 0),
      })))
      setPedidosCompraHoy(hechos || [])
      setLoading(false)
    }
    load()
  }, [])

  const totalComprasHoy = comprasHoy.reduce((a, x) => a + x.total, 0)
  const pedidoHecho = (id: string) => pedidosCompraHoy.some(x => x.proveedor_id === id)
  const porPedir = comprasHoy.filter(x => !pedidoHecho(x.id)).length
  const diasRestantes = (fecha: string) => differenceInDays(parseISO(fecha), new Date())

  if (loading) return (
    <div className='flex items-center justify-center h-screen text-gray-400 text-sm'>Cargando...</div>
  )

  return (
    <div className='p-6 max-w-6xl mx-auto'>

      {/* Header */}
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-xl font-medium text-gray-900'>Dashboard</h1>
          <p className='text-sm text-gray-400 mt-0.5'>
            {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
          </p>
        </div>
        <Link href='/pedidos/nuevo' className='btn btn-primary'>
          <Plus size={15} /> Nuevo pedido
        </Link>
      </div>

      {/* Buscador de pedidos */}
      <BuscadorPedido />

      {/* Metric cards */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-6'>
        <div className='card'>
          <div className='flex items-center gap-2 mb-2'>
            <ClipboardList size={15} className='text-gray-400' />
            <span className='text-xs text-gray-400'>Pedidos activos</span>
          </div>
          <div className='text-2xl font-medium'>{resumen.activos}</div>
        </div>
        <div className='card'>
          <div className='flex items-center gap-2 mb-2'>
            <Wrench size={15} className='text-gray-400' />
            <span className='text-xs text-gray-400'>En producción</span>
          </div>
          <div className='text-2xl font-medium'>{resumen.enProd}</div>
        </div>
        <Link href='/compras' className='card hover:border-amber-300 transition-colors'>
          <div className='flex items-center gap-2 mb-2'>
            <ShoppingCart size={15} className={porPedir > 0 ? 'text-amber-500' : 'text-gray-400'} />
            <span className='text-xs text-gray-400'>Compras de hoy</span>
          </div>
          <div className='text-2xl font-medium'>{comprasHoy.length ? `$${(totalComprasHoy / 1e6).toFixed(1)}M` : '—'}</div>
          <div className={`text-xs mt-0.5 ${porPedir > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
            {!comprasHoy.length ? 'Sin compras hoy' : porPedir > 0 ? `${porPedir} por pedir` : '✓ Todo pedido'}
          </div>
        </Link>
        <Link href='/ventas' className='card hover:border-purple-300 transition-colors'>
          <div className='flex items-center gap-2 mb-2'>
            <DollarSign size={15} className='text-gray-400' />
            <span className='text-xs text-gray-400'>Ventas del mes</span>
          </div>
          <div className='text-2xl font-medium'>${(resumen.ventasMes / 1_000_000).toFixed(1)}M</div>
        </Link>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-5 mb-5'>
        <div className='card'>
          <div className='flex items-center justify-between mb-4'>
            <h2 className='text-sm font-medium'>Pedidos recientes</h2>
            <Link href='/pedidos' className='text-xs text-purple-600 hover:underline'>Ver todos</Link>
          </div>
          {pedidos.slice(0,6).map(p => (
            <div key={p.id} className='flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0'>
              <span className='text-xs font-medium text-gray-500 w-16'>{p.numero}</span>
              <div className='flex-1 min-w-0'>
                <p className='text-sm truncate'>{p.tipo_sofa} — {p.color}</p>
                <p className='text-xs text-gray-400'>{(p.cliente as any)?.nombre}</p>
              </div>
              <EstadoBadge estado={p.estado} />
            </div>
          ))}
          {pedidos.length === 0 && (
            <p className='text-sm text-gray-400 py-4 text-center'>No hay pedidos aún. <Link href='/pedidos/nuevo' className='text-purple-600 underline'>Crear primero</Link></p>
          )}
        </div>

        <div className='card'>
          <div className='flex items-center justify-between mb-4'>
            <h2 className='text-sm font-medium'>Compras de hoy</h2>
            <Link href='/compras' className='text-xs text-purple-600 hover:underline'>Ir a Compras</Link>
          </div>
          {comprasHoy.length === 0 ? (
            <div className='text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-3'>Hoy no hay compras programadas.</div>
          ) : (
            comprasHoy.map(x => (
              <Link key={x.id} href='/compras' className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 mb-2 ${pedidoHecho(x.id) ? 'bg-green-50' : 'bg-amber-50'}`}>
                <div>
                  <p className={`text-sm font-medium ${pedidoHecho(x.id) ? 'text-green-800' : 'text-amber-800'}`}>{x.nombre}</p>
                  <p className={`text-xs ${pedidoHecho(x.id) ? 'text-green-700' : 'text-amber-700'}`}>{pedidoHecho(x.id) ? '✓ Pedido' : 'Por pedir'}</p>
                </div>
                <span className='text-sm font-semibold'>${Math.round(x.total).toLocaleString('es-CO')}</span>
              </Link>
            ))
          )}

          <h2 className='text-sm font-medium mt-5 mb-3'>Entregas próximas</h2>
          {pedidos
            .filter(p => p.estado !== 'entregado')
            .sort((a,b) => new Date(a.fecha_entrega).getTime() - new Date(b.fecha_entrega).getTime())
            .slice(0,4)
            .map(p => {
              const dias = diasRestantes(p.fecha_entrega)
              return (
                <div key={p.id} className='flex items-center gap-3 py-2 border-b border-gray-50 last:border-0'>
                  <span className='text-xs font-medium text-gray-500 w-16'>{p.numero}</span>
                  <span className='text-xs flex-1 truncate'>{p.tipo_sofa}</span>
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
