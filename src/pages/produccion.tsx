import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ETAPAS } from '@/lib/programacion'
import { Calendar, Clock, ChevronLeft, ChevronRight, ArrowRight, Package, X, Phone, MapPin, User, FileText } from 'lucide-react'

interface Programacion {
  id: string
  pedido_id: string
  etapa_actual: string
  inicio_estructura: string
  fin_estructura: string
  inicio_espumado: string
  fin_espumado: string
  inicio_corte_tela: string
  fin_corte_tela: string
  inicio_tapizado: string
  fin_tapizado: string
  inicio_terminado: string
  fin_terminado: string
  inicio_control_calidad: string
  fin_control_calidad: string
  inicio_despacho: string
  fin_despacho: string
  pedido?: any
}

function TabBtn({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${active ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
      {children}
    </button>
  )
}

const ETAPA_HEADER: Record<string, { bg: string; text: string; dot: string }> = {
  estructura:        { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  espumado:          { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  corte_tela:        { bg: 'bg-purple-50',  text: 'text-purple-700',  dot: 'bg-purple-500' },
  tapizado:          { bg: 'bg-pink-50',    text: 'text-pink-700',    dot: 'bg-pink-500' },
  terminado:         { bg: 'bg-indigo-50',  text: 'text-indigo-700',  dot: 'bg-indigo-500' },
  control_calidad:   { bg: 'bg-orange-50',  text: 'text-orange-700',  dot: 'bg-orange-500' },
  despacho:          { bg: 'bg-green-50',   text: 'text-green-700',   dot: 'bg-green-500' },
}

const PRIORIDAD_COLOR: Record<string, string> = {
  urgente: 'border-l-4 border-l-red-500',
  alta: 'border-l-4 border-l-amber-500',
  normal: 'border-l-4 border-l-gray-200',
}

function semaforo(fechaEntrega: string) {
  if (!fechaEntrega) return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const entrega = new Date(fechaEntrega); entrega.setHours(0, 0, 0, 0)
  const dias = Math.ceil((entrega.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  if (dias < 0) return { color: '#ef4444', titulo: `Vencido hace ${Math.abs(dias)} día(s)` }
  if (dias <= 3) return { color: '#f59e0b', titulo: `Vence en ${dias} día(s)` }
  return { color: '#22c55e', titulo: `${dias} día(s) restantes` }
}

function fmtHora(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function fmtFecha(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function mismodia(iso: string, fecha: Date) {
  if (!iso) return false
  const d = new Date(iso)
  return d.toDateString() === fecha.toDateString()
}

async function avanzarEtapa(prog: Programacion, recargar: () => void) {
  const idx = ETAPAS.findIndex(e => e.key === prog.etapa_actual)
  if (idx === -1 || idx === ETAPAS.length - 1) {
    await supabase.from('programacion_produccion').update({ etapa_actual: 'completado' }).eq('id', prog.id)
    await supabase.from('pedidos').update({ estado: 'entregado' }).eq('id', prog.pedido_id)
  } else {
    const siguienteEtapa = ETAPAS[idx + 1].key
    await supabase.from('programacion_produccion').update({ etapa_actual: siguienteEtapa }).eq('id', prog.id)
    const estadoPedido = siguienteEtapa === 'control_calidad' ? 'control_calidad'
      : siguienteEtapa === 'tapizado' ? 'tapizado'
      : 'estructura'
    await supabase.from('pedidos').update({ estado: estadoPedido }).eq('id', prog.pedido_id)
  }
  recargar()
}

function ModalDetalle({ prog, onClose }: { prog: Programacion, onClose: () => void }) {
  const p = prog.pedido
  const c = p?.cliente
  const s = semaforo(p?.fecha_entrega)
  const etapaActual = ETAPAS.find(e => e.key === prog.etapa_actual)

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center p-4'
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className='bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto'
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className='flex items-center justify-between px-5 py-4 border-b'>
          <div className='flex items-center gap-3'>
            <span className='text-lg font-bold text-purple-700'>{p?.numero}</span>
            {s && (
              <span
                title={s.titulo}
                style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, display: 'inline-block' }}
              />
            )}
            {s && <span className='text-xs text-gray-400'>{s.titulo}</span>}
          </div>
          <button onClick={onClose} className='text-gray-400 hover:text-gray-600 transition-colors'>
            <X size={20} />
          </button>
        </div>

        <div className='p-5 space-y-5'>

          {/* Estado actual */}
          <div className='flex items-center gap-2'>
            <span className='text-xs text-gray-500'>Etapa actual:</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ETAPA_HEADER[prog.etapa_actual]?.bg} ${ETAPA_HEADER[prog.etapa_actual]?.text}`}>
              {etapaActual?.label || prog.etapa_actual}
            </span>
          </div>

          {/* Datos del pedido */}
          <section>
            <h3 className='text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3'>Pedido</h3>
            <div className='grid grid-cols-2 gap-3'>
              <div className='bg-gray-50 rounded-lg p-3'>
                <p className='text-xs text-gray-400 mb-0.5'>Modelo / Referencia</p>
                <p className='text-sm font-medium'>{p?.tipo_sofa || '—'}</p>
              </div>
              <div className='bg-gray-50 rounded-lg p-3'>
                <p className='text-xs text-gray-400 mb-0.5'>Tela / Material</p>
                <p className='text-sm font-medium'>{p?.material || '—'}</p>
              </div>
              <div className='bg-gray-50 rounded-lg p-3'>
                <p className='text-xs text-gray-400 mb-0.5'>Cantidad</p>
                <p className='text-sm font-medium'>{p?.cantidad || 1} unidad(es)</p>
              </div>
              <div className='bg-gray-50 rounded-lg p-3'>
                <p className='text-xs text-gray-400 mb-0.5'>Prioridad</p>
                <p className='text-sm font-medium capitalize'>{p?.prioridad || 'normal'}</p>
              </div>
              <div className='bg-gray-50 rounded-lg p-3'>
                <p className='text-xs text-gray-400 mb-0.5'>Fecha de entrega</p>
                <p className='text-sm font-medium'>{p?.fecha_entrega ? new Date(p.fecha_entrega + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}</p>
              </div>
              <div className='bg-gray-50 rounded-lg p-3'>
                <p className='text-xs text-gray-400 mb-0.5'>Precio de venta</p>
                <p className='text-sm font-medium'>${Number(p?.precio_venta || 0).toLocaleString('es-CO')}</p>
              </div>
            </div>
            {p?.observaciones && (
              <div className='mt-3 bg-amber-50 border border-amber-100 rounded-lg p-3 flex gap-2'>
                <FileText size={14} className='text-amber-500 mt-0.5 flex-shrink-0' />
                <div>
                  <p className='text-xs text-amber-600 font-medium mb-0.5'>Observaciones</p>
                  <p className='text-sm text-gray-700'>{p.observaciones}</p>
                </div>
              </div>
            )}
          </section>

          {/* Datos del cliente */}
          <section>
            <h3 className='text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3'>Cliente</h3>
            <div className='space-y-2'>
              <div className='flex items-center gap-2'>
                <User size={14} className='text-gray-400 flex-shrink-0' />
                <div>
                  <p className='text-sm font-medium'>{c?.nombre || '—'}</p>
                  {c?.cedula && <p className='text-xs text-gray-400'>CC {c.cedula}</p>}
                </div>
              </div>
              {c?.telefono && (
                <div className='flex items-center gap-2'>
                  <Phone size={14} className='text-gray-400 flex-shrink-0' />
                  <a href={`https://wa.me/57${c.telefono}`} target='_blank' rel='noreferrer' className='text-sm text-green-600 hover:underline'>
                    {c.telefono}
                  </a>
                </div>
              )}
              {(c?.direccion || c?.ciudad) && (
                <div className='flex items-center gap-2'>
                  <MapPin size={14} className='text-gray-400 flex-shrink-0' />
                  <p className='text-sm text-gray-600'>{[c?.direccion, c?.ciudad].filter(Boolean).join(', ')}</p>
                </div>
              )}
              {c?.email && (
                <div className='flex items-center gap-2'>
                  <span className='text-gray-400 text-xs'>✉</span>
                  <p className='text-sm text-gray-600'>{c.email}</p>
                </div>
              )}
            </div>
          </section>

          {/* Cronograma */}
          <section>
            <h3 className='text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3'>Cronograma</h3>
            <div className='space-y-1.5'>
              {ETAPAS.map(etapa => {
                const inicio = (prog as any)[`inicio_${etapa.key}`]
                const fin = (prog as any)[`fin_${etapa.key}`]
                const esActual = prog.etapa_actual === etapa.key
                const color = ETAPA_HEADER[etapa.key]
                return (
                  <div key={etapa.key} className={`flex items-center justify-between rounded-lg px-3 py-2 ${esActual ? color.bg : 'bg-gray-50'}`}>
                    <div className='flex items-center gap-2'>
                      <span className={`w-2 h-2 rounded-full ${esActual ? color.dot : 'bg-gray-300'}`} />
                      <span className={`text-xs font-medium ${esActual ? color.text : 'text-gray-500'}`}>{etapa.label}</span>
                      {esActual && <span className={`text-xs px-1.5 rounded-full bg-white/60 ${color.text}`}>En curso</span>}
                    </div>
                    <span className='text-xs text-gray-400'>
                      {inicio ? `${fmtHora(inicio)} → ${fmtHora(fin)}` : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}

export default function Produccion() {
  const [vista, setVista] = useState<'kanban' | 'semana' | 'dia'>('kanban')
  const [programaciones, setProgramaciones] = useState<Programacion[]>([])
  const [loading, setLoading] = useState(true)
  const [fechaRef, setFechaRef] = useState(new Date())
  const [moviendo, setMoviendo] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<Programacion | null>(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('programacion_produccion')
      .select('*, pedido:pedidos(numero, tipo_sofa, material, color, cantidad, prioridad, fecha_entrega, precio_venta, observaciones, cliente:clientes(nombre, cedula, telefono, direccion, ciudad, email))')
      .neq('etapa_actual', 'completado')
      .order('inicio_estructura', { ascending: true })
    setProgramaciones(data || [])
    setLoading(false)
  }

  async function handleAvanzar(prog: Programacion) {
    setMoviendo(prog.id)
    await avanzarEtapa(prog, cargar)
    setMoviendo(null)
  }

  function cambiarSemana(dir: number) {
    const nueva = new Date(fechaRef)
    nueva.setDate(nueva.getDate() + dir * 7)
    setFechaRef(nueva)
  }

  function cambiarDia(dir: number) {
    const nueva = new Date(fechaRef)
    nueva.setDate(nueva.getDate() + dir)
    setFechaRef(nueva)
  }

  function VistaKanban() {
    return (
      <div className='flex gap-3 overflow-x-auto pb-4' style={{ scrollbarWidth: 'thin' }}>
        {ETAPAS.map(etapa => {
          const items = programaciones.filter(p => p.etapa_actual === etapa.key)
          const color = ETAPA_HEADER[etapa.key]
          return (
            <div key={etapa.key} className='flex-shrink-0 w-64'>
              <div className={`${color.bg} rounded-t-lg px-3 py-2.5 flex items-center justify-between`}>
                <div className='flex items-center gap-2'>
                  <span className={`w-2 h-2 rounded-full ${color.dot}`}></span>
                  <span className={`text-xs font-semibold ${color.text}`}>{etapa.label}</span>
                </div>
                <div className='flex items-center gap-1.5'>
                  <span className={`text-xs font-bold ${color.text} bg-white/60 rounded-full px-2 py-0.5`}>{items.length}</span>
                  <button
                    onClick={() => window.open(`/imprimir-seccion?etapa=${etapa.key}`, '_blank')}
                    className={`text-xs ${color.text} bg-white/60 hover:bg-white/90 rounded px-1.5 py-0.5 transition-colors`}
                    title='Imprimir programación de hoy'
                  >
                    🖨️
                  </button>
                </div>
              </div>
              <div className='bg-gray-50 rounded-b-lg p-2 min-h-[400px] space-y-2'>
                {items.length === 0 && (
                  <p className='text-xs text-gray-300 text-center py-6'>Sin pedidos</p>
                )}
                {items.map(p => {
                  const esUltima = etapa.key === 'despacho'
                  const s = semaforo(p.pedido?.fecha_entrega)
                  return (
                    <div
                      key={p.id}
                      className={`bg-white rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow ${PRIORIDAD_COLOR[p.pedido?.prioridad || 'normal']}`}
                      onClick={() => setDetalle(p)}
                    >
                      <div className='flex items-start justify-between mb-1'>
                        <span className='text-sm font-semibold text-purple-700'>{p.pedido?.numero}</span>
                        <div className='flex items-center gap-1.5'>
                          {s && (
                            <span title={s.titulo} style={{ width: 9, height: 9, borderRadius: '50%', background: s.color, display: 'inline-block', flexShrink: 0 }} />
                          )}
                          {p.pedido?.prioridad === 'urgente' && (
                            <span className='text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded'>Urgente</span>
                          )}
                        </div>
                      </div>
                      <p className='text-xs text-gray-600 mb-0.5 truncate'>{p.pedido?.tipo_sofa}</p>
                      <p className='text-xs text-gray-400 mb-2 truncate'>{p.pedido?.cliente?.nombre || '—'}</p>
                      <div className='flex items-center justify-between'>
                        <span className='text-xs text-gray-400 flex items-center gap-1'>
                          <Clock size={10} /> {fmtHora((p as any)[`inicio_${etapa.key}`])}
                        </span>
                        <button
                          onClick={e => { e.stopPropagation(); handleAvanzar(p) }}
                          disabled={moviendo === p.id}
                          className='text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-md px-2 py-1 flex items-center gap-1 transition-colors disabled:opacity-50'
                        >
                          {moviendo === p.id ? '...' : esUltima ? <>Listo ✓</> : <>Avanzar <ArrowRight size={11} /></>}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  function VistaSemana() {
    const inicioSemana = new Date(fechaRef)
    const dia = inicioSemana.getDay()
    const diff = dia === 0 ? -6 : 1 - dia
    inicioSemana.setDate(inicioSemana.getDate() + diff)
    const dias = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(inicioSemana)
      d.setDate(d.getDate() + i)
      return d
    })
    return (
      <div>
        <div className='flex items-center justify-between mb-4'>
          <button onClick={() => cambiarSemana(-1)} className='btn p-2'><ChevronLeft size={16} /></button>
          <p className='text-sm font-medium'>
            {dias[0].toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} — {dias[6].toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
          <button onClick={() => cambiarSemana(1)} className='btn p-2'><ChevronRight size={16} /></button>
        </div>
        <div className='grid grid-cols-7 gap-2'>
          {dias.map((d, i) => {
            const esDomingo = d.getDay() === 0
            const itemsDelDia = programaciones.filter(p => ETAPAS.some(e => mismodia((p as any)[`inicio_${e.key}`], d)))
            return (
              <div key={i} className={`card p-2 min-h-[140px] ${esDomingo ? 'bg-gray-50' : ''}`}>
                <p className='text-xs font-medium text-gray-400 mb-2'>
                  {d.toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit' })}
                </p>
                {esDomingo ? (
                  <p className='text-xs text-gray-300 italic'>Cerrado</p>
                ) : itemsDelDia.length === 0 ? (
                  <p className='text-xs text-gray-300'>—</p>
                ) : (
                  <div className='space-y-1'>
                    {itemsDelDia.slice(0, 4).map(p => {
                      const etapaHoy = ETAPAS.find(e => mismodia((p as any)[`inicio_${e.key}`], d))
                      const color = ETAPA_HEADER[etapaHoy?.key || '']
                      return (
                        <div key={p.id} onClick={() => setDetalle(p)} className={`text-xs px-1.5 py-1 rounded cursor-pointer hover:opacity-80 ${color?.bg} ${color?.text}`}>
                          <p className='font-medium truncate'>{p.pedido?.numero}</p>
                          <p className='truncate opacity-75'>{etapaHoy?.label}</p>
                        </div>
                      )
                    })}
                    {itemsDelDia.length > 4 && <p className='text-xs text-gray-400'>+{itemsDelDia.length - 4} más</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function VistaDia() {
    const itemsDelDia = programaciones.filter(p => ETAPAS.some(e => mismodia((p as any)[`inicio_${e.key}`], fechaRef)))
    return (
      <div>
        <div className='flex items-center justify-between mb-4'>
          <button onClick={() => cambiarDia(-1)} className='btn p-2'><ChevronLeft size={16} /></button>
          <p className='text-sm font-medium capitalize'>
            {fechaRef.toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
          <button onClick={() => cambiarDia(1)} className='btn p-2'><ChevronRight size={16} /></button>
        </div>
        {itemsDelDia.length === 0 ? (
          <div className='card text-center py-16'>
            <Calendar size={32} className='mx-auto text-gray-300 mb-3' />
            <p className='text-gray-400 text-sm'>No hay actividad de producción programada este día.</p>
          </div>
        ) : (
          <div className='space-y-3'>
            {itemsDelDia.map(p => {
              const etapaHoy = ETAPAS.find(e => mismodia((p as any)[`inicio_${e.key}`], fechaRef))
              if (!etapaHoy) return null
              const inicioISO = (p as any)[`inicio_${etapaHoy.key}`]
              const finISO = (p as any)[`fin_${etapaHoy.key}`]
              const color = ETAPA_HEADER[etapaHoy.key]
              const s = semaforo(p.pedido?.fecha_entrega)
              return (
                <div key={p.id} onClick={() => setDetalle(p)} className='card flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow'>
                  <div className='flex items-center gap-4'>
                    <div className={`w-2 h-12 rounded-full ${color.dot}`}></div>
                    <div>
                      <div className='flex items-center gap-2'>
                        <p className='font-medium text-purple-700'>{p.pedido?.numero}</p>
                        {s && <span title={s.titulo} style={{ width: 9, height: 9, borderRadius: '50%', background: s.color, display: 'inline-block' }} />}
                      </div>
                      <p className='text-sm text-gray-500'>{p.pedido?.tipo_sofa} — {p.pedido?.cliente?.nombre}</p>
                    </div>
                  </div>
                  <div className='text-right'>
                    <span className={`text-xs px-2 py-1 rounded-full ${color.bg} ${color.text}`}>{etapaHoy.label}</span>
                    <p className='text-xs text-gray-400 mt-1 flex items-center gap-1 justify-end'>
                      <Clock size={11} /> {fmtHora(inicioISO)} – {fmtHora(finISO)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className='p-6 max-w-7xl mx-auto'>
      {detalle && <ModalDetalle prog={detalle} onClose={() => setDetalle(null)} />}
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-xl font-medium'>Producción</h1>
          <p className='text-sm text-gray-400 mt-1'>Tablero de fabricación — capacidad 3 unidades/día</p>
        </div>
        <div className='flex items-center gap-2 text-sm text-gray-500'>
          <Package size={15} />
          {programaciones.length} pedido(s) en proceso
        </div>
      </div>
      <div className='flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl w-fit'>
        <TabBtn active={vista === 'kanban'} onClick={() => setVista('kanban')}>🗂️ Tablero</TabBtn>
        <TabBtn active={vista === 'semana'} onClick={() => setVista('semana')}>📅 Semana</TabBtn>
        <TabBtn active={vista === 'dia'} onClick={() => setVista('dia')}>🗓️ Día</TabBtn>
      </div>
      {loading ? (
        <div className='card text-center py-16 text-gray-400'>Cargando programación...</div>
      ) : (
        <>
          {vista === 'kanban' && <VistaKanban />}
          {vista === 'semana' && <VistaSemana />}
          {vista === 'dia' && <VistaDia />}
        </>
      )}
    </div>
  )
}