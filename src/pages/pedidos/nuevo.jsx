import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabase'
import { planificar, primerDiaPlan, sumarDias, sumarHabiles, capacidad, esHabil, esBogota, CUPOS_CATEGORIA } from '@/lib/planificador'
import { fCorta } from '@/lib/etapas'

/* Nuevo pedido. Un pedido puede tener varios productos: el primero toma el número (MC-040)
   y los demás quedan como MC-040-2, MC-040-3…, todos con grupo = MC-040. Cada producto entra
   a producción por separado; al cliente le llega un solo correo y un solo comprobante. */

const OTRO = '__otro'
const itemVacio = () => ({ categoria: '', referencia_id: '', ref_otro: '', tela_id: '', tela_otra: '', cantidad: 1, precio: '' })

// Canales de venta (de dónde viene el pedido)
const CANALES = [['tienda_85', 'Tienda 85'], ['whatsapp', 'WhatsApp'], ['instagram', 'Instagram'], ['falabella', 'Falabella'], ['web', 'Página web']]

export default function NuevoPedido() {
  const router = useRouter()
  const [clientes, setClientes] = useState([])
  const [productos, setProductos] = useState([])
  const [telas, setTelas] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [items, setItems] = useState([itemVacio()])
  const [form, setForm] = useState({
    cliente_id: '',
    fecha_pedido: new Date(Date.now() - 5 * 3600 * 1000).toISOString().split('T')[0],
    fecha_entrega: '',
    prioridad: 'normal',
    canal: '',
    observaciones: '',
    crear_cliente: false,
    nuevo_nombre: '',
    nuevo_cedula: '',
    nuevo_tipo: 'CC',
    nuevo_dv: '',
    nuevo_direccion: '',
    nuevo_ciudad: '',
    nuevo_tel: '',
    nuevo_email: '',
    abono: '',
    medio_pago: '',
    enviar_correo: true,
  })

  const cats = [...new Set(productos.map(p => p.categoria))]
  const setItem = (i, cambios) => setItems(arr => arr.map((it, k) => (k === i ? { ...it, ...cambios } : it)))
  const refDe = it => it.referencia_id === OTRO ? it.ref_otro.trim() : (productos.find(p => p.id === it.referencia_id)?.referencia || '')
  const telaDe = it => it.tela_id === OTRO ? it.tela_otra.trim() : (telas.find(t => t.id === it.tela_id)?.nombre || '')
  const total = items.reduce((s, it) => s + (Number(it.precio) || 0), 0)

  useEffect(() => {
    supabase.from('clientes').select('*').order('nombre').then(({ data }) => setClientes(data || []))
    supabase.from('productos').select('*').order('categoria').order('referencia').then(({ data }) => setProductos(data || []))
    supabase.from('materiales').select('*').eq('unidad', 'metro').order('nombre').then(({ data }) => setTelas(data || []))
  }, [])

  // Convertir una cotización en pedido: /pedidos/nuevo?cotizacion=ID llena el formulario con TODOS sus productos
  const [desdeCot, setDesdeCot] = useState(null)
  useEffect(() => {
    const id = router.query.cotizacion
    if (!id || !productos.length || !telas.length || desdeCot) return
    supabase.from('cotizaciones').select('*').eq('id', id).single().then(({ data: c }) => {
      if (!c) return
      setDesdeCot(c)
      const lineas = (c.items || []).map(it => Number(it.precio) * Number(it.cantidad || 1))
      const bruto = lineas.reduce((s, x) => s + x, 0)
      const desc = Number(c.descuento) || 0
      // El descuento se reparte en proporción al valor de cada producto
      const conDesc = lineas.map(x => Math.round(x - (bruto ? desc * x / bruto : 0)))
      conDesc[0] += (Number(c.total) || 0) - conDesc.reduce((s, x) => s + x, 0)
      setItems((c.items || []).map((it, k) => {
        const p = productos.find(x => x.referencia === it.referencia)
        const t = telas.find(x => x.nombre === it.tela)
        return {
          categoria: p ? p.categoria : '',
          referencia_id: p ? p.id : OTRO, ref_otro: p ? '' : it.referencia,
          tela_id: t ? t.id : it.tela ? OTRO : '', tela_otra: t ? '' : (it.tela || ''),
          cantidad: it.cantidad || 1,
          precio: String(conDesc[k] || ''),
        }
      }))
      const detalles = (c.items || []).filter(it => it.detalle).map(it => `${it.referencia}: ${it.detalle}`)
      setForm(f => ({
        ...f,
        cliente_id: c.cliente_id || '',
        crear_cliente: false,
        observaciones: [`Desde cotización ${c.numero}.`, ...detalles, c.observaciones].filter(Boolean).join('\n'),
      }))
    })
  }, [router.query.cotizacion, productos, telas])

  function set(f, v) { setForm(p => ({ ...p, [f]: v })) }


  const [errores, setErrores] = useState([])
  const [resultado, setResultado] = useState(null)
  const [compartiendo, setCompartiendo] = useState(false)
  const [comprobanteUrl, setComprobanteUrl] = useState(null)

  // FECHA DE ENTREGA: 'auto' = primer cupo libre en la programación, 'dias' = días hábiles prometidos, 'fecha' = escogerla a mano
  const [modoEntrega, setModoEntrega] = useState('auto')
  const [diasPrometidos, setDiasPrometidos] = useState('')
  const [usados, setUsados] = useState(null)
  useEffect(() => {
    if (resultado) return
    Promise.all([
      supabase.from('programacion_produccion').select('*, pedido:pedidos(id, numero, tipo_sofa, cantidad, estado, fecha_pedido, fecha_entrega, cliente:clientes(ciudad))'),
      supabase.from('productos').select('referencia, categoria'),
    ]).then(([{ data: filas }, { data: prods }]) => setUsados(planificar(filas || [], prods || []).usados))
  }, [resultado])

  const ciudadCliente = form.crear_cliente ? form.nuevo_ciudad : (clientes.find(c => c.id === form.cliente_id)?.ciudad || '')
  const sugerida = (() => {
    if (!usados) return null
    const u = { ...usados }
    const libre = d => capacidad(d) - (u[d] || 0)
    let d = primerDiaPlan(), ultimo = null
    const lista = items.some(it => it.referencia_id) ? items : [itemVacio()]
    for (const it of lista) {
      const cat = productos.find(p => p.id === it.referencia_id)?.categoria
      const peso = CUPOS_CATEGORIA[cat] ?? 1
      for (let k = 0; k < Math.max(1, Number(it.cantidad) || 1); k++) {
        let guard = 0
        while ((!esHabil(d) || libre(d) + 1e-9 < Math.min(peso, capacidad(d) || 99)) && guard++ < 800) d = sumarDias(d, 1)
        u[d] = (u[d] || 0) + peso
        ultimo = d
      }
    }
    // Se fabrica el día del cupo y se despacha el día hábil siguiente (esa es la fecha que se le promete)
    return { fabrica: ultimo, entrega: sumarHabiles(ultimo, 1) }
  })()

  useEffect(() => {
    if (modoEntrega === 'auto' && sugerida) set('fecha_entrega', sugerida.entrega)
    if (modoEntrega === 'dias') set('fecha_entrega', Number(diasPrometidos) > 0 ? sumarHabiles(form.fecha_pedido, Number(diasPrometidos)) : '')
  }, [modoEntrega, sugerida?.entrega, diasPrometidos, form.fecha_pedido])

  async function compartirComprobante(pedido, cliente, lista, texto) {
    setCompartiendo(true)
    try {
      const blob = await dibujarComprobante(pedido, cliente, lista)
      const archivo = new File([blob], `Comprobante-${pedido.numero}.png`, { type: 'image/png' })
      if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
        try {
          await navigator.share({ files: [archivo], text: texto })
        } catch (e) {
          if (e && e.name !== 'AbortError') setComprobanteUrl(URL.createObjectURL(blob))
        }
      } else {
        // Computador o navegador sin "compartir": mostrar la imagen para descargarla
        setComprobanteUrl(URL.createObjectURL(blob))
      }
    } catch (e) {
      alert('No se pudo crear el comprobante: ' + e.message)
    }
    setCompartiendo(false)
  }

  function validar() {
    const e = []
    if (form.crear_cliente) {
      if (!form.nuevo_nombre.trim()) e.push('Escribe el nombre del cliente.')
      if (form.nuevo_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.nuevo_email.trim())) e.push('El correo del cliente no es válido.')
    } else if (!form.cliente_id) e.push('Elige un cliente o crea uno nuevo.')
    items.forEach((it, i) => {
      const n = items.length > 1 ? ` (producto ${i + 1})` : ''
      if (!refDe(it)) e.push(`Elige la referencia${n}.`)
      if (!telaDe(it)) e.push(`Elige la tela${n}.`)
      if (!(Number(it.cantidad) > 0)) e.push(`La cantidad debe ser mayor a 0${n}.`)
      if (!(Number(it.precio) > 0)) e.push(`Escribe el precio, solo números${n}.`)
    })
    if (!form.canal) e.push('Elige el canal de venta.')
    if (!form.fecha_entrega) e.push('Elige la fecha de entrega.')
    if (form.abono && isNaN(Number(form.abono))) e.push('El abono debe ser solo números.')
    if (Number(form.abono) > total) e.push('El abono no puede ser mayor al total.')
    return e
  }

  async function enviarCorreo(pedido, cliente, lista) {
    try {
      const r = await fetch('/api/enviar-confirmacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido, cliente, items: lista }),
      })
      const j = await r.json().catch(() => ({}))
      return j
    } catch (e) {
      return { ok: false, error: 'No hubo conexión para enviar el correo.' }
    }
  }

  async function anotar(pedido_id, nota) {
    await supabase.from('historial_estados').insert({ pedido_id, estado_anterior: null, estado_nuevo: 'pendiente', nota })
  }

  async function reenviar() {
    if (!resultado) return
    setResultado(r => ({ ...r, correo: { enviando: true } }))
    const correo = await enviarCorreo(resultado.pedido, resultado.cliente, resultado.lista)
    await anotar(resultado.lista[0].id, correo.cliente_ok ? `Correo reenviado a ${resultado.cliente.email}` : `Reenvío falló: ${correo.error || 'sin detalle'}`)
    setResultado(r => ({ ...r, correo }))
  }

  async function guardar() {
    const e = validar()
    setErrores(e)
    if (e.length) { window.scrollTo(0, 0); return }
    setGuardando(true)

    let cliente = null
    if (form.crear_cliente) {
      const { data: nc, error: errC } = await supabase.from('clientes').insert({
        nombre: form.nuevo_nombre.trim(),
        cedula: form.nuevo_cedula,
        tipo_documento: form.nuevo_tipo,
        dv: form.nuevo_tipo === 'NIT' ? (form.nuevo_dv || null) : null,
        direccion: form.nuevo_direccion,
        ciudad: form.nuevo_ciudad,
        telefono: form.nuevo_tel,
        email: form.nuevo_email.trim() || null,
      }).select().single()
      if (errC || !nc) {
        setErrores(['No se pudo guardar el cliente: ' + (errC?.message || 'error desconocido') + '. El pedido NO se guardó, intenta de nuevo.'])
        setGuardando(false); window.scrollTo(0, 0); return
      }
      cliente = nc
    } else {
      const { data: ec, error: errE } = await supabase.from('clientes').select('*').eq('id', form.cliente_id).single()
      if (errE || !ec) {
        setErrores(['No se pudo leer el cliente. Revisa la conexión e intenta de nuevo.'])
        setGuardando(false); window.scrollTo(0, 0); return
      }
      cliente = ec
    }

    // El abono se reparte entre los productos en proporción a su precio (así cada uno queda con su saldo)
    const abonoTotal = Number(form.abono) || 0
    const precios = items.map(it => Number(it.precio))
    const abonos = precios.map(p => Math.round(total ? abonoTotal * p / total : 0))
    abonos[0] += abonoTotal - abonos.reduce((s, x) => s + x, 0)

    const fila = (it, k) => ({
      cliente_id: cliente?.id || null,
      tipo_sofa: refDe(it),
      material: telaDe(it),
      color: telaDe(it),
      cantidad: Number(it.cantidad),
      fecha_pedido: form.fecha_pedido,
      fecha_entrega: form.fecha_entrega,
      prioridad: form.prioridad,
      canal: form.canal,
      estado: 'pendiente',
      precio_venta: precios[k],
      observaciones: form.observaciones,
      abono: abonos[k],
      medio_pago: form.medio_pago,
    })

    const { data: primero, error: errP } = await supabase.from('pedidos').insert({ ...fila(items[0], 0), numero: '' }).select().single()
    if (errP || !primero) {
      setErrores(['El pedido NO se guardó: ' + (errP?.message || 'error desconocido') + '. Tus datos siguen en el formulario, intenta de nuevo.'])
      setGuardando(false); window.scrollTo(0, 0); return
    }
    const grupo = primero.numero
    await supabase.from('pedidos').update({ grupo }).eq('id', primero.id)
    const lista = [{ ...primero, grupo }]
    const fallidos = []
    for (let k = 1; k < items.length; k++) {
      const { data: otro, error: errO } = await supabase.from('pedidos')
        .insert({ ...fila(items[k], k), numero: `${grupo}-${k + 1}`, grupo }).select().single()
      if (errO || !otro) fallidos.push(`${refDe(items[k])}: ${errO?.message || 'error'}`)
      else lista.push(otro)
    }

    const nombres = lista.map(p => p.numero).join(', ')
    for (const p of lista) {
      await anotar(p.id, `Pedido ${p.numero} creado${lista.length > 1 ? ` (compra ${grupo}: ${nombres})` : ''}${desdeCot ? ` desde la cotización ${desdeCot.numero}` : ''}`)
    }
    if (desdeCot) {
      await supabase.from('cotizaciones').update({ estado: 'convertida', pedido_id: primero.id }).eq('id', desdeCot.id)
    }

    // Resumen de toda la compra, para el correo, el comprobante y WhatsApp
    const resumen = {
      numero: grupo,
      fecha_entrega: form.fecha_entrega,
      precio_venta: lista.reduce((s, p) => s + Number(p.precio_venta), 0),
      abono: lista.reduce((s, p) => s + Number(p.abono || 0), 0),
      medio_pago: form.medio_pago,
      observaciones: form.observaciones,
      tipo_sofa: lista.map(p => p.tipo_sofa).join(' + '),
      material: [...new Set(lista.map(p => p.material))].join(' / '),
      cantidad: lista.reduce((s, p) => s + Number(p.cantidad || 1), 0),
    }

    // Para pedidos viejos se puede registrar sin avisarle al cliente
    const correo = form.enviar_correo ? await enviarCorreo(resumen, cliente, lista) : { omitido: true }
    await anotar(primero.id,
      correo.omitido ? 'Registrado sin enviar confirmación al cliente'
      : correo.cliente_ok ? `Correo de confirmación enviado a ${cliente.email}`
      : cliente.email ? `Correo al cliente NO enviado: ${correo.error || 'sin detalle'}`
      : 'Cliente sin correo: no se envió confirmación')

    for (const p of lista) {
      try {
        await fetch('/api/programar-pedido', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pedido_id: p.id, cantidad: Number(p.cantidad), fecha_entrega: form.fecha_entrega, numero_pedido: p.numero }),
        })
      } catch (err) {
        console.error('No se pudo programar la producción:', err)
      }
    }

    setGuardando(false)
    setResultado({ pedido: resumen, cliente, correo, lista, fallidos })
    window.scrollTo(0, 0)
  }

  if (resultado) {
    const { pedido, cliente, correo, lista, fallidos } = resultado
    const tel = (cliente?.telefono || '').replace(/\D/g, '')
    const telWa = tel.length === 10 ? '57' + tel : tel
    const telVer = tel.length === 10 ? `${tel.slice(0, 3)} ${tel.slice(3, 6)} ${tel.slice(6)}` : tel
    const msg = textoWhatsApp(pedido, cliente, lista)
    return (
      <div className='p-4 max-w-2xl mx-auto'>
        <div className='card space-y-4'>
          <div className='rounded-lg bg-green-50 border border-green-200 p-4'>
            <p className='text-sm text-green-700 font-semibold'>✓ Pedido registrado</p>
            <p className='text-3xl font-bold mt-1'>{pedido.numero}</p>
            <p className='text-sm text-gray-600 mt-1'>{cliente?.nombre} · {pesos(pedido.precio_venta)} · entrega {fechaLarga(pedido.fecha_entrega)}</p>
            {lista.length > 1 && (
              <ul className='text-sm text-gray-700 mt-2 space-y-0.5'>
                {lista.map(p => <li key={p.id}><b>{p.numero}</b> · {p.tipo_sofa}{p.cantidad > 1 ? ` × ${p.cantidad}` : ''} · {p.material}</li>)}
              </ul>
            )}
          </div>
          {fallidos?.length > 0 && (
            <div className='rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700'>
              ⚠ Estos productos NO se guardaron, regístralos aparte: {fallidos.join(' · ')}
            </div>
          )}
          <div className={`rounded-lg p-3 text-sm border ${correo?.enviando ? 'bg-gray-50 border-gray-200' : correo?.cliente_ok ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            {correo?.omitido ? <>No se envió confirmación al cliente (la desmarcaste).</>
              : correo?.enviando ? 'Enviando correo…'
              : correo?.cliente_ok ? <>✓ Correo de confirmación enviado a <b>{cliente.email}</b></>
              : !cliente?.email ? <>El cliente no tiene correo. Envíale la confirmación por WhatsApp.</>
              : <>⚠ No se pudo enviar el correo a <b>{cliente.email}</b>.<br /><span className='text-gray-600'>{correo?.error}</span></>}
            {correo?.copia_ok && <div className='text-gray-500 mt-1'>Copia enviada a josephtoledo@gmail.com</div>}
          </div>
          <div className='flex flex-col gap-2'>
            <button className='btn btn-primary' onClick={() => compartirComprobante(pedido, cliente, lista, msg)} disabled={compartiendo}>
              {compartiendo ? 'Preparando comprobante…' : '📄 Compartir comprobante con logo'}
            </button>
            {tel && <a className='btn text-center' href={`https://wa.me/${telWa}?text=${encodeURIComponent(msg)}`} target='_blank' rel='noreferrer'>Enviar solo texto por WhatsApp</a>}
            {tel && <p className='text-xs text-gray-500 text-center -mt-1'>WhatsApp del cliente: {telVer}. Si no es el número correcto, corrígelo en Clientes.</p>}
            {comprobanteUrl && (
              <div className='rounded-lg border p-2 text-center text-sm text-gray-600'>
                Mantén presionada la imagen para guardarla o compartirla.
                <img src={comprobanteUrl} alt={`Comprobante ${pedido.numero}`} className='mt-2 rounded' />
              </div>
            )}
            {cliente?.email && !correo?.cliente_ok && !correo?.enviando && <button className='btn' onClick={reenviar}>{correo?.omitido ? 'Enviar confirmación ahora' : 'Reintentar correo'}</button>}
            <button className='btn' onClick={() => { setModoEntrega('auto'); setDiasPrometidos(''); setUsados(null); setResultado(null); setComprobanteUrl(null); setItems([itemVacio()]); setForm(f => ({ ...f, cliente_id: '', canal: '', abono: '', medio_pago: '', observaciones: '', crear_cliente: false, nuevo_nombre: '', nuevo_cedula: '', nuevo_tipo: 'CC', nuevo_dv: '', nuevo_direccion: '', nuevo_ciudad: '', nuevo_tel: '', nuevo_email: '', fecha_entrega: '' })) }}>Registrar otro pedido</button>
            <button className='btn' onClick={() => router.push('/pedidos')}>Ver todos los pedidos</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='p-4 max-w-2xl mx-auto'>
      <h1 className='text-xl font-medium mb-5'>Nuevo pedido</h1>
      {desdeCot && (
        <div className='mb-4 rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800'>
          Llenado desde la cotización <b>{desdeCot.numero}</b> ({pesos(desdeCot.total)}). Revisa los productos y completa la <b>fecha de entrega</b> y el <b>abono</b>.
        </div>
      )}
      {errores.length > 0 && (
        <div className='mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700' role='alert'>
          <b>Revisa esto antes de guardar:</b>
          <ul className='list-disc ml-5 mt-1'>{errores.map(e => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
      <div className='card space-y-6'>

        {/* ENTREGA */}
        <section>
          <h2 className='text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3'>Fecha de entrega *</h2>
          <div className='grid grid-cols-3 gap-2 mb-3'>
            {[['auto', '📅 Según programación'], ['dias', '🔢 Días prometidos'], ['fecha', '✏️ Escoger fecha']].map(([k, l]) => (
              <button key={k} type='button' onClick={() => setModoEntrega(k)}
                className={`rounded-lg border px-2 py-2.5 text-sm font-medium ${modoEntrega === k ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700'}`}>{l}</button>
            ))}
          </div>
          {modoEntrega === 'auto' && (
            !sugerida ? <p className='text-sm text-gray-400'>Revisando la programación…</p> : (
              <div className='rounded-lg bg-purple-50 border border-purple-100 p-3 text-sm'>
                <p>Primer cupo libre en fábrica: <b>{fCorta(sugerida.fabrica)}</b></p>
                <p className='text-lg font-semibold text-purple-800 mt-1'>Entrega: {fechaLarga(sugerida.entrega)}</p>
                <p className='text-xs text-gray-500 mt-1'>{esBogota(ciudadCliente) ? 'Bogotá: se entrega el día del despacho.' : 'Fuera de Bogotá: es la fecha de despacho; la transportadora tarda de 2 a 4 días hábiles más.'} Se recalcula al elegir los productos y la ciudad.</p>
              </div>
            )
          )}
          {modoEntrega === 'dias' && (
            <div className='grid grid-cols-2 gap-3 items-end'>
              <div>
                <label htmlFor='dias-prom' className='text-xs text-gray-500 mb-1 block'>Días hábiles prometidos</label>
                <input id='dias-prom' inputMode='numeric' placeholder='Ej: 30' value={diasPrometidos} onChange={e => setDiasPrometidos(e.target.value.replace(/\D/g, ''))} />
              </div>
              <p className='text-sm pb-2'>{form.fecha_entrega ? <>Entrega: <b>{fechaLarga(form.fecha_entrega)}</b></> : <span className='text-gray-400'>Escribe los días</span>}</p>
            </div>
          )}
          {modoEntrega === 'fecha' && (
            <input type='date' aria-label='Fecha de entrega' value={form.fecha_entrega} onChange={e => set('fecha_entrega', e.target.value)} />
          )}
          {modoEntrega !== 'auto' && sugerida && form.fecha_entrega && form.fecha_entrega < sugerida.entrega && (
            <p className='mt-2 text-sm text-amber-700'>⚠ Con la programación actual lo más pronto sería el {fechaLarga(sugerida.entrega)}. Esta fecha obligaría a mover otros pedidos.</p>
          )}
          {modoEntrega === 'dias' && <p className='text-xs text-gray-500 mt-2'>Días hábiles: lunes a sábado, sin domingos ni festivos, contados desde la fecha del pedido.</p>}
        </section>

        {/* CLIENTE */}
        <section>
          <h2 className='text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3'>Cliente</h2>
          <div className='flex gap-4 mb-3'>
            <label className='flex items-center gap-2 text-sm cursor-pointer'>
              <input type='radio' checked={!form.crear_cliente} onChange={() => set('crear_cliente', false)} /> Existente
            </label>
            <label className='flex items-center gap-2 text-sm cursor-pointer'>
              <input type='radio' checked={form.crear_cliente} onChange={() => set('crear_cliente', true)} /> Nuevo cliente
            </label>
          </div>
          {!form.crear_cliente ? (
            <select value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)}>
              <option value=''>Seleccionar cliente</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          ) : (
            <div className='space-y-3'>
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                <div>
                  <label className='text-xs text-gray-500 mb-1 block'>Nombre completo *</label>
                  <input placeholder='Nombre completo' value={form.nuevo_nombre} onChange={e => set('nuevo_nombre', e.target.value)} />
                </div>
                <div>
                  <label className='text-xs text-gray-500 mb-1 block'>Documento</label>
                  <div className='flex gap-2'>
                    <select className='w-28 shrink-0' value={form.nuevo_tipo} onChange={e => set('nuevo_tipo', e.target.value)}>
                      <option value='CC'>Cédula</option>
                      <option value='NIT'>NIT</option>
                    </select>
                    <input className='min-w-0 flex-1' inputMode='numeric' placeholder={form.nuevo_tipo === 'NIT' ? 'Ej: 901574522' : 'Ej: 1234567890'} value={form.nuevo_cedula} onChange={e => set('nuevo_cedula', e.target.value.replace(/[^0-9]/g, ''))} />
                    {form.nuevo_tipo === 'NIT' && <input className='w-14 shrink-0 text-center' inputMode='numeric' maxLength={1} placeholder='DV' value={form.nuevo_dv} onChange={e => set('nuevo_dv', e.target.value.replace(/[^0-9]/g, ''))} />}
                  </div>
                </div>
              </div>
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                <div>
                  <label className='text-xs text-gray-500 mb-1 block'>Teléfono / WhatsApp</label>
                  <input inputMode='tel' placeholder='Ej: 3001234567' value={form.nuevo_tel} onChange={e => set('nuevo_tel', e.target.value)} />
                </div>
                <div>
                  <label className='text-xs text-gray-500 mb-1 block'>Correo electrónico</label>
                  <input type='email' placeholder='correo@ejemplo.com' value={form.nuevo_email} onChange={e => set('nuevo_email', e.target.value)} />
                </div>
              </div>
              <div>
                <label className='text-xs text-gray-500 mb-1 block'>Dirección de entrega</label>
                <input placeholder='Ej: Calle 85 #19-20, Apto 301' value={form.nuevo_direccion} onChange={e => set('nuevo_direccion', e.target.value)} />
              </div>
              <div>
                <label className='text-xs text-gray-500 mb-1 block'>Ciudad</label>
                <input placeholder='Ej: Bogotá' value={form.nuevo_ciudad} onChange={e => set('nuevo_ciudad', e.target.value)} />
              </div>
            </div>
          )}
        </section>

        {/* PRODUCTOS */}
        <section>
          <h2 className='text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3'>Productos</h2>
          <div className='space-y-4'>
            {items.map((it, i) => {
              const prod = productos.find(p => p.id === it.referencia_id)
              const filtrados = it.categoria ? productos.filter(p => p.categoria === it.categoria) : productos
              return (
                <div key={i} className='rounded-lg border border-gray-200 p-3 space-y-3'>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm font-semibold'>Producto {i + 1}</span>
                    {items.length > 1 && <button type='button' className='text-sm text-red-600' onClick={() => setItems(a => a.filter((_, k) => k !== i))}>Quitar</button>}
                  </div>
                  <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                    <div>
                      <label className='text-xs text-gray-500 mb-1 block'>Categoría</label>
                      <select value={it.categoria} onChange={e => setItem(i, { categoria: e.target.value, referencia_id: '' })}>
                        <option value=''>Todas las categorías</option>
                        {cats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className='text-xs text-gray-500 mb-1 block'>Referencia *</label>
                      <select value={it.referencia_id} onChange={e => setItem(i, { referencia_id: e.target.value })}>
                        <option value=''>Seleccionar referencia</option>
                        {it.categoria
                          ? filtrados.map(p => <option key={p.id} value={p.id}>{p.referencia}</option>)
                          : cats.map(cat => (
                            <optgroup key={cat} label={cat}>
                              {productos.filter(p => p.categoria === cat).map(p => <option key={p.id} value={p.id}>{p.referencia}</option>)}
                            </optgroup>
                          ))}
                        <option value={OTRO}>Otro (escribirlo)</option>
                      </select>
                    </div>
                  </div>
                  {it.referencia_id === OTRO && (
                    <div>
                      <label className='text-xs text-gray-500 mb-1 block'>¿Qué producto?</label>
                      <input value={it.ref_otro} onChange={e => setItem(i, { ref_otro: e.target.value })} placeholder='Ej: Puff capitoneado 60 cm' />
                    </div>
                  )}
                  <div>
                    <label className='text-xs text-gray-500 mb-1 block'>Tela *</label>
                    <select value={it.tela_id} onChange={e => setItem(i, { tela_id: e.target.value })}>
                      <option value=''>Seleccionar tela</option>
                      {telas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                      <option value={OTRO}>Otra (escribirla)</option>
                    </select>
                  </div>
                  {it.tela_id === OTRO && (
                    <div>
                      <label className='text-xs text-gray-500 mb-1 block'>¿Qué tela?</label>
                      <input value={it.tela_otra} onChange={e => setItem(i, { tela_otra: e.target.value })} placeholder='Ej: Terciopelo verde esmeralda' />
                    </div>
                  )}
                  <div className='grid grid-cols-2 gap-3'>
                    <div>
                      <label className='text-xs text-gray-500 mb-1 block'>Cantidad</label>
                      <input type='number' min='1' inputMode='numeric' value={it.cantidad} onChange={e => setItem(i, { cantidad: e.target.value })} />
                    </div>
                    <div>
                      <label className='text-xs text-gray-500 mb-1 block'>Precio total COP *</label>
                      <input inputMode='numeric' placeholder='Ej: 2065000' value={it.precio} onChange={e => setItem(i, { precio: e.target.value.replace(/\D/g, '') })} />
                    </div>
                  </div>
                  {Number(it.cantidad) > 1 && <p className='text-xs text-gray-500 -mt-1'>El precio es el total de las {it.cantidad} unidades.</p>}
                  {prod && (
                    <div className='bg-purple-50 rounded-lg p-3 text-sm grid grid-cols-3 gap-2'>
                      <div><span className='text-gray-500 text-xs block'>Metros tela</span><b>{prod.metros_tela}m</b></div>
                      <div><span className='text-gray-500 text-xs block'>Precio público</span><b>${prod.valor_publico?.toLocaleString('es-CO')}</b></div>
                      <div><span className='text-gray-500 text-xs block'>Precio oferta</span><b>${prod.valor_oferta?.toLocaleString('es-CO')}</b></div>
                    </div>
                  )}
                </div>
              )
            })}
            <button type='button' className='btn w-full' onClick={() => setItems(a => [...a, itemVacio()])}>+ Agregar otro producto</button>
            {items.length > 1 && (
              <div className='rounded-lg bg-gray-50 p-3 flex justify-between font-semibold'><span>Total del pedido</span><span>{pesos(total)}</span></div>
            )}
          </div>
        </section>

        {/* FECHAS */}
        <section>
          <h2 className='text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3'>Fechas</h2>
          <div className='mb-3'>
            <label className='text-xs text-gray-500 mb-1 block'>Canal de venta *</label>
            <div className='grid grid-cols-2 gap-2 sm:grid-cols-5'>
              {CANALES.map(([k, l]) => (
                <button key={k} type='button' onClick={() => set('canal', k)}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium ${form.canal === k ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700'}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            <div>
              <label className='text-xs text-gray-500 mb-1 block'>Fecha del pedido *</label>
              <input type='date' value={form.fecha_pedido} onChange={e => set('fecha_pedido', e.target.value)} />
            </div>
            <div>
              <label className='text-xs text-gray-500 mb-1 block'>Prioridad</label>
              <select value={form.prioridad} onChange={e => set('prioridad', e.target.value)}>
                <option value='normal'>Normal</option>
                <option value='alta'>Alta</option>
                <option value='urgente'>Urgente</option>
              </select>
            </div>
          </div>
        </section>

        {/* ABONO */}
        <section>
          <h2 className='text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3'>Abono</h2>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            <div>
              <label className='text-xs text-gray-500 mb-1 block'>Valor del abono COP</label>
              <input inputMode='numeric' placeholder='Ej: 1000000' value={form.abono} onChange={e => set('abono', e.target.value.replace(/\D/g, ''))} />
            </div>
            <div>
              <label className='text-xs text-gray-500 mb-1 block'>Medio de pago</label>
              <select value={form.medio_pago} onChange={e => set('medio_pago', e.target.value)}>
                <option value=''>Seleccionar</option>
                <option value='efectivo'>Efectivo</option>
                <option value='transferencia'>Transferencia bancaria</option>
                <option value='tarjeta_credito'>Tarjeta crédito</option>
                <option value='tarjeta_debito'>Tarjeta débito</option>
                <option value='nequi'>Nequi</option>
                <option value='daviplata'>Daviplata</option>
              </select>
            </div>
          </div>
          {total > 0 && form.abono && (
            <div className='mt-3 bg-green-50 rounded-lg p-3 text-sm grid grid-cols-2 gap-2'>
              <div><span className='text-gray-500 text-xs block'>Abono</span><b className='text-green-700'>{pesos(form.abono)}</b></div>
              <div><span className='text-gray-500 text-xs block'>Saldo pendiente</span><b className='text-red-600'>{pesos(total - Number(form.abono))}</b></div>
            </div>
          )}
        </section>

        {/* OBSERVACIONES */}
        <section>
          <label className='text-xs text-gray-500 mb-1 block'>Observaciones</label>
          <textarea rows={3} placeholder='Instrucciones especiales, detalles de entrega, etc.' value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
        </section>

        <label className='flex items-start gap-2 text-sm cursor-pointer rounded-lg bg-gray-50 p-3'>
          <input type='checkbox' checked={form.enviar_correo} onChange={e => set('enviar_correo', e.target.checked)} style={{ width: 'auto', marginTop: 3 }} />
          <span><b>Enviar confirmación al cliente por correo</b><br /><span className='text-xs text-gray-500'>Desmárcalo para registrar pedidos viejos sin avisarle al cliente.</span></span>
        </label>

        <div className='flex gap-3 pt-2'>
          <button className='btn btn-primary flex-1' onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar pedido'}
          </button>
          <button className='btn' onClick={() => router.push('/pedidos')}>Cancelar</button>
        </div>

      </div>
    </div>
  )
}
/* ---------- Confirmación para el cliente: texto y comprobante ---------- */

const URL_SEGUIMIENTO = 'https://seguimiento.mrchester.com.co'
// QR de URL_SEGUIMIENTO (29×29), generado una vez para no depender de librerías
const QR_SEGUIMIENTO = ["11111110111001010011101111111", "10000010101011001000101000001", "10111010010110010010001011101", "10111010110110100100101011101", "10111010010010111001001011101", "10000010011001000001101000001", "11111110101010101010101111111", "00000000110010010100000000000", "10110111000001001110001001011", "01101000110011101011111110001", "11001011111111000110101000110", "01111000100000010010111100001", "11010010110110100101000101100", "11101100001110110111101000111", "01011110100111000101110110111", "00100001100100111001100110010", "01010110000110110011110111010", "01001000101110110010100101110", "10000011110101111000011110100", "00111001001011111100010000100", "01010011000101111111111111100", "00000000110110001011100011111", "11111110111000101111101011010", "10000010101111111010100011001", "10111010010110010100111110100", "10111010111001011110010111001", "10111010111100101100100100101", "10000010000110101010100101010", "11111110101110110001110101010"]

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const pesos = n => '$' + Number(n || 0).toLocaleString('es-CO')
function fechaLarga(iso) {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  return `${d} de ${MESES[m - 1]} de ${y}`
}
function primerNombre(nombre) {
  const n = String(nombre || '').trim().split(/\s+/)[0] || ''
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase()
}

function textoWhatsApp(pedido, cliente, lista = []) {
  const abono = Number(pedido.abono || 0)
  const saldo = Number(pedido.precio_venta) - abono
  const lineas = [
    `👑 *MR. CHESTER* · Sofás que hablan de ti`,
    `━━━━━━━━━━━━━━`,
    `Hola ${primerNombre(cliente?.nombre)}, ✅ *tu pedido ${pedido.numero} está confirmado.*`,
    ``,
    ...(lista.length > 1
      ? lista.flatMap(p => [`🛋️ *${p.tipo_sofa}*${Number(p.cantidad) > 1 ? ` × ${p.cantidad}` : ''} — ${pesos(p.precio_venta)}`, `   Tela: ${p.material}`])
      : [`🛋️ *${pedido.tipo_sofa}*${Number(pedido.cantidad) > 1 ? ` × ${pedido.cantidad}` : ''}`, `🎨 Tela: ${pedido.material}`]),
    `📅 Entrega: *${fechaLarga(pedido.fecha_entrega)}*`,
    ``,
    `💰 Total: ${pesos(pedido.precio_venta)}`,
  ]
  if (abono > 0) {
    lineas.push(`✔️ Abono: ${pesos(abono)}`)
    lineas.push(`⏳ Saldo pendiente: *${pesos(saldo)}*`)
  }
  lineas.push(
    `━━━━━━━━━━━━━━`,
    `🔎 Sigue tu sofá con tu cédula: ${URL_SEGUIMIENTO}`,
    `📍 Centro de Experiencia: Cra 19A #85-69, Bogotá`,
    `¡Gracias por elegirnos! Cualquier duda, escríbenos por aquí.`,
  )
  return lineas.join('\n')
}

function cargarImagen(src) {
  return new Promise((ok, mal) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = () => mal(new Error('no cargó el logo'))
    img.src = src
  })
}

async function dibujarComprobante(pedido, cliente, lista = []) {
  // Con varios productos, cada uno ocupa una fila (en vez de Referencia + Tela)
  const extra = lista.length > 1 ? (lista.length - 2) * 78 : 0
  const W = 1080, H = (Number(pedido.abono || 0) > 0 ? 1560 : 1400) + 250 + extra
  const ORO = '#C9A84C', NEGRO = '#1a1a1a', CREMA = '#f4f1eb', GRIS = '#6b6b6b'
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')
  const serif = 'Georgia, "Times New Roman", serif'
  const sans = 'Helvetica, Arial, sans-serif'

  // Fondo
  g.fillStyle = CREMA; g.fillRect(0, 0, W, H)

  // Encabezado negro con logo
  g.fillStyle = NEGRO; g.fillRect(0, 0, W, 330)
  try {
    const logo = await cargarImagen('/logo-mrchester.png')
    const lw = 400, lh = logo.height * (lw / logo.width)
    g.drawImage(logo, (W - lw) / 2, 50, lw, lh)
  } catch (e) { /* sin logo, sigue con el texto */ }
  g.textAlign = 'center'
  g.fillStyle = ORO
  g.font = `bold 76px ${serif}`
  g.fillText('M R .  C H E S T E R', W / 2, 220)
  g.font = `24px ${sans}`
  g.fillText('S O F Á S   Q U E   H A B L A N   D E   T I', W / 2, 270)

  // Franja dorada
  g.fillStyle = ORO; g.fillRect(0, 330, W, 70)
  g.fillStyle = NEGRO; g.font = `bold 28px ${sans}`
  g.fillText('C O N F I R M A C I Ó N   D E   P E D I D O', W / 2, 376)

  // Tarjeta blanca
  const conAbono = Number(pedido.abono || 0) > 0
  const x0 = 70, y0 = 450, cw = W - 140, ch = (conAbono ? 830 : 670) + extra
  g.fillStyle = '#ffffff'
  g.beginPath(); g.roundRect ? g.roundRect(x0, y0, cw, ch, 24) : g.rect(x0, y0, cw, ch); g.fill()

  g.textAlign = 'left'
  g.fillStyle = GRIS; g.font = `26px ${sans}`
  g.fillText('PEDIDO', x0 + 50, y0 + 70)
  g.fillStyle = NEGRO; g.font = `bold 84px ${serif}`
  g.fillText(pedido.numero || '', x0 + 50, y0 + 160)
  g.fillStyle = GRIS; g.font = `30px ${sans}`
  g.fillText(String(cliente?.nombre || '').toUpperCase().slice(0, 40), x0 + 50, y0 + 210)

  g.fillStyle = ORO; g.fillRect(x0 + 50, y0 + 240, 90, 4)

  const abono = Number(pedido.abono || 0)
  const saldo = Number(pedido.precio_venta) - abono
  const filas = [
    ...(lista.length > 1
      ? lista.map(p => [String(p.tipo_sofa || '') + (Number(p.cantidad) > 1 ? ` × ${p.cantidad}` : ''), String(p.material || '')])
      : [['Referencia', String(pedido.tipo_sofa || '') + (Number(pedido.cantidad) > 1 ? `  × ${pedido.cantidad}` : '')],
         ['Tela', String(pedido.material || '')]]),
    ['Fecha de entrega', fechaLarga(pedido.fecha_entrega)],
    ['Valor total', pesos(pedido.precio_venta)],
  ]
  if (abono > 0) filas.push(['Abono recibido', pesos(abono)])
  let y = y0 + 310
  filas.forEach(([k, v]) => {
    g.fillStyle = GRIS; g.font = `28px ${sans}`; g.textAlign = 'left'
    g.fillText(k, x0 + 50, y)
    g.fillStyle = NEGRO; g.font = `bold 32px ${sans}`; g.textAlign = 'right'
    let txt = v
    while (g.measureText(txt).width > cw - 420 && txt.length > 4) txt = txt.slice(0, -2)
    g.fillText(txt === v ? v : txt + '…', x0 + cw - 50, y)
    g.strokeStyle = '#ece7dd'; g.lineWidth = 2
    g.beginPath(); g.moveTo(x0 + 50, y + 28); g.lineTo(x0 + cw - 50, y + 28); g.stroke()
    y += 78
  })

  // Saldo destacado
  if (abono > 0) {
    const by = y0 + ch - 136
    g.fillStyle = NEGRO
    g.beginPath(); g.roundRect ? g.roundRect(x0 + 40, by, cw - 80, 96, 16) : g.rect(x0 + 40, by, cw - 80, 96); g.fill()
    g.textAlign = 'left'; g.fillStyle = ORO; g.font = `28px ${sans}`
    g.fillText('SALDO PENDIENTE', x0 + 80, by + 60)
    g.textAlign = 'right'; g.font = `bold 44px ${serif}`
    g.fillText(pesos(saldo), x0 + cw - 80, by + 64)
  }

  // Pie
  g.fillStyle = NEGRO; g.fillRect(0, H - 190, W, 190)
  g.textAlign = 'center'; g.fillStyle = ORO; g.font = `bold 26px ${sans}`
  g.fillText('MR. CHESTER EXPORT S.A.S.', W / 2, H - 125)
  g.fillStyle = '#bdbdbd'; g.font = `24px ${sans}`
  g.fillText('Centro de Experiencia: Cra 19A #85-69, Bogotá', W / 2, H - 82)
  g.fillText('Fábrica: Calle 161 #92-21, Bogotá', W / 2, H - 46)

  // Fecha de emisión
  g.textAlign = 'center'; g.fillStyle = GRIS; g.font = `22px ${sans}`
  g.fillText(`Emitido el ${fechaLarga(new Date(Date.now() - 5 * 3600 * 1000).toISOString())}`, W / 2, y0 + ch + 50)

  // QR de seguimiento
  const qy = y0 + ch + 80, qh = 210
  g.fillStyle = '#ffffff'
  g.beginPath(); g.roundRect ? g.roundRect(x0, qy, cw, qh, 20) : g.rect(x0, qy, cw, qh); g.fill()
  const n = QR_SEGUIMIENTO.length, mod = 6, qs = n * mod, qx = x0 + 30, qyy = qy + (qh - qs) / 2
  g.fillStyle = NEGRO
  QR_SEGUIMIENTO.forEach((fila, r) => { for (let k = 0; k < fila.length; k++) if (fila[k] === '1') g.fillRect(qx + k * mod, qyy + r * mod, mod, mod) })
  const tx = qx + qs + 40
  g.textAlign = 'left'
  g.fillStyle = NEGRO; g.font = `bold 36px ${serif}`
  g.fillText('¿Cómo va tu sofá?', tx, qy + 75)
  g.fillStyle = GRIS; g.font = `26px ${sans}`
  g.fillText('Escanea el código y escribe tu cédula', tx, qy + 118)
  g.fillStyle = '#8C6A1F'; g.font = `bold 26px ${sans}`
  g.fillText('seguimiento.mrchester.com.co', tx, qy + 160)
  g.textAlign = 'center'

  return new Promise((ok, mal) => c.toBlob(b => (b ? ok(b) : mal(new Error('no se generó la imagen'))), 'image/png'))
}
