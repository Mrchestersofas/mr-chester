// Archivo: src/pages/api/push.js
// Lo llama la base de datos (Supabase) cuando alguien del taller termina una sección.
// Manda la notificación a los celulares que activaron los avisos en el ERP.
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { VAPID_PUBLICA } from '@/lib/push'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const secreto = process.env.PUSH_SECRET
  if (!secreto || req.headers['x-push-secret'] !== secreto) return res.status(401).json({ ok: false })
  if (!process.env.VAPID_PRIVATE_KEY) return res.status(500).json({ ok: false, error: 'Falta VAPID_PRIVATE_KEY en Vercel' })
  webpush.setVapidDetails('mailto:mrchestercolombia@gmail.com', VAPID_PUBLICA, process.env.VAPID_PRIVATE_KEY)

  const { titulo, cuerpo, url, tag, subs = [] } = req.body || {}
  const datos = JSON.stringify({ titulo, cuerpo, url: url || '/', tag })
  const vencidas = []
  let enviadas = 0
  await Promise.all(subs.map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, datos, { TTL: 3600 })
      enviadas++
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) vencidas.push(s.endpoint) // el celular quitó el permiso o se desinstaló
    }
  }))
  if (vencidas.length) await supabase.rpc('push_quitar', { p_secreto: secreto, p_endpoints: vencidas })
  res.status(200).json({ ok: true, enviadas, vencidas: vencidas.length })
}
