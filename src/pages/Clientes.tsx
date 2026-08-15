import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Edit, Trash2, Save, X, Search, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import ModalDetalle from '../components/ModalDetalle'

interface Cliente {
  id: string
  nombres: string
  apellidos: string
  dui: string
  telefono: string
  email: string
  direccion: string
  notas: string
  fecha_registro: string
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [modalDetalle, setModalDetalle] = useState<Cliente | null>(null)

  const [formData, setFormData] = useState({
    nombres: '', apellidos: '', dui: '', telefono: '', email: '', direccion: '', notas: ''
  })

  useEffect(() => { fetchClientes() }, [])

  async function fetchClientes() {
    try {
      const { data, error } = await supabase.from('clientes').select('*').order('apellidos')
      if (error) throw error
      setClientes(data || [])
    } catch (error: any) {
      toast.error('Error al cargar: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    // Validación básica de DUI (9 dígitos)
    if (formData.dui && !/^\d{9}$/.test(formData.dui)) {
      toast.error('El DUI debe tener exactamente 9 dígitos numéricos')
      return
    }

    try {
      if (editingId) {
        const { error } = await supabase.from('clientes').update(formData).eq('id', editingId)
        if (error) throw error
        toast.success('Cliente actualizado')
      } else {
        const { error } = await supabase.from('clientes').insert([formData])
        if (error) throw error
        toast.success('Cliente registrado')
      }
      resetForm(); fetchClientes()
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    }
  }

  function handleEdit(c: Cliente) {
    setFormData({
      nombres: c.nombres, apellidos: c.apellidos, dui: c.dui || '',
      telefono: c.telefono || '', email: c.email || '', direccion: c.direccion || '', notas: c.notas || ''
    })
    setEditingId(c.id); setShowForm(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este cliente?')) return
    try {
      const { error } = await supabase.from('clientes').delete().eq('id', id)
      if (error) throw error
      toast.success('Cliente eliminado')
      fetchClientes()
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    }
  }

  function resetForm() {
    setFormData({ nombres: '', apellidos: '', dui: '', telefono: '', email: '', direccion: '', notas: '' })
    setEditingId(null); setShowForm(false)
  }

  const filtered = clientes.filter(c =>
    c.nombres.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.apellidos.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.dui || '').includes(searchTerm)
  )

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('es-CO') : '-'

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Clientes</h1>
          <p className="text-slate-500 mt-1">Gestión de clientes del taller</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(!showForm) }} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancelar' : 'Nuevo Cliente'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">{editingId ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombres *</label>
                <input type="text" value={formData.nombres} onChange={(e) => setFormData({...formData, nombres: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Apellidos *</label>
                <input type="text" value={formData.apellidos} onChange={(e) => setFormData({...formData, apellidos: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">DUI (9 dígitos)</label>
                <input 
                  type="text" 
                  value={formData.dui} 
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 9)
                    setFormData({...formData, dui: val})
                  }} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="123456789"
                  maxLength={9}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                <input type="text" value={formData.telefono} onChange={(e) => setFormData({...formData, telefono: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
                <input type="text" value={formData.direccion} onChange={(e) => setFormData({...formData, direccion: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
                <textarea value={formData.notas} onChange={(e) => setFormData({...formData, notas: e.target.value})} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
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
        <input type="text" placeholder="Buscar por nombre, apellido o DUI..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">{searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados'}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Nombre</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">DUI</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Teléfono</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Email</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Registro</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-slate-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setModalDetalle(c)}>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{c.nombres} {c.apellidos}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{c.dui || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{c.telefono || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{c.email || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDate(c.fecha_registro)}</td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setModalDetalle(c)} className="p-2 text-slate-600 hover:bg-slate-100 rounded"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => handleEdit(c)} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(c.id)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
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
          titulo={`${modalDetalle.nombres} ${modalDetalle.apellidos}`}
          campos={[
            { label: 'DUI', value: modalDetalle.dui || '-' },
            { label: 'Teléfono', value: modalDetalle.telefono || '-' },
            { label: 'Email', value: modalDetalle.email || '-' },
            { label: 'Dirección', value: modalDetalle.direccion || '-' },
            { label: 'Notas', value: modalDetalle.notas || '-', tipo: 'texto' },
            { label: 'Fecha de Registro', value: modalDetalle.fecha_registro, tipo: 'fecha' },
          ]}
          onClose={() => setModalDetalle(null)}
        />
      )}
    </div>
  )
}