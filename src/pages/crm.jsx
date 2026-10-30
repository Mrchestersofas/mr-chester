import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabase'

/* CRM de Mr. Chester: prospectos (WhatsApp, Instagram, tienda…), embudo de ventas,
   seguimientos del día, ficha completa del cliente y métricas por canal.
   Se conecta con Cotizaciones y Pedidos: al cotizar pasa a "Cotizado" y al comprar a "Ganado". */

const ETAPAS = [
  { k: 'nuevo', l: 'Nuevo', c: '#6b7280' },
  { k: 'contactado', l: 'Contactado', c: '#2563eb' },
  { k: 'cotizado', l: 'Cotizado', c: '#7c3aed' },
  { k: 'negociando', l: 'Negociando', c: '#d97706' },
  { k: 'ganado', l: 'Ganado', c: '#15803d' },
  { k: 'perdido', l: 'Perdido', c: '#b91c1c' },
]
const ABIERTAS = ['nuevo', 'contactado', 'cotizado', 'negociando']
const CANALES = [['pauta', 'Anuncio', '📣'], ['whatsapp', 'WhatsApp', '🟢'], ['instagram', 'Instagram', '📸'], ['tienda', 'Tienda', '🏬'], ['web', 'Web', '🌐'], ['falabella', 'Falabella', '🛒'], ['referido', 'Referido', '🤝'], ['otro', 'Otro', '•']]
const MOTIVOS = ['Precio', 'Tiempo de entrega', 'Compró en otro lado', 'No respondió', 'Solo estaba mirando', 'Otro']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const hoyISO = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10)
function sumar(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
function f(iso) { if (!iso) return '—'; const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z'); return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}` }
function hace(ts) { const d = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000); return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días` }
const pesos = n => '$' + Math.round(Number(n || 0)).toLocaleString('es-CO')
const etapa = k => ETAPAS.find(e => e.k === k) || ETAPAS[0]
const canal = k => CANALES.find(c => c[0] === k) || CANALES[CANALES.length - 1]
const soloNum = t => String(t || '').replace(/\D/g, '')
const telWa = t => { const d = soloNum(t); return d.length === 10 ? '57' + d : d }
const primerNombre = n => { const x = String(n || '').trim().split(/\s+/)[0] || ''; return x.charAt(0).toUpperCase() + x.slice(1).toLowerCase() }

const PLANTILLAS = p => {
  const n = primerNombre(p.nombre)
  return [
    ['Primer contacto', `Hola ${n}, soy Joseph de Mr. Chester 👑. ¡Gracias por escribirnos! Cuéntame qué sofá tienes en mente (espacio, medidas, color) y te ayudo a elegir el ideal. También te puedo mandar fotos de modelos y telas.`],
    ['Seguimiento', `Hola ${n}, ¿cómo vas? Quería saber si pudiste pensar en ${p.interes ? `el ${p.interes}` : 'tu sofá'}. Si quieres te mando más fotos, ideas de telas o una cotización sin compromiso.`],
    ['Invitar al showroom', `Hola ${n}, te invito a conocer nuestro Centro de Experiencia en la Cra 19A #85-69, Bogotá, para que veas y toques las telas. ¿Qué día te queda bien? Te atiendo personalmente.`],
    ['Mensaje propio', `Hola ${n}, `],
  ]
}

export default function CRM() {
  const router = useRouter()
  const [tab, setTab] = useState('hoy')
  const [d, setD] = useState(null)
  const [error, setError] = useState(null)
  const [abierto, setAbierto] = useState(null)
  const [nuevo, setNuevo] = useState(false)

  async function cargar() {
    const [p, c, cot, ped] = await Promise.all([
      supabase.from('crm_prospectos').select('*').order('created_at', { ascending: false }),
      supabase.from('clientes').select('id, nombre, telefono, email'),
      supabase.from('cotizaciones').select('id, numero, total, estado, created_at, cliente_id'),
      supabase.from('pedidos').select('id, numero, tipo_sofa, precio_venta, estado, created_at, cliente_id'),
    ])
    if (p.error) { setError(p.error.message); return }
    let prospectos = p.data || []
    // Sincroniza con Cotizaciones y Pedidos
    for (const x of prospectos) {
      if (!x.cliente_id || ['ganado', 'perdido'].includes(x.etapa)) continue
      const compra = (ped.data || []).find(o => o.cliente_id === x.cliente_id && o.created_at >= sumar(String(x.created_at).slice(0, 10), -1))
      if (compra) {
        await supabase.from('crm_prospectos').update({ etapa: 'ganado', ultima_actividad: new Date().toISOString(), proximo_seguimiento: null }).eq('id', x.id)
        await supabase.from('crm_actividades').insert({ prospecto_id: x.id, tipo: 'etapa', texto: `🎉 Compró: pedido ${compra.numero} (${pesos(compra.precio_venta)})` })
        x.etapa = 'ganado'; x.proximo_seguimiento = null
      } else if (['nuevo', 'contactado'].includes(x.etapa) && (cot.data || []).some(o => o.cliente_id === x.cliente_id)) {
        await supabase.from('crm_prospectos').update({ etapa: 'cotizado' }).eq('id', x.id)
        x.etapa = 'cotizado'
      }
    }
    setD({ prospectos, clientes: c.data || [], cotizaciones: cot.data || [], pedidos: ped.data || [] })
  }
  useEffect(() => { cargar() }, [])
  useEffect(() => { if (router.query.nuevo) setNuevo(true) }, [router.query.nuevo])

  if (error) return <div className='p-4 max-w-2xl mx-auto'><p className='rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700'>No se pudo cargar el CRM: {error}</p></div>
  if (!d) return <div className='p-4 text-gray-500'>Cargando…</div>

  const hoy = hoyISO()
  const paraHoy = d.prospectos.filter(p => ABIERTAS.includes(p.etapa) && (!p.proximo_seguimiento || p.proximo_seguimiento <= hoy))
  const p0 = abierto ? d.prospectos.find(p => p.id === abierto) : null

  return (
    <div className='p-4 max-w-2xl mx-auto pb-24'>
      <div className='flex justify-between items-center mb-4'>
        <h1 className='text-xl font-medium'>CRM</h1>
        <button className='btn btn-primary text-sm' onClick={() => setNuevo(true)}>+ Prospecto</button>
      </div>
      <div className='flex gap-1.5 mb-4 overflow-x-auto pb-1'>
        {[['hoy', `Para hoy (${paraHoy.length})`], ['embudo', 'Embudo'], ['todos', 'Todos'], ['metricas', 'Métricas']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap ${tab === k ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{l}</button>
        ))}
      </div>

      {tab === 'hoy' && <ParaHoy lista={paraHoy} abrir={setAbierto} recargar={cargar} />}
      {tab === 'embudo' && <Embudo d={d} abrir={setAbierto} />}
      {tab === 'todos' && <Todos d={d} abrir={setAbierto} />}
      {tab === 'metricas' && <Metricas d={d} />}

      {nuevo && <NuevoProspecto d={d} cerrar={() => setNuevo(false)} creado={async id => { setNuevo(false); await cargar(); setAbierto(id) }} />}
      {p0 && <Ficha p={p0} d={d} cerrar={() => setAbierto(null)} recargar={cargar} />}
    </div>
  )
}

/* ---------- Para hoy: a quién escribir ---------- */

function ParaHoy({ lista, abrir, recargar }) {
  const hoy = hoyISO()
  if (!lista.length) return <div className='card text-center text-gray-500 py-10'>✓ Estás al día. No hay seguimientos pendientes.</div>
  const ordenada = [...lista].sort((a, b) => String(a.proximo_seguimiento || '0').localeCompare(String(b.proximo_seguimiento || '0')))
  return (
    <div className='space-y-2'>
      {ordenada.map(p => {
        const vencido = p.proximo_seguimiento && p.proximo_seguimiento < hoy
        return (
          <div key={p.id} className={`card py-3 ${vencido ? 'border-red-300' : ''}`}>
            <button className='w-full text-left' onClick={() => abrir(p.id)}>
              <div className='flex justify-between gap-2'>
                <div className='min-w-0'>
                  <div className='font-semibold'>{canal(p.canal)[2]} {p.nombre}</div>
                  <div className='text-sm text-gray-600 truncate'>{p.interes || 'Sin detalle'}{p.presupuesto ? ` · ${pesos(p.presupuesto)}` : ''}</div>
                  <div className='text-xs text-gray-500'>{!p.proximo_seguimiento ? 'Nuevo · contactar' : vencido ? `Atrasado desde ${f(p.proximo_seguimiento)}` : 'Hoy'} · último contacto {hace(p.ultima_actividad)}</div>
                </div>
                <Chip e={p.etapa} />
              </div>
            </button>
            <Contactar p={p} listo={recargar} compacto />
          </div>
        )
      })}
    </div>
  )
}

function Chip({ e }) {
  const x = etapa(e)
  return <span className='text-xs px-2 py-0.5 rounded-full font-semibold text-white whitespace-nowrap h-fit' style={{ background: x.c }}>{x.l}</span>
}

/* Escribir por WhatsApp + dejar el próximo seguimiento */
function Contactar({ p, listo, compacto }) {
  const ops = PLANTILLAS(p)
  const [k, setK] = useState(p.etapa === 'nuevo' ? 0 : 1)
  const [texto, setTexto] = useState(ops[p.etapa === 'nuevo' ? 0 : 1][1])
  const [paso, setPaso] = useState(compacto ? 'cerrado' : 'escribir')
  const tel = soloNum(p.telefono)

  async function registrar(dias) {
    const cambios = { ultima_actividad: new Date().toISOString(), proximo_seguimiento: dias == null ? null : sumar(hoyISO(), dias) }
    if (p.etapa === 'nuevo') cambios.etapa = 'contactado'
    await supabase.from('crm_prospectos').update(cambios).eq('id', p.id)
    await supabase.from('crm_actividades').insert({ prospecto_id: p.id, tipo: 'whatsapp', texto: texto.trim() })
    setPaso(compacto ? 'cerrado' : 'escribir'); listo()
  }

  if (paso === 'cerrado') return (
    <div className='flex gap-2 mt-2'>
      {tel ? <button className='btn btn-primary flex-1 text-sm' onClick={() => setPaso('escribir')}>🟢 Escribir</button> : <span className='text-xs text-gray-500 flex-1'>Sin teléfono</span>}
      <button className='btn text-sm' onClick={() => setPaso('despues')}>Ya lo contacté</button>
    </div>
  )
  if (paso === 'despues') return <SiguienteSeguimiento registrar={registrar} cancelar={() => setPaso(compacto ? 'cerrado' : 'escribir')} />
  return (
    <div className='mt-2 space-y-2'>
      <div className='flex flex-wrap gap-1.5'>
        {ops.map(([t, m], i) => <button key={t} type='button' onClick={() => { setK(i); setTexto(m) }} className={`text-xs px-2.5 py-1 rounded-full border ${k === i ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-300'}`}>{t}</button>)}
      </div>
      <textarea rows={4} value={texto} onChange={e => setTexto(e.target.value)} aria-label='Mensaje' />
      <div className='flex gap-2'>
        {tel && <a className='btn btn-primary flex-1 text-center text-sm' href={`https://wa.me/${telWa(p.telefono)}?text=${encodeURIComponent(texto.trim())}`} target='_blank' rel='noreferrer' onClick={() => setTimeout(() => setPaso('despues'), 400)}>🟢 Enviar por WhatsApp</a>}
        {compacto && <button className='btn text-sm' onClick={() => setPaso('cerrado')}>Cancelar</button>}
      </div>
    </div>
  )
}

function SiguienteSeguimiento({ registrar, cancelar }) {
  const [fecha, setFecha] = useState('')
  return (
    <div className='mt-2 rounded-lg bg-gray-50 p-3 space-y-2'>
      <div className='text-sm font-semibold'>¿Cuándo le vuelves a escribir?</div>
      <div className='grid grid-cols-3 gap-2'>
        <button className='btn text-sm' onClick={() => registrar(1)}>Mañana</button>
        <button className='btn text-sm' onClick={() => registrar(3)}>En 3 días</button>
        <button className='btn text-sm' onClick={() => registrar(7)}>En 1 semana</button>
      </div>
      <div className='flex gap-2'>
        <input type='date' value={fecha} onChange={e => setFecha(e.target.value)} aria-label='Otra fecha' />
        <button className='btn text-sm' disabled={!fecha} onClick={() => registrar(Math.round((new Date(fecha + 'T12:00:00Z') - new Date(hoyISO() + 'T12:00:00Z')) / 86400000))}>OK</button>
      </div>
      <div className='flex gap-2'>
        <button className='btn text-sm flex-1' onClick={() => registrar(null)}>Sin seguimiento</button>
        <button className='btn text-sm' onClick={cancelar}>Volver</button>
      </div>
    </div>
  )
}

/* ---------- Embudo ---------- */

function valorDe(p, d) {
  const cots = d.cotizaciones.filter(c => p.cliente_id && c.cliente_id === p.cliente_id)
  if (p.etapa === 'ganado') return d.pedidos.filter(o => o.cliente_id === p.cliente_id && o.created_at >= sumar(String(p.created_at).slice(0, 10), -1)).reduce((s, o) => s + Number(o.precio_venta || 0), 0)
  return cots.length ? Number(cots[cots.length - 1].total || 0) : Number(p.presupuesto || 0)
}

function Embudo({ d, abrir }) {
  return (
    <div className='space-y-4'>
      {ETAPAS.map(e => {
        const ps = d.prospectos.filter(p => p.etapa === e.k)
        if (['ganado', 'perdido'].includes(e.k) && !ps.length) return null
        const lista = ['ganado', 'perdido'].includes(e.k) ? ps.slice(0, 8) : ps
        return (
          <section key={e.k}>
            <div className='flex justify-between items-baseline mb-1.5'>
              <h2 className='text-sm font-semibold uppercase tracking-wide' style={{ color: e.c }}>{e.l} ({ps.length})</h2>
              <span className='text-sm text-gray-600'>{pesos(ps.reduce((s, p) => s + valorDe(p, d), 0))}</span>
            </div>
            {ps.length === 0 ? <p className='text-sm text-gray-400'>Vacío.</p> : (
              <div className='space-y-1.5'>
                {lista.map(p => <Fila key={p.id} p={p} d={d} abrir={abrir} />)}
                {lista.length < ps.length && <p className='text-xs text-gray-500'>…y {ps.length - lista.length} más en "Todos".</p>}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

function Fila({ p, d, abrir, conEtapa }) {
  const v = valorDe(p, d)
  return (
    <button className='w-full text-left flex justify-between items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2' onClick={() => abrir(p.id)}>
      <div className='min-w-0'>
        <div className='font-medium truncate'>{canal(p.canal)[2]} {p.nombre}</div>
        <div className='text-xs text-gray-500 truncate'>{p.interes || '—'} · {hace(p.ultima_actividad)}{p.proximo_seguimiento && ABIERTAS.includes(p.etapa) ? ` · sigue ${f(p.proximo_seguimiento)}` : ''}</div>
      </div>
      <div className='text-right flex-none'>
        {v > 0 && <div className='text-sm font-semibold'>{pesos(v)}</div>}
        {conEtapa && <Chip e={p.etapa} />}
      </div>
    </button>
  )
}

function Todos({ d, abrir }) {
  const [q, setQ] = useState('')
  const [c, setC] = useState('')
  const t = q.trim().toLowerCase()
  const lista = d.prospectos.filter(p => (!c || p.canal === c) && (!t || [p.nombre, p.telefono, p.interes, p.instagram].some(x => String(x || '').toLowerCase().includes(t))))
  return (
    <div className='space-y-2'>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder='Buscar por nombre, teléfono o interés' aria-label='Buscar' />
      <div className='flex flex-wrap gap-1.5'>
        <button className={`text-xs px-2.5 py-1 rounded-full border ${!c ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-300'}`} onClick={() => setC('')}>Todos</button>
        {CANALES.map(([k, l, i]) => <button key={k} className={`text-xs px-2.5 py-1 rounded-full border ${c === k ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-300'}`} onClick={() => setC(k)}>{i} {l}</button>)}
      </div>
      {lista.length === 0 && <div className='card text-center text-gray-500 py-6'>No hay prospectos{t || c ? ' con ese filtro' : ' todavía. Agrega el primero con "+ Prospecto"'}.</div>}
      {lista.map(p => <Fila key={p.id} p={p} d={d} abrir={abrir} conEtapa />)}
    </div>
  )
}

/* ---------- Métricas ---------- */

function Metricas({ d }) {
  const [dias, setDias] = useState(90)
  const desde = sumar(hoyISO(), -dias)
  const ps = d.prospectos.filter(p => String(p.created_at).slice(0, 10) >= desde)
  const ganados = ps.filter(p => p.etapa === 'ganado')
  const cerrados = ps.filter(p => ['ganado', 'perdido'].includes(p.etapa))
  const ventas = ganados.reduce((s, p) => s + valorDe(p, d), 0)
  const motivos = {}
  ps.filter(p => p.etapa === 'perdido').forEach(p => { const m = p.motivo_perdida || 'Sin motivo'; motivos[m] = (motivos[m] || 0) + 1 })
  return (
    <div className='space-y-3'>
      <div className='flex gap-2 text-sm'>
        {[30, 90, 365].map(n => <button key={n} className={`px-3 py-1 rounded-full border ${dias === n ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 bg-white'}`} onClick={() => setDias(n)}>{n === 365 ? '1 año' : `${n} días`}</button>)}
      </div>
      <div className='grid grid-cols-2 gap-2'>
        <M t='Prospectos' v={ps.length} />
        <M t='Ganados' v={ganados.length} />
        <M t='Tasa de cierre' v={cerrados.length ? Math.round(ganados.length / cerrados.length * 100) + '%' : '—'} />
        <M t='Ventas' v={pesos(ventas)} />
        <M t='Ticket promedio' v={ganados.length ? pesos(ventas / ganados.length) : '—'} />
        <M t='Abiertos ahora' v={d.prospectos.filter(p => ABIERTAS.includes(p.etapa)).length} />
      </div>
      <div className='card'>
        <div className='font-semibold mb-2'>Por canal</div>
        <table className='w-full text-sm'>
          <thead><tr className='text-left text-xs text-gray-500'><th className='font-normal pb-1'>Canal</th><th className='font-normal text-right'>Prosp.</th><th className='font-normal text-right'>Ganados</th><th className='font-normal text-right'>Cierre</th><th className='font-normal text-right'>Ventas</th></tr></thead>
          <tbody>
            {CANALES.map(([k, l, i]) => {
              const x = ps.filter(p => p.canal === k)
              if (!x.length) return null
              const g = x.filter(p => p.etapa === 'ganado'), cz = x.filter(p => ['ganado', 'perdido'].includes(p.etapa))
              return (
                <tr key={k} className='border-t border-gray-100'>
                  <td className='py-1.5'>{i} {l}</td><td className='text-right'>{x.length}</td><td className='text-right'>{g.length}</td>
                  <td className='text-right'>{cz.length ? Math.round(g.length / cz.length * 100) + '%' : '—'}</td>
                  <td className='text-right'>{pesos(g.reduce((s, p) => s + valorDe(p, d), 0))}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!ps.length && <p className='text-sm text-gray-400'>Sin datos en este periodo.</p>}
      </div>
      {Object.keys(motivos).length > 0 && (
        <div className='card'>
          <div className='font-semibold mb-2'>¿Por qué se pierden?</div>
          {Object.entries(motivos).sort((a, b) => b[1] - a[1]).map(([m, n]) => <div key={m} className='flex justify-between text-sm py-0.5'><span>{m}</span><b>{n}</b></div>)}
        </div>
      )}
    </div>
  )
}
function M({ t, v }) { return <div className='card text-center py-3'><div className='text-lg font-semibold'>{v}</div><div className='text-xs text-gray-500'>{t}</div></div> }

/* ---------- Nuevo prospecto ---------- */

function NuevoProspecto({ d, cerrar, creado }) {
  const [x, setX] = useState({ nombre: '', telefono: '', canal: 'whatsapp', instagram: '', interes: '', presupuesto: '', notas: '' })
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const s = (k, v) => setX(o => ({ ...o, [k]: v }))
  const tel = soloNum(x.telefono)
  const repetidoP = tel.length >= 7 && d.prospectos.find(p => soloNum(p.telefono).endsWith(tel.slice(-10)))
  const repetidoC = tel.length >= 7 && d.clientes.find(c => soloNum(c.telefono).endsWith(tel.slice(-10)))

  async function guardar() {
    if (!x.nombre.trim()) { setError('Escribe el nombre.'); return }
    setGuardando(true)
    const { data, error: e } = await supabase.from('crm_prospectos').insert({
      nombre: x.nombre.trim(), telefono: tel || null, canal: x.canal, instagram: x.instagram.trim().replace(/^@/, '') || null,
      interes: x.interes.trim() || null, presupuesto: Number(x.presupuesto) || null, notas: x.notas.trim() || null,
      cliente_id: repetidoC ? repetidoC.id : null, proximo_seguimiento: hoyISO(),
    }).select().single()
    if (e || !data) { setError('No se guardó: ' + (e?.message || 'error')); setGuardando(false); return }
    await supabase.from('crm_actividades').insert({ prospecto_id: data.id, tipo: 'nota', texto: `Llegó por ${canal(x.canal)[1]}${x.notas.trim() ? ': ' + x.notas.trim() : ''}` })
    creado(data.id)
  }

  return (
    <Hoja titulo='Nuevo prospecto' cerrar={cerrar}>
      <L t='Nombre *'><input value={x.nombre} onChange={e => s('nombre', e.target.value)} placeholder='Ej: Carolina Gómez' autoFocus /></L>
      <L t='WhatsApp / teléfono'><input inputMode='tel' value={x.telefono} onChange={e => s('telefono', e.target.value)} placeholder='Ej: 3001234567' /></L>
      {repetidoP && <p className='text-xs text-amber-700'>⚠ Ya existe como prospecto: {repetidoP.nombre} ({etapa(repetidoP.etapa).l}).</p>}
      {repetidoC && <p className='text-xs text-blue-700'>Ya es cliente: {repetidoC.nombre}. Se vinculará.</p>}
      <div>
        <div className='text-xs text-gray-500 mb-1'>¿Por dónde llegó?</div>
        <div className='flex flex-wrap gap-1.5'>
          {CANALES.map(([k, l, i]) => <button key={k} type='button' onClick={() => s('canal', k)} className={`text-sm px-3 py-1.5 rounded-full border ${x.canal === k ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-300'}`}>{i} {l}</button>)}
        </div>
      </div>
      {x.canal === 'instagram' && <L t='Usuario de Instagram'><input value={x.instagram} onChange={e => s('instagram', e.target.value)} placeholder='@usuario' autoCapitalize='none' /></L>}
      <L t='¿Qué busca?'><input value={x.interes} onChange={e => s('interes', e.target.value)} placeholder='Ej: Bentley 220 verde, sala pequeña' /></L>
      <L t='Presupuesto (opcional)'><input inputMode='numeric' value={x.presupuesto} onChange={e => s('presupuesto', e.target.value.replace(/\D/g, ''))} placeholder='Ej: 5000000' /></L>
      <L t='Nota (opcional)'><input value={x.notas} onChange={e => s('notas', e.target.value)} placeholder='Ej: vio el reel del Cheers' /></L>
      {error && <p className='text-sm text-red-700'>{error}</p>}
      <button className='btn btn-primary w-full' onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar prospecto'}</button>
    </Hoja>
  )
}

/* ---------- Ficha del prospecto ---------- */

function Ficha({ p, d, cerrar, recargar }) {
  const router = useRouter()
  const [acts, setActs] = useState([])
  const [nota, setNota] = useState('')
  const [perdiendo, setPerdiendo] = useState(false)
  const [editando, setEditando] = useState(false)
  const cots = d.cotizaciones.filter(c => p.cliente_id && c.cliente_id === p.cliente_id)
  const peds = d.pedidos.filter(o => p.cliente_id && o.cliente_id === p.cliente_id)

  async function cargarActs() {
    const { data } = await supabase.from('crm_actividades').select('*').eq('prospecto_id', p.id).order('created_at', { ascending: false })
    setActs(data || [])
  }
  useEffect(() => { cargarActs() }, [p.id])

  async function cambiarEtapa(k, motivo) {
    const cambios = { etapa: k, ultima_actividad: new Date().toISOString() }
    if (k === 'perdido') { cambios.motivo_perdida = motivo; cambios.proximo_seguimiento = null }
    if (k === 'ganado') cambios.proximo_seguimiento = null
    await supabase.from('crm_prospectos').update(cambios).eq('id', p.id)
    await supabase.from('crm_actividades').insert({ prospecto_id: p.id, tipo: 'etapa', texto: `Pasó a ${etapa(k).l}${motivo ? ` · ${motivo}` : ''}` })
    setPerdiendo(false); await recargar(); cargarActs()
  }
  async function agregarNota() {
    if (!nota.trim()) return
    await supabase.from('crm_actividades').insert({ prospecto_id: p.id, tipo: 'nota', texto: nota.trim() })
    await supabase.from('crm_prospectos').update({ ultima_actividad: new Date().toISOString() }).eq('id', p.id)
    setNota(''); cargarActs(); recargar()
  }
  async function cotizar() {
    let cid = p.cliente_id
    if (!cid) {
      const { data, error } = await supabase.from('clientes').insert({ nombre: p.nombre, telefono: p.telefono, email: p.email || null }).select().single()
      if (error || !data) { alert('No se pudo crear el cliente: ' + (error?.message || '')); return }
      cid = data.id
      await supabase.from('crm_prospectos').update({ cliente_id: cid }).eq('id', p.id)
    }
    router.push(`/cotizaciones?cliente=${cid}&prospecto=${p.id}`)
  }
  async function cambiarFecha(fecha) {
    await supabase.from('crm_prospectos').update({ proximo_seguimiento: fecha || null }).eq('id', p.id)
    recargar()
  }

  const historial = [
    ...acts.map(a => ({ t: a.created_at, ic: { nota: '📝', whatsapp: '🟢', llamada: '📞', visita: '🏬', etapa: '➡️', cotizacion: '📄' }[a.tipo] || '•', tx: a.texto })),
    ...peds.map(o => ({ t: o.created_at, ic: '🛋️', tx: `Pedido ${o.numero} · ${o.tipo_sofa} · ${pesos(o.precio_venta)}` })),
  ].sort((a, b) => String(b.t).localeCompare(String(a.t)))

  return (
    <Hoja titulo={p.nombre} cerrar={cerrar}>
      <div className='flex flex-wrap items-center gap-2 -mt-1'>
        <Chip e={p.etapa} />
        <span className='text-sm text-gray-600'>{canal(p.canal)[2]} {canal(p.canal)[1]} · desde {f(p.created_at)}</span>
      </div>
      {editando ? <EditarDatos p={p} listo={() => { setEditando(false); recargar() }} /> : (
        <div className='rounded-lg bg-gray-50 p-3 text-sm space-y-0.5'>
          {p.telefono && <div>📱 <a className='underline' href={`tel:${p.telefono}`}>{p.telefono}</a></div>}
          {p.instagram && <div>📸 <a className='underline' href={`https://instagram.com/${p.instagram}`} target='_blank' rel='noreferrer'>@{p.instagram}</a></div>}
          {p.email && <div>✉️ {p.email}</div>}
          <div>🛋️ {p.interes || 'Sin detalle de lo que busca'}</div>
          {p.presupuesto ? <div>💰 Presupuesto {pesos(p.presupuesto)}</div> : null}
          {p.motivo_perdida && <div className='text-red-700'>Perdido: {p.motivo_perdida}</div>}
          <button className='text-xs underline text-gray-500 pt-1' onClick={() => setEditando(true)}>Editar datos</button>
        </div>
      )}

      {ABIERTAS.includes(p.etapa) && (
        <>
          <div>
            <div className='text-xs text-gray-500 mb-1'>Próximo seguimiento</div>
            <input type='date' value={p.proximo_seguimiento || ''} onChange={e => cambiarFecha(e.target.value)} aria-label='Próximo seguimiento' />
          </div>
          <Contactar p={p} listo={() => { recargar(); cargarActs() }} />
          <div className='grid grid-cols-2 gap-2'>
            <button className='btn' onClick={cotizar}>📄 Cotizar</button>
            <button className='btn' onClick={() => cambiarEtapa('negociando')} disabled={p.etapa === 'negociando'}>🤝 Negociando</button>
            <button className='btn text-green-700' onClick={() => cambiarEtapa('ganado')}>🎉 Ganado</button>
            <button className='btn text-red-700' onClick={() => setPerdiendo(!perdiendo)}>✕ Perdido</button>
          </div>
          {perdiendo && (
            <div className='rounded-lg bg-red-50 p-3'>
              <div className='text-sm font-semibold mb-2'>¿Por qué se perdió?</div>
              <div className='flex flex-wrap gap-1.5'>{MOTIVOS.map(m => <button key={m} className='btn text-xs' onClick={() => cambiarEtapa('perdido', m)}>{m}</button>)}</div>
            </div>
          )}
        </>
      )}
      {!ABIERTAS.includes(p.etapa) && <button className='btn w-full' onClick={() => cambiarEtapa('contactado')}>Reabrir prospecto</button>}

      {cots.length > 0 && (
        <div>
          <div className='text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1'>Cotizaciones</div>
          {cots.map(c => <div key={c.id} className='flex justify-between text-sm py-1 border-t border-gray-100'><span>{c.numero} · {f(c.created_at)} · {c.estado}</span><b>{pesos(c.total)}</b></div>)}
          <button className='text-xs underline text-gray-500' onClick={() => router.push('/cotizaciones?ver=todas')}>Ver en Cotizaciones (seguimiento por WhatsApp)</button>
        </div>
      )}

      <div>
        <div className='text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1'>Historial</div>
        <div className='flex gap-2 mb-2'>
          <input value={nota} onChange={e => setNota(e.target.value)} placeholder='Agregar nota (llamada, visita, qué dijo…)' aria-label='Nota' onKeyDown={e => e.key === 'Enter' && agregarNota()} />
          <button className='btn' onClick={agregarNota}>+</button>
        </div>
        <ul className='space-y-1.5'>
          {historial.map((h, i) => <li key={i} className='text-sm'><span className='text-xs text-gray-500'>{f(h.t)} · </span>{h.ic} {h.tx}</li>)}
        </ul>
      </div>
    </Hoja>
  )
}

function EditarDatos({ p, listo }) {
  const [x, setX] = useState({ nombre: p.nombre || '', telefono: p.telefono || '', email: p.email || '', instagram: p.instagram || '', interes: p.interes || '', presupuesto: p.presupuesto ? String(Math.round(p.presupuesto)) : '', canal: p.canal })
  const s = (k, v) => setX(o => ({ ...o, [k]: v }))
  async function guardar() {
    await supabase.from('crm_prospectos').update({ nombre: x.nombre.trim() || p.nombre, telefono: soloNum(x.telefono) || null, email: x.email.trim() || null, instagram: x.instagram.trim().replace(/^@/, '') || null, interes: x.interes.trim() || null, presupuesto: Number(x.presupuesto) || null, canal: x.canal }).eq('id', p.id)
    listo()
  }
  return (
    <div className='rounded-lg bg-gray-50 p-3 space-y-2'>
      <L t='Nombre'><input value={x.nombre} onChange={e => s('nombre', e.target.value)} /></L>
      <div className='grid grid-cols-2 gap-2'>
        <L t='Teléfono'><input inputMode='tel' value={x.telefono} onChange={e => s('telefono', e.target.value)} /></L>
        <L t='Correo'><input type='email' value={x.email} onChange={e => s('email', e.target.value)} /></L>
        <L t='Instagram'><input value={x.instagram} onChange={e => s('instagram', e.target.value)} autoCapitalize='none' /></L>
        <L t='Canal'><select value={x.canal} onChange={e => s('canal', e.target.value)}>{CANALES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></L>
      </div>
      <L t='¿Qué busca?'><input value={x.interes} onChange={e => s('interes', e.target.value)} /></L>
      <L t='Presupuesto'><input inputMode='numeric' value={x.presupuesto} onChange={e => s('presupuesto', e.target.value.replace(/\D/g, ''))} /></L>
      <button className='btn btn-primary w-full' onClick={guardar}>Guardar</button>
    </div>
  )
}

function L({ t, children }) { return <div><label className='text-xs text-gray-500 mb-1 block'>{t}</label>{children}</div> }

function Hoja({ titulo, cerrar, children }) {
  return (
    <div className='fixed inset-0 z-40 bg-black/50 flex items-end sm:items-center justify-center' onClick={cerrar}>
      <div className='bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-4 space-y-3 max-h-[92vh] overflow-y-auto' onClick={e => e.stopPropagation()} role='dialog' aria-label={titulo}>
        <div className='flex justify-between items-start gap-2'><div className='text-lg font-semibold'>{titulo}</div><button className='text-2xl leading-none text-gray-500 px-2' onClick={cerrar} aria-label='Cerrar'>×</button></div>
        {children}
      </div>
    </div>
  )
}
