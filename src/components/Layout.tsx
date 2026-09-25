import { useState, useEffect } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  LayoutDashboard, Users, Bike, Wrench, FileText, DollarSign,
  ClipboardList, Package, ChevronDown, ChevronRight, LogOut, Menu, X,
  Tag, Award, Truck, History, Hammer, AlertTriangle, BarChart3, Shield
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
  const [badges, setBadges] = useState({
    stockBajo: 0,
    reqPendientes: 0,
    garantiasPorVencer: 0
  })

  useEffect(() => {
    fetchBadges()
  }, [])

  // ✅ Bloquea el scroll del fondo mientras el menú móvil está abierto
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileMenuOpen])

  // ✅ Cierra el menú automáticamente al navegar a otra ruta
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  async function fetchBadges() {
    try {
      const { data: inventario } = await supabase
        .from('inventario')
        .select('stock_actual, stock_reservado, stock_minimo')
        .eq('estado', 'disponible')
      const stockBajo = (inventario || []).filter((i: any) => 
        (i.stock_actual - (i.stock_reservado || 0)) <= i.stock_minimo
      ).length

      const { count: reqPendientes } = await supabase
        .from('requisiciones_inventario')
        .select('*', { count: 'exact', head: true })
        .eq('estado_aprobacion', 'Pendiente')

      const hoy = new Date().toISOString().split('T')[0]
      const fechaLimite = new Date()
      fechaLimite.setDate(fechaLimite.getDate() + 15)
      const fechaLimiteStr = fechaLimite.toISOString().split('T')[0]
      const { count: garantiasPorVencer } = await supabase
        .from('garantias')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'vigente')
        .gte('fecha_fin', hoy)
        .lte('fecha_fin', fechaLimiteStr)

      setBadges({ 
        stockBajo, 
        reqPendientes: reqPendientes || 0,
        garantiasPorVencer: garantiasPorVencer || 0
      })
    } catch (error) {
      console.error('Error cargando badges:', error)
    }
  }

  const menuItems: MenuItem[] = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/clientes', label: 'Clientes', icon: Users },
    { path: '/solicitudes', label: 'Solicitudes', icon: FileText },
    { path: '/cotizaciones', label: 'Cotizaciones', icon: DollarSign },
    { path: '/ordenes', label: 'Órdenes de Servicio', icon: ClipboardList },
    { path: '/ordenes-internas', label: 'Órdenes Internas', icon: Wrench },
    { path: '/bicicletas', label: 'Bicicletas', icon: Bike },
    { path: '/bicicletas-usadas', label: 'Adquisición Bicicletas', icon: Bike },
    { path: '/ventas-bicicletas', label: 'Ventas Bicicletas', icon: DollarSign },
    { path: '/garantias', label: 'Garantías', icon: Shield, badge: badges.garantiasPorVencer },
    { path: '/reclamaciones-garantia', label: 'Reclamaciones', icon: AlertTriangle },
    { path: '/mecanicos', label: 'Mecánicos', icon: Wrench },
    { path: '/inventario', label: 'Inventario', icon: Package, badge: badges.stockBajo },
    { path: '/requisiciones', label: 'Solicitudes de Inventario', icon: ClipboardList, badge: badges.reqPendientes },
    { path: '/registro-danos', label: 'Registro de Daños', icon: AlertTriangle },
    { path: '/historial-inventario', label: 'Historial Movimientos', icon: History },
    { path: '/reportes', label: 'Reportes', icon: BarChart3 },
  ]

  const subMenuCatalogos: SubMenu = {
    label: 'Catálogos',
    icon: Package,
    items: [
      { path: '/categorias', label: 'Categorías', icon: Tag },
      { path: '/marcas', label: 'Marcas', icon: Award },
      { path: '/proveedores', label: 'Proveedores Taller', icon: Truck },
      { path: '/proveedores-bicicletas-usadas', label: 'Proveedores Bic. Usadas', icon: Truck },
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
        <h1 className="text-lg font-bold text-slate-800">Taller Bike</h1>
        <button
          onClick={signOut}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          title="Cerrar sesión"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      <div className="flex">
        {/* ✅ CORREGIDO: en móvil arranca debajo del header (top-16) y con altura exacta;
            en desktop sigue sticky a pantalla completa */}
        <aside className={`
          fixed top-16 lg:top-0 left-0 h-[calc(100vh-4rem)] lg:h-screen w-64 bg-white border-r border-slate-200 z-30
          transform transition-transform duration-300 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="flex flex-col h-full">
            {/* Logo desktop */}
            <div className="hidden lg:flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h1 className="text-xl font-bold text-slate-800">Taller Bike</h1>
            </div>

            {/* ✅ Encabezado del menú en móvil con botón de cierre */}
            <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h1 className="text-lg font-bold text-slate-800">Menú</h1>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ✅ CORRECCIÓN CLAVE: min-h-0 permite que el scroll interno funcione
                y TODO el menú (incluido Servicios Técnicos) sea alcanzable */}
            <nav className="flex-1 min-h-0 overflow-y-auto py-4">
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
                            : item.path === '/garantias'
                            ? 'bg-yellow-500 text-white'
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

            {/* ✅ Footer con usuario visible también en móvil */}
            <div className="border-t border-slate-200 p-4">
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

        {/* ✅ min-w-0 evita que tablas anchas desborden el contenedor en móvil */}
        <main className="flex-1 min-w-0 p-4 lg:p-8 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}