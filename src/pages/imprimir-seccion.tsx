import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabase'
import { ETAPAS } from '@/lib/programacion'

const OFFSET_COLOMBIA = -5

function aFechaColombiaStr(iso: string): string {
  if (!iso) return ''
  const ms = new Date(iso).getTime() + OFFSET_COLOMBIA * 3600000
  const d = new Date(ms)
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function fmtHora(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function fmtFechaLarga(yyyy_mm_dd: string): string {
  if (!yyyy_mm_dd) return ''
  const [y, m, d] = yyyy_mm_dd.split('-').map(Number)
  const fecha = new Date(y, m - 1, d)
  return fecha.toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })
}

export default function ImprimirSeccion() {
  const router = useRouter()
  const { etapa, fecha } = router.query as { etapa?: string; fecha?: string }

  const hoyColom = aFechaColombiaStr(new Date().toISOString())
  const fechaSeleccionada = fecha || hoyColom

  const etapaInfo = ETAPAS.find(e => e.key === etapa)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!etapa) return
    cargar()
  }, [etapa, fecha])

  async function cargar() {
    setLoading(true)
    const campoInicio = `inicio_${etapa}`
    const { data } = await supabase
      .from('programacion_produccion')
      .select(`*, pedido:pedidos(numero, tipo_sofa, material, cantidad, observaciones, prioridad, cliente:clientes(nombre))`)
      .neq('etapa_actual', 'completado')
      .order(campoInicio, { ascending: true })

    const filtrados = (data || []).filter(p => {
      const isoInicio = (p as any)[campoInicio]
      return isoInicio && aFechaColombiaStr(isoInicio) === fechaSeleccionada
    })

    setItems(filtrados)
    setLoading(false)
  }

  if (!etapa || !etapaInfo) {
    return (
      <div className='p-8 text-center'>
        <p className='text-gray-500'>Sección no especificada.</p>
        <p className='text-sm text-gray-400 mt-2'>Usa la URL: <code>/imprimir-seccion?etapa=estructura</code></p>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .print-page { padding: 20px; }
        }
        @media screen {
          body { background: #f3f4f6; }
          .print-page { max-width: 800px; margin: 0 auto; padding: 32px 24px; }
        }
      `}</style>

      <div className='no-print bg-white border-b px-6 py-3 flex items-center justify-between'>
        <button
          onClick={() => router.back()}
          className='text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1'
        >
          ← Volver
        </button>
        <div className='flex items-center gap-3'>
          <div className='flex items-center gap-2'>
            <label className='text-xs text-gray-500'>Sección:</label>
            <select
              value={etapa}
              onChange={e => router.push({ query: { etapa: e.target.value, fecha: fechaSeleccionada } })}
              className='text-sm border rounded px-2 py-1'
            >
              {ETAPAS.map(e => (
                <option key={e.key} value={e.key}>{e.label}</option>
              ))}
            </select>
          </div>
          <div className='flex items-center gap-2'>
            <label className='text-xs text-gray-500'>Fecha:</label>
            <input
              type='date'
              value={fechaSeleccionada}
              onChange={e => router.push({ query: { etapa, fecha: e.target.value } })}
              className='text-sm border rounded px-2 py-1'
            />
          </div>
          <button
            onClick={() => window.print()}
            className='bg-purple-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-purple-700'
          >
            🖨️ Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      <div className='print-page'>
        <div style={{ borderBottom: '2px solid #1a1a1a', paddingBottom: '12px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', letterSpacing: '1px' }}>MR. CHESTER</div>
              <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>Gestión de Producción</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#4f46e5' }}>
                SECCIÓN: {etapaInfo.label.toUpperCase()}
              </div>
              <div style={{ fontSize: '12px', color: '#444', marginTop: '2px', textTransform: 'capitalize' }}>
                {fmtFechaLarga(fechaSeleccionada)}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <p style={{ color: '#999', textAlign: 'center', padding: '40px' }}>Cargando...</p>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#aaa' }}>
            <p style={{ fontSize: '16px' }}>No hay pedidos programados para esta sección hoy.</p>
          </div>
        ) : (
          <>
            <div style={{ background: '#f8f8f8', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '10px 16px', marginBottom: '20px', fontSize: '13px', color: '#444' }}>
              Total de unidades a fabricar hoy en <b>{etapaInfo.label}</b>:{' '}
              <b style={{ fontSize: '16px', color: '#1a1a1a' }}>
                {items.reduce((sum, p) => sum + (p.pedido?.cantidad || 1), 0)} unidades
              </b>
              {' · '}
              {items.length} pedido(s)
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#1a1a1a', color: '#fff' }}>
                  <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: '600', width: '70px' }}>#</th>
                  <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: '600' }}>Modelo</th>
                  <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: '600' }}>Cliente</th>
                  <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: '600' }}>Tela</th>
                  <th style={{ padding: '9px 12px', textAlign: 'center', fontWeight: '600', width: '70px' }}>Cant.</th>
                  <th style={{ padding: '9px 12px', textAlign: 'center', fontWeight: '600', width: '80px' }}>Hora</th>
                  <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: '600' }}>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p, i) => {
                  const isoInicio = (p as any)[`inicio_${etapa}`]
                  const esUrgente = p.pedido?.prioridad === 'urgente'
                  const esAlta = p.pedido?.prioridad === 'alta'
                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: '1px solid #e5e5e5',
                        background: esUrgente ? '#fff5f5' : i % 2 === 0 ? '#fff' : '#fafafa',
                      }}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#4f46e5' }}>
                        {p.pedido?.numero || '—'}
                        {esUrgente && <span style={{ display: 'block', fontSize: '10px', color: '#dc2626', fontWeight: 'bold' }}>URGENTE</span>}
                        {esAlta && !esUrgente && <span style={{ display: 'block', fontSize: '10px', color: '#d97706' }}>ALTA</span>}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: '500' }}>{p.pedido?.tipo_sofa || '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#555' }}>{p.pedido?.cliente?.nombre || '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#555' }}>{p.pedido?.material || '—'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 'bold' }}>{p.pedido?.cantidad || 1}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#444', fontWeight: '500' }}>{fmtHora(isoInicio)}</td>
                      <td style={{ padding: '10px 12px', color: '#666', fontSize: '12px' }}>
                        {p.pedido?.observaciones || <span style={{ color: '#ccc' }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'flex-end', gap: '60px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderTop: '1px solid #999', paddingTop: '6px', width: '160px', fontSize: '11px', color: '#666' }}>
                  Encargado de sección
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderTop: '1px solid #999', paddingTop: '6px', width: '160px', fontSize: '11px', color: '#666' }}>
                  Jefe de producción
                </div>
              </div>
            </div>

            <div style={{ marginTop: '24px', fontSize: '10px', color: '#bbb', textAlign: 'center' }}>
              Impreso el {new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · Mr. Chester ERP
            </div>
          </>
        )}
      </div>
    </>
  )
}