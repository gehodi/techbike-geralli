import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Edit, Trash2, Save, X, Search, Hammer, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

interface Servicio {
  id: number
  nombre: string
  precio_cliente: number
  costo_mano_obra: number
  tiempo_preparacion_min: number
  tiempo_ejecucion_min: number
  tiempo_limpieza_min: number
  complejidad: number
  requiere_especialista: boolean
  especialidad: string | null
  activo: boolean
}

export default function Servicios() {
  const formRef = useRef<HTMLDivElement>(null)
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({
    nombre: '',
    precio_cliente: '',
    costo_mano_obra: '',
    tiempo_preparacion_min: '15',
    tiempo_ejecucion_min: '60',
    tiempo_limpieza_min: '15',
    complejidad: '1',
    requiere_especialista: false,
    especialidad: '',
    activo: true
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
    if (!formData.nombre.trim()) { toast.error('El nombre es obligatorio'); return }
    const data = {
      nombre: formData.nombre.trim(),
      precio_cliente: parseFloat(formData.precio_cliente) || 0,
      costo_mano_obra: parseFloat(formData.costo_mano_obra) || 0,
      tiempo_preparacion_min: parseInt(formData.tiempo_preparacion_min) || 0,
      tiempo_ejecucion_min: parseInt(formData.tiempo_ejecucion_min) || 0,
      tiempo_limpieza_min: parseInt(formData.tiempo_limpieza_min) || 0,
      complejidad: parseInt(formData.complejidad) || 1,
      requiere_especialista: formData.requiere_especialista,
      especialidad: formData.requiere_especialista ? (formData.especialidad.trim() || null) : null,
      activo: formData.activo
    }
    try {
      if (editingId) {
        const { error } = await supabase.from('servicios').update(data).eq('id', editingId)
        if (error) throw error
        toast.success('Servicio actualizado. Las nuevas programaciones usarán estos tiempos.')
      } else {
        const { error } = await supabase.from('servicios').insert([data])
        if (error) throw error
        toast.success('Servicio registrado')
      }
      resetForm(); fetchServicios()
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    }
  }

  function handleEdit(s: Servicio) {
    setFormData({
      nombre: s.nombre || '',
      precio_cliente: s.precio_cliente?.toString() || '',
      costo_mano_obra: s.costo_mano_obra?.toString() || '',
      tiempo_preparacion_min: s.tiempo_preparacion_min?.toString() || '0',
      tiempo_ejecucion_min: s.tiempo_ejecucion_min?.toString() || '0',
      tiempo_limpieza_min: s.tiempo_limpieza_min?.toString() || '0',
      complejidad: s.complejidad?.toString() || '1',
      requiere_especialista: s.requiere_especialista || false,
      especialidad: s.especialidad || '',
      activo: s.activo !== false
    })
    setEditingId(s.id); setShowForm(true)
    // ✅ CORREGIDO: centra la pantalla en el formulario de edición
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este servicio?\n\nSi ya fue usado en órdenes o cotizaciones, el sistema lo bloqueará: en ese caso desactívalo (Activo = no) en lugar de eliminarlo.')) return
    try {
      const { error } = await supabase.from('servicios').delete().eq('id', id)
      if (error) throw error
      toast.success('Servicio eliminado')
      fetchServicios()
    } catch (error: any) {
      toast.error('No se pudo eliminar (está en uso). Desactívalo: ' + error.message)
    }
  }

  function resetForm() {
    setFormData({
      nombre: '', precio_cliente: '', costo_mano_obra: '',
      tiempo_preparacion_min: '15', tiempo_ejecucion_min: '60', tiempo_limpieza_min: '15',
      complejidad: '1', requiere_especialista: false, especialidad: '', activo: true
    })
    setEditingId(null); setShowForm(false)
  }

  const filtered = servicios.filter(s => s.nombre.toLowerCase().includes(searchTerm.toLowerCase()))
  const totalMin = (prep: number, ejec: number, limp: number) => (prep || 0) + (ejec || 0) + (limp || 0)
  const fmtMin = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
  const formatCurrency = (v: number | null | undefined) => {
    if (v === null || v === undefined) return '$0.00'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
  }
  const totalForm = totalMin(
    parseInt(formData.tiempo_preparacion_min) || 0,
    parseInt(formData.tiempo_ejecucion_min) || 0,
    parseInt(formData.tiempo_limpieza_min) || 0
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Hammer className="w-6 h-6 text-blue-600" /> Servicios Técnicos</h1>
          <p className="text-slate-500 mt-1">Catálogo de servicios con tiempos estándar para el planificador</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(!showForm) }} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancelar' : 'Nuevo Servicio'}
        </button>
      </div>

      {showForm && (
        <div ref={formRef} className="bg-white p-6 rounded-xl shadow-sm border-2 border-blue-300 scroll-mt-20">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">{editingId ? 'Editar Servicio' : 'Nuevo Servicio'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del servicio *</label>
                <input type="text" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Precio cliente</label>
                <input type="number" min="0" step="0.01" value={formData.precio_cliente} onChange={(e) => setFormData({ ...formData, precio_cliente: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Costo mano de obra</label>
                <input type="number" min="0" step="0.01" value={formData.costo_mano_obra} onChange={(e) => setFormData({ ...formData, costo_mano_obra: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>

            {/* Tiempos estándar para el planificador FCS */}
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Tiempos para el planificador (minutos)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Preparación</label>
                  <input type="number" min="0" value={formData.tiempo_preparacion_min} onChange={(e) => setFormData({ ...formData, tiempo_preparacion_min: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  <p className="text-xs text-slate-500 mt-1">Recibir bici, preparar herramientas</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ejecución</label>
                  <input type="number" min="0" value={formData.tiempo_ejecucion_min} onChange={(e) => setFormData({ ...formData, tiempo_ejecucion_min: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  <p className="text-xs text-slate-500 mt-1">Trabajo técnico real</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Limpieza / entrega</label>
                  <input type="number" min="0" value={formData.tiempo_limpieza_min} onChange={(e) => setFormData({ ...formData, tiempo_limpieza_min: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  <p className="text-xs text-slate-500 mt-1">Probar, limpiar, entregar</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Total sin buffer</label>
                  <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 font-semibold">{fmtMin(totalForm)}</div>
                  <p className="text-xs text-slate-500 mt-1">+ buffer entre órdenes (configurable)</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Complejidad (1-5)</label>
                  <select value={formData.complejidad} onChange={(e) => setFormData({ ...formData, complejidad: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="1">1 - Básica</option>
                    <option value="2">2 - Media</option>
                    <option value="3">3 - Alta</option>
                    <option value="4">4 - Avanzada</option>
                    <option value="5">5 - Experto</option>
                  </select>
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={formData.requiere_especialista} onChange={(e) => setFormData({ ...formData, requiere_especialista: e.target.checked })} className="w-4 h-4" />
                    Requiere especialista
                  </label>
                </div>
                {formData.requiere_especialista && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Especialidad</label>
                    <input type="text" placeholder="hidraulica, suspension, electrica..." value={formData.especialidad} onChange={(e) => setFormData({ ...formData, especialidad: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                )}
              </div>
              <label className="flex items-center gap-2 mt-4 text-sm text-slate-700">
                <input type="checkbox" checked={formData.activo} onChange={(e) => setFormData({ ...formData, activo: e.target.checked })} className="w-4 h-4" />
                Servicio activo (disponible para nuevas órdenes)
              </label>
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
        <input type="text" placeholder="Buscar servicio..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (<div className="p-8 text-center text-slate-500">Cargando...</div>) : filtered.length === 0 ? (<div className="p-8 text-center text-slate-500">{searchTerm ? 'No se encontraron servicios' : 'No hay servicios registrados'}</div>) : (
          <div className="overflow-x-auto">
            <div className="min-w-[1100px]">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Servicio</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Tiempo total</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Prep / Ejec / Limp</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Complejidad</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Especialidad</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-slate-700">Precio cliente</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-slate-700">Costo M.O.</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Activo</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-slate-700">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{s.nombre}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">{fmtMin(totalMin(s.tiempo_preparacion_min, s.tiempo_ejecucion_min, s.tiempo_limpieza_min))}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{s.tiempo_preparacion_min} / {s.tiempo_ejecucion_min} / {s.tiempo_limpieza_min}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{s.complejidad}</td>
                      <td className="px-6 py-4 text-sm">
                        {s.requiere_especialista ? (<span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">{s.especialidad || 'especialista'}</span>) : (<span className="text-slate-400">—</span>)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 text-right">{formatCurrency(s.precio_cliente)}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 text-right">{formatCurrency(s.costo_mano_obra)}</td>
                      <td className="px-6 py-4 text-sm">
                        {s.activo ? (<span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">Activo</span>) : (<span className="px-2 py-1 bg-slate-200 text-slate-600 rounded-full text-xs font-medium">Inactivo</span>)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleEdit(s)} className="p-2 text-blue-600 hover:bg-blue-50 rounded" title="Editar"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(s.id)} className="p-2 text-red-600 hover:bg-red-50 rounded" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
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
    </div>
  )
}