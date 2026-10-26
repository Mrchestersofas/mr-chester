import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/* Contabilidad gerencial (para decidir, no reemplaza al contador):
   - P&G del mes: ventas − IVA (solo lo facturado) − materiales (costo estándar por referencia)
     − comisiones por canal = margen de contribución − gastos fijos (Finanzas, empresa) = utilidad.
   - Márgenes por referencia y por canal.
   - Punto de equilibrio: cuánto hay que vender al mes para cubrir los gastos fijos.
   - Costos: aquí se ponen el costo de materiales de cada referencia y la comisión de cada canal.
   Las ventas se cuentan por fecha del pedido (igual que en Ventas). */

const MESES_L = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const CANALES = { tienda_85: 'Tienda 85', whatsapp: 'WhatsApp', instagram: 'Instagram', falabella: 'Falabella', web: 'Página web' }
const IVA = 0.19
const $ = n => (n < 0 ? '−$' : '$') + Math.round(Math.abs(Number(n || 0))).toLocaleString('es-CO')
const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : '—')
const hoyCol = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10)
function mensualEquivalente(p) {
  const v = Number(p.valor) || 0
  return { mensual: v, quincenal: p.dia2 ? 2 * v : v, bimestral: v / 2, anual: v / 12, semanas: v * 52 / 12 / (p.intervalo || 1), unica: 0 }[p.frecuencia] || 0
}

export default function Contabilidad() {
  const hoy = hoyCol()
  const [tab, setTab] = useState('pyg')
  const [anio, setAnio] = useState(Number(hoy.slice(0, 4)))
  const [mes, setMes] = useState(Number(hoy.slice(5, 7)) - 1)
  const [d, setD] = useState(null)
  const [error, setError] = useState(null)

  async function cargar() {
    const [ped, prod, pag, can] = await Promise.all([
      supabase.from('pedidos').select('id, numero, grupo, fecha_pedido, tipo_sofa, cantidad, precio_venta, canal, factura_iva, estado, cliente:clientes(nombre)').neq('estado', 'cancelado'),
      supabase.from('productos').select('id, categoria, referencia, valor_publico, valor_oferta, costo_materiales').order('categoria').order('referencia'),
      supabase.from('fin_pagos').select('*').eq('ambito', 'empresa').eq('activo', true),
      supabase.from('cont_canales').select('*'),
    ])
    const err = [ped, prod, pag, can].find(r => r.error)?.error
    if (err) { setError(err.message); return }
    setD({ pedidos: ped.data || [], productos: prod.data || [], pagos: pag.data || [], canales: Object.fromEntries((can.data || []).map(c => [c.canal, Number(c.comision || 0)])) })
  }
  useEffect(() => { cargar() }, [])

  if (error) return <div className='p-4 max-w-4xl mx-auto'><p className='rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700'>No se pudo cargar: {error}. Revisa que hayas corrido el SQL de Contabilidad en Supabase.</p></div>
  if (!d) return <div className='p-6 text-gray-400'>Calculando…</div>

  const costoDe = Object.fromEntries(d.productos.map(p => [p.referencia, p.costo_materiales == null ? null : Number(p.costo_materiales)]))
  const prefijo = `${anio}-${String(mes + 1).padStart(2, '0')}`
  const delMes = d.pedidos.filter(p => String(p.fecha_pedido || '').startsWith(prefijo))

  // Cálculo por línea de pedido
  const lineas = delMes.map(p => {
    const bruto = Number(p.precio_venta || 0)
    const iva = p.factura_iva ? bruto - bruto / (1 + IVA) : 0
    const neto = bruto - iva
    const cu = costoDe[p.tipo_sofa]
    const materiales = cu == null ? 0 : cu * Number(p.cantidad || 1)
    const comision = bruto * (d.canales[p.canal] || 0) / 100
    return { ...p, bruto, iva, neto, materiales, sinCosto: cu == null, comision, contribucion: neto - materiales - comision }
  })
  const S = k => lineas.reduce((a, x) => a + x[k], 0)
  const ventas = S('bruto'), iva = S('iva'), neto = S('neto'), materiales = S('materiales'), comisiones = S('comision'), contribucion = S('contribucion')
  const gastos = d.pagos.map(p => ({ concepto: p.concepto, categoria: p.categoria, valor: mensualEquivalente(p), freq: p.frecuencia })).filter(g => g.valor > 0)
  const porCat = {}
  gastos.forEach(g => { porCat[g.categoria] = (porCat[g.categoria] || 0) + g.valor })
  const fijos = gastos.reduce((a, g) => a + g.valor, 0)
  const utilidad = contribucion - fijos
  const sinCosto = [...new Set(lineas.filter(l => l.sinCosto).map(l => l.tipo_sofa))]
  const unidades = lineas.reduce((a, l) => a + Number(l.cantidad || 1), 0)

  return (
    <div className='p-4 max-w-5xl mx-auto'>
      <div className='flex flex-wrap items-center justify-between gap-3 mb-1'>
        <h1 className='text-xl font-medium'>Contabilidad</h1>
        {tab !== 'costos' && (
          <div className='flex gap-2'>
            <select id='c-mes' value={mes} onChange={e => setMes(Number(e.target.value))} className='text-sm border rounded-lg px-3 py-1.5'>
              {MESES_L.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select id='c-anio' value={anio} onChange={e => setAnio(Number(e.target.value))} className='text-sm border rounded-lg px-3 py-1.5'>
              {[anio - 1, anio, anio + 1].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        )}
      </div>
      <p className='text-sm text-gray-500 mb-4'>Reportes para decidir (no reemplazan la contabilidad del contador). Ventas por fecha del pedido.</p>

      <div className='flex gap-2 mb-4 overflow-x-auto'>
        {[['pyg', 'P&G del mes'], ['margenes', 'Márgenes'], ['equilibrio', 'Punto de equilibrio'], ['costos', '⚙️ Costos']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 whitespace-nowrap px-3 py-2 text-sm font-medium rounded-lg ${tab === k ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{l}</button>
        ))}
      </div>

      {tab !== 'costos' && sinCosto.length > 0 && (
        <div className='mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800'>
          ⚠ Falta el costo de materiales de: <b>{sinCosto.join(', ')}</b>. Mientras no lo pongas, esas ventas salen sin costo y el margen se ve más alto. <button className='underline font-semibold' onClick={() => setTab('costos')}>Ponerlo en Costos</button>
        </div>
      )}

      {tab === 'pyg' && <PyG {...{ ventas, iva, neto, materiales, comisiones, contribucion, porCat, fijos, utilidad, lineas, recargar: cargar, nombreMes: `${MESES_L[mes]} ${anio}`, unidades }} />}
      {tab === 'margenes' && <Margenes lineas={lineas} />}
      {tab === 'equilibrio' && <Equilibrio {...{ fijos, contribucion, neto, unidades, mes, anio, hoy }} />}
      {tab === 'costos' && <Costos productos={d.productos} canales={d.canales} recargar={cargar} pedidos={d.pedidos} />}
    </div>
  )
}

function Fila({ t, v, base, fuerte, menos, sub, color }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1.5 ${fuerte ? 'border-t border-gray-300 font-semibold' : ''} ${sub ? 'pl-4 text-gray-500 text-sm' : ''}`}>
      <span>{menos ? '− ' : ''}{t}</span>
      <span className={`tabular-nums whitespace-nowrap ${color || ''}`}>{$(v)}{base != null && <span className='text-xs text-gray-400 ml-2'>{pct(v, base)}</span>}</span>
    </div>
  )
}

function PyG({ ventas, iva, neto, materiales, comisiones, contribucion, porCat, fijos, utilidad, lineas, recargar, nombreMes, unidades }) {
  const [abierta, setAbierta] = useState(false)
  async function marcarIva(p, v) {
    await supabase.from('pedidos').update({ factura_iva: v }).eq('id', p.id)
    recargar()
  }
  return (
    <div className='space-y-4'>
      <div className='card'>
        <h2 className='text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2'>Estado de resultados · {nombreMes}</h2>
        <Fila t={`Ventas (${lineas.length} productos, ${unidades} unidades)`} v={ventas} />
        <Fila t='IVA de ventas facturadas' v={iva} menos sub />
        <Fila t='Ventas netas' v={neto} fuerte />
        <Fila t='Materiales (costo estándar)' v={materiales} base={neto} menos sub />
        <Fila t='Comisiones de canal' v={comisiones} base={neto} menos sub />
        <Fila t='Margen de contribución' v={contribucion} base={neto} fuerte />
        {Object.entries(porCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => <Fila key={c} t={c} v={v} menos sub />)}
        <Fila t='Gastos fijos del mes' v={fijos} base={neto} fuerte />
        <div className={`mt-2 rounded-lg px-3 py-3 flex justify-between items-baseline ${utilidad >= 0 ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
          <b>Utilidad operativa</b>
          <b className='text-xl tabular-nums'>{$(utilidad)} <span className='text-sm font-medium'>{pct(utilidad, neto)}</span></b>
        </div>
        <p className='text-xs text-gray-500 mt-3'>Gastos fijos = los gastos de la empresa en Finanzas, llevados a valor mensual (las primas se reparten en 12 meses, el acueducto en 2). Si falta un gasto (pauta, transporte, comisiones de datáfono), agrégalo en Finanzas.</p>
      </div>

      <div className='card'>
        <button type='button' className='w-full flex justify-between items-center' onClick={() => setAbierta(!abierta)}>
          <span className='text-sm font-semibold'>Ventas del mes · marcar las que se facturaron con IVA</span>
          <span className='text-gray-400'>{abierta ? '▲' : '▼'}</span>
        </button>
        {abierta && (
          <div className='overflow-x-auto mt-3'>
            <table>
              <thead><tr><th>Pedido</th><th>Cliente</th><th>Producto</th><th>Canal</th><th>Venta</th><th>Materiales</th><th>Contribución</th><th>Factura IVA</th></tr></thead>
              <tbody>
                {lineas.map(l => (
                  <tr key={l.id}>
                    <td className='whitespace-nowrap font-medium text-purple-700'>{l.numero}</td>
                    <td>{l.cliente?.nombre || '—'}</td>
                    <td>{l.tipo_sofa}{Number(l.cantidad) > 1 ? ` × ${l.cantidad}` : ''}</td>
                    <td className='text-sm text-gray-500'>{CANALES[l.canal] || '—'}</td>
                    <td className='whitespace-nowrap'>{$(l.bruto)}</td>
                    <td className={`whitespace-nowrap ${l.sinCosto ? 'text-amber-600' : ''}`}>{l.sinCosto ? 'sin costo' : $(l.materiales)}</td>
                    <td className='whitespace-nowrap'>{$(l.contribucion)}</td>
                    <td className='text-center'><input type='checkbox' aria-label={`Factura con IVA ${l.numero}`} checked={!!l.factura_iva} onChange={e => marcarIva(l, e.target.checked)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function agrupar(lineas, clave) {
  const g = {}
  for (const l of lineas) {
    const k = clave(l)
    if (!g[k]) g[k] = { unidades: 0, neto: 0, materiales: 0, comision: 0, contribucion: 0, sinCosto: false }
    g[k].unidades += Number(l.cantidad || 1); g[k].neto += l.neto; g[k].materiales += l.materiales
    g[k].comision += l.comision; g[k].contribucion += l.contribucion; g[k].sinCosto = g[k].sinCosto || l.sinCosto
  }
  return Object.entries(g).sort((a, b) => b[1].contribucion - a[1].contribucion)
}
function TablaMargen({ titulo, filas, etiqueta }) {
  return (
    <div className='card'>
      <h2 className='text-sm font-medium mb-3'>{titulo}</h2>
      {!filas.length ? <p className='text-sm text-gray-400 text-center py-6'>Sin ventas este mes.</p> : (
        <div className='overflow-x-auto'>
          <table>
            <thead><tr><th>{etiqueta}</th><th>Uds</th><th>Ventas netas</th><th>Materiales</th><th>Comisión</th><th>Contribución</th><th>Margen</th></tr></thead>
            <tbody>
              {filas.map(([k, x]) => (
                <tr key={k}>
                  <td className='font-medium'>{k}{x.sinCosto && <span className='text-amber-600 text-xs'> · sin costo</span>}</td>
                  <td>{x.unidades}</td>
                  <td className='whitespace-nowrap'>{$(x.neto)}</td>
                  <td className='whitespace-nowrap'>{$(x.materiales)}</td>
                  <td className='whitespace-nowrap'>{$(x.comision)}</td>
                  <td className='whitespace-nowrap font-semibold'>{$(x.contribucion)}</td>
                  <td className={`font-semibold ${x.contribucion / (x.neto || 1) < 0.3 ? 'text-red-600' : 'text-green-700'}`}>{pct(x.contribucion, x.neto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
function Margenes({ lineas }) {
  return (
    <div className='space-y-4'>
      <TablaMargen titulo='Por referencia' etiqueta='Referencia' filas={agrupar(lineas, l => l.tipo_sofa || 'Sin referencia')} />
      <TablaMargen titulo='Por canal' etiqueta='Canal' filas={agrupar(lineas, l => CANALES[l.canal] || 'Sin canal')} />
      <p className='text-xs text-gray-500'>Contribución = ventas netas − materiales − comisión del canal. Es lo que deja cada venta para pagar nómina, arriendos y demás gastos fijos. En rojo, márgenes por debajo del 30%.</p>
    </div>
  )
}

function Equilibrio({ fijos, contribucion, neto, unidades, mes, anio, hoy }) {
  const ratio = neto ? contribucion / neto : 0
  const ventasEq = ratio > 0 ? fijos / ratio : 0
  const contribUnidad = unidades ? contribucion / unidades : 0
  const unidadesEq = contribUnidad > 0 ? Math.ceil(fijos / contribUnidad) : 0
  const avance = ventasEq ? Math.min(100, (neto / ventasEq) * 100) : 0
  const esMesActual = hoy.startsWith(`${anio}-${String(mes + 1).padStart(2, '0')}`)
  return (
    <div className='space-y-4'>
      <div className='card'>
        <h2 className='text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3'>Punto de equilibrio · {MESES_L[mes]} {anio}</h2>
        {!unidades ? <p className='text-sm text-gray-500'>Sin ventas este mes para calcularlo.</p> : (
          <>
            <p className='text-sm text-gray-600 mb-3'>Con el margen de este mes, para cubrir <b>{$(fijos)}</b> de gastos fijos necesitas:</p>
            <div className='grid grid-cols-2 gap-3 mb-4'>
              <div className='rounded-lg bg-gray-50 p-3 text-center'><div className='text-2xl font-semibold tabular-nums'>{$(ventasEq)}</div><div className='text-xs text-gray-500'>en ventas netas al mes</div></div>
              <div className='rounded-lg bg-gray-50 p-3 text-center'><div className='text-2xl font-semibold'>{unidadesEq}</div><div className='text-xs text-gray-500'>unidades al mes (aprox.)</div></div>
            </div>
            <div className='flex justify-between text-sm mb-1'><span>{esMesActual ? 'Vas en' : 'Llegaste a'} {$(neto)} · {unidades} unidades</span><b>{avance.toFixed(0)}%</b></div>
            <div className='h-3 rounded-full bg-gray-100 overflow-hidden'><div className={`h-full ${avance >= 100 ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: avance + '%' }} /></div>
            <p className='text-sm mt-3'>{neto >= ventasEq ? `✅ Ya cubriste los gastos fijos; cada venta adicional deja en promedio ${$(contribUnidad)} de utilidad.` : `Te faltan ${$(ventasEq - neto)} en ventas (≈ ${Math.max(0, unidadesEq - unidades)} unidades) para cubrir los gastos fijos.`}</p>
          </>
        )}
      </div>
      <p className='text-xs text-gray-500'>Margen de contribución de este mes: {pct(contribucion, neto)} · contribución promedio por unidad: {$(contribUnidad)}.</p>
    </div>
  )
}

function Costos({ productos, canales, recargar, pedidos }) {
  const [costos, setCostos] = useState(() => Object.fromEntries(productos.map(p => [p.id, p.costo_materiales ?? ''])))
  const [com, setCom] = useState(() => Object.fromEntries(Object.keys(CANALES).map(k => [k, canales[k] ?? 0])))
  const [guardando, setGuardando] = useState(false)
  const [ok, setOk] = useState(false)
  const vendidas = new Set(pedidos.map(p => p.tipo_sofa))

  async function guardar() {
    setGuardando(true); setOk(false)
    for (const p of productos) {
      const v = costos[p.id] === '' ? null : Number(String(costos[p.id]).replace(/\D/g, ''))
      if (v !== (p.costo_materiales == null ? null : Number(p.costo_materiales))) await supabase.from('productos').update({ costo_materiales: v }).eq('id', p.id)
    }
    await supabase.from('cont_canales').upsert(Object.entries(com).map(([canal, comision]) => ({ canal, comision: Number(comision) || 0 })))
    setGuardando(false); setOk(true); recargar()
  }

  return (
    <div className='space-y-4'>
      <div className='card'>
        <h2 className='text-sm font-medium mb-1'>Costo de materiales por referencia</h2>
        <p className='text-xs text-gray-500 mb-3'>Madera, espuma, tela, pegante, tornillería y demás de UNA unidad. Sin mano de obra (la nómina va en gastos fijos). Las que ya se han vendido salen primero.</p>
        <div className='overflow-x-auto'>
          <table>
            <thead><tr><th>Referencia</th><th>Precio oferta</th><th>Costo materiales</th><th>Margen</th></tr></thead>
            <tbody>
              {[...productos].sort((a, b) => (vendidas.has(b.referencia) - vendidas.has(a.referencia)) || a.referencia.localeCompare(b.referencia)).map(p => {
                const c = Number(String(costos[p.id]).replace(/\D/g, '')) || 0
                const precio = Number(p.valor_oferta || p.valor_publico || 0)
                return (
                  <tr key={p.id}>
                    <td className='font-medium'>{p.referencia}{vendidas.has(p.referencia) && <span className='text-xs text-purple-600'> · se vende</span>}</td>
                    <td className='whitespace-nowrap text-gray-500'>{precio ? $(precio) : '—'}</td>
                    <td><input id={`costo-${p.id}`} inputMode='numeric' className='w-32' placeholder='Ej: 650000' value={costos[p.id] === null ? '' : costos[p.id]} onChange={e => setCostos(x => ({ ...x, [p.id]: e.target.value.replace(/\D/g, '') }))} /></td>
                    <td className='text-sm'>{c && precio ? pct(precio - c, precio) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className='card'>
        <h2 className='text-sm font-medium mb-1'>Comisión por canal (%)</h2>
        <p className='text-xs text-gray-500 mb-3'>Lo que se paga por vender en ese canal: comisión de Falabella, pasarela de pagos de la página, etc.</p>
        <div className='grid grid-cols-2 sm:grid-cols-5 gap-3'>
          {Object.entries(CANALES).map(([k, l]) => (
            <div key={k}><label htmlFor={`com-${k}`} className='text-xs text-gray-500 mb-1 block'>{l}</label>
              <input id={`com-${k}`} inputMode='decimal' value={com[k]} onChange={e => setCom(x => ({ ...x, [k]: e.target.value.replace(/[^0-9.]/g, '') }))} /></div>
          ))}
        </div>
      </div>
      <div className='flex items-center gap-3'>
        <button className='btn btn-primary' onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar costos'}</button>
        {ok && <span className='text-sm text-green-700'>✓ Guardado</span>}
      </div>
    </div>
  )
}
