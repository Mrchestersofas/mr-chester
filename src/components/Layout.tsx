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

      {/* Overlay oscuro en móvil cuando el menú está abierto */}
      {menuAbierto && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={cerrarMenu}
        />
      )}

      {/* Sidebar — oculto en móvil, visible en desktop */}
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
            {/* Botón cerrar en móvil */}
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

      {/* Main content */}
      <main className="flex-1 overflow-y-auto flex flex-col min-w-0">

        {/* Barra superior solo en móvil */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-10">
          <button
            onClick={() => setMenuAbierto(true)}
            className="text-gray-600 hover:text-gray-900 p-1"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'var(--chester-purple)' }}>
              <Factory size={12} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-900">Mr. Chester</span>
          </div>
          <Link
            href="/pedidos/nuevo"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
            style={{ background: 'var(--chester-purple)' }}
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