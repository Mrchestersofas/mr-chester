import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  LayoutDashboard, ClipboardList, PlusCircle,
  Wrench, Package, Calculator, Users, Factory
} from 'lucide-react'

const navItems = [
  { href: '/',            label: 'Dashboard',       icon: LayoutDashboard },
  { href: '/pedidos',     label: 'Pedidos',          icon: ClipboardList },
  { href: '/pedidos/nuevo', label: 'Nuevo pedido',   icon: PlusCircle },
  { href: '/produccion',  label: 'Producción',       icon: Wrench },
  { href: '/materiales',  label: 'Materiales',       icon: Package },
  { href: '/costos',      label: 'Costos',           icon: Calculator },
  { href: '/clientes',    label: 'Clientes',         icon: Users },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-52 flex-shrink-0 bg-gray-50 border-r border-gray-100 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--chester-purple)' }}>
              <Factory size={14} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-600 text-gray-900">Mr. Chester</div>
              <div className="text-xs text-gray-400">Gestión de fábrica</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-3">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
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
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
