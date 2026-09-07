import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, X, Search, Eye, AlertTriangle, CheckCircle, XCircle, Shield, Clock, Wrench, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import ModalDetalle from '../components/ModalDetalle'
import ControlesPaginacion from '../components/ControlesPaginacion'

interface Reclamacion {
  id: number
  numero_reclamacion: string
  garantia_id: string
  fecha_reclamacion: string
  descripcion_falla: string
  componente_afectado: string
  estado: string
  motivo_rechazo: string
  orden_servicio_id: number
  costo_mano_obra_garantia: number
  costo_repuestos_cliente: number
  fecha_resolucion: string
  observaciones: string
  cliente_nombre: string
  bicicleta_codigo: string
  bicicleta_info: string
  garantia_vencimiento: string
}

interface GarantiaDisponible {
  id: string
  venta_id: string
  numero_factura: string
  cliente_nombre: string
  bicicleta_codigo: string
  bicicleta_info: string
  fecha_fin: string
}

export default function ReclamacionesGarantia() {
  const navigate = useNavigate()
  const [reclamaciones, setReclamaciones] = useState<Reclamacion[]>([])
  const [garantiasDisponibles, setGarantiasDisponibles] = useState<GarantiaDisponible[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<string>('todas')
  const [modalDetalle, setModalDetalle] = useState<Reclamacion | null>(null)
  const [paginaActual, setPaginaActual] = useState(1)
  const [registrosPorPagina, setRegistrosPorPagina] = useState(25)
  const [totalRegistros, setTotalRegistros] = useState(0)
  const [procesando, setProcesando] = useState(false)

  const [selectedGarantiaId, setSelectedGarantiaId] = useState<string>('')
  const [formData, setFormData] = useState({
    descripcion_falla: '',
    componente_afectado: '',
    observaciones: ''
  })

  useEffect(() => {
    fetchReclamaciones()
  }, [paginaActual, registrosPorPagina, searchTerm, filtroEstado])

  useEffect(() => {
    if (showForm) fetchGarantiasDisponibles()
  }, [showForm])

  async function fetchReclamaciones() {
    try {
      setLoading(true)

      let query = supabase
        .from('reclamaciones_garantia')
        .select(`
          *,
          garantias(
            venta_id,
            cliente_nombre,
            fecha_fin,
            bicicletas_adquiridas(codigo_inventario, marca, modelo)
          )
        `, { count: 'exact' })
        .order('fecha_reclamacion', { ascending: false })

      if (searchTerm) {
        const term = `%${searchTerm}%`
        query = query.or(`numero_reclamacion.ilike.${term},descripcion_falla.ilike.${term}`)
      }

      const { data, error, count } = await query
      if (error) throw error
      setTotalRegistros(count || 0)

      const procesadas: Reclamacion[] = (data || []).map((r: any) => ({
        ...r,
        cliente_nombre: r.garantias?.cliente_nombre || '-',
        bicicleta_codigo: r.garantias?.bicicletas_adquiridas?.codigo_inventario || '-',
        bicicleta_info: `${r.garantias?.bicicletas_adquiridas?.marca || ''} ${r.garantias?.bicicletas_adquiridas?.modelo || ''}`.trim() || '-',
        garantia_vencimiento: r.garantias?.fecha_fin || '-'
      }))

      let filtradas = procesadas
      if (filtroEstado !== 'todas') {
        filtradas = procesadas.filter(r => r.estado === filtroEstado)
      }

      const desde = (paginaActual - 1) * registrosPorPagina
      const hasta = desde + registrosPorPagina
      setReclamaciones(filtradas.slice(desde, hasta))
      if (filtroEstado !== 'todas') {
        setTotalRegistros(filtradas.length)
      }
    } catch (error: any) {
      console.error('Error cargando reclamaciones:', error)
      toast.error('Error al cargar: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchGarantiasDisponibles() {
    try {
      const hoy = new Date().toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('garantias')
        .select(`
          id,
          venta_id,
          cliente_nombre,
          fecha_fin,
          bicicletas_adquiridas(codigo_inventario, marca, modelo),
          ventas(numero_factura)
        `)
        .eq('estado', 'vigente')
        .gte('fecha_fin', hoy)
        .order('fecha_fin', { ascending: true })

      if (error) throw error

      const procesadas: GarantiaDisponible[] = (data || []).map((g: any) => ({
        ...g,
        numero_factura: g.ventas?.numero_factura || '-',
        bicicleta_codigo: g.bicicletas_adquiridas?.codigo_inventario || '-',
        bicicleta_info: `${g.bicicletas_adquiridas?.marca || ''} ${g.bicicletas_adquiridas?.modelo || ''}`.trim() || '-'
      }))

      setGarantiasDisponibles(procesadas)
    } catch (error: any) {
      console.error('Error cargando garantías:', error)
      toast.error('Error al cargar garantías disponibles')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedGarantiaId) {
      toast.error('Selecciona una garantía')
      return
    }
    if (!formData.descripcion_falla.trim()) {
      toast.error('Describe la falla')
      return
    }

    setProcesando(true)
    try {
      const { data: reclamacion, error: errorReclamacion } = await supabase
        .from('reclamaciones_garantia')
        .insert([{
          garantia_id: selectedGarantiaId,
          descripcion_falla: formData.descripcion_falla.trim(),
          componente_afectado: formData.componente_afectado.trim() || null,
          estado: 'pendiente',
          observaciones: formData.observaciones.trim() || null,
          numero_reclamacion: '' // El trigger lo genera
        }])
        .select()
        .single()

      if (errorReclamacion) throw errorReclamacion

      toast.success(`Reclamación ${reclamacion.numero_reclamacion} registrada`)
      resetForm()
      fetchReclamaciones()
    } catch (error: any) {
      toast.error('Error al registrar: ' + error.message)
    } finally {
      setProcesando(false)
    }
  }

  async function cambiarEstado(reclamacionId: number, nuevoEstado: string, motivoRechazo?: string) {
    try {
      const data: any = { estado: nuevoEstado }

      if (nuevoEstado === 'rechazada' && motivoRechazo) {
        data.motivo_rechazo = motivoRechazo
      }
      if (nuevoEstado === 'resuelta') {
        data.fecha_resolucion = new Date().toISOString()
      }

      const { error } = await supabase
        .from('reclamaciones_garantia')
        .update(data)
        .eq('id', reclamacionId)

      if (error) throw error

      toast.success(`Estado actualizado a: ${nuevoEstado}`)
      fetchReclamaciones()
    } catch (error: any) {
      toast.error('Error al actualizar: ' + error.message)
    }
  }

  async function crearOrdenServicio(reclamacion: Reclamacion) {
    try {
      const { data: orden, error: errorOrden } = await supabase
        .from('ordenes_servicio')
        .insert([{
          tipo_orden: 'garantia',
          reclamacion_garantia_id: reclamacion.id,
          estado: 'Pendiente',
          fecha_ingreso: new Date().toISOString().split('T')[0],
          numero_orden: '',
          diagnostico: reclamacion.descripcion_falla,
          notas: `Reclamación: ${reclamacion.numero_reclamacion}`
        }])
        .select()
        .single()

      if (errorOrden) throw errorOrden

      await supabase
        .from('reclamaciones_garantia')
        .update({
          estado: 'en_reparacion',
          orden_servicio_id: orden.id
        })
        .eq('id', reclamacion.id)

      toast.success(`Orden ${orden.numero_orden} creada`)
      // ✅ Navegar directamente a la orden con el modal de completado abierto
      navigate(`/ordenes-internas?completar=${orden.id}`)
    } catch (error: any) {
      toast.error('Error al crear orden: ' + error.message)
    }
  }

  function resetForm() {
    setShowForm(false)
    setSelectedGarantiaId('')
    setFormData({ descripcion_falla: '', componente_afectado: '', observaciones: '' })
  }

  const getEstadoColor = (estado: string) => {
    const colores: Record<string, string> = {
      'pendiente': 'bg-yellow-100 text-yellow-800',
      'en_evaluacion': 'bg-blue-100 text-blue-800',
      'aprobada': 'bg-green-100 text-green-800',
      'rechazada': 'bg-red-100 text-red-800',
      'en_reparacion': 'bg-purple-100 text-purple-800',
      'resuelta': 'bg-slate-100 text-slate-800'
    }
    return colores[estado] || 'bg-gray-100 text-gray-800'
  }

  const getEstadoTexto = (estado: string) => {
    const textos: Record<string, string> = {
      'pendiente': 'PENDIENTE',
      'en_evaluacion': 'EN EVALUACIÓN',
      'aprobada': 'APROBADA',
      'rechazada': 'RECHAZADA',
      'en_reparacion': 'EN REPARACIÓN',
      'resuelta': 'RESUELTA'
    }
    return textos[estado] || estado.toUpperCase()
  }

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('es-CO') : '-'

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reclamaciones de Garantía</h1>
          <p className="text-slate-500 mt-1">Gestión de fallas y reparaciones bajo garantía</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700"
        >
          <Plus className="w-4 h-4" /> Nueva Reclamación
        </button>
      </div>

      {/* Filtros de Estado */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: 'todas', label: 'Todas', icon: Shield },
          { id: 'pendiente', label: 'Pendientes', icon: Clock },
          { id: 'en_evaluacion', label: 'En Evaluación', icon: AlertTriangle },
          { id: 'aprobada', label: 'Aprobadas', icon: CheckCircle },
          { id: 'rechazada', label: 'Rechazadas', icon: XCircle },
          { id: 'en_reparacion', label: 'En Reparación', icon: Wrench },
          { id: 'resuelta', label: 'Resueltas', icon: FileText },
        ].map((filtro) => {
          const Icon = filtro.icon
          return (
            <button
              key={filtro.id}
              onClick={() => { setFiltroEstado(filtro.id); setPaginaActual(1) }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                filtroEstado === filtro.id
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {filtro.label}
            </button>
          )
        })}
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por número de reclamación o descripción..."
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setPaginaActual(1) }}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
        />
      </div>

      {/* Tabla de Reclamaciones */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">
            <div className="inline-block w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-2"></div>
            <p>Cargando reclamaciones...</p>
          </div>
        ) : reclamaciones.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {searchTerm ? 'No se encontraron reclamaciones' : 'No hay reclamaciones en esta categoría'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[1100px]">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Reclamación</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Fecha</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Cliente</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Bicicleta</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Componente</th>
                    <th className="text-center px-6 py-3 text-sm font-medium text-slate-700">Estado</th>
                    <th className="sticky right-0 bg-slate-50 border-l-2 border-slate-200 px-6 py-3 text-sm font-medium text-slate-700 z-10">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {reclamaciones.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono font-medium text-slate-900">{r.numero_reclamacion}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{formatDate(r.fecha_reclamacion)}</td>
                      <td className="px-6 py-4 text-sm text-slate-800">{r.cliente_nombre}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <div>{r.bicicleta_codigo}</div>
                        <div className="text-xs text-slate-400">{r.bicicleta_info}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{r.componente_afectado || '-'}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor(r.estado)}`}>
                          {getEstadoTexto(r.estado)}
                        </span>
                      </td>
                      <td className="sticky right-0 bg-white border-l-2 border-slate-200 px-6 py-4 text-right z-10">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setModalDetalle(r)}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {r.estado === 'pendiente' && (
                            <>
                              <button
                                onClick={() => cambiarEstado(r.id, 'en_evaluacion')}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Evaluar"
                              >
                                <AlertTriangle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  const motivo = prompt('Motivo del rechazo:')
                                  if (motivo) cambiarEstado(r.id, 'rechazada', motivo)
                                }}
                                className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Rechazar"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {r.estado === 'en_evaluacion' && (
                            <>
                              <button
                                onClick={() => cambiarEstado(r.id, 'aprobada')}
                                className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="Aprobar"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  const motivo = prompt('Motivo del rechazo:')
                                  if (motivo) cambiarEstado(r.id, 'rechazada', motivo)
                                }}
                                className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Rechazar"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {r.estado === 'aprobada' && (
                            <button
                              onClick={() => crearOrdenServicio(r)}
                              className="p-2 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                              title="Crear Orden de Servicio"
                            >
                              <Wrench className="w-4 h-4" />
                            </button>
                          )}

                          {/* ✅ CAMBIO: Navegación directa con parámetro completar */}
                          {r.estado === 'en_reparacion' && r.orden_servicio_id && (
                            <button
                              onClick={() => navigate(`/ordenes-internas?completar=${r.orden_servicio_id}`)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Completar Orden de Servicio"
                            >
                              <Wrench className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ControlesPaginacion
        paginaActual={paginaActual}
        totalRegistros={totalRegistros}
        registrosPorPagina={registrosPorPagina}
        onPageChange={setPaginaActual}
        onRegistrosPorPaginaChange={(c) => { setRegistrosPorPagina(c); setPaginaActual(1) }}
      />

      {/* Modal Formulario Nueva Reclamación */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Nueva Reclamación de Garantía</h2>
              <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Garantía Vigente *</label>
                <select
                  value={selectedGarantiaId}
                  onChange={(e) => setSelectedGarantiaId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  required
                >
                  <option value="">Seleccionar garantía...</option>
                  {garantiasDisponibles.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.numero_factura} - {g.cliente_nombre} ({g.bicicleta_codigo}) - Vence: {formatDate(g.fecha_fin)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción de la Falla *</label>
                <textarea
                  value={formData.descripcion_falla}
                  onChange={(e) => setFormData({...formData, descripcion_falla: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  required
                  placeholder="Describe el problema reportado por el cliente..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Componente Afectado</label>
                <input
                  type="text"
                  value={formData.componente_afectado}
                  onChange={(e) => setFormData({...formData, componente_afectado: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  placeholder="Ej: Frenos, Transmisión, Cuadro..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observaciones</label>
                <textarea
                  value={formData.observaciones}
                  onChange={(e) => setFormData({...formData, observaciones: e.target.value})}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  placeholder="Notas adicionales..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button type="button" onClick={resetForm} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesando}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 disabled:opacity-50"
                >
                  {procesando ? 'Procesando...' : <><Plus className="w-4 h-4" /> Registrar Reclamación</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalle */}
      {modalDetalle && (
        <ModalDetalle
          titulo={`Reclamación ${modalDetalle.numero_reclamacion}`}
          campos={[
            { label: 'Cliente', value: modalDetalle.cliente_nombre },
            { label: 'Bicicleta', value: `${modalDetalle.bicicleta_codigo} - ${modalDetalle.bicicleta_info}` },
            { label: 'Garantía Vence', value: modalDetalle.garantia_vencimiento, tipo: 'fecha' },
            { label: 'Fecha Reclamación', value: modalDetalle.fecha_reclamacion, tipo: 'fecha' },
            { label: 'Componente Afectado', value: modalDetalle.componente_afectado || '-' },
            { label: 'Estado', value: getEstadoTexto(modalDetalle.estado), tipo: 'estado' },
            { label: 'Descripción de Falla', value: modalDetalle.descripcion_falla, tipo: 'texto' },
            { label: 'Orden de Servicio', value: modalDetalle.orden_servicio_id ? `OS #${modalDetalle.orden_servicio_id}` : 'No creada' },
            { label: 'Observaciones', value: modalDetalle.observaciones || '-', tipo: 'texto' },
            { label: 'Motivo Rechazo', value: modalDetalle.motivo_rechazo || '-', tipo: 'texto' },
          ]}
          onClose={() => setModalDetalle(null)}
        />
      )}
    </div>
  )
}