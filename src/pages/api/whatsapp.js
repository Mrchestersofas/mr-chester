// Archivo: src/pages/api/whatsapp.js
// Webhook de la API oficial de WhatsApp (Cloud API).
// GET  → verificación de Meta (hub.challenge).
// POST → mensajes entrantes: el bot decide la respuesta (src/lib/whatsappBot.js) y la envía.
// Variables de entorno en Vercel: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN,
// WHATSAPP_APP_SECRET y SUPABASE_SERVICE_ROLE_KEY. Si falta alguna, el webhook no responde nada.
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { responder, asesorRespondio, enviarWhatsApp, textoDe, soloNum } from '@/lib/whatsappBot'

export const config = { api: { bodyParser: false } }

function leerCuerpo(req) {
  return new Promise((ok, mal) => { const partes = []; req.on('data', c => partes.push(c)); req.on('end', () => ok(Buffer.concat(partes))); req.on('error', mal) })
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { 'hub.mode': modo, 'hub.verify_token': token, 'hub.challenge': reto } = req.query
    if (modo === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) return res.status(200).send(reto)
    return res.status(403).end()
  }
  if (req.method !== 'POST') return res.status(405).end()

  const crudo = await leerCuerpo(req)
  // Solo aceptamos lo que viene firmado por Meta
  const secreto = process.env.WHATSAPP_APP_SECRET
  const firma = String(req.headers['x-hub-signature-256'] || '')
  const esperada = 'sha256=' + crypto.createHmac('sha256', secreto || '').update(crudo).digest('hex')
  if (!secreto || firma.length !== esperada.length || !crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return res.status(401).end()

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.WHATSAPP_TOKEN) return res.status(200).json({ ok: false, error: 'Falta configuración' })
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  let cuerpo
  try { cuerpo = JSON.parse(crudo.toString('utf8')) } catch { return res.status(200).end() }

  for (const entry of cuerpo.entry || []) {
    for (const ch of entry.changes || []) {
      const v = ch.value || {}

      // Mensajes que un asesor mandó desde la app del celular (coexistencia): se guardan y el bot se calla
      if (ch.field === 'smb_message_echoes') {
        for (const m of v.message_echoes || []) {
          await db.from('wa_mensajes').upsert({ wa_id: m.id, telefono: soloNum(m.to), direccion: 'asesor', texto: m.text?.body || `[${m.type}]` }, { onConflict: 'wa_id', ignoreDuplicates: true })
          await asesorRespondio(db, m.to)
        }
        continue
      }

      const nombres = Object.fromEntries((v.contacts || []).map(c => [c.wa_id, c.profile?.name]))
      for (const m of v.messages || []) {
        // Meta a veces reenvía el mismo mensaje: si ya lo tenemos, no respondemos dos veces
        const { data: ya } = await db.from('wa_mensajes').select('id').eq('wa_id', m.id).maybeSingle()
        if (ya) continue
        const boton = m.interactive?.button_reply?.id || m.interactive?.list_reply?.id || m.button?.payload || null
        const txt = m.text?.body || m.interactive?.button_reply?.title || m.button?.text || (m.type !== 'text' ? `[${m.type}]` : '')
        await db.from('wa_mensajes').insert({ wa_id: m.id, telefono: soloNum(m.from), nombre: nombres[m.from] || null, direccion: 'entrante', texto: txt })
        try { await registrarLead(db, m, nombres[m.from], txt) } catch (e) { console.error('Lead WhatsApp:', e) }

        try {
          const respuestas = await responder(db, { telefono: m.from, nombre: nombres[m.from], texto: m.text?.body || '', boton })
          for (const r of respuestas) {
            const id = await enviarWhatsApp(m.from, r)
            await db.from('wa_mensajes').insert({ wa_id: id, telefono: soloNum(m.from), direccion: 'bot', texto: textoDe(r) })
          }
        } catch (e) {
          console.error('Bot WhatsApp:', e)
          await db.from('wa_mensajes').insert({ telefono: soloNum(m.from), direccion: 'error', texto: String(e.message || e) })
        }
      }
    }
  }
  res.status(200).json({ ok: true })
}

// Cada número nuevo que escribe queda como lead en el CRM (si no es cliente ni prospecto ya).
// Si llegó desde un anuncio de Meta (click-to-WhatsApp), queda con canal "pauta" y el anuncio en la nota.
async function registrarLead(db, m, nombre, txt) {
  const tel = soloNum(m.from), ult = tel.slice(-10)
  const { data: p } = await db.from('crm_prospectos').select('id').ilike('telefono', `%${ult}`).limit(1)
  if (p && p.length) return
  const { data: c } = await db.from('clientes').select('id').ilike('telefono', `%${ult}`).limit(1)
  if (c && c.length) return
  const ref = m.referral || null
  const anuncio = ref ? (ref.headline || ref.body || ref.source_url || 'anuncio') : null
  const { data: nuevo } = await db.from('crm_prospectos').insert({
    nombre: nombre || `WhatsApp ${ult}`, telefono: ult, canal: ref ? 'pauta' : 'whatsapp',
    interes: anuncio ? String(anuncio).slice(0, 120) : null, notas: String(txt || '').slice(0, 300) || null,
    proximo_seguimiento: new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10),
  }).select('id').single()
  if (nuevo) await db.from('crm_actividades').insert({ prospecto_id: nuevo.id, tipo: 'nota', texto: ref ? `Llegó por un anuncio: ${anuncio}` : 'Escribió por WhatsApp (automático)' })
}
