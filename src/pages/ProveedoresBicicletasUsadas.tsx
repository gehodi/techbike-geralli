import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Edit, Trash2, Save, X, Search, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import ModalDetalle from '../components/ModalDetalle'
import ControlesPaginacion from '../components/ControlesPaginacion'

interface ProveedorBU {
  id: number
  tipo_persona: string
  nombre_razon_social: string
  documento_identidad: string
  telefono?: string
  email?: string
  direccion?: string
  activo: boolean
  fecha_registro?: string
}

export default function ProveedoresBicicletasUsadas() {
  const formRef = useRef<HTMLDivElement>(null)
  const [proveedores, setProveedores] = useState<ProveedorBU[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [modalDetalle, setModalDetalle] = useState<ProveedorBU | null>(null)
  const [paginaActual, setPaginaActual] = useState(1)
  const [registrosPorPagina, setRegistrosPorPagina] = useState(25)
  const [totalRegistros, setTotalRegistros] = useState(0)
  const [formData, setFormData] = useState({
    tipo_persona: 'natural',
    nombre_razon_social: '',
    documento_identidad: '',
    telefono: '',
    email: '',
    direccion: '',
    activo: true
  })

  useEffect(() => {
    fetchProveedores()
  }, [paginaActual, registrosPorPagina, searchTerm])

  async function fetchProveedores() {
    try {
      setLoading(true)
      let countQuery = supabase
        .from('proveedores_bicicletas_usadas')
        .select('*', { count: 'exact', head: true })
      if (searchTerm) {
        const term = `%${searchTerm}%`
        countQuery = countQuery.or(
          `nombre_razon_social.ilike.${term},documento_identidad.ilike.${term}`
        )
      }
      const { count, error: countError } = await countQuery
      if (countError) throw countError
      setTotalRegistros(count || 0)

      const from = (paginaActual - 1) * registrosPorPagina
      const to = from + registrosPorPagina - 1
      let query = supabase
        .from('proveedores_bicicletas_usadas')
        .select('*')
        .order('nombre_razon_social')
        .range(from, to)
      if (searchTerm) {
        const term = `%${searchTerm}%`
        query = query.or(
          `nombre_razon_social.ilike.${term},documento_identidad.ilike.${term}`
        )
      }
      const { data, error } = await query
      if (error) throw error
      setProveedores(data || [])
      if (data && data.length === 0 && paginaActual > 1) {
        setPaginaActual(1)
      }
    } catch (error: any) {
      console.error('Error cargando proveedores:', error)
      toast.error('Error al cargar: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.nombre_razon_social.trim()) {
      toast.error('El nombre o razón social es obligatorio')
      return
    }
    if (!formData.documento_identidad.trim()) {
      toast.error('El documento de identidad es obligatorio')
      return
    }
    try {
      const data = {
        tipo_persona: formData.tipo_persona,
        nombre_razon_social: formData.nombre_razon_social.trim(),
        documento_identidad: formData.documento_identidad.trim(),
        telefono: formData.telefono.trim() || null,
        email: formData.email.trim() || null,
        direccion: formData.direccion.trim() || null,
        activo: formData.activo
      }
      if (editingId) {
        const { error } = await supabase
          .from('proveedores_bicicletas_usadas')
          .update(data)
          .eq('id', editingId)
        if (error) throw error
        toast.success('Proveedor actualizado correctamente')
      } else {
        const { error } = await supabase
          .from('proveedores_bicicletas_usadas')
          .insert([data])
        if (error) throw error
        toast.success('Proveedor registrado correctamente')
      }
      resetForm()
      fetchProveedores()
    } catch (error: any) {
      console.error('Error guardando:', error)
      toast.error('Error al guardar: ' + (error.message || 'Error desconocido'))
    }
  }

  function handleEdit(p: ProveedorBU) {
    setFormData({
      tipo_persona: p.tipo_persona || 'natural',
      nombre_razon_social: p.nombre_razon_social || '',
      documento_identidad: p.documento_identidad || '',
      telefono: p.telefono || '',
      email: p.email || '',
      direccion: p.direccion || '',
      activo: p.activo !== false
    })
    setEditingId(p.id)
    setShowForm(true)
    setModalDetalle(null)
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Está seguro de eliminar este proveedor?\n\nEsta acción no se puede deshacer.')) {
      return
    }
    try {
      const { error } = await supabase
        .from('proveedores_bicicletas_usadas')
        .delete()
        .eq('id', id)
      if (error) throw error
      toast.success('Proveedor eliminado correctamente')
      fetchProveedores()
    } catch (error: any) {
      console.error('Error eliminando:', error)
      toast.error('Error al eliminar: ' + (error.message || 'Error desconocido'))
    }
  }

  function resetForm() {
    setFormData({
      tipo_persona: 'natural',
      nombre_razon_social: '',
      documento_identidad: '',
      telefono: '',
      email: '',
      direccion: '',
      activo: true
    })
    setEditingId(null)
    setShowForm(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Proveedores de Bicicletas Usadas</h1>
          <p className="text-slate-500 mt-1">Gestión de vendedores e intermediarios</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm) }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancelar' : 'Nuevo Proveedor'}
        </button>
      </div>

      {showForm && (
        <div ref={formRef} className="bg-white p-6 rounded-xl shadow-sm border-2 border-blue-300 scroll-mt-20">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            {editingId ? 'Editar Proveedor' : 'Registrar Nuevo Proveedor'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Persona *</label>
                <select 
                  value={formData.tipo_persona} 
                  onChange={(e) => setFormData({...formData, tipo_persona: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  required
                >
                  <option value="natural">Persona Natural</option>
                  <option value="juridica">Persona Jurídica</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {formData.tipo_persona === 'natural' ? 'Nombre Completo' : 'Razón Social'} *
                </label>
                <input 
                  type="text" 
                  value={formData.nombre_razon_social} 
                  onChange={(e) => setFormData({...formData, nombre_razon_social: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  required 
                  placeholder={formData.tipo_persona === 'natural' ? 'Juan Pérez' : 'Empresa S.A.S.'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Documento de Identidad *</label>
                <input 
                  type="text" 
                  value={formData.documento_identidad} 
                  onChange={(e) => setFormData({...formData, documento_identidad: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  required 
                  placeholder="Cédula o NIT"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                <input 
                  type="text" 
                  value={formData.telefono} 
                  onChange={(e) => setFormData({...formData, telefono: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="300 123 4567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input 
                  type="email" 
                  value={formData.email} 
                  onChange={(e) => setFormData({...formData, email: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="correo@ejemplo.com"
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
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
                <textarea 
                  value={formData.direccion} 
                  onChange={(e) => setFormData({...formData, direccion: e.target.value})} 
                  rows={2} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="Dirección completa"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
              <button 
                type="button" 
                onClick={resetForm} 
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
              >
                <Save className="w-4 h-4" />
                {editingId ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
        <input 
          type="text" 
          placeholder="Buscar por nombre o documento..." 
          value={searchTerm} 
          onChange={(e) => { 
            setSearchTerm(e.target.value)
            setPaginaActual(1)
          }} 
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">
            <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
            <p>Cargando proveedores...</p>
          </div>
        ) : proveedores.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {searchTerm ? 'No se encontraron proveedores' : 'No hay proveedores registrados'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">ID</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Tipo</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Nombre / Razón Social</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Documento</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Teléfono</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Email</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Estado</th>
                      <th className="sticky right-0 bg-slate-50 border-l-2 border-slate-200 px-6 py-3 text-sm font-medium text-slate-700 z-10 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {proveedores.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-mono text-slate-600">#{p.id}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            p.tipo_persona === 'natural' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {p.tipo_persona === 'natural' ? 'Natural' : 'Jurídica'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{p.nombre_razon_social}</td>
                        <td className="px-6 py-4 text-sm text-slate-600 font-mono">{p.documento_identidad}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{p.telefono || '-'}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{p.email || '-'}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            p.activo 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {p.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="sticky right-0 bg-white border-l-2 border-slate-200 px-6 py-4 text-right z-10 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => setModalDetalle(p)} 
                              className="p-2 text-slate-600 hover:bg-slate-100 rounded transition-colors" 
                              title="Ver detalle"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleEdit(p)} 
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors" 
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(p.id)} 
                              className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors" 
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

      {modalDetalle && (
        <ModalDetalle
          titulo={`Proveedor #${modalDetalle.id}`}
          campos={[
            { label: 'Tipo de Persona', value: modalDetalle.tipo_persona === 'natural' ? 'Persona Natural' : 'Persona Jurídica', tipo: 'estado' },
            { label: 'Nombre / Razón Social', value: modalDetalle.nombre_razon_social },
            { label: 'Documento de Identidad', value: modalDetalle.documento_identidad },
            { label: 'Teléfono', value: modalDetalle.telefono || '-' },
            { label: 'Email', value: modalDetalle.email || '-' },
            { label: 'Dirección', value: modalDetalle.direccion || '-', tipo: 'texto' },
            { label: 'Estado', value: modalDetalle.activo ? 'Activo' : 'Inactivo', tipo: 'estado' },
            { label: 'Fecha Registro', value: modalDetalle.fecha_registro, tipo: 'fecha' },
          ]}
          onClose={() => setModalDetalle(null)}
        />
      )}
    </div>
  )
}