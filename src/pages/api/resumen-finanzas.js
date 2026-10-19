// Archivo: src/pages/api/resumen-finanzas.js
// Cron: todos los días a las 9 a. m. Colombia (14:00 UTC). Correo a Mónica (finanzas) con
// las compras programadas de hoy y lo que se pidió ayer. Los lunes manda además el resumen de la semana.
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM || 'Mr. Chester Sofás <pedidos@envios.mrchester.com.co>'
const PARA = ['bensour81@hotmail.com']

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const pesos = n => '$' + Math.round(Number(n || 0)).toLocaleString('es-CO')
const num = n => Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 2 })
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
function hoyISO() { return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10) }
function sumar(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
function diaDe(iso) { return new Date(iso + 'T12:00:00Z').getUTCDay() }
function fechaTexto(iso) { const d = new Date(iso + 'T12:00:00Z'); return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}` }
function fechaCorta(iso) { const d = new Date(iso + 'T12:00:00Z'); return `${d.getUTCDate()} ${MESES[d.getUTCMonth()].slice(0, 3)}` }
function totalProv(p) { return (p.insumos || []).reduce((s, i) => s + Number(i.precio) * Number(i.cantidad), 0) + Number(p.costo_fijo || 0) }

const td = 'padding:9px 14px;font-size:13px;border-top:1px solid #f0ebe0;'
const titulo = t => `<p style="margin:0 0 10px;color:#1a1a1a;font-size:11px;letter-spacing:2px;font-weight:700;border-bottom:2px solid #C9A84C;padding-bottom:8px;">${t}</p>`
const totalBox = (t, v) => `<table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:8px;margin:6px 0 26px;"><tr>
  <td style="padding:14px 18px;color:#C9A84C;font-size:12px;letter-spacing:1px;font-weight:700;">${t}</td>
  <td style="padding:14px 18px;color:#fff;font-size:20px;font-weight:700;text-align:right;">${v}</td></tr></table>`

function plantilla(franja, cuerpo) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f1eb;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1eb;padding:30px 14px;"><tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;">
  <tr><td style="background:#1a1a1a;padding:26px 30px 20px;text-align:center;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;color:#C9A84C;font-size:24px;font-weight:700;letter-spacing:4px;font-family:Georgia,serif;">MR. CHESTER</h1>
  </td></tr>
  <tr><td style="background:#C9A84C;padding:10px 30px;text-align:center;">
    <p style="margin:0;color:#1a1a1a;font-size:11px;letter-spacing:2px;font-weight:700;">${franja}</p>
  </td></tr>
  <tr><td style="background:#fff;padding:30px;">${cuerpo}</td></tr>
  <tr><td style="background:#111;padding:16px 30px;text-align:center;border-radius:0 0 8px 8px;">
    <p style="margin:0;color:#888;font-size:11px;">Resumen automático de compras · ERP Mr. Chester</p>
  </td></tr>
</table></td></tr></table></body></html>`
}

function tablaPedidos(lista) {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px;">${lista.map(x => `
    <tr><td style="${td}"><b>${esc(x.proveedor_nombre)}</b><br><span style="color:#888;font-size:12px;">${(x.items || []).map(i => `${num(i.cantidad)} ${esc(i.nombre)}`).join(' · ')}</span></td>
    <td style="${td}text-align:right;font-weight:700;white-space:nowrap;vertical-align:top;">${pesos(x.total)}</td></tr>`).join('')}</table>`
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end()
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).end()

  const hoy = hoyISO()
  const ayer = sumar(hoy, -1)
  const esLunes = diaDe(hoy) === 1
  const desdeSemana = sumar(hoy, -7)

  const [{ data: provsRaw }, { data: hechos }] = await Promise.all([
    supabase.from('compra_proveedores').select('*, insumos:compra_insumos(*)').eq('activo', true).order('orden'),
    supabase.from('compra_pedidos').select('*').gte('fecha', esLunes ? desdeSemana : ayer).lte('fecha', hoy).order('fecha').order('created_at'),
  ])
  const provs = (provsRaw || []).map(p => ({ ...p, insumos: (p.insumos || []).filter(i => i.activo) }))
  const programados = f => provs.filter(p => (p.dias || []).includes(diaDe(f)))

  // ---------- Correo diario ----------
  const hoyProg = programados(hoy)
  const ayerReal = (hechos || []).filter(x => x.fecha === ayer)
  const ayerProg = programados(ayer)
  const totalAyerReal = ayerReal.reduce((s, x) => s + Number(x.total), 0)
  const totalHoy = hoyProg.reduce((s, p) => s + totalProv(p), 0)
  const sinPedir = ayerProg.filter(p => !ayerReal.some(x => x.proveedor_id === p.id))

  const cuerpoDia =
    titulo(`🛒 COMPRAS PROGRAMADAS PARA HOY · ${fechaTexto(hoy).toUpperCase()}`) +
    (hoyProg.length
      ? `<table width="100%" cellpadding="0" cellspacing="0">${hoyProg.map(p => `<tr><td style="${td}">${esc(p.nombre)}</td><td style="${td}text-align:right;">${pesos(totalProv(p))}</td></tr>`).join('')}</table>` + totalBox('A PAGAR HOY (APROX.)', pesos(totalHoy))
      : `<p style="color:#16a34a;font-size:14px;margin:0 0 26px;">No hay compras programadas hoy.</p>`) +
    titulo(`✅ LO QUE SE PIDIÓ AYER · ${fechaTexto(ayer).toUpperCase()}`) +
    (ayerReal.length ? tablaPedidos(ayerReal) + totalBox('TOTAL AYER', pesos(totalAyerReal)) : `<p style="color:#888;font-size:14px;margin:0 0 20px;">No se registraron pedidos ayer.</p>`) +
    (sinPedir.length ? `<p style="background:#fff7ed;border-left:3px solid #d97706;padding:12px 16px;font-size:13px;color:#92400e;margin:0;">Programado ayer y no registrado: ${sinPedir.map(p => esc(p.nombre)).join(', ')}</p>` : '')

  const envios = [resend.emails.send({
    from: FROM, to: PARA,
    subject: `💰 Compras del día · ${fechaTexto(hoy)}${hoyProg.length ? ' · ' + pesos(totalHoy) : ''}`,
    html: plantilla(`RESUMEN DIARIO DE COMPRAS · ${fechaTexto(hoy).toUpperCase()}`, cuerpoDia),
  })]

  // ---------- Correo semanal (lunes) ----------
  if (esLunes) {
    const semana = (hechos || []).filter(x => x.fecha >= desdeSemana && x.fecha < hoy)
    const totalSemana = semana.reduce((s, x) => s + Number(x.total), 0)
    const porProv = {}
    semana.forEach(x => { porProv[x.proveedor_nombre] = (porProv[x.proveedor_nombre] || 0) + Number(x.total) })
    let progSemana = 0
    for (let k = 0; k < 7; k++) progSemana += programados(sumar(desdeSemana, k)).reduce((s, p) => s + totalProv(p), 0)
    let progNueva = 0
    for (let k = 0; k < 7; k++) progNueva += programados(sumar(hoy, k)).reduce((s, p) => s + totalProv(p), 0)

    const dias = [...new Set(semana.map(x => x.fecha))]
    const cuerpoSemana =
      titulo(`📊 SEMANA DEL ${fechaCorta(desdeSemana).toUpperCase()} AL ${fechaCorta(sumar(hoy, -1)).toUpperCase()}`) +
      totalBox('TOTAL COMPRADO', pesos(totalSemana)) +
      `<p style="margin:-14px 0 24px;color:#888;font-size:12px;">Programado: ${pesos(progSemana)} · Diferencia: ${totalSemana - progSemana < 0 ? '−' : '+'}${pesos(Math.abs(totalSemana - progSemana))}</p>` +
      titulo('POR PROVEEDOR') +
      (Object.keys(porProv).length
        ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">${Object.entries(porProv).sort((a, b) => b[1] - a[1]).map(([n, t]) => `<tr><td style="${td}">${esc(n)}</td><td style="${td}text-align:right;font-weight:700;">${pesos(t)}</td></tr>`).join('')}</table>`
        : `<p style="color:#888;font-size:14px;margin:0 0 24px;">No se registraron pedidos la semana pasada.</p>`) +
      (dias.length ? titulo('POR DÍA') + dias.map(f => {
        const del = semana.filter(x => x.fecha === f)
        return `<p style="margin:14px 0 4px;font-size:13px;font-weight:700;">${fechaTexto(f).charAt(0).toUpperCase() + fechaTexto(f).slice(1)} · ${pesos(del.reduce((s, x) => s + Number(x.total), 0))}</p>` + tablaPedidos(del)
      }).join('') + '<div style="height:20px"></div>' : '') +
      titulo('📅 ESTA SEMANA (PROGRAMADO)') + totalBox('COMPRAS PREVISTAS', pesos(progNueva))

    envios.push(resend.emails.send({
      from: FROM, to: PARA,
      subject: `📊 Resumen semanal de compras · ${pesos(totalSemana)}`,
      html: plantilla('RESUMEN SEMANAL DE COMPRAS', cuerpoSemana),
    }))
  }

  const r = await Promise.all(envios)
  const err = r.find(x => x.error)?.error
  res.status(err ? 500 : 200).json({ ok: !err, semanal: esLunes, error: err?.message })
}
