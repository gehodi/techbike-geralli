import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Edit, Trash2, Save, X, Search } from 'lucide-react'
import toast from 'react-hot-toast'

interface Marca {
  id: number
  nombre: string
  pais_origen: string
}

export default function Marcas() {
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({ nombre: '', pais_origen: '' })

  useEffect(() => { fetchMarcas() }, [])

  async function fetchMarcas() {
    try {
      const { data, error } = await supabase.from('marcas_inventario').select('*').order('nombre')
      if (error) throw error
      setMarcas(data || [])
    } catch (error: any) {
      toast.error('Error al cargar: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (editingId) {
        const { error } = await supabase.from('marcas_inventario').update(formData).eq('id', editingId)
        if (error) throw error
        toast.success('Marca actualizada')
      } else {
        const { error } = await supabase.from('marcas_inventario').insert([formData])
        if (error) throw error
        toast.success('Marca registrada')
      }
      resetForm(); fetchMarcas()
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    }
  }

  function handleEdit(m: Marca) {
    setFormData({ nombre: m.nombre, pais_origen: m.pais_origen || '' })
    setEditingId(m.id); setShowForm(true)
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta marca?')) return
    try {
      const { error } = await supabase.from('marcas_inventario').delete().eq('id', id)
      if (error) throw error
      toast.success('Marca eliminada')
      fetchMarcas()
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    }
  }

  function resetForm() {
    setFormData({ nombre: '', pais_origen: '' })
    setEditingId(null); setShowForm(false)
  }

  const filtered = marcas.filter(m =>
    m.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.pais_origen || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Marcas de Inventario</h1>
          <p className="text-slate-500 mt-1">Gestión de marcas de productos</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(!showForm) }} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancelar' : 'Nueva Marca'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">{editingId ? 'Editar Marca' : 'Nueva Marca'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
              <input type="text" value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">País de Origen</label>
              <input type="text" value={formData.pais_origen} onChange={(e) => setFormData({...formData, pais_origen: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
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
        <input type="text" placeholder="Buscar marcas..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">{searchTerm ? 'No se encontraron marcas' : 'No hay marcas registradas'}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Nombre</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">País de Origen</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-slate-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{m.nombre}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{m.pais_origen || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
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
    </div>
  )
}