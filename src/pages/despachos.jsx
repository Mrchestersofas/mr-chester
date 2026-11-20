import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/* Despachos: 1) registrar el pago del saldo, 2) despachar con remisión (REM-001…).
   No se puede despachar mientras quede saldo. Al despachar, el pedido queda entregado,
   el cliente lo ve en su seguimiento y la remisión llega por correo (cliente, Mónica y Joseph). */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const pesos = n => '$' + Math.round(Number(n || 0)).toLocaleString('es-CO')
const hoyISO = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10)
function fechaLarga(iso) { if (!iso) return ''; const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return `${d} de ${MESES[m - 1]} de ${y}` }
function fechaCorta(iso) { if (!iso) return '—'; const [, m, d] = String(iso).slice(0, 10).split('-').map(Number); return `${d} ${MESES[m - 1].slice(0, 3)}` }
function primerNombre(n) { const x = String(n || '').trim().split(/\s+/)[0] || ''; return x.charAt(0).toUpperCase() + x.slice(1).toLowerCase() }
const ETAPA = { cola: 'En cola', estructura: 'Estructura', espumado: 'Espumado', corte_tela: 'Corte de tela', tapizado: 'Tapizado', terminado: 'Terminado', control_calidad: 'Control de calidad', despacho: 'Listo', completado: 'Entregado' }
const etapaDe = p => (Array.isArray(p.programacion_produccion) ? p.programacion_produccion[0] : p.programacion_produccion)?.etapa_actual || 'cola'
const MEDIOS = [['efectivo', 'Efectivo'], ['transferencia', 'Transferencia bancaria'], ['tarjeta_credito', 'Tarjeta crédito'], ['tarjeta_debito', 'Tarjeta débito'], ['nequi', 'Nequi'], ['daviplata', 'Daviplata']]

export default function Despachos() {
  const [tab, setTab] = useState('pendientes')
  const [pedidos, setPedidos] = useState(null)
  const [remisiones, setRemisiones] = useState([])
  const [resultado, setResultado] = useState(null)
  const [buscar, setBuscar] = useState('')

  async function cargar() {
    const [{ data: ps }, { data: rs }] = await Promise.all([
      supabase.from('pedidos').select('*, cliente:clientes(*), programacion_produccion(etapa_actual)')
        .not('estado', 'in', '(entregado,cancelado)').order('fecha_entrega'),
      supabase.from('remisiones').select('*, cliente:clientes(*)').order('created_at', { ascending: false }).limit(60),
    ])
    setPedidos(ps || [])
    setRemisiones(rs || [])
  }
  useEffect(() => { cargar() }, [])

  if (resultado) return <Resultado {...resultado} volver={() => { setResultado(null); cargar() }} />
  if (!pedidos) return <div className='p-4 text-gray-500'>Cargando…</div>

  // Agrupar por compra (pedidos con varios productos comparten "grupo")
  const grupos = {}
  pedidos.forEach(p => { const g = p.grupo || p.numero; (grupos[g] = grupos[g] || []).push(p) })
  const lista = Object.entries(grupos).map(([g, items]) => ({ g, items, listos: items.filter(p => etapaDe(p) === 'despacho').length }))
  const listos = lista.filter(x => x.listos > 0)
  const enProduccion = lista.filter(x => x.listos === 0)
  const sinT = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const q = sinT(buscar.trim())
  const encontrados = q ? lista.filter(x => [x.g, x.items[0].cliente?.nombre, x.items[0].cliente?.ciudad, ...x.items.map(p => p.numero + ' ' + p.tipo_sofa)].some(v => sinT(v).includes(q))) : []

  return (
    <div className='p-4 max-w-2xl mx-auto'>
      <h1 className='text-xl font-medium mb-4'>Despachos</h1>
      <div className='flex gap-2 mb-4'>
        {[['pendientes', `Por despachar (${listos.length})`], ['remisiones', 'Remisiones']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg ${tab === k ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{l}</button>
        ))}
      </div>

      {tab === 'pendientes' && (
        <div className='relative mb-3'>
          <input type='search' value={buscar} onChange={e => setBuscar(e.target.value)} placeholder='🔍 Buscar cliente o pedido (para hacer remisión)…' className='w-full pr-9' aria-label='Buscar cliente o pedido' />
          {buscar && <button type='button' aria-label='Borrar búsqueda' onClick={() => setBuscar('')} className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400'>✕</button>}
        </div>
      )}
      {tab === 'pendientes' && q ? (
        <div className='space-y-3'>
          {encontrados.length === 0 && <div className='card text-center text-gray-500 py-6'>No hay pedidos activos para "{buscar.trim()}".</div>}
          {encontrados.map(x => <Grupo key={x.g} x={x} recargar={cargar} alDespachar={setResultado} />)}
        </div>
      ) : tab === 'pendientes' ? (
        <div className='space-y-3'>
          {listos.length === 0 && <div className='card text-center text-gray-500 py-8'>No hay pedidos listos para entregar.<br /><span className='text-xs'>Aparecen aquí cuando en Producción pasan a "Despacho".</span></div>}
          {listos.map(x => <Grupo key={x.g} x={x} recargar={cargar} alDespachar={setResultado} />)}
          {enProduccion.length > 0 && (
            <details className='pt-2'>
              <summary className='text-sm text-gray-600 cursor-pointer py-2'>Pedidos todavía en producción ({enProduccion.length}) — por si necesitas registrar un pago o despachar antes</summary>
              <div className='space-y-3 mt-2'>{enProduccion.map(x => <Grupo key={x.g} x={x} recargar={cargar} alDespachar={setResultado} />)}</div>
            </details>
          )}
        </div>
      ) : (
        <div className='space-y-2'>
          {remisiones.length === 0 && <div className='card text-center text-gray-500 py-8'>Todavía no hay remisiones.</div>}
          {remisiones.map(r => (
            <button key={r.id} className='card w-full text-left flex justify-between gap-2' onClick={() => setResultado({ rem: r, cliente: r.cliente, correo: null })}>
              <div>
                <div className='font-semibold'>{r.numero} · {r.cliente?.nombre || '—'}{r.anticipada && <span className='ml-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5'>Anticipada</span>}</div>
                <div className='text-xs text-gray-500'>{fechaCorta(r.fecha)} · {(r.items || []).map(i => i.tipo_sofa).join(', ')}{r.entregado_por ? ` · ${r.entregado_por}` : ''}</div>
              </div>
              <div className='font-semibold whitespace-nowrap'>{pesos(r.total)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- Una compra (uno o varios productos) ---------- */

function Grupo({ x, recargar, alDespachar }) {
  const [abierto, setAbierto] = useState(false)
  const [sel, setSel] = useState(() => Object.fromEntries(x.items.map(p => [p.id, x.listos === 0 || etapaDe(p) === 'despacho'])))
  const elegidos = x.items.filter(p => sel[p.id])
  const total = elegidos.reduce((s, p) => s + Number(p.precio_venta || 0), 0)
  const pagado = elegidos.reduce((s, p) => s + Number(p.abono || 0), 0)
  const saldo = Math.max(0, total - pagado)
  const c = x.items[0].cliente
  const [por, setPor] = useState('')
  const [telT, setTelT] = useState('')

  return (
    <div className='card p-0 overflow-hidden'>
      <button className='w-full p-4 text-left flex justify-between gap-2' onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
        <div className='min-w-0'>
          <div className='font-semibold'>{x.g} · {c?.nombre || 'Sin cliente'}</div>
          <div className='text-sm text-gray-600 truncate'>{x.items.map(p => p.tipo_sofa + (p.cantidad > 1 ? ` ×${p.cantidad}` : '')).join(' + ')}</div>
          <div className='text-xs text-gray-500'>Entrega prometida {fechaCorta(x.items[0].fecha_entrega)} · {c?.ciudad || 'Bogotá'}</div>
        </div>
        <div className='text-right flex-none'>
          <div className={`text-sm font-semibold ${saldo > 0 ? 'text-red-600' : 'text-green-700'}`}>{saldo > 0 ? `Saldo ${pesos(saldo)}` : '✓ Pagado'}</div>
          <div className='text-xs text-gray-500'>{x.listos}/{x.items.length} listo{x.items.length > 1 ? 's' : ''}</div>
        </div>
      </button>

      {abierto && (
        <div className='border-t border-gray-100 p-4 space-y-4'>
          {c && (
            <div className='text-sm text-gray-700 rounded-lg bg-gray-50 p-3'>
              {c.direccion && <div>📍 {c.direccion}{c.ciudad ? `, ${c.ciudad}` : ''}</div>}
              {c.telefono && <div>📱 {c.telefono}</div>}
              {c.email && <div>✉️ {c.email}</div>}
            </div>
          )}

          <div className='space-y-1.5'>
            {x.items.map(p => (
              <label key={p.id} className='flex items-start gap-2 text-sm cursor-pointer'>
                <input type='checkbox' checked={!!sel[p.id]} onChange={e => setSel(s => ({ ...s, [p.id]: e.target.checked }))} style={{ width: 'auto', marginTop: 3 }} />
                <span className='flex-1'>
                  <b>{p.numero}</b> · {p.tipo_sofa}{p.cantidad > 1 ? ` × ${p.cantidad}` : ''} · {p.material}
                  <span className={`ml-1 text-xs ${etapaDe(p) === 'despacho' ? 'text-green-700' : 'text-amber-700'}`}>({ETAPA[etapaDe(p)] || etapaDe(p)})</span>
                </span>
                <span className='whitespace-nowrap'>{pesos(p.precio_venta)}</span>
              </label>
            ))}
          </div>

          <div className='rounded-lg bg-gray-50 p-3 text-sm space-y-1'>
            <div className='flex justify-between'><span className='text-gray-600'>Total</span><span>{pesos(total)}</span></div>
            <div className='flex justify-between'><span className='text-gray-600'>Pagado</span><span className='text-green-700'>{pesos(pagado)}</span></div>
            <div className='flex justify-between font-semibold pt-1 border-t border-gray-200'><span>Saldo</span><span className={saldo > 0 ? 'text-red-600' : 'text-green-700'}>{pesos(saldo)}</span></div>
          </div>

          <AvisoListo x={x} c={c} recargar={recargar} />

          {elegidos.length > 0 && <Transportador x={x} elegidos={elegidos} saldo={saldo} por={por} setPor={setPor} tel={telT} setTel={setTelT} />}
          {elegidos.length > 0 && <RemisionAnticipada x={x} elegidos={elegidos} total={total} pagado={pagado} por={por} tel={telT} alCrear={alDespachar} />}
          {elegidos.length === 0 ? <p className='text-sm text-gray-500'>Elige al menos un producto.</p>
            : saldo > 0 ? <><CobrarSaldo c={c} elegidos={elegidos} saldo={saldo} /><Pago elegidos={elegidos} saldo={saldo} listo={recargar} /></>
            : <Despachar x={x} elegidos={elegidos} total={total} pagado={pagado} alDespachar={alDespachar} por={por} setPor={setPor} tel={telT} />}
        </div>
      )}
    </div>
  )
}

/* ---------- Avisar al cliente que su sofá está listo (manual, ya no es automático) ---------- */

function AvisoListo({ x, c, recargar }) {
  const listos = x.items.filter(p => etapaDe(p) === 'despacho')
  const [estado, setEstado] = useState(null)
  if (!listos.length) return null
  const sinCorreo = listos.filter(p => !p.aviso_despacho_at)
  const ultimo = listos.map(p => p.aviso_despacho_at).filter(Boolean).sort().slice(-1)[0]
  const tel = String(c?.telefono || '').replace(/\D/g, '')
  const telWa = tel.length === 10 ? '57' + tel : tel
  const productos = listos.map(p => p.tipo_sofa + (p.cantidad > 1 ? ` ×${p.cantidad}` : '')).join(' + ')
  const texto = ['♛ *MR. CHESTER* ♛', '', `Hola, ${primerNombre(c?.nombre)} 🤍`, '',
    `¡Buenas noticias! Tu *${productos}* (pedido ${x.g}) ya está terminado y listo para despacho 🛋️✨`, '',
    'En breve te contactamos para coordinar el día de la entrega. Recuerda que el saldo debe estar cancelado antes del despacho y verifica que el sofá pueda pasar por puertas, escaleras y ascensor.', '',
    '¡Gracias por confiar en Mr. Chester!'].join('\n')

  async function correo() {
    setEstado('enviando')
    let ok = 0, msg = ''
    for (const p of sinCorreo) {
      try {
        const r = await fetch('/api/aviso-despacho', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pedido_id: p.id }) }).then(r => r.json())
        if (r.ok) ok++; else msg = r.detalle || r.motivo || 'No se pudo enviar'
      } catch (e) { msg = e.message }
    }
    setEstado(ok ? `✓ Correo enviado${msg ? ' (con un problema: ' + msg + ')' : ''}` : '⚠️ ' + (msg || 'No se pudo enviar'))
    recargar && recargar()
  }
  async function anotarWa() {
    for (const p of listos) await supabase.from('historial_estados').insert({ pedido_id: p.id, estado_anterior: p.estado, estado_nuevo: p.estado, nota: 'Aviso "tu sofá está listo" enviado por WhatsApp desde
