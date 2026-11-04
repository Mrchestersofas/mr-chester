import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ETAPAS_FAB, etiqueta, indice, hoyISO, diaBogota, modeloMedida, lunesDe, sumar } from '@/lib/etapas'
import { CUPOS_DIA, CUPOS_CATEGORIA } from '@/lib/planificador'

/* 📊 Estadísticas de producción: lo que se debe (sofás, referencias, telas), carga por semana,
   entregas atrasadas y el ritmo real del taller (según los "Terminé" de cada sección). */

const pesos = n => '$' + Math.round(Number(n || 0)).toLocaleString('es-CO')
const millones = n => '$' + (Number(n || 0) / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + 'M'
const num = n => Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 1 })
const sinTilde = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const corta = iso => { const d = new Date(iso + 'T12:00:00Z'); return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}` }
const ANTES_DE_CORTE = ['cola', 'estructura', 'espumado']
const CAP_SEMANA = Object.values(CUPOS_DIA).reduce((a, b) => a + b, 0) // cupos de un semana normal

export default function Estadisticas() {
  const [d, setD] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    (async () => {
      const desde = new Date(Date.now() - 70 * 86400000).toISOString()
      const [prog, productos, telas, tiempos] = await Promise.all([
        supabase.from('programacion_produccion')
          .select('id, etapa_actual, dia_produccion, corte_listo, pedido:pedidos(numero, tipo_sofa, material, cantidad, fecha_entrega, prioridad, estado, precio_venta, abono, cliente:clientes(nombre))')
          .neq('etapa_actual', 'completado'),
        supabase.from('productos').select('referencia, categoria, metros_tela'),
        supabase.from('materiales').select('nombre, proveedor, costo_unitario, unidad'),
        supabase.from('prod_tiempos').select('prog_id, seccion, fin, pedido:pedidos(cantidad)').gte('fin', desde),
      ])
      const e = prog.error || productos.error || telas.error || tiempos.error
      if (e) { setError(e.message); return }
      setD({ prog: (prog.data || []).filter(f => f.pedido && !['entregado', 'cancelado'].includes(f.pedido.estado)), productos: productos.data || [], telas: telas.data || [], tiempos: tiempos.data || [] })
    })()
  }, [])

  if (error) return <div className='p-4 max-w-3xl mx-auto'><p className='rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700'>No se pudo cargar: {error}</p></div>
  if (!d) return <div className='p-4 text-gray-500'>Calculando…</div>

  const hoy = hoyISO()
  const prodDe = Object.fromEntries(d.productos.map(p => [sinTilde(p.referencia), p]))
  // Metros de tela por referencia (si no está en Productos se estima, igual que en Compras → Telas)
  function metrosDe(ref) {
    const r = sinTilde(ref)
    if (Number(prodDe[r]?.metros_tela)) return Number(prodDe[r].metros_tela)
    if (r.startsWith('poltrona')) return 5.5
    if (r.startsWith('esquinero')) return Number(prodDe['esquinero cheers']?.metros_tela) || 14
    const med = (r.match(/(\d{3})/) || [])[1]
    const base = med && Number(prodDe['cheers ' + med]?.metros_tela)
    return base ? base + (r.includes('picadilly') || r.includes('piccadilly') ? 1 : 0) : 0
  }
  const cupoDe = ref => { const c = prodDe[sinTilde(ref)]?.categoria; return CUPOS_CATEGORIA[c] ?? (sinTilde(ref).startsWith('poltrona') ? 0.5 : sinTilde(ref).startsWith('puff') ? 0.25 : sinTilde(ref).startsWith('esquinero') ? 2 : 1) }
  const infoTela = Object.fromEntries(d.telas.map(t => [sinTilde(t.nombre), t]))

  const items = d.prog.map(f => {
    const p = f.pedido, u = Number(p.cantidad) || 1
    return {
      ...f, etapa: f.etapa_actual === 'control_calidad' ? 'terminado' : f.etapa_actual, numero: p.numero, ref: p.tipo_sofa || 'Sin referencia', tela: (p.material || '').trim() || 'Tela por definir',
      u, entrega: p.fecha_entrega, valor: Number(p.precio_venta || 0), saldo: Math.max(0, Number(p.precio_venta || 0) - Number(p.abono || 0)),
      metros: metrosDe(p.tipo_sofa) * u, cupos: cupoDe(p.tipo_sofa) * u, cliente: p.cliente?.nombre, prioridad: p.prioridad,
    }
  })
  const U = l => l.reduce((a, x) => a + x.u, 0)
  const pendientes = items.filter(x => x.etapa !== 'despacho')
  const enFabrica = items.filter(x => !['cola', 'despacho'].includes(x.etapa))
  const porEmpezar = items.filter(x => x.etapa === 'cola')
  const listos = items.filter(x => x.etapa === 'despacho')
  const atrasados = pendientes.filter(x => x.entrega && x.entrega < hoy).sort((a, b) => a.entrega.localeCompare(b.entrega))
  const cuposPend = pendientes.reduce((a, x) => a + x.cupos, 0)

  // Ritmo real: sofás que salieron de Tapizado por semana (últimas 8 semanas)
  const lunesHoy = lunesDe(hoy)
  const semanas = Array.from({ length: 8 }, (_, k) => sumar(lunesHoy, -7 * (7 - k)))
  const salidas = d.tiempos.filter(t => t.seccion === 'tapizado' && t.fin)
  const porSemana = semanas.map(l => ({ l, u: salidas.filter(t => { const f = diaBogota(t.fin); return f >= l && f < sumar(l, 7) }).reduce((a, t) => a + (Number(t.pedido?.cantidad) || 1), 0) }))
  const conDatos = porSemana.filter(s => s.u > 0)
  const ritmo = conDatos.length ? conDatos.reduce((a, s) => a + s.u, 0) / conDatos.length : 0

  // Agrupaciones
  const agrupar = (lista, clave) => {
    const g = {}
    lista.forEach(x => { const k = clave(x); const o = g[k] = g[k] || { k, u: 0, metros: 0, valor: 0, n: 0 }; o.u += x.u; o.metros += x.metros; o.valor += x.valor; o.n++ })
    return Object.values(g).sort((a, b) => b.u - a.u || b.valor - a.valor)
  }
  const porRef = agrupar(pendientes, x => x.ref)
  const porModelo = agrupar(pendientes, x => modeloMedida(x.ref).modelo || x.ref)
  const sinCortar = pendientes.filter(x => ANTES_DE_CORTE.includes(x.etapa) && !x.corte_listo)
  const porTela = agrupar(sinCortar, x => x.tela).map(t => {
    const info = infoTela[sinTilde(t.k)]
    return { ...t, proveedor: info?.proveedor || 'Sin proveedor', costo: t.metros * Number(info?.costo_unitario || 0) }
  }).sort((a, b) => b.metros - a.metros)
  const porProveedor = Object.values(porTela.reduce((g, t) => { const o = g[t.proveedor] = g[t.proveedor] || { k: t.proveedor, metros: 0, costo: 0 }; o.metros += t.metros; o.costo += t.costo; return g }, {})).sort((a, b) => b.metros - a.metros)
  const etapas = ETAPAS_FAB.filter(e => e.key !== 'completado').map(e => ({ ...e, u: U(items.filter(x => x.etapa === e.key)) }))

  // Carga programada por semana vs capacidad, y entregas comprometidas por semana
  const proximas = Array.from({ length: 8 }, (_, k) => sumar(lunesHoy, 7 * k))
  const carga = proximas.map(l => ({ l, cupos: pendientes.filter(x => x.dia_produccion >= l && x.dia_produccion < sumar(l, 7)).reduce((a, x) => a + x.cupos, 0) }))
  const entregas = proximas.map(l => ({ l, u: U(pendientes.filter(x => x.entrega && x.entrega >= l && x.entrega < sumar(l, 7))) }))

  return (
    <div className='p-4 max-w-3xl mx-auto space-y-5'>
      <div className='flex items-start justify-between gap-2'>
        <div>
          <h1 className='text-xl font-medium'>📊 Estadísticas de producción</h1>
          <p className='text-sm text-gray-500'>Todo lo que está vendido y todavía no se ha entregado.</p>
        </div>
        <Link href='/produccion' className='btn text-sm whitespace-nowrap'>← Producción</Link>
      </div>

      <div className='grid grid-cols-2 sm:grid-cols-3 gap-2'>
        <Tile t='Sofás que se deben' v={U(pendientes)} s={`${pendientes.length} pedidos sin terminar`} grande />
        <Tile t='En fábrica' v={U(enFabrica)} s='ya empezaron' />
        <Tile t='Por empezar' v={U(porEmpezar)} s='en programación' />
        <Tile t='Listos para despacho' v={U(listos)} s='terminados' />
        <Tile t='Entregas atrasadas' v={U(atrasados)} s={atrasados.length ? 'fecha de entrega vencida' : 'ninguna 🙌'} alerta={atrasados.length > 0} />
        <Tile t='Semanas de trabajo' v={num(cuposPend / CAP_SEMANA)} s={`a ${CAP_SEMANA} cupos por semana`} />
        <Tile t='Valor por producir' v={millones(pendientes.reduce((a, x) => a + x.valor, 0))} s='precio de venta' />
        <Tile t='Saldo por cobrar' v={millones(items.reduce((a, x) => a + x.saldo, 0))} s='incluye listos' />
        <Tile t='Ritmo real' v={ritmo ? num(ritmo) : '—'} s={ritmo ? `sofás por semana · ${num(U(pendientes) / ritmo)} semanas al ritmo actual` : 'aún sin “Terminé” suficientes'} />
      </div>

      <Seccion t='Dónde están los sofás'>
        <Barras filas={etapas.map(e => ({ k: e.label, v: e.u, txt: `${e.u}` }))} />
      </Seccion>

      <Seccion t='Referencias que más se deben' nota='Unidades sin terminar, metros de tela y valor de venta.'>
        <Tabla cols={['Referencia', 'Sofás', 'Tela', 'Valor']} filas={porRef.map(r => [r.k, r.u, `${num(r.metros)} m`, millones(r.valor)])} barra={porRef.map(r => r.u)} />
        <div className='mt-3'><div className='text-xs text-gray-500 mb-1'>Por modelo (todas las medidas juntas)</div>
          <Barras filas={porModelo.map(m => ({ k: m.k, v: m.u, txt: `${m.u}` }))} />
        </div>
      </Seccion>

      <Seccion t='Telas que se deben' nota='Metros de los sofás que todavía no se han cortado. Costo con el precio de Materiales.'>
        <Tabla cols={['Tela', 'Proveedor', 'Metros', 'Sofás', 'Costo']} filas={porTela.map(t => [t.k, t.proveedor, `${num(t.metros)} m`, t.u, t.costo ? pesos(t.costo) : '—'])} barra={porTela.map(t => t.metros)} />
        <div className='grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3'>
          {porProveedor.map(p => <Tile key={p.k} t={p.k} v={`${num(p.metros)} m`} s={p.costo ? pesos(p.costo) : 'sin precio'} />)}
        </div>
      </Seccion>

      <Seccion t='Carga programada por semana' nota={`Cupos programados según la fecha de producción. Capacidad de una semana normal: ${CAP_SEMANA} cupos (esquinero 2, poltrona ½, puff ¼).`}>
        <Barras filas={carga.map(c => ({ k: `Semana ${corta(c.l)}`, v: c.cupos, txt: `${num(c.cupos)} / ${CAP_SEMANA}`, alerta: c.cupos > CAP_SEMANA }))} max={Math.max(CAP_SEMANA, ...carga.map(c => c.cupos))} />
      </Seccion>

      <Seccion t='Entregas comprometidas por semana' nota='Sofás sin terminar según la fecha de entrega prometida al cliente.'>
        <Barras filas={[...(atrasados.length ? [{ k: 'Atrasadas', v: U(atrasados), txt: `${U(atrasados)}`, alerta: true }] : []), ...entregas.map(e => ({ k: `Semana ${corta(e.l)}`, v: e.u, txt: `${e.u}` }))]} />
      </Seccion>

      <Seccion t='Ritmo real del taller' nota='Sofás que salieron de Tapizado cada semana, según los “Terminé” del taller.'>
        <Barras filas={porSemana.map(s => ({ k: `Semana ${corta(s.l)}`, v: s.u, txt: `${s.u}` }))} />
      </Seccion>

      {atrasados.length > 0 && (
        <Seccion t={`Entregas atrasadas (${atrasados.length})`}>
          <Tabla cols={['Pedido', 'Referencia', 'Cliente', 'Entrega', 'Va en']} filas={atrasados.map(x => [x.numero, x.ref, x.cliente || '—', corta(x.entrega), etiqueta(x.etapa)])} />
        </Seccion>
      )}
    </div>
  )
}

function Tile({ t, v, s, grande, alerta }) {
  return (
    <div className={`rounded-xl border bg-white p-3 ${alerta ? 'border-red-300' : 'border-gray-200'}`}>
      <div className='text-xs text-gray-500'>{t}</div>
      <div className={`font-bold leading-tight ${grande ? 'text-3xl' : 'text-2xl'} ${alerta ? 'text-red-700' : 'text-gray-900'}`}>{alerta ? '⚠ ' : ''}{v}</div>
      {s && <div className='text-[11px] text-gray-500 mt-0.5'>{s}</div>}
    </div>
  )
}
function Seccion({ t, nota, children }) {
  return (
    <section className='card'>
      <h2 className='font-semibold'>{t}</h2>
      {nota && <p className='text-xs text-gray-500 mb-2'>{nota}</p>}
      <div className={nota ? '' : 'mt-2'}>{children}</div>
    </section>
  )
}
// Barras horizontales de una sola serie: el largo es la cantidad; el número va escrito al lado
function Barras({ filas, max }) {
  const tope = max || Math.max(1, ...filas.map(f => f.v))
  if (!filas.length) return <p className='text-sm text-gray-500'>Sin datos.</p>
  return (
    <div className='space-y-1.5'>
      {filas.map(f => (
        <div key={f.k} className='grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-sm' title={`${f.k}: ${f.txt}`}>
          <span className='truncate text-gray-700'>{f.k}</span>
          <div className='h-3 rounded bg-gray-100 overflow-hidden'>
            <div className='h-full rounded-r' style={{ width: `${Math.max(f.v > 0 ? 2 : 0, (f.v / tope) * 100)}%`, background: f.alerta ? '#b42318' : '#a07c2c' }} />
          </div>
          <span className={`tabular-nums text-right ${f.alerta ? 'text-red-700 font-semibold' : 'text-gray-900'}`}>{f.alerta ? '⚠ ' : ''}{f.txt}</span>
        </div>
      ))}
    </div>
  )
}
function Tabla({ cols, filas, barra }) {
  const tope = barra ? Math.max(1, ...barra) : 1
  if (!filas.length) return <p className='text-sm text-gray-500'>Sin datos.</p>
  return (
    <div className='overflow-x-auto -mx-1'>
      <table className='w-full text-sm'>
        <thead><tr className='text-left text-xs text-gray-500'>{cols.map((c, i) => <th key={c} className={`px-1 py-1 font-medium ${i ? 'text-right' : ''}`}>{c}</th>)}</tr></thead>
        <tbody>
          {filas.map((f, k) => (
            <tr key={k} className='border-t border-gray-100'>
              {f.map((v, i) => (
                <td key={i} className={`px-1 py-1.5 ${i ? 'text-right tabular-nums whitespace-nowrap' : ''}`}>
                  {i === 0 && barra ? <div><div>{v}</div><div className='h-1 mt-1 rounded bg-gray-100'><div className='h-1 rounded' style={{ width: `${(barra[k] / tope) * 100}%`, background: '#a07c2c' }} /></div></div> : v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
