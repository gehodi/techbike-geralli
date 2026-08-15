import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Search, Eye, AlertTriangle, TrendingDown, Package, X } from 'lucide-react'
import toast from 'react-hot-toast'
import ModalDetalle from '../components/ModalDetalle'

interface RegistroDano {
  id: number
  item_inventario_id: number
  item_nombre: string
  item_codigo: string
  cantidad: number
  fecha_damno: string
  causa: string
  descripcion: string
  responsable: string
  valor_perdida: number
  accion_tomada: string
  orden_id: number | null
}

interface ItemInventario {
  id: number
  nombre: string
  codigo: string
  stock_actual: number
  stock_reservado: number
  stock_dañado: number
  precio_compra: number
}

export default function RegistroDanos() {
  const { user } = useAuth()
  const [registros, setRegistros] = useState<RegistroDano[]>([])
  const [inventario, setInventario] = useState<ItemInventario[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroCausa, setFiltroCausa] = useState('')
  const [modalDetalle, setModalDetalle] = useState<RegistroDano | null>(null)

  const [formData, setFormData] = useState({
    item_inventario_id: '',
    cantidad: '',
    causa: 'manipulacion',
    descripcion: '',
    accion_tomada: 'desecho'
  })

  useEffect(() => {
    fetchRegistros()
    fetchInventario()
  }, [])

  async function fetchRegistros() {
    try {
      const { data, error } = await supabase
        .from('inventario_dañado')
        .select('*')
        .order('fecha_damno', { ascending: false })
      
      if (error) {
        console.error('Error cargando registros:', error)
        toast.error('Error al cargar registros: ' + error.message)
        return
      }
      
      const enriquecidos = await Promise.all(
        (data || []).map(async (r: any) => {
          const { data: itemData } = await supabase
            .from('inventario')
            .select('nombre, codigo')
            .eq('id', r.item_inventario_id)
            .single()
          
          return {
            ...r,
            item_nombre: itemData?.nombre || 'Item eliminado',
            item_codigo: itemData?.codigo || '-'
          }
        })
      )
      
      setRegistros(enriquecidos)
    } catch (error: any) {
      console.error('Error:', error)
      toast.error('Error al cargar: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchInventario() {
    try {
      const { data } = await supabase
        .from('inventario')
        .select('id, nombre, codigo, stock_actual, stock_reservado, stock_dañado, precio_compra')
        .order('nombre')
      setInventario(data || [])
    } catch (error: any) {
      console.error('Error cargando inventario:', error)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const item = inventario.find(i => i.id === parseInt(formData.item_inventario_id))
      if (!item) {
        toast.error('Seleccione un item válido')
        return
      }

      const cantidad = parseInt(formData.cantidad)
      if (cantidad <= 0) {
        toast.error('La cantidad debe ser mayor a cero')
        return
      }

      const stockDisponible = item.stock_actual - (item.stock_reservado || 0)
      if (cantidad > stockDisponible) {
        toast.error(`Stock insuficiente. Disponible: ${stockDisponible}`)
        return
      }

      const valorPerdida = cantidad * (item.precio_compra || 0)

      // 1. Insertar registro de daño
      const { data: registro, error: errorRegistro } = await supabase
        .from('inventario_dañado')
        .insert([{
          item_inventario_id: parseInt(formData.item_inventario_id),
          cantidad: cantidad,
          causa: formData.causa,
          descripcion: formData.descripcion || null,
          responsable: user?.email || 'usuario_desconocido',
          valor_perdida: valorPerdida,
          accion_tomada: formData.accion_tomada,
          orden_id: null
        }])
        .select()
        .single()
      
      if (errorRegistro) throw errorRegistro

      // 2. Actualizar inventario
      const nuevoStockActual = item.stock_actual - cantidad
      const nuevoStockDanado = (item.stock_dañado || 0) + cantidad
      
      const { error: errorUpdate } = await supabase
        .from('inventario')
        .update({
          stock_actual: nuevoStockActual,
          stock_dañado: nuevoStockDanado,
          estado: nuevoStockActual === 0 ? 'agotado' : 'disponible'
        })
        .eq('id', item.id)
      
      if (errorUpdate) throw errorUpdate

      // 3. Registrar movimiento
      const { error: errorMov } = await supabase
        .from('movimientos_inventario')
        .insert({
          item_inventario_id: item.id,
          tipo_movimiento: 'damno_taller',
          cantidad: -cantidad,
          stock_anterior: item.stock_actual,
          stock_nuevo: nuevoStockActual,
          motivo: `Daño registrado - ${formData.causa}`,
          referencia: `DANO-${registro.id}`,
          requisicion_id: null,
          orden_id: null,
          fecha_movimiento: new Date().toISOString(),
          usuario_responsable: user?.email || 'usuario_desconocido'
        })
      
      if (errorMov) throw errorMov

      toast.success(`Daño registrado. Pérdida: ${formatCurrency(valorPerdida)}`)
      resetForm()
      fetchRegistros()
      fetchInventario()
      
    } catch (error: any) {
      console.error('Error al registrar:', error)
      toast.error('Error al registrar: ' + error.message)
    }
  }

  function resetForm() {
    setFormData({
      item_inventario_id: '',
      cantidad: '',
      causa: 'manipulacion',
      descripcion: '',
      accion_tomada: 'desecho'
    })
    setShowForm(false)
  }

  const getCausaLabel = (causa: string) => {
    switch(causa) {
      case 'manipulacion': return 'Manipulación'
      case 'defecto_fabrica': return 'Defecto de Fábrica'
      case 'transporte': return 'Transporte'
      case 'robo': return 'Robo/Extravío'
      case 'vencimiento': return 'Vencimiento'
      case 'otro': return 'Otro'
      default: return causa
    }
  }

  const getCausaColor = (causa: string) => {
    switch(causa) {
      case 'manipulacion': return 'bg-orange-100 text-orange-800'
      case 'defecto_fabrica': return 'bg-red-100 text-red-800'
      case 'transporte': return 'bg-blue-100 text-blue-800'
      case 'robo': return 'bg-purple-100 text-purple-800'
      case 'vencimiento': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getAccionLabel = (accion: string) => {
    switch(accion) {
      case 'desecho': return 'Desecho'
      case 'devolucion_proveedor': return 'Devolución a Proveedor'
      case 'reparacion': return 'Reparación'
      default: return accion
    }
  }

  const filtered = registros.filter(r => {
    const matchSearch = r.item_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       (r.item_codigo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                       (r.descripcion || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchCausa = !filtroCausa || r.causa === filtroCausa
    return matchSearch && matchCausa
  })

  const formatDate = (d: string) => d ? new Date(d).toLocaleString('es-CO', { 
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }) : '-'

  const formatCurrency = (v: number | null | undefined) => {
    if (v === null || v === undefined) return '$0'
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
  }

  // Calcular totales
  const totalPerdidas = registros.reduce((sum, r) => sum + (r.valor_perdida || 0), 0)
  const totalItemsDanados = registros.reduce((sum, r) => sum + r.cantidad, 0)
  
  const perdidasEsteMes = registros
    .filter(r => {
      const fecha = new Date(r.fecha_damno)
      const ahora = new Date()
      return fecha.getMonth() === ahora.getMonth() && fecha.getFullYear() === ahora.getFullYear()
    })
    .reduce((sum, r) => sum + (r.valor_perdida || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Registro de Daños</h1>
          <p className="text-slate-500 mt-1">Control de pérdidas y daños en inventario</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{showForm ? 'Cancelar' : 'Registrar Daño'}
        </button>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <div className="text-sm text-slate-600">Pérdidas Totales</div>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalPerdidas)}</div>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <div className="text-sm text-slate-600">Items Dañados</div>
              <div className="text-2xl font-bold text-slate-900">{totalItemsDanados} unidades</div>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Package className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <div className="text-sm text-slate-600">Pérdidas Este Mes</div>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(perdidasEsteMes)}</div>
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-sm border-2 border-red-300">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Registrar Nuevo Daño
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Item *</label>
                <select 
                  value={formData.item_inventario_id} 
                  onChange={(e) => setFormData({...formData, item_inventario_id: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" 
                  required
                >
                  <option value="">Seleccionar item...</option>
                  {inventario.map(i => {
                    const disp = i.stock_actual - (i.stock_reservado || 0)
                    return (
                      <option key={i.id} value={i.id}>
                        {i.nombre} (Disp: {disp})
                      </option>
                    )
                  })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad Dañada *</label>
                <input 
                  type="number" 
                  min="1"
                  value={formData.cantidad} 
                  onChange={(e) => setFormData({...formData, cantidad: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Causa del Daño *</label>
                <select 
                  value={formData.causa} 
                  onChange={(e) => setFormData({...formData, causa: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" 
                  required
                >
                  <option value="manipulacion">Manipulación</option>
                  <option value="defecto_fabrica">Defecto de Fábrica</option>
                  <option value="transporte">Transporte</option>
                  <option value="robo">Robo/Extravío</option>
                  <option value="vencimiento">Vencimiento</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Acción Tomada *</label>
                <select 
                  value={formData.accion_tomada} 
                  onChange={(e) => setFormData({...formData, accion_tomada: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" 
                  required
                >
                  <option value="desecho">Desecho</option>
                  <option value="devolucion_proveedor">Devolución a Proveedor</option>
                  <option value="reparacion">Reparación</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción del Incidente</label>
                <textarea 
                  value={formData.descripcion} 
                  onChange={(e) => setFormData({...formData, descripcion: e.target.value})} 
                  rows={3} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="Describa cómo ocurrió el daño..."
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={resetForm} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Registrar Daño
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por item, código o descripción..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
            />
          </div>
          <div>
            <select 
              value={filtroCausa} 
              onChange={(e) => setFiltroCausa(e.target.value)} 
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Todas las causas</option>
              <option value="manipulacion">Manipulación</option>
              <option value="defecto_fabrica">Defecto de Fábrica</option>
              <option value="transporte">Transporte</option>
              <option value="robo">Robo/Extravío</option>
              <option value="vencimiento">Vencimiento</option>
              <option value="otro">Otro</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (<div className="p-8 text-center text-slate-500">Cargando...</div>) : filtered.length === 0 ? (<div className="p-8 text-center text-slate-500">{searchTerm || filtroCausa ? 'No se encontraron registros' : 'No hay registros de daños'}</div>) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">ID</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Item</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-slate-700">Cantidad</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Causa</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Fecha</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Responsable</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-slate-700">Pérdida</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-slate-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-mono text-slate-600">#{r.id}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-900">{r.item_nombre}</div>
                      <div className="text-xs text-slate-500 font-mono">{r.item_codigo}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-bold text-red-600">{r.cantidad}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCausaColor(r.causa)}`}>
                        {getCausaLabel(r.causa)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">{formatDate(r.fecha_damno)}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{r.responsable || '-'}</td>
                    <td className="px-6 py-4 text-sm text-right font-bold text-red-600">{formatCurrency(r.valor_perdida)}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => setModalDetalle(r)} className="p-2 text-slate-600 hover:bg-slate-100 rounded" title="Ver detalle">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalDetalle && (
        <ModalDetalle
          titulo={`Registro de Daño #${modalDetalle.id}`}
          campos={[
            { label: 'Item', value: modalDetalle.item_nombre },
            { label: 'Código', value: modalDetalle.item_codigo },
            { label: '══════════════════════════', value: '', tipo: 'texto' },
            { label: 'CANTIDAD DAÑADA', value: modalDetalle.cantidad.toString(), tipo: 'texto' },
            { label: 'Causa', value: getCausaLabel(modalDetalle.causa), tipo: 'estado' },
            { label: 'Acción Tomada', value: getAccionLabel(modalDetalle.accion_tomada) },
            { label: '══════════════════════════', value: '', tipo: 'texto' },
            { label: 'VALOR DE PÉRDIDA', value: modalDetalle.valor_perdida, tipo: 'moneda' },
            { label: '══════════════════════════', value: '', tipo: 'texto' },
            { label: 'Fecha del Daño', value: formatDate(modalDetalle.fecha_damno), tipo: 'texto' },
            { label: 'Responsable', value: modalDetalle.responsable || '-' },
            { label: 'Descripción', value: modalDetalle.descripcion || '-', tipo: 'texto' },
            { label: 'Orden Asociada', value: modalDetalle.orden_id ? `#${modalDetalle.orden_id}` : 'No asociada' },
          ]}
          onClose={() => setModalDetalle(null)}
        />
      )}
    </div>
  )
}