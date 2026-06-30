import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import {
  LayoutDashboard, ClipboardList, PlusCircle,
  Wrench, Package, Calculator, Users, Factory, ShoppingCart, Menu, X
} from 'lucide-react'

const navItems = [
  { href: '/',              label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/pedidos',       label: 'Pedidos',       icon: ClipboardList },
  { href: '/pedidos/nuevo', label: 'Nuevo pedido',  icon: PlusCircle },
  { href: '/produccion',    label: 'Producción',    icon: Wrench },
  { href: '/compras',       label: 'Compras',       icon: ShoppingCart },
  { href: '/materiales',    label: 'Materiales',    icon: Package },
  { href: '/costos',        label: 'Costos',        icon: Calculator },
  { href: '/clientes',      label: 'Clientes',      icon: Users },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [menuAbierto, setMenuAbierto] = useState(false)

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
        <div className="px-4 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-400">v1.0 — Mr. Chester ERP</p>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto flex flex-col min-w-0">

        {/* Barra superior móvil */}
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
            <span style={{
              color: '#C9A84C',
              fontSize: '12px',
              fontWeight: '800',
              letterSpacing: '3px',
              lineHeight: '1.2'
            }}>MR. CHESTER</span>
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