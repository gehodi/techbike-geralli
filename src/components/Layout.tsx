import { useState, useEffect } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  LayoutDashboard, Users, Bike, Wrench, FileText, DollarSign,
  ClipboardList, Package, ChevronDown, ChevronRight, LogOut, Menu, X,
  Tag, Award, Truck, History, Hammer, AlertTriangle, BarChart3
} from 'lucide-react'

interface MenuItem {
  path: string
  label: string
  icon: React.ElementType
  badge?: number
}

interface SubMenu {
  label: string
  icon: React.ElementType
  items: MenuItem[]
}

export default function Layout() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [catalogosOpen, setCatalogosOpen] = useState(true)
  const [badges, setBadges] = useState({ stockBajo: 0, reqPendientes: 0 })

  useEffect(() => {
    fetchBadges()
  }, [])

  async function fetchBadges() {
    try {
      // Stock bajo
      const { data: inventario } = await supabase
        .from('inventario')
        .select('stock_actual, stock_reservado, stock_minimo')
        .eq('estado', 'disponible')

      const stockBajo = (inventario || []).filter((i: any) => 
        (i.stock_actual - (i.stock_reservado || 0)) <= i.stock_minimo
      ).length

      // Solicitudes pendientes
      const { count: reqPendientes } = await supabase
        .from('requisiciones_inventario')
        .select('*', { count: 'exact', head: true })
        .eq('estado_aprobacion', 'Pendiente')

      setBadges({ stockBajo, reqPendientes: reqPendientes || 0 })
    } catch (error) {
      console.error('Error cargando badges:', error)
    }
  }

const menuItems: MenuItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/clientes', label: 'Clientes', icon: Users },
  { path: '/bicicletas', label: 'Bicicletas', icon: Bike },
  { path: '/mecanicos', label: 'Mecánicos', icon: Wrench },
  { path: '/solicitudes', label: 'Solicitudes', icon: FileText },
  { path: '/cotizaciones', label: 'Cotizaciones', icon: DollarSign },
  { path: '/ordenes', label: 'Órdenes de Servicio', icon: ClipboardList },
  { path: '/inventario', label: 'Inventario', icon: Package, badge: badges.stockBajo },
  { path: '/requisiciones', label: 'Solicitudes de Inventario', icon: ClipboardList, badge: badges.reqPendientes },
  { path: '/registro-danos', label: 'Registro de Daños', icon: AlertTriangle },
  { path: '/historial-inventario', label: 'Historial Movimientos', icon: History },
  { path: '/reportes', label: 'Reportes', icon: BarChart3 },  // ← MOVIDO AL FINAL
]


  const subMenuCatalogos: SubMenu = {
    label: 'Catálogos',
    icon: Package,
    items: [
      { path: '/categorias', label: 'Categorías', icon: Tag },
      { path: '/marcas', label: 'Marcas', icon: Award },
      { path: '/proveedores', label: 'Proveedores', icon: Truck },
      { path: '/tipos-bicicletas', label: 'Tipos Bicicletas', icon: Bike },
      { path: '/servicios', label: 'Servicios Técnicos', icon: Hammer },
    ]
  }

  const isActive = (path: string) => location.pathname === path
  const isSubMenuActive = () => 
    subMenuCatalogos.items.some(item => location.pathname === item.path)

  const handleMenuClick = () => {
    setMobileMenuOpen(false)
  }

  const handleCatalogosToggle = () => {
    setCatalogosOpen(!catalogosOpen)
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header móvil */}
      <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
        <h1 className="text-lg font-bold text-slate-800">Taller de Bicicletas</h1>
        <button
          onClick={signOut}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          title="Cerrar sesión"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          fixed lg:sticky top-0 left-0 h-screen w-64 bg-white border-r border-slate-200 z-30
          transform transition-transform duration-300 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="flex flex-col h-full">
            {/* Logo desktop */}
            <div className="hidden lg:flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h1 className="text-xl font-bold text-slate-800">Taller Bike</h1>
            </div>

            {/* Menú */}
            <nav className="flex-1 overflow-y-auto py-4">
              <div className="px-3 space-y-1">
                {menuItems.map((item) => {
                  const Icon = item.icon
                  const active = isActive(item.path)
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={handleMenuClick}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        active 
                          ? 'bg-blue-50 text-blue-600' 
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5" />
                        {item.label}
                      </div>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          item.path === '/inventario' 
                            ? 'bg-red-600 text-white' 
                            : 'bg-blue-600 text-white'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  )
                })}

                {/* Submenú Catálogos */}
                <div className="pt-2">
                  <button
                    onClick={handleCatalogosToggle}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isSubMenuActive()
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <subMenuCatalogos.icon className="w-5 h-5" />
                      {subMenuCatalogos.label}
                    </div>
                    {catalogosOpen ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  {catalogosOpen && (
                    <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-200 pl-3">
                      {subMenuCatalogos.items.map((item) => {
                        const Icon = item.icon
                        const active = isActive(item.path)
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={handleMenuClick}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              active
                                ? 'bg-blue-50 text-blue-600'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            {item.label}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </nav>

            {/* Footer con usuario */}
            <div className="hidden lg:block border-t border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <p className="font-medium text-slate-700 truncate max-w-[150px]">{user?.email}</p>
                </div>
                <button 
                  onClick={signOut}
                  className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Overlay móvil */}
        {mobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Contenido principal */}
        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}