import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  LayoutDashboard, ClipboardList, PlusCircle,
  Wrench, Package, Calculator, Users, Factory, ShoppingCart, Menu, X, TrendingUp, Sun, FileText, CalendarDays, Truck, Wallet, LogOut, Target
} from 'lucide-react'

const navItems = [
  { href: '/',              label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/mi-dia',        label: 'Mi Día',        icon: Sun },
  { href: '/pedidos',       label: 'Pedidos',       icon: ClipboardList },
  { href: '/pedidos/nuevo', label: 'Nuevo pedido',  icon: PlusCircle },
  { href: '/crm',           label: 'CRM',           icon: Target },
  { href: '/cotizaciones',  label: 'Cotizaciones',  icon: FileText },
  { href: '/programacion',  label: 'Programación',  icon: CalendarDays },
  { href: '/produccion',    label: 'Producción',    icon: Wrench },
  { href: '/despachos',     label: 'Despachos',     icon: Truck },
  { href: '/finanzas',      label: 'Finanzas',      icon: Wallet },
  { href: '/ventas',        label: 'Ventas',        icon: TrendingUp },
  { href: '/compras',       label: 'Compras',       icon: ShoppingCart },
  { href: '/materiales',    label: 'Materiales',    icon: Package },
  { href: '/costos',        label: 'Costos',        icon: Calculator },
  { href: '/clientes',      label: 'Clientes',      icon: Users },
]

// Quiénes pueden entrar al ERP. El usuario "joseph" usa su correo; los demás, usuario@envios.mrchester.com.co
const USUARIOS: Record<string, string> = { joseph: 'josephtoledo@gmail.com', 'joséph': 'josephtoledo@gmail.com', 'josé': 'josephtoledo@gmail.com', jose: 'josephtoledo@gmail.com', monica: 'monica@envios.mrchester.com.co', 'mónica': 'monica@envios.mrchester.com.co' }
const PERMITIDOS = ['josephtoledo@gmail.com', 'monica@envios.mrchester.com.co']

export default function Layout({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  if (session === undefined) return <div className="flex items-center justify-center h-screen text-gray-400 text-sm">Cargando…</div>
  if (!session) return <LoginERP />
  if (!PERMITIDOS.includes(session.user?.email)) return <SinAcceso />
  return <Marco email={session.user.email}>{children}</Marco>
}

function LoginERP() {
  const [u, setU] = useState('')
  const [k, setK] = useState('')
  const [error, setError] = useState('')
  const [entrando, setEntrando] = useState(false)
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
        <button className="w-full rounded-xl py-3 font-bold" style={{ background: '#1a1a1a', color: '#C9A84C' }} disabled={entrando}>{entrando ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  )
}

function SinAcceso() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-3">
        <p>Este usuario no tiene acceso al sistema.</p>
        <button className="btn" onClick={() => supabase.auth.signOut()}>Salir</button>
      </div>
    </div>
  )
}

function CambiarClave({ cerrar }: { cerrar: () => void }) {
  const [k, setK] = useState('')
  const [msg, setMsg] = useState('')
  async function guardar() {
    if (k.length < 6) { setMsg('Mínimo 6 caracteres.'); return }
    const { error } = await supabase.auth.updateUser({ password: k })
    setMsg(error ? 'No se pudo cambiar: ' + error.message : '✓ Clave cambiada')
    if (!error) setTimeout(cerrar, 1200)
  }
  return (
    <div className="px-4 py-3 border-t border-gray-100 space-y-2">
      <input type="password" placeholder="Nueva clave" value={k} onChange={e => setK(e.target.value)} aria-label="Nueva clave" />
      <div className="flex gap-2"><button className="btn btn-primary flex-1 text-xs" onClick={guardar}>Guardar</button><button className="btn text-xs" onClick={cerrar}>Cancelar</button></div>
      {msg && <p className="text-xs text-gray-600">{msg}</p>}
    </div>
  )
}

function Marco({ children, email }: { children: React.ReactNode, email: string }) {
  const router = useRouter()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [cambiando, setCambiando] = useState(false)

  const cerrarMenu = () => setMenuAbierto(false)

  return (
    <div className="flex h-screen overflow-hidden">

      {menuAbierto && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={cerrarMenu}
        />
      )}

      <aside className={`
        fixed md:static inset-y-0 left-0 z-30
        w-52 flex-shrink-0 bg-gray-50 border-r border-gray-100 flex flex-col
        transform transition-transform duration-200 ease-in-out
        ${menuAbierto ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--chester-purple)' }}>
                <Factory size={14} className="text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">Mr. Chester</div>
                <div className="text-xs text-gray-400">Gestión de fábrica</div>
              </div>
            </div>
            <button onClick={cerrarMenu} className="md:hidden text-gray-400 hover:text-gray-600 p-1">
              <X size={18} />
            </button>
          </div>
        </div>
        <nav className="flex-1 py-3">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={cerrarMenu}
              className={`sidebar-link ${router.pathname === href ? 'active' : ''}`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        {cambiando ? <CambiarClave cerrar={() => setCambiando(false)} /> : (
          <div className="px-4 py-3 border-t border-gray-100 space-y-1">
            <p className="text-xs text-gray-500 truncate">{email === 'josephtoledo@gmail.com' ? 'Joseph' : email.split('@')[0].replace(/^./, c => c.toUpperCase())}</p>
            <div className="flex gap-3 text-xs">
              <button className="text-gray-500 underline" onClick={() => setCambiando(true)}>Cambiar clave</button>
              <button className="text-gray-500 underline flex items-center gap-1" onClick={() => supabase.auth.signOut()}><LogOut size={12} /> Salir</button>
            </div>
          </div>
        )}
      </aside>

      <main className="flex-1 overflow-y-auto flex flex-col min-w-0">

        <div
          className="md:hidden flex items-center justify-between px-4 sticky top-0 z-10"
          style={{ background: '#1a1a1a', height: '56px' }}
        >
          <button
            onClick={() => setMenuAbierto(true)}
            className="p-1"
            style={{ color: '#C9A84C' }}
          >
            <Menu size={24} />
          </button>
          <div className="flex flex-col items-center justify-center">
            <span style={{ color: '#C9A84C', fontSize: '20px', lineHeight: '1.1' }}>♛</span>
            <span style={{ color: '#C9A84C', fontSize: '12px', fontWeight: '800', letterSpacing: '3px', lineHeight: '1.2' }}>MR. CHESTER</span>
          </div>
          <Link
            href="/pedidos/nuevo"
            className="text-xs font-bold px-3 py-1.5 rounded-lg"
            style={{ background: '#C9A84C', color: '#1a1a1a' }}
          >
            + Pedido
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
