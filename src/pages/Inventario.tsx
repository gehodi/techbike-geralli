import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Edit, Trash2, Save, X, Search, Eye, AlertTriangle, Lock, Camera, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import ModalDetalle from '../components/ModalDetalle'
import ControlesPaginacion from '../components/ControlesPaginacion'

interface Inventario {
  id: number
  nombre: string
  categoria_id: number
  marca_id: number
  proveedor_id: number
  codigo: string
  stock_actual: number
  stock_reservado: number
  stock_dañado: number
  stock_minimo: number
  precio_compra: number
  precio_venta: number
  ubicacion: string
  notas: string
  foto_url?: string
  fecha_registro: string
}

interface Categoria { id: number; nombre: string }
interface Marca { id: number; nombre: string }
interface Proveedor { id: number; nombre: string }

export default function Inventario() {
  const formRef = useRef<HTMLDivElement>(null)
  const [inventario, setInventario] = useState<Inventario[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [modalDetalle, setModalDetalle] = useState<Inventario | null>(null)

  // Estados para paginación
  const [paginaActual, setPaginaActual] = useState(1)
  const [registrosPorPagina, setRegistrosPorPagina] = useState(25)
  const [totalRegistros, setTotalRegistros] = useState(0)

  // Estados para manejo de foto
  const [fotoActual, setFotoActual] = useState<string | null>(null)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [uploadingFoto, setUploadingFoto] = useState(false)

  const [formData, setFormData] = useState({
    nombre: '', categoria_id: '', marca_id: '', proveedor_id: '', codigo: '',
    stock_actual: '', stock_minimo: '', precio_compra: '',
    precio_venta: '', ubicacion: '', notas: ''
  })

  useEffect(() => {
    fetchCategorias()
    fetchMarcas()
    fetchProveedores()
  }, [])

  useEffect(() => {
    fetchInventario()
  }, [paginaActual, registrosPorPagina, searchTerm])

  async function fetchInventario() {
    try {
      setLoading(true)

      // Consulta para contar total de registros (con filtro si hay búsqueda)
      let countQuery = supabase.from('inventario').select('*', { count: 'exact', head: true })
      
      if (searchTerm) {
        const term = `%${searchTerm}%`
        countQuery = countQuery.or(`nombre.ilike.${term},codigo.ilike.${term}`)
      }

      const { count, error: countError } = await countQuery
      if (countError) throw countError
      setTotalRegistros(count || 0)

      // Consulta paginada
      const from = (paginaActual - 1) * registrosPorPagina
      const to = from + registrosPorPagina - 1

      let query = supabase
        .from('inventario')
        .select('*')
        .order('nombre')
        .range(from, to)

      if (searchTerm) {
        const term = `%${searchTerm}%`
        query = query.or(`nombre.ilike.${term},codigo.ilike.${term}`)
      }

      const { data, error } = await query
      if (error) throw error
      setInventario(data || [])

      // Resetear a página 1 si la página actual está vacía
      if (data && data.length === 0 && paginaActual > 1) {
        setPaginaActual(1)
      }
    } catch (error: any) {
      toast.error('Error al cargar: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchCategorias() {
    const { data } = await supabase.from('categorias').select('id, nombre').order('nombre')
    setCategorias(data || [])
  }

  async function fetchMarcas() {
    const { data } = await supabase.from('marcas_inventario').select('id, nombre').order('nombre')
    setMarcas(data || [])
  }

  async function fetchProveedores() {
    const { data } = await supabase.from('proveedores').select('id, nombre').order('nombre')
    setProveedores(data || [])
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

  async function uploadFoto(file: File, inventarioId: number | string): Promise<string | null> {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `inventario/${inventarioId}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('fotos-bicicletas')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('fotos-bicicletas')
        .getPublicUrl(fileName)

      return publicUrl
    } catch (error: any) {
      toast.error('Error al subir foto: ' + error.message)
      return null
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      let fotoUrl = fotoActual

      if (fotoFile) {
        setUploadingFoto(true)
        const nuevaUrl = await uploadFoto(fotoFile, editingId || 'nuevo')
        setUploadingFoto(false)
        if (nuevaUrl) {
          fotoUrl = nuevaUrl
        }
      }

      let data: any = {
        nombre: formData.nombre,
        categoria_id: formData.categoria_id ? parseInt(formData.categoria_id) : null,
        marca_id: formData.marca_id ? parseInt(formData.marca_id) : null,
        proveedor_id: formData.proveedor_id ? parseInt(formData.proveedor_id) : null,
        codigo: formData.codigo || null,
        precio_compra: formData.precio_compra ? parseFloat(formData.precio_compra) : null,
        precio_venta: formData.precio_venta ? parseFloat(formData.precio_venta) : null,
        ubicacion: formData.ubicacion || null,
        notas: formData.notas || null,
        foto_url: fotoUrl
      }

      if (!editingId) {
        data.stock_actual = parseInt(formData.stock_actual) || 0
        data.stock_minimo = parseInt(formData.stock_minimo) || 0
      }

      if (editingId) {
        const { error } = await supabase.from('inventario').update(data).eq('id', editingId)
        if (error) throw error
        toast.success('Item actualizado')
      } else {
        const { error } = await supabase.from('inventario').insert([data])
        if (error) throw error
        toast.success('Item registrado')
      }
      resetForm()
      fetchInventario()
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    } finally {
      setUploadingFoto(false)
    }
  }

  function handleEdit(i: Inventario) {
    setFormData({
      nombre: i.nombre,
      categoria_id: i.categoria_id?.toString() || '',
      marca_id: i.marca_id?.toString() || '',
      proveedor_id: i.proveedor_id?.toString() || '',
      codigo: i.codigo || '',
      stock_actual: i.stock_actual.toString(),
      stock_minimo: i.stock_minimo.toString(),
      precio_compra: i.precio_compra?.toString() || '',
      precio_venta: i.precio_venta?.toString() || '',
      ubicacion: i.ubicacion || '',
      notas: i.notas || ''
    })
    setFotoActual(i.foto_url || null)
    setFotoPreview(i.foto_url || null)
    setFotoFile(null)

    setEditingId(i.id)
    setShowForm(true)
    setModalDetalle(null)

    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este item?')) return
    try {
      const { error } = await supabase.from('inventario').delete().eq('id', id)
      if (error) throw error
      toast.success('Item eliminado')
      fetchInventario()
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    }
  }

  function resetForm() {
    setFormData({ nombre: '', categoria_id: '', marca_id: '', proveedor_id: '', codigo: '', stock_actual: '', stock_minimo: '', precio_compra: '', precio_venta: '', ubicacion: '', notas: '' })
    setFotoActual(null)
    setFotoPreview(null)
    setFotoFile(null)
    setEditingId(null)
    setShowForm(false)
  }

  const getNombreCategoria = (id: number | null) => categorias.find(c => c.id === id)?.nombre || '-'
  const getNombreMarca = (id: number | null) => marcas.find(m => m.id === id)?.nombre || '-'
  const getNombreProveedor = (id: number | null) => proveedores.find(p => p.id === id)?.nombre || '-'

  const formatCurrency = (v: number | null | undefined) => {
    if (v === null || v === undefined) return '$0'
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
  }

  const getStockStatus = (item: Inventario) => {
    const disponible = item.stock_actual - (item.stock_reservado || 0)
    if (disponible <= 0) return { color: 'bg-red-100 text-red-800', text: 'Agotado' }
    if (disponible <= item.stock_minimo) return { color: 'bg-yellow-100 text-yellow-800', text: 'Stock Bajo' }
    return { color: 'bg-green-100 text-green-800', text: 'Disponible' }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inventario</h1>
          <p className="text-slate-500 mt-1">Gestión de repuestos y materiales</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(!showForm) }} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{showForm ? 'Cancelar' : 'Nuevo Item'}
        </button>
      </div>

      {showForm && (
        <div ref={formRef} className="bg-white p-6 rounded-xl shadow-sm border-2 border-blue-300 scroll-mt-20">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">{editingId ? 'Editar Item' : 'Nuevo Item'}</h2>
          {editingId && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <strong>Modo edición:</strong> Solo se pueden modificar descripciones, características y precios.
                Las existencias (stock) se modifican únicamente mediante transacciones
                (órdenes de servicio, requisiciones, ajustes de inventario).
              </div>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label><input type="text" value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Código</label><input type="text" value={formData.codigo} onChange={(e) => setFormData({...formData, codigo: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
                <select value={formData.categoria_id} onChange={(e) => setFormData({...formData, categoria_id: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">Seleccionar...</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Marca</label>
                <select value={formData.marca_id} onChange={(e) => setFormData({...formData, marca_id: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">Seleccionar...</option>
                  {marcas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Proveedor</label>
                <select value={formData.proveedor_id} onChange={(e) => setFormData({...formData, proveedor_id: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">Seleccionar...</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Ubicación</label><input type="text" value={formData.ubicacion} onChange={(e) => setFormData({...formData, ubicacion: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                  Stock Actual *
                  {editingId && <Lock className="w-3 h-3 text-amber-600" title="Bloqueado en edición" />}
                </label>
                <input
                  type="number"
                  value={formData.stock_actual}
                  onChange={(e) => setFormData({...formData, stock_actual: e.target.value})}
                  disabled={!!editingId}
                  className={`w-full px-3 py-2 border rounded-lg outline-none ${
                    editingId
                      ? 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed'
                      : 'border-slate-300 focus:ring-2 focus:ring-blue-500'
                  }`}
                  required
                />
                {editingId && (
                  <p className="text-xs text-amber-600 mt-1">
                    Para modificar existencias use: Órdenes de Servicio o Solicitudes de Inventario
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                  Stock Mínimo
                  {editingId && <Lock className="w-3 h-3 text-amber-600" title="Bloqueado en edición" />}
                </label>
                <input
                  type="number"
                  value={formData.stock_minimo}
                  onChange={(e) => setFormData({...formData, stock_minimo: e.target.value})}
                  disabled={!!editingId}
                  className={`w-full px-3 py-2 border rounded-lg outline-none ${
                    editingId
                      ? 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed'
                      : 'border-slate-300 focus:ring-2 focus:ring-blue-500'
                  }`}
                />
                {editingId && (
                  <p className="text-xs text-amber-600 mt-1">
                    Parámetro de control - se modifica mediante ajustes de inventario
                  </p>
                )}
              </div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Precio Compra</label><input type="number" step="0.01" value={formData.precio_compra} onChange={(e) => setFormData({...formData, precio_compra: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Precio Venta</label><input type="number" step="0.01" value={formData.precio_venta} onChange={(e) => setFormData({...formData, precio_venta: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
            </div>
            {/* SECCIÓN DE FOTO */}
            <div className="border-t border-slate-200 pt-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Foto del Item</label>
              <div className="flex items-center gap-4">
                {fotoPreview ? (
                  <div className="relative">
                    <img
                      src={fotoPreview}
                      alt="Foto item"
                      className="h-32 w-32 object-cover rounded-lg border-2 border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => { setFotoFile(null); setFotoPreview(null); setFotoActual(null); }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
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
                  <label className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 text-sm w-fit">
                    <Upload className="w-4 h-4 text-slate-600" />
                    <span>{fotoFile ? 'Cambiar foto' : 'Subir/Cambiar foto'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFotoChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-slate-500 mt-2">Máximo 5MB. En móviles abrirá la cámara.</p>
                </div>
              </div>
            </div>
            <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Notas</label><textarea value={formData.notas} onChange={(e) => setFormData({...formData, notas: e.target.value})} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={resetForm} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button
                type="submit"
                disabled={uploadingFoto}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
              >
                {uploadingFoto ? (
                  <>
                    <Upload className="w-4 h-4 animate-spin" /> Subiendo...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> {editingId ? 'Actualizar' : 'Guardar'}
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
          placeholder="Buscar por nombre, código, categoría o marca..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setPaginaActual(1) // Resetear a página 1 al buscar
          }}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Leyenda de Stock:</h3>
        <div className="flex gap-4 text-sm flex-wrap">
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full font-medium">Disponible</span>
          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full font-medium">Stock Bajo</span>
          <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full font-medium">Agotado</span>
        </div>
        <p className="text-xs text-slate-500 mt-2">Stock Disponible = Stock Actual - Stock Reservado</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando...</div>
        ) : inventario.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {searchTerm ? 'No se encontraron items' : 'No hay items en inventario'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div className="min-w-[1200px]">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Foto</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Nombre</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Código</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Categoría</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Marca</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Proveedor</th>
                      <th className="text-right px-6 py-3 text-sm font-medium text-slate-700">Stock Actual</th>
                      <th className="text-right px-6 py-3 text-sm font-medium text-slate-700">Stock Reservado</th>
                      <th className="text-right px-6 py-3 text-sm font-medium text-green-700">Stock Disponible</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Estado</th>
                      <th className="text-right px-6 py-3 text-sm font-medium text-slate-700">Precio Venta</th>
                      <th className="sticky right-0 bg-slate-50 border-l-2 border-slate-200 px-6 py-3 text-sm font-medium text-slate-700 z-10 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {inventario.map((i) => {
                      const stockStatus = getStockStatus(i)
                      const disponible = i.stock_actual - (i.stock_reservado || 0)
                      return (
                        <tr key={i.id} className="hover:bg-slate-50 group">
                          <td className="px-6 py-4">
                            {i.foto_url ? (
                              <img
                                src={i.foto_url}
                                alt={i.nombre}
                                className="h-12 w-12 object-cover rounded-lg border border-slate-200 cursor-pointer hover:scale-110 transition-transform"
                                onClick={() => window.open(i.foto_url, '_blank')}
                              />
                            ) : (
                              <div className="h-12 w-12 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center">
                                <Camera className="w-5 h-5 text-slate-400" />
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-900 cursor-pointer" onClick={() => setModalDetalle(i)}>{i.nombre}</td>
                          <td className="px-6 py-4 text-sm text-slate-600 font-mono cursor-pointer" onClick={() => setModalDetalle(i)}>{i.codigo || '-'}</td>
                          <td className="px-6 py-4 text-sm text-slate-600 cursor-pointer" onClick={() => setModalDetalle(i)}>{getNombreCategoria(i.categoria_id)}</td>
                          <td className="px-6 py-4 text-sm text-slate-600 cursor-pointer" onClick={() => setModalDetalle(i)}>{getNombreMarca(i.marca_id)}</td>
                          <td className="px-6 py-4 text-sm text-slate-600 cursor-pointer" onClick={() => setModalDetalle(i)}>{getNombreProveedor(i.proveedor_id)}</td>
                          <td className="px-6 py-4 text-sm text-right text-slate-600 cursor-pointer" onClick={() => setModalDetalle(i)}>{i.stock_actual}</td>
                          <td className="px-6 py-4 text-sm text-right text-orange-600 font-medium cursor-pointer" onClick={() => setModalDetalle(i)}>{i.stock_reservado || 0}</td>
                          <td className={`px-6 py-4 text-sm text-right font-bold cursor-pointer ${disponible <= 0 ? 'text-red-600' : disponible <= i.stock_minimo ? 'text-yellow-600' : 'text-green-600'}`} onClick={() => setModalDetalle(i)}>
                            {disponible}
                          </td>
                          <td className="px-6 py-4 cursor-pointer" onClick={() => setModalDetalle(i)}>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${stockStatus.color}`}>
                              {stockStatus.text}
                            </span>
                            {disponible <= i.stock_minimo && disponible > 0 && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-yellow-600">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Mín: {i.stock_minimo}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-right font-medium cursor-pointer" onClick={() => setModalDetalle(i)}>{formatCurrency(i.precio_venta)}</td>
                          <td className="sticky right-0 bg-white group-hover:bg-slate-50 border-l-2 border-slate-200 px-6 py-4 text-right z-10 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => setModalDetalle(i)} className="p-2 text-slate-600 hover:bg-slate-100 rounded" title="Ver detalle"><Eye className="w-4 h-4" /></button>
                              <button onClick={() => handleEdit(i)} className="p-2 text-blue-600 hover:bg-blue-50 rounded" title="Editar item"><Edit className="w-4 h-4" /></button>
                              <button onClick={() => handleDelete(i.id)} className="p-2 text-red-600 hover:bg-red-50 rounded" title="Eliminar item"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Controles de Paginación */}
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
          titulo={modalDetalle.nombre}
          campos={[
            { label: 'Foto', value: modalDetalle.foto_url, tipo: 'imagen' },
            { label: 'Código', value: modalDetalle.codigo || '-' },
            { label: 'Categoría', value: getNombreCategoria(modalDetalle.categoria_id) },
            { label: 'Marca', value: getNombreMarca(modalDetalle.marca_id) },
            { label: 'Proveedor', value: getNombreProveedor(modalDetalle.proveedor_id) },
            { label: 'Ubicación', value: modalDetalle.ubicacion || '-' },
            { label: '══════════════════════════', value: '', tipo: 'texto' },
            { label: 'STOCK ACTUAL', value: modalDetalle.stock_actual.toString(), tipo: 'texto' },
            { label: 'STOCK RESERVADO', value: (modalDetalle.stock_reservado || 0).toString(), tipo: 'texto' },
            { label: 'STOCK DAÑADO', value: (modalDetalle.stock_dañado || 0).toString(), tipo: 'texto' },
            { label: '══════════════════════════', value: '', tipo: 'texto' },
            { label: 'STOCK DISPONIBLE', value: (modalDetalle.stock_actual - (modalDetalle.stock_reservado || 0)).toString(), tipo: 'texto' },
            { label: 'Stock Mínimo', value: modalDetalle.stock_minimo.toString(), tipo: 'texto' },
            { label: '══════════════════════════', value: '', tipo: 'texto' },
            { label: 'Precio Compra', value: modalDetalle.precio_compra, tipo: 'moneda' },
            { label: 'Precio Venta', value: modalDetalle.precio_venta, tipo: 'moneda' },
            { label: 'Notas', value: modalDetalle.notas || '-', tipo: 'texto' },
            { label: 'Fecha Registro', value: modalDetalle.fecha_registro, tipo: 'fecha' },
          ]}
          onClose={() => setModalDetalle(null)}
        />
      )}
    </div>
  )
}