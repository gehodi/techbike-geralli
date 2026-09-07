import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Edit, Trash2, Save, X, Search, Eye, Camera, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import ModalDetalle from '../components/ModalDetalle'
import ControlesPaginacion from '../components/ControlesPaginacion'

interface BicicletaAdquirida {
  id: number
  codigo_inventario: string
  proveedor_id: number
  intermediario_id?: number
  comision_intermediario?: number
  tipo_bicicleta_id: number
  marca: string
  modelo: string
  color: string
  numero_serie?: string
  ano_fabricacion?: number
  fecha_adquisicion: string
  costo_compra: number
  detalles_requeridos?: string
  estado: string
  precio_venta_sugerido?: number
  observaciones?: string
  foto_url?: string
  proveedor_nombre?: string
  tipo_bicicleta_nombre?: string
}

interface ProveedorBU { id: number; nombre_razon_social: string }
interface TipoBici { id: number; nombre: string }

export default function BicicletasUsadas() {
  const formRef = useRef<HTMLDivElement>(null)
  const [bicicletas, setBicicletas] = useState<BicicletaAdquirida[]>([])
  const [proveedores, setProveedores] = useState<ProveedorBU[]>([])
  const [tipos, setTipos] = useState<TipoBici[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [modalDetalle, setModalDetalle] = useState<BicicletaAdquirida | null>(null)
  const [paginaActual, setPaginaActual] = useState(1)
  const [registrosPorPagina, setRegistrosPorPagina] = useState(25)
  const [totalRegistros, setTotalRegistros] = useState(0)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [formData, setFormData] = useState({
    proveedor_id: '', // ✅ AGREGADO
    intermediario_id: '',
    comision_intermediario: '',
    tipo_bicicleta_id: '',
    marca: '',
    modelo: '',
    color: '',
    numero_serie: '',
    ano_fabricacion: '',
    fecha_adquisicion: '',
    costo_compra: '',
    detalles_requeridos: '',
    precio_venta_sugerido: '',
    observaciones: ''
  })

  useEffect(() => {
    fetchProveedores()
    fetchTipos()
  }, [])

  useEffect(() => {
    fetchBicicletas()
  }, [paginaActual, registrosPorPagina, searchTerm])

  async function fetchBicicletas() {
    try {
      setLoading(true)
      let countQuery = supabase
        .from('bicicletas_adquiridas')
        .select('*', { count: 'exact', head: true })
      if (searchTerm) {
        const term = `%${searchTerm}%`
        countQuery = countQuery.or(
          `codigo_inventario.ilike.${term},marca.ilike.${term},modelo.ilike.${term}`
        )
      }
      const { count, error: countError } = await countQuery
      if (countError) throw countError
      setTotalRegistros(count || 0)

      const from = (paginaActual - 1) * registrosPorPagina
      const to = from + registrosPorPagina - 1
      let query = supabase
        .from('bicicletas_adquiridas')
        .select(`
          *,
          proveedores_bicicletas_usadas!proveedor_id(nombre_razon_social),
          tipos_de_bicicletas(nombre)
        `)
        .order('fecha_adquisicion', { ascending: false })
        .range(from, to)
      if (searchTerm) {
        const term = `%${searchTerm}%`
        query = query.or(
          `codigo_inventario.ilike.${term},marca.ilike.${term},modelo.ilike.${term}`
        )
      }
      const { data, error } = await query
      if (error) throw error
      const procesadas: BicicletaAdquirida[] = (data || []).map((b: any) => ({
        ...b,
        proveedor_nombre: b.proveedores_bicicletas_usadas?.nombre_razon_social || 'Sin proveedor',
        tipo_bicicleta_nombre: b.tipos_de_bicicletas?.nombre || 'Sin tipo',
        foto_url: b.foto_url || null
      }))
      setBicicletas(procesadas)
      if (data && data.length === 0 && paginaActual > 1) {
        setPaginaActual(1)
      }
    } catch (error: any) {
      console.error('Error cargando bicicletas:', error)
      toast.error('Error al cargar: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchProveedores() {
    try {
      const { data, error } = await supabase
        .from('proveedores_bicicletas_usadas')
        .select('id, nombre_razon_social')
        .eq('activo', true)
        .order('nombre_razon_social')
      if (error) throw error
      setProveedores(data || [])
    } catch (error: any) {
      console.error('Error cargando proveedores:', error)
    }
  }

  async function fetchTipos() {
    try {
      const { data, error } = await supabase
        .from('tipos_de_bicicletas')
        .select('id, nombre')
        .order('nombre')
      if (error) throw error
      setTipos(data || [])
    } catch (error: any) {
      console.error('Error cargando tipos:', error)
    }
  }

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Solo se permiten imágenes')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('La imagen no debe superar los 5MB')
        return
      }
      setFotoFile(file)
      setFotoPreview(URL.createObjectURL(file))
    }
  }

  async function uploadFoto(file: File, bicicletaId: number | string): Promise<string | null> {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `bicicletas_adquiridas/${bicicletaId}/${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('fotos-bicicletas')
        .upload(fileName, file, { cacheControl: '3600', upsert: false })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage
        .from('fotos-bicicletas')
        .getPublicUrl(fileName)
      return publicUrl
    } catch (error: any) {
      console.error('Error subiendo foto:', error)
      toast.error('Error al subir foto: ' + error.message)
      return null
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.tipo_bicicleta_id) {
      toast.error('Debe seleccionar un tipo de bicicleta')
      return
    }
    if (!formData.fecha_adquisicion) {
      toast.error('La fecha de adquisición es obligatoria')
      return
    }
    if (!formData.costo_compra || parseFloat(formData.costo_compra) <= 0) {
      toast.error('El costo de compra debe ser mayor a cero')
      return
    }
    try {
      let fotoUrl: string | null = null
      if (fotoFile) {
        setUploadingFoto(true)
        const nuevaUrl = await uploadFoto(fotoFile, editingId || 'nuevo')
        setUploadingFoto(false)
        if (nuevaUrl) fotoUrl = nuevaUrl
      }
      const data: any = {
        proveedor_id: formData.proveedor_id ? parseInt(formData.proveedor_id) : null,
        intermediario_id: formData.intermediario_id ? parseInt(formData.intermediario_id) : null,
        comision_intermediario: formData.comision_intermediario ? parseFloat(formData.comision_intermediario) : 0,
        tipo_bicicleta_id: formData.tipo_bicicleta_id ? parseInt(formData.tipo_bicicleta_id) : null,
        marca: formData.marca.trim() || null,
        modelo: formData.modelo.trim() || null,
        color: formData.color.trim() || null,
        numero_serie: formData.numero_serie.trim() || null,
        ano_fabricacion: formData.ano_fabricacion ? parseInt(formData.ano_fabricacion) : null,
        fecha_adquisicion: formData.fecha_adquisicion,
        costo_compra: parseFloat(formData.costo_compra) || 0,
        detalles_requeridos: formData.detalles_requeridos.trim() || null,
        precio_venta_sugerido: formData.precio_venta_sugerido ? parseFloat(formData.precio_venta_sugerido) : null,
        observaciones: formData.observaciones.trim() || null
      }
      if (fotoUrl) {
        data.foto_url = fotoUrl
      }
      if (editingId) {
        const { error } = await supabase
          .from('bicicletas_adquiridas')
          .update(data)
          .eq('id', editingId)
        if (error) throw error
        toast.success('Bicicleta actualizada correctamente')
      } else {
        data.estado = 'adquirida'
        const { error } = await supabase
          .from('bicicletas_adquiridas')
          .insert([data])
        if (error) throw error
        toast.success('Bicicleta registrada en inventario')
      }
      resetForm()
      fetchBicicletas()
    } catch (error: any) {
      console.error('Error guardando:', error)
      toast.error('Error al guardar: ' + (error.message || 'Error desconocido'))
    } finally {
      setUploadingFoto(false)
    }
  }

  function handleEdit(b: BicicletaAdquirida) {
    setFormData({
      proveedor_id: b.proveedor_id?.toString() || '', // ✅ AGREGADO
      intermediario_id: b.intermediario_id?.toString() || '',
      comision_intermediario: b.comision_intermediario?.toString() || '',
      tipo_bicicleta_id: b.tipo_bicicleta_id?.toString() || '',
      marca: b.marca || '',
      modelo: b.modelo || '',
      color: b.color || '',
      numero_serie: b.numero_serie || '',
      ano_fabricacion: b.ano_fabricacion?.toString() || '',
      fecha_adquisicion: b.fecha_adquisicion || '',
      costo_compra: b.costo_compra?.toString() || '',
      detalles_requeridos: b.detalles_requeridos || '',
      precio_venta_sugerido: b.precio_venta_sugerido?.toString() || '',
      observaciones: b.observaciones || ''
    })
    setFotoPreview(b.foto_url || null)
    setFotoFile(null)
    setEditingId(b.id)
    setShowForm(true)
    setModalDetalle(null)
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Está seguro de eliminar esta bicicleta del registro?\n\nEsta acción no se puede deshacer.')) {
      return
    }
    try {
      const { error } = await supabase
        .from('bicicletas_adquiridas')
        .delete()
        .eq('id', id)
      if (error) throw error
      toast.success('Registro eliminado correctamente')
      fetchBicicletas()
    } catch (error: any) {
      console.error('Error eliminando:', error)
      toast.error('Error al eliminar: ' + (error.message || 'Error desconocido'))
    }
  }

  function resetForm() {
    setFormData({
      proveedor_id: '', // ✅ AGREGADO
      intermediario_id: '',
      comision_intermediario: '',
      tipo_bicicleta_id: '',
      marca: '',
      modelo: '',
      color: '',
      numero_serie: '',
      ano_fabricacion: '',
      fecha_adquisicion: '',
      costo_compra: '',
      detalles_requeridos: '',
      precio_venta_sugerido: '',
      observaciones: ''
    })
    setFotoFile(null)
    setFotoPreview(null)
    setEditingId(null)
    setShowForm(false)
  }

  const getEstadoColor = (estado: string) => {
    switch(estado) {
      case 'adquirida': return 'bg-blue-100 text-blue-800'
      case 'en_reparacion': return 'bg-yellow-100 text-yellow-800'
      case 'disponible_venta': return 'bg-green-100 text-green-800'
      case 'vendida': return 'bg-slate-100 text-slate-800'
      case 'retirada': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (d: string) => {
    if (!d) return '-'
    try {
      return new Date(d).toLocaleDateString('es-CO')
    } catch {
      return '-'
    }
  }

  const formatCurrency = (v: number | null | undefined) => {
    if (v === null || v === undefined || isNaN(v)) return '$0.00'
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
          <h1 className="text-2xl font-bold text-slate-800">Bicicletas Usadas (Adquisición)</h1>
          <p className="text-slate-500 mt-1">Control de inventario, reacondicionamiento y venta</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm) }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancelar' : 'Nueva Adquisición'}
        </button>
      </div>

      {showForm && (
        <div ref={formRef} className="bg-white p-6 rounded-xl shadow-sm border-2 border-blue-300 scroll-mt-20">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            {editingId ? `Editar Bicicleta ${editingId}` : 'Registrar Nueva Adquisición'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Código de Inventario</label>
              {editingId ? (
                <input 
                  type="text" 
                  value={bicicletas.find(b => b.id === editingId)?.codigo_inventario || ''} 
                  disabled 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-600 font-mono" 
                />
              ) : (
                <div className="flex items-center gap-3">
                  <input 
                    type="text" 
                    placeholder="Se generará automáticamente al guardar (Ej: BU-2026-0001)" 
                    disabled 
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-400 italic" 
                  />
                  <span className="text-xs text-blue-600 font-medium whitespace-nowrap">Formato: BU-AÑO-CORRELATIVO</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Proveedor (Vendedor) *</label>
                <select 
                  value={formData.proveedor_id} 
                  onChange={(e) => setFormData({...formData, proveedor_id: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  required
                >
                  <option value="">Seleccionar...</option>
                  {proveedores.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre_razon_social}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Intermediario (Opcional)</label>
                <select 
                  value={formData.intermediario_id} 
                  onChange={(e) => setFormData({...formData, intermediario_id: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Sin intermediario</option>
                  {proveedores.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre_razon_social}</option>
                  ))}
                </select>
              </div>
              {formData.intermediario_id && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Comisión Intermediario</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0"
                    value={formData.comision_intermediario} 
                    onChange={(e) => setFormData({...formData, comision_intermediario: e.target.value})} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                    placeholder="0.00"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Bicicleta *</label>
                <select 
                  value={formData.tipo_bicicleta_id} 
                  onChange={(e) => setFormData({...formData, tipo_bicicleta_id: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  required
                >
                  <option value="">Seleccionar...</option>
                  {tipos.map(t => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Marca</label>
                <input 
                  type="text" 
                  value={formData.marca} 
                  onChange={(e) => setFormData({...formData, marca: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="Ej: Specialized"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Modelo</label>
                <input 
                  type="text" 
                  value={formData.modelo} 
                  onChange={(e) => setFormData({...formData, modelo: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="Ej: Rockhopper"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
                <input 
                  type="text" 
                  value={formData.color} 
                  onChange={(e) => setFormData({...formData, color: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="Ej: Rojo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Número de Serie</label>
                <input 
                  type="text" 
                  value={formData.numero_serie} 
                  onChange={(e) => setFormData({...formData, numero_serie: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="Opcional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Año Fabricación</label>
                <input 
                  type="number" 
                  min="1900" 
                  max={new Date().getFullYear()}
                  value={formData.ano_fabricacion} 
                  onChange={(e) => setFormData({...formData, ano_fabricacion: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="2020"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Adquisición *</label>
                <input 
                  type="date" 
                  value={formData.fecha_adquisicion} 
                  onChange={(e) => setFormData({...formData, fecha_adquisicion: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Costo de Compra *</label>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  value={formData.costo_compra} 
                  onChange={(e) => setFormData({...formData, costo_compra: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  required 
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Precio Venta Sugerido</label>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  value={formData.precio_venta_sugerido} 
                  onChange={(e) => setFormData({...formData, precio_venta_sugerido: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Detalles a Reparar / Requerimientos</label>
                <textarea 
                  value={formData.detalles_requeridos} 
                  onChange={(e) => setFormData({...formData, detalles_requeridos: e.target.value})} 
                  rows={3} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="Ej: Cambio de frenos, ajuste de cambios..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observaciones</label>
                <textarea 
                  value={formData.observaciones} 
                  onChange={(e) => setFormData({...formData, observaciones: e.target.value})} 
                  rows={3} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="Notas adicionales..."
                />
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Foto del Estado Inicial</label>
              <div className="flex items-center gap-4">
                {fotoPreview ? (
                  <div className="relative">
                    <img 
                      src={fotoPreview} 
                      alt="Foto bicicleta" 
                      className="h-32 w-32 object-cover rounded-lg border-2 border-slate-200" 
                    />
                    <button 
                      type="button" 
                      onClick={() => { setFotoFile(null); setFotoPreview(null); }} 
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="h-32 w-32 bg-slate-100 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center">
                    <Camera className="w-8 h-8 text-slate-400" />
                  </div>
                )}
                <div className="flex-1">
                  <label className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 text-sm w-fit transition-colors">
                    <Upload className="w-4 h-4 text-slate-600" />
                    <span>{fotoFile ? 'Cambiar foto' : 'Subir foto'}</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      onChange={handleFotoChange} 
                      className="hidden" 
                    />
                  </label>
                  <p className="text-xs text-slate-500 mt-2">Máximo 5MB. Formatos: JPG, PNG, GIF.</p>
                </div>
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
                disabled={uploadingFoto} 
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {uploadingFoto ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingId ? 'Actualizar' : 'Guardar'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
        <input 
          type="text" 
          placeholder="Buscar por código, marca o modelo..." 
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
            <p>Cargando bicicletas...</p>
          </div>
        ) : bicicletas.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {searchTerm ? 'No se encontraron bicicletas con ese criterio' : 'No hay bicicletas adquiridas registradas'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div className="min-w-[1000px]">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Código</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Foto</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Marca / Modelo</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Tipo</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Proveedor</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Fecha Compra</th>
                      <th className="text-right px-6 py-3 text-sm font-medium text-slate-700">Costo Compra</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Estado</th>
                      <th className="sticky right-0 bg-slate-50 border-l-2 border-slate-200 px-6 py-3 text-sm font-medium text-slate-700 z-10 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {bicicletas.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-mono text-slate-900 font-medium">{b.codigo_inventario}</td>
                        <td className="px-6 py-4">
                          {b.foto_url ? (
                            <img 
                              src={b.foto_url} 
                              alt={`Foto ${b.codigo_inventario}`} 
                              className="h-12 w-12 object-cover rounded-lg border border-slate-200 cursor-pointer hover:scale-110 transition-transform" 
                              onClick={() => window.open(b.foto_url, '_blank')} 
                            />
                          ) : (
                            <div className="h-12 w-12 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center">
                              <Camera className="w-5 h-5 text-slate-400" />
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-800 font-medium">
                          {b.marca || 'Sin marca'} {b.modelo && <span className="text-slate-600">{b.modelo}</span>}
                          {b.color && <span className="text-slate-500 text-xs ml-1">({b.color})</span>}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{b.tipo_bicicleta_nombre || 'Sin tipo'}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{b.proveedor_nombre || 'Sin proveedor'}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{formatDate(b.fecha_adquisicion)}</td>
                        <td className="px-6 py-4 text-sm text-right font-medium text-slate-900">{formatCurrency(b.costo_compra)}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor(b.estado)}`}>
                            {b.estado.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="sticky right-0 bg-white border-l-2 border-slate-200 px-6 py-4 text-right z-10 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => setModalDetalle(b)} 
                              className="p-2 text-slate-600 hover:bg-slate-100 rounded transition-colors" 
                              title="Ver detalle"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {b.estado === 'adquirida' && (
                              <>
                                <button 
                                  onClick={() => handleEdit(b)} 
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors" 
                                  title="Editar"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDelete(b.id)} 
                                  className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors" 
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
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
          titulo={`Bicicleta ${modalDetalle.codigo_inventario}`}
          campos={[
            { label: 'Foto', value: modalDetalle.foto_url, tipo: 'imagen' },
            { label: 'Código de Inventario', value: modalDetalle.codigo_inventario },
            { label: 'Marca', value: modalDetalle.marca || '-' },
            { label: 'Modelo', value: modalDetalle.modelo || '-' },
            { label: 'Color', value: modalDetalle.color || '-' },
            { label: 'Año Fabricación', value: modalDetalle.ano_fabricacion?.toString() || '-' },
            { label: 'Número de Serie', value: modalDetalle.numero_serie || '-' },
            { label: 'Tipo de Bicicleta', value: modalDetalle.tipo_bicicleta_nombre || '-' },
            { label: 'Proveedor', value: modalDetalle.proveedor_nombre || '-' },
            { label: 'Fecha Adquisición', value: modalDetalle.fecha_adquisicion, tipo: 'fecha' },
            { label: 'Costo de Compra', value: modalDetalle.costo_compra, tipo: 'moneda' },
            { label: 'Precio Venta Sugerido', value: modalDetalle.precio_venta_sugerido, tipo: 'moneda' },
            { label: 'Estado', value: modalDetalle.estado.replace('_', ' ').toUpperCase(), tipo: 'estado' },
            { label: 'Detalles a Reparar', value: modalDetalle.detalles_requeridos || '-', tipo: 'texto' },
            { label: 'Observaciones', value: modalDetalle.observaciones || '-', tipo: 'texto' },
          ]}
          onClose={() => setModalDetalle(null)}
        />
      )}
    </div>
  )
}