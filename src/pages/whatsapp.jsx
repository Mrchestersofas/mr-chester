import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

/* WhatsApp: bot de atención (API oficial). Aquí se ve si la conexión con Meta ya está lista,
   se prueba el bot con el simulador (no envía nada) y se ven las conversaciones reales. */

const NOMBRES_VAR = {
  WHATSAPP_TOKEN: 'Token de acceso de WhatsApp',
  WHATSAPP_PHONE_NUMBER_ID: 'ID del número (315 882 5393)',
  WHATSAPP_VERIFY_TOKEN: 'Clave de verificación del webhook',
  WHATSAPP_APP_SECRET: 'Clave secreta de la app de Meta',
  SUPABASE_SERVICE_ROLE_KEY: 'Clave de servicio de Supabase',
}

async function token() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token
}

export default function WhatsApp() {
  const [tab, setTab] = useState('simulador')
  return (
    <div className='p-4 max-w-3xl mx-auto'>
      <h1 className='text-xl font-medium'>WhatsApp</h1>
      <p className='text-sm text-gray-500 mb-4'>Bot de atención: menú de bienvenida, estado del pedido por teléfono o cédula, y paso a un asesor.</p>
      <div className='flex gap-2 mb-4'>
        {[['simulador', '🧪 Probar bot'], ['chats', '💬 Conversaciones'], ['conexion', '🔌 Conexión']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg ${tab === k ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{l}</button>
        ))}
      </div>
      {tab === 'simulador' ? <Simulador /> : tab === 'chats' ? <Chats /> : <Conexion />}
    </div>
  )
}

function Burbuja({ m, onBoton }) {
  const mio = m.de === 'cliente'
  return (
    <div className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${mio ? 'bg-green-100 text-gray-900' : 'bg-white border border-gray-200'}`}>
        {m.msg?.type === 'interactive' ? m.msg.interactive.body.text : m.msg?.type === 'text' ? m.msg.text.body : m.texto}
        {m.msg?.type === 'interactive' && (
          <div className='mt-2 grid gap-1'>
            {m.msg.interactive.action.buttons.map(b => (
              <button key={b.reply.id} type='button' onClick={() => onBoton(b.reply)} className='rounded-lg border border-sky-200 bg-sky-50 py-1.5 text-sky-700 font-medium'>{b.reply.title}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Simulador() {
  const [tel, setTel] = useState('3133136909')
  const [nombre, setNombre] = useState('')
  const [txt, setTxt] = useState('Hola')
  const [chat, setChat] = useState([])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const fin = useRef(null)
  useEffect(() => { fin.current?.scrollIntoView({ behavior: 'smooth' }) }, [chat])

  async function enviar(cuerpo, visible) {
    setEnviando(true); setError(null)
    setChat(c => [...c, { de: 'cliente', texto: visible }])
    const r = await fetch('/api/whatsapp-simular', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ telefono: tel, nombre, ...cuerpo }) })
    const j = await r.json().catch(() => ({}))
    setEnviando(false)
    if (!r.ok) { setError(j.error || 'No se pudo probar'); return }
    setChat(c => [...c, ...(j.mensajes.length ? j.mensajes.map(msg => ({ de: 'bot', msg })) : [{ de: 'bot', texto: '(El bot no responde aquí: ya contestó hace poco o un asesor está atendiendo. Escribe "menú" para ver el menú.)' }])])
  }
  async function reiniciar() {
    await fetch('/api/whatsapp-simular', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ telefono: tel, reiniciar: true }) })
    setChat([])
  }

  return (
    <div className='space-y-3'>
      <div className='card grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <div><label htmlFor='w-tel' className='text-xs text-gray-500 mb-1 block'>Teléfono del cliente (para probar)</label><input id='w-tel' inputMode='tel' value={tel} onChange={e => setTel(e.target.value)} /></div>
        <div><label htmlFor='w-nom' className='text-xs text-gray-500 mb-1 block'>Nombre de perfil (opcional)</label><input id='w-nom' value={nombre} onChange={e => setNombre(e.target.value)} placeholder='Como sale en su WhatsApp' /></div>
        <p className='sm:col-span-2 text-xs text-gray-500'>Prueba con el teléfono de un cliente que tenga pedido y con uno que no. No se envía nada ni se crean prospectos.</p>
      </div>
      <div className='rounded-xl p-3 space-y-2 min-h-[260px]' style={{ background: '#efeae2' }}>
        {chat.length === 0 && <p className='text-center text-sm text-gray-500 py-10'>Escribe un mensaje como si fueras el cliente.</p>}
        {chat.map((m, i) => <Burbuja key={i} m={m} onBoton={b => enviar({ boton: b.id }, b.title)} />)}
        <div ref={fin} />
      </div>
      {error && <p className='text-sm text-red-600'>{error}</p>}
      <form className='flex gap-2' onSubmit={e => { e.preventDefault(); if (txt.trim()) { enviar({ texto: txt }, txt); setTxt('') } }}>
        <input id='w-txt' className='flex-1' value={txt} onChange={e => setTxt(e.target.value)} placeholder='Mensaje del cliente…' />
        <button className='btn btn-primary' disabled={enviando}>{enviando ? '…' : 'Enviar'}</button>
        <button type='button' className='btn' onClick={reiniciar}>Reiniciar</button>
      </form>
    </div>
  )
}

function Chats() {
  const [msgs, setMsgs] = useState(null)
  const [abierto, setAbierto] = useState(null)
  useEffect(() => {
    supabase.from('wa_mensajes').select('*').order('created_at', { ascending: false }).limit(400).then(({ data }) => setMsgs(data || []))
  }, [])
  if (!msgs) return <p className='text-gray-500'>Cargando…</p>
  if (!msgs.length) return <div className='card text-center text-gray-500 py-8'>Todavía no hay conversaciones. Aparecen aquí cuando se conecte WhatsApp con Meta.</div>
  const porTel = {}
  for (const m of msgs) { (porTel[m.telefono] = porTel[m.telefono] || []).push(m) }
  const chats = Object.entries(porTel).map(([t, ms]) => ({ t, ms: ms.reverse(), ultimo: ms[ms.length - 1], nombre: ms.find(x => x.nombre)?.nombre }))
    .sort((a, b) => b.ultimo.created_at.localeCompare(a.ultimo.created_at))
  const COLOR = { entrante: 'bg-white', bot: 'bg-sky-50', asesor: 'bg-green-50', error: 'bg-red-50' }
  return (
    <div className='space-y-2'>
      {chats.map(c => (
        <div key={c.t} className='card py-3'>
          <button type='button' className='w-full text-left' onClick={() => setAbierto(abierto === c.t ? null : c.t)}>
            <div className='flex justify-between gap-2'><b>{c.nombre || c.t}</b><span className='text-xs text-gray-500'>{new Date(c.ultimo.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</span></div>
            <div className='text-sm text-gray-600 truncate'>{c.ultimo.texto}</div>
          </button>
          {abierto === c.t && (
            <div className='mt-3 space-y-1.5'>
              {c.ms.map(m => (
                <div key={m.id} className={`rounded-lg border border-gray-200 px-3 py-2 text-sm whitespace-pre-wrap ${COLOR[m.direccion] || ''}`}>
                  <div className='text-[11px] text-gray-500 mb-0.5'>{{ entrante: 'Cliente', bot: 'Bot', asesor: 'Asesor (app)', error: 'Error' }[m.direccion]} · {new Date(m.created_at).toLocaleString('es-CO', { timeStyle: 'short' })}</div>
                  {m.texto}
                </div>
              ))}
              <a className='btn text-sm inline-block mt-1' href={`https://wa.me/${c.t}`} target='_blank' rel='noreferrer'>Abrir chat en WhatsApp</a>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function Conexion() {
  const [vars, setVars] = useState(null)
  useEffect(() => { (async () => {
    const r = await fetch('/api/whatsapp-simular', { headers: { Authorization: `Bearer ${await token()}` } })
    const j = await r.json().catch(() => ({}))
    setVars(j.variables || {})
  })() }, [])
  if (!vars) return <p className='text-gray-500'>Revisando…</p>
  const listo = Object.values(vars).every(Boolean)
  return (
    <div className='space-y-3'>
      <div className={`card ${listo ? 'border-green-300' : 'border-amber-300'}`}>
        <p className='font-semibold mb-2'>{listo ? '✅ Todo configurado: el bot está activo' : '⏳ Falta conectar WhatsApp con Meta'}</p>
        <ul className='space-y-1 text-sm'>
          {Object.entries(NOMBRES_VAR).map(([k, l]) => <li key={k}>{vars[k] ? '✅' : '⬜'} {l}</li>)}
        </ul>
      </div>
      <div className='card text-sm text-gray-600 space-y-1'>
        <p><b>Webhook para Meta:</b> https://mrchester-produccion.vercel.app/api/whatsapp</p>
        <p>Se configura cuando el portafolio de Meta esté desbloqueado. Claude te guía paso a paso.</p>
      </div>
    </div>
  )
}
