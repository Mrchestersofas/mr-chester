import { useState } from 'react'
import { ETAPAS_FAB, etiqueta, indice, siguiente, anterior, hoyISO, sumar, fCorta, lunesDe, SIN_TELA } from '@/lib/etapas'

/* Vista de fábrica compartida: la usa Producción (ERP, Joseph/jefe) y Taller (encargados).
   - "Ahora": qué hay en cada sección en este momento (y botones para mover, si se permite)
   - "Hoy" y "Semana": qué le toca a cada sección según la programación */

export default function VistaTaller(props) {
  if (props.modo === 'general') return <VistaGeneral {...props} />
  if (props.modo === 'corte') return <VistaCorte {...props} />
  return <VistaSecciones {...props} />
}

function Tabs({ tab, setTab, opciones }) {
  return (
    <div className='flex gap-2 mb-4'>
      {opciones.map(([k, l]) => (
        <button key={k} onClick={() => setTab(k)} className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg ${tab === k ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{l}</button>
      ))}
    </div>
  )
}

/* ---------- Vista general (jefe de producción): sofás por día, sin dividir por secciones ---------- */

function VistaGeneral({ items, puedeMover = () => false, mover, mostrarCliente = false }) {
  const [tab, setTab] = useState('hoy')
  const [dia, setDia] = useState(hoyISO())
  const [lunes, setLunes] = useState(lunesDe(hoyISO()))
  const enFabrica = items.filter(it => it.etapa !== 'cola').sort((a, b) => indice(b.etapa) - indice(a.etapa) || String(a.dia).localeCompare(String(b.dia)))
  return (
    <div>
      <Tabs tab={tab} setTab={setTab} opciones={[['hoy', 'Hoy'], ['semana', 'Semana'], ['ahora', `En fábrica (${enFabrica.length})`]]} />
      {tab === 'hoy' && (
        <div>
          <Nav texto={(dia === hoyISO() ? 'Hoy, ' : '') + fCorta(dia)} atras={() => setDia(sumar(dia, -1))} adelante={() => setDia(sumar(dia, 1))} />
          <ListaDia lista={items.filter(it => it.dia === dia)} mostrarCliente={mostrarCliente} />
        </div>
      )}
      {tab === 'semana' && (
        <div>
          <Nav texto={`Semana del ${fCorta(lunes)}`} atras={() => setLunes(sumar(lunes, -7))} adelante={() => setLunes(sumar(lunes, 7))} />
          <div className='space-y-3'>
            {[0, 1, 2, 3, 4, 5].map(k => {
              const d = sumar(lunes, k)
              const lista = items.filter(it => it.dia === d)
              const n = lista.reduce((s, it) => s + (Number(it.cantidad) || 1), 0)
              return (
                <div key={d} className={`card ${d === hoyISO() ? 'border-gray-900' : ''}`}>
                  <div className='flex justify-between font-semibold mb-2 capitalize'><span>{d === hoyISO() ? 'Hoy · ' : ''}{fCorta(d)}</span><span className='text-sm text-gray-500'>{n} sofá{n === 1 ? '' : 's'}</span></div>
                  {lista.length ? <ListaDia lista={lista} mostrarCliente={mostrarCliente} compacto /> : <p className='text-sm text-gray-400'>Sin sofás programados.</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {tab === 'ahora' && (
        <div className='space-y-2'>
          {enFabrica.length === 0 && <div className='card text-center text-gray-500 py-6'>No hay sofás en fábrica.</div>}
          {enFabrica.map(it => <Tarjeta key={it.id} it={it} mostrarCliente={mostrarCliente} puede={puedeMover(it)} mover={mover} conEtapa />)}
        </div>
      )}
    </div>
  )
}

function ListaDia({ lista, mostrarCliente, compacto }) {
  if (!lista.length) return <div className='card text-center text-gray-500 py-6'>Sin sofás programados este día.</div>
  return (
    <div className='space-y-1.5'>
      {lista.sort((a, b) => String(a.numero).localeCompare(String(b.numero))).map(it => (
        <div key={it.id} className={`flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 ${compacto ? 'text-sm' : ''}`}>
          <div className='min-w-0'>
            <div className='font-medium'>{it.numero} · {it.ref}{it.cantidad > 1 ? ` × ${it.cantidad}` : ''}</div>
            <div className='text-xs text-gray-500 truncate'>{it.tela}{mostrarCliente && it.cliente ? ` · ${it.cliente}` : ''} · entrega {fCorta(it.entrega)}</div>
          </div>
          <ChipEtapa k={it.etapa} />
        </div>
      ))}
    </div>
  )
}

function ChipEtapa({ k }) {
  const e = ETAPAS_FAB.find(x => x.key === k)
  return <span className='text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap text-white' style={{ background: e?.color || '#6b7280' }}>{e?.corto || k}</span>
}

/* ---------- Vista de corte (Corte y costura): tela, modelo, cantidad y metros ---------- */

function VistaCorte({ items }) {
  const [tab, setTab] = useState('hoy')
  const [dia, setDia] = useState(hoyISO())
  const [lunes, setLunes] = useState(lunesDe(hoyISO()))
  const pendientes = items.filter(it => indice(it.etapa) <= indice('corte_tela'))
  const delDia = d => pendientes.filter(it => it.inicios.corte_tela === d)
  return (
    <div>
      <Tabs tab={tab} setTab={setTab} opciones={[['hoy', 'Hoy'], ['semana', 'Semana'], ['ahora', `En corte (${items.filter(it => it.etapa === 'corte_tela').length})`]]} />
      {tab === 'hoy' && (
        <div>
          <Nav texto={(dia === hoyISO() ? 'Hoy, ' : '') + fCorta(dia)} atras={() => setDia(sumar(dia, -1))} adelante={() => setDia(sumar(dia, 1))} />
          <Corte lista={delDia(dia)} />
        </div>
      )}
      {tab === 'semana' && (
        <div>
          <Nav texto={`Semana del ${fCorta(lunes)}`} atras={() => setLunes(sumar(lunes, -7))} adelante={() => setLunes(sumar(lunes, 7))} />
          <div className='space-y-3'>
            {[0, 1, 2, 3, 4, 5].map(k => {
              const d = sumar(lunes, k)
              return (
                <div key={d} className={`card ${d === hoyISO() ? 'border-gray-900' : ''}`}>
                  <div className='font-semibold mb-2 capitalize'>{d === hoyISO() ? 'Hoy · ' : ''}{fCorta(d)}</div>
                  <Corte lista={delDia(d)} compacto />
                </div>
              )
            })}
          </div>
        </div>
      )}
      {tab === 'ahora' && <Corte lista={items.filter(it => it.etapa === 'corte_tela')} />}
    </div>
  )
}

function Corte({ lista, compacto }) {
  if (!lista.length) return <p className={compacto ? 'text-sm text-gray-400' : 'card text-center text-gray-500 py-6'}>Nada para cortar.</p>
  const porTela = {}
  lista.forEach(it => {
    const t = it.tela || 'Tela por definir'
    porTela[t] = porTela[t] || { metros: 0, sofas: 0, sinMedida: false, filas: [] }
    porTela[t].sofas += Number(it.cantidad) || 1
    if (it.metros) porTela[t].metros += it.metros; else porTela[t].sinMedida = true
    porTela[t].filas.push(it)
  })
  const num = n => (Math.round(n * 10) / 10).toLocaleString('es-CO')
  return (
    <div className='space-y-2'>
      {Object.entries(porTela).map(([tela, g]) => (
        <div key={tela} className='rounded-lg border border-gray-200 bg-white overflow-hidden'>
          <div className='flex justify-between items-center gap-2 px-3 py-2' style={{ background: '#f5f3ff' }}>
            <span className='font-semibold'>{tela}</span>
            <span className='text-sm font-semibold whitespace-nowrap'>{g.metros ? `${num(g.metros)} m` : ''}{g.sinMedida ? ' + ?' : ''} · {g.sofas} und</span>
          </div>
          {g.filas.map(it => (
            <div key={it.id} className='flex justify-between gap-2 px-3 py-2 border-t border-gray-100 text-sm'>
              <span><b>{it.ref}</b>{it.cantidad > 1 ? ` × ${it.cantidad}` : ''} <span className='text-gray-400'>· {it.numero}</span></span>
              <span className='whitespace-nowrap text-gray-600'>{it.metros ? `${num(it.metros)} m` : 'sin medida'}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/* ---------- Vista por secciones (Joseph en el ERP y encargados de otras secciones) ---------- */

function VistaSecciones({ items, secciones, mostrarCliente = false, puedeMover = () => false, mover, pieDespacho = null }) {
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
                      <div className='text-xs text-gray-500 truncate'>{mostrarCliente || !SIN_TELA.includes(s) ? it.tela : ''}{mostrarCliente && it.cliente ? ` · ${it.cliente}` : ''}{mostrarCliente ? ` · entrega ${fCorta(it.entrega)}` : ''}</div>
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

function Tarjeta({ it, mostrarCliente, puede, mover, conEtapa }) {
  const [moviendo, setMoviendo] = useState(false)
  const sig = siguiente(it.etapa), ant = anterior(it.etapa)
  const urgente = it.prioridad === 'urgente' || it.prioridad === 'alta'
  async function m(dir) { setMoviendo(true); await mover(it, dir); setMoviendo(false) }
  return (
    <div className={`card py-3 ${urgente ? 'border-l-4 border-l-red-500' : ''}`}>
      <div className='flex justify-between gap-2'>
        <div className='min-w-0'>
          <div className='font-semibold'>{it.numero} · {it.ref}{it.cantidad > 1 ? ` × ${it.cantidad}` : ''}</div>
          {conEtapa && <div className='my-1'><ChipEtapa k={it.etapa} /></div>}
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
