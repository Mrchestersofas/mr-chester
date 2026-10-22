import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/* Finanzas: calendario de pagos (empresa y personales), flujo de caja proyectado,
   pagos programados y cuentas. Solo usuarios con sesión (las tablas fin_* exigen login). */

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const pesos = n => (n < 0 ? '−' : '') + '$' + Math.round(Math.abs(Number(n || 0))).toLocaleString('es-CO')
const millones = n => (n < 0 ? '−' : '') + '$' + (Math.abs(n) / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + 'M'
const hoyISO = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10)
function sumar(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
function f(iso) { if (!iso) return '—'; const d = new Date(iso + 'T12:00:00Z'); return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}` }
function finDeMes(y, m) { return new Date(Date.UTC(y, m + 1, 0)).getUTCDate() }
function fecha(y, m, d) { const yy = y + Math.floor(m / 12), mm = ((m % 12) + 12) % 12; return `${yy}-${String(mm + 1).padStart(2, '0')}-${String(Math.min(d, finDeMes(yy, mm))).padStart(2, '0')}` }
const lunesDe = iso => sumar(iso, -((new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7))

const FRECUENCIAS = [['mensual', 'Cada mes'], ['quincenal', 'Quincenal (2 días al mes)'], ['bimestral', 'Cada 2 meses'], ['semanas', 'Cada N semanas'], ['anual', 'Una vez al año'], ['unica', 'Una sola vez']]
const MEDIOS = ['transferencia', 'PSE', 'débito automático', 'tarjeta de crédito', 'efectivo', 'llave']

/** Fechas en que toca un pago entre `desde` y `hasta` (ISO). */
function ocurrencias(p, desde, hasta) {
  const out = []
  const [y0, m0] = desde.split('-').map(Number)
  const meses = []
  for (let k = -1; k < 15; k++) meses.push([y0, m0 - 1 + k])
  const add = d => { if (d >= desde && d <= hasta) out.push(d) }
  if (p.frecuencia === 'mensual' && p.dia) meses.forEach(([y, m]) => add(fecha(y, m, p.dia)))
  if (p.frecuencia === 'quincenal' && p.dia) meses.forEach(([y, m]) => { add(fecha(y, m, p.dia)); if (p.dia2) add(fecha(y, m, p.dia2)) })
  if (p.frecuencia === 'bimestral' && p.dia) meses.forEach(([y, m]) => { const mm = ((m % 12) + 12) % 12; if (!p.mes || (mm - (p.mes - 1) + 12) % 2 === 0) add(fecha(y, m, p.dia)) })
  if (p.frecuencia === 'anual' && p.dia && p.mes) meses.forEach(([y, m]) => { if (((m % 12) + 12) % 12 === p.mes - 1) add(fecha(y, m, p.dia)) })
  if (p.frecuencia === 'semanas' && p.fecha_base) { const n = 7 * (p.intervalo || 1); let d = p.fecha_base; let g = 0; while (d < desde && g++ < 500) d = sumar(d, n); while (d <= hasta && g++ < 1000) { add(d); d = sumar(d, n) } }
  if (p.frecuencia === 'unica' && p.fecha_base) add(p.fecha_base)
  return [...new Set(out)].sort()
}
function mensualEquivalente(p) {
  const v = Number(p.valor) || 0
  return { mensual: v, quincenal: p.dia2 ? 2 * v : v, bimestral: v / 2, anual: v / 12, semanas: v * 52 / 12 / (p.intervalo || 1), unica: 0 }[p.frecuencia] || 0
}
function cuando(p) {
  if (p.frecuencia === 'mensual') return p.dia ? `Día ${p.dia} de cada mes` : 'Fecha por definir'
  if (p.frecuencia === 'quincenal') return p.dia ? `Días ${p.dia}${p.dia2 ? ` y ${p.dia2}` : ''}` : 'Fechas por definir'
  if (p.frecuencia === 'bimestral') return p.dia ? `Día ${p.dia}, cada 2 meses` : 'Fecha por definir'
  if (p.frecuencia === 'anual') return p.dia && p.mes ? `${p.dia} de ${MESES[p.mes - 1]} cada año` : 'Fecha por definir'
  if (p.frecuencia === 'semanas') return p.fecha_base ? `Cada ${p.intervalo || 1} semana${(p.intervalo || 1) > 1 ? 's' : ''} desde ${f(p.fecha_base)}` : 'Fecha por definir'
  return p.fecha_base ? f(p.fecha_base) : 'Fecha por definir'
}

export default function Finanzas() {
  const [tab, setTab] = useState('calendario')
  const [d, setD] = useState(null)
  const [error, setError] = useState(null)

  async function cargar() {
    const hoy = hoyISO()
    const [c, p, m, ped, prov] = await Promise.all([
      supabase.from('fin_cuentas').select('*').eq('activo', true).order('nombre'),
      supabase.from('fin_pagos').select('*').order('ambito').order('concepto'),
      supabase.from('fin_movimientos').select('*').gte('fecha', sumar(hoy, -120)).order('fecha', { ascending: false }),
      supabase.from('pedidos').select('numero, fecha_entrega, precio_venta, abono, estado, cliente:clientes(nombre)').not('estado', 'in', '(entregado,cancelado)'),
      supabase.from('compra_proveedores').select('nombre, dias, costo_fijo, activo, insumos:compra_insumos(precio, cantidad, activo)').eq('activo', true),
    ])
    const err = [c, p, m].find(x => x.error)?.error
    if (err) { setError(err.message); return }
    setD({ cuentas: c.data || [], pagos: p.data || [], movs: m.data || [], pedidos: ped.data || [], provs: prov.data || [] })
  }
  useEffect(() => { cargar() }, [])

  if (error) return <div className='p-4 max-w-2xl mx-auto'><p className='rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700'>No se pudo cargar Finanzas: {error}</p></div>
  if (!d) return <div className='p-4 text-gray-500'>Cargando…</div>

  return (
    <div className='p-4 max-w-2xl mx-auto'>
      <h1 className='text-xl font-medium mb-4'>Finanzas</h1>
      <div className='flex gap-1.5 mb-4 overflow-x-auto pb-1'>
        {[['calendario', 'Calendario'], ['flujo', 'Flujo de caja'], ['pagos', 'Pagos'], ['cuentas', 'Cuentas']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap ${tab === k ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{l}</button>
        ))}
      </div>
      {tab === 'calendario' && <Calendario d={d} recargar={cargar} />}
      {tab === 'flujo' && <Flujo d={d} />}
      {tab === 'pagos' && <Pagos d={d} recargar={cargar} />}
      {tab === 'cuentas' && <Cuentas d={d} recargar={cargar} />}
    </div>
  )
}

/* ---------------- Calendario de pagos ---------------- */

function Calendario({ d, recargar }) {
  const hoy = hoyISO()
  const [filtro, setFiltro] = useState('todos')
  const [dias, setDias] = useState(31)
  const [pagando, setPagando] = useState(null)
  const pagado = (p, per) => d.movs.find(m => m.pago_id === p.id && m.periodo === per)
  const lista = []
  d.pagos.filter(p => p.activo && (filtro === 'todos' || p.ambito === filtro)).forEach(p => {
    ocurrencias(p, sumar(hoy, -45), sumar(hoy, dias)).forEach(per => {
      const mv = pagado(p, per)
      if (per < hoy && mv) return // pagos viejos ya hechos no se muestran
      lista.push({ p, per, mv })
    })
  })
  lista.sort((a, b) => a.per.localeCompare(b.per) || a.p.concepto.localeCompare(b.p.concepto))
  const vencidos = lista.filter(x => x.per < hoy && !x.mv)
  const proximos = lista.filter(x => x.per >= hoy)
  const porDia = {}
  proximos.forEach(x => { (porDia[x.per] = porDia[x.per] || []).push(x) })
  const totalPend = proximos.filter(x => !x.mv).reduce((s, x) => s + Number(x.p.valor || 0), 0)
  const semana = proximos.filter(x => !x.mv && x.per <= sumar(hoy, 7)).reduce((s, x) => s + Number(x.p.valor || 0), 0)
  const pendientesDato = d.pagos.filter(p => p.activo && p.pendiente_dato && (filtro === 'todos' || p.ambito === filtro))

  return (
    <div className='space-y-3'>
      <div className='flex gap-2 text-sm flex-wrap'>
        {[['todos', 'Todo'], ['empresa', 'Empresa'], ['personal', 'Personal']].map(([k, l]) => (
          <button key={k} className={`px-3 py-1 rounded-full border ${filtro === k ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 bg-white'}`} onClick={() => setFiltro(k)}>{l}</button>
        ))}
      </div>
      <div className='grid grid-cols-3 gap-2'>
        <Caja t='Vencidos' v={pesos(vencidos.reduce((s, x) => s + Number(x.p.valor || 0), 0))} color={vencidos.length ? 'text-red-600' : ''} />
        <Caja t='Próximos 7 días' v={pesos(semana)} />
        <Caja t={`Próximos ${dias} días`} v={pesos(totalPend)} />
      </div>

      {vencidos.length > 0 && (
        <div className='card border-red-300'>
          <div className='font-semibold text-red-700 mb-1'>Vencidos sin registrar</div>
          {vencidos.map(x => <FilaPago key={x.p.id + x.per} x={x} onPagar={() => setPagando(x)} mostrarFecha />)}
        </div>
      )}

      {Object.keys(porDia).sort().map(dia => {
        const xs = porDia[dia]
        const pend = xs.filter(x => !x.mv).reduce((s, x) => s + Number(x.p.valor || 0), 0)
        return (
          <div key={dia} className={`card ${dia === hoy ? 'border-gray-900' : ''}`}>
            <div className='flex justify-between font-semibold mb-1 capitalize'><span>{dia === hoy ? 'Hoy · ' : ''}{f(dia)}</span><span>{pend ? pesos(pend) : '✓'}</span></div>
            {xs.map(x => <FilaPago key={x.p.id + x.per} x={x} onPagar={() => setPagando(x)} />)}
          </div>
        )
      })}
      {Object.keys(porDia).length === 0 && <div className='card text-center text-gray-500 py-6'>No hay pagos en este periodo.</div>}
      <button className='btn w-full' onClick={() => setDias(dias === 31 ? 92 : 31)}>{dias === 31 ? 'Ver 3 meses' : 'Ver solo 1 mes'}</button>

      {pendientesDato.length > 0 && (
        <div className='card border-amber-300'>
          <div className='font-semibold text-amber-800 mb-1'>Faltan datos ({pendientesDato.length})</div>
          <p className='text-xs text-gray-600 mb-2'>Estos pagos no salen en el calendario hasta tener valor y fecha. Complétalos en la pestaña Pagos.</p>
          <div className='text-sm text-gray-700'>{pendientesDato.map(p => p.concepto).join(' · ')}</div>
        </div>
      )}
      {pagando && <ModalPagar x={pagando} cuentas={d.cuentas} cerrar={() => setPagando(null)} listo={() => { setPagando(null); recargar() }} />}
    </div>
  )
}

function Caja({ t, v, color = '' }) {
  return <div className='card text-center py-3 px-2'><div className={`text-base font-semibold ${color}`}>{v}</div><div className='text-xs text-gray-500'>{t}</div></div>
}

function FilaPago({ x, onPagar, mostrarFecha }) {
  const { p, per, mv } = x
  return (
    <div className='flex items-center justify-between gap-2 py-2 border-t border-gray-100 first:border-0'>
      <div className='min-w-0'>
        <div className={`text-sm font-medium ${mv ? 'text-gray-400 line-through' : ''}`}>{p.concepto}</div>
        <div className='text-xs text-gray-500'>
          {mostrarFecha ? `${f(per)} · ` : ''}{p.ambito === 'empresa' ? 'Empresa' : 'Personal'}{p.estimado ? ' · aprox.' : ''}{p.medio ? ` · ${p.medio}` : ''}
          {mv && <span className='text-green-700'> · ✓ pagado {f(mv.fecha)} {pesos(mv.valor)}</span>}
        </div>
      </div>
      <div className='flex items-center gap-2 flex-none'>
        <span className='text-sm font-semibold'>{pesos(p.valor)}</span>
        {!mv && <button className='btn text-xs px-2 py-1' onClick={onPagar}>Pagar</button>}
      </div>
    </div>
  )
}

function ModalPagar({ x, cuentas, cerrar, listo }) {
  const [valor, setValor] = useState(String(Math.round(x.p.valor || 0)))
  const [fechaP, setFechaP] = useState(hoyISO())
  const [cuenta, setCuenta] = useState(x.p.cuenta_id || cuentas[0]?.id || '')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  async function guardar() {
    if (!(Number(valor) > 0)) { setError('Escribe el valor pagado.'); return }
    setGuardando(true)
    const { data: s } = await supabase.auth.getSession()
    const quien = s.session?.user?.email === 'josephtoledo@gmail.com' ? 'Joseph' : (s.session?.user?.email || '').split('@')[0]
    const { error: e } = await supabase.from('fin_movimientos').insert({ pago_id: x.p.id, periodo: x.per, concepto: x.p.concepto, fecha: fechaP, valor: Number(valor), cuenta_id: cuenta || null, nota: nota.trim() || null, registrado_por: quien })
    setGuardando(false)
    if (e) { setError('No se guardó: ' + e.message); return }
    listo()
  }
  return (
    <Modal cerrar={cerrar} titulo={`Pagar · ${x.p.concepto}`}>
      <p className='text-sm text-gray-600'>Programado para el <b className='capitalize'>{f(x.per)}</b>{x.p.notas ? ` · ${x.p.notas}` : ''}</p>
      <div className='grid grid-cols-2 gap-2'>
        <L t='Valor pagado'><input inputMode='numeric' value={valor} onChange={e => setValor(e.target.value.replace(/\D/g, ''))} /></L>
        <L t='Fecha'><input type='date' value={fechaP} onChange={e => setFechaP(e.target.value)} /></L>
      </div>
      <L t='Cuenta'>
        <select value={cuenta} onChange={e => setCuenta(e.target.value)}>
          <option value=''>Sin especificar</option>
          {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </L>
      <L t='Nota (opcional)'><input value={nota} onChange={e => setNota(e.target.value)} placeholder='Ej: comprobante 4521' /></L>
      {error && <p className='text-sm text-red-700'>{error}</p>}
      <button className='btn btn-primary w-full' onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : '✓ Registrar pago'}</button>
    </Modal>
  )
}

/* ---------------- Flujo de caja ---------------- */

function Flujo({ d }) {
  const hoy = hoyISO()
  const [ventas, setVentas] = useState('')
  const [incluirPersonal, setIncluirPersonal] = useState(true)
  const lunes0 = lunesDe(hoy)
  const semanas = Array.from({ length: 9 }, (_, k) => sumar(lunes0, 7 * k))
  const saldoIni = d.cuentas.reduce((s, c) => s + (Number(c.saldo) || 0), 0)
  const sinSaldo = d.cuentas.filter(c => c.saldo == null)
  const pagado = (p, per) => d.movs.some(m => m.pago_id === p.id && m.periodo === per)

  // Salidas por pagos (lo vencido sin pagar cuenta en la semana actual)
  const salidas = {}, salEmp = {}, salPer = {}
  d.pagos.filter(p => p.activo && (incluirPersonal || p.ambito === 'empresa')).forEach(p => {
    ocurrencias(p, sumar(hoy, -45), sumar(semanas[8], 6)).forEach(per => {
      if (pagado(p, per)) return
      const sem = per < lunes0 ? lunes0 : lunesDe(per)
      const v = Number(p.valor) || 0
      salidas[sem] = (salidas[sem] || 0) + v
      if (p.ambito === 'empresa') salEmp[sem] = (salEmp[sem] || 0) + v; else salPer[sem] = (salPer[sem] || 0) + v
    })
  })
  // Compras fijas de fábrica (por día de la semana)
  const totalProv = p => (p.insumos || []).filter(i => i.activo).reduce((a, i) => a + Number(i.precio) * Number(i.cantidad), 0) + Number(p.costo_fijo || 0)
  const compraSemana = d.provs.reduce((s, p) => s + totalProv(p) * (p.dias || []).length, 0)
  const diaHoy = new Date(hoy + 'T12:00:00Z').getUTCDay() // 0 = domingo
  const compraRestoSemana = d.provs.reduce((s, p) => s + totalProv(p) * (p.dias || []).filter(x => diaHoy === 0 || x >= diaHoy).length, 0)
  // Recaudos: saldo de cada pedido el día de entrega (o esta semana si ya pasó)
  const recaudo = {}
  d.pedidos.forEach(p => {
    const s = Number(p.precio_venta || 0) - Number(p.abono || 0)
    if (s <= 0) return
    const fe = String(p.fecha_entrega || hoy).slice(0, 10)
    const sem = fe < lunes0 ? lunes0 : lunesDe(fe)
    recaudo[sem] = (recaudo[sem] || 0) + s
  })
  const ventasSem = (Number(ventas) || 0) * 0.5 // abono del 50 % que entra la misma semana

  let saldo = saldoIni
  const filas = semanas.map((l, k) => {
    const entra = (recaudo[l] || 0) + ventasSem
    const compras = k === 0 ? compraRestoSemana : compraSemana
    const sale = (salidas[l] || 0) + compras
    saldo += entra - sale
    return { l, entra, compras, emp: salEmp[l] || 0, per: salPer[l] || 0, sale, saldo }
  })
  const primerNegativo = filas.find(x => x.saldo < 0)

  return (
    <div className='space-y-3'>
      <div className='card space-y-2 text-sm'>
        <div className='flex justify-between'><span className='text-gray-600'>Saldo hoy en cuentas</span><b>{pesos(saldoIni)}</b></div>
        {sinSaldo.length > 0 && <p className='text-xs text-amber-700'>⚠ Falta el saldo de: {sinSaldo.map(c => c.nombre).join(', ')}. Actualízalo en Cuentas.</p>}
        <L t='Ventas nuevas estimadas por semana (opcional)'><input inputMode='numeric' value={ventas} onChange={e => setVentas(e.target.value.replace(/\D/g, ''))} placeholder='Ej: 10000000' /></L>
        <p className='text-xs text-gray-500'>Se cuenta el 50 % de abono la misma semana. El otro 50 % entra con la entrega (ya está en recaudos cuando se registra el pedido).</p>
        <label className='flex items-center gap-2'><input type='checkbox' checked={incluirPersonal} onChange={e => setIncluirPersonal(e.target.checked)} style={{ width: 'auto' }} /> Incluir gastos personales</label>
      </div>

      {primerNegativo
        ? <div className='rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800'>⚠ La semana del <b className='capitalize'>{f(primerNegativo.l)}</b> la plata no alcanza: el saldo quedaría en <b>{pesos(primerNegativo.saldo)}</b>.</div>
        : <div className='rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800'>✓ Con estos datos, el saldo alcanza las próximas 9 semanas.</div>}

      {filas.map(x => (
        <div key={x.l} className={`card ${x.saldo < 0 ? 'border-red-300' : ''}`}>
          <div className='flex justify-between font-semibold capitalize'><span>Semana del {f(x.l)}</span><span className={x.saldo < 0 ? 'text-red-600' : ''}>{millones(x.saldo)}</span></div>
          <div className='grid grid-cols-2 gap-x-3 text-sm mt-1'>
            <span className='text-green-700'>+ Entra {pesos(x.entra)}</span>
            <span className='text-red-700 text-right'>− Sale {pesos(x.sale)}</span>
          </div>
          <div className='text-xs text-gray-500 mt-0.5'>Pagos empresa {pesos(x.emp)} · personales {pesos(x.per)} · compras fábrica {pesos(x.compras)}</div>
        </div>
      ))}
    </div>
  )
}

/* ---------------- Pagos programados ---------------- */

function Pagos({ d, recargar }) {
  const [editando, setEditando] = useState(null)
  const grupos = [['empresa', 'Empresa'], ['personal', 'Personal']]
  return (
    <div className='space-y-4'>
      {grupos.map(([k, l]) => {
        const ps = d.pagos.filter(p => p.ambito === k)
        const total = ps.filter(p => p.activo).reduce((s, p) => s + mensualEquivalente(p), 0)
        return (
          <section key={k}>
            <div className='flex justify-between items-baseline mb-2'><h2 className='font-semibold'>{l}</h2><span className='text-sm text-gray-600'>≈ {pesos(total)} al mes</span></div>
            <div className='space-y-2'>
              {ps.map(p => editando === p.id
                ? <EditarPago key={p.id} p={p} cuentas={d.cuentas} cerrar={() => setEditando(null)} listo={() => { setEditando(null); recargar() }} />
                : (
                  <button key={p.id} className={`card w-full text-left py-3 ${!p.activo ? 'opacity-50' : ''} ${p.pendiente_dato ? 'border-amber-300' : ''}`} onClick={() => setEditando(p.id)}>
                    <div className='flex justify-between gap-2'>
                      <div className='min-w-0'>
                        <div className='font-medium'>{p.concepto}{!p.activo ? ' (pausado)' : ''}</div>
                        <div className='text-xs text-gray-500'>{cuando(p)}{p.categoria ? ` · ${p.categoria}` : ''}{p.pendiente_dato ? ' · ⚠ faltan datos' : ''}</div>
                      </div>
                      <div className='text-sm font-semibold whitespace-nowrap'>{p.valor ? pesos(p.valor) : '—'}{p.estimado && p.valor ? '*' : ''}</div>
                    </div>
                  </button>
                ))}
            </div>
          </section>
        )
      })}
      {editando === 'nuevo'
        ? <EditarPago p={{ ambito: 'empresa', frecuencia: 'mensual', activo: true }} cuentas={d.cuentas} cerrar={() => setEditando(null)} listo={() => { setEditando(null); recargar() }} />
        : <button className='btn w-full' onClick={() => setEditando('nuevo')}>+ Agregar pago</button>}
      <p className='text-xs text-gray-500'>* valor aproximado</p>
    </div>
  )
}

function EditarPago({ p, cuentas, cerrar, listo }) {
  const [x, setX] = useState({ concepto: '', categoria: '', valor: '', estimado: false, dia: '', dia2: '', mes: '', intervalo: '', fecha_base: '', cuenta_id: '', medio: '', notas: '', ...p, valor: p.valor ? String(Math.round(p.valor)) : '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const s = (k, v) => setX(o => ({ ...o, [k]: v }))
  async function guardar() {
    if (!x.concepto.trim()) { setError('Escribe el concepto.'); return }
    const n = v => (v === '' || v == null ? null : Number(v))
    const fila = {
      concepto: x.concepto.trim(), categoria: x.categoria || null, ambito: x.ambito, valor: Number(x.valor) || 0, estimado: !!x.estimado,
      frecuencia: x.frecuencia, dia: n(x.dia), dia2: n(x.dia2), mes: n(x.mes), intervalo: n(x.intervalo), fecha_base: x.fecha_base || null,
      cuenta_id: x.cuenta_id || null, medio: x.medio || null, notas: x.notas || null, activo: x.activo !== false,
    }
    const tieneFecha = ['semanas', 'unica'].includes(fila.frecuencia) ? !!fila.fecha_base : fila.frecuencia === 'anual' ? !!(fila.dia && fila.mes) : !!fila.dia
    fila.pendiente_dato = !(fila.valor > 0 && tieneFecha)
    setGuardando(true)
    const r = p.id ? await supabase.from('fin_pagos').update(fila).eq('id', p.id) : await supabase.from('fin_pagos').insert(fila)
    setGuardando(false)
    if (r.error) { setError('No se guardó: ' + r.error.message); return }
    listo()
  }
  return (
    <div className='card space-y-3 border-gray-900'>
      <L t='Concepto'><input value={x.concepto} onChange={e => s('concepto', e.target.value)} placeholder='Ej: Internet fábrica' /></L>
      <div className='grid grid-cols-2 gap-2'>
        <L t='Empresa o personal'><select value={x.ambito} onChange={e => s('ambito', e.target.value)}><option value='empresa'>Empresa</option><option value='personal'>Personal</option></select></L>
        <L t='Categoría'><input value={x.categoria || ''} onChange={e => s('categoria', e.target.value)} placeholder='Ej: Servicios' /></L>
        <L t='Valor'><input inputMode='numeric' value={x.valor} onChange={e => s('valor', e.target.value.replace(/\D/g, ''))} /></L>
        <label className='flex items-end gap-2 text-sm pb-2'><input type='checkbox' checked={!!x.estimado} onChange={e => s('estimado', e.target.checked)} style={{ width: 'auto' }} /> Aproximado</label>
      </div>
      <L t='¿Cada cuánto?'><select value={x.frecuencia} onChange={e => s('frecuencia', e.target.value)}>{FRECUENCIAS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></L>
      <div className='grid grid-cols-2 gap-2'>
        {['mensual', 'quincenal', 'bimestral', 'anual'].includes(x.frecuencia) && <L t={x.frecuencia === 'quincenal' ? 'Primer día' : 'Día del mes'}><input inputMode='numeric' value={x.dia ?? ''} onChange={e => s('dia', e.target.value.replace(/\D/g, ''))} placeholder='1–31' /></L>}
        {x.frecuencia === 'quincenal' && <L t='Segundo día'><input inputMode='numeric' value={x.dia2 ?? ''} onChange={e => s('dia2', e.target.value.replace(/\D/g, ''))} placeholder='1–31' /></L>}
        {['anual', 'bimestral'].includes(x.frecuencia) && <L t={x.frecuencia === 'anual' ? 'Mes' : 'Mes en que empieza'}><select value={x.mes ?? ''} onChange={e => s('mes', e.target.value)}><option value=''>—</option>{MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></L>}
        {x.frecuencia === 'semanas' && <L t='Cada cuántas semanas'><input inputMode='numeric' value={x.intervalo ?? ''} onChange={e => s('intervalo', e.target.value.replace(/\D/g, ''))} placeholder='Ej: 4' /></L>}
        {['semanas', 'unica'].includes(x.frecuencia) && <L t={x.frecuencia === 'unica' ? 'Fecha' : 'Primera fecha'}><input type='date' value={x.fecha_base || ''} onChange={e => s('fecha_base', e.target.value)} /></L>}
      </div>
      <div className='grid grid-cols-2 gap-2'>
        <L t='Sale de'><select value={x.cuenta_id || ''} onChange={e => s('cuenta_id', e.target.value)}><option value=''>—</option>{cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></L>
        <L t='Cómo se paga'><select value={x.medio || ''} onChange={e => s('medio', e.target.value)}><option value=''>—</option>{MEDIOS.map(m => <option key={m} value={m}>{m}</option>)}</select></L>
      </div>
      <L t='Notas'><input value={x.notas || ''} onChange={e => s('notas', e.target.value)} /></L>
      <label className='flex items-center gap-2 text-sm'><input type='checkbox' checked={x.activo === false} onChange={e => s('activo', !e.target.checked)} style={{ width: 'auto' }} /> Pausar este pago</label>
      {error && <p className='text-sm text-red-700'>{error}</p>}
      <div className='flex gap-2'><button className='btn btn-primary flex-1' onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button><button className='btn' onClick={cerrar}>Cancelar</button></div>
    </div>
  )
}

/* ---------------- Cuentas ---------------- */

function Cuentas({ d, recargar }) {
  const [editando, setEditando] = useState(null)
  const total = d.cuentas.reduce((s, c) => s + (Number(c.saldo) || 0), 0)
  return (
    <div className='space-y-2'>
      <div className='card flex justify-between font-semibold'><span>Total en cuentas</span><span>{pesos(total)}</span></div>
      {d.cuentas.map(c => editando === c.id
        ? <EditarCuenta key={c.id} c={c} cerrar={() => setEditando(null)} listo={() => { setEditando(null); recargar() }} />
        : (
          <button key={c.id} className='card w-full text-left' onClick={() => setEditando(c.id)}>
            <div className='flex justify-between gap-2'>
              <div><div className='font-medium'>{c.nombre}</div><div className='text-xs text-gray-500'>{c.ambito === 'empresa' ? 'Empresa' : 'Personal'}{c.tipo ? ` · ${c.tipo}` : ''}{c.saldo_fecha ? ` · saldo al ${f(c.saldo_fecha)}` : ''}</div>{c.notas && <div className='text-xs text-gray-500'>{c.notas}</div>}</div>
              <div className='font-semibold whitespace-nowrap'>{c.saldo != null ? pesos(c.saldo) : <span className='text-amber-700 text-sm'>Sin saldo</span>}</div>
            </div>
          </button>
        ))}
      {editando === 'nueva'
        ? <EditarCuenta c={{ ambito: 'empresa' }} cerrar={() => setEditando(null)} listo={() => { setEditando(null); recargar() }} />
        : <button className='btn w-full' onClick={() => setEditando('nueva')}>+ Agregar cuenta o tarjeta</button>}
      <p className='text-xs text-gray-500'>Solo los últimos 4 dígitos. Nunca números completos ni claves.</p>
    </div>
  )
}

function EditarCuenta({ c, cerrar, listo }) {
  const [x, setX] = useState({ nombre: '', banco: '', tipo: '', ultimos4: '', notas: '', ...c, saldo: c.saldo != null ? String(Math.round(c.saldo)) : '' })
  const [error, setError] = useState(null)
  const s = (k, v) => setX(o => ({ ...o, [k]: v }))
  async function guardar() {
    if (!x.nombre.trim()) { setError('Escribe el nombre de la cuenta.'); return }
    const fila = { nombre: x.nombre.trim(), banco: x.banco || null, tipo: x.tipo || null, ambito: x.ambito, ultimos4: (x.ultimos4 || '').replace(/\D/g, '').slice(-4) || null, notas: x.notas || null }
    if (x.saldo !== '' && String(Math.round(c.saldo ?? -1)) !== x.saldo) { fila.saldo = Number(x.saldo); fila.saldo_fecha = hoyISO() }
    const r = c.id ? await supabase.from('fin_cuentas').update(fila).eq('id', c.id) : await supabase.from('fin_cuentas').insert(fila)
    if (r.error) { setError('No se guardó: ' + r.error.message); return }
    listo()
  }
  return (
    <div className='card space-y-3 border-gray-900'>
      <L t='Nombre'><input value={x.nombre} onChange={e => s('nombre', e.target.value)} placeholder='Ej: Falabella Joseph ·8890' /></L>
      <div className='grid grid-cols-2 gap-2'>
        <L t='Banco'><input value={x.banco || ''} onChange={e => s('banco', e.target.value)} /></L>
        <L t='Tipo'><select value={x.tipo || ''} onChange={e => s('tipo', e.target.value)}><option value=''>—</option>{['ahorros', 'corriente', 'cuenta', 'tarjeta de crédito', 'billetera', 'efectivo'].map(t => <option key={t} value={t}>{t}</option>)}</select></L>
        <L t='Empresa o personal'><select value={x.ambito} onChange={e => s('ambito', e.target.value)}><option value='empresa'>Empresa</option><option value='personal'>Personal</option></select></L>
        <L t='Últimos 4 dígitos'><input inputMode='numeric' maxLength={4} value={x.ultimos4 || ''} onChange={e => s('ultimos4', e.target.value.replace(/\D/g, '').slice(0, 4))} /></L>
      </div>
      <L t='Saldo de hoy'><input inputMode='numeric' value={x.saldo} onChange={e => s('saldo', e.target.value.replace(/[^\d-]/g, ''))} placeholder='Ej: 18000000' /></L>
      <L t='Notas'><input value={x.notas || ''} onChange={e => s('notas', e.target.value)} /></L>
      {error && <p className='text-sm text-red-700'>{error}</p>}
      <div className='flex gap-2'><button className='btn btn-primary flex-1' onClick={guardar}>Guardar</button><button className='btn' onClick={cerrar}>Cancelar</button></div>
    </div>
  )
}

/* ---------------- Utilidades de interfaz ---------------- */

function L({ t, children }) { return <div><label className='text-xs text-gray-500 mb-1 block'>{t}</label>{children}</div> }

function Modal({ titulo, cerrar, children }) {
  return (
    <div className='fixed inset-0 z-40 bg-black/50 flex items-end sm:items-center justify-center' onClick={cerrar}>
      <div className='bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-4 space-y-3 max-h-[90vh] overflow-y-auto' onClick={e => e.stopPropagation()} role='dialog' aria-label={titulo}>
        <div className='flex justify-between items-start gap-2'><div className='font-semibold'>{titulo}</div><button className='text-2xl leading-none text-gray-500 px-2' onClick={cerrar} aria-label='Cerrar'>×</button></div>
        {children}
      </div>
    </div>
  )
}
