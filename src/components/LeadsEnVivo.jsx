import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { hoyISO, sumar, fCorta } from '@/lib/etapas'

/* Leads en vivo: meta de leads diarios (por defecto 100), cuántos van hoy, por dónde llegaron,
   los últimos 7 días y el embudo del mes (leads → cotizados → compraron).
   Un lead = un prospecto nuevo en el CRM. Los de WhatsApp entran solos cuando el bot está conectado;
   los demás (Instagram, tienda, llamadas) se registran con "+ Lead rápido". */

const CANALES = [['pauta', 'Anuncio', '📣', '#f59e0b'], ['whatsapp', 'WhatsApp', '🟢', '#22c55e'], ['instagram', 'Instagram', '📸', '#e1306c'], ['tienda', 'Tienda', '🏬', '#C9A84C'], ['web', 'Web', '🌐', '#38bdf8'], ['falabella', 'Falabella', '🛒', '#a3e635'], ['referido', 'Referido', '🤝', '#a78bfa'], ['otro', 'Otro', '•', '#9ca3af']]
const CAN = Object.fromEntries(CANALES.map(c => [c[0], c]))
const diaBog = ts => new Date(new Date(ts).getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10)
const horaBog = ts => new Date(new Date(ts).getTime() - 5 * 3600 * 1000).getUTCHours() + new Date(ts).getUTCMinutes() / 60

export default function LeadsEnVivo({ tv = false }) {
  const [d, setD] = useState(null)
  const [error, setError] = useState(null)
  const [rapido, setRapido] = useState(false)
  const [editMeta, setEditMeta] = useState(false)
  const [metaTxt, setMetaTxt] = useState('')

  async function cargar() {
    const hoy = hoyISO(), desde = sumar(hoy, -6), mesIni = hoy.slice(0, 8) + '01'
    const ini = new Date((desde < mesIni ? desde : mesIni) + 'T00:00:00-05:00').toISOString()
    const [pr, meta] = await Promise.all([
      supabase.from('crm_prospectos').select('id, canal, etapa, created_at').gte('created_at', ini),
      supabase.from('ajustes').select('valor').eq('clave', 'meta_leads_dia').maybeSingle(),
    ])
    if (pr.error) { setError(pr.error.message); return }
    setD({ hoy, desde, mesIni, leads: pr.data || [], meta: Number(meta.data?.valor || 100) })
    setError(null)
  }
  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 60000)
    let espera = null
    const canal = supabase.channel('leads-en-vivo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_prospectos' }, () => { clearTimeout(espera); espera = setTimeout(cargar, 800) })
      .subscribe()
    return () => { clearInterval(t); clearTimeout(espera); supabase.removeChannel(canal) }
  }, [])

  async function guardarMeta() {
    const v = Number(metaTxt.replace(/\D/g, '')) || 100
    await supabase.from('ajustes').upsert({ clave: 'meta_leads_dia', valor: String(v) })
    setEditMeta(false); cargar()
  }

  if (error) return <div className='card text-sm text-red-700 mb-4'>No se pudieron cargar los leads: {error}</div>
  if (!d) return <div className={tv ? 'text-gray-400 text-2xl mb-6' : 'card text-gray-400 mb-4'}>Cargando leads…</div>

  const deHoy = d.leads.filter(l => diaBog(l.created_at) === d.hoy)
  const n = deHoy.length, pct = Math.round(n / d.meta * 100)
  // ritmo: los leads llegan sobre todo de 7 am a 9 pm
  const ahora = horaBog(new Date().toISOString())
  const avance = Math.max(0, Math.min(1, (ahora - 7) / 14))
  const esperado = Math.round(d.meta * avance)
  const vaBien = n >= esperado
  const porCanal = {}
  deHoy.forEach(l => { const k = CAN[l.canal] ? l.canal : 'otro'; porCanal[k] = (porCanal[k] || 0) + 1 })
  const dias = [0, 1, 2, 3, 4, 5, 6].map(k => sumar(d.desde, k)).map(dia => ({ dia, n: d.leads.filter(l => diaBog(l.created_at) === dia).length }))
  const maxDia = Math.max(d.meta, ...dias.map(x => x.n), 1)
  const mes = d.leads.filter(l => diaBog(l.created_at) >= d.mesIni)
  const cotizados = mes.filter(l => ['cotizado', 'negociando', 'ganado'].includes(l.etapa)).length
  const ganados = mes.filter(l => l.etapa === 'ganado').length
  const conv = mes.length ? ganados / mes.length : 0

  const C = tv
    ? { fondo: '#0b0b0f', tarjeta: '#17171f', borde: '#2a2a35', texto: '#f5f5f5', suave: '#9ca3af', barra: '#26262f' }
    : { fondo: '#ffffff', tarjeta: '#f9fafb', borde: '#e5e7eb', texto: '#111827', suave: '#6b7280', barra: '#f3f4f6' }
  const colorPct = pct >= 100 ? '#22c55e' : vaBien ? '#22c55e' : '#f59e0b'
  const R = tv ? 70 : 54, CIRC = 2 * Math.PI * R

  return (
    <div className={`relative ${tv ? 'mb-4 pb-4 border-b border-gray-800' : 'card mb-4'}`} style={{ background: C.fondo, color: C.texto }}>
      <div className={`flex items-center justify-between gap-2 ${tv ? 'mb-3' : 'mb-3'}`}>
        <div className={`${tv ? 'text-sm' : 'text-xs'} font-semibold uppercase tracking-widest`} style={{ color: C.suave }}>🎯 Leads en vivo</div>
        {!tv && (
          <div className='flex items-center gap-3'>
            <button type='button' className='text-xs font-semibold text-purple-700' onClick={() => { setMetaTxt(String(d.meta)); setEditMeta(!editMeta) }}>Meta: {d.meta}/día</button>
            <button type='button' className='btn btn-primary text-xs py-1.5' onClick={() => setRapido(true)}>+ Lead rápido</button>
          </div>
        )}
      </div>
      {editMeta && (
        <div className='flex gap-2 mb-3'>
          <input aria-label='Meta de leads por día' inputMode='numeric' value={metaTxt} onChange={e => setMetaTxt(e.target.value.replace(/\D/g, ''))} />
          <button className='btn btn-primary' onClick={guardarMeta}>Guardar</button>
        </div>
      )}

      <div className={`grid gap-3 ${tv ? 'grid-cols-12' : 'grid-cols-1 md:grid-cols-12'}`}>
        {/* Anillo hoy vs meta */}
        <div className={`rounded-xl p-3 flex items-center gap-4 ${tv ? 'col-span-4' : 'md:col-span-4'}`} style={{ background: C.tarjeta, border: `1px solid ${C.borde}` }}>
          <svg width={R * 2 + 16} height={R * 2 + 16} viewBox={`0 0 ${R * 2 + 16} ${R * 2 + 16}`} className='flex-none' role='img' aria-label={`${n} de ${d.meta} leads hoy`}>
            <circle cx={R + 8} cy={R + 8} r={R} fill='none' stroke={C.barra} strokeWidth={tv ? 14 : 11} />
            <circle cx={R + 8} cy={R + 8} r={R} fill='none' stroke={colorPct} strokeWidth={tv ? 14 : 11} strokeLinecap='round'
              strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - Math.min(1, n / d.meta))} transform={`rotate(-90 ${R + 8} ${R + 8})`} style={{ transition: 'stroke-dashoffset .8s' }} />
            <text x='50%' y='47%' textAnchor='middle' dominantBaseline='middle' fill={C.texto} style={{ fontSize: tv ? 40 : 30, fontWeight: 800 }}>{n}</text>
            <text x='50%' y='66%' textAnchor='middle' fill={C.suave} style={{ fontSize: tv ? 15 : 12 }}>de {d.meta}</text>
          </svg>
          <div className='min-w-0'>
            <div className={`${tv ? 'text-base' : 'text-xs'} uppercase tracking-wide`} style={{ color: C.suave }}>Leads hoy</div>
            <div className={`${tv ? 'text-4xl' : 'text-3xl'} font-extrabold tabular-nums`} style={{ color: colorPct }}>{pct}%</div>
            <div className={`${tv ? 'text-sm' : 'text-xs'}`} style={{ color: C.suave }}>
              {n >= d.meta ? '✅ ¡Meta cumplida!' : vaBien ? `✅ vas en ritmo (esperado ${esperado})` : `⚠ a esta hora deberían ir ${esperado}`}
            </div>
            <div className={`${tv ? 'text-sm' : 'text-xs'}`} style={{ color: C.suave }}>Faltan <b style={{ color: C.texto }}>{Math.max(0, d.meta - n)}</b></div>
          </div>
        </div>

        {/* Por canal */}
        <div className={`rounded-xl p-3 ${tv ? 'col-span-3' : 'md:col-span-3'}`} style={{ background: C.tarjeta, border: `1px solid ${C.borde}` }}>
          <div className={`${tv ? 'text-base' : 'text-xs'} uppercase tracking-wide mb-2`} style={{ color: C.suave }}>¿Por dónde llegan hoy?</div>
          {n === 0 ? <p className={tv ? 'text-base' : 'text-sm'} style={{ color: C.suave }}>Todavía ninguno.</p> : (
            <div className='space-y-1.5'>
              {Object.entries(porCanal).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <div key={k}>
                  <div className={`flex justify-between ${tv ? 'text-base' : 'text-xs'}`}><span>{CAN[k][2]} {CAN[k][1]}</span><b className='tabular-nums'>{v}</b></div>
                  <div className='h-1.5 rounded-full overflow-hidden' style={{ background: C.barra }}><div className='h-full rounded-full' style={{ width: Math.round(v / n * 100) + '%', background: CAN[k][3] }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Últimos 7 días */}
        <div className={`rounded-xl p-3 ${tv ? 'col-span-3' : 'md:col-span-3'}`} style={{ background: C.tarjeta, border: `1px solid ${C.borde}` }}>
          <div className={`${tv ? 'text-base' : 'text-xs'} uppercase tracking-wide mb-2`} style={{ color: C.suave }}>Últimos 7 días</div>
          <div className='relative flex items-end gap-1.5' style={{ height: tv ? 110 : 84 }}>
            <div className='absolute left-0 right-0 border-t border-dashed' style={{ bottom: `${d.meta / maxDia * 100}%`, borderColor: C.suave }} aria-hidden />
            {dias.map(x => (
              <div key={x.dia} className='flex-1 flex flex-col items-center justify-end h-full' title={`${fCorta(x.dia)}: ${x.n} leads`}>
                <span className={`${tv ? 'text-xs' : 'text-[10px]'} tabular-nums font-semibold`}>{x.n || ''}</span>
                <div className='w-full rounded-t' style={{ height: `${Math.max(2, x.n / maxDia * 100)}%`, background: x.n >= d.meta ? '#22c55e' : x.dia === d.hoy ? colorPct : (tv ? '#3f3f4a' : '#d1d5db') }} />
              </div>
            ))}
          </div>
          <div className='flex gap-1.5 mt-1'>
            {dias.map(x => <span key={x.dia} className={`flex-1 text-center ${tv ? 'text-xs' : 'text-[10px]'} capitalize`} style={{ color: C.suave }}>{fCorta(x.dia).split(' ')[0]}</span>)}
          </div>
        </div>

        {/* Embudo del mes */}
        <div className={`rounded-xl p-3 ${tv ? 'col-span-2' : 'md:col-span-2'}`} style={{ background: C.tarjeta, border: `1px solid ${C.borde}` }}>
          <div className={`${tv ? 'text-base' : 'text-xs'} uppercase tracking-wide mb-2`} style={{ color: C.suave }}>Mes</div>
          <Fila t='Leads' n={mes.length} tv={tv} C={C} />
          <Fila t='Cotizados' n={cotizados} tv={tv} C={C} />
          <Fila t='Compraron' n={ganados} tv={tv} C={C} color='#22c55e' />
          <div className={`${tv ? 'text-sm' : 'text-[11px]'} mt-1`} style={{ color: C.suave }}>
            Conversión <b style={{ color: C.texto }}>{(conv * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })}%</b>
            {conv > 0 && <> · {d.meta} leads/día ≈ {(Math.round(d.meta * conv * 10) / 10).toLocaleString('es-CO')} ventas/día</>}
          </div>
        </div>
      </div>

      {rapido && <LeadRapido cerrar={() => setRapido(false)} listo={() => { setRapido(false); cargar() }} />}
    </div>
  )
}

function Fila({ t, n, tv, C, color }) {
  return <div className={`flex justify-between ${tv ? 'text-lg' : 'text-sm'}`}><span style={{ color: C.suave }}>{t}</span><b className='tabular-nums' style={{ color: color || C.texto }}>{n}</b></div>
}

/* Registrar un lead en 5 segundos: teléfono (o nombre) + por dónde llegó. */
function LeadRapido({ cerrar, listo }) {
  const [tel, setTel] = useState('')
  const [nombre, setNombre] = useState('')
  const [canal, setCanal] = useState('instagram')
  const [interes, setInteres] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  async function guardar(e) {
    e.preventDefault()
    const t = tel.replace(/\D/g, '').slice(-10)
    if (!t && !nombre.trim()) { setError('Escribe el teléfono o el nombre.'); return }
    setGuardando(true)
    if (t) {
      const { data: ya } = await supabase.from('crm_prospectos').select('nombre').ilike('telefono', `%${t}`).limit(1)
      if (ya && ya.length) { setError(`Ya está en el CRM: ${ya[0].nombre}. No se cuenta dos veces.`); setGuardando(false); return }
    }
    const hoy = hoyISO()
    const { data, error: er } = await supabase.from('crm_prospectos').insert({ nombre: nombre.trim() || `Lead ${t}`, telefono: t || null, canal, interes: interes.trim() || null, proximo_seguimiento: hoy }).select('id').single()
    if (er || !data) { setError('No se guardó: ' + (er?.message || 'error')); setGuardando(false); return }
    await supabase.from('crm_actividades').insert({ prospecto_id: data.id, tipo: 'nota', texto: `Llegó por ${CAN[canal][1]} (lead rápido)` })
    listo()
  }
  return (
    <div className='fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4' onClick={cerrar}>
      <form className='bg-white rounded-2xl w-full max-w-md p-4 space-y-3' onClick={e => e.stopPropagation()} onSubmit={guardar}>
        <div className='flex justify-between items-center'><h2 className='font-semibold'>+ Lead rápido</h2><button type='button' className='text-gray-400 text-xl' onClick={cerrar} aria-label='Cerrar'>×</button></div>
        <div className='grid grid-cols-2 gap-2'>
          <div><label htmlFor='lr-tel' className='text-xs text-gray-500 block mb-1'>WhatsApp / teléfono</label><input id='lr-tel' inputMode='tel' value={tel} onChange={e => setTel(e.target.value)} placeholder='3001234567' autoFocus /></div>
          <div><label htmlFor='lr-nom' className='text-xs text-gray-500 block mb-1'>Nombre (opcional)</label><input id='lr-nom' value={nombre} onChange={e => setNombre(e.target.value)} placeholder='Carolina' /></div>
        </div>
        <div>
          <div className='text-xs text-gray-500 mb-1'>¿Por dónde llegó?</div>
          <div className='flex flex-wrap gap-1.5'>
            {CANALES.map(([k, l, i]) => <button key={k} type='button' onClick={() => setCanal(k)} className={`text-sm px-3 py-1.5 rounded-full border ${canal === k ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-300'}`}>{i} {l}</button>)}
          </div>
        </div>
        <div><label htmlFor='lr-int' className='text-xs text-gray-500 block mb-1'>¿Qué le interesa? (opcional)</label><input id='lr-int' value={interes} onChange={e => setInteres(e.target.value)} placeholder='Cheers 2,20 cuero café' /></div>
        {error && <p className='text-sm text-red-700'>{error}</p>}
        <button className='btn btn-primary w-full justify-center' disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar lead'}</button>
      </form>
    </div>
  )
}
