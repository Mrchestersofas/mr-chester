import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ETAPAS } from '@/lib/programacion'
import { Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react'

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

const ETAPA_COLOR: Record<string, string> = {
  estructura: 'bg-amber-100 text-amber-700 border-amber-300',
  espumado: 'bg-blue-100 text-blue-700 border-blue-300',
  corte_tela: 'bg-purple-100 text-purple-700 border-purple-300',
  tapizado: 'bg-pink-100 text-pink-700 border-pink-300',
  terminado: 'bg-indigo-100 text-indigo-700 border-indigo-300',
  control_calidad: 'bg-orange-100 text-orange-700 border-orange-300',
  despacho: 'bg-green-100 text-green-700 border-green-300',
  completado: 'bg-gray-100 text-gray-500 border-gray-300',
}

function fmtFecha(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

function fmtHora(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function mismodia(iso: string, fecha: Date) {
  if (!iso) return false
  const d = new Date(iso)
  return d.toDateString() === fecha.toDateString()
}

export default function Produccion() {
  const [vista, setVista] = useState<'general' | 'semana' | 'dia'>('general')
  const [programaciones, setProgramaciones] = useState<Programacion[]>([])
  const [loading, setLoading] = useState(true)
  const [fechaRef, setFechaRef] = useState(new Date())

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('programacion_produccion')
      .select('*, pedido:pedidos(numero, tipo_sofa, cliente:clientes(nombre))')
      .order('inicio_estructura', { ascending: true })
    setProgramaciones(data || [])
    setLoading(false)
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

  // Vista general: lista cronológica de todos los pedidos en producción
  function VistaGeneral() {
    const activos = programaciones.filter(p => p.etapa_actual !== 'completado')
    return (
      <div className='card p-0 overflow-hidden'>
        <table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Producto</th>
              <th>Etapa actual</th>
              <th>Inicio</th>
              <th>Despacho est.</th>
            </tr>
          </thead>
          <tbody>
            {activos.map(p => (
              <tr key={p.id}>
                <td><span className='font-medium text-purple-700'>{p.pedido?.numero}</span></td>
                <td>{p.pedido?.cliente?.nombre || '—'}</td>
                <td className='text-gray-500'>{p.pedido?.tipo_sofa}</td>
                <td>
                  <span className={`text-xs px-2 py-1 rounded-full border ${ETAPA_COLOR[p.etapa_actual]}`}>
                    {ETAPAS.find(e => e.key === p.etapa_actual)?.label || p.etapa_actual}
                  </span>
                </td>
                <td className='text-sm text-gray-500'>{fmtFecha(p.inicio_estructura)}</td>
                <td className='text-sm font-medium'>{fmtFecha(p.fin_despacho)}</td>
              </tr>
            ))}
            {activos.length === 0 && (
              <tr><td colSpan={6} className='text-center py-8 text-gray-400 text-sm'>No hay pedidos en producción.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    )
  }

  // Vista semanal: cuadrícula de 7 días mostrando qué pedidos tienen actividad cada día
  function VistaSemana() {
    const inicioSemana = new Date(fechaRef)
    const dia = inicioSemana.getDay()
    const diff = dia === 0 ? -6 : 1 - dia // lunes como inicio
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
            const itemsDelDia = programaciones.filter(p =>
              ETAPAS.some(e => mismodia((p as any)[`inicio_${e.key}`], d))
            )
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
                      return (
                        <div key={p.id} className={`text-xs px-1.5 py-1 rounded border ${ETAPA_COLOR[etapaHoy?.key || '']}`}>
                          <p className='font-medium truncate'>{p.pedido?.numero}</p>
                          <p className='truncate opacity-75'>{etapaHoy?.label}</p>
                        </div>
                      )
                    })}
                    {itemsDelDia.length > 4 && (
                      <p className='text-xs text-gray-400'>+{itemsDelDia.length - 4} más</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Vista diaria: detalle hora por hora de un día específico
  function VistaDia() {
    const itemsDelDia = programaciones.filter(p =>
      ETAPAS.some(e => mismodia((p as any)[`inicio_${e.key}`], fechaRef))
    )

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
              return (
                <div key={p.id} className='card flex items-center justify-between'>
                  <div className='flex items-center gap-4'>
                    <div className={`w-2 h-12 rounded-full ${ETAPA_COLOR[etapaHoy.key].split(' ')[0]}`}></div>
                    <div>
                      <p className='font-medium text-purple-700'>{p.pedido?.numero}</p>
                      <p className='text-sm text-gray-500'>{p.pedido?.tipo_sofa} — {p.pedido?.cliente?.nombre}</p>
                    </div>
                  </div>
                  <div className='text-right'>
                    <span className={`text-xs px-2 py-1 rounded-full border ${ETAPA_COLOR[etapaHoy.key]}`}>
                      {etapaHoy.label}
                    </span>
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
    <div className='p-6 max-w-5xl mx-auto'>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-xl font-medium'>Producción</h1>
          <p className='text-sm text-gray-400 mt-1'>Programación de fabricación — capacidad 3 unidades/día</p>
        </div>
      </div>

      <div className='flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl w-fit'>
        <TabBtn active={vista === 'general'} onClick={() => setVista('general')}>📋 General</TabBtn>
        <TabBtn active={vista === 'semana'} onClick={() => setVista('semana')}>📅 Semana</TabBtn>
        <TabBtn active={vista === 'dia'} onClick={() => setVista('dia')}>🗓️ Día</TabBtn>
      </div>

      {loading ? (
        <div className='card text-center py-16 text-gray-400'>Cargando programación...</div>
      ) : (
        <>
          {vista === 'general' && <VistaGeneral />}
          {vista === 'semana' && <VistaSemana />}
          {vista === 'dia' && <VistaDia />}
        </>
      )}
    </div>
  )
}
