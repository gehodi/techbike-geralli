import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Edit, Trash2, Save, X, Search, Eye, CheckCircle, XCircle, Package, TrendingUp, TrendingDown, RotateCcw, Truck } from 'lucide-react'
import toast from 'react-hot-toast'
import ModalDetalle from '../components/ModalDetalle'
import ControlesPaginacion from '../components/ControlesPaginacion'

interface Requisicion {
  id: number
  orden_id: number | null
  item_inventario_id: number
  item_nombre: string
  item_codigo: string
  stock_actual: number
  stock_reservado: number
  stock_minimo: number
  cantidad_solicitada: number
  cantidad_entregada: number
  estado: string
  tipo_movimiento: string
  tipo_solicitud: string
  estado_aprobacion: string
  fecha_solicitud: string
  fecha_entrega: string
  fecha_aprobacion: string
  usuario_solicita: string
  usuario_entrega: string
  usuario_aprueba: string
  motivo: string
  justificacion: string
  referencia: string
  ubicacion_destino: string
  notas: string
}

interface ItemInventario {
  id: number
  nombre: string
  codigo: string
  stock_actual: number
  stock_reservado: number
  stock_minimo: number
  ubicacion: string
}

export default function Requisiciones() {
  const { user } = useAuth()
  const formRef = useRef<HTMLDivElement>(null)
  const [requisiciones, setRequisiciones] = useState<Requisicion[]>([])
  const [inventario, setInventario] = useState<ItemInventario[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [modalDetalle, setModalDetalle] = useState<Requisicion | null>(null)
  const [modalAprobacion, setModalAprobacion] = useState<Requisicion | null>(null)
  const [paginaActual, setPaginaActual] = useState(1)
  const [registrosPorPagina, setRegistrosPorPagina] = useState(25)
  const [formData, setFormData] = useState({
    item_inventario_id: '',
    cantidad_solicitada: '',
    tipo_solicitud: 'reposicion',
    tipo_movimiento: 'Entrada',
    motivo: '',
    justificacion: '',
    ubicacion_destino: '',
    notas: ''
  })

  useEffect(() => {
    fetchRequisiciones()
    fetchInventario()
  }, [])

  async function fetchRequisiciones() {
    try {
      const { data, error } = await supabase
        .from('requisiciones_inventario')
        .select('*')
        .order('fecha_solicitud', { ascending: false })
      if (error) throw error
      const enriquecidas = await Promise.all(
        (data || []).map(async (r: any) => {
          const { data: itemData } = await supabase
            .from('inventario')
            .select('nombre, codigo, stock_actual, stock_reservado, stock_minimo')
            .eq('id', r.item_inventario_id)
            .single()
          return {
            ...r,
            item_nombre: itemData?.nombre || 'Item eliminado',
            item_codigo: itemData?.codigo || '-',
            stock_actual: itemData?.stock_actual || 0,
            stock_reservado: itemData?.stock_reservado || 0,
            stock_minimo: itemData?.stock_minimo || 0
          }
        })
      )
      setRequisiciones(enriquecidas)
    } catch (error: any) {
      toast.error('Error al cargar: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchInventario() {
    const { data } = await supabase
      .from('inventario')
      .select('id, nombre, codigo, stock_actual, stock_reservado, stock_minimo, ubicacion')
      .order('nombre')
    setInventario(data || [])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const item = inventario.find(i => i.id === parseInt(formData.item_inventario_id))
      if (!item) {
        toast.error('Seleccione un item válido')
        return
      }
      const cantidad = parseInt(formData.cantidad_solicitada)
      if (cantidad <= 0) {
        toast.error('La cantidad debe ser mayor a cero')
        return
      }
      const data = {
        item_inventario_id: parseInt(formData.item_inventario_id),
        cantidad_solicitada: cantidad,
        cantidad_entregada: 0,
        tipo_solicitud: formData.tipo_solicitud,
        tipo_movimiento: formData.tipo_movimiento,
        estado: 'Pendiente',
        estado_aprobacion: 'Pendiente',
        fecha_solicitud: new Date().toISOString(),
        usuario_solicita: user?.email || 'usuario_desconocido',
        motivo: formData.motivo || null,
        justificacion: formData.justificacion || null,
        ubicacion_destino: formData.ubicacion_destino || null,
        notas: formData.notas || null
      }
      if (editingId) {
        const { error } = await supabase.from('requisiciones_inventario').update(data).eq('id', editingId)
        if (error) throw error
        toast.success('Solicitud actualizada')
      } else {
        const { error } = await supabase.from('requisiciones_inventario').insert([data])
        if (error) throw error
        toast.success('Solicitud registrada')
      }
      resetForm()
      fetchRequisiciones()
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    }
  }

  function handleEdit(r: Requisicion) {
    if (r.estado_aprobacion !== 'Pendiente') {
      toast.error('Solo se pueden editar solicitudes pendientes')
      return
    }
    setFormData({
      item_inventario_id: r.item_inventario_id?.toString() || '',
      cantidad_solicitada: r.cantidad_solicitada.toString(),
      tipo_solicitud: r.tipo_solicitud || 'reposicion',
      tipo_movimiento: r.tipo_movimiento || 'Entrada',
      motivo: r.motivo || '',
      justificacion: r.justificacion || '',
      ubicacion_destino: r.ubicacion_destino || '',
      notas: r.notas || ''
    })
    setEditingId(r.id)
    setShowForm(true)
    setModalDetalle(null)
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta solicitud?')) return
    try {
      const { error } = await supabase.from('requisiciones_inventario').delete().eq('id', id)
      if (error) throw error
      toast.success('Solicitud eliminada')
      fetchRequisiciones()
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    }
  }

  async function handleAprobar() {
    if (!modalAprobacion) return
    if (!confirm(`¿Aprobar solicitud #${modalAprobacion.id} y actualizar inventario?`)) return
    try {
      const req = modalAprobacion
      const cantidad = req.cantidad_solicitada
      // CORRECCIÓN: r eq.tipo_solicitud → req.tipo_solicitud
      const esEntrada = req.tipo_movimiento === 'Entrada' || req.tipo_solicitud === 'reposicion' || req.tipo_solicitud === 'ajuste_positivo'
      const esSalida = req.tipo_movimiento === 'Salida' || req.tipo_solicitud === 'ajuste_negativo' || req.tipo_solicitud === 'devolucion_proveedor'
      // CORRECCIÓN: singl e() → single() y comillas en stock_dañado
       const { data: itemActual, error: errorItem } = await supabase
         .from('inventario')
         .select('stock_actual, stock_reservado, "stock_dañado", ubicacion')
         .eq('id', req.item_inventario_id)
         .single()
      if (errorItem) throw errorItem
      let nuevoStock = itemActual.stock_actual
      let nuevoReservado = itemActual.stock_reservado || 0
      let nuevoDanado = itemActual.stock_dañado || 0
      if (esEntrada) {
        nuevoStock += cantidad
      } else if (esSalida) {
        if (cantidad > itemActual.stock_actual) {
          toast.error('Stock insuficiente para esta salida')
          return
        }
        nuevoStock -= cantidad
      }
      const { error: errorUpdate } = await supabase
        .from('inventario')
        .update({
          stock_actual: nuevoStock,
          stock_reservado: nuevoReservado,
          stock_dañado: nuevoDanado,
          ubicacion: req.ubicacion_destino || itemActual.ubicacion,
          estado: nuevoStock === 0 ? 'agotado' : 'disponible'
        })
        .eq('id', req.item_inventario_id)
      if (errorUpdate) throw errorUpdate
      // CORRECCIÓN: ajuste_inventar io → ajuste_inventario
      const { error: errorMov } = await supabase
        .from('movimientos_inventario')
        .insert({
          item_inventario_id: req.item_inventario_id,
          tipo_movimiento: req.tipo_solicitud === 'reposicion' ? 'entrada_compra' :
            req.tipo_solicitud === 'ajuste_positivo' ? 'ajuste_inventario' :
            req.tipo_solicitud === 'ajuste_negativo' ? 'ajuste_inventario' :
            req.tipo_solicitud === 'devolucion_proveedor' ? 'salida_venta' :
            'traslado_bodega',
          // CORRECCIÓN: can tidad → cantidad
          cantidad: esEntrada ? cantidad : esSalida ? -cantidad : 0,
          stock_anterior: itemActual.stock_actual,
          stock_nuevo: nuevoStock,
          motivo: req.motivo || `Solicitud #${req.id}`,
          referencia: `REQ-${req.id}`,
          requisicion_id: req.id,
          fecha_movimiento: new Date().toISOString(),
          usuario_responsable: user?.email || 'usuario_desconocido'
        })
      if (errorMov) throw errorMov
      // CORRECCIÓN: error Req → errorReq
      const { error: errorReq } = await supabase
        .from('requisiciones_inventario')
        .update({
          estado_aprobacion: 'Aprobada',
          estado: 'Completada',
          cantidad_entregada: cantidad,
          // CORRECCIÓN: toIS OString() → toISOString()
          fecha_entrega: new Date().toISOString(),
          fecha_aprobacion: new Date().toISOString(),
          usuario_aprueba: user?.email || 'usuario_desconocido'
        })
        .eq('id', req.id)
      if (errorReq) throw errorReq
      toast.success(`Solicitud aprobada. Inventario actualizado: ${nuevoStock} unidades`)
      setModalAprobacion(null)
      fetchRequisiciones()
      fetchInventario()
    } catch (error: any) {
      toast.error('Error al aprobar: ' + error.message)
    }
  }

  async function handleRechazar() {
    if (!modalAprobacion) return
    if (!confirm(`¿Rechazar solicitud #${modalAprobacion.id}?`)) return
    try {
      const { error } = await supabase
        .from('requisiciones_inventario')
        .update({
          estado_aprobacion: 'Rechazada',
          estado: 'Cancelada',
          fecha_aprobacion: new Date().toISOString(),
          usuario_aprueba: user?.email || 'usuario_desconocido'
        })
        .eq('id', modalAprobacion.id)
      if (error) throw error
      toast.success('Solicitud rechazada')
      setModalAprobacion(null)
      fetchRequisiciones()
    } catch (error: any) {
      toast.error('Error al rechazar: ' + error.message)
    }
  }

  function resetForm() {
    setFormData({
      item_inventario_id: '',
      cantidad_solicitada: '',
      tipo_solicitud: 'reposicion',
      tipo_movimiento: 'Entrada',
      motivo: '',
      justificacion: '',
      ubicacion_destino: '',
      notas: ''
    })
    setEditingId(null)
    setShowForm(false)
  }

  const getTipoIcon = (tipo: string) => {
    switch(tipo) {
      case 'reposicion': return <TrendingUp className="w-4 h-4 text-green-600" />
      case 'ajuste_positivo': return <TrendingUp className="w-4 h-4 text-blue-600" />
      case 'ajuste_negativo': return <TrendingDown className="w-4 h-4 text-red-600" />
      case 'devolucion_proveedor': return <RotateCcw className="w-4 h-4 text-orange-600" />
      case 'traslado': return <Truck className="w-4 h-4 text-purple-600" />
      default: return <Package className="w-4 h-4 text-slate-600" />
    }
  }

  const getTipoLabel = (tipo: string) => {
    switch(tipo) {
      case 'reposicion': return 'Reposición/Compra'
      case 'ajuste_positivo': return 'Ajuste Positivo'
      case 'ajuste_negativo': return 'Ajuste Negativo'
      case 'devolucion_proveedor': return 'Devolución a Proveedor'
      case 'traslado': return 'Traslado'
      default: return tipo
    }
  }

  const getTipoColor = (tipo: string) => {
    switch(tipo) {
      case 'reposicion': return 'bg-green-100 text-green-800'
      case 'ajuste_positivo': return 'bg-blue-100 text-blue-800'
      case 'ajuste_negativo': return 'bg-red-100 text-red-800'
      case 'devolucion_proveedor': return 'bg-orange-100 text-orange-800'
      case 'traslado': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getEstadoAprobacionColor = (estado: string) => {
    switch(estado) {
      case 'Pendiente': return 'bg-yellow-100 text-yellow-800'
      case 'Aprobada': return 'bg-green-100 text-green-800'
      case 'Rechazada': return 'bg-red-100 text-red-800'
      case 'Completada': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const filtered = requisiciones.filter(r => {
    const matchSearch = r.item_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.item_codigo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.motivo || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchTipo = !filtroTipo || r.tipo_solicitud === filtroTipo
    const matchEstado = !filtroEstado || r.estado_aprobacion === filtroEstado
    return matchSearch && matchTipo && matchEstado
  })

  const totalRegistros = filtered.length
  const inicio = (paginaActual - 1) * registrosPorPagina
  const fin = inicio + registrosPorPagina
  const registrosPaginados = filtered.slice(inicio, fin)

  useEffect(() => {
    setPaginaActual(1)
  }, [searchTerm, filtroTipo, filtroEstado])

  const formatDate = (d: string) => d ? new Date(d).toLocaleString('es-CO', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }) : '-'

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Solicitudes de Inventario</h1>
            <p className="text-slate-500 mt-1">Gestión de reposiciones, ajustes y traslados</p>
          </div>
          <button onClick={() => { resetForm(); setShowForm(!showForm) }} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{showForm ? 'Cancelar' : 'Nueva Solicitud'}
          </button>
        </div>

        {showForm && (
          <div ref={formRef} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 scroll-mt-20">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">{editingId ? 'Editar Solicitud' : 'Nueva Solicitud de Inventario'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Solicitud *</label>
                  <select value={formData.tipo_solicitud} onChange={(e) => {
                    const tipo = e.target.value
                    let mov = 'Entrada'
                    if (tipo === 'ajuste_negativo' || tipo === 'devolucion_proveedor') mov = 'Salida'
                    if (tipo === 'traslado') mov = 'Traslado'
                    setFormData({...formData, tipo_solicitud: tipo, tipo_movimiento: mov})
                  }} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required>
                    <option value="reposicion">Reposición/Compra</option>
                    <option value="ajuste_positivo">Ajuste Positivo</option>
                    <option value="ajuste_negativo">Ajuste Negativo</option>
                    <option value="devolucion_proveedor">Devolución a Proveedor</option>
                    <option value="traslado">Traslado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Item *</label>
                  <select value={formData.item_inventario_id} onChange={(e) => setFormData({...formData, item_inventario_id: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required>
                    <option value="">Seleccionar item...</option>
                    {inventario.map(i => {
                      const disp = i.stock_actual - (i.stock_reservado || 0)
                      return (
                        <option key={i.id} value={i.id}>
                          {i.nombre} (Stock: {i.stock_actual}, Disp: {disp})
                        </option>
                      )
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad *</label>
                  <input type="number" min="1" value={formData.cantidad_solicitada} onChange={(e) => setFormData({...formData, cantidad_solicitada: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Movimiento</label>
                  <input type="text" value={formData.tipo_movimiento} disabled className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Motivo</label>
                  <input type="text" value={formData.motivo} onChange={(e) => setFormData({...formData, motivo: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ej: Stock bajo, conteo físico..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ubicación Destino</label>
                  <input type="text" value={formData.ubicacion_destino} onChange={(e) => setFormData({...formData, ubicacion_destino: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ej: Bodega A, Estante 3" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Justificación *</label>
                  <textarea value={formData.justificacion} onChange={(e) => setFormData({...formData, justificacion: e.target.value})} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required placeholder="Explique el motivo de esta solicitud..." />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
                  <textarea value={formData.notas} onChange={(e) => setFormData({...formData, notas: e.target.value})} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={resetForm} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"><Save className="w-4 h-4" /> {editingId ? 'Actualizar' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Buscar por item, código o motivo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">Todos los tipos</option>
                <option value="reposicion">Reposición/Compra</option>
                <option value="ajuste_positivo">Ajuste Positivo</option>
                <option value="ajuste_negativo">Ajuste Negativo</option>
                <option value="devolucion_proveedor">Devolución a Proveedor</option>
                <option value="traslado">Traslado</option>
              </select>
            </div>
            <div>
              <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">Todos los estados</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Aprobada">Aprobada</option>
                <option value="Rechazada">Rechazada</option>
                <option value="Completada">Completada</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Tipos de Solicitud:</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            <div className="flex items-center gap-2"><TrendingUp className="w-3 h-3 text-green-600" /> <span>Reposición (aumenta stock)</span></div>
            <div className="flex items-center gap-2"><TrendingUp className="w-3 h-3 text-blue-600" /> <span>Ajuste + (aumenta stock)</span></div>
            <div className="flex items-center gap-2"><TrendingDown className="w-3 h-3 text-red-600" /> <span>Ajuste - (disminuye stock)</span></div>
            <div className="flex items-center gap-2"><RotateCcw className="w-3 h-3 text-orange-600" /> <span>Devolución (disminuye stock)</span></div>
            <div className="flex items-center gap-2"><Truck className="w-3 h-3 text-purple-600" /> <span>Traslado (cambia ubicación)</span></div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (<div className="p-8 text-center text-slate-500">Cargando...</div>) : registrosPaginados.length === 0 ? (<div className="p-8 text-center text-slate-500">{searchTerm || filtroTipo || filtroEstado ? 'No se encontraron solicitudes' : 'No hay solicitudes registradas'}</div>) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">ID</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Item</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Tipo</th>
                      <th className="text-right px-6 py-3 text-sm font-medium text-slate-700">Cantidad</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Fecha</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Estado</th>
                      <th className="text-right px-6 py-3 text-sm font-medium text-slate-700">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {registrosPaginados.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-sm font-mono text-slate-600">#{r.id}</td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-slate-900">{r.item_nombre}</div>
                          <div className="text-xs text-slate-500 font-mono">{r.item_codigo}</div>
                          <div className="text-xs text-slate-500">Stock: {r.stock_actual} | Disp: {r.stock_actual - (r.stock_reservado || 0)}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {getTipoIcon(r.tipo_solicitud)}
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTipoColor(r.tipo_solicitud)}`}>
                              {getTipoLabel(r.tipo_solicitud)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-bold text-slate-900">{r.cantidad_solicitada}</td>
                        <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">{formatDate(r.fecha_solicitud)}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoAprobacionColor(r.estado_aprobacion)}`}>
                            {r.estado_aprobacion}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setModalDetalle(r)} className="p-2 text-slate-600 hover:bg-slate-100 rounded" title="Ver detalle"><Eye className="w-4 h-4" /></button>
                            {r.estado_aprobacion === 'Pendiente' && (
                              <>
                                <button onClick={() => handleEdit(r)} className="p-2 text-blue-600 hover:bg-blue-50 rounded" title="Editar"><Edit className="w-4 h-4" /></button>
                                <button onClick={() => setModalAprobacion(r)} className="p-2 text-green-600 hover:bg-green-50 rounded" title="Aprobar"><CheckCircle className="w-4 h-4" /></button>
                                <button onClick={() => { setModalAprobacion(r); setTimeout(handleRechazar, 100) }} className="p-2 text-red-600 hover:bg-red-50 rounded" title="Rechazar"><XCircle className="w-4 h-4" /></button>
                                <button onClick={() => handleDelete(r.id)} className="p-2 text-red-600 hover:bg-red-50 rounded" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                              </>
                            )}
                          </div>
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
      </div>

      {modalDetalle && (
        <ModalDetalle
          titulo={`Solicitud #${modalDetalle.id}`}
          campos={[
            { label: 'Item', value: modalDetalle.item_nombre },
            { label: 'Código', value: modalDetalle.item_codigo },
            { label: 'Tipo de Solicitud', value: getTipoLabel(modalDetalle.tipo_solicitud), tipo: 'estado' },
            { label: 'Tipo de Movimiento', value: modalDetalle.tipo_movimiento },
            { label: '══════════════════════════', value: '', tipo: 'texto' },
            { label: 'CANTIDAD SOLICITADA', value: modalDetalle.cantidad_solicitada.toString(), tipo: 'texto' },
            { label: 'CANTIDAD ENTREGADA', value: (modalDetalle.cantidad_entregada || 0).toString(), tipo: 'texto' },
            { label: '══════════════════════════', value: '', tipo: 'texto' },
            { label: 'STOCK ACTUAL', value: modalDetalle.stock_actual.toString(), tipo: 'texto' },
            { label: 'STOCK RESERVADO', value: (modalDetalle.stock_reservado || 0).toString(), tipo: 'texto' },
            { label: 'STOCK DISPONIBLE', value: (modalDetalle.stock_actual - (modalDetalle.stock_reservado || 0)).toString(), tipo: 'texto' },
            { label: 'Stock Mínimo', value: modalDetalle.stock_minimo.toString(), tipo: 'texto' },
            { label: '══════════════════════════', value: '', tipo: 'texto' },
            { label: 'Estado Aprobación', value: modalDetalle.estado_aprobacion, tipo: 'estado' },
            { label: 'Fecha Solicitud', value: formatDate(modalDetalle.fecha_solicitud), tipo: 'texto' },
            { label: 'Fecha Aprobación', value: modalDetalle.fecha_aprobacion ? formatDate(modalDetalle.fecha_aprobacion) : '-', tipo: 'texto' },
            { label: 'Fecha Entrega', value: modalDetalle.fecha_entrega ? formatDate(modalDetalle.fecha_entrega) : '-', tipo: 'texto' },
            { label: 'Usuario Solicita', value: modalDetalle.usuario_solicita || '-' },
            { label: 'Usuario Aprueba', value: modalDetalle.usuario_aprueba || '-' },
            { label: '══════════════════════════', value: '', tipo: 'texto' },
            { label: 'Motivo', value: modalDetalle.motivo || '-', tipo: 'texto' },
            { label: 'Justificación', value: modalDetalle.justificacion || '-', tipo: 'texto' },
            { label: 'Ubicación Destino', value: modalDetalle.ubicacion_destino || '-' },
            { label: 'Notas', value: modalDetalle.notas || '-', tipo: 'texto' },
          ]}
          onClose={() => setModalDetalle(null)}
        />
      )}

      {modalAprobacion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Aprobar Solicitud #{modalAprobacion.id}
              </h3>
            </div>
            <div className="p-6 space-y-3">
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="text-sm text-slate-600">Item: <span className="font-medium text-slate-900">{modalAprobacion.item_nombre}</span></div>
                <div className="text-sm text-slate-600">Código: <span className="font-mono">{modalAprobacion.item_codigo}</span></div>
                <div className="text-sm text-slate-600">Tipo: <span className={`px-2 py-1 rounded ${getTipoColor(modalAprobacion.tipo_solicitud)}`}>{getTipoLabel(modalAprobacion.tipo_solicitud)}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-xs text-slate-600">Cantidad Solicitada</div>
                  <div className="text-2xl font-bold text-blue-600">{modalAprobacion.cantidad_solicitada}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="text-xs text-slate-600">Stock Actual</div>
                  <div className="text-2xl font-bold text-slate-900">{modalAprobacion.stock_actual}</div>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                <div className="text-xs text-yellow-800 font-medium mb-1">Justificación:</div>
                <div className="text-sm text-slate-700">{modalAprobacion.justificacion || 'Sin justificación'}</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                <div className="text-sm text-blue-800">
                  <strong>Stock resultante:</strong> {modalAprobacion.stock_actual + (modalAprobacion.tipo_movimiento === 'Entrada' ? modalAprobacion.cantidad_solicitada : -modalAprobacion.cantidad_solicitada)} unidades
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => setModalAprobacion(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button onClick={handleRechazar} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"><XCircle className="w-4 h-4" /> Rechazar</button>
              <button onClick={handleAprobar} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Aprobar y Actualizar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}