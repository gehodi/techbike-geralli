import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Edit, Trash2, Save, X, Search, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import ModalDetalle from '../components/ModalDetalle'

interface Mecanico {
  id: number
  nombres: string
  apellidos: string
  dui: string
  telefono: string
  email: string
  especialidad: string
  estado: string
  fecha_contratacion: string
  notas: string
  fecha_registro: string
}

export default function Mecanicos() {
  const [mecanicos, setMecanicos] = useState<Mecanico[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [modalDetalle, setModalDetalle] = useState<Mecanico | null>(null)

  const [formData, setFormData] = useState({
    nombres: '', apellidos: '', dui: '', telefono: '', email: '', 
    especialidad: '', estado: 'Activo', fecha_contratacion: '', notas: ''
  })

  useEffect(() => { fetchMecanicos() }, [])

  async function fetchMecanicos() {
    try {
      const { data, error } = await supabase.from('mecanicos').select('*').order('apellidos')
      if (error) throw error
      setMecanicos(data || [])
    } catch (error: any) {
      toast.error('Error al cargar: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    // Validación de DUI (9 dígitos)
    if (formData.dui && !/^\d{9}$/.test(formData.dui)) {
      toast.error('El DUI debe tener exactamente 9 dígitos numéricos')
      return
    }

    try {
      if (editingId) {
        const { error } = await supabase.from('mecanicos').update(formData).eq('id', editingId)
        if (error) throw error
        toast.success('Mecánico actualizado')
      } else {
        const { error } = await supabase.from('mecanicos').insert([formData])
        if (error) throw error
        toast.success('Mecánico registrado')
      }
      resetForm(); fetchMecanicos()
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    }
  }

  function handleEdit(m: Mecanico) {
    setFormData({
      nombres: m.nombres, apellidos: m.apellidos, dui: m.dui || '',
      telefono: m.telefono || '', email: m.email || '', especialidad: m.especialidad || '',
      estado: m.estado || 'Activo', 
      fecha_contratacion: m.fecha_contratacion || '', 
      notas: m.notas || ''
    })
    setEditingId(m.id); setShowForm(true)
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este mecánico?')) return
    try {
      const { error } = await supabase.from('mecanicos').delete().eq('id', id)
      if (error) throw error
      toast.success('Mecánico eliminado')
      fetchMecanicos()
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    }
  }

  function resetForm() {
    setFormData({ 
      nombres: '', apellidos: '', dui: '', telefono: '', email: '', 
      especialidad: '', estado: 'Activo', fecha_contratacion: '', notas: '' 
    })
    setEditingId(null); setShowForm(false)
  }

  const filtered = mecanicos.filter(m =>
    m.nombres.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.apellidos.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.especialidad || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('es-CO') : '-'

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-slate-800">Mecánicos</h1><p className="text-slate-500 mt-1">Gestión del equipo técnico</p></div>
        <button onClick={() => { resetForm(); setShowForm(!showForm) }} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{showForm ? 'Cancelar' : 'Nuevo Mecánico'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">{editingId ? 'Editar Mecánico' : 'Nuevo Mecánico'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Nombres *</label><input type="text" value={formData.nombres} onChange={(e) => setFormData({...formData, nombres: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Apellidos *</label><input type="text" value={formData.apellidos} onChange={(e) => setFormData({...formData, apellidos: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required /></div>
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
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Teléfono *</label><input type="text" value={formData.telefono} onChange={(e) => setFormData({...formData, telefono: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Email *</label><input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Especialidad</label><input type="text" value={formData.especialidad} onChange={(e) => setFormData({...formData, especialidad: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ej: Transmisión, Frenos" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Estado</label><select value={formData.estado} onChange={(e) => setFormData({...formData, estado: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"><option value="Activo">Activo</option><option value="Inactivo">Inactivo</option></select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Contratación</label><input type="date" value={formData.fecha_contratacion} onChange={(e) => setFormData({...formData, fecha_contratacion: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
              <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Notas</label><textarea value={formData.notas} onChange={(e) => setFormData({...formData, notas: e.target.value})} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={resetForm} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"><Save className="w-4 h-4" /> {editingId ? 'Actualizar' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Buscar por nombre o especialidad..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (<div className="p-8 text-center text-slate-500">Cargando...</div>) : filtered.length === 0 ? (<div className="p-8 text-center text-slate-500">{searchTerm ? 'No se encontraron mecánicos' : 'No hay mecánicos registrados'}</div>) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr><th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Nombre</th><th className="text-left px-6 py-3 text-sm font-medium text-slate-700">DUI</th><th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Especialidad</th><th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Estado</th><th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Contratación</th><th className="text-right px-6 py-3 text-sm font-medium text-slate-700">Acciones</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setModalDetalle(m)}>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{m.nombres} {m.apellidos}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{m.dui || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{m.especialidad || '-'}</td>
                    <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${m.estado === 'Activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{m.estado}</span></td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDate(m.fecha_contratacion)}</td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setModalDetalle(m)} className="p-2 text-slate-600 hover:bg-slate-100 rounded"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => handleEdit(m)} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(m.id)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
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
            { label: 'Especialidad', value: modalDetalle.especialidad || '-' },
            { label: 'Estado', value: modalDetalle.estado, tipo: 'estado' },
            { label: 'Fecha de Contratación', value: modalDetalle.fecha_contratacion, tipo: 'fecha' },
            { label: 'Notas', value: modalDetalle.notas || '-', tipo: 'texto' },
          ]}
          onClose={() => setModalDetalle(null)}
        />
      )}
    </div>
  )
}