import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabase'

/* Cotizaciones: se arman como un pedido (cliente + varios productos), se envían por correo
   y como imagen por WhatsApp, y con un botón se convierten en pedido. Vigencia: 8 días. */

const VIGENCIA = 8
const OTRO = '__otro'
const itemVacio = () => ({ producto_id: '', referencia: '', tela: '', telaOtra: false, detalle: '', cantidad: 1, precio: '' })

export default function Cotizaciones() {
  const router = useRouter()
  const [vista, setVista] = useState('nueva')
  const [clientes, setClientes] = useState([])
  const [productos, setProductos] = useState([])
  const [telas, setTelas] = useState([])
  const [lista, setLista] = useState([])

  function cargarLista() {
    supabase.from('cotizaciones').select('*, cliente:clientes(*), seguimientos:cotizacion_seguimientos(*)').order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => setLista(data || []))
  }
  useEffect(() => {
    supabase.from('clientes').select('*').order('nombre').then(({ data }) => setClientes(data || []))
    supabase.from('productos').select('*').order('categoria').then(({ data }) => setProductos(data || []))
    supabase.from('materiales').select('*').eq('unidad', 'metro').order('nombre').then(({ data }) => setTelas(data || []))
    cargarLista()
  }, [])
  useEffect(() => { if (router.query.ver === 'todas') setVista('todas') }, [router.query.ver])

  return (
    <div className='p-4 max-w-2xl mx-auto'>
      <h1 className='text-xl font-medium mb-4'>Cotizaciones</h1>
      <div className='flex gap-2 mb-5'>
        {[['nueva', 'Nueva cotización'], ['todas', `Todas (${lista.length})${lista.filter(tocaSeguimiento).length ? ` · 🔔 ${lista.filter(tocaSeguimiento).length}` : ''}`]].map(([k, l]) => (
          <button key={k} className={`btn flex-1 ${vista === k ? 'btn-primary' : ''}`} onClick={() => { setVista(k); if (k === 'todas') cargarLista() }}>{l}</button>
        ))}
      </div>
      {vista === 'nueva'
        ? <Nueva clientes={clientes} setClientes={setClientes} productos={productos} telas={telas} alGuardar={cargarLista} verTodas={() => { setVista('todas'); cargarLista() }} />
        : <Lista lista={lista} recargar={cargarLista} />}
    </div>
  )
}

/* ---------------- Nueva cotización ---------------- */

function Nueva({ clientes, setClientes, productos, telas, alGuardar, verTodas }) {
  const [form, setForm] = useState({
    cliente_id: '', crear_cliente: false,
    nuevo_nombre: '', nuevo_cedula: '', nuevo_tipo: 'CC', nuevo_dv: '', nuevo_tel: '', nuevo_email: '', nuevo_direccion: '', nuevo_ciudad: '',
    descuento: '', observaciones: '',
  })
  const [items, setItems] = useState([itemVacio()])
  // Desde el CRM: /cotizaciones?cliente=ID&prospecto=ID deja el cliente elegido
  const router = useRouter()
  useEffect(() => {
    if (router.query.cliente) setForm(f => ({ ...f, cliente_id: String(router.query.cliente), crear_cliente: false }))
  }, [router.query.cliente])
  const [errores, setErrores] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState(null)

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))
  const setItem = (i, cambios) => setItems(arr => arr.map((it, k) => (k === i ? { ...it, ...cambios } : it)))
  const cats = [...new Set(productos.map(p => p.categoria))]

  const subtotal = items.reduce((s, it) => s + (Number(it.cantidad) || 0) * (Number(it.precio) || 0), 0)
  const descuento = Number(form.descuento) || 0
  const total = Math.max(0, subtotal - descuento)

  function elegirProducto(i, id) {
    if (id === OTRO) return setItem(i, { producto_id: OTRO, referencia: '' })
    const p = productos.find(x => x.id === id)
    setItem(i, { producto_id: id, referencia: p ? p.referencia : '', precio: p?.valor_publico ? String(p.valor_publico) : items[i].precio })
  }

  function validar() {
    const e = []
    if (form.crear_cliente) {
      if (!form.nuevo_nombre.trim()) e.push('Escribe el nombre del cliente.')
      if (form.nuevo_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.nuevo_email.trim())) e.push('El correo del cliente no es válido.')
    } else if (!form.cliente_id) e.push('Elige un cliente o crea uno nuevo.')
    items.forEach((it, i) => {
      const n = items.length > 1 ? ` (producto ${i + 1})` : ''
      if (!it.referencia.trim()) e.push(`Elige o escribe la referencia${n}.`)
      if (!(Number(it.cantidad) > 0)) e.push(`La cantidad debe ser mayor a 0${n}.`)
      if (!(Number(it.precio) > 0)) e.push(`Escribe el precio, solo números${n}.`)
    })
    if (form.descuento && isNaN(Number(form.descuento))) e.push('El descuento debe ser solo números.')
    if (descuento > subtotal) e.push('El descuento no puede ser mayor al subtotal.')
    return e
  }

  async function guardar() {
    const e = validar()
    setErrores(e)
    if (e.length) { window.scrollTo(0, 0); return }
    setGuardando(true)

    let cliente
    if (form.crear_cliente) {
      const { data: nc, error } = await supabase.from('clientes').insert({
        nombre: form.nuevo_nombre.trim(), cedula: form.nuevo_cedula, tipo_documento: form.nuevo_tipo, dv: form.nuevo_tipo === 'NIT' ? (form.nuevo_dv || null) : null, telefono: form.nuevo_tel,
        email: form.nuevo_email.trim() || null, direccion: form.nuevo_direccion, ciudad: form.nuevo_ciudad,
      }).select().single()
      if (error || !nc) { setErrores(['No se pudo guardar el cliente: ' + (error?.message || 'error') + '. La cotización NO se guardó.']); setGuardando(false); return }
      cliente = nc
      setClientes(cs => [...cs, nc].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    } else {
      cliente = clientes.find(c => c.id === form.cliente_id)
    }

    const limpios = items.map(it => ({
      referencia: it.referencia.trim(), tela: it.tela.trim(), detalle: it.detalle.trim(),
      cantidad: Number(it.cantidad), precio: Number(it.precio),
    }))
    const { data: cot, error } = await supabase.from('cotizaciones').insert({
      numero: '', cliente_id: cliente.id, items: limpios, descuento, total,
      observaciones: form.observaciones.trim() || null, vigencia_dias: VIGENCIA, estado: 'enviada',
    }).select().single()
    if (error || !cot) {
      setErrores(['La cotización NO se guardó: ' + (error?.message || 'error') + '. Tus datos siguen en el formulario.'])
      setGuardando(false); window.scrollTo(0, 0); return
    }
    const correo = await enviarCorreo(cot, cliente)
    if (router.query.prospecto) {
      const pid = String(router.query.prospecto)
      await supabase.from('crm_prospectos').update({ etapa: 'cotizado', cliente_id: cliente.id, ultima_actividad: new Date().toISOString() }).eq('id', pid)
      await supabase.from('crm_actividades').insert({ prospecto_id: pid, tipo: 'cotizacion', texto: `Cotización ${cot.numero} por ${pesos(cot.total)}` })
    }
    setGuardando(false)
    setResultado({ cot, cliente, correo })
    alGuardar()
    window.scrollTo(0, 0)
  }

  function otra() {
    setResultado(null); setErrores([]); setItems([itemVacio()])
    setForm(f => ({ ...f, cliente_id: '', crear_cliente: false, nuevo_nombre: '', nuevo_cedula: '', nuevo_tipo: 'CC', nuevo_dv: '', nuevo_tel: '', nuevo_email: '', nuevo_direccion: '', nuevo_ciudad: '', descuento: '', observaciones: '' }))
  }

  if (resultado) return <Resultado {...resultado} otra={otra} verTodas={verTodas} />

  return (
    <>
      {errores.length > 0 && (
        <div className='mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700' role='alert'>
          <b>Revisa esto antes de enviar:</b>
          <ul className='list-disc ml-5 mt-1'>{errores.map(x => <li key={x}>{x}</li>)}</ul>
        </div>
      )}
      <div className='card space-y-6'>
        <section>
          <h2 className='text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3'>Cliente</h2>
          <div className='flex gap-4 mb-3'>
            <label className='flex items-center gap-2 text-sm cursor-pointer'><input type='radio' checked={!form.crear_cliente} onChange={() => set('crear_cliente', false)} /> Existente</label>
            <label className='flex items-center gap-2 text-sm cursor-pointer'><input type='radio' checked={form.crear_cliente} onChange={() => set('crear_cliente', true)} /> Nuevo cliente</label>
          </div>
          {!form.crear_cliente ? (
            <select value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)}>
              <option value=''>Seleccionar cliente</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          ) : (
            <div className='space-y-3'>
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                <Campo l='Nombre completo *'><input value={form.nuevo_nombre} onChange={e => set('nuevo_nombre', e.target.value)} placeholder='Nombre completo' /></Campo>
                <Campo l='Documento'><div className='flex gap-2'><select className='w-28 shrink-0' value={form.nuevo_tipo} onChange={e => set('nuevo_tipo', e.target.value)}><option value='CC'>Cédula</option><option value='NIT'>NIT</option></select><input className='min-w-0 flex-1' inputMode='numeric' value={form.nuevo_cedula} onChange={e => set('nuevo_cedula', e.target.value.replace(/[^0-9]/g, ''))} placeholder={form.nuevo_tipo === 'NIT' ? 'Ej: 901574522' : 'Ej: 1234567890'} />{form.nuevo_tipo === 'NIT' && <input className='w-14 shrink-0 text-center' inputMode='numeric' maxLength={1} placeholder='DV' value={form.nuevo_dv} onChange={e => set('nuevo_dv', e.target.value.replace(/[^0-9]/g, ''))} />}</div></Campo>
                <Campo l='Teléfono / WhatsApp'><input inputMode='tel' value={form.nuevo_tel} onChange={e => set('nuevo_tel', e.target.value)} placeholder='Ej: 3001234567' /></Campo>
                <Campo l='Correo electrónico'><input type='email' value={form.nuevo_email} onChange={e => set('nuevo_email', e.target.value)} placeholder='correo@ejemplo.com' /></Campo>
              </div>
              <Campo l='Dirección'><input value={form.nuevo_direccion} onChange={e => set('nuevo_direccion', e.target.value)} placeholder='Ej: Calle 85 #19-20, Apto 301' /></Campo>
              <Campo l='Ciudad'><input value={form.nuevo_ciudad} onChange={e => set('nuevo_ciudad', e.target.value)} placeholder='Ej: Bogotá' /></Campo>
            </div>
          )}
        </section>

        <section>
          <h2 className='text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3'>Productos</h2>
          <div className='space-y-4'>
            {items.map((it, i) => (
              <div key={i} className='rounded-lg border border-gray-200 p-3 space-y-3'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm font-semibold'>Producto {i + 1}</span>
                  {items.length > 1 && <button type='button' className='text-sm text-red-600' onClick={() => setItems(a => a.filter((_, k) => k !== i))}>Quitar</button>}
                </div>
                <Campo l='Referencia *'>
                  <select value={it.producto_id} onChange={e => elegirProducto(i, e.target.value)}>
                    <option value=''>Seleccionar referencia</option>
                    {cats.map(cat => (
                      <optgroup key={cat} label={cat}>
                        {productos.filter(p => p.categoria === cat).map(p => <option key={p.id} value={p.id}>{p.referencia}</option>)}
                      </optgroup>
                    ))}
                    <option value={OTRO}>Otro (escribirlo)</option>
                  </select>
                </Campo>
                {it.producto_id === OTRO && (
                  <Campo l='¿Qué producto?'><input value={it.referencia} onChange={e => setItem(i, { referencia: e.target.value })} placeholder='Ej: Puff capitoneado 60 cm' /></Campo>
                )}
                <Campo l='Tela'>
                  <select value={it.telaOtra ? OTRO : it.tela} onChange={e => setItem(i, e.target.value === OTRO ? { telaOtra: true, tela: '' } : { telaOtra: false, tela: e.target.value })}>
                    <option value=''>Por definir</option>
                    {telas.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                    <option value={OTRO}>Otra (escribirla)</option>
                  </select>
                </Campo>
                {it.telaOtra && (
                  <Campo l='¿Qué tela?'><input value={it.tela} onChange={e => setItem(i, { tela: e.target.value })} placeholder='Ej: Terciopelo verde esmeralda' /></Campo>
                )}
                <Campo l='Detalle (medidas, color de patas, etc.)'><input value={it.detalle} onChange={e => setItem(i, { detalle: e.target.value })} placeholder='Opcional' /></Campo>
                <div className='grid grid-cols-2 gap-3'>
                  <Campo l='Cantidad'><input type='number' min='1' inputMode='numeric' value={it.cantidad} onChange={e => setItem(i, { cantidad: e.target.value })} /></Campo>
                  <Campo l='Precio unidad COP *'><input inputMode='numeric' value={it.precio} onChange={e => setItem(i, { precio: e.target.value.replace(/\D/g, '') })} placeholder='Ej: 2065000' /></Campo>
                </div>
                {Number(it.precio) > 0 && Number(it.cantidad) > 1 && (
                  <p className='text-sm text-gray-600 text-right'>Subtotal: <b>{pesos(it.precio * it.cantidad)}</b></p>
                )}
              </div>
            ))}
            <button type='button' className='btn w-full' onClick={() => setItems(a => [...a, itemVacio()])}>+ Agregar otro producto</button>
          </div>
        </section>

        <section className='space-y-3'>
          <h2 className='text-sm font-semibold uppercase tracking-wide text-gray-500'>Total</h2>
          <Campo l='Descuento COP (opcional)'><input inputMode='numeric' value={form.descuento} onChange={e => set('descuento', e.target.value.replace(/\D/g, ''))} placeholder='Ej: 200000' /></Campo>
          <div className='rounded-lg bg-gray-50 p-3 text-sm space-y-1'>
            <div className='flex justify-between'><span className='text-gray-500'>Subtotal</span><span>{pesos(subtotal)}</span></div>
            {descuento > 0 && <div className='flex justify-between'><span className='text-gray-500'>Descuento</span><span className='text-green-700'>− {pesos(descuento)}</span></div>}
            <div className='flex justify-between text-base pt-1 border-t border-gray-200'><b>Total</b><b>{pesos(total)}</b></div>
            <p className='text-xs text-gray-500'>Válida por {VIGENCIA} días.</p>
          </div>
          <Campo l='Observaciones para el cliente'><textarea rows={3} value={form.observaciones} onChange={e => set('observaciones', e.target.value)} placeholder='Ej: Incluye cojines decorativos. Tiempo de fabricación 20 días hábiles.' /></Campo>
        </section>

        <button className='btn btn-primary w-full' onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando y enviando…' : 'Guardar y enviar cotización'}
        </button>
      </div>
    </>
  )
}

function Campo({ l, children }) {
  return <div><label className='text-xs text-gray-500 mb-1 block'>{l}</label>{children}</div>
}

/* ---------------- Pantalla después de guardar ---------------- */

function Resultado({ cot, cliente, correo: correoInicial, otra, verTodas }) {
  const [correo, setCorreo] = useState(correoInicial)
  return (
    <div className='card space-y-4'>
      <div className='rounded-lg bg-green-50 border border-green-200 p-4'>
        <p className='text-sm text-green-700 font-semibold'>✓ Cotización guardada</p>
        <p className='text-3xl font-bold mt-1'>{cot.numero}</p>
        <p className='text-sm text-gray-600 mt-1'>{cliente?.nombre} · {pesos(cot.total)} · válida hasta {fechaLarga(venceEl(cot))}</p>
      </div>
      <EstadoCorreo correo={correo} cliente={cliente} />
      <Compartir cot={cot} cliente={cliente} />
      {cliente?.email && !correo?.cliente_ok && !correo?.enviando && (
        <button className='btn' onClick={async () => { setCorreo({ enviando: true }); setCorreo(await enviarCorreo(cot, cliente)) }}>Reintentar correo</button>
      )}
      <button className='btn' onClick={otra}>Hacer otra cotización</button>
      <button className='btn' onClick={verTodas}>Ver todas las cotizaciones</button>
    </div>
  )
}

function EstadoCorreo({ correo, cliente }) {
  if (!correo) return null
  return (
    <div className={`rounded-lg p-3 text-sm border ${correo.enviando ? 'bg-gray-50 border-gray-200' : correo.cliente_ok ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
      {correo.enviando ? 'Enviando correo…'
        : correo.cliente_ok ? <>✓ Cotización enviada a <b>{cliente.email}</b></>
        : !cliente?.email ? <>El cliente no tiene correo. Envíale la cotización por WhatsApp.</>
        : <>⚠ No se pudo enviar el correo a <b>{cliente.email}</b>.<br /><span className='text-gray-600'>{correo.error}</span></>}
      {correo.copia_ok && <div className='text-gray-500 mt-1'>Copia enviada a josephtoledo@gmail.com</div>}
    </div>
  )
}

function Compartir({ cot, cliente }) {
  const [trabajando, setTrabajando] = useState(false)
  const [imgUrl, setImgUrl] = useState(null)
  const tel = (cliente?.telefono || '').replace(/\D/g, '')
  const telWa = tel.length === 10 ? '57' + tel : tel
  const msg = textoWhatsApp(cot, cliente)

  async function compartir() {
    setTrabajando(true)
    try {
      const blob = await dibujarCotizacion(cot, cliente)
      const archivo = new File([blob], `Cotizacion-${cot.numero}.png`, { type: 'image/png' })
      if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
        try { await navigator.share({ files: [archivo], text: msg }) }
        catch (e) { if (e && e.name !== 'AbortError') setImgUrl(URL.createObjectURL(blob)) }
      } else setImgUrl(URL.createObjectURL(blob))
    } catch (e) { alert('No se pudo crear la imagen: ' + e.message) }
    setTrabajando(false)
  }

  return (
    <div className='flex flex-col gap-2'>
      <button className='btn btn-primary' onClick={compartir} disabled={trabajando}>{trabajando ? 'Preparando imagen…' : '📄 Compartir cotización con logo'}</button>
      {tel && <a className='btn text-center' href={`https://wa.me/${telWa}?text=${encodeURIComponent(msg)}`} target='_blank' rel='noreferrer'>Enviar solo texto por WhatsApp</a>}
      {imgUrl && (
        <div className='rounded-lg border p-2 text-center text-sm text-gray-600'>
          Mantén presionada la imagen para guardarla o compartirla.
          <img src={imgUrl} alt={`Cotización ${cot.numero}`} className='mt-2 rounded' />
        </div>
      )}
    </div>
  )
}

/* ---------------- Lista de cotizaciones ---------------- */

const ESTADOS = {
  enviada: ['Enviada', 'bg-blue-50 text-blue-700'],
  vencida: ['Vencida', 'bg-gray-100 text-gray-600'],
  aceptada: ['Aceptada', 'bg-green-50 text-green-700'],
  convertida: ['Pedido creado', 'bg-green-100 text-green-800'],
  rechazada: ['No aceptó', 'bg-red-50 text-red-700'],
}

function estadoReal(c) {
  if (c.estado === 'enviada' && new Date(venceEl(c) + 'T23:59:59') < new Date()) return 'vencida'
  return c.estado
}

function Lista({ lista, recargar }) {
  const [abierta, setAbierta] = useState(null)
  const [filtro, setFiltro] = useState('abiertas')
  useEffect(() => { if (lista.some(tocaSeguimiento)) setFiltro('seguir') }, [lista.length])
  const porSeguir = lista.filter(tocaSeguimiento)
  const visibles = lista.filter(c => filtro === 'todas' ? true : filtro === 'seguir' ? tocaSeguimiento(c) : ['enviada', 'aceptada', 'vencida'].includes(estadoReal(c)))
    .sort((a, b) => filtro === 'seguir' ? String(proximaAlarma(a) || '').localeCompare(String(proximaAlarma(b) || '')) : 0)
  if (!lista.length) return <p className='text-gray-500 text-center py-10'>Todavía no hay cotizaciones.</p>
  return (
    <div className='space-y-3'>
      <div className='flex gap-2 text-sm flex-wrap'>
        {[['seguir', `🔔 Alarmas (${porSeguir.length})`], ['abiertas', 'Pendientes'], ['todas', 'Todas']].map(([k, l]) => (
          <button key={k} className={`px-3 py-1 rounded-full border ${filtro === k ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300'}`} onClick={() => setFiltro(k)}>{l}</button>
        ))}
      </div>
      {porSeguir.length > 0 && filtro !== 'seguir' && <button type='button' className='w-full rounded-lg border-2 border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800 text-left' onClick={() => setFiltro('seguir')}>🔔 Tienes {porSeguir.length} cotizaci{porSeguir.length > 1 ? 'ones' : 'ón'} para hacer seguimiento hoy · Ver</button>}
      {visibles.length === 0 && <p className='text-gray-500 text-center py-6'>{filtro === 'seguir' ? '¡Al día! No hay seguimientos pendientes.' : 'No hay cotizaciones pendientes.'}</p>}
      {visibles.map(c => (
        <Fila key={c.id} c={c} abierta={abierta === c.id} toggle={() => setAbierta(abierta === c.id ? null : c.id)} recargar={recargar} />
      ))}
    </div>
  )
}

function Fila({ c, abierta, toggle, recargar }) {
  const router = useRouter()
  const est = estadoReal(c)
  const [lbl, cls] = ESTADOS[est] || [est, 'bg-gray-100']
  const [correo, setCorreo] = useState(null)
  const resumen = (c.items || []).map(it => it.referencia + (it.cantidad > 1 ? ` ×${it.cantidad}` : '')).join(', ')

  async function cambiarEstado(estado) {
    await supabase.from('cotizaciones').update({ estado }).eq('id', c.id)
    recargar()
  }

  return (
    <div className='card p-0 overflow-hidden'>
      <button className='w-full text-left p-4' onClick={toggle} aria-expanded={abierta}>
        <div className='flex items-start justify-between gap-2'>
          <div className='min-w-0'>
            <div className='font-semibold'>{c.numero} · {c.cliente?.nombre || 'Sin cliente'}</div>
            <div className='text-sm text-gray-600 truncate'>{resumen}</div>
            <div className='text-xs text-gray-500 mt-0.5'>{fechaCorta(c.created_at)} · vence {fechaCorta(venceEl(c))}</div>
            <div className='text-xs mt-0.5'>
              {(c.seguimientos || []).length
                ? <span className='text-gray-500'>Último seguimiento: {haceDias(ultimoContacto(c))} ({(c.seguimientos || []).length})</span>
                : <span className='text-gray-500'>Sin seguimientos</span>}
              {tocaSeguimiento(c) ? <span className='ml-2 inline-block px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold'>🔔 {textoAlarma(proximaAlarma(c) || hoyBogota())}</span>
                : proximaAlarma(c) && <span className='ml-2 text-gray-500'>🔔 {textoAlarma(proximaAlarma(c))}</span>}
            </div>
          </div>
          <div className='text-right flex-none'>
            <div className='font-semibold'>{pesos(c.total)}</div>
            <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${cls}`}>{lbl}</span>
          </div>
        </div>
      </button>
      {abierta && (
        <div className='border-t border-gray-100 p-4 space-y-2'>
          <ul className='text-sm space-y-1 mb-2'>
            {(c.items || []).map((it, i) => (
              <li key={i} className='flex justify-between gap-2'>
                <span>{it.referencia}{it.tela ? ` · ${it.tela}` : ''}{it.detalle ? ` · ${it.detalle}` : ''}{it.cantidad > 1 ? ` × ${it.cantidad}` : ''}</span>
                <span className='flex-none'>{pesos(it.precio * it.cantidad)}</span>
              </li>
            ))}
            {Number(c.descuento) > 0 && <li className='flex justify-between text-green-700'><span>Descuento</span><span>− {pesos(c.descuento)}</span></li>}
          </ul>
          {est !== 'convertida' && (
            <button className='btn btn-primary w-full' onClick={() => router.push(`/pedidos/nuevo?cotizacion=${c.id}`)}>✅ Convertir en pedido</button>
          )}
          <Compartir cot={c} cliente={c.cliente} />
          {c.cliente?.email && (
            <button className='btn w-full' disabled={correo?.enviando} onClick={async () => { setCorreo({ enviando: true }); setCorreo(await enviarCorreo(c, c.cliente)) }}>Reenviar por correo</button>
          )}
          <EstadoCorreo correo={correo} cliente={c.cliente} />
          {!['convertida', 'rechazada'].includes(est) && <Alarma c={c} recargar={recargar} />}
          {!['convertida', 'rechazada'].includes(est) && <Seguimiento c={c} recargar={recargar} />}
          {(c.seguimientos || []).length > 0 && <Historial c={c} />}
          {est !== 'convertida' && (
            <div className='flex gap-2 pt-1'>
              {est !== 'aceptada' && <button className='btn flex-1 text-sm' onClick={() => cambiarEstado('aceptada')}>Aceptó</button>}
              {est !== 'rechazada' && <button className='btn flex-1 text-sm' onClick={() => cambiarEstado('rechazada')}>No aceptó</button>}
              {est !== 'enviada' && <button className='btn flex-1 text-sm' onClick={() => cambiarEstado('enviada')}>Pendiente</button>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------------- Seguimiento de cotizaciones ---------------- */

const DIAS_ENTRE_SEGUIMIENTOS = 2

function ultimoContacto(c) {
  const fechas = [(c.created_at), ...(c.seguimientos || []).map(s => s.created_at)].map(f => new Date(f).getTime())
  return new Date(Math.max(...fechas))
}
function tocaSeguimiento(c) {
  if (!['enviada', 'vencida', 'aceptada'].includes(estadoReal(c))) return false
  if (c.alarma) return c.alarma <= hoyBogota()
  if (estadoReal(c) === 'aceptada') return false
  return (Date.now() - ultimoContacto(c).getTime()) / 86400000 >= DIAS_ENTRE_SEGUIMIENTOS
}
// Fecha de la próxima alarma (la que puso el vendedor, o la automática cada 2 días)
function proximaAlarma(c) {
  if (c.alarma) return c.alarma
  if (!['enviada', 'vencida'].includes(estadoReal(c))) return null
  return hoyBogota(new Date(ultimoContacto(c).getTime() + DIAS_ENTRE_SEGUIMIENTOS * 86400000))
}
function sumarDiasISO(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
function textoAlarma(iso) {
  const hoy = hoyBogota()
  const d = Math.round((new Date(iso + 'T12:00:00Z') - new Date(hoy + 'T12:00:00Z')) / 86400000)
  if (d < 0) return `vencida hace ${-d} día${d === -1 ? '' : 's'}`
  if (d === 0) return 'hoy'
  if (d === 1) return 'mañana'
  return `el ${fechaCorta(iso)}`
}

function Alarma({ c, recargar }) {
  const [nota, setNota] = useState(c.alarma_nota || '')
  const [eligiendo, setEligiendo] = useState(false)
  const prox = proximaAlarma(c)
  const hoy = hoyBogota()
  async function poner(fecha) {
    await supabase.from('cotizaciones').update({ alarma: fecha, alarma_nota: fecha ? (nota.trim() || null) : null }).eq('id', c.id)
    setEligiendo(false); recargar()
  }
  const vencida = prox && prox <= hoy
  return (
    <div className={`rounded-lg border p-3 space-y-2 ${vencida ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
      <div className='flex justify-between items-center gap-2'>
        <span className={`text-sm font-semibold ${vencida ? 'text-red-700' : ''}`}>🔔 {prox ? `Alarma ${textoAlarma(prox)}` : 'Sin alarma'}{!c.alarma && prox ? ' (automática)' : ''}</span>
        {c.alarma && <button type='button' className='text-xs underline text-gray-500' onClick={() => poner(null)}>Quitar</button>}
      </div>
      {c.alarma_nota && <p className='text-xs text-gray-600'>📝 {c.alarma_nota}</p>}
      <div className='flex flex-wrap gap-1.5'>
        {[['Mañana', 1], ['En 3 días', 3], ['En 1 semana', 7]].map(([l, n]) => (
          <button key={l} type='button' className='text-xs px-2.5 py-1 rounded-full border border-gray-300 bg-white' onClick={() => poner(sumarDiasISO(hoy, n))}>{l}</button>
        ))}
        <button type='button' className='text-xs px-2.5 py-1 rounded-full border border-gray-300 bg-white' onClick={() => setEligiendo(!eligiendo)}>📅 Elegir fecha</button>
      </div>
      {eligiendo && (
        <div className='space-y-2'>
          <input type='date' aria-label='Fecha de la alarma' min={hoy} onChange={e => e.target.value && poner(e.target.value)} />
        </div>
      )}
      <input aria-label='Nota de la alarma' value={nota} onChange={e => setNota(e.target.value)} onBlur={() => c.alarma && nota !== (c.alarma_nota || '') && poner(c.alarma)} placeholder='Nota: ej. "llamar después de las 5", "va a hablar con su esposa"' className='text-sm' />
    </div>
  )
}
function haceDias(fecha) {
  const d = Math.floor((new Date(hoyBogota()) - new Date(hoyBogota(new Date(fecha)))) / 86400000)
  return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`
}

function plantillas(c) {
  const n = primerNombre(c.cliente?.nombre)
  const ref = (c.items || [])[0]?.referencia || 'tu sofá'
  return [
    { k: 'pendientes', t: 'Estamos pendientes',
      m: `Hola ${n}, ¿cómo estás? Te escribimos de Mr. Chester 👑. Queremos estar pendientes de ti: ¿qué has pensado de la cotización ${c.numero} del ${ref}? Si tienes alguna duda sobre telas, medidas o tiempos de entrega, con gusto te ayudamos.` },
    { k: 'visita', t: 'Invitar a ver telas',
      m: `Hola ${n}, ¿cómo vas? Si quieres ver y tocar las telas antes de decidir, te esperamos en nuestro Centro de Experiencia (Cra 19A #85-69, Bogotá). Cuéntanos qué día te queda bien y te atendemos personalmente. Cotización ${c.numero}.` },
    { k: 'vence', t: 'Antes de que venza',
      m: `Hola ${n}, te recordamos que tu cotización ${c.numero} es válida hasta el ${fechaLarga(venceEl(c))}. Si la confirmas antes, te mantenemos el precio y separamos tu fecha de fabricación. ¿Te ayudamos a cerrarla?` },
    { k: 'libre', t: 'Mensaje propio', m: `Hola ${n}, ` },
  ]
}

function Seguimiento({ c, recargar }) {
  const ops = plantillas(c)
  const [elegida, setElegida] = useState(ops[0].k)
  const [texto, setTexto] = useState(ops[0].m)
  const [estado, setEstado] = useState(null)
  const tel = (c.cliente?.telefono || '').replace(/\D/g, '')
  const telWa = tel.length === 10 ? '57' + tel : tel

  function elegir(k) { setElegida(k); setTexto(ops.find(o => o.k === k).m) }

  async function registrar(canal) {
    const { error } = await supabase.from('cotizacion_seguimientos').insert({ cotizacion_id: c.id, canal, mensaje: texto.trim() })
    if (error) { setEstado({ error: 'No quedó registrado: ' + error.message }); return false }
    // Después de cada seguimiento, la próxima alarma queda en 2 días (se puede cambiar)
    await supabase.from('cotizaciones').update({ alarma: sumarDiasISO(hoyBogota(), DIAS_ENTRE_SEGUIMIENTOS), alarma_nota: null }).eq('id', c.id)
    recargar()
    return true
  }

  async function porWhatsApp() {
    window.open(`https://wa.me/${telWa}?text=${encodeURIComponent(texto.trim())}`, '_blank')
    if (await registrar('whatsapp')) setEstado({ ok: 'Seguimiento por WhatsApp registrado.' })
  }

  async function porCorreo() {
    setEstado({ enviando: true })
    const r = await enviarCorreo(c, c.cliente, texto.trim())
    if (!r.cliente_ok) { setEstado({ error: 'No se pudo enviar el correo: ' + (r.error || 'sin detalle') }); return }
    if (await registrar('correo')) setEstado({ ok: `Seguimiento enviado a ${c.cliente.email} y registrado.` })
  }

  return (
    <div className='rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2 mt-2'>
      <div className='font-semibold text-sm'>💬 Hacer seguimiento</div>
      <div className='flex flex-wrap gap-1.5'>
        {ops.map(o => (
          <button key={o.k} type='button' onClick={() => elegir(o.k)}
            className={`text-xs px-2.5 py-1 rounded-full border ${elegida === o.k ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-300'}`}>{o.t}</button>
        ))}
      </div>
      <textarea rows={5} value={texto} onChange={e => setTexto(e.target.value)} aria-label='Mensaje de seguimiento' />
      <div className='flex gap-2'>
        {tel && <button className='btn btn-primary flex-1' onClick={porWhatsApp} disabled={!texto.trim()}>Enviar por WhatsApp</button>}
        {c.cliente?.email && <button className='btn flex-1' onClick={porCorreo} disabled={!texto.trim() || estado?.enviando}>{estado?.enviando ? 'Enviando…' : 'Enviar por correo'}</button>}
      </div>
      {!tel && !c.cliente?.email && <p className='text-sm text-gray-600'>El cliente no tiene WhatsApp ni correo. Agrégalos en Clientes.</p>}
      {estado?.ok && <p className='text-sm text-green-700'>✓ {estado.ok}</p>}
      {estado?.error && <p className='text-sm text-red-700'>{estado.error}</p>}
    </div>
  )
}

function Historial({ c }) {
  const lista = [...(c.seguimientos || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  return (
    <div className='mt-2'>
      <div className='font-semibold text-sm mb-1'>Historial de seguimientos</div>
      <ul className='space-y-1.5'>
        {lista.map(s => (
          <li key={s.id} className='text-sm rounded-lg bg-gray-50 p-2'>
            <div className='text-xs text-gray-500'>{s.canal === 'correo' ? '✉️ Correo' : '🟢 WhatsApp'} · {fechaHora(s.created_at)}</div>
            <div className='line-clamp-2'>{s.mensaje}</div>
          </li>
        ))}
        <li className='text-xs text-gray-500 px-2'>📄 Cotización enviada · {fechaHora(c.created_at)}</li>
      </ul>
    </div>
  )
}

function fechaHora(iso) {
  const d = new Date(new Date(iso).getTime() - 5 * 3600 * 1000)
  const h = d.getUTCHours(), m = String(d.getUTCMinutes()).padStart(2, '0')
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}, ${h % 12 || 12}:${m} ${h < 12 ? 'a. m.' : 'p. m.'}`
}

/* ---------------- Utilidades: correo, texto e imagen ---------------- */

async function enviarCorreo(cotizacion, cliente, seguimiento) {
  try {
    const r = await fetch('/api/enviar-cotizacion', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cotizacion, cliente, seguimiento }),
    })
    return await r.json().catch(() => ({ ok: false, error: 'Respuesta inválida' }))
  } catch (e) {
    return { ok: false, error: 'No hubo conexión para enviar el correo.' }
  }
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const pesos = n => '$' + Math.round(Number(n || 0)).toLocaleString('es-CO')
function hoyBogota(d = new Date()) { return new Date(d.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10) }
function venceEl(c) {
  const base = new Date(hoyBogota(new Date(c.created_at || Date.now())) + 'T12:00:00Z')
  base.setUTCDate(base.getUTCDate() + Number(c.vigencia_dias || VIGENCIA))
  return base.toISOString().slice(0, 10)
}
function fechaLarga(iso) {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  return `${d} de ${MESES[m - 1]} de ${y}`
}
function fechaCorta(iso) {
  const s = String(iso).length > 10 ? hoyBogota(new Date(iso)) : String(iso)
  const [, m, d] = s.split('-').map(Number)
  return `${d} ${MESES[m - 1].slice(0, 3)}`
}
function primerNombre(nombre) {
  const n = String(nombre || '').trim().split(/\s+/)[0] || ''
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase()
}

function textoWhatsApp(cot, cliente) {
  const l = [
    `👑 *MR. CHESTER* · Sofás que hablan de ti`,
    `━━━━━━━━━━━━━━`,
    `Hola ${primerNombre(cliente?.nombre)}, te comparto tu *cotización ${cot.numero}*:`,
    ``,
  ]
  ;(cot.items || []).forEach(it => {
    l.push(`🛋️ *${it.referencia}*${it.cantidad > 1 ? ` × ${it.cantidad}` : ''} — ${pesos(it.precio * it.cantidad)}`)
    if (it.tela) l.push(`   Tela: ${it.tela}`)
    if (it.detalle) l.push(`   ${it.detalle}`)
  })
  l.push(``)
  if (Number(cot.descuento) > 0) l.push(`🎁 Descuento: −${pesos(cot.descuento)}`)
  l.push(`💰 *Total: ${pesos(cot.total)}*`)
  l.push(`⏳ Válida hasta el ${fechaLarga(venceEl(cot))}`)
  if (cot.observaciones) l.push(``, `📝 ${cot.observaciones}`)
  l.push(
    `━━━━━━━━━━━━━━`,
    `📍 Centro de Experiencia: Cra 19A #85-69, Bogotá`,
    `¿Te gustaría confirmarla? Escríbenos por aquí y separamos tu fecha.`,
  )
  return l.join('\n')
}

function cargarImagen(src) {
  return new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => mal(new Error('logo')); i.src = src })
}

async function dibujarCotizacion(cot, cliente) {
  const items = cot.items || []
  const W = 1080
  const ORO = '#C9A84C', NEGRO = '#1a1a1a', CREMA = '#f4f1eb', GRIS = '#6b6b6b'
  const serif = 'Georgia, "Times New Roman", serif', sans = 'Helvetica, Arial, sans-serif'
  const altoItem = it => 70 + (it.tela || it.detalle ? 40 : 0)
  const desc = Number(cot.descuento) > 0
  const obs = cot.observaciones ? cot.observaciones.slice(0, 200) : ''
  const x0 = 70, y0 = 450, cw = W - 140
  const ch = 280 + items.reduce((s, it) => s + altoItem(it), 0) + (desc ? 60 : 0) + 140
  const altoObs = obs ? 60 + Math.ceil(obs.length / 55) * 36 : 0
  const H = y0 + ch + 60 + altoObs + 120 + 190

  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d')
  const rect = (x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); g.fill() }
  const corta = (t, max) => { let s = String(t); while (g.measureText(s).width > max && s.length > 3) s = s.slice(0, -2); return s === String(t) ? s : s + '…' }

  g.fillStyle = CREMA; g.fillRect(0, 0, W, H)
  g.fillStyle = NEGRO; g.fillRect(0, 0, W, 330)
  try { const logo = await cargarImagen('/logo-mrchester.png'); const lw = 400; g.drawImage(logo, (W - lw) / 2, 50, lw, logo.height * (lw / logo.width)) } catch (e) { /* sin logo */ }
  g.textAlign = 'center'; g.fillStyle = ORO
  g.font = `bold 76px ${serif}`; g.fillText('M R .  C H E S T E R', W / 2, 220)
  g.font = `24px ${sans}`; g.fillText('S O F Á S   Q U E   H A B L A N   D E   T I', W / 2, 270)
  g.fillStyle = ORO; g.fillRect(0, 330, W, 70)
  g.fillStyle = NEGRO; g.font = `bold 28px ${sans}`; g.fillText('C O T I Z A C I Ó N', W / 2, 376)

  g.fillStyle = '#ffffff'; rect(x0, y0, cw, ch, 24)
  g.textAlign = 'left'
  g.fillStyle = GRIS; g.font = `26px ${sans}`; g.fillText('COTIZACIÓN', x0 + 50, y0 + 70)
  g.fillStyle = NEGRO; g.font = `bold 76px ${serif}`; g.fillText(cot.numero || '', x0 + 50, y0 + 155)
  g.fillStyle = GRIS; g.font = `30px ${sans}`; g.fillText(corta(String(cliente?.nombre || '').toUpperCase(), cw - 100), x0 + 50, y0 + 205)
  g.fillStyle = ORO; g.fillRect(x0 + 50, y0 + 235, 90, 4)

  let y = y0 + 300
  items.forEach(it => {
    g.textAlign = 'left'; g.fillStyle = NEGRO; g.font = `bold 32px ${sans}`
    g.fillText(corta(it.referencia + (it.cantidad > 1 ? `  × ${it.cantidad}` : ''), cw - 420), x0 + 50, y)
    g.textAlign = 'right'; g.fillText(pesos(it.precio * it.cantidad), x0 + cw - 50, y)
    if (it.tela || it.detalle) {
      g.textAlign = 'left'; g.fillStyle = GRIS; g.font = `26px ${sans}`
      g.fillText(corta([it.tela && `Tela: ${it.tela}`, it.detalle].filter(Boolean).join(' · '), cw - 100), x0 + 50, y + 40)
    }
    const yl = y + altoItem(it) - 42
    g.strokeStyle = '#ece7dd'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0 + 50, yl); g.lineTo(x0 + cw - 50, yl); g.stroke()
    y += altoItem(it)
  })
  if (desc) {
    g.textAlign = 'left'; g.fillStyle = GRIS; g.font = `28px ${sans}`; g.fillText('Descuento', x0 + 50, y)
    g.textAlign = 'right'; g.fillStyle = '#2d6a4f'; g.font = `bold 30px ${sans}`; g.fillText('− ' + pesos(cot.descuento), x0 + cw - 50, y)
    y += 60
  }
  const by = y0 + ch - 136
  g.fillStyle = NEGRO; rect(x0 + 40, by, cw - 80, 96, 16)
  g.textAlign = 'left'; g.fillStyle = ORO; g.font = `28px ${sans}`; g.fillText('TOTAL', x0 + 80, by + 60)
  g.textAlign = 'right'; g.font = `bold 48px ${serif}`; g.fillText(pesos(cot.total), x0 + cw - 80, by + 66)

  let y2 = y0 + ch + 60
  g.textAlign = 'center'; g.fillStyle = NEGRO; g.font = `bold 30px ${sans}`
  g.fillText(`Válida hasta el ${fechaLarga(venceEl(cot))}`, W / 2, y2)
  if (obs) {
    g.fillStyle = GRIS; g.font = `26px ${sans}`
    const palabras = obs.split(/\s+/); let linea = ''; y2 += 50
    palabras.forEach(p => {
      const prueba = linea ? linea + ' ' + p : p
      if (g.measureText(prueba).width > cw - 60) { g.fillText(linea, W / 2, y2); y2 += 36; linea = p } else linea = prueba
    })
    if (linea) g.fillText(linea, W / 2, y2)
  }
  g.fillStyle = GRIS; g.font = `22px ${sans}`
  g.fillText(`Emitida el ${fechaLarga(hoyBogota(new Date(cot.created_at || Date.now())))} · Precios en pesos colombianos`, W / 2, H - 230)

  g.fillStyle = NEGRO; g.fillRect(0, H - 190, W, 190)
  g.fillStyle = ORO; g.font = `bold 26px ${sans}`; g.fillText('MR. CHESTER EXPORT S.A.S.', W / 2, H - 125)
  g.fillStyle = '#bdbdbd'; g.font = `24px ${sans}`
  g.fillText('Centro de Experiencia: Cra 19A #85-69, Bogotá', W / 2, H - 82)
  g.fillText('WhatsApp Pedidos: 320 277 4320', W / 2, H - 46)

  return new Promise((ok, mal) => c.toBlob(b => (b ? ok(b) : mal(new Error('no se generó la imagen'))), 'image/png'))
}
