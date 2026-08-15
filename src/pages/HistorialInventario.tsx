import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Search, Eye, Filter, Package, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import ModalDetalle from '../components/ModalDetalle'
import ControlesPaginacion from '../components/ControlesPaginacion'

interface Movimiento {
  id: number
  item_inventario_id: number
  item_nombre: string
  item_codigo: string
  requisicion_id: number
  tipo_movimiento: string
  cantidad: number
  stock_anterior: number
  stock_nuevo: number
  stock_disponible_anterior?: number
  stock_disponible_nuevo?: number
  motivo: string
  referencia: string
  fecha_movimiento: string
  usuario: string
  usuario_responsable: string
  notas: string
  orden_id: number
}

export default function HistorialInventario() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [modalDetalle, setModalDetalle] = useState<Movimiento | null>(null)
  
  // Estados para paginación
  const [paginaActual, setPaginaActual] = useState(1)
  const [registrosPorPagina, setRegistrosPorPagina] = useState(25)

  useEffect(() => { fetchMovimientos() }, [])

  // Resetear a página 1 cuando cambian los filtros
  useEffect(() => {
    setPaginaActual(1)
  }, [searchTerm, filtroTipo])

  async function fetchMovimientos() {
    try {
      const { data, error } = await supabase
        .from('movimientos_inventario')
        .select('*')
        .order('fecha_movimiento', { ascending: false })

      if (error) throw error
      
      // Enriquecer con datos del inventario
      const movimientosEnriquecidos = await Promise.all(
        (data || []).map(async (m: any) => {
          const { data: itemData } = await supabase
            .from('inventario')
            .select('nombre, codigo, stock_actual, stock_reservado')
            .eq('id', m.item_inventario_id)
            .single()
          const stockDisponibleActual = itemData ? itemData.stock_actual - (itemData.stock_reservado || 0) : 0
          return {
            ...m,
            item_nombre: itemData?.nombre || 'Item eliminado',
            item_codigo: itemData?.codigo || '-',
            stock_disponible_nuevo: stockDisponibleActual
          }
        })
      )
      setMovimientos(movimientosEnriquecidos)
    } catch (error: any) {
      toast.error('Error al cargar: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const getTipoIcon = (tipo: string) => {
    switch(tipo) {
      case 'entrada_compra': return <TrendingUp className="w-4 h-4 text-green-600" />
      case 'salida_venta': return <TrendingDown className="w-4 h-4 text-red-600" />
      case 'reserva_orden': return <Package className="w-4 h-4 text-orange-600" />
      case 'liberacion_reserva': return <CheckCircle className="w-4 h-4 text-blue-600" />
      case 'consumo_orden': return <TrendingDown className="w-4 h-4 text-red-600" />
      case 'devolucion_orden': return <TrendingUp className="w-4 h-4 text-green-600" />
      case 'damno_taller': return <AlertTriangle className="w-4 h-4 text-red-600" />
      case 'ajuste_inventario': return <Filter className="w-4 h-4 text-purple-600" />
      default: return <Package className="w-4 h-4 text-slate-600" />
    }
  }

  const getTipoColor = (tipo: string) => {
    switch(tipo) {
      case 'entrada_compra': return 'bg-green-100 text-green-800'
      case 'salida_venta': return 'bg-red-100 text-red-800'
      case 'reserva_orden': return 'bg-orange-100 text-orange-800'
      case 'liberacion_reserva': return 'bg-blue-100 text-blue-800'
      case 'consumo_orden': return 'bg-red-100 text-red-800'
      case 'devolucion_orden': return 'bg-green-100 text-green-800'
      case 'damno_taller': return 'bg-red-100 text-red-800'
      case 'ajuste_inventario': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTipoLabel = (tipo: string) => {
    switch(tipo) {
      case 'entrada_compra': return 'Entrada por Compra'
      case 'salida_venta': return 'Salida por Venta'
      case 'reserva_orden': return 'Reserva para Orden'
      case 'liberacion_reserva': return 'Liberación de Reserva'
      case 'consumo_orden': return 'Consumo en Orden'
      case 'devolucion_orden': return 'Devolución de Orden'
      case 'damno_taller': return 'Daño en Taller'
      case 'ajuste_inventario': return 'Ajuste de Inventario'
      default: return tipo
    }
  }

  const filtered = movimientos.filter(m => {
    const matchSearch = m.item_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.item_codigo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.motivo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.referencia || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchTipo = !filtroTipo || m.tipo_movimiento === filtroTipo
    return matchSearch && matchTipo
  })

  // Paginación del lado del cliente sobre el array filtrado
  const totalRegistros = filtered.length
  const inicio = (paginaActual - 1) * registrosPorPagina
  const fin = inicio + registrosPorPagina
  const registrosPaginados = filtered.slice(inicio, fin)

  const formatDate = (d: string) => d ? new Date(d).toLocaleString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }) : '-'

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Historial de Movimientos</h1>
          <p className="text-slate-500 mt-1">Registro completo de movimientos de inventario</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por item, código, motivo o referencia..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Todos los tipos de movimiento</option>
              <option value="entrada_compra">Entrada por Compra</option>
              <option value="salida_venta">Salida por Venta</option>
              <option value="reserva_orden">Reserva para Orden</option>
              <option value="liberacion_reserva">Liberación de Reserva</option>
              <option value="consumo_orden">Consumo en Orden</option>
              <option value="devolucion_orden">Devolución de Orden</option>
              <option value="damno_taller">Daño en Taller</option>
              <option value="ajuste_inventario">Ajuste de Inventario</option>
            </select>
          </div>
        </div>
      </div>

      {/* Leyenda */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Tipos de Movimiento:</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="flex items-center gap-2"><TrendingUp className="w-3 h-3 text-green-600" /> <span className="text-slate-600">Entrada (aumenta stock)</span></div>
          <div className="flex items-center gap-2"><TrendingDown className="w-3 h-3 text-red-600" /> <span className="text-slate-600">Salida (disminuye stock)</span></div>
          <div className="flex items-center gap-2"><Package className="w-3 h-3 text-orange-600" /> <span className="text-slate-600">Reserva (aparta stock)</span></div>
          <div className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-blue-600" /> <span className="text-slate-600">Liberación (libera reserva)</span></div>
        </div>
        <p className="text-xs text-slate-500 mt-2">Stock Disponible = Stock Actual - Stock Reservado</p>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando...</div>
        ) : registrosPaginados.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {searchTerm || filtroTipo ? 'No se encontraron movimientos' : 'No hay movimientos registrados'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Fecha</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Item</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Tipo</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-slate-700">Cantidad</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-slate-700">Stock Anterior</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-slate-700">Stock Nuevo</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-green-700">Disp. Nuevo</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Motivo</th>
                    <th className="sticky right-0 bg-slate-50 border-l-2 border-slate-200 px-6 py-3 text-sm font-medium text-slate-700 z-10 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {registrosPaginados.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setModalDetalle(m)}>
                      <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">{formatDate(m.fecha_movimiento)}</td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-slate-900">{m.item_nombre}</div>
                        <div className="text-xs text-slate-500 font-mono">{m.item_codigo}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {getTipoIcon(m.tipo_movimiento)}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTipoColor(m.tipo_movimiento)}`}>
                            {getTipoLabel(m.tipo_movimiento)}
                          </span>
                        </div>
                      </td>
                      <td className={`px-6 py-4 text-sm text-right font-bold ${m.cantidad > 0 ? 'text-green-600' : m.cantidad < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                        {m.cantidad > 0 ? '+' : ''}{m.cantidad}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-slate-600">{m.stock_anterior}</td>
                      <td className="px-6 py-4 text-sm text-right font-medium text-slate-900">{m.stock_nuevo}</td>
                      <td className={`px-6 py-4 text-sm text-right font-bold ${
                        (m.stock_disponible_nuevo || 0) <= 0 ? 'text-red-600' :
                        (m.stock_disponible_nuevo || 0) <= 5 ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        {m.stock_disponible_nuevo || 0}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate" title={m.motivo}>
                        {m.motivo || '-'}
                        {m.orden_id && (
                          <div className="text-xs text-blue-600 mt-1">Orden: #{m.orden_id}</div>
                        )}
                      </td>
                      <td className="sticky right-0 bg-white group-hover:bg-slate-50 border-l-2 border-slate-200 px-6 py-4 text-right z-10 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setModalDetalle(m)} className="p-2 text-slate-600 hover:bg-slate-100 rounded">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ControlesPaginacion
              paginaActual={paginaActual}
              totalRegistros={totalRegistros}
              registrosPorPagina={registrosPorPagina}
              onPageChange={setPaginaActual}
              onRegistrosPorPaginaChange={(cantidad) => {
                setRegistrosPorPagina(cantidad)
                setPaginaActual(1)
              }}
            />
          </>
        )}
      </div>

      {/* Modal de Detalle */}
      {modalDetalle && (
        <ModalDetalle
          titulo={`Movimiento #${modalDetalle.id}`}
          campos={[
            { label: 'Fecha y Hora', value: formatDate(modalDetalle.fecha_movimiento), tipo: 'texto' },
            { label: '═══════════════════════════════', value: '', tipo: 'texto' },
            { label: 'ITEM', value: '', tipo: 'texto' },
            { label: '  Nombre', value: modalDetalle.item_nombre, tipo: 'texto' },
            { label: '  Código', value: modalDetalle.item_codigo || '-', tipo: 'texto' },
            { label: '═══════════════════════════════', value: '', tipo: 'texto' },
            { label: 'TIPO DE MOVIMIENTO', value: getTipoLabel(modalDetalle.tipo_movimiento), tipo: 'estado' },
            { label: '═══════════════════════════════', value: '', tipo: 'texto' },
            { label: 'CANTIDAD MOVIDA', value: `${modalDetalle.cantidad > 0 ? '+' : ''}${modalDetalle.cantidad}`, tipo: 'texto' },
            { label: '═══════════════════════════════', value: '', tipo: 'texto' },
            { label: 'STOCK ANTERIOR', value: modalDetalle.stock_anterior.toString(), tipo: 'texto' },
            { label: 'STOCK NUEVO', value: modalDetalle.stock_nuevo.toString(), tipo: 'texto' },
            { label: '═══════════════════════════════', value: '', tipo: 'texto' },
            { label: 'STOCK DISPONIBLE ACTUAL', value: (modalDetalle.stock_disponible_nuevo || 0).toString(), tipo: 'texto' },
            { label: '═══════════════════════════════', value: '', tipo: 'texto' },
            { label: 'Motivo', value: modalDetalle.motivo || '-', tipo: 'texto' },
            { label: 'Referencia', value: modalDetalle.referencia || '-', tipo: 'texto' },
            { label: 'Usuario Responsable', value: modalDetalle.usuario_responsable || modalDetalle.usuario || '-', tipo: 'texto' },
            { label: 'Orden Asociada', value: modalDetalle.orden_id ? `#${modalDetalle.orden_id}` : '-', tipo: 'texto' },
            { label: 'Notas', value: modalDetalle.notas || '-', tipo: 'texto' },
          ]}
          onClose={() => setModalDetalle(null)}
        />
      )}
    </div>
  )
}