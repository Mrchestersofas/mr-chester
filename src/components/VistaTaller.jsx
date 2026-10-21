import { useState } from 'react'
import { ETAPAS_FAB, etiqueta, indice, siguiente, anterior, hoyISO, sumar, fCorta, lunesDe } from '@/lib/etapas'

/* Vista de fábrica compartida: la usa Producción (ERP, Joseph/jefe) y Taller (encargados).
   - "Ahora": qué hay en cada sección en este momento (y botones para mover, si se permite)
   - "Hoy" y "Semana": qué le toca a cada sección según la programación */

export default function VistaTaller({ items, secciones, mostrarCliente = false, puedeMover = () => false, mover, pieDespacho = null }) {
  const [tab, setTab] = useState('ahora')
  const [dia, setDia] = useState(hoyISO())
  const [lunes, setLunes] = useState(lunesDe(hoyISO()))
  const una = secciones.length === 1
  const etapasAhora = una ? secciones : ['cola', ...secciones, 'despacho']

  return (
    <div>
      <div className='flex gap-2 mb-4'>
        {[['ahora', una ? 'Ahora' : 'Por sección'], ['hoy', 'Hoy'], ['semana', 'Semana']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg ${tab === k ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{l}</button>
        ))}
      </div>

      {tab === 'ahora' && (
        <div className='space-y-4'>
          {etapasAhora.map(k => {
            const lista = items.filter(it => it.etapa === k).sort((a, b) => String(a.dia).localeCompare(String(b.dia)) || String(a.entrega).localeCompare(String(b.entrega)))
            const e = ETAPAS_FAB.find(x => x.key === k)
            return (
              <section key={k}>
                <h2 className='flex items-center gap-2 text-sm font-semibold uppercase tracking-wide mb-2' style={{ color: e?.color }}>
                  <span className='inline-block w-2.5 h-2.5 rounded-full' style={{ background: e?.color }} />
                  {etiqueta(k)} <span className='text-gray-400 font-normal'>({lista.length})</span>
                </h2>
                {lista.length === 0 ? <p className='text-sm text-gray-400 mb-2'>{k === 'cola' ? 'Nada programado.' : 'Vacío.'}</p> : (
                  <div className='space-y-2'>
                    {lista.map(it => <Tarjeta key={it.id} it={it} mostrarCliente={mostrarCliente} puede={puedeMover(it)} mover={mover} />)}
                  </div>
                )}
                {k === 'despacho' && lista.length > 0 && pieDespacho}
              </section>
            )
          })}
        </div>
      )}

      {tab === 'hoy' && (
        <div>
          <Nav texto={(dia === hoyISO() ? 'Hoy, ' : '') + fCorta(dia)} atras={() => setDia(sumar(dia, -1))} adelante={() => setDia(sumar(dia, 1))} />
          <DiaSecciones dia={dia} items={items} secciones={secciones} mostrarCliente={mostrarCliente} />
        </div>
      )}

      {tab === 'semana' && (
        <div>
          <Nav texto={`Semana del ${fCorta(lunes)}`} atras={() => setLunes(sumar(lunes, -7))} adelante={() => setLunes(sumar(lunes, 7))} />
          <div className='space-y-3'>
            {[0, 1, 2, 3, 4, 5].map(k => {
              const d = sumar(lunes, k)
              const n = items.filter(it => secciones.some(s => it.inicios[s] === d)).length
              return (
                <div key={d} className={`card ${d === hoyISO() ? 'border-gray-900' : ''}`}>
                  <div className='flex justify-between font-semibold mb-2 capitalize'><span>{d === hoyISO() ? 'Hoy · ' : ''}{fCorta(d)}</span><span className='text-sm text-gray-500'>{n} sofá{n === 1 ? '' : 's'}</span></div>
                  {n === 0 ? <p className='text-sm text-gray-400'>Sin trabajo programado.</p> : <DiaSecciones dia={d} items={items} secciones={secciones} mostrarCliente={mostrarCliente} compacto />}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Nav({ texto, atras, adelante }) {
  return (
    <div className='flex items-center gap-2 mb-3'>
      <button className='btn px-3' onClick={atras} aria-label='Anterior'>‹</button>
      <div className='flex-1 text-center font-semibold capitalize'>{texto}</div>
      <button className='btn px-3' onClick={adelante} aria-label='Siguiente'>›</button>
    </div>
  )
}

function DiaSecciones({ dia, items, secciones, mostrarCliente, compacto }) {
  const una = secciones.length === 1
  const bloques = secciones.map(s => ({ s, lista: items.filter(it => it.inicios[s] === dia) })).filter(b => !compacto || b.lista.length)
  if (!compacto && bloques.every(b => !b.lista.length)) return <div className='card text-center text-gray-500 py-6'>Sin trabajo programado este día.</div>
  return (
    <div className={compacto ? 'space-y-2' : 'space-y-4'}>
      {bloques.map(({ s, lista }) => (
        <div key={s}>
          {!una && <div className='text-xs font-semibold uppercase tracking-wide mb-1' style={{ color: ETAPAS_FAB.find(e => e.key === s)?.color }}>{etiqueta(s)} ({lista.length})</div>}
          {lista.length === 0 ? <p className='text-sm text-gray-400'>Nada.</p> : (
            <div className='space-y-1.5'>
              {lista.map(it => {
                const i = indice(it.etapa), j = indice(s)
                const [txt, cls] = i > j ? ['✓ Hecho', 'bg-green-100 text-green-800'] : i === j ? ['En proceso', 'bg-amber-100 text-amber-800'] : ['Pendiente', 'bg-gray-100 text-gray-600']
                return (
                  <div key={it.id + s} className={`flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 ${compacto ? 'text-sm' : ''}`}>
                    <div className='min-w-0'>
                      <div className='font-medium'>{it.numero} · {it.ref}{it.cantidad > 1 ? ` × ${it.cantidad}` : ''}</div>
                      <div className='text-xs text-gray-500 truncate'>{it.tela}{mostrarCliente && it.cliente ? ` · ${it.cliente}` : ''} · entrega {fCorta(it.entrega)}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${cls}`}>{txt}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function Tarjeta({ it, mostrarCliente, puede, mover }) {
  const [moviendo, setMoviendo] = useState(false)
  const sig = siguiente(it.etapa), ant = anterior(it.etapa)
  const urgente = it.prioridad === 'urgente' || it.prioridad === 'alta'
  async function m(dir) { setMoviendo(true); await mover(it, dir); setMoviendo(false) }
  return (
    <div className={`card py-3 ${urgente ? 'border-l-4 border-l-red-500' : ''}`}>
      <div className='flex justify-between gap-2'>
        <div className='min-w-0'>
          <div className='font-semibold'>{it.numero} · {it.ref}{it.cantidad > 1 ? ` × ${it.cantidad}` : ''}</div>
          <div className='text-sm text-gray-600'>Tela: {it.tela || '—'}</div>
          {mostrarCliente && it.cliente && <div className='text-xs text-gray-500'>{it.cliente}</div>}
        </div>
        <div className='text-right text-xs text-gray-500 flex-none'>
          <div>Fabricación {fCorta(it.dia)}</div>
          <div className='font-semibold text-gray-800'>Entrega {fCorta(it.entrega)}</div>
          {urgente && <div className='text-red-600 font-semibold uppercase'>{it.prioridad}</div>}
        </div>
      </div>
      {it.obs && <p className='text-xs text-gray-500 mt-1 line-clamp-2'>📝 {it.obs}</p>}
      {puede && (
        <div className='flex gap-2 mt-2'>
          {it.etapa !== 'cola' && <button className={`btn text-sm ${it.etapa === 'despacho' ? 'flex-1' : 'px-3'}`} disabled={moviendo} onClick={() => m(-1)} aria-label={`Devolver a ${etiqueta(ant)}`}>{it.etapa === 'despacho' ? `← Devolver a ${etiqueta(ant)}` : '←'}</button>}
          {it.etapa !== 'despacho' && <button className='btn btn-primary flex-1 text-sm' disabled={moviendo} onClick={() => m(1)}>{moviendo ? 'Moviendo…' : `Pasar a ${etiqueta(sig)} →`}</button>}
        </div>
      )}
    </div>
  )
}
