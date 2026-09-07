import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Users, ClipboardList, Package, DollarSign, TrendingUp, AlertTriangle, Clock, Shield, Bike, Wrench } from 'lucide-react'
import AlertasStock from '../components/AlertasStock'

interface Stats {
  totalClientes: number
  ordenesPendientes: number
  stockBajo: number
  ingresosMes: number
  solicitudesPendientes: number
  garantiasPorVencer: number
}

interface OrdenReciente {
  id: number
  numero_orden: string
  cliente_nombre: string
  estado: string
  fecha_ingreso: string
  costo_estimado: number
}

interface GarantiaPorVencer {
  id: string
  bicicleta_codigo: string
  bicicleta_info: string
  cliente_nombre: string
  cliente_telefono: string
  fecha_fin: string
  dias_restantes: number
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats>({
    totalClientes: 0,
    ordenesPendientes: 0,
    stockBajo: 0,
    ingresosMes: 0,
    solicitudesPendientes: 0,
    garantiasPorVencer: 0
  })
  const [ordenesRecientes, setOrdenesRecientes] = useState<OrdenReciente[]>([])
  const [garantiasPorVencer, setGarantiasPorVencer] = useState<GarantiaPorVencer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
    fetchOrdenesRecientes()
    fetchGarantiasPorVencer()
  }, [])

  async function fetchStats() {
    try {
      // Total clientes
      const { count: totalClientes } = await supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true })

      // Órdenes pendientes
      const { count: ordenesPendientes } = await supabase
        .from('ordenes_servicio')
        .select('*', { count: 'exact', head: true })
        .in('estado', ['Pendiente', 'En Proceso'])

      // Stock bajo
      const { data: inventario } = await supabase
        .from('inventario')
        .select('stock_actual, stock_reservado, stock_minimo')
        .eq('estado', 'disponible')
      const stockBajo = (inventario || []).filter((i: any) => 
        (i.stock_actual - (i.stock_reservado || 0)) <= i.stock_minimo
      ).length

      // Ingresos del mes (órdenes completadas)
      const ahora = new Date()
      const primerDiaMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString()
      const { data: ordenesMes } = await supabase
        .from('ordenes_servicio')
        .select('costo_real')
        .eq('estado', 'Completada')
        .gte('fecha_entrega_real', primerDiaMes)
      const ingresosMes = (ordenesMes || []).reduce((sum: number, o: any) => sum + (o.costo_real || 0), 0)

      // Solicitudes de inventario pendientes
      const { count: solicitudesPendientes } = await supabase
        .from('requisiciones_inventario')
        .select('*', { count: 'exact', head: true })
        .eq('estado_aprobacion', 'Pendiente')

      // ✅ NUEVO: Garantías por vencer en 15 días
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

      setStats({
        totalClientes: totalClientes || 0,
        ordenesPendientes: ordenesPendientes || 0,
        stockBajo,
        ingresosMes,
        solicitudesPendientes: solicitudesPendientes || 0,
        garantiasPorVencer: garantiasPorVencer || 0
      })
    } catch (error: any) {
      console.error('Error cargando stats:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchOrdenesRecientes() {
    try {
      const { data, error } = await supabase
        .from('ordenes_servicio')
        .select(`id, numero_orden, estado, fecha_ingreso, costo_estimado, clientes(nombres, apellidos)`)
        .order('fecha_ingreso', { ascending: false })
        .limit(5)

      if (error) throw error
      const procesadas = (data || []).map((o: any) => ({
        ...o,
        cliente_nombre: o.clientes ? `${o.clientes.nombres} ${o.clientes.apellidos}` : 'Sin cliente'
      }))
      setOrdenesRecientes(procesadas)
    } catch (error: any) {
      console.error('Error cargando órdenes:', error)
    }
  }

  async function fetchGarantiasPorVencer() {
    try {
      const hoy = new Date().toISOString().split('T')[0]
      const fechaLimite = new Date()
      fechaLimite.setDate(fechaLimite.getDate() + 15)
      const fechaLimiteStr = fechaLimite.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('garantias')
        .select(`
          id,
          fecha_fin,
          cliente_nombre,
          cliente_telefono,
          bicicletas_adquiridas(codigo_inventario, marca, modelo)
        `)
        .eq('estado', 'vigente')
        .gte('fecha_fin', hoy)
        .lte('fecha_fin', fechaLimiteStr)
        .order('fecha_fin', { ascending: true })
        .limit(5)

      if (error) throw error

      const hoyDate = new Date()
      hoyDate.setHours(0, 0, 0, 0)

      const procesadas: GarantiaPorVencer[] = (data || []).map((g: any) => {
        const fechaFin = new Date(g.fecha_fin)
        const diffTime = fechaFin.getTime() - hoyDate.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        return {
          ...g,
          bicicleta_codigo: g.bicicletas_adquiridas?.codigo_inventario || '-',
          bicicleta_info: `${g.bicicletas_adquiridas?.marca || ''} ${g.bicicletas_adquiridas?.modelo || ''}`.trim() || '-',
          dias_restantes: diffDays
        }
      })

      setGarantiasPorVencer(procesadas)
    } catch (error: any) {
      console.error('Error cargando garantías por vencer:', error)
    }
  }

  const formatCurrency = (v: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v)
  }
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('es-CO') : '-'
  const getEstadoColor = (estado: string) => {
    switch(estado) {
      case 'Pendiente': return 'bg-yellow-100 text-yellow-800'
      case 'En Proceso': return 'bg-blue-100 text-blue-800'
      case 'Completada': return 'bg-green-100 text-green-800'
      case 'Cancelada': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Cargando dashboard...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 mt-1">Resumen general del taller</p>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/clientes')}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-sm text-slate-600">Total Clientes</div>
          <div className="text-3xl font-bold text-slate-900 mt-1">{stats.totalClientes}</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/ordenes')}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <ClipboardList className="w-6 h-6 text-yellow-600" />
            </div>
            <Clock className="w-4 h-4 text-yellow-600" />
          </div>
          <div className="text-sm text-slate-600">Órdenes Pendientes</div>
          <div className="text-3xl font-bold text-slate-900 mt-1">{stats.ordenesPendientes}</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-red-200 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/inventario')}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            {stats.stockBajo > 0 && (
              <span className="bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold">
                ALERTA
              </span>
            )}
          </div>
          <div className="text-sm text-slate-600">Stock Bajo</div>
          <div className="text-3xl font-bold text-red-600 mt-1">{stats.stockBajo}</div>
          <div className="text-xs text-slate-500 mt-1">items requieren atención</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-green-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-sm text-slate-600">Ingresos del Mes</div>
          <div className="text-3xl font-bold text-green-600 mt-1">{formatCurrency(stats.ingresosMes)}</div>
          <div className="text-xs text-slate-500 mt-1">órdenes completadas</div>
        </div>
      </div>

      {/* ✅ NUEVA TARJETA: Garantías por Vencer */}
      {stats.garantiasPorVencer > 0 && (
        <div 
          className="bg-amber-50 border-2 border-amber-300 rounded-xl shadow-sm p-6 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/garantias')}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-200 rounded-lg">
                <Shield className="w-6 h-6 text-amber-700" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-900">Garantías por Vencer</h3>
                <p className="text-sm text-amber-700">Próximos 15 días</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-amber-700">{stats.garantiasPorVencer}</div>
              <div className="text-xs text-amber-600">requieren atención</div>
            </div>
          </div>

          {/* Lista de garantías próximas a vencer */}
          <div className="mt-4 space-y-2">
            {garantiasPorVencer.slice(0, 3).map((g) => (
              <div key={g.id} className="bg-white rounded-lg p-3 border border-amber-200 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-800">{g.bicicleta_codigo} - {g.bicicleta_info}</div>
                  <div className="text-xs text-slate-600">{g.cliente_nombre} {g.cliente_telefono && `• ${g.cliente_telefono}`}</div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold ${g.dias_restantes <= 7 ? 'text-red-600' : 'text-amber-700'}`}>
                    {g.dias_restantes} {g.dias_restantes === 1 ? 'día' : 'días'}
                  </div>
                  <div className="text-xs text-slate-500">{formatDate(g.fecha_fin)}</div>
                </div>
              </div>
            ))}
            {garantiasPorVencer.length > 3 && (
              <div className="text-center text-xs text-amber-700 pt-2">
                + {garantiasPorVencer.length - 3} garantías más por vencer
              </div>
            )}
          </div>
        </div>
      )}

      {/* Panel de alertas y actividad */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alertas de stock - ocupa 2 columnas */}
        <div className="lg:col-span-2">
          <AlertasStock />
        </div>

        {/* Órdenes recientes */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Órdenes Recientes
            </h3>
          </div>
          <div className="divide-y divide-slate-200">
            {ordenesRecientes.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">No hay órdenes recientes</div>
            ) : (
              ordenesRecientes.map((o) => (
                <div 
                  key={o.id} 
                  className="p-4 hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate('/ordenes')}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-900 text-sm">{o.numero_orden}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getEstadoColor(o.estado)}`}>
                      {o.estado}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">{o.cliente_nombre}</div>
                  <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                    <span>{formatDate(o.fecha_ingreso)}</span>
                    <span className="font-medium text-slate-700">{formatCurrency(o.costo_estimado)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-800 mb-4">Accesos Rápidos</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <button onClick={() => navigate('/solicitudes')} className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg text-left transition-colors">
            <ClipboardList className="w-6 h-6 text-blue-600 mb-2" />
            <div className="font-medium text-slate-900 text-sm">Nueva Solicitud</div>
            <div className="text-xs text-slate-600 mt-1">Registro de cliente</div>
          </button>

          <button onClick={() => navigate('/cotizaciones')} className="p-4 bg-green-50 hover:bg-green-100 rounded-lg text-left transition-colors">
            <DollarSign className="w-6 h-6 text-green-600 mb-2" />
            <div className="font-medium text-slate-900 text-sm">Nueva Cotización</div>
            <div className="text-xs text-slate-600 mt-1">Presupuesto servicio</div>
          </button>

          <button onClick={() => navigate('/inventario')} className="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg text-left transition-colors relative">
            <Package className="w-6 h-6 text-purple-600 mb-2" />
            <div className="font-medium text-slate-900 text-sm">Inventario</div>
            <div className="text-xs text-slate-600 mt-1">Gestión de stock</div>
            {stats.stockBajo > 0 && (
              <span className="absolute top-2 right-2 bg-red-600 text-white w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold">
                {stats.stockBajo}
              </span>
            )}
          </button>

          <button onClick={() => navigate('/requisiciones')} className="p-4 bg-orange-50 hover:bg-orange-100 rounded-lg text-left transition-colors relative">
            <AlertTriangle className="w-6 h-6 text-orange-600 mb-2" />
            <div className="font-medium text-slate-900 text-sm">Reposiciones</div>
            <div className="text-xs text-slate-600 mt-1">Solicitudes inventario</div>
            {stats.solicitudesPendientes > 0 && (
              <span className="absolute top-2 right-2 bg-red-600 text-white w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold">
                {stats.solicitudesPendientes}
              </span>
            )}
          </button>

          {/* ✅ NUEVOS: Accesos rápidos para Bicicletas Usadas */}
          <button onClick={() => navigate('/bicicletas-usadas')} className="p-4 bg-cyan-50 hover:bg-cyan-100 rounded-lg text-left transition-colors">
            <Bike className="w-6 h-6 text-cyan-600 mb-2" />
            <div className="font-medium text-slate-900 text-sm">Adquirir Bicicleta</div>
            <div className="text-xs text-slate-600 mt-1">Nueva adquisición</div>
          </button>

          <button onClick={() => navigate('/ventas-bicicletas')} className="p-4 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-left transition-colors">
            <DollarSign className="w-6 h-6 text-emerald-600 mb-2" />
            <div className="font-medium text-slate-900 text-sm">Vender Bicicleta</div>
            <div className="text-xs text-slate-600 mt-1">Registrar venta</div>
          </button>

          <button onClick={() => navigate('/garantias')} className="p-4 bg-amber-50 hover:bg-amber-100 rounded-lg text-left transition-colors relative">
            <Shield className="w-6 h-6 text-amber-600 mb-2" />
            <div className="font-medium text-slate-900 text-sm">Garantías</div>
            <div className="text-xs text-slate-600 mt-1">Control de vigencias</div>
            {stats.garantiasPorVencer > 0 && (
              <span className="absolute top-2 right-2 bg-amber-600 text-white w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold">
                {stats.garantiasPorVencer}
              </span>
            )}
          </button>

          <button onClick={() => navigate('/reclamaciones-garantia')} className="p-4 bg-rose-50 hover:bg-rose-100 rounded-lg text-left transition-colors">
            <Wrench className="w-6 h-6 text-rose-600 mb-2" />
            <div className="font-medium text-slate-900 text-sm">Reclamaciones</div>
            <div className="text-xs text-slate-600 mt-1">Gestión de fallas</div>
          </button>
        </div>
      </div>
    </div>
  )
}