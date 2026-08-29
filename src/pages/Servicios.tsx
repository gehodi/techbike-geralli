import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Edit, Trash2, Save, X, Search, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import ModalDetalle from '../components/ModalDetalle'

interface Servicio {
  id: number
  nombre: string
  descripcion: string
  costo_mano_obra: number
  precio_cliente: number
  activo: boolean
}

export default function Servicios() {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [modalDetalle, setModalDetalle] = useState<Servicio | null>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const [formData, setFormData] = useState({
    nombre: '', descripcion: '', costo_mano_obra: '', precio_cliente: '', activo: true
  })

  useEffect(() => { fetchServicios() }, [])

  async function fetchServicios() {
    try {
      const { data, error } = await supabase.from('servicios').select('*').order('nombre')
      if (error) throw error
      setServicios(data || [])
    } catch (error: any) {
      toast.error('Error al cargar: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const costoMO = parseFloat(formData.costo_mano_obra) || 0
    const precioCliente = parseFloat(formData.precio_cliente) || 0
    if (precioCliente <= 0) {
      toast.error('El precio al cliente debe ser mayor a cero')
      return
    }
    try {
      const data = {
        nombre: formData.nombre.trim(),
        descripcion: formData.descripcion.trim() || null,
        costo_mano_obra: costoMO,
        precio_cliente: precioCliente,
        activo: formData.activo
      }
      if (editingId) {
        const { error } = await supabase.from('servicios').update(data).eq('id', editingId)
        if (error) throw error
        toast.success('Servicio actualizado correctamente')
      } else {
        const { error } = await supabase.from('servicios').insert([data])
        if (error) throw error
        toast.success('Servicio registrado correctamente')
      }
      resetForm()
      fetchServicios()
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    }
  }

  function handleEdit(s: Servicio) {
    setFormData({
      nombre: s.nombre,
      descripcion: s.descripcion || '',
      costo_mano_obra: s.costo_mano_obra?.toString() || '0',
      precio_cliente: s.precio_cliente?.toString() || '0',
      activo: s.activo !== false
    })
    setEditingId(s.id)
    setShowForm(true)
    setModalDetalle(null)
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este servicio?')) return
    try {
      const { error } = await supabase.from('servicios').delete().eq('id', id)
      if (error) throw error
      toast.success('Servicio eliminado')
      fetchServicios()
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    }
  }

  function resetForm() {
    setFormData({ nombre: '', descripcion: '', costo_mano_obra: '', precio_cliente: '', activo: true })
    setEditingId(null)
    setShowForm(false)
  }

  const filtered = servicios.filter(s =>
    s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.descripcion || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatCurrency = (v: number | null | undefined) => {
    if (v === null || v === undefined) return '$0.00'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(v)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Servicios Técnicos</h1>
          <p className="text-slate-500 mt-1">Catálogo de servicios de mantenimiento y reparación</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(!showForm) }} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancelar' : 'Nuevo Servicio'}
        </button>
      </div>

      {showForm && (
        <div ref={formRef} className="bg-white p-6 rounded-xl shadow-sm border-2 border-blue-200">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            {editingId ? `Editar Servicio #${editingId}` : 'Nuevo Servicio'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Servicio *</label>
                <input 
                  type="text" 
                  value={formData.nombre} 
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  required 
                  placeholder="Ej: Afinación Completa"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                <select 
                  value={formData.activo ? 'true' : 'false'} 
                  onChange={(e) => setFormData({...formData, activo: e.target.value === 'true'})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Costo Mano de Obra</label>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  value={formData.costo_mano_obra} 
                  onChange={(e) => setFormData({...formData, costo_mano_obra: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Precio al Cliente *</label>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  value={formData.precio_cliente} 
                  onChange={(e) => setFormData({...formData, precio_cliente: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  required
                  placeholder="0"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción Detallada</label>
                <textarea 
                  value={formData.descripcion} 
                  onChange={(e) => setFormData({...formData, descripcion: e.target.value})} 
                  rows={3} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Descripción detallada del servicio..."
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-slate-200">
              <button type="button" onClick={resetForm} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                <Save className="w-4 h-4" /> {editingId ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Buscar servicios..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">{searchTerm ? 'No se encontraron servicios' : 'No hay servicios registrados'}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">ID</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Nombre</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-slate-700">Costo M.O.</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-slate-700">Precio Cliente</th>
                  <th className="text-center px-6 py-3 text-sm font-medium text-slate-700">Estado</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-slate-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setModalDetalle(s)}>
                    <td className="px-6 py-4 text-sm font-mono text-slate-600">#{s.id}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{s.nombre}</td>
                    <td className="px-6 py-4 text-sm text-right text-slate-600">{formatCurrency(s.costo_mano_obra)}</td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-slate-900">{formatCurrency(s.precio_cliente)}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.activo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {s.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setModalDetalle(s)} className="p-2 text-slate-600 hover:bg-slate-100 rounded" title="Ver detalle"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => handleEdit(s)} className="p-2 text-blue-600 hover:bg-blue-50 rounded" title="Editar servicio"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(s.id)} className="p-2 text-red-600 hover:bg-red-50 rounded" title="Eliminar servicio"><Trash2 className="w-4 h-4" /></button>
                      </div>
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
          titulo={`Servicio #${modalDetalle.id}: ${modalDetalle.nombre}`}
          campos={[
            { label: 'Costo Mano de Obra', value: modalDetalle.costo_mano_obra, tipo: 'moneda' },
            { label: 'Precio al Cliente', value: modalDetalle.precio_cliente, tipo: 'moneda' },
            { label: 'Estado', value: modalDetalle.activo ? 'Activo' : 'Inactivo', tipo: 'estado' },
            { label: 'Descripción', value: modalDetalle.descripcion || '-', tipo: 'texto' },
          ]}
          onClose={() => setModalDetalle(null)}
        />
      )}
    </div>
  )
}