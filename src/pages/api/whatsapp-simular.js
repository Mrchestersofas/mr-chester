// Archivo: src/pages/api/whatsapp-simular.js
// Simulador del bot de WhatsApp para probar desde el ERP sin enviar nada.
// Solo para usuarios con sesión del ERP. También informa qué variables de WhatsApp faltan en Vercel.
import { createClient } from '@supabase/supabase-js'
import { responder, textoDe } from '@/lib/whatsappBot'

const PERMITIDOS = ['josephtoledo@gmail.com', 'monica@envios.mrchester.com.co']
const VARIABLES = ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_APP_SECRET', 'SUPABASE_SERVICE_ROLE_KEY']

export default async function handler(req, res) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Sin sesión' })
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false },
  })
  const { data: u } = await db.auth.getUser(token)
  if (!u?.user || !PERMITIDOS.includes(u.user.email)) return res.status(403).json({ error: 'Sin permiso' })

  if (req.method === 'GET') return res.status(200).json({ variables: Object.fromEntries(VARIABLES.map(v => [v, !!process.env[v]])) })
  if (req.method !== 'POST') return res.status(405).end()

  const { telefono, texto, boton, nombre, reiniciar } = req.body || {}
  if (reiniciar) { await db.from('wa_estado').delete().eq('telefono', 'sim:' + String(telefono || '').replace(/\D/g, '')); return res.status(200).json({ ok: true }) }
  try {
    const mensajes = await responder(db, { telefono, texto, boton, nombre }, { simular: true })
    res.status(200).json({ mensajes, textos: mensajes.map(textoDe) })
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) })
  }
}
