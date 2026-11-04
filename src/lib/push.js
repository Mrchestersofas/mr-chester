// Clave pública para las notificaciones del ERP (la privada está en Vercel: VAPID_PRIVATE_KEY)
export const VAPID_PUBLICA = 'BPytNnnr0u_RFy49FOPQ-8f36-HIrCP-qIruPwbgLz5UAgyS0ffeuC3crrTfNROkpC17j8RZ_fRmErVVJUxLXJ0'

function aBytes(base64) {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4)
  const b = atob((base64 + relleno).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...b].map(c => c.charCodeAt(0)))
}
export const pushSoportado = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
export const esIphone = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)
export const esApp = () => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true)

export async function suscripcionActual() {
  if (!pushSoportado()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return reg ? reg.pushManager.getSubscription() : null
}

export async function activarPush() {
  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') throw new Error('No diste permiso para notificaciones. Actívalo en Ajustes → Notificaciones → Mr. Chester.')
  let reg = await navigator.serviceWorker.getRegistration()
  if (!reg) reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(VAPID_PUBLICA) })
  return sub.toJSON()
}
