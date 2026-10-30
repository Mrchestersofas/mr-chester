import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { hoyISO, modeloMedida } from '@/lib/etapas'

/* Ventas en vivo: lo que se vende hoy vs la meta, el mes, los leads y las cotizaciones del día.
   Se actualiza solo (Supabase Realtime + cada 60 s). Cuando entra una venta nueva sale el aviso 🎉.
   tv = versión grande y oscura para el televisor. */

const CANALES = { tienda_85: 'Tienda 85', whatsapp: 'WhatsApp', instagram: 'Instagram', falabella: 'Falabella', web: 'Página web' }
const COLOR_CANAL = { tienda_85: '#C9A84C', whatsapp: '#22c55e', instagram: '#e1306c', falabella: '#a3e635', web: '#38bdf8' }
const millones = n => '$' + (Math.round(Number(n || 0) / 100000) / 10).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'M'
const pesos = n => '$' + Math.round(Number(n || 0)).toLocaleString('es-CO')
const hora = ts => new Date(ts).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' })
const nombreCorto = n => { const p = String(n || '').trim().split(/\s+/).filter(Boolean).map(x => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase()); return p.length > 2 ? `${p[0]} ${p[p.length >= 4 ? 2 : 1]}` : p.join(' ') }
// días que abre la tienda en el mes (lunes a sábado)
function diasHabiles(y, m, hasta) {
  let n = 0
  for (let d = 1; d <= hasta; d++) if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() !== 0) n++
  return n
}

export default function VentasEnVivo({ tv = false, onVenta = null }) {
  const [d, setD] = useState(null)
  const [error, setError] = useState(null)
  const [fiesta, setFiesta] = useState(null)
  const vistos = useRef(null)

  async function cargar() {
    const hoy = hoyISO(), mesIni = hoy.slice(0, 8) + '01', desde = hoy + 'T05:00:00Z'
    const [ped, crm, cot, wa, meta] = await Promise.all([
      supabase.from('pedidos').select('id, numero, grupo, precio_venta, cantidad, tipo_sofa, canal, fecha_pedido, created_at, cliente:clientes(nombre)')
        .neq('estado', 'cancelado').gte('fecha_pedido', mesIni).lte('fecha_pedido', hoy),
      supabase.from('crm_prospectos').select('id, canal, created_at').gte('created_at', desde),
      supabase.from('cotizaciones').select('id, total, estado, created_at').gte('created_at', desde),
      supabase.from('wa_mensajes').select('telefono, direccion, created_at').eq('direccion', 'entrante').gte('created_at', desde),
      supabase.from('ajustes').select('valor').eq('clave', 'meta_ventas_mes').maybeSingle(),
    ])
    if (ped.error) { setError(ped.error.message); return }
    const mes = ped.data || []
    const deHoy = mes.filter(p => p.fecha_pedido === hoy)
    // aviso de venta nueva (solo después de la primera carga)
    const ids = new Set(deHoy.map(p => p.id))
    if (vistos.current) {
      const nuevas = deHoy.filter(p => !vistos.current.has(p.id))
      if (nuevas.length) {
        const total = nuevas.reduce((a, p) => a + Number(p.precio_venta || 0), 0)
        setFiesta({ total, cliente: nombreCorto(nuevas[0].cliente?.nombre), modelo: nuevas[0].tipo_sofa, n: nuevas.length, t: Date.now() })
        if (onVenta) onVenta()
      }
    }
    vistos.current = ids
    setD({ hoy, mes, deHoy, leads: crm.data || [], cots: cot.data || [], wa: wa.data || [], meta: Number(meta.data?.valor || 0) })
    setError(null)
  }

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 60000)
    let espera = null
    const pronto = () => { clearTimeout(espera); espera = setTimeout(cargar, 800) }
    const canal = supabase.channel('ventas-en-vivo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, pronto)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_prospectos' }, pronto)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cotizaciones' }, pronto)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wa_mensajes' }, pronto)
      .subscribe()
    return () => { clearInterval(t); clearTimeout(espera); supabase.removeChannel(canal) }
  }, [])
  useEffect(() => {
    if (!fiesta) return
    const t = setTimeout(() => setFiesta(null), 12000)
    return () => clearTimeout(t)
  }, [fiesta])

  if (error) return <div className='card text-sm text-red-700 mb-4'>No se pudieron cargar las ventas: {error}</div>
  if (!d) return <div className={tv ? 'text-gray-400 text-2xl mb-6' : 'card text-gray-400 mb-4'}>Cargando ventas…</div>

  const suma = l => l.reduce((a, p) => a + Number(p.precio_venta || 0), 0)
  const compras = l => new Set(l.map(p => p.grupo || p.numero)).size
  const sofas = l => l.reduce((a, p) => a + (Number(p.cantidad) || 1), 0)
  const [y, m, dd] = d.hoy.split('-').map(Number)
  const diasMes = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const habMes = diasHabiles(y, m, diasMes), habHasta = diasHabiles(y, m, dd)
  const vHoy = suma(d.deHoy), vMes = suma(d.mes)
  const metaDia = d.meta && habMes ? d.meta / habMes : 0
  const pctHoy = metaDia ? Math.round(vHoy / metaDia * 100) : 0
  const pctMes = d.meta ? Math.round(vMes / d.meta * 100) : 0
  const ritmo = d.meta ? d.meta * habHasta / habMes : 0
  const vaBien = vMes >= ritmo
  const falta = Math.max(0, d.meta - vMes), habRestan = Math.max(1, habMes - habHasta + (vHoy < metaDia ? 1 : 0))
  const porCanal = {}
  d.deHoy.forEach(p => { const k = p.canal || 'otro'; porCanal[k] = (porCanal[k] || 0) + Number(p.precio_venta || 0) })
  const waHoy = new Set(d.wa.map(x => x.telefono)).size
  const ultimas = [...d.deHoy].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  // agrupar por compra (un cliente puede llevar varios sofás)
  const grupos = []
  ultimas.forEach(p => { const k = p.grupo || p.numero; const g = grupos.find(x => x.k === k); if (g) { g.total += Number(p.precio_venta || 0); g.items.push(p) } else grupos.push({ k, total: Number(p.precio_venta || 0), items: [p], p }) })

  const C = tv
    ? { fondo: '#0b0b0f', tarjeta: '#17171f', borde: '#2a2a35', texto: '#f5f5f5', suave: '#9ca3af', barra: '#26262f' }
    : { fondo: '#ffffff', tarjeta: '#f9fafb', borde: '#e5e7eb', texto: '#111827', suave: '#6b7280', barra: '#f3f4f6' }
  const grande = tv ? 'text-5xl' : 'text-4xl'

  return (
    <div className={`relative ${tv ? 'mb-4 pb-4 border-b border-gray-800' : 'card mb-4'}`} style={{ background: C.fondo, color: C.texto }}>
      <style jsx global>{`
        @keyframes venta-pop { 0% { transform: scale(.6); opacity: 0; } 60% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1); } }
        @keyframes venta-brillo { 0%, 100% { opacity: .85; } 50% { opacity: 1; } }
        .venta-pop { animation: venta-pop .6s ease-out, venta-brillo 1.2s ease-in-out infinite .6s; }
        @media (prefers-reduced-motion: reduce) { .venta-pop { animation: none; } }
      `}</style>

      {fiesta && (
        <div className='absolute inset-0 z-20 flex items-center justify-center rounded-xl' style={{ background: tv ? 'rgba(11,11,15,.88)' : 'rgba(255,255,255,.9)' }} onClick={() => setFiesta(null)}>
          <div className='venta-pop text-center rounded-2xl px-8 py-6' style={{ background: 'linear-gradient(135deg,#C9A84C,#f5d97a)', color: '#111' }}>
            <div className={tv ? 'text-4xl' : 'text-2xl'}>🎉 ¡Nueva venta!</div>
            <div className={`${tv ? 'text-7xl' : 'text-5xl'} font-extrabold tabular-nums my-1`}>{pesos(fiesta.total)}</div>
            <div className={tv ? 'text-2xl' : 'text-base'}>{fiesta.cliente}{fiesta.modelo ? ` · ${fiesta.modelo}` : ''}{fiesta.n > 1 ? ` y ${fiesta.n - 1} más` : ''}</div>
          </div>
        </div>
      )}

      <div className={`flex items-center justify-between ${tv ? 'mb-4' : 'mb-3'}`}>
        <div className={`${tv ? 'text-sm' : 'text-xs'} font-semibold uppercase tracking-widest`} style={{ color: C.suave }}>💰 Ventas en vivo</div>
        <div className={`${tv ? 'text-sm' : 'text-xs'}`} style={{ color: C.suave }}>Meta del mes {millones(d.meta)} · {habMes - habHasta} días hábiles restantes</div>
      </div>

      <div className={`grid gap-3 ${tv ? 'grid-cols-12' : 'grid-cols-2 md:grid-cols-12'}`}>
        {/* Ventas de hoy vs meta del día */}
        <div className={`rounded-xl ${tv ? 'p-3' : 'p-4'} ${tv ? 'col-span-4' : 'col-span-2 md:col-span-4'}`} style={{ background: C.tarjeta, border: `1px solid ${C.borde}` }}>
          <div className={`${tv ? 'text-base' : 'text-xs'} uppercase tracking-wide`} style={{ color: C.suave }}>Vendido hoy</div>
          <div className={`${grande} font-extrabold tabular-nums leading-tight`} style={{ color: pctHoy >= 100 ? '#22c55e' : C.texto }}>{pesos(vHoy)}</div>
          <div className='flex justify-between items-center mt-1'>
            <span className={tv ? 'text-base' : 'text-xs'} style={{ color: C.suave }}>{compras(d.deHoy)} compra{compras(d.deHoy) === 1 ? '' : 's'} · {sofas(d.deHoy)} sofá{sofas(d.deHoy) === 1 ? '' : 's'}</span>
            {metaDia > 0 && <span className={`${tv ? 'text-2xl' : 'text-lg'} font-bold tabular-nums`} style={{ color: pctHoy >= 100 ? '#22c55e' : '#f59e0b' }}>{pctHoy}%</span>}
          </div>
          {metaDia > 0 && <>
            <div className={`${tv ? 'h-4' : 'h-2.5'} rounded-full overflow-hidden mt-2`} style={{ background: C.barra }}>
              <div className='h-full rounded-full transition-all duration-700' style={{ width: Math.min(100, pctHoy) + '%', background: pctHoy >= 100 ? '#22c55e' : '#f59e0b' }} />
            </div>
            <div className={`${tv ? 'text-sm' : 'text-[11px]'} mt-1`} style={{ color: C.suave }}>Meta de hoy {millones(metaDia)}{pctHoy >= 100 ? ' · ✅ ¡cumplida!' : ` · faltan ${millones(metaDia - vHoy)}`}</div>
          </>}
          {Object.keys(porCanal).length > 0 && (
            <div className='flex flex-wrap gap-1.5 mt-2'>
              {Object.entries(porCanal).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <span key={k} className={`${tv ? 'text-sm px-2.5 py-1' : 'text-[11px] px-2 py-0.5'} rounded-full font-semibold`} style={{ background: (COLOR_CANAL[k] || '#9ca3af') + '22', color: tv ? (COLOR_CANAL[k] || C.texto) : C.texto, border: `1px solid ${(COLOR_CANAL[k] || '#9ca3af')}66` }}>{CANALES[k] || k} {millones(v)}</span>
              ))}
            </div>
          )}
        </div>

        {/* Mes */}
        <div className={`rounded-xl ${tv ? 'p-3' : 'p-4'} ${tv ? 'col-span-3' : 'col-span-2 md:col-span-3'}`} style={{ background: C.tarjeta, border: `1px solid ${C.borde}` }}>
          <div className={`${tv ? 'text-base' : 'text-xs'} uppercase tracking-wide`} style={{ color: C.suave }}>Mes</div>
          <div className='flex items-end justify-between gap-2'>
            <div className={`${tv ? 'text-5xl' : 'text-3xl'} font-extrabold tabular-nums leading-tight`}>{millones(vMes)}</div>
            {d.meta > 0 && <div className={`${tv ? 'text-4xl' : 'text-2xl'} font-bold tabular-nums`} style={{ color: vaBien ? '#22c55e' : '#f59e0b' }}>{pctMes}%</div>}
          </div>
          {d.meta > 0 && <>
            <div className={`relative ${tv ? 'h-4' : 'h-2.5'} rounded-full overflow-hidden mt-2`} style={{ background: C.barra }}>
              <div className='h-full rounded-full transition-all duration-700' style={{ width: Math.min(100, pctMes) + '%', background: vaBien ? '#22c55e' : '#f59e0b' }} />
              <div className='absolute top-0 bottom-0 w-0.5' style={{ left: Math.min(100, ritmo / d.meta * 100) + '%', background: C.texto }} />
            </div>
            <div className={`${tv ? 'text-sm' : 'text-[11px]'} mt-1`} style={{ color: C.suave }}>
              {vaBien ? '✅ por encima del ritmo' : `⚠ deberías ir en ${millones(ritmo)}`}
              {falta > 0 && <> · para la meta: {millones(falta / habRestan)}/día</>}
            </div>
          </>}
        </div>

        {/* Leads, WhatsApp, cotizaciones */}
        <div className={`grid grid-cols-2 gap-3 ${tv ? 'col-span-5' : 'col-span-2 md:col-span-5'}`}>
          <Numero n={waHoy} t='Escribieron por WhatsApp' icono='💬' tv={tv} C={C} />
          <Numero n={d.cots.length} t={d.cots.length ? `Cotizaciones · ${millones(d.cots.reduce((a, x) => a + Number(x.total || 0), 0))}` : 'Cotizaciones hoy'} icono='📝' tv={tv} C={C} />
        </div>
      </div>

      {/* Últimas ventas */}
      <div className={tv ? 'mt-3' : 'mt-3'}>
        <div className={`${tv ? 'text-sm' : 'text-xs'} font-semibold uppercase tracking-widest mb-2`} style={{ color: C.suave }}>🧾 Ventas de hoy</div>
        {grupos.length === 0 ? <p className={tv ? 'text-lg' : 'text-sm'} style={{ color: C.suave }}>Todavía no hay ventas hoy. ¡Vamos por la primera! 💪</p> : (
          <div className={`flex flex-wrap ${tv ? 'gap-3' : 'gap-2'}`}>
            {grupos.slice(0, tv ? 8 : 6).map(g => {
              const { modelo, medida } = modeloMedida(g.p.tipo_sofa)
              return (
                <div key={g.k} className={`rounded-full border ${tv ? 'px-4 py-2 text-base' : 'px-3 py-1 text-xs'}`} style={{ borderColor: C.borde, background: C.tarjeta }}>
                  <span style={{ color: C.suave }}>{hora(g.p.created_at)}</span> · <b>{nombreCorto(g.p.cliente?.nombre) || g.p.numero}</b> · {modelo}{medida ? ` ${medida}` : ''}{g.items.length > 1 ? ` +${g.items.length - 1}` : ''} · <b style={{ color: '#22c55e' }}>{millones(g.total)}</b>
                  {g.p.canal && <span style={{ color: C.suave }}> · {CANALES[g.p.canal] || g.p.canal}</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Numero({ n, t, icono, tv, C }) {
  return (
    <div className='rounded-xl p-3 flex flex-col justify-between' style={{ background: C.tarjeta, border: `1px solid ${C.borde}` }}>
      <div className={tv ? 'text-xl' : 'text-lg'}>{icono}</div>
      <div className={`${tv ? 'text-5xl' : 'text-3xl'} font-extrabold tabular-nums leading-none mt-auto`}>{n}</div>
      <div className={`${tv ? 'text-sm' : 'text-[11px]'} mt-1 leading-tight`} style={{ color: C.suave }}>{t}</div>
    </div>
  )
}
