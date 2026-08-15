import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Edit, Trash2, Save, X, Search, Eye, Camera, CheckCircle, XCircle, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import ModalDetalle from '../components/ModalDetalle'
import SelectorBicicletaCliente from '../components/SelectorBicicletaCliente'

interface Solicitud {
  id: number
  cliente_id: string
  cliente_nombre: string
  bicicleta_id: string
  bicicleta_info: string
  bicicleta_foto?: string
  tipo_servicio: string
  sintomas: string
  estado: string
  fue_cotizada: boolean
  fecha_solicitud: string
  notas: string
  fecha_registro: string
}

interface Cliente {
  id: string
  nombres: string
  apellidos: string
}

export default function Solicitudes() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [modalDetalle, setModalDetalle] = useState<Solicitud | null>(null)
  const [formData, setFormData] = useState({
    cliente_id: '', bicicleta_id: '', tipo_servicio: '',
    sintomas: '', estado: 'Nueva', notas: ''
  })

  useEffect(() => {
    fetchSolicitudes()
    fetchClientes()
  }, [])

  async function fetchSolicitudes() {
    try {
      const { data, error } = await supabase
        .from('solicitudes_servicio')
        .select(`*, clientes(nombres, apellidos), bicicletas(marca, modelo, foto_principal_url)`)
        .order('fecha_solicitud', { ascending: false })
      
      if (error) throw error
      
      const procesadas = data?.map((s: any) => ({
        ...s,
        cliente_nombre: s.clientes ? `${s.clientes.nombres} ${s.clientes.apellidos}` : 'Sin cliente',
        bicicleta_info: s.bicicletas ? `${s.bicicletas.marca} ${s.bicicletas.modelo}` : 'Sin bicicleta',
        bicicleta_foto: s.bicicletas?.foto_principal_url || null
      })) || []
      
      setSolicitudes(procesadas)
    } catch (error: any) {
      toast.error('Error al cargar: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchClientes() {
    const { data } = await supabase
      .from('clientes')
      .select('id, nombres, apellidos')
      .order('apellidos')
    setClientes(data || [])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const data = {
        cliente_id: formData.cliente_id || null,
        bicicleta_id: formData.bicicleta_id || null,
        tipo_servicio: formData.tipo_servicio || null,
        sintomas: formData.sintomas || null,
        estado: formData.estado,
        fue_cotizada: false,
        notas: formData.notas || null,
        fecha_solicitud: new Date().toISOString()
      }

      if (editingId) {
        const { error } = await supabase
          .from('solicitudes_servicio')
          .update(data)
          .eq('id', editingId)
        if (error) throw error
        toast.success('Solicitud actualizada')
      } else {
        const { error } = await supabase
          .from('solicitudes_servicio')
          .insert([data])
        if (error) throw error
        toast.success('Solicitud registrada')
      }
      
      resetForm()
      fetchSolicitudes()
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    }
  }

  async function handleAprobarSolicitud(solicitud: Solicitud) {
    if (solicitud.estado !== 'Nueva') {
      toast.error('Solo se pueden aprobar solicitudes nuevas')
      return
    }
    
    if (!confirm(`¿Aprobar solicitud #${solicitud.id}?`)) return
    
    try {
      const { error } = await supabase
        .from('solicitudes_servicio')
        .update({ estado: 'Aprobada' })
        .eq('id', solicitud.id)
      
      if (error) throw error
      toast.success('Solicitud aprobada correctamente')
      fetchSolicitudes()
    } catch (error: any) {
      toast.error('Error al aprobar: ' + error.message)
    }
  }

  async function handleRechazarSolicitud(solicitud: Solicitud) {
    if (solicitud.estado !== 'Nueva') {
      toast.error('Solo se pueden rechazar solicitudes nuevas')
      return
    }
    
    if (!confirm(`¿Rechazar solicitud #${solicitud.id}?`)) return
    
    try {
      const { error } = await supabase
        .from('solicitudes_servicio')
        .update({ estado: 'Rechazada' })
        .eq('id', solicitud.id)
      
      if (error) throw error
      toast.success('Solicitud rechazada')
      fetchSolicitudes()
    } catch (error: any) {
      toast.error('Error al rechazar: ' + error.message)
    }
  }

  function handleEdit(s: Solicitud) {
    if (s.estado === 'Aprobada' || s.estado === 'Rechazada') {
      toast.error('No se puede modificar una solicitud aprobada o rechazada')
      return
    }
    
    setFormData({
      cliente_id: s.cliente_id || '',
      bicicleta_id: s.bicicleta_id || '',
      tipo_servicio: s.tipo_servicio || '',
      sintomas: s.sintomas || '',
      estado: s.estado || 'Nueva',
      notas: s.notas || ''
    })
    setEditingId(s.id)
    setShowForm(true)
    setModalDetalle(null)
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta solicitud?')) return
    try {
      const { error } = await supabase
        .from('solicitudes_servicio')
        .delete()
        .eq('id', id)
      if (error) throw error
      toast.success('Solicitud eliminada')
      fetchSolicitudes()
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    }
  }

  function resetForm() {
    setFormData({
      cliente_id: '', bicicleta_id: '', tipo_servicio: '',
      sintomas: '', estado: 'Nueva', notas: ''
    })
    setEditingId(null)
    setShowForm(false)
  }

  const getEstadoColor = (estado: string) => {
    switch(estado) {
      case 'Nueva': return 'bg-blue-100 text-blue-800'
      case 'Aprobada': return 'bg-green-100 text-green-800'
      case 'Rechazada': return 'bg-red-100 text-red-800'
      case 'Cotizada': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const filtered = solicitudes.filter(s =>
    s.cliente_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.bicicleta_info?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.tipo_servicio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.id.toString().includes(searchTerm)
  )

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('es-CO') : '-'

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Solicitudes de Servicio</h1>
          <p className="text-slate-500 mt-1">Registro de solicitudes de clientes</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm) }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancelar' : 'Nueva Solicitud'}
        </button>
      </div>

      {/* MODAL DE FORMULARIO CENTRADO */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-800">
                {editingId ? `Editar Solicitud #${editingId}` : 'Nueva Solicitud'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cliente *</label>
                  <select
                    value={formData.cliente_id}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        cliente_id: e.target.value,
                        bicicleta_id: ''
                      })
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  >
                    <option value="">Seleccionar cliente...</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nombres} {c.apellidos}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bicicleta *</label>
                  <SelectorBicicletaCliente
                    clienteId={formData.cliente_id}
                    value={formData.bicicleta_id}
                    onChange={(bicicletaId) => setFormData({...formData, bicicleta_id: bicicletaId})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Servicio *</label>
                  <select
                    value={formData.tipo_servicio}
                    onChange={(e) => setFormData({...formData, tipo_servicio: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Mantenimiento Preventivo">Mantenimiento Preventivo</option>
                    <option value="Reparación">Reparación</option>
                    <option value="Ajuste">Ajuste</option>
                    <option value="Diagnóstico">Diagnóstico</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                  <div className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor(formData.estado)}`}>
                      {formData.estado}
                    </span>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Solo se modifica al aprobar/rechazar
                    </p>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Síntomas / Descripción del Problema *</label>
                  <textarea
                    value={formData.sintomas}
                    onChange={(e) => setFormData({...formData, sintomas: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                    placeholder="Describa los síntomas o el problema reportado por el cliente..."
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notas Adicionales</label>
                  <textarea
                    value={formData.notas}
                    onChange={(e) => setFormData({...formData, notas: e.target.value})}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Observaciones internas..."
                  />
                </div>
              </div>
              
              <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {editingId ? 'Actualizar' : 'Guardar Solicitud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por cliente, bicicleta, tipo de servicio o ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {searchTerm ? 'No se encontraron solicitudes' : 'No hay solicitudes registradas'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[1100px]">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">ID</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Foto</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Cliente</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Bicicleta</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Tipo Servicio</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Fecha</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Estado</th>
                    <th className="sticky right-0 bg-slate-50 border-l-2 border-slate-200 px-6 py-3 text-sm font-medium text-slate-700 z-10 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-slate-50 cursor-pointer group"
                      onClick={() => setModalDetalle(s)}
                    >
                      <td className="px-6 py-4 text-sm font-mono text-slate-600">#{s.id}</td>
                      <td className="px-6 py-4">
                        {s.bicicleta_foto ? (
                          <img
                            src={s.bicicleta_foto}
                            alt="Foto bicicleta"
                            className="h-12 w-12 object-cover rounded-lg border border-slate-200 cursor-pointer hover:scale-110 transition-transform"
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(s.bicicleta_foto, '_blank')
                            }}
                          />
                        ) : (
                          <div className="h-12 w-12 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center">
                            <Camera className="w-5 h-5 text-slate-400" />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{s.cliente_nombre}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{s.bicicleta_info}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{s.tipo_servicio}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{formatDate(s.fecha_solicitud)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor(s.estado)}`}>
                          {s.estado}
                        </span>
                        {s.fue_cotizada && (
                          <span className="ml-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            Cotizada
                          </span>
                        )}
                      </td>
                      <td className="sticky right-0 bg-white group-hover:bg-slate-50 border-l-2 border-slate-200 px-6 py-4 text-right z-10 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setModalDetalle(s)}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {s.estado === 'Nueva' ? (
                            <>
                              <button
                                onClick={() => handleAprobarSolicitud(s)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded"
                                title="Aprobar solicitud"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRechazarSolicitud(s)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded"
                                title="Rechazar solicitud"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleEdit(s)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <span className="p-2 text-slate-400" title="Solicitud bloqueada">
                              <Lock className="w-4 h-4" />
                            </span>
                          )}
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {modalDetalle && (
        <ModalDetalle
          titulo={`Solicitud #${modalDetalle.id}`}
          campos={[
            { label: 'Foto Bicicleta', value: modalDetalle.bicicleta_foto, tipo: 'imagen' },
            { label: 'Cliente', value: modalDetalle.cliente_nombre },
            { label: 'Bicicleta', value: modalDetalle.bicicleta_info },
            { label: 'Tipo de Servicio', value: modalDetalle.tipo_servicio },
            { label: 'Estado', value: modalDetalle.estado, tipo: 'estado' },
            { label: 'Fecha Solicitud', value: modalDetalle.fecha_solicitud, tipo: 'fecha' },
            { label: 'Fue Cotizada', value: modalDetalle.fue_cotizada ? 'Sí' : 'No' },
            { label: 'Síntomas', value: modalDetalle.sintomas || '-', tipo: 'texto' },
            { label: 'Notas', value: modalDetalle.notas || '-', tipo: 'texto' },
          ]}
          onClose={() => setModalDetalle(null)}
        />
      )}
    </div>
  )
}