import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  LayoutDashboard, ClipboardList, PlusCircle,
  Wrench, Package, Calculator, Users, Factory, ShoppingCart, Menu, X, TrendingUp, Sun, FileText, CalendarDays, Truck, Wallet, LogOut, Target, MessageCircle, Landmark, GraduationCap, Headphones, BadgeDollarSign
} from 'lucide-react'

const navItems = [
  { href: '/',              label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/mi-dia',        label: 'Mi Día',        icon: Sun },
  { href: '/pedidos',       label: 'Pedidos',       icon: ClipboardList },
  { href: '/pedidos/nuevo', label: 'Nuevo pedido',  icon: PlusCircle },
  { href: '/crm',           label: 'CRM',           icon: Target },
  { href: '/atencion',      label: 'Atención al cliente', icon: Headphones },
  { href: '/whatsapp',      label: 'WhatsApp',      icon: MessageCircle },
  { href: '/cotizaciones',  label: 'Cotizaciones',  icon: FileText },
  { href: '/programacion',  label: 'Programación',  icon: CalendarDays },
  { href: '/produccion',    label: 'Producción',    icon: Wrench },
  { href: '/despachos',     label: 'Despachos',     icon: Truck },
  { href: '/finanzas',      label: 'Finanzas',      icon: Wallet },
  { href: '/nomina',        label: 'Nómina',        icon: BadgeDollarSign },
  { href: '/ventas',        label: 'Ventas',        icon: TrendingUp },
  { href: '/contabilidad',  label: 'Contabilidad',  icon: Landmark },
  { href: '/compras',       label: 'Compras',       icon: ShoppingCart },
  { href: '/materiales',    label: 'Materiales',    icon: Package },
  { href: '/costos',        label: 'Costos',        icon: Calculator },
  { href: '/clientes',      label: 'Clientes',      icon: Users },
  { href: '/capacitacion',  label: 'Capacitación',  icon: GraduationCap },
]

// Quiénes pueden entrar al ERP. El usuario "joseph" usa su correo; los demás, usuario@envios.mrchester.com.co
const USUARIOS: Record<string, string> = { joseph: 'josephtoledo@gmail.com', 'joséph': 'josephtoledo@gmail.com', 'josé': 'josephtoledo@gmail.com', jose: 'josephtoledo@gmail.com', monica: 'monica@envios.mrchester.com.co', 'mónica': 'monica@envios.mrchester.com.co' }
export const PERMITIDOS = ['josephtoledo@gmail.com', 'monica@envios.mrchester.com.co']
// Los vendedores (tabla cap_equipo) solo ven estas páginas
const PAGINAS_VENDEDOR = ['/capacitacion', '/cotizaciones']

export default function Layout({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(undefined)
  const [recuperando, setRecuperando] = useState(false)
  const [vendedor, setVendedor] = useState<boolean | undefined>(undefined)
  const router = useRouter()
  const email = session?.user?.email
  useEffect(() => {
    if (!email) { setVendedor(undefined); return }
    if (PERMITIDOS.includes(email)) { setVendedor(false); return }
    supabase.from('cap_equipo').select('email').eq('email', email).maybeSingle().then(({ data }) => setVendedor(!!data))
  }, [email])
  useEffect(() => {
    if (vendedor && !PAGINAS_VENDEDOR.includes(router.pathname)) router.replace('/capacitacion')
  }, [vendedor, router.pathname])
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((ev, s) => { setSession(s); if (ev === 'PASSWORD_RECOVERY') setRecuperando(true) })
    return () => data.subscription.unsubscribe()
  }, [])
  if (session === undefined) return <div className="flex items-center justify-center h-screen text-gray-400 text-sm">Cargando…</div>
  if (!session) return <LoginERP />
  if (recuperando) return <NuevaClave listo={() => setRecuperando(false)} />
  if (!PERMITIDOS.includes(email)) {
    if (vendedor === undefined) return <div className="flex items-center justify-center h-screen text-gray-400 text-sm">Cargando…</div>
    if (!vendedor) return <SinAcceso />
    if (!PAGINAS_VENDEDOR.includes(router.pathname)) return <div className="flex items-center justify-center h-screen text-gray-400 text-sm">Cargando…</div>
    return <Marco email={email} items={navItems.filter(n => PAGINAS_VENDEDOR.includes(n.href))}>{children}</Marco>
  }
  return <Marco email={email} items={navItems}>{children}</Marco>
}

function LoginERP() {
  const [u, setU] = useState('')
  const [k, setK] = useState('')
  const [error, setError] = useState('')
  const [entrando, setEntrando] = useState(false)
  const [olvido, setOlvido] = useState(false)
  const [aviso, setAviso] = useState('')
  async function recuperar() {
    const t = u.trim().toLowerCase()
    if (!t) { setError('Escribe tu usuario o correo y vuelve a tocar "¿Olvidaste tu clave?".'); return }
    const email = t.includes('@') ? t : (USUARIOS[t] || `${t}@envios.mrchester.com.co`)
    setEntrando(true); setError(''); setAviso('')
    const { error: er } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/' })
    setEntrando(false)
    if (er) setError('No se pudo enviar el correo: ' + er.message)
    else setAviso(`Te enviamos un correo a ${email} con un enlace para crear una clave nueva. Revisa también la carpeta de spam.`)
  }
  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    const t = u.trim().toLowerCase()
    const email = t.includes('@') ? t : (USUARIOS[t] || `${t}@envios.mrchester.com.co`)
    setEntrando(true); setError('')
    const { error: er } = await supabase.auth.signInWithPassword({ email, password: k })
    setEntrando(false)
    if (er) setError('Usuario o clave incorrectos.')
  }
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#F6F3EE' }}>
      <form onSubmit={entrar} className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <div className="text-center">
          <div style={{ color: '#C9A84C', fontSize: 28 }}>♛</div>
          <div style={{ color: '#1a1a1a', fontFamily: 'Georgia, serif', fontWeight: 700, letterSpacing: 4, fontSize: 20 }}>MR. CHESTER</div>
          <div className="text-xs text-gray-500 mt-1">Sistema de gestión</div>
        </div>
        <div><label htmlFor="lu" className="text-xs text-gray-500 mb-1 block">Usuario</label><input id="lu" autoCapitalize="none" autoComplete="username" value={u} onChange={e => setU(e.target.value)} /></div>
        <div><label htmlFor="lk" className="text-xs text-gray-500 mb-1 block">Clave</label><input id="lk" type="password" autoComplete="current-password" value={k} onChange={e => setK(e.target.value)} /></div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        {aviso && 
