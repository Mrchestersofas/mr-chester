import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

/* Formulario guiado para que Mónica complete los gastos que faltan.
   Cada gasto se guarda directo en Finanzas (fin_pagos); las cuentas, en fin_cuentas. */

const LISTA = [
  ['🏠 Casa', 'personal', [
    ['Luz casa', 'Casa'], ['Acueducto casa', 'Casa'], ['Gas casa', 'Casa'], ['Internet casa', 'Casa'],
    ['Administración edificio', 'Casa'], ['Celulares', 'Casa'], ['Mercado', 'Casa', 'Pon cuánto se gasta a la semana más o menos (D1, Rappi, plaza)'],
  ]],
  ['👦👧 Niños', 'personal', [
    ['Seguro médico niños', 'Seguros'], ['Otras actividades o clases niños', 'Niños', 'Además del Bar Mitzvah de Jacky'], ['Ruta / transporte colegio', 'Niños'],
  ]],
  ['👫 Joseph y Mónica', 'personal', [
    ['Seguro médico Joseph y Mónica', 'Seguros'], ['Gym', 'Salud'], ['Gasolina', 'Transporte'],
    ['Aplicaciones (Netflix, etc.)', 'Suscripciones', 'Suma de todas (Netflix, Spotify, iCloud…). Si quieres, agrégalas una por una abajo'],
    ['Tarjeta Falabella Joseph', 'Tarjetas', 'Pago mensual aproximado y día límite de pago'], ['Tarjeta Falabella Mónica', 'Tarjetas', 'Pago mensual aproximado y día límite de pago'],
    ['Otras tarjetas o créditos personales', 'Créditos'],
  ]],
  ['🏭 Empresa', 'empresa', [
    ['Internet / teléfono fábrica y tienda', 'Servicios'], ['Luz y agua bodega', 'Servicios'], ['Luz y agua tienda 85', 'Servicios'],
    ['Impuestos DIAN', 'Impuestos', 'IVA / retención: cada cuánto y cuánto aprox.'], ['Impuesto ICA', 'Impuestos'],
    ['Comisiones Bold y Mercado Pago', 'Comisiones', 'Si se descuentan solas, marca “No aplica” y cuéntanos en la nota'],
    ['Publicidad (Meta, Google)', 'Publicidad'], ['Créditos o tarjetas de la empresa', 'Créditos'], ['Transporte / fletes', 'Transporte'],
  ]],
]
const FREC = [['mensual', 'Cada mes'], ['quincenal', 'Cada quincena'], ['bimestral', 'Cada 2 meses'], ['semanal', 'Cada semana'], ['anual', 'Una vez al año']]
const MEDIOS = ['transferencia', 'PSE', 'débito automático', 'tarjeta de crédito', 'efectivo']
const DIAS_SEM = [['1', 'lunes'], ['2', 'martes'], ['3', 'miércoles'], ['4', 'jueves'], ['5', 'viernes'], ['6', 'sábado'], ['0', 'domingo']]
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const hoyISO = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10)
function proximo(diaSemana) { let d = hoyISO(); for (let k = 0; k < 7; k++) { const x = new Date(d + 'T12:00:00Z'); if (x.getUTCDay() === Number(diaSemana)) return d; x.setUTCDate(x.getUTCDate() + 1); d = x.toISOString().slice(0, 10) } return d }

export default function Gastos() {
  const [pagos, setPagos] = useState(null)
  const [cuentas, setCuentas] = useState([])
  const [extras, setExtras] = useState([])

  async function cargar() {
    const [p, c] = await Promise.all([supabase.from('fin_pagos').select('*'), supabase.from('fin_cuentas').select('*').order('nombre')])
    setPagos(p.data || []); setCuentas(c.data || [])
  }
  useEffect(() => { cargar() }, [])
  if (!pagos) return <div className='p-4 text-gray-500'>Cargando…</div>

  const nombres = new Set(LISTA.flatMap(([, , xs]) => xs.map(x => x[0])))
  const listos = LISTA.flatMap(([, , xs]) => xs).filter(([n]) => { const p = pagos.find(x => x.concepto === n); return p && (!p.pendiente_dato || !p.activo) }).length
  const total = LISTA.flatMap(([, , xs]) => xs).length

  return (
    <div className='p-4 max-w-2xl mx-auto pb-16'>
      <h1 className='text-xl font-medium'>Gastos por completar</h1>
      <p className='text-sm text-gray-600 mt-1'>Llena cada gasto con el valor, cada cuánto se paga, qué día y de dónde sale. Si cambia cada mes, pon un aproximado. Si no aplica, márcalo. Todo se guarda directo en Finanzas.</p>
      <div className='card my-4'>
        <div className='flex justify-between text-sm mb-1'><span>Avance</span><b>{listos} de {total}</b></div>
        <div className='h-2 rounded-full bg-gray-100 overflow-hidden'><div className='h-full bg-gray-900' style={{ width: (listos / total) * 100 + '%' }} /></div>
      </div>

      <SeccionCuentas cuentas={cuentas} recargar={cargar} />

      {LISTA.map(([titulo, ambito, items]) => (
        <section key={titulo} className='mt-6'>
          <h2 className='font-semibold mb-2'>{titulo}</h2>
          <div className='space-y-2'>
            {items.map(([nombre, cat, ayuda]) => (
              <Item key={nombre} nombre={nombre} categoria={cat} ambito={ambito} ayuda={ayuda} existente={pagos.find(p => p.concepto === nombre)} cuentas={cuentas} listo={cargar} />
            ))}
          </div>
        </section>
      ))}

      <section className='mt-6'>
        <h2 className='font-semibold mb-2'>➕ Otros gastos</h2>
        <div className='space-y-2'>
          {pagos.filter(p => !nombres.has(p.concepto) && p.creado_en_formulario).map(p => (
            <Item key={p.id} nombre={p.concepto} categoria={p.categoria} ambito={p.ambito} existente={p} cuentas={cuentas} listo={cargar} />
          ))}
          {extras.map((x, i) => <Item key={'x' + i} libre ambito='personal' cuentas={cuentas} listo={() => { setExtras(e => e.filter((_, k) => k !== i)); cargar() }} />)}
          <button className='btn w-full' onClick={() => setExtras(e => [...e, {}])}>+ Agregar otro gasto</button>
        </div>
      </section>

      <div className='card mt-6 text-center space-y-2'>
        <p className='text-sm text-gray-600'>¡Gracias! Puedes volver cuando quieras a completar lo que falte.</p>
        <Link href='/finanzas' className='btn btn-primary inline-block'>Ver calendario de pagos</Link>
      </div>
    </div>
  )
}

function Item({ nombre, categoria, ambito: amb0, ayuda, existente: e, cuentas, listo, libre }) {
  const hecho = e && (!e.pendiente_dato || !e.activo)
  const [abierto, setAbierto] = useState(!!libre)
  const freq0 = !e ? 'mensual' : e.frecuencia === 'semanas' ? 'semanal' : e.frecuencia
  const [x, setX] = useState({
    concepto: nombre || '', ambito: e?.ambito || amb0 || 'personal',
    valor: e?.valor ? String(Math.round(e.valor)) : '', estimado: e?.estimado ?? true, frec: freq0,
    dia: e?.dia ? String(e.dia) : '', dia2: e?.dia2 ? String(e.dia2) : '', mes: e?.mes ? String(e.mes) : '',
    diaSem: e?.fecha_base ? String(new Date(e.fecha_base + 'T12:00:00Z').getUTCDay()) : '1',
    cuenta_id: e?.cuenta_id || '', medio: e?.medio || '', notas: e?.notas && !String(e.notas).startsWith('Pendiente') ? e.notas : '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const s = (k, v) => setX(o => ({ ...o, [k]: v }))

  async function guardar(noAplica) {
    if (!noAplica) {
      if (!x.concepto.trim()) { setError('Escribe qué gasto es.'); return }
      if (!(Number(x.valor) > 0)) { setError('Escribe el valor.'); return }
      if (x.frec !== 'semanal' && !x.dia) { setError('Escribe el día de pago.'); return }
      if (x.frec === 'anual' && !x.mes) { setError('Elige el mes.'); return }
    }
    setError(null); setGuardando(true)
    const fila = noAplica ? { activo: false, pendiente_dato: false, notas: 'No aplica' } : {
      concepto: x.concepto.trim(), categoria: categoria || null, ambito: x.ambito, valor: Number(x.valor), estimado: !!x.estimado,
      frecuencia: x.frec === 'semanal' ? 'semanas' : x.frec, intervalo: x.frec === 'semanal' ? 1 : null,
      fecha_base: x.frec === 'semanal' ? proximo(x.diaSem) : null,
      dia: x.frec === 'semanal' ? null : Number(x.dia), dia2: x.frec === 'quincenal' && x.dia2 ? Number(x.dia2) : null,
      mes: ['anual', 'bimestral'].includes(x.frec) && x.mes ? Number(x.mes) : null,
      cuenta_id: x.cuenta_id || null, medio: x.medio || null, notas: x.notas.trim() || null, activo: true, pendiente_dato: false,
    }
    if (!e) { fila.concepto = fila.concepto || x.concepto.trim() || nombre; fila.ambito = fila.ambito || x.ambito; fila.creado_en_formulario = !!libre }
    const r = e ? await supabase.from('fin_pagos').update(fila).eq('id', e.id) : await supabase.from('fin_pagos').insert(fila)
    setGuardando(false)
    if (r.error) { setError('No se guardó: ' + r.error.message); return }
    setAbierto(false); listo()
  }

  return (
    <div className={`card p-0 overflow-hidden ${hecho ? 'border-green-300' : ''}`}>
      {!libre && (
        <button className='w-full text-left p-3 flex justify-between items-center gap-2' onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
          <span className='font-medium'>{nombre}</span>
          <span className={`text-xs font-semibold whitespace-nowrap ${hecho ? 'text-green-700' : 'text-amber-700'}`}>
            {!hecho ? 'Por llenar' : !e.activo ? 'No aplica' : `✓ $${Math.round(e.valor).toLocaleString('es-CO')}`}
          </span>
        </button>
      )}
      {abierto && (
        <div className={`${libre ? '' : 'border-t border-gray-100'} p-3 space-y-3`}>
          {ayuda && <p className='text-xs text-gray-500'>{ayuda}</p>}
          {libre && (
            <div className='grid grid-cols-2 gap-2'>
              <L t='¿Qué gasto es?'><input value={x.concepto} onChange={ev => s('concepto', ev.target.value)} placeholder='Ej: Spotify' /></L>
              <L t='Empresa o personal'><select value={x.ambito} onChange={ev => s('ambito', ev.target.value)}><option value='personal'>Personal</option><option value='empresa'>Empresa</option></select></L>
            </div>
          )}
          <div className='grid grid-cols-2 gap-2'>
            <L t='Valor'><input inputMode='numeric' value={x.valor} onChange={ev => s('valor', ev.target.value.replace(/\D/g, ''))} placeholder='Ej: 250000' /></L>
            <L t='¿Cada cuánto?'><select value={x.frec} onChange={ev => s('frec', ev.target.value)}>{FREC.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></L>
            {x.frec === 'semanal'
              ? <L t='¿Qué día de la semana?'><select value={x.diaSem} onChange={ev => s('diaSem', ev.target.value)}>{DIAS_SEM.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></L>
              : <L t={x.frec === 'quincenal' ? 'Primer día' : 'Día de pago'}><input inputMode='numeric' value={x.dia} onChange={ev => s('dia', ev.target.value.replace(/\D/g, '').slice(0, 2))} placeholder='1 a 31' /></L>}
            {x.frec === 'quincenal' && <L t='Segundo día'><input inputMode='numeric' value={x.dia2} onChange={ev => s('dia2', ev.target.value.replace(/\D/g, '').slice(0, 2))} placeholder='1 a 31' /></L>}
            {['anual', 'bimestral'].includes(x.frec) && <L t={x.frec === 'anual' ? 'Mes' : 'Mes en que llega'}><select value={x.mes} onChange={ev => s('mes', ev.target.value)}><option value=''>—</option>{MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></L>}
          </div>
          <div className='grid grid-cols-2 gap-2'>
            <L t='¿De dónde sale?'><select value={x.cuenta_id} onChange={ev => s('cuenta_id', ev.target.value)}><option value=''>—</option>{cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></L>
            <L t='¿Cómo se paga?'><select value={x.medio} onChange={ev => s('medio', ev.target.value)}><option value=''>—</option>{MEDIOS.map(m => <option key={m} value={m}>{m}</option>)}</select></L>
          </div>
          <label className='flex items-center gap-2 text-sm'><input type='checkbox' checked={!!x.estimado} onChange={ev => s('estimado', ev.target.checked)} style={{ width: 'auto' }} /> Es aproximado (cambia cada mes)</label>
          <L t='Nota (opcional)'><input value={x.notas} onChange={ev => s('notas', ev.target.value)} placeholder='Ej: llega el recibo el 3' /></L>
          {error && <p className='text-sm text-red-700'>{error}</p>}
          <div className='flex gap-2'>
            <button className='btn btn-primary flex-1' onClick={() => guardar(false)} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
            {!libre && <button className='btn' onClick={() => guardar(true)} disabled={guardando}>No aplica</button>}
          </div>
        </div>
      )}
    </div>
  )
}

function SeccionCuentas({ cuentas, recargar }) {
  const [nueva, setNueva] = useState(false)
  return (
    <section>
      <h2 className='font-semibold mb-2'>💳 Cuentas y tarjetas</h2>
      <p className='text-xs text-gray-500 mb-2'>Solo los últimos 4 dígitos. Nunca el número completo ni claves.</p>
      <div className='space-y-2'>
        {cuentas.map(c => <Cuenta key={c.id} c={c} listo={recargar} />)}
        {nueva ? <Cuenta c={{ ambito: 'personal' }} nueva listo={() => { setNueva(false); recargar() }} /> : <button className='btn w-full' onClick={() => setNueva(true)}>+ Agregar cuenta o tarjeta</button>}
      </div>
    </section>
  )
}

function Cuenta({ c, nueva, listo }) {
  const [abierto, setAbierto] = useState(!!nueva)
  const [x, setX] = useState({ banco: c.banco || '', tipo: c.tipo || '', ambito: c.ambito || 'personal', ultimos4: c.ultimos4 || '', saldo: c.saldo != null ? String(Math.round(c.saldo)) : '' })
  const [error, setError] = useState(null)
  const s = (k, v) => setX(o => ({ ...o, [k]: v }))
  async function guardar() {
    if (nueva && !x.banco.trim()) { setError('Escribe el banco.'); return }
    const fila = { banco: x.banco.trim() || null, tipo: x.tipo || null, ambito: x.ambito, ultimos4: x.ultimos4 || null }
    if (nueva || !c.nombre) fila.nombre = `${x.banco.trim()}${x.tipo === 'tarjeta de crédito' ? ' TC' : ''}${x.ultimos4 ? ' ·' + x.ultimos4 : ''}`
    if (x.saldo !== '') { fila.saldo = Number(x.saldo); fila.saldo_fecha = hoyISO() }
    const r = nueva ? await supabase.from('fin_cuentas').insert(fila) : await supabase.from('fin_cuentas').update(fila).eq('id', c.id)
    if (r.error) { setError('No se guardó: ' + r.error.message); return }
    setAbierto(false); listo()
  }
  return (
    <div className='card p-0 overflow-hidden'>
      {!nueva && (
        <button className='w-full text-left p-3 flex justify-between gap-2' onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
          <span className='font-medium'>{c.nombre}</span>
          <span className={`text-xs font-semibold ${c.saldo != null ? 'text-green-700' : 'text-amber-700'}`}>{c.saldo != null ? `Saldo $${Math.round(c.saldo).toLocaleString('es-CO')}` : 'Falta saldo'}</span>
        </button>
      )}
      {abierto && (
        <div className={`${nueva ? '' : 'border-t border-gray-100'} p-3 space-y-3`}>
          <div className='grid grid-cols-2 gap-2'>
            <L t='Banco'><input value={x.banco} onChange={e => s('banco', e.target.value)} placeholder='Ej: Falabella' /></L>
            <L t='Tipo'><select value={x.tipo} onChange={e => s('tipo', e.target.value)}><option value=''>—</option>{['ahorros', 'corriente', 'tarjeta de crédito', 'billetera', 'efectivo'].map(t => <option key={t} value={t}>{t}</option>)}</select></L>
            <L t='Empresa o personal'><select value={x.ambito} onChange={e => s('ambito', e.target.value)}><option value='personal'>Personal</option><option value='empresa'>Empresa</option></select></L>
            <L t='Últimos 4 dígitos'><input inputMode='numeric' maxLength={4} value={x.ultimos4} onChange={e => s('ultimos4', e.target.value.replace(/\D/g, '').slice(0, 4))} /></L>
          </div>
          <L t={x.tipo === 'tarjeta de crédito' ? 'Deuda actual (opcional)' : 'Saldo de hoy'}><input inputMode='numeric' value={x.saldo} onChange={e => s('saldo', e.target.value.replace(/[^\d-]/g, ''))} /></L>
          {error && <p className='text-sm text-red-700'>{error}</p>}
          <button className='btn btn-primary w-full' onClick={guardar}>Guardar</button>
        </div>
      )}
    </div>
  )
}

function L({ t, children }) { return <div><label className='text-xs text-gray-500 mb-1 block'>{t}</label>{children}</div> }
