import { useEffect, useState } from 'react'
import { supabase, Pedido } from '@/lib/supabase'
import { EstadoBadge } from '@/components/Badges'
import Link from 'next/link'
import FlujoFabrica from '@/components/FlujoFabrica'
import VentasEnVivo from '@/components/VentasEnVivo'
import LeadsEnVivo from '@/components/LeadsEnVivo'
import { AlertTriangle, Package, ClipboardList, Wrench, DollarSign, Plus, ShoppingCart, Search, X, Phone, MapPin, User, FileText, Clock } from 'lucide-react'
import { format, differenceInDays, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ETAPAS } from '@/lib/programacion'
import { diaAnteriorHabil } from '@/lib/planificador'

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

/* ---------- Meta de producción: lo programado para hoy y en qué etapa va cada uno ---------- */
const LISTOS = ['terminado', 'control_calidad', 'despacho', 'completado']
const DIAS_L = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES_L = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fDia = (iso: string) => { const d = new Date(iso + 'T12:00:00Z'); return `${DIAS_L[d.getUTCDay()]} ${d.getUTCDate()} ${MESES_L[d.getUTCMonth()]}` }

function FilaMeta({ r }: { r: any }) {
  const et = r.etapa_actual
  const listo = LISTOS.includes(et) || r.pedido?.estado === 'entregado'
  const color = listo ? ETAPA_COLOR['terminado'] : ETAPA_COLOR[et] || ETAPA_COLOR['cola']
  const n = Math.max(1, Number(r.pedido?.cantidad) || 1)
  return (
    <div className='flex items-center justify-between gap-2 py-1.5 border-b border-gray-100 last:border-0'>
      <div className='min-w-0'>
        <p className='text-sm font-medium truncate'>{r.pedido.tipo_sofa}{n > 1 ? ` ×${n}` : ''} <span className='text-gray-400 font-normal'>· {r.pedido.numero}</span></p>
        <p className='text-xs text-gray-500 truncate'>{r.pedido.cliente?.nombre || ''}{r.pedido.material ? ` · ${r.pedido.material}` : ''}</p>
      </div>
      <span className={`flex-none text-xs px-2 py-1 rounded-full font-semibold ${listo ? 'bg-green-100 text-green-800' : color.bg + ' ' + color.text}`}>
        {listo ? '✓ Terminado' : ETAPA_LABEL[et] || et}
      </span>
    </div>
  )
}

function MetaDelDia() {
  const hoy = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10)
  const [filas, setFilas] = useState<any[] | null>(null)
  const [verAtrasados, setVerAtrasados] = useState(false)

  useEffect(() => {
    const desde = new Date(Date.now() - 5 * 3600 * 1000 - 30 * 864e5).toISOString().slice(0, 10)
    supabase.from('programacion_produccion')
      .select('id, etapa_actual, dia_produccion, pedido:pedidos(numero, tipo_sofa, material, cantidad, estado, fecha_entrega, cliente:clientes(nombre))')
      .gte('dia_produccion', desde).lte('dia_produccion', hoy).order('dia_produccion')
      .then(({ data }) => setFilas((data || []).filter((r: any) => r.pedido && r.pedido.estado !== 'cancelado')))
  }, [])

  if (!filas) return <div className='card mb-6 text-sm text-gray-400'>Calculando la meta de hoy…</div>
  const n = (r: any) => Math.max(1, Number(r.pedido?.cantidad) || 1)
  const esListo = (r: any) => LISTOS.includes(r.etapa_actual) || r.pedido?.estado === 'entregado'
  // Día en que debía fabricarse según la fecha prometida (1 día hábil antes); si ya pasó, está atrasado
  const debia = (r: any) => { const fe = String(r.pedido?.fecha_entrega || '').slice(0, 10); const d = fe ? diaAnteriorHabil(fe) : r.dia_produccion; return d < r.dia_produccion ? d : r.dia_produccion }
  const deHoy = filas.filter(r => r.dia_produccion === hoy && debia(r) >= hoy)
  const meta = deHoy.reduce((a, r) => a + n(r), 0)
  const logrados = deHoy.filter(esListo).reduce((a, r) => a + n(r), 0)
  const pct = meta ? Math.round(logrados / meta * 100) : 0
  const atrasados = filas.filter(r => (r.dia_produccion < hoy || debia(r) < hoy) && !esListo(r))
  const porDia: Record<string, any[]> = {}
  atrasados.forEach(r => { const k = debia(r); (porDia[k] = porDia[k] || []).push(r) })
  const color = !meta ? 'text-gray-500' : pct >= 100 ? 'text-green-700' : pct >= 60 ? 'text-amber-600' : 'text-red-600'
  const barra = pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className='space-y-3 mb-6'>
      {atrasados.length > 0 && (
        <div className='card border-red-300 bg-red-50 py-3'>
          <button type='button' className='w-full flex justify-between items-center text-left' onClick={() => setVerAtrasados(!verAtrasados)} aria-expanded={verAtrasados}>
            <span className='text-sm font-semibold text-red-800'>⚠️ {atrasados.length} sofá{atrasados.length > 1 ? 's' : ''} de días anteriores sin terminar</span>
            <span className='text-xs font-semibold text-red-700'>{verAtrasados ? 'Ocultar ▲' : 'Ver ▼'}</span>
          </button>
          {verAtrasados && Object.entries(porDia).sort((a, b) => b[0].localeCompare(a[0])).map(([dd, lista]) => (
            <div key={dd} className='mt-2'>
              <p className='text-xs font-semibold uppercase tracking-wide text-red-700 capitalize'>{fDia(dd)}</p>
              <div className='bg-white rounded-lg px-3 mt-1'>{lista.map(r => <FilaMeta key={r.id} r={r} />)}</div>
            </div>
          ))}
        </div>
      )}

      <div className='card'>
        <div className='flex items-start justify-between gap-3 mb-2'>
          <div>
            <p className='text-xs font-semibold text-gray-500 uppercase tracking-wide'>🎯 Meta de producción · <span className='capitalize'>{fDia(hoy)}</span></p>
            <p className='text-sm text-gray-600 mt-1'>{meta ? <><b>{logrados}</b> de <b>{meta}</b> terminados</> : 'Hoy no hay sofás programados.'}</p>
          </div>
          <div className={`text-3xl font-bold tabular-nums ${color}`}>{meta ? `${pct}%` : '—'}</div>
        </div>
        {meta > 0 && <div className='h-3 rounded-full bg-gray-100 overflow-hidden mb-3'><div className={`h-full ${barra}`} style={{ width: Math.min(100, pct) + '%' }} /></div>}
        {deHoy.map(r => <FilaMeta key={r.id} r={r} />)}
        {meta > 0 && pct < 100 && <p className='text-xs text-gray-500 mt-2'>Cuenta como logrado cuando en Producción o en el Taller se pasa a <b>Terminado</b>.</p>}
      </div>
    </div>
  )
}

const pesosD = (n: number) => '$' + Math.round(Number(n || 0)).toLocaleString('es-CO')
const millones = (n: number) => '$' + (Number(n || 0) / 1_000_000).toFixed(1).replace('.', ',') + 'M'

function Tarjeta({ titulo, icono, href, children, alerta }: any) {
  return (
    <Link href={href} className={`card block hover:border-purple-300 transition-colors ${alerta ? 'border-red-300' : ''}`}>
      <div className='flex items-center justify-between mb-2'>
        <span className='text-xs font-semibold text-gray-500 uppercase tracking-wide'>{icono} {titulo}</span>
        <span className='text-gray-300 text-sm'>›</span>
      </div>
      {children}
    </Link>
  )
}
function Dato({ n, t, color = '' }: any) {
  return <div><div className={`text-xl font-semibold tabular-nums ${color}`}>{n}</div><div className='text-[11px] text-gray-500 leading-tight'>{t}</div></div>
}

export default function Dashboard() {
  const [d, setD] = useState<any>(null)
  const [editMeta, setEditMeta] = useState(false)
  const [metaTxt, setMetaTxt] = useState('')

  async function load() {
    const hoy = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10)
    const mesIni = hoy.slice(0, 8) + '01'
    const dia = new Date(hoy + 'T12:00:00Z').getUTCDay()
    const [ventas, activos, prog, crm, cots, wa, avisos, provs, hechos, mats, ajuste, nomE, nomP] = await Promise.all([
      supabase.from('pedidos').select('precio_venta, grupo, numero').neq('estado', 'cancelado').gte('fecha_pedido', mesIni).lte('fecha_pedido', hoy),
      supabase.from('pedidos').select('id, precio_venta, abono, fecha_entrega, estado').not('estado', 'in', '(entregado,cancelado)'),
      supabase.from('programacion_produccion').select('etapa_actual, pedido:pedidos(estado)'),
      supabase.from('crm_prospectos').select('etapa, created_at, proximo_seguimiento'),
      supabase.from('cotizaciones').select('estado, total, created_at, alarma, seguimientos:cotizacion_seguimientos(created_at)'),
      supabase.from('wa_mensajes').select('telefono, direccion, created_at').gte('created_at', hoy + 'T05:00:00Z'),
      supabase.from('historial_estados').select('pedido_id').gte('created_at', hoy + 'T05:00:00Z').or('nota.ilike.Reprogramado%,nota.ilike.Fecha de entrega%confirmada%,nota.ilike.Mensaje personalizado%'),
      supabase.from('compra_proveedores').select('id, nombre, dias').eq('activo', true),
      supabase.from('compra_pedidos').select('proveedor_id').eq('fecha', hoy),
      supabase.from('materiales').select('nombre, stock_actual, stock_minimo, unidad'),
      supabase.from('ajustes').select('valor').eq('clave', 'meta_ventas_mes').maybeSingle(),
      supabase.from('nom_empleados').select('id, salario').eq('activo', true),
      supabase.from('nom_pagos').select('empleado_id, periodo, total').gte('periodo', mesIni),
    ])
    const act = activos.data || []
    const vMes = (ventas.data || []).reduce((a: number, x: any) => a + Number(x.precio_venta || 0), 0)
    const compras = new Set((ventas.data || []).map((x: any) => x.grupo || x.numero)).size
    const enProg = (prog.data || []).filter((x: any) => x.pedido && !['entregado', 'cancelado'].includes(x.pedido.estado))
    const leads = crm.data || []
    const abiertos = leads.filter((x: any) => ['nuevo', 'contactado', 'cotizado', 'negociando'].includes(x.etapa))
    const provHoy = (provs.data || []).filter((x: any) => (x.dias || []).includes(dia))
    const pedidosHoy = new Set((hechos.data || []).map((x: any) => x.proveedor_id))
    const bajos = (mats.data || []).filter((m: any) => Number(m.stock_minimo) > 0 && Number(m.stock_actual) <= Number(m.stock_minimo))
    // Próximo pago de nómina (días 5 y 20)
    const [y, m, dd] = hoy.split('-').map(Number)
    const sig = dd <= 5 ? `${hoy.slice(0, 8)}05` : dd <= 20 ? `${hoy.slice(0, 8)}20` : new Date(Date.UTC(y, m, 5)).toISOString().slice(0, 10)
    const emps = nomE.data || []
    const pagadosSig = (nomP.data || []).filter((x: any) => x.periodo === sig).length
    setD({
      hoy, vMes, compras, meta: Number(ajuste.data?.valor || 0),
      diaMes: dd, diasMes: new Date(Date.UTC(y, m, 0)).getUTCDate(),
      activos: act.length,
      vencidos: act.filter((x: any) => String(x.fecha_entrega || '') < hoy).length,
      porCobrar: act.reduce((a: number, x: any) => a + Math.max(0, Number(x.precio_venta || 0) - Number(x.abono || 0)), 0),
      cola: enProg.filter((x: any) => x.etapa_actual === 'cola').length,
      fabrica: enProg.filter((x: any) => !['cola', 'despacho', 'completado'].includes(x.etapa_actual)).length,
      listos: enProg.filter((x: any) => x.etapa_actual === 'despacho').length,
      leadsMes: leads.filter((x: any) => String(x.created_at) >= mesIni).length,
      leadsHoy: leads.filter((x: any) => String(x.created_at) >= hoy + 'T05:00:00').length,
      abiertos: abiertos.length,
      seguimientos: abiertos.filter((x: any) => x.proximo_seguimiento && x.proximo_seguimiento <= hoy).length,
      ganadosMes: leads.filter((x: any) => x.etapa === 'ganado' && String(x.created_at) >= mesIni).length,
      cotAbiertas: (cots.data || []).filter((x: any) => x.estado === 'enviada'),
      cotAlarmas: (cots.data || []).filter((x: any) => {
        if (!['enviada', 'aceptada'].includes(x.estado)) return false
        if (x.alarma) return x.alarma <= hoy
        if (x.estado !== 'enviada') return false
        const ult = Math.max(new Date(x.created_at).getTime(), ...(x.seguimientos || []).map((s: any) => new Date(s.created_at).getTime()))
        return Date.now() - ult >= 2 * 864e5
      }).length,
      waHoy: new Set((wa.data || []).filter((x: any) => x.direccion === 'entrante').map((x: any) => x.telefono)).size,
      avisadosHoy: new Set((avisos.data || []).map((x: any) => x.pedido_id)).size,
      provHoy, pedidosHoy, bajos,
      nomina: { fecha: sig, total: emps.reduce((a: number, e: any) => a + Number(e.salario || 0) / 2, 0), pagados: pagadosSig, de: emps.length },
    })
  }
  useEffect(() => { load() }, [])

  async function guardarMeta() {
    const v = Number(metaTxt.replace(/\D/g, '')) || 0
    await supabase.from('ajustes').upsert({ clave: 'meta_ventas_mes', valor: String(v) })
    setEditMeta(false); load()
  }

  if (!d) return <div className='flex items-center justify-center h-screen text-gray-400 text-sm'>Cargando...</div>
  const pctVentas = d.meta ? Math.round(d.vMes / d.meta * 100) : 0
  const proyeccion = d.diaMes ? d.vMes / d.diaMes * d.diasMes : 0
  const ritmoEsperado = d.meta ? d.meta * d.diaMes / d.diasMes : 0
  const vaBien = d.vMes >= ritmoEsperado
  const valorCot = d.cotAbiertas.reduce((a: number, x: any) => a + Number(x.total || 0), 0)
  const faltaPedir = d.provHoy.filter((p: any) => !d.pedidosHoy.has(p.id))
  const diasNom = Math.round((new Date(d.nomina.fecha + 'T12:00:00Z').getTime() - new Date(d.hoy + 'T12:00:00Z').getTime()) / 864e5)

  return (
    <div className='p-4 md:p-6 max-w-6xl mx-auto'>
      <div className='flex items-center justify-between mb-4'>
        <div>
          <h1 className='text-xl font-medium text-gray-900'>Dashboard</h1>
          <p className='text-sm text-gray-400 mt-0.5 capitalize'>{format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}</p>
        </div>
        <Link href='/pedidos/nuevo' className='btn btn-primary'><Plus size={15} /> Nuevo pedido</Link>
      </div>

      <BuscadorPedido />

      <VentasEnVivo />
      <LeadsEnVivo />
      <FlujoFabrica />

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
        <div>
          {/* Ventas del mes vs meta */}
          <div className='card mb-4'>
            <div className='flex items-center justify-between mb-2'>
              <Link href='/ventas' className='text-xs font-semibold text-gray-500 uppercase tracking-wide'>💰 Ventas de {format(new Date(), 'MMMM', { locale: es })} ›</Link>
              <button type='button' className='text-xs text-purple-700 font-semibold' onClick={() => { setMetaTxt(d.meta ? String(d.meta) : ''); setEditMeta(!editMeta) }}>{d.meta ? 'Cambiar meta' : 'Poner meta'}</button>
            </div>
            {editMeta && (
              <div className='flex gap-2 mb-3'>
                <input aria-label='Meta de ventas del mes' inputMode='numeric' placeholder='Ej: 150000000' value={metaTxt} onChange={e => setMetaTxt(e.target.value.replace(/\D/g, ''))} />
                <button className='btn btn-primary' onClick={guardarMeta}>Guardar</button>
              </div>
            )}
            <div className='flex items-end justify-between gap-3'>
              <div>
                <div className='text-3xl font-semibold tabular-nums'>{millones(d.vMes)}</div>
                <div className='text-xs text-gray-500'>{d.compras} compras{d.compras ? ` · ticket promedio ${millones(d.vMes / d.compras)}` : ''}</div>
              </div>
              {d.meta > 0 && <div className={`text-3xl font-bold tabular-nums ${pctVentas >= 100 ? 'text-green-700' : vaBien ? 'text-green-700' : 'text-amber-600'}`}>{pctVentas}%</div>}
            </div>
            {d.meta > 0 ? (
              <>
                <div className='relative h-3 rounded-full bg-gray-100 overflow-hidden mt-3'>
                  <div className={`h-full ${vaBien ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: Math.min(100, pctVentas) + '%' }} />
                  <div className='absolute top-0 bottom-0 w-0.5 bg-gray-800' style={{ left: Math.min(100, d.diaMes / d.diasMes * 100) + '%' }} title='Dónde deberías ir hoy' />
                </div>
                <p className='text-xs text-gray-600 mt-2'>Meta {millones(d.meta)} · {vaBien ? '✅ vas por encima del ritmo' : `⚠ deberías ir en ${millones(ritmoEsperado)}`} · a este ritmo cierras en <b>{millones(proyeccion)}</b></p>
              </>
            ) : <p className='text-xs text-gray-500 mt-2'>Pon la meta del mes para ver cuánto llevas y la proyección al cierre.</p>}
          </div>

          {/* Producción de hoy */}
          <MetaDelDia />
        </div>

        <div className='grid grid-cols-2 gap-4 content-start'>
          <Tarjeta titulo='Producción' icono='🏭' href='/programacion'>
            <div className='grid grid-cols-3 gap-2'>
              <Dato n={d.cola} t='en cola' />
              <Dato n={d.fabrica} t='en fábrica' />
              <Dato n={d.listos} t='listos' color={d.listos ? 'text-green-700' : ''} />
            </div>
          </Tarjeta>

          <Tarjeta titulo='Atención' icono='🎧' href='/atencion' alerta={d.vencidos > 0}>
            <div className='grid grid-cols-3 gap-2'>
              <Dato n={d.vencidos} t='fecha vencida' color={d.vencidos ? 'text-red-600' : 'text-green-700'} />
              <Dato n={d.waHoy} t='escribieron hoy' />
              <Dato n={d.avisadosHoy} t='avisados hoy' />
            </div>
          </Tarjeta>

          <Tarjeta titulo='Leads' icono='🎯' href='/crm' alerta={d.seguimientos > 0}>
            <div className='grid grid-cols-3 gap-2'>
              <Dato n={d.leadsMes} t={`este mes${d.leadsHoy ? ` · ${d.leadsHoy} hoy` : ''}`} />
              <Dato n={d.abiertos} t='abiertos' />
              <Dato n={d.seguimientos} t='seguir hoy' color={d.seguimientos ? 'text-red-600' : ''} />
            </div>
          </Tarjeta>

          <Tarjeta titulo='Cotizaciones' icono='📝' href='/cotizaciones?ver=todas' alerta={d.cotAlarmas > 0}>
            <div className='grid grid-cols-3 gap-2'>
              <Dato n={d.cotAbiertas.length} t='sin cerrar' />
              <Dato n={millones(valorCot)} t='en juego' />
              <Dato n={d.cotAlarmas} t='🔔 seguir hoy' color={d.cotAlarmas ? 'text-red-600' : ''} />
            </div>
          </Tarjeta>

          <Tarjeta titulo='Por cobrar' icono='💵' href='/despachos'>
            <div className='grid grid-cols-2 gap-2'>
              <Dato n={millones(d.porCobrar)} t={`saldos de ${d.activos} pedidos`} />
              <Dato n={d.listos} t='listos para cobrar y despachar' color={d.listos ? 'text-green-700' : ''} />
            </div>
          </Tarjeta>

          <Tarjeta titulo='Nómina' icono='👥' href='/nomina'>
            <div className='grid grid-cols-2 gap-2'>
              <Dato n={millones(d.nomina.total)} t={`${diasNom <= 0 ? 'hoy' : diasNom === 1 ? 'mañana' : `en ${diasNom} días`} (${Number(d.nomina.fecha.slice(8))}/${Number(d.nomina.fecha.slice(5, 7))})`} />
              <Dato n={`${d.nomina.pagados}/${d.nomina.de}`} t='pagados' color={d.nomina.pagados >= d.nomina.de && d.nomina.de ? 'text-green-700' : ''} />
            </div>
          </Tarjeta>

          <div className='col-span-2'>
            <Tarjeta titulo='Compras' icono='🛒' href='/compras' alerta={faltaPedir.length > 0}>
              {d.provHoy.length === 0 ? <p className='text-sm text-gray-500'>Hoy no hay compras programadas.</p> : (
                <div className='flex flex-wrap gap-1.5'>
                  {d.provHoy.map((p: any) => (
                    <span key={p.id} className={`text-xs px-2 py-1 rounded-full font-medium ${d.pedidosHoy.has(p.id) ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{d.pedidosHoy.has(p.id) ? '✓' : '⏳'} {p.nombre}</span>
                  ))}
                </div>
              )}
              {faltaPedir.length > 0 && <p className='text-xs text-amber-700 mt-2'>Falta hacer el pedido a {faltaPedir.length} proveedor{faltaPedir.length > 1 ? 'es' : ''} hoy.</p>}
              {d.bajos.length > 0 && (d.bajos.length <= 8
                ? <p className='text-xs text-red-700 mt-2'>⚠ Bajo el mínimo: {d.bajos.map((m: any) => m.nombre).join(', ')}</p>
                : <p className='text-xs text-gray-500 mt-2'>{d.bajos.length} materiales marcan bajo el mínimo en Materiales (revisa que el inventario esté al día).</p>)}
            </Tarjeta>
          </div>
        </div>
      </div>
    </div>
  )
}
