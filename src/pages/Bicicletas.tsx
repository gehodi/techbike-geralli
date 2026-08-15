import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Edit, Trash2, Save, X, Search, Eye, Camera, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import ModalDetalle from '../components/ModalDetalle'

interface Bicicleta {
  id: string
  cliente_id: string
  cliente_nombre: string
  marca: string
  modelo: string
  numero_serie: string
  talla: string
  color: string
  tipo_bicicleta_id: number
  tipo_bicicleta_nombre: string
  año: number
  notas: string
  foto_principal_url?: string
  fecha_registro: string
}

interface Cliente { id: string; nombres: string; apellidos: string }
interface TipoBicicleta { id: number; nombre: string }

export default function Bicicletas() {
  const formRef = useRef<HTMLDivElement>(null)
  const [bicicletas, setBicicletas] = useState<Bicicleta[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [tiposBicicleta, setTiposBicicleta] = useState<TipoBicicleta[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [modalDetalle, setModalDetalle] = useState<Bicicleta | null>(null)

  // Estados para manejo de foto
  const [fotoActual, setFotoActual] = useState<string | null>(null)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [uploadingFoto, setUploadingFoto] = useState(false)

  const [formData, setFormData] = useState({
    cliente_id: '', marca: '', modelo: '', numero_serie: '', talla: '',
    color: '', tipo_bicicleta_id: '', año: '', notas: ''
  })

  useEffect(() => {
    fetchBicicletas()
    fetchClientes()
    fetchTiposBicicleta()
  }, [])

  async function fetchBicicletas() {
    try {
      const { data, error } = await supabase
        .from('bicicletas')
        .select(`*, clientes(nombres, apellidos), tipos_de_bicicletas(id, nombre)`)
        .order('marca')

      if (error) throw error

      const procesadas = data?.map((b: any) => ({
        ...b,
        cliente_nombre: b.clientes ? `${b.clientes.nombres} ${b.clientes.apellidos}` : 'Sin cliente',
        tipo_bicicleta_nombre: b.tipos_de_bicicletas?.nombre || 'Sin tipo'
      })) || []

      setBicicletas(procesadas)
    } catch (error: any) {
      toast.error('Error al cargar: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchClientes() {
    const { data } = await supabase.from('clientes').select('id, nombres, apellidos').order('apellidos')
    setClientes(data || [])
  }

  async function fetchTiposBicicleta() {
    const { data } = await supabase.from('tipos_de_bicicletas').select('id, nombre').order('nombre')
    setTiposBicicleta(data || [])
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

  async function uploadFoto(file: File, bicicletaId: string): Promise<string | null> {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${bicicletaId}/${Date.now()}.${fileExt}`

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
      let fotoUrl = fotoActual // Mantener la foto actual por defecto

      // Si hay una nueva foto seleccionada, subirla
      if (fotoFile) {
        setUploadingFoto(true)
        const nuevaUrl = await uploadFoto(fotoFile, editingId || 'nueva')
        setUploadingFoto(false)
        if (nuevaUrl) {
          fotoUrl = nuevaUrl
        }
      }

      const data: any = {
        cliente_id: formData.cliente_id || null,
        marca: formData.marca,
        modelo: formData.modelo,
        numero_serie: formData.numero_serie || null,
        talla: formData.talla || null,
        color: formData.color || null,
        tipo_bicicleta_id: formData.tipo_bicicleta_id ? parseInt(formData.tipo_bicicleta_id) : null,
        año: formData.año ? parseInt(formData.año) : null,
        notas: formData.notas || null,
        foto_principal_url: fotoUrl
      }

      if (editingId) {
        const { error } = await supabase.from('bicicletas').update(data).eq('id', editingId)
        if (error) throw error
        toast.success('Bicicleta actualizada')
      } else {
        const { error } = await supabase.from('bicicletas').insert([data])
        if (error) throw error
        toast.success('Bicicleta registrada')
      }
      resetForm()
      fetchBicicletas()
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    } finally {
      setUploadingFoto(false)
    }
  }

  function handleEdit(b: Bicicleta) {
    setFormData({
      cliente_id: b.cliente_id || '',
      marca: b.marca,
      modelo: b.modelo,
      numero_serie: b.numero_serie || '',
      talla: b.talla || '',
      color: b.color || '',
      tipo_bicicleta_id: b.tipo_bicicleta_id?.toString() || '',
      año: b.año?.toString() || '',
      notas: b.notas || ''
    })
    // Cargar foto actual en el formulario
    setFotoActual(b.foto_principal_url || null)
    setFotoPreview(b.foto_principal_url || null)
    setFotoFile(null)

    setEditingId(b.id)
    setShowForm(true)
    setModalDetalle(null)

    // Scroll suave al formulario
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta bicicleta?')) return
    try {
      const { error } = await supabase.from('bicicletas').delete().eq('id', id)
      if (error) throw error
      toast.success('Bicicleta eliminada')
      fetchBicicletas()
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    }
  }

  function resetForm() {
    setFormData({ cliente_id: '', marca: '', modelo: '', numero_serie: '', talla: '', color: '', tipo_bicicleta_id: '', año: '', notas: '' })
    setFotoActual(null)
    setFotoPreview(null)
    setFotoFile(null)
    setEditingId(null)
    setShowForm(false)
  }

  const filtered = bicicletas.filter(b =>
    b.marca.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.modelo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.numero_serie || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.tipo_bicicleta_nombre || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Bicicletas</h1>
          <p className="text-slate-500 mt-1">Registro de bicicletas de clientes</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(!showForm) }} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{showForm ? 'Cancelar' : 'Nueva Bicicleta'}
        </button>
      </div>

      {showForm && (
        <div ref={formRef} className="bg-white p-6 rounded-xl shadow-sm border-2 border-blue-300 scroll-mt-20">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">{editingId ? 'Editar Bicicleta' : 'Nueva Bicicleta'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cliente *</label>
                <select value={formData.cliente_id} onChange={(e) => setFormData({...formData, cliente_id: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required>
                  <option value="">Seleccionar...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombres} {c.apellidos}</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Marca *</label><input type="text" value={formData.marca} onChange={(e) => setFormData({...formData, marca: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Modelo *</label><input type="text" value={formData.modelo} onChange={(e) => setFormData({...formData, modelo: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Número de Serie</label><input type="text" value={formData.numero_serie} onChange={(e) => setFormData({...formData, numero_serie: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Talla</label><input type="text" value={formData.talla} onChange={(e) => setFormData({...formData, talla: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ej: M, 54cm" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Color</label><input type="text" value={formData.color} onChange={(e) => setFormData({...formData, color: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Bicicleta</label>
                <select value={formData.tipo_bicicleta_id} onChange={(e) => setFormData({...formData, tipo_bicicleta_id: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">Seleccionar...</option>
                  {tiposBicicleta.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Año</label><input type="number" value={formData.año} onChange={(e) => setFormData({...formData, año: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
            </div>

            {/* SECCIÓN DE FOTO */}
            <div className="border-t border-slate-200 pt-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Foto de la Bicicleta</label>
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

            <div><label className="block text-sm font-medium text-slate-700 mb-1">Notas</label><textarea value={formData.notas} onChange={(e) => setFormData({...formData, notas: e.target.value})} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>

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
        <input type="text" placeholder="Buscar por marca, modelo, serie, cliente o tipo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (<div className="p-8 text-center text-slate-500">Cargando...</div>) : filtered.length === 0 ? (<div className="p-8 text-center text-slate-500">{searchTerm ? 'No se encontraron bicicletas' : 'No hay bicicletas registradas'}</div>) : (
          <div className="overflow-x-auto">
            <div className="min-w-[1000px]">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Foto</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Marca/Modelo</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Serie</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Cliente</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Talla</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Tipo</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Año</th>
                    <th className="sticky right-0 bg-slate-50 border-l-2 border-slate-200 px-6 py-3 text-sm font-medium text-slate-700 z-10 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50 group">
                      <td className="px-6 py-4">
                        {b.foto_principal_url ? (
                          <img
                            src={b.foto_principal_url}
                            alt={`${b.marca} ${b.modelo}`}
                            className="h-12 w-12 object-cover rounded-lg border border-slate-200 cursor-pointer hover:scale-110 transition-transform"
                            onClick={() => window.open(b.foto_principal_url, '_blank')}
                          />
                        ) : (
                          <div className="h-12 w-12 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center">
                            <Camera className="w-5 h-5 text-slate-400" />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900 cursor-pointer" onClick={() => setModalDetalle(b)}>{b.marca} {b.modelo}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 font-mono cursor-pointer" onClick={() => setModalDetalle(b)}>{b.numero_serie || '-'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 cursor-pointer" onClick={() => setModalDetalle(b)}>{b.cliente_nombre}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 cursor-pointer" onClick={() => setModalDetalle(b)}>{b.talla || '-'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 cursor-pointer" onClick={() => setModalDetalle(b)}>{b.tipo_bicicleta_nombre}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 cursor-pointer" onClick={() => setModalDetalle(b)}>{b.año || '-'}</td>
                      <td className="sticky right-0 bg-white group-hover:bg-slate-50 border-l-2 border-slate-200 px-6 py-4 text-right z-10 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setModalDetalle(b)} className="p-2 text-slate-600 hover:bg-slate-100 rounded"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => handleEdit(b)} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(b.id)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
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
          titulo={`${modalDetalle.marca} ${modalDetalle.modelo}`}
          campos={[
            { label: 'Foto', value: modalDetalle.foto_principal_url, tipo: 'imagen' },
            { label: 'Cliente', value: modalDetalle.cliente_nombre },
            { label: 'Número de Serie', value: modalDetalle.numero_serie || '-' },
            { label: 'Talla', value: modalDetalle.talla || '-' },
            { label: 'Color', value: modalDetalle.color || '-' },
            { label: 'Tipo de Bicicleta', value: modalDetalle.tipo_bicicleta_nombre },
            { label: 'Año', value: modalDetalle.año || '-' },
            { label: 'Notas', value: modalDetalle.notas || '-', tipo: 'texto' },
            { label: 'Fecha de Registro', value: modalDetalle.fecha_registro, tipo: 'fecha' },
          ]}
          onClose={() => setModalDetalle(null)}
        />
      )}
    </div>
  )
}