import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { planificar, hoyColombia } from '@/lib/planificador'

/* Atención al cliente.
   Retrasados: pedidos con fecha vencida o que no alcanzan la fecha prometida. Para cada compra se
   sugiere la nueva fecha (la de la programación), se arma un mensaje de disculpa y con un toque se
   abre WhatsApp y se reprograma la fecha de entrega en el ERP. */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const URL_SEGUIMIENTO = 'https://seguimiento.mrchester.com.co'
function fechaLarga(iso) { if (!iso) return ''; const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z'); return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}` }
function fechaCorta(iso) { if (!iso) return '—'; const [, m, d] = String(iso).slice(0, 10).split('-').map(Number); return `${d} ${MESES[m - 1].slice(0, 3)}` }
function primerNombre(n) { const x = String(n || '').trim().split(/\s+/)[0] || ''; return x.charAt(0).toUpperCase() + x.slice(1).toLowerCase() }
const dias = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5)

function mensaje(x, fecha, avisos) {
  const nombre = primerNombre(x.cliente?.nombre)
  const productos = x.items.map(i => i.pedido.tipo_sofa + (Number(i.pedido.cantidad) > 1 ? ` ×${i.pedido.cantidad}` : '')).join(' + ')
  const listo = x.items.every(i => i.etapa_actual === 'despacho')
  const intro = avisos > 0
    ? [`Sabemos que ya te habíamos dado una nueva fecha para tu *${productos}* (pedido ${x.g}) y no pudimos cumplirla. Te pedimos sinceras disculpas: entendemos tu molestia y tienes toda la razón.`,
       'Nuestro equipo está haciendo seguimiento diario a tu pedido para que esta vez sí te cumplamos.']
    : listo
      ? [`Queremos contarte personalmente que tu *${productos}* (pedido ${x.g}) ya está terminado, pero su entrega se retrasó. Lamentamos mucho la espera y entendemos lo importante que es para ti tenerlo en casa.`]
      : [`Queremos escribirte personalmente para contarte que tu *${productos}* (pedido ${x.g}) tiene un retraso en la fabricación. Lamentamos mucho esta situación y entendemos lo importante que es para ti recibirlo a tiempo.`,
         'Cada sofá Mr. Chester se hace a mano, pieza por pieza, y en estas semanas tenemos una demanda muy alta. Preferimos tomarnos el tiempo necesario antes que entregarte algo que no cumpla con nuestra calidad.']
  return [
    '♛ *MR. CHESTER* ♛',
    '',
    `Hola, ${nombre} 🤍`,
    '',
    ...intro.flatMap(t => [t, '']),
    `📅 Tu nueva fecha de entrega es el *${fechaLarga(fecha)}*.`,
    '',
    `Ya quedó reprogramado en nuestro sistema. Puedes seguir el avance de tu sofá aquí: ${URL_SEGUIMIENTO} (con tu número de cédula).`,
    '',
    'Si tienes cualquier inquietud, escríbenos por aquí y con gusto te atendemos.',
    '',
    'Gracias de corazón por tu paciencia y por confiar en nosotros 🙏',
    '*Equipo Mr. Chester*',
  ].join('\n')
}

export default function Atencion() {
  const [lista, setLista] = useState(null)
  const [error, setError] = useState(null)
  const hoy = hoyColombia()

  async function cargar() {
    const [{ data: filas, error: e }, { data: productos }, { data: hist }] = await Promise.all([
      supabase.from('programacion_produccion').select('*, pedido:pedidos(id, numero, grupo, tipo_sofa, cantidad, estado, fecha_pedido, fecha_entrega, cliente:clientes(nombre, telefono, ciudad))'),
      supabase.from('productos').select('referencia, categoria'),
      supabase.from('historial_estados').select('pedido_id, nota, created_at').ilike('nota', 'Reprogramado%'),
    ])
    if (e) { setError(e.message); return }
    const { plan } = planificar(filas || [], productos || [])
    const avisosDe = id => (hist || []).filter(h => h.pedido_id === id)
    const grupos = {}
    plan.forEach(f => { const g = f.pedido.grupo || f.pedido.numero; (grupos[g] = grupos[g] || []).push(f) })
    const out = Object.entries(grupos).map(([g, items]) => {
      const prometida = items.map(i => i.prometida).filter(Boolean).sort()[0] || ''
      const sugerida = items.map(i => i.entrega_max).sort().slice(-1)[0]
      const vencido = prometida && prometida < hoy
      const tarde = items.some(i => i.estado === 'tarde')
      const avisos = avisosDe(items[0].pedido.id)
      return { g, items, cliente: items[0].pedido.cliente, prometida, sugerida, vencido, tarde, avisos: avisos.length, ultimoAviso: avisos.map(a => a.created_at).sort().slice(-1)[0] }
    }).filter(x => x.vencido || x.tarde)
      .sort((a, b) => a.prometida.localeCompare(b.prometida))
    setLista(out)
  }
  useEffect(() => { cargar() }, [])

  if (error) return <div className='p-4 max-w-2xl mx-auto'><p className='rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700'>No se pudo cargar: {error}</p></div>
  if (!lista) return <div className='p-4 text-gray-500'>Revisando pedidos…</div>

  const vencidos = lista.filter(x => x.vencido)
  const proximos = lista.filter(x => !x.vencido)
  return (
    <div className='p-4 max-w-2xl mx-auto'>
      <h1 className='text-xl font-medium'>Atención al cliente</h1>
      <p className='text-sm text-gray-500 mb-4'>Avísale al cliente antes de que pregunte. La nueva fecha sale de la programación de la fábrica; puedes cambiarla.</p>

      <div className='grid grid-cols-2 gap-3 mb-4'>
        <div className='card text-center'><p className={`text-2xl font-bold ${vencidos.length ? 'text-red-600' : 'text-green-700'}`}>{vencidos.length}</p><p className='text-xs text-gray-500'>con fecha vencida</p></div>
        <div className='card text-center'><p className={`text-2xl font-bold ${proximos.length ? 'text-amber-600' : 'text-green-700'}`}>{proximos.length}</p><p className='text-xs text-gray-500'>van a llegar tarde</p></div>
      </div>

      {lista.length === 0 && <div className='card text-center text-gray-500 py-8'>✅ No hay pedidos retrasados.</div>}
      {vencidos.length > 0 && <h2 className='text-sm font-semibold uppercase tracking-wide text-red-600 mb-2'>Fecha vencida · avisar ya</h2>}
      <div className='space-y-3 mb-6'>
        {vencidos.map(x => <Retrasado key={x.g} x={x} hoy={hoy} recargar={cargar} />)}
      </div>
      {proximos.length > 0 && (
        <>
          <h2 className='text-sm font-semibold uppercase tracking-wide text-amber-600 mb-1'>Van a llegar tarde · avisar con tiempo</h2>
          <p className='text-xs text-gray-500 mb-2'>Todavía no se vence la fecha, pero con los cupos de la fábrica no alcanzan. Avisar antes evita que el cliente se moleste.</p>
          <div className='space-y-3'>
            {proximos.map(x => <Retrasado key={x.g} x={x} hoy={hoy} recargar={cargar} />)}
          </div>
        </>
      )}
    </div>
  )
}

function Retrasado({ x, hoy, recargar }) {
  const [abierto, setAbierto] = useState(false)
  const [fecha, setFecha] = useState(x.sugerida)
  const [texto, setTexto] = useState(() => mensaje(x, x.sugerida, x.avisos))
  const [editado, setEditado] = useState(false)
  const [hecho, setHecho] = useState(false)
  const [error, setError] = useState(null)
  useEffect(() => { if (!editado) setTexto(mensaje(x, fecha, x.avisos)) }, [fecha])

  const tel = String(x.cliente?.telefono || '').replace(/\D/g, '')
  const telWa = tel.length === 10 ? '57' + tel : tel
  const atraso = x.prometida && x.prometida < hoy ? dias(x.prometida, hoy) : 0
  const antes = fecha && fecha < x.sugerida

  async function reprogramar() {
    setError(null)
    for (const i of x.items) {
      const { error: e1 } = await supabase.from('pedidos').update({ fecha_entrega: fecha }).eq('id', i.pedido.id)
      if (e1) { setError('No se pudo cambiar la fecha: ' + e1.message); return }
      await supabase.from('historial_estados').insert({ pedido_id: i.pedido.id, estado_anterior: i.pedido.estado, estado_nuevo: i.pedido.estado, nota: `Reprogramado: entrega del ${x.prometida || 'sin fecha'} al ${fecha}. Cliente avisado por WhatsApp.` })
    }
    setHecho(true)
    setTimeout(recargar, 1500)
  }

  return (
    <div className={`card p-0 overflow-hidden ${hecho ? 'opacity-60' : ''}`}>
      <button type='button' className='w-full p-4 text-left flex justify-between gap-3' onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
        <div className='min-w-0'>
          <div className='font-semibold'>{x.g} · {x.cliente?.nombre || 'Sin cliente'}</div>
          <div className='text-sm text-gray-600 truncate'>{x.items.map(i => i.pedido.tipo_sofa).join(' + ')}</div>
          <div className='text-xs text-gray-500'>
            Prometido {fechaCorta(x.prometida)} → nueva {fechaCorta(x.sugerida)}
            {x.avisos > 0 && <span className='text-amber-700'> · ya avisado {x.avisos} {x.avisos === 1 ? 'vez' : 'veces'}</span>}
          </div>
        </div>
        <div className='text-right flex-none'>
          {hecho ? <span className='text-sm font-semibold text-green-700'>✓ Avisado</span>
            : atraso > 0 ? <span className='text-sm font-semibold text-red-600'>{atraso} día{atraso > 1 ? 's' : ''} tarde</span>
            : <span className='text-sm font-semibold text-amber-600'>Va a llegar tarde</span>}
        </div>
      </button>

      {abierto && !hecho && (
        <div className='border-t border-gray-100 p-4 space-y-3'>
          <div>
            <label htmlFor={`f-${x.g}`} className='text-xs text-gray-500 mb-1 block'>Nueva fecha de entrega</label>
            <input id={`f-${x.g}`} type='date' value={fecha} onChange={e => setFecha(e.target.value)} />
            <p className='text-xs text-gray-500 mt-1'>Sugerida por la programación: {fechaLarga(x.sugerida)}.</p>
            {antes && <p className='text-xs text-amber-700 mt-1'>⚠ Es antes de lo que da la programación. Asegúrate de poder cumplirla para no volver a fallarle.</p>}
          </div>
          <div>
            <label htmlFor={`m-${x.g}`} className='text-xs text-gray-500 mb-1 block'>Mensaje (lo puedes editar)</label>
            <textarea id={`m-${x.g}`} rows={12} className='w-full text-sm' value={texto} onChange={e => { setTexto(e.target.value); setEditado(true) }} />
            {editado && <button type='button' className='text-xs underline text-gray-500' onClick={() => { setEditado(false); setTexto(mensaje(x, fecha, x.avisos)) }}>Volver al mensaje original</button>}
          </div>
          {error && <p className='text-sm text-red-600'>{error}</p>}
          {telWa ? (
            <a className='btn w-full text-center block' style={{ background: '#25D366', color: '#fff', borderColor: '#25D366' }}
              href={`https://wa.me/${telWa}?text=${encodeURIComponent(texto)}`} target='_blank' rel='noreferrer' onClick={reprogramar}>
              📲 Avisar por WhatsApp y reprogramar
            </a>
          ) : (
            <div className='space-y-2'>
              <p className='text-sm text-gray-500'>El cliente no tiene teléfono registrado. Copia el mensaje y reprograma.</p>
              <button className='btn w-full' onClick={() => { navigator.clipboard?.writeText(texto); reprogramar() }}>Copiar mensaje y reprogramar</button>
            </div>
          )}
          <p className='text-xs text-gray-500'>Al tocarlo, la fecha de entrega cambia en el ERP{x.items.length > 1 ? ` para los ${x.items.length} productos` : ''}, queda anotado en el historial y el cliente la ve en su seguimiento.</p>
        </div>
      )}
    </div>
  )
}
