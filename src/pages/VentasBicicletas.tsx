import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, X, Search, Eye, DollarSign, Save, Trash2, Shield, Camera, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import ModalDetalle from '../components/ModalDetalle'
import ControlesPaginacion from '../components/ControlesPaginacion'

interface Venta {
  id: number
  numero_factura: string
  fecha_venta: string
  nombre_cliente: string
  documento_cliente: string
  monto_total: number
  rentabilidad_neta: number
  margen_porcentaje: number
  estado_pago: string
  bicicleta_info: string
  bicicleta_codigo: string
  garantia_id?: string
  costo_total_invertido?: number
}

interface BicicletaDisponible {
  id: number
  codigo_inventario: string
  marca: string
  modelo: string
  costo_compra: number
  precio_venta_sugerido: number
  foto_url?: string | null
}

interface Pago {
  id: string
  metodo_pago: string
  monto: number
  referencia: string
}

export default function VentasBicicletas() {
  const navigate = useNavigate()
  const selectorRef = useRef<HTMLDivElement>(null)
  const [ventas, setVentas] = useState<Venta[]>([])
  const [bicicletasDisponibles, setBicicletasDisponibles] = useState<BicicletaDisponible[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [modalDetalle, setModalDetalle] = useState<Venta | null>(null)
  const [paginaActual, setPaginaActual] = useState(1)
  const [registrosPorPagina, setRegistrosPorPagina] = useState(25)
  const [totalRegistros, setTotalRegistros] = useState(0)
  const [procesando, setProcesando] = useState(false)
  const [selectedBiciId, setSelectedBiciId] = useState<string>('')
  const [selectorAbierto, setSelectorAbierto] = useState(false)
  const [costosDesglose, setCostosDesglose] = useState({
    compra: 0, reparaciones: 0, gastos: 0, comision: 0, total: 0
  })
  const [formData, setFormData] = useState({
    nombre_cliente: '', documento_cliente: '', telefono_cliente: '', email_cliente: '',
    precio_venta: '', observaciones: ''
  })
  const [pagos, setPagos] = useState<Pago[]>([{ id: '1', metodo_pago: 'efectivo', monto: 0, referencia: '' }])

  useEffect(() => { fetchVentas() }, [paginaActual, registrosPorPagina, searchTerm])
  useEffect(() => { if (showForm) fetchBicicletasDisponibles() }, [showForm])
  useEffect(() => {
    if (selectedBiciId) calcularCostos(parseInt(selectedBiciId))
    else setCostosDesglose({ compra: 0, reparaciones: 0, gastos: 0, comision: 0, total: 0 })
  }, [selectedBiciId])

  // Cierra el selector de bicicleta al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setSelectorAbierto(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Bloquea el scroll del fondo mientras el modal está abierto
  useEffect(() => {
    document.body.style.overflow = showForm ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [showForm])

  async function fetchVentas() {
    try {
      setLoading(true)
      let countQuery = supabase.from('ventas').select('*', { count: 'exact', head: true })
      if (searchTerm) countQuery = countQuery.or(`numero_factura.ilike.%${searchTerm}%,nombre_cliente.ilike.%${searchTerm}%`)
      const { count, error: countError } = await countQuery
      if (countError) throw countError
      setTotalRegistros(count || 0)

      const from = (paginaActual - 1) * registrosPorPagina
      const to = from + registrosPorPagina - 1
      let query = supabase
        .from('ventas')
        .select(`*, bicicletas_adquiridas(codigo_inventario, marca, modelo)`)
        .order('fecha_venta', { ascending: false })
        .range(from, to)
      if (searchTerm) query = query.or(`numero_factura.ilike.%${searchTerm}%,nombre_cliente.ilike.%${searchTerm}%`)
      const { data, error } = await query
      if (error) throw error
      const procesadas = data?.map((v: any) => ({
        ...v,
        bicicleta_codigo: v.bicicletas_adquiridas?.codigo_inventario || '-',
        bicicleta_info: `${v.bicicletas_adquiridas?.marca || ''} ${v.bicicletas_adquiridas?.modelo || ''}`.trim() || '-',
        garantia_id: v.garantia_id || null
      })) || []
      setVentas(procesadas)
    } catch (error: any) {
      toast.error('Error cargando ventas: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchBicicletasDisponibles() {
    const { data } = await supabase
      .from('bicicletas_adquiridas')
      .select('id, codigo_inventario, marca, modelo, costo_compra, precio_venta_sugerido, foto_url')
      .eq('estado', 'disponible_venta')
      .order('codigo_inventario')
    setBicicletasDisponibles(data || [])
  }

  async function calcularCostos(biciId: number) {
    const { data: bici } = await supabase.from('bicicletas_adquiridas').select('costo_compra, comision_intermediario').eq('id', biciId).single()
    const compra = bici?.costo_compra || 0
    const comision = bici?.comision_intermediario || 0
    const { data: ordenes } = await supabase
      .from('ordenes_servicio')
      .select('costo_real')
      .eq('bicicleta_adquirida_id', biciId)
      .eq('tipo_orden', 'interna_bicicleta_usada')
      .eq('estado', 'Completada')
    const reparaciones = ordenes?.reduce((sum, o) => sum + (o.costo_real || 0), 0) || 0
    const { data: gastos } = await supabase
      .from('gastos_adicionales_bicicleta')
      .select('monto')
      .eq('bicicleta_adquirida_id', biciId)
    const gastosAdic = gastos?.reduce((sum, g) => sum + (g.monto || 0), 0) || 0
    setCostosDesglose({
      compra, reparaciones, gastos: gastosAdic, comision,
      total: compra + reparaciones + gastosAdic + comision
    })
  }

  function agregarPago() {
    setPagos([...pagos, { id: Date.now().toString(), metodo_pago: 'efectivo', monto: 0, referencia: '' }])
  }

  function actualizarPago(id: string, campo: keyof Pago, valor: any) {
    setPagos(pagos.map(p => p.id === id ? { ...p, [campo]: valor } : p))
  }

  function eliminarPago(id: string) {
    if (pagos.length > 1) setPagos(pagos.filter(p => p.id !== id))
  }

  const totalPagos = pagos.reduce((sum, p) => sum + (parseFloat(String(p.monto)) || 0), 0)
  const precioVentaNum = parseFloat(formData.precio_venta) || 0
  const rentabilidad = precioVentaNum - costosDesglose.total
  const margen = costosDesglose.total > 0 ? (rentabilidad / costosDesglose.total) * 100 : 0
  const pagosCuadrados = Math.abs(totalPagos - precioVentaNum) < 0.01
  const bicicletaSeleccionada = bicicletasDisponibles.find(b => b.id.toString() === selectedBiciId) || null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedBiciId) { toast.error('Selecciona una bicicleta'); return }
    if (precioVentaNum <= 0) { toast.error('El precio de venta debe ser mayor a 0'); return }
    if (!pagosCuadrados) { toast.error(`Los pagos no cuadran. Diferencia: $${(precioVentaNum - totalPagos).toFixed(2)}`); return }
    setProcesando(true)
    try {
      const { data: ventaData, error: errorVenta } = await supabase
        .from('ventas')
        .insert([{
          bicicleta_adquirida_id: parseInt(selectedBiciId),
          nombre_cliente: formData.nombre_cliente,
          documento_cliente: formData.documento_cliente,
          telefono_cliente: formData.telefono_cliente,
          email_cliente: formData.email_cliente,
          metodo_pago_principal: pagos[0].metodo_pago,
          monto_total: precioVentaNum,
          costo_total_invertido: costosDesglose.total,
          rentabilidad_neta: rentabilidad,
          margen_porcentaje: margen,
          estado_pago: 'pagado',
          observaciones: formData.observaciones,
          numero_factura: ''
        }])
        .select()
        .single()
      if (errorVenta) throw errorVenta
      const pagosToInsert = pagos.map(p => ({
        venta_id: ventaData.id,
        metodo_pago: p.metodo_pago,
        monto: parseFloat(String(p.monto)),
        referencia: p.referencia || null
      }))
      const { error: errorPagos } = await supabase.from('pagos_ventas').insert(pagosToInsert)
      if (errorPagos) throw errorPagos
      const { error: errorBici } = await supabase
        .from('bicicletas_adquiridas')
        .update({
          estado: 'vendida',
          precio_venta_final: precioVentaNum,
          fecha_venta: new Date().toISOString()
        })
        .eq('id', parseInt(selectedBiciId))
      if (errorBici) throw errorBici
      if (ventaData.garantia_id) {
        toast.success(`¡Venta registrada! Garantía creada automáticamente`)
      } else {
        toast.success('¡Venta registrada exitosamente!')
      }
      resetForm()
      fetchVentas()
      navigate(`/certificado-reacondicionamiento/${ventaData.id}`)
    } catch (error: any) {
      toast.error('Error al registrar venta: ' + error.message)
    } finally {
      setProcesando(false)
    }
  }

  function resetForm() {
    setShowForm(false)
    setSelectedBiciId('')
    setSelectorAbierto(false)
    setFormData({ nombre_cliente: '', documento_cliente: '', telefono_cliente: '', email_cliente: '', precio_venta: '', observaciones: '' })
    setPagos([{ id: '1', metodo_pago: 'efectivo', monto: 0, referencia: '' }])
    setCostosDesglose({ compra: 0, reparaciones: 0, gastos: 0, comision: 0, total: 0 })
  }

  const formatCurrency = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v || 0)
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('es-CO') : '-'

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Ventas de Bicicletas</h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">Registro de ventas y control de rentabilidad</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-green-700 w-full sm:w-auto">
          <DollarSign className="w-4 h-4" /> Nueva Venta
        </button>
      </div>

      {/* ✅ MODAL CORREGIDO: contenedor fijo como único scroll + wrapper min-h-full.
          Nunca recorta la parte superior: el selector de bicicleta siempre es visible y alcanzable. */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-4xl my-8 bg-white rounded-xl shadow-xl">
              <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-xl border-b border-slate-200 bg-white p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-slate-800">Registrar Nueva Venta</h2>
                <button onClick={resetForm} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
              </div>

              <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Selector de bicicleta con foto */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bicicleta a Vender *</label>
                  <div ref={selectorRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setSelectorAbierto(!selectorAbierto)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-white flex items-center gap-3 text-left"
                    >
                      {bicicletaSeleccionada ? (
                        <>
                          {bicicletaSeleccionada.foto_url ? (
                            <img src={bicicletaSeleccionada.foto_url} alt={bicicletaSeleccionada.codigo_inventario} className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0" />
                          ) : (
                            <div className="w-10 h-10 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center shrink-0">
                              <Camera className="w-4 h-4 text-slate-400" />
                            </div>
                          )}
                          <span className="flex-1 text-sm text-slate-800 truncate">
                            {bicicletaSeleccionada.codigo_inventario} - {bicicletaSeleccionada.marca} {bicicletaSeleccionada.modelo}
                          </span>
                          <span className="text-xs text-slate-500 hidden sm:inline">Sugerida: {formatCurrency(bicicletaSeleccionada.precio_venta_sugerido)}</span>
                        </>
                      ) : (
                        <span className="flex-1 text-sm text-slate-500">Seleccionar bicicleta disponible...</span>
                      )}
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${selectorAbierto ? 'rotate-180' : ''}`} />
                    </button>

                    {selectorAbierto && (
                      <div className="absolute z-20 mt-1 w-full bg-white border border-slate-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                        {bicicletasDisponibles.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-slate-500">No hay bicicletas disponibles para venta</div>
                        ) : (
                          bicicletasDisponibles.map(b => (
                            <button
                              type="button"
                              key={b.id}
                              onClick={() => { setSelectedBiciId(b.id.toString()); setSelectorAbierto(false) }}
                              className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-green-50 text-left border-b border-slate-100 last:border-0 ${
                                selectedBiciId === b.id.toString() ? 'bg-green-50' : ''
                              }`}
                            >
                              {b.foto_url ? (
                                <img src={b.foto_url} alt={b.codigo_inventario} className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0" />
                              ) : (
                                <div className="w-10 h-10 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center shrink-0">
                                  <Camera className="w-4 h-4 text-slate-400" />
                                </div>
                              )}
                              <span className="flex-1 text-sm text-slate-800">
                                {b.codigo_inventario} - {b.marca} {b.modelo}
                              </span>
                              <span className="text-xs text-slate-500 hidden sm:inline">Sugerida: {formatCurrency(b.precio_venta_sugerido)}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Análisis de costos con foto de la bicicleta seleccionada */}
                {selectedBiciId && bicicletaSeleccionada && (
                  <div className="bg-slate-50 rounded-lg p-3 sm:p-4 border border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-3">
                      {bicicletaSeleccionada.foto_url ? (
                        <img src={bicicletaSeleccionada.foto_url} alt={bicicletaSeleccionada.codigo_inventario} className="w-12 h-12 object-cover rounded-lg border border-slate-200" />
                      ) : (
                        <div className="w-12 h-12 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center">
                          <Camera className="w-5 h-5 text-slate-400" />
                        </div>
                      )}
                      Análisis de Costos y Rentabilidad
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 text-sm">
                      <div><span className="text-slate-500">Compra:</span><div className="font-medium">{formatCurrency(costosDesglose.compra)}</div></div>
                      <div><span className="text-slate-500">Reparaciones:</span><div className="font-medium">{formatCurrency(costosDesglose.reparaciones)}</div></div>
                      <div><span className="text-slate-500">Gastos/Comis.:</span><div className="font-medium">{formatCurrency(costosDesglose.gastos + costosDesglose.comision)}</div></div>
                      <div className="border-l border-slate-300 pl-2"><span className="text-slate-700 font-bold">Costo Total:</span><div className="font-bold text-slate-900">{formatCurrency(costosDesglose.total)}</div></div>
                      <div className={`border-l border-slate-300 pl-2 col-span-2 md:col-span-1 ${rentabilidad >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        <span className="font-bold">Rentabilidad:</span>
                        <div className="font-bold text-lg">{formatCurrency(rentabilidad)} ({margen.toFixed(1)}%)</div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Nombre Cliente *</label><input type="text" value={formData.nombre_cliente} onChange={(e) => setFormData({...formData, nombre_cliente: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg" required /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Documento</label><input type="text" value={formData.documento_cliente} onChange={(e) => setFormData({...formData, documento_cliente: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Teléfono</label><input type="text" value={formData.telefono_cliente} onChange={(e) => setFormData({...formData, telefono_cliente: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></div>
                  <div><label className="block text-xs font-medium text-slate-600 mb-1">Email</label><input type="email" value={formData.email_cliente} onChange={(e) => setFormData({...formData, email_cliente: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></div>
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Precio de Venta Final *</label>
                    <input type="number" step="0.01" value={formData.precio_venta} onChange={(e) => setFormData({...formData, precio_venta: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-lg font-bold text-green-700" required />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Desglose de Pagos</h4>
                  {pagos.map((pago) => (
                    <div key={pago.id} className="flex flex-col sm:flex-row gap-2 mb-3 sm:mb-2 sm:items-end bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-lg">
                      <div className="flex-1 w-full">
                        <label className="block text-xs text-slate-500">Método</label>
                        <select value={pago.metodo_pago} onChange={(e) => actualizarPago(pago.id, 'metodo_pago', e.target.value)} className="w-full px-2 py-1 border border-slate-300 rounded text-sm">
                          <option value="efectivo">Efectivo</option>
                          <option value="transferencia">Transferencia</option>
                          <option value="tarjeta_credito">Tarjeta Crédito</option>
                          <option value="tarjeta_debito">Tarjeta Débito</option>
                          <option value="nequi">Nequi</option>
                          <option value="daviplata">Daviplata</option>
                        </select>
                      </div>
                      <div className="w-full sm:w-32">
                        <label className="block text-xs text-slate-500">Monto</label>
                        <input type="number" step="0.01" value={pago.monto} onChange={(e) => actualizarPago(pago.id, 'monto', parseFloat(e.target.value))} className="w-full px-2 py-1 border border-slate-300 rounded text-sm" />
                      </div>
                      <div className="flex-1 w-full">
                        <label className="block text-xs text-slate-500">Referencia (Opcional)</label>
                        <input type="text" value={pago.referencia} onChange={(e) => actualizarPago(pago.id, 'referencia', e.target.value)} className="w-full px-2 py-1 border border-slate-300 rounded text-sm" />
                      </div>
                      {pagos.length > 1 && (
                        <button type="button" onClick={() => eliminarPago(pago.id)} className="p-2 text-red-500 hover:bg-red-50 rounded self-end"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={agregarPago} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-2">
                    <Plus className="w-3 h-3" /> Agregar otro método de pago
                  </button>
                  <div className={`mt-3 text-sm font-medium text-right ${pagosCuadrados ? 'text-green-600' : 'text-red-600'}`}>
                    Total Pagos: {formatCurrency(totalPagos)} {pagosCuadrados ? '✓' : `(Faltan ${formatCurrency(precioVentaNum - totalPagos)})`}
                  </div>
                </div>

                <div><label className="block text-xs font-medium text-slate-600 mb-1">Observaciones</label><textarea value={formData.observaciones} onChange={(e) => setFormData({...formData, observaciones: e.target.value})} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg" /></div>

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t border-slate-200">
                  <button type="button" onClick={resetForm} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg w-full sm:w-auto">Cancelar</button>
                  <button type="submit" disabled={procesando || !pagosCuadrados} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50 w-full sm:w-auto">
                    {procesando ? 'Procesando...' : <><Save className="w-4 h-4" /> Confirmar Venta</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Buscar por factura o cliente..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPaginaActual(1) }} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (<div className="p-8 text-center text-slate-500">Cargando...</div>) : ventas.length === 0 ? (<div className="p-8 text-center text-slate-500">No hay ventas registradas</div>) : (
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Factura</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Fecha</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Cliente</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Bicicleta</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-slate-700">Monto</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-green-700">Rentabilidad</th>
                    <th className="sticky right-0 bg-slate-50 border-l-2 border-slate-200 px-6 py-3 text-sm font-medium text-slate-700 z-10">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {ventas.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm font-mono font-medium">{v.numero_factura}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{formatDate(v.fecha_venta)}</td>
                      <td className="px-6 py-4 text-sm text-slate-800">{v.nombre_cliente}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{v.bicicleta_codigo} <span className="text-xs text-slate-400">({v.bicicleta_info})</span></td>
                      <td className="px-6 py-4 text-sm text-right font-medium">{formatCurrency(v.monto_total)}</td>
                      <td className={`px-6 py-4 text-sm text-right font-bold ${v.rentabilidad_neta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(v.rentabilidad_neta)} <span className="text-xs">({v.margen_porcentaje?.toFixed(1)}%)</span>
                      </td>
                      <td className="sticky right-0 bg-white border-l-2 border-slate-200 px-6 py-4 text-right z-10">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => navigate(`/certificado-reacondicionamiento/${v.id}`)}
                            className="p-2 text-purple-600 hover:bg-purple-50 rounded"
                            title="Ver Certificado de Reacondicionamiento"
                          >
                            <Shield className="w-4 h-4" />
                          </button>
                          <button onClick={() => setModalDetalle(v)} className="p-2 text-slate-600 hover:bg-slate-100 rounded" title="Ver detalle">
                            <Eye className="w-4 h-4" />
                          </button>
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

      <ControlesPaginacion paginaActual={paginaActual} totalRegistros={totalRegistros} registrosPorPagina={registrosPorPagina} onPageChange={setPaginaActual} onRegistrosPorPaginaChange={(c) => { setRegistrosPorPagina(c); setPaginaActual(1) }} />

      {modalDetalle && (
        <ModalDetalle
          titulo={`Venta ${modalDetalle.numero_factura}`}
          campos={[
            { label: 'Cliente', value: modalDetalle.nombre_cliente },
            { label: 'Documento', value: modalDetalle.documento_cliente || '-' },
            { label: 'Bicicleta', value: `${modalDetalle.bicicleta_codigo} - ${modalDetalle.bicicleta_info}` },
            { label: 'Fecha', value: modalDetalle.fecha_venta, tipo: 'fecha' },
            { label: 'Monto Total', value: modalDetalle.monto_total, tipo: 'moneda' },
            { label: 'Costo Invertido', value: modalDetalle.costo_total_invertido, tipo: 'moneda' },
            { label: 'Rentabilidad Neta', value: modalDetalle.rentabilidad_neta, tipo: 'moneda' },
            { label: 'Margen %', value: `${modalDetalle.margen_porcentaje?.toFixed(2)}%` },
            { label: 'ID Garantía', value: modalDetalle.garantia_id || 'No generada', tipo: 'texto' },
          ]}
          onClose={() => setModalDetalle(null)}
        />
      )}
    </div>
  )
}