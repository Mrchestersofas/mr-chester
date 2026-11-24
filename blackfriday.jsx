import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/* Página pública de Black Friday (mrchester-produccion.vercel.app/blackfriday).
   El cliente escoge modelo, tamaño y color, y si quiere que le escriban por WhatsApp o agendar visita a la tienda.
   Queda guardado como lead en el CRM (función registrar_lead) y se abre el WhatsApp de ventas con el mensaje listo.
   Cada canal usa su link: ?c=ig, ?c=tiktok, ?c=google, ?c=samper. Fotos en /public/blackfriday. */

const WA = '573158825393'
const IMG = f => `/blackfriday/${f}.jpg`
const M = [
  { id: 'cheers', n: 'Cheers', fotos: ['clasico-sala', 'clasico-frente', 'clasico-lado'] },
  { id: 'manchester', n: 'Manchester', fotos: ['lino-sala', 'lino-frente', 'lino-lado'] },
  { id: 'picadilly', n: 'Picadilly', fotos: ['capitone-sala', 'capitone-lado'] },
  { id: 'bentley', n: 'Bentley', fotos: ['recto-sala', 'recto-lado'] },
  { id: 'charles', n: 'Charles', fotos: ['azul-sala', 'azul-frente'] },
]
const T = [['1.80', 4590000, 1836000], ['2.00', 4990000, 1996000], ['2.20', 5590000, 2236000]]
const C = [['gti-azul-oscuro', 'Azul oscuro'], ['gti-cafe', 'Café'], ['gti-beige', 'Beige'], ['gti-azul-celestial', 'Azul celestial'], ['gti-gris-azul', 'Gris azul'], ['gti-crema', 'Crema'], ['gti-camel', 'Camel'], ['gti-gris-medio', 'Gris medio'], ['gti-gris-claro', 'Gris claro'], ['gti-miel', 'Miel'], ['gti-vinotinto', 'Vinotinto'], ['gti-ocre', 'Ocre'], ['gti-negro', 'Negro'], ['gti-taupe', 'Taupe'], ['gti-verde-esmeralda', 'Verde esmeralda'], ['nb-cafe', 'Café'], ['nb-camel', 'Camel']]
const colName = i => i < 0 ? '' : (C[i][0].startsWith('nb') ? 'Assia Novo Bic ' : 'Assia GTI ') + C[i][1].toLowerCase()
const fmt = n => '$' + n.toLocaleString('es-CO')
const DN = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'], MN = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
// Festivos de Colombia (horario de domingo)
const FEST = ['2026-12-08', '2026-12-25', '2027-01-01', '2027-01-11', '2027-03-22', '2027-03-25', '2027-03-26', '2027-05-01', '2027-05-10', '2027-05-31', '2027-06-07']
const CUPO = 2
// fecha y hora de Bogotá (UTC-5) sin depender del reloj del celular
const bog = () => new Date(Date.now() - 5 * 3600 * 1000)
const isoDia = d => d.toISOString().slice(0, 10)
function dias() { const b = bog(), r = []; for (let k = 0; k < 8; k++) { const d = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() + k)); r.push(d) } return r }
const esDomingo = d => d.getUTCDay() === 0 || FEST.includes(isoDia(d))
function slots(d) { const [a, b] = esDomingo(d) ? [12, 16] : [11, 18], out = []; for (let m = a * 60; m < b * 60; m += 30) out.push(m); return out }
const hTxt = m => { const h = Math.floor(m / 60), mm = m % 60; return `${h > 12 ? h - 12 : h}:${String(mm).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}` }
const citaISO = (d, m) => `${isoDia(d)}T${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00-05:00`

export default function BlackFriday() {
  const { query } = useRouter()
  const fuente = String(query.c || 'web').toLowerCase()
  const [sel, setSel] = useState(0)
  const [tz, setTz] = useState(1)
  const [col, setCol] = useState(-1)
  const [foto, setFoto] = useState({})
  const [modo, setModo] = useState('wa')
  const [dSel, setDSel] = useState(0)
  const [hSel, setHSel] = useState(null)
  const [ocup, setOcup] = useState({})
  const [nombre, setNombre] = useState('')
  const [cel, setCel] = useState('')
  const [msg, setMsg] = useState('')
  const [enviando, setEnviando] = useState(false)
  const D = dias()

  useEffect(() => {
    if (modo !== 'tienda') return
    const ini = new Date(Date.now() - 3600 * 1000).toISOString(), fin = new Date(Date.now() + 9 * 86400 * 1000).toISOString()
    supabase.rpc('citas_ocupadas', { p_desde: ini, p_hasta: fin }).then(({ data }) => {
      const o = {}; (data || []).forEach(r => { o[new Date(r.cita).getTime()] = r.n }); setOcup(o)
    })
  }, [modo])

  const m = M[sel], t = T[tz]
  const ir = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  const citaTxt = () => { const d = D[dSel]; return `${dSel === 0 ? 'hoy' : dSel === 1 ? 'mañana' : DN[d.getUTCDay()]} ${d.getUTCDate()} de ${MN[d.getUTCMonth()]} a las ${hTxt(hSel)}` }
  const ahoraMin = () => { const b = bog(); return b.getUTCHours() * 60 + b.getUTCMinutes() }

  async function enviar(e) {
    e.preventDefault()
    const tel = cel.replace(/\D/g, '')
    if (nombre.trim().length < 2) { setMsg('Escribe tu nombre'); return }
    if (tel.length < 10) { setMsg('Escribe tu celular completo (10 dígitos)'); return }
    if (modo === 'tienda' && hSel === null) { setMsg('Escoge la hora de tu visita'); return }
    setEnviando(true); setMsg('')
    const sofa = `el ${m.n} de ${t[0]} m (${fmt(t[2])})${col >= 0 ? ' en ' + colName(col) : ''}`
    const n1 = nombre.trim().split(' ')[0]
    const texto = modo === 'tienda'
      ? `Hola Mr. Chester! Soy ${n1}. Agendé visita a la tienda ${citaTxt()} para ver ${sofa} con 60% de Black Friday.`
      : `Hola Mr. Chester! Soy ${n1}. Quiero ${sofa} con 60% de Black Friday.`
    try {
      const { error } = await supabase.rpc('registrar_lead', {
        p_nombre: nombre.trim(), p_telefono: tel, p_interes: `${m.n} ${t[0]} m`, p_fuente: fuente,
        p_color: col >= 0 ? colName(col) : null, p_cita: modo === 'tienda' ? citaISO(D[dSel], hSel) : null,
      })
      if (error && /cita_llena/.test(error.message)) { setMsg('Esa hora se acaba de llenar. Escoge otra, por favor.'); setHSel(null); setEnviando(false); return }
    } catch (er) {}
    window.location.href = `https://wa.me/${WA}?text=${encodeURIComponent(texto)}`
  }

  return (
    <div className='bfpage'>
      <Head>
        <title>Black Friday Mr. Chester · 60% en sofás Chesterfield</title>
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <meta name='description' content='Sofás Chesterfield hechos a mano en Bogotá con 60% de descuento. Desde $1.836.000.' />
        <meta property='og:title' content='Black Friday Mr. Chester · 60% de descuento' />
        <meta property='og:image' content='https://mrchester-produccion.vercel.app/blackfriday/clasico-sala.jpg' />
        <link rel='preconnect' href='https://fonts.googleapis.com' />
        <link href='https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Montserrat:wght@500;700;800;900&display=swap' rel='stylesheet' />
      </Head>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <header className='hero2'>
        <img className='logo' src='/blackfriday/logo-oro.png' alt='Mr. Chester' />
        <div className='neon'><span className='b'>Black</span><span className='f'>Friday</span></div>
        <div className='big60'><b>60<i>%</i></b><span>DE DESCUENTO</span></div>
        <p className='claim'>Sofás Chesterfield hechos a mano en Bogotá, con el descuento más grande del año.</p>
        <div className='heroimg'><img src={IMG('clasico-sala')} alt='Sofá Cheers de cuero vegano café en una sala con luz cálida' /><span className='badge big'>-60%</span></div>
        <div className='prices'>
          <div><small>SOFÁ DE 2 METROS · ANTES</small><div className='old'>$4.990.000</div></div>
          <div className='sep' />
          <div><span className='tag'>PRECIO BLACK FRIDAY</span><div className='new'>$1.996.000</div></div>
        </div>
        <p className='desde'>Desde $1.836.000 en 1.80 m</p>
        <a className='cta' href='#aparta' onClick={e => { e.preventDefault(); ir('aparta') }}>Aparta tu precio</a>
      </header>

      <section className='sec' id='modelos'>
        <h2>Escoge tu Chester</h2>
        <p className='sub'>Todos con 60% de descuento. Escoge el tamaño y toca las fotos para verlos de frente y en sala.</p>
        <div className='sizes' role='radiogroup' aria-label='Tamaño'>
          {T.map((x, i) => <button key={x[0]} className={`sz ${i === tz ? 'on' : ''}`} role='radio' aria-checked={i === tz} onClick={() => setTz(i)}>{x[0]} m</button>)}
        </div>
        <div className='tabla'>
          {T.map((x, i) => <div key={x[0]} className={i === tz ? 'on' : ''}><small>{x[0]} metros</small><s>{fmt(x[1])}</s><b>{fmt(x[2])}</b></div>)}
        </div>
        <div className='grid'>
          {M.map((x, i) => {
            const f = foto[x.id] || x.fotos[0]
            return (
              <article key={x.id} className='m'>
                <div className={`ph ${f.includes('sala') ? '' : 'prod'}`}><img src={IMG(f)} alt={`Sofá ${x.n}`} loading='lazy' /><span className='badge'>-60%</span></div>
                <div className='ths'>{x.fotos.map((y, j) => <button key={y} className={`th ${y === f ? 'on' : ''}`} aria-label={`Ver foto ${j + 1}`} onClick={() => setFoto({ ...foto, [x.id]: y })}><img src={IMG(y)} alt='' /></button>)}</div>
                <div className='tx'>
                  <h3>{x.n}</h3><div className='mat'>{t[0]} metros</div>
                  <div className='pr'><s>{fmt(t[1])}</s><b>{fmt(t[2])}</b></div>
                  <button className={`pick ${i === sel ? 'on' : ''}`} onClick={() => { setSel(i); ir('aparta') }}>{i === sel ? '✓ Este quiero' : 'Lo quiero'}</button>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className='sec' id='colores' style={{ paddingTop: 0 }}>
        <h2>Escoge tu color</h2>
        <p className='sub'>Cuero vegano en 17 colores. Toca el que te guste y queda en tu pedido.</p>
        {[['Assia GTI', 0, 15], ['Assia Novo Bic', 15, 17]].map(([g, a, b]) => (
          <div className='cg' key={g}><h3 className='ct'>{g}</h3>
            <div className='sws'>{C.slice(a, b).map((c, k) => { const i = a + k; return <button key={c[0]} className={`swb ${i === col ? 'on' : ''}`} aria-pressed={i === col} onClick={() => setCol(i)}><img src={`/blackfriday/col/${c[0]}.jpg`} alt='' />{c[1]}</button> })}</div>
          </div>
        ))}
        <p className='chosen'>{col < 0 ? 'Ningún color escogido todavía' : '✓ Escogiste ' + colName(col)}</p>
      </section>

      <section className='why'><div className='sec'>
        <h2>¿Por qué Mr. Chester?</h2>
        <p className='sub'>No es un sofá de catálogo: se hace para ti, en nuestra fábrica.</p>
        <div className='wg'>
          <div className='w'><b>Hecho a mano en Bogotá</b><span>Estructura en madera, espuma y tapizado hechos por nuestros artesanos.</span></div>
          <div className='w'><b>Capitoné y taches</b><span>Cada botón y cada tache se pone a mano, como el Chesterfield inglés original.</span></div>
          <div className='w'><b>Tu tela y tu color</b><span>Cuero vegano, lino o terciopelo, en el color que quieras.</span></div>
          <div className='w'><b>Ven a verlo</b><span>Tienda Mr. Chester, Cra 19A #85-69, Bogotá. Lunes a sábado 11 a. m. a 6 p. m., domingos 12 a 4 p. m.</span></div>
        </div>
      </div></section>

      <section className='sec' id='aparta'>
        <div className='form'>
          <h2>Aparta tu precio</h2>
          <p className='sub' style={{ marginBottom: 10 }}>Escoge cómo quieres comprar.</p>
          <div className='modo'>
            <button type='button' className={`mb ${modo === 'wa' ? 'on' : ''}`} onClick={() => setModo('wa')}>💬<b>Que me escriban</b><span>Por WhatsApp</span></button>
            <button type='button' className={`mb ${modo === 'tienda' ? 'on' : ''}`} onClick={() => setModo('tienda')}>🏬<b>Visitar la tienda</b><span>Agenda tu cita</span></button>
          </div>
          <div className='sel'><img src={IMG(m.fotos[0])} alt='' /><div><b>{m.n}</b><span>{fmt(t[2])} · {t[0]} m</span>
            {col >= 0 && <small style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 13 }}><img src={`/blackfriday/col/${C[col][0]}.jpg`} alt='' style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />{C[col][1]}</small>}</div></div>
          <form onSubmit={enviar}>
            <label>Modelo<select value={sel} onChange={e => setSel(+e.target.value)}>{M.map((x, i) => <option key={x.id} value={i}>{x.n}</option>)}</select></label>
            <label>Tamaño<select value={tz} onChange={e => setTz(+e.target.value)}>{T.map((x, i) => <option key={x[0]} value={i}>{x[0]} metros · {fmt(x[2])}</option>)}</select></label>
            <label>Color<select value={col} onChange={e => setCol(+e.target.value)}><option value={-1}>Lo defino por WhatsApp</option>{C.map((c, i) => <option key={c[0]} value={i}>{colName(i).replace(/^./, z => z.toUpperCase())}</option>)}</select></label>
            {modo === 'tienda' && (
              <div>
                <label>Día de tu visita</label>
                <div className='dias'>{D.map((d, i) => <button type='button' key={i} className={`dia ${i === dSel ? 'on' : ''}`} onClick={() => { setDSel(i); setHSel(null) }}><small>{i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : DN[d.getUTCDay()]}</small>{d.getUTCDate()} {MN[d.getUTCMonth()]}</button>)}</div>
                <label>Hora</label>
                <div className='horas'>{slots(D[dSel]).map(h => {
                  const lleno = (ocup[new Date(citaISO(D[dSel], h)).getTime()] || 0) >= CUPO
                  const pasado = dSel === 0 && h < ahoraMin() + 60
                  return <button type='button' key={h} className={`hr2 ${h === hSel ? 'on' : ''}`} disabled={lleno || pasado} onClick={() => setHSel(h)}>{hTxt(h)}</button>
                })}</div>
                <p className='dir'>📍 Tienda Mr. Chester · Cra 19A #85-69, Bogotá · <a href='https://www.google.com/maps/search/?api=1&query=Cra+19A+%2385-69+Bogot%C3%A1' target='_blank' rel='noopener noreferrer'>Ver en Google Maps</a></p>
              </div>
            )}
            <label>Tu nombre<input value={nombre} onChange={e => setNombre(e.target.value)} autoComplete='name' placeholder='Ej: Laura Gómez' /></label>
            <label>Tu celular<input value={cel} onChange={e => setCel(e.target.value)} inputMode='tel' autoComplete='tel' placeholder='Ej: 300 123 4567' /></label>
            {msg && <p style={{ color: '#ff8a8a', fontSize: 14, margin: '10px 0 0' }}>{msg}</p>}
            <button className='wa' disabled={enviando}>{enviando ? 'Abriendo WhatsApp…' : modo === 'tienda' ? '📅 Agendar mi visita' : '🟢 Quiero mi sofá'}</button>
            <p className='note'>Precios de Black Friday con 60% de descuento sobre el precio regular.</p>
          </form>
        </div>
      </section>

      <footer><img src='/blackfriday/logo-oro.png' alt='Mr. Chester' />Sofás que hablan de ti · Cra 19A #85-69, Bogotá</footer>
    </div>
  )
}

BlackFriday.sinLayout = true

const CSS = `

:root{--bg:#0e0a08;--bg2:#17110d;--card:#1d1611;--gold:#C9A84C;--gold2:#e6c873;--red:#ff2d3d;--ink:#f6efe6;--mut:#b8a998;--line:#3a2d22;color-scheme:dark}
*{box-sizing:border-box;min-width:0}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 Montserrat,system-ui,sans-serif;overflow-x:clip}
img{display:block;max-width:100%}
.top{display:flex;justify-content:center;padding:16px 16px 8px;position:absolute;inset:0 0 auto;z-index:3}
.top img{height:clamp(46px,7vw,64px);width:auto}
.hero{position:relative;min-height:min(100vh,860px);display:flex;align-items:flex-end;overflow:hidden}
.hero>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 60%}
.hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(14,10,8,.85) 0%,rgba(14,10,8,.25) 30%,rgba(14,10,8,.35) 55%,rgba(14,10,8,.97) 88%)}
.hin{position:relative;z-index:2;width:100%;max-width:1100px;margin:0 auto;padding:120px 18px 34px;text-align:center}
.neon{display:inline-block;font-weight:900;font-style:italic;line-height:.9;text-transform:uppercase;letter-spacing:-.02em}
.neon .b{display:block;color:#fff;font-size:clamp(46px,10vw,104px);text-shadow:0 4px 30px rgba(0,0,0,.6)}
.neon .f{display:inline-block;margin-top:6px;font-size:clamp(50px,11vw,116px);color:transparent;-webkit-text-stroke:2px #ffd9dc;text-shadow:0 0 10px var(--red),0 0 30px var(--red),0 0 60px rgba(255,45,61,.6);border:3px solid var(--red);box-shadow:0 0 18px var(--red),inset 0 0 18px rgba(255,45,61,.5);padding:2px 18px 8px;transform:skewX(-8deg) rotate(-3deg);border-radius:6px}
.claim{font-size:clamp(17px,2.4vw,22px);font-weight:700;margin:22px auto 0;max-width:30em}
.prices{display:flex;justify-content:center;align-items:center;gap:clamp(14px,4vw,36px);margin:22px auto 0;flex-wrap:wrap}
.prices small{display:block;font-size:13px;letter-spacing:.06em;color:var(--mut);font-weight:700}
.old{font-size:clamp(22px,3.5vw,30px);font-weight:700;color:#d8cfc4;text-decoration:line-through;text-decoration-color:var(--red);text-decoration-thickness:3px;white-space:nowrap}
.new{font-size:clamp(40px,8vw,68px);font-weight:900;line-height:1;white-space:nowrap}
.tag{display:inline-block;background:var(--red);color:#fff;border-radius:999px;padding:3px 12px;font-size:13px;font-weight:800;margin-bottom:6px}
.sep{width:1px;height:70px;background:var(--line)}
@media(max-width:520px){.sep{display:none}}
.pct{display:inline-flex;align-items:center;gap:10px;margin-top:22px;border:2px solid var(--red);border-radius:16px;padding:8px 20px;box-shadow:0 0 22px rgba(255,45,61,.55);font-weight:800;font-size:clamp(16px,2.4vw,20px)}
.pct b{font-size:clamp(30px,5vw,44px);font-weight:900;font-style:italic}
.cta{display:inline-flex;justify-content:center;align-items:center;min-height:56px;margin-top:24px;padding:0 30px;border-radius:16px;background:var(--gold);color:#1a120b;font-weight:800;font-size:18px;text-decoration:none;border:0;cursor:pointer}
.cta:focus-visible,.pick:focus-visible,.th:focus-visible{outline:3px solid var(--gold2);outline-offset:3px}
.sec{max-width:1160px;margin:0 auto;padding:clamp(40px,6vw,80px) 18px}
h2{font-family:"Cormorant Garamond",serif;font-weight:700;font-size:clamp(34px,5vw,52px);line-height:1.05;margin:0 0 8px;text-align:center;color:var(--gold2)}
.sub{text-align:center;color:var(--mut);margin:0 auto 30px;max-width:36em}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:20px}
.m{background:var(--card);border:1px solid var(--line);border-radius:22px;overflow:hidden;display:flex;flex-direction:column}
.m .ph{position:relative;aspect-ratio:16/9;background:#000}
.m .ph img{width:100%;height:100%;object-fit:cover;transition:opacity .3s}
.m .badge{position:absolute;top:12px;left:12px;background:var(--red);color:#fff;font-weight:800;font-size:13px;border-radius:999px;padding:4px 10px}
.ths{display:flex;gap:8px;padding:10px 14px 0}
.th{width:64px;height:42px;border-radius:8px;overflow:hidden;border:2px solid transparent;padding:0;background:none;cursor:pointer}
.th.on{border-color:var(--gold)}
.th img{width:100%;height:100%;object-fit:cover}
.m .tx{padding:12px 16px 18px;display:flex;flex-direction:column;gap:4px;flex:1}
.m h3{margin:0;font-family:"Cormorant Garamond",serif;font-size:28px;line-height:1.1;color:var(--ink)}
.m .mat{color:var(--mut);font-size:14px}
.m .pr{display:flex;align-items:baseline;gap:10px;margin-top:6px;flex-wrap:wrap}
.m .pr s{color:var(--mut);text-decoration-color:var(--red);text-decoration-thickness:2px}
.m .pr b{font-size:26px;font-weight:900;color:var(--gold2)}
.pick{margin-top:auto;min-height:48px;border-radius:12px;border:1px solid var(--gold);background:transparent;color:var(--gold2);font-weight:800;font-size:16px;cursor:pointer;margin-top:12px}
.pick.on{background:var(--gold);color:#1a120b}
.why{background:var(--bg2)}
.wg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}
@media(max-width:860px){.wg{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:460px){.wg{grid-template-columns:minmax(0,1fr)}}
.w{border-top:2px solid var(--gold);padding-top:14px}
.w b{display:block;font-size:18px;margin-bottom:4px}
.w span{color:var(--mut);font-size:15px}
.sw{display:flex;gap:8px;margin-top:10px}
.sw i{width:34px;height:34px;border-radius:50%;border:2px solid var(--line)}
.form{max-width:520px;margin:0 auto;background:var(--card);border:1px solid var(--gold);border-radius:24px;padding:24px;box-shadow:0 0 0 6px rgba(201,168,76,.08)}
.form h2{font-size:clamp(30px,4.5vw,42px)}
.sel{display:flex;gap:12px;align-items:center;background:#000;border-radius:14px;overflow:hidden;margin:6px 0 14px}
.sel img{width:110px;height:70px;object-fit:cover}
.sel b{display:block;font-family:"Cormorant Garamond",serif;font-size:22px}
.sel span{font-size:14px;color:var(--gold2);font-weight:800}
label{display:block;font-size:13px;color:var(--mut);margin-top:12px;font-weight:700}
input,select{display:block;width:100%;margin-top:5px;min-height:50px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--ink);font:500 16px Montserrat,sans-serif;padding:10px 14px}
.wa{width:100%;min-height:58px;margin-top:18px;border:0;border-radius:16px;background:#25D366;color:#fff;font-weight:800;font-size:18px;cursor:pointer}
.note{font-size:13px;color:var(--mut);text-align:center;margin:12px 0 0}
.ok{display:none;margin-top:14px;background:#133a22;border-radius:12px;padding:12px;font-size:14px}
footer{text-align:center;padding:34px 18px 50px;color:var(--mut);font-size:14px;border-top:1px solid var(--line)}
footer img{height:44px;width:auto;margin:0 auto 10px}

.sizes{display:flex;justify-content:center;gap:10px;margin:0 auto 18px;flex-wrap:wrap}
.sz{min-height:48px;min-width:96px;border-radius:14px;border:1px solid var(--gold);background:transparent;color:var(--gold2);font:800 17px Montserrat,sans-serif;cursor:pointer;padding:0 16px}
.sz.on{background:var(--gold);color:#1a120b}
.sz:focus-visible{outline:3px solid var(--gold2);outline-offset:3px}
.tabla{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));max-width:620px;margin:0 auto 30px;border:1px solid var(--line);border-radius:16px;overflow:hidden;text-align:center}
.tabla div{padding:10px 6px;border-left:1px solid var(--line)}.tabla div:first-child{border-left:0}
.tabla div.on{background:rgba(201,168,76,.12)}
.tabla small{display:block;color:var(--mut);font-size:13px;font-weight:700}
.tabla s{color:var(--mut);font-size:14px;text-decoration-color:var(--red)}
.tabla b{display:block;font-size:clamp(17px,3vw,22px);color:var(--gold2);white-space:nowrap}
.hero2{max-width:1100px;margin:0 auto;padding:22px 16px 40px;text-align:center;background:radial-gradient(800px 400px at 50% 30%,rgba(255,45,61,.12),transparent 70%)}
.hero2 .logo{height:clamp(50px,8vw,70px);width:auto;margin:0 auto 18px}
.heroimg{position:relative;margin:24px auto 0;border-radius:22px;overflow:hidden;box-shadow:0 30px 60px rgba(0,0,0,.6);border:1px solid var(--line)}
.heroimg img{width:100%;height:auto}
.badge.big{position:absolute;top:14px;left:14px;background:var(--red);color:#fff;font-weight:900;font-size:clamp(16px,3vw,22px);border-radius:999px;padding:6px 14px;box-shadow:0 0 18px rgba(255,45,61,.7)}
.desde{color:var(--gold2);font-weight:700;margin:14px 0 0}
.m .ph.prod{background:#fff}
.m .ph.prod img{object-fit:contain;padding:8px}
.cg{max-width:900px;margin:0 auto 20px}
.ct{font-family:"Cormorant Garamond",serif;font-size:24px;color:var(--ink);margin:0 0 10px;text-align:center}
.sws{display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:14px 10px;justify-items:center}
.swb{background:none;border:0;color:var(--ink);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;font:600 13px Montserrat,sans-serif;text-align:center;padding:0}
.swb img{width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid var(--line);transition:transform .2s,border-color .2s}
.swb.on img{border:3px solid var(--gold);transform:scale(1.08);box-shadow:0 0 0 4px rgba(201,168,76,.25)}
.swb:focus-visible img{outline:3px solid var(--gold2);outline-offset:2px}
.chosen{text-align:center;color:var(--gold2);font-weight:700;margin:6px 0 0}
.big60{margin:22px auto 0;line-height:.85}
.big60 b{display:block;font-size:clamp(120px,30vw,230px);font-weight:900;font-style:italic;letter-spacing:-.04em;color:var(--gold2);background:linear-gradient(180deg,#fff2c4 0%,#e6c873 45%,#a8842f 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 6px 24px rgba(201,168,76,.35))}
.big60 b i{font-size:.6em;font-style:italic}
.big60 span{display:inline-block;margin-top:6px;background:var(--red);color:#fff;font-weight:900;font-size:clamp(18px,3.5vw,26px);letter-spacing:.08em;padding:6px 18px;border-radius:10px;box-shadow:0 0 24px rgba(255,45,61,.7)}
.modo{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:4px 0 12px}
.mb{border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:16px;padding:12px 8px;cursor:pointer;font-size:22px;display:flex;flex-direction:column;align-items:center;gap:2px;min-height:96px}
.mb b{font-size:15px}.mb span{font-size:13px;color:var(--mut)}
.mb.on{border:2px solid var(--gold);background:rgba(201,168,76,.12)}
.dias{display:flex;gap:8px;overflow-x:auto;padding:4px 0 6px;scroll-snap-type:x mandatory}
.dia{flex:none;scroll-snap-align:start;min-width:72px;min-height:64px;border-radius:14px;border:1px solid var(--line);background:var(--bg);color:var(--ink);cursor:pointer;font:700 15px Montserrat,sans-serif;line-height:1.2}
.dia small{display:block;font-size:12px;color:var(--mut);font-weight:600;text-transform:capitalize}
.dia.on{background:var(--gold);color:#1a120b;border-color:var(--gold)}.dia.on small{color:#1a120b}
.horas{display:grid;grid-template-columns:repeat(auto-fill,minmax(98px,1fr));gap:8px;margin-top:4px}
.hr2{min-height:44px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--ink);cursor:pointer;font:700 14px Montserrat,sans-serif;white-space:nowrap}
.hr2.on{background:var(--gold);color:#1a120b;border-color:var(--gold)}
.hr2:disabled{opacity:.3;cursor:not-allowed;text-decoration:line-through}
.dir{font-size:14px;color:var(--mut);margin:12px 0 0}.dir a{color:var(--gold2)}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
`
