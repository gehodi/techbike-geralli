import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Bike, Camera, CheckCircle, AlertTriangle, X, Upload, ChevronDown, Search } from 'lucide-react'
import toast from 'react-hot-toast'

interface TipoBicicleta {
  id: number
  nombre: string
}

interface Bicicleta {
  id: string
  marca: string
  modelo: string
  numero_serie: string
  tipo_bicicleta_id: number | null
  tipo_nombre?: string
  foto_principal_url?: string
}

interface SelectorBicicletaClienteProps {
  clienteId: string
  value: string
  onChange: (bicicletaId: string) => void
}

export default function SelectorBicicletaCliente({ clienteId, value, onChange }: SelectorBicicletaClienteProps) {
  const [bicicletas, setBicicletas] = useState<Bicicleta[]>([])
  const [tiposBicicleta, setTiposBicicleta] = useState<TipoBicicleta[]>([])
  const [showNewForm, setShowNewForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [newBike, setNewBike] = useState({
    marca: '', modelo: '', numero_serie: '', tipo_bicicleta_id: ''
  })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  // Estados para el dropdown personalizado
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (clienteId) {
      fetchBicicletas()
    } else {
      setBicicletas([])
    }
    fetchTiposBicicleta()
  }, [clienteId])

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function fetchBicicletas() {
    try {
      const { data, error } = await supabase
        .from('bicicletas')
        .select('id, marca, modelo, numero_serie, tipo_bicicleta_id, foto_principal_url')
        .eq('cliente_id', clienteId)
        .order('marca')

      if (error) {
        console.error('Error cargando bicicletas:', error)
        toast.error('Error al cargar bicicletas: ' + error.message)
        return
      }

      const bicicletasConTipo = await Promise.all(
        (data || []).map(async (b: any) => {
          let tipoNombre = 'Sin tipo'
          if (b.tipo_bicicleta_id) {
            const { data: tipoData } = await supabase
              .from('tipos_de_bicicletas')
              .select('nombre')
              .eq('id', b.tipo_bicicleta_id)
              .single()
            tipoNombre = tipoData?.nombre || 'Sin tipo'
          }
          return {
            ...b,
            tipo_nombre: tipoNombre
          }
        })
      )
      setBicicletas(bicicletasConTipo)
      console.log('Bicicletas cargadas:', bicicletasConTipo.length)
    } catch (error: any) {
      console.error('Error:', error)
      toast.error('Error al cargar bicicletas')
    }
  }

  async function fetchTiposBicicleta() {
    try {
      const { data, error } = await supabase
        .from('tipos_de_bicicletas')
        .select('id, nombre')
        .order('nombre')

      if (error) {
        console.error('Error cargando tipos:', error)
        return
      }
      setTiposBicicleta(data || [])
    } catch (error: any) {
      console.error('Error:', error)
    }
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
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
      setPhotoFile(file)
      setPhotoPreview(URL.createObjectURL(file))
      console.log('Foto seleccionada:', file.name, file.size)
    }
  }

  async function uploadPhoto(file: File, clienteId: string): Promise<string | null> {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${clienteId}/${Date.now()}.${fileExt}`
      console.log('Subiendo foto:', fileName)

      const { error: uploadError } = await supabase.storage
        .from('fotos-bicicletas')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Error de upload:', uploadError)
        throw uploadError
      }

      const { data: { publicUrl } } = supabase.storage
        .from('fotos-bicicletas')
        .getPublicUrl(fileName)

      console.log('Foto subida exitosamente:', publicUrl)
      return publicUrl
    } catch (error: any) {
      console.error('Error al subir foto:', error)
      toast.error('Error al subir foto: ' + error.message)
      return null
    }
  }

  async function handleGuardarNueva(e: React.FormEvent) {
    e.preventDefault()
    if (!newBike.marca.trim() || !newBike.modelo.trim()) {
      toast.error('Marca y Modelo son obligatorios')
      return
    }

    setLoading(true)
    try {
      console.log('Buscando duplicados...')
      let query = supabase
        .from('bicicletas')
        .select('id, marca, modelo, numero_serie, foto_principal_url')
        .eq('cliente_id', clienteId)
        .ilike('marca', newBike.marca.trim())
        .ilike('modelo', newBike.modelo.trim())

      if (newBike.numero_serie.trim()) {
        query = query.eq('numero_serie', newBike.numero_serie.trim())
      }

      const { data: existentes, error: errorCheck } = await query
      if (errorCheck) {
        console.error('Error verificando duplicados:', errorCheck)
        throw errorCheck
      }

      console.log('Bicicletas existentes encontradas:', existentes?.length || 0)

      if (existentes && existentes.length > 0) {
        const bikeExistente = existentes[0]
        console.log('Bicicleta existente seleccionada:', bikeExistente.id)
        onChange(bikeExistente.id)
        setShowNewForm(false)
        resetForm()
        toast.success(
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span>¡Bicicleta ya registrada! Se seleccionó automáticamente.</span>
          </div>
        )
        setLoading(false)
        return
      }

      let fotoUrl: string | null = null
      if (photoFile) {
        console.log('Iniciando subida de foto...')
        setUploadingPhoto(true)
        fotoUrl = await uploadPhoto(photoFile, clienteId)
        setUploadingPhoto(false)
        if (!fotoUrl) {
          setLoading(false)
          return
        }
      }

      console.log('Insertando nueva bicicleta...')
      const { data: nuevaBike, error: errorInsert } = await supabase
        .from('bicicletas')
        .insert([{
          cliente_id: clienteId,
          marca: newBike.marca.trim(),
          modelo: newBike.modelo.trim(),
          numero_serie: newBike.numero_serie.trim() || null,
          tipo_bicicleta_id: newBike.tipo_bicicleta_id ? parseInt(newBike.tipo_bicicleta_id) : null,
          foto_principal_url: fotoUrl
        }])
        .select()
        .single()

      if (errorInsert) {
        console.error('Error insertando bicicleta:', errorInsert)
        throw errorInsert
      }

      console.log('Bicicleta creada:', nuevaBike.id)
      toast.success('Bicicleta registrada y seleccionada')
      onChange(nuevaBike.id)
      setShowNewForm(false)
      resetForm()
      fetchBicicletas()
    } catch (error: any) {
      console.error('Error al guardar:', error)
      toast.error('Error al guardar: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setNewBike({ marca: '', modelo: '', numero_serie: '', tipo_bicicleta_id: '' })
    setPhotoFile(null)
    setPhotoPreview(null)
  }

  // Bicicleta seleccionada actualmente
  const bicicletaSeleccionada = bicicletas.find(b => b.id === value)

  // Filtrar bicicletas por búsqueda
  const bicicletasFiltradas = bicicletas.filter(b => {
    const term = searchTerm.toLowerCase()
    return (
      b.marca.toLowerCase().includes(term) ||
      b.modelo.toLowerCase().includes(term) ||
      (b.numero_serie || '').toLowerCase().includes(term) ||
      (b.tipo_nombre || '').toLowerCase().includes(term)
    )
  })

  if (!clienteId) {
    return (
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center text-sm text-slate-500">
        <AlertTriangle className="w-4 h-4 inline mr-1" />
        Primero selecciona un cliente para ver sus bicicletas.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Dropdown personalizado con imágenes */}
      <div className="relative" ref={dropdownRef}>
        {/* Botón que muestra la bicicleta seleccionada */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center gap-3 px-3 py-2 bg-white border border-slate-300 rounded-lg hover:border-blue-400 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
        >
          {bicicletaSeleccionada ? (
            <>
              {bicicletaSeleccionada.foto_principal_url ? (
                <img
                  src={bicicletaSeleccionada.foto_principal_url}
                  alt={`${bicicletaSeleccionada.marca} ${bicicletaSeleccionada.modelo}`}
                  className="h-10 w-10 object-cover rounded-lg border border-slate-200 flex-shrink-0"
                />
              ) : (
                <div className="h-10 w-10 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center flex-shrink-0">
                  <Camera className="w-5 h-5 text-slate-400" />
                </div>
              )}
              <div className="flex-1 text-left">
                <div className="text-sm font-medium text-slate-900">
                  {bicicletaSeleccionada.marca} {bicicletaSeleccionada.modelo}
                </div>
                <div className="text-xs text-slate-500">
                  {bicicletaSeleccionada.numero_serie ? `Serie: ${bicicletaSeleccionada.numero_serie} • ` : ''}
                  {bicicletaSeleccionada.tipo_nombre}
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </>
          ) : (
            <>
              <div className="h-10 w-10 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center flex-shrink-0">
                <Bike className="w-5 h-5 text-slate-400" />
              </div>
              <div className="flex-1 text-left text-sm text-slate-500">
                Seleccionar bicicleta del cliente...
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </>
          )}
        </button>

        {/* Lista desplegable */}
        {isOpen && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-slate-300 rounded-lg shadow-lg max-h-64 overflow-hidden">
            {/* Buscador dentro del dropdown */}
            {bicicletas.length > 3 && (
              <div className="p-2 border-b border-slate-200">
                <div className="relative">
                  <Search className="absolute left-2 top-2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar bicicleta..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Lista de bicicletas */}
            <div className="overflow-y-auto max-h-48">
              {bicicletasFiltradas.length === 0 ? (
                <div className="p-3 text-center text-sm text-slate-500">
                  {searchTerm ? 'No se encontraron bicicletas' : 'No hay bicicletas registradas'}
                </div>
              ) : (
                bicicletasFiltradas.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      onChange(b.id)
                      setIsOpen(false)
                      setSearchTerm('')
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-blue-50 transition-colors ${
                      b.id === value ? 'bg-blue-50 border-l-4 border-blue-500' : 'border-l-4 border-transparent'
                    }`}
                  >
                    {b.foto_principal_url ? (
                      <img
                        src={b.foto_principal_url}
                        alt={`${b.marca} ${b.modelo}`}
                        className="h-10 w-10 object-cover rounded-lg border border-slate-200 flex-shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center flex-shrink-0">
                        <Camera className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-slate-900">
                        {b.marca} {b.modelo}
                      </div>
                      <div className="text-xs text-slate-500">
                        {b.numero_serie ? `Serie: ${b.numero_serie} • ` : ''}
                        {b.tipo_nombre}
                      </div>
                    </div>
                    {b.id === value && (
                      <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Input oculto para validación de formulario */}
        <input type="hidden" value={value} required />
      </div>

      {/* Botón para agregar nueva */}
      {!showNewForm && (
        <button
          type="button"
          onClick={() => setShowNewForm(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Registrar nueva bicicleta para este cliente
        </button>
      )}

      {/* Formulario inline de nueva bicicleta */}
      {showNewForm && (
        <div className="bg-slate-50 border-2 border-blue-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Bike className="w-4 h-4 text-blue-600" />
              Nueva Bicicleta
            </div>
            <button
              type="button"
              onClick={() => { setShowNewForm(false); resetForm(); }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Marca *</label>
              <input
                type="text"
                value={newBike.marca}
                onChange={(e) => setNewBike({ ...newBike, marca: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Ej: Specialized"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Modelo *</label>
              <input
                type="text"
                value={newBike.modelo}
                onChange={(e) => setNewBike({ ...newBike, modelo: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Ej: Rockhopper"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Número de Serie</label>
              <input
                type="text"
                value={newBike.numero_serie}
                onChange={(e) => setNewBike({ ...newBike, numero_serie: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Opcional, pero recomendado"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de Bicicleta</label>
              <select
                value={newBike.tipo_bicicleta_id}
                onChange={(e) => setNewBike({ ...newBike, tipo_bicicleta_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Seleccionar tipo...</option>
                {tiposBicicleta.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Captura de Foto */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Foto de la Bicicleta</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 text-sm">
                <Camera className="w-4 h-4 text-slate-600" />
                <span>{photoFile ? 'Cambiar foto' : 'Tomar/Subir foto'}</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
              {photoPreview && (
                <div className="relative">
                  <img src={photoPreview} alt="Preview" className="h-12 w-12 object-cover rounded-lg border border-slate-200" />
                  <button
                    type="button"
                    onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">Máximo 5MB. En móviles abrirá la cámara automáticamente.</p>
          </div>

          <button
            type="button"
            onClick={handleGuardarNueva}
            disabled={loading || uploadingPhoto}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {uploadingPhoto ? (
              <>
                <Upload className="w-4 h-4 animate-spin" /> Subiendo foto...
              </>
            ) : loading ? (
              'Guardando...'
            ) : (
              <>
                <CheckCircle className="w-4 h-4" /> Guardar y Seleccionar
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}