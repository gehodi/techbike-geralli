import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { FileText, ClipboardList, TrendingUp, Package, Wrench, DollarSign, Download, X } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  generarCotizacionPDF,
  generarOrdenesPorEstadoPDF,
  generarComparacionPDF,
  generarInventarioPDF,
  generarOrdenesPorMecanicoPDF,
  generarIngresosPDF
} from '../utils/pdfGenerator'

interface ReporteCard {
  id: number
  titulo: string
  descripcion: string
  icono: React.ReactNode
  color: string
}

export default function Reportes() {
  const [modalAbierto, setModalAbierto] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [mecanicoId, setMecanicoId] = useState('')
  const [estadoOrden, setEstadoOrden] = useState('')
  const [cotizacionId, setCotizacionId] = useState('')
  const [ordenId, setOrdenId] = useState('')
  const [cotizacionesDisponibles, setCotizacionesDisponibles] = useState<any[]>([])
  const [ordenesCompletadas, setOrdenesCompletadas] = useState<any[]>([])
  const [mecanicos, setMecanicos] = useState<any[]>([])

  useEffect(() => {
    if (modalAbierto !== null) {
      if (modalAbierto === 1) fetchCotizacionesPendientes()
      if (modalAbierto === 3) fetchOrdenesCompletadas()
      if (modalAbierto === 5) fetchMecanicos()
    }
  }, [modalAbierto])

  async function fetchCotizacionesPendientes() {
    const { data } = await supabase
      .from('cotizaciones')
      .select(`id, fecha_cotizacion, total, solicitudes_servicio ( clientes (nombres, apellidos), bicicletas (marca, modelo) )`)
      .eq('estado', 'Pendiente')
      .order('id', { ascending: false })
    const procesadas = (data || []).map((c: any) => ({
      id: c.id,
      label: `#${c.id} - ${c.solicitudes_servicio?.clientes?.nombres || ''} ${c.solicitudes_servicio?.clientes?.apellidos || ''} - ${c.solicitudes_servicio?.bicicletas?.marca || ''} ${c.solicitudes_servicio?.bicicletas?.modelo || ''}`,
      cliente: `${c.solicitudes_servicio?.clientes?.nombres || ''} ${c.solicitudes_servicio?.clientes?.apellidos || ''}`,
      bicicleta: `${c.solicitudes_servicio?.bicicletas?.marca || ''} ${c.solicitudes_servicio?.bicicletas?.modelo || ''}`
    }))
    setCotizacionesDisponibles(procesadas)
  }

  // ✅ CORREGIDO: Incluir join con bicicletas_adquiridas
  async function fetchOrdenesCompletadas() {
    const { data } = await supabase
      .from('ordenes_servicio')
      .select(`
        id, 
        numero_orden, 
        tipo_orden,
        clientes (nombres, apellidos), 
        bicicletas (marca, modelo),
        bicicletas_adquiridas (codigo_inventario, marca, modelo)
      `)
      .eq('estado', 'Completada')
      .order('id', { ascending: false })
    const procesadas = (data || []).map((o: any) => {
      // Determinar bicicleta según tipo de orden
      const esInterna = o.tipo_orden === 'interna_bicicleta_usada'
      const bici = esInterna ? o.bicicletas_adquiridas : o.bicicletas
      const biciLabel = bici 
        ? `${bici.codigo_inventario ? bici.codigo_inventario + ' - ' : ''}${bici.marca || ''} ${bici.modelo || ''}`.trim()
        : 'Sin bicicleta'
      
      const clienteLabel = o.clientes 
        ? `${o.clientes.nombres || ''} ${o.clientes.apellidos || ''}`.trim()
        : (esInterna ? 'Interna' : 'Sin cliente')
      
      return {
        id: o.id,
        label: `${o.numero_orden || 'S/N'} - ${clienteLabel} - ${biciLabel}`,
        tipo_orden: o.tipo_orden
      }
    })
    setOrdenesCompletadas(procesadas)
  }

  async function fetchMecanicos() {
    const { data } = await supabase
      .from('mecanicos')
      .select('id, nombres, apellidos')
      .order('apellidos')
    setMecanicos(data || [])
  }

  const reportes: ReporteCard[] = [
    {
      id: 1,
      titulo: 'Cotización al Cliente',
      descripcion: 'Generar PDF de cotización para enviar al cliente',
      icono: <FileText className="w-8 h-8" />,
      color: 'bg-blue-500'
    },
    {
      id: 2,
      titulo: 'Órdenes por Estado',
      descripcion: 'Listado de órdenes agrupadas por estado',
      icono: <ClipboardList className="w-8 h-8" />,
      color: 'bg-green-500'
    },
    {
      id: 3,
      titulo: 'Detalle de Orden Completada',
      descripcion: 'Ver detalle completo de una orden de servicio',
      icono: <TrendingUp className="w-8 h-8" />,
      color: 'bg-purple-500'
    },
    {
      id: 4,
      titulo: 'Listado de Inventario',
      descripcion: 'Inventario completo con existencias reales',
      icono: <Package className="w-8 h-8" />,
      color: 'bg-orange-500'
    },
    {
      id: 5,
      titulo: 'Órdenes por Mecánico',
      descripcion: 'Órdenes asignadas por mecánico en rango de fechas',
      icono: <Wrench className="w-8 h-8" />,
      color: 'bg-red-500'
    },
    {
      id: 6,
      titulo: 'Ingresos por Órdenes',
      descripcion: 'Informe de ingresos por órdenes completadas',
      icono: <DollarSign className="w-8 h-8" />,
      color: 'bg-emerald-500'
    }
  ]

  const handleGenerarReporte = async (reporteId: number) => {
    setLoading(true)
    try {
      switch (reporteId) {
        case 1:
          if (!cotizacionId) { toast.error('Seleccione una cotización'); setLoading(false); return }
          await generarCotizacionDesdeBD(parseInt(cotizacionId))
          break
        case 2:
          if (!estadoOrden) { toast.error('Seleccione un estado'); setLoading(false); return }
          await generarOrdenesDesdeBD(estadoOrden)
          break
        case 3:
          if (!ordenId) { toast.error('Seleccione una orden'); setLoading(false); return }
          await generarComparacionDesdeBD(parseInt(ordenId))
          break
        case 4:
          await generarInventarioDesdeBD()
          break
        case 5:
          if (!mecanicoId || !fechaInicio || !fechaFin) { toast.error('Complete todos los campos'); setLoading(false); return }
          await generarOrdenesMecanicoDesdeBD(parseInt(mecanicoId), fechaInicio, fechaFin)
          break
        case 6:
          if (!fechaInicio || !fechaFin) { toast.error('Seleccione el rango de fechas'); setLoading(false); return }
          await generarIngresosDesdeBD(fechaInicio, fechaFin)
          break
      }
      setModalAbierto(null)
      resetFiltros()
    } catch (error) {
      console.error('Error generando reporte:', error)
      toast.error('Error al generar el reporte')
    } finally {
      setLoading(false)
    }
  }

  const toNum = (v: any): number => {
    if (v === null || v === undefined) return 0
    return parseFloat(String(v)) || 0
  }

  // ✅ FUNCIÓN HELPER: Procesar orden para reportes (maneja ambos tipos)
  const procesarOrdenParaReporte = (o: any) => {
    const esInterna = o.tipo_orden === 'interna_bicicleta_usada' || o.tipo_orden === 'garantia'
    const bici = esInterna ? o.bicicletas_adquiridas : o.bicicletas
    const cliente = o.clientes
    
    return {
      ...o,
      costo_estimado: toNum(o.costo_estimado),
      costo_real: toNum(o.costo_real),
      tipo_orden: o.tipo_orden || 'cliente',
      cliente_nombre: cliente 
        ? `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim()
        : (esInterna ? 'Interna' : 'Sin cliente'),
      bicicleta_info: bici 
        ? `${bici.codigo_inventario ? bici.codigo_inventario + ' - ' : ''}${bici.marca || ''} ${bici.modelo || ''}`.trim()
        : 'Sin bicicleta',
      bicicleta_codigo: bici?.codigo_inventario || '',
      mecanico_nombre: o.mecanicos ? `${o.mecanicos.nombres} ${o.mecanicos.apellidos}` : 'Sin asignar'
    }
  }

  const generarCotizacionDesdeBD = async (id: number) => {
    const { data: cotizacion } = await supabase
      .from('cotizaciones')
      .select(`*, solicitudes_servicio ( clientes (nombres, apellidos), bicicletas (marca, modelo) )`)
      .eq('id', id)
      .single()
    const { data: detalle } = await supabase
      .from('detalle_cotizaciones')
      .select('*')
      .eq('cotizacion_id', id)
    if (cotizacion && detalle) {
      const detalleConvertido = (detalle || []).map((d: any) => ({
        ...d,
        cantidad: toNum(d.cantidad),
        precio_unitario: toNum(d.precio_unitario),
        subtotal: toNum(d.subtotal)
      }))
      const cotizacionProcesada = {
        ...cotizacion,
        total: toNum(cotizacion.total),
        cliente_nombre: `${cotizacion.solicitudes_servicio?.clientes?.nombres || ''} ${cotizacion.solicitudes_servicio?.clientes?.apellidos || ''}`,
        bicicleta_info: `${cotizacion.solicitudes_servicio?.bicicletas?.marca || ''} ${cotizacion.solicitudes_servicio?.bicicletas?.modelo || ''}`
      }
      generarCotizacionPDF(cotizacionProcesada, detalleConvertido)
      toast.success('Cotización generada correctamente')
    }
  }

  // ✅ CORREGIDO: Incluir join con bicicletas_adquiridas
  const generarOrdenesDesdeBD = async (estado: string) => {
    const { data: ordenes } = await supabase
      .from('ordenes_servicio')
      .select(`
        *, 
        clientes (nombres, apellidos), 
        bicicletas (marca, modelo),
        bicicletas_adquiridas (codigo_inventario, marca, modelo),
        mecanicos (nombres, apellidos)
      `)
      .eq('estado', estado)
    if (ordenes) {
      const ordenesProcesadas = ordenes.map(procesarOrdenParaReporte)
      generarOrdenesPorEstadoPDF(ordenesProcesadas, estado)
      toast.success('Reporte de órdenes generado')
    }
  }

  // ✅ CORREGIDO: Incluir join con bicicletas_adquiridas
  const generarComparacionDesdeBD = async (ordenIdParam: number) => {
    const { data: orden } = await supabase
      .from('ordenes_servicio')
      .select(`
        *, 
        clientes (nombres, apellidos), 
        bicicletas (marca, modelo),
        bicicletas_adquiridas (codigo_inventario, marca, modelo),
        mecanicos (nombres, apellidos)
      `)
      .eq('id', ordenIdParam)
      .single()
    const { data: detalleOrden } = await supabase
      .from('detalle_ordenes_servicio')
      .select('*')
      .eq('orden_id', ordenIdParam)
    if (orden) {
      const detalleOrdenConvertido = (detalleOrden || []).map((d: any) => ({
        ...d,
        cantidad: toNum(d.cantidad),
        cantidad_usada: toNum(d.cantidad_usada),
        cantidad_dañada: toNum(d.cantidad_dañada),
        precio_unitario: toNum(d.precio_unitario),
        subtotal: toNum(d.subtotal)
      }))
      const ordenProcesada = procesarOrdenParaReporte(orden)
      
      let cotizacionProcesada: any = null
      let detalleCotizacion: any[] = []
      if (orden.cotizacion_id) {
        const { data: cotizacion } = await supabase
          .from('cotizaciones')
          .select('*')
          .eq('id', orden.cotizacion_id)
          .single()
        const { data: detalleCot } = await supabase
          .from('detalle_cotizaciones')
          .select('*')
          .eq('cotizacion_id', orden.cotizacion_id)
        cotizacionProcesada = cotizacion ? { ...cotizacion, total: toNum(cotizacion.total) } : null
        detalleCotizacion = (detalleCot || []).map((d: any) => ({
          ...d,
          cantidad: toNum(d.cantidad),
          precio_unitario: toNum(d.precio_unitario),
          subtotal: toNum(d.subtotal)
        }))
      }
      generarComparacionPDF(ordenProcesada, cotizacionProcesada, detalleOrdenConvertido, detalleCotizacion)
      toast.success('Detalle de orden generado')
    }
  }

  const generarInventarioDesdeBD = async () => {
    const { data: inventario } = await supabase
      .from('inventario')
      .select(`*, categorias (nombre), marcas_inventario (nombre), proveedores (nombre)`)
      .order('nombre')
    if (inventario) {
      const inventarioProcesado = inventario.map(i => ({
        ...i,
        stock_actual: toNum(i.stock_actual),
        stock_reservado: toNum(i.stock_reservado),
        stock_minimo: toNum(i.stock_minimo),
        precio_compra: toNum(i.precio_compra),
        precio_venta: toNum(i.precio_venta),
        categoria: i.categorias?.nombre || '-',
        marca: i.marcas_inventario?.nombre || '-'
      }))
      generarInventarioPDF(inventarioProcesado)
      toast.success('Inventario generado')
    }
  }

  // ✅ CORREGIDO: Incluir join con bicicletas_adquiridas
  const generarOrdenesMecanicoDesdeBD = async (mecanicoIdParam: number, inicio: string, fin: string) => {
    const { data: mecanico } = await supabase
      .from('mecanicos')
      .select('nombres, apellidos')
      .eq('id', mecanicoIdParam)
      .single()
    const { data: ordenes } = await supabase
      .from('ordenes_servicio')
      .select(`
        *, 
        clientes (nombres, apellidos), 
        bicicletas (marca, modelo),
        bicicletas_adquiridas (codigo_inventario, marca, modelo)
      `)
      .eq('mecanico_id', mecanicoIdParam)
      .gte('fecha_ingreso', inicio)
      .lte('fecha_ingreso', fin)
    if (ordenes && mecanico) {
      const ordenesProcesadas = ordenes.map(procesarOrdenParaReporte)
      const nombreMecanico = `${mecanico.nombres} ${mecanico.apellidos}`
      generarOrdenesPorMecanicoPDF(ordenesProcesadas, nombreMecanico, inicio, fin)
      toast.success('Reporte por mecánico generado')
    }
  }

  // ✅ CORREGIDO: Incluir join con bicicletas_adquiridas
  const generarIngresosDesdeBD = async (inicio: string, fin: string) => {
    const { data: ordenes } = await supabase
      .from('ordenes_servicio')
      .select(`
        *, 
        clientes (nombres, apellidos), 
        bicicletas (marca, modelo),
        bicicletas_adquiridas (codigo_inventario, marca, modelo),
        detalle_ordenes_servicio (tipo, subtotal)
      `)
      .eq('estado', 'Completada')
      .gte('fecha_entrega_real', inicio)
      .lte('fecha_entrega_real', fin)
    if (ordenes) {
      const ordenesProcesadas = ordenes.map(o => {
        const totalServicios = (o.detalle_ordenes_servicio || [])
          .filter((d: any) => d.tipo === 'servicio')
          .reduce((sum: number, d: any) => sum + toNum(d.subtotal), 0)
        const totalRepuestos = (o.detalle_ordenes_servicio || [])
          .filter((d: any) => d.tipo === 'repuesto')
          .reduce((sum: number, d: any) => sum + toNum(d.subtotal), 0)
        return {
          ...procesarOrdenParaReporte(o),
          total_servicios: totalServicios,
          total_repuestos: totalRepuestos
        }
      })
      generarIngresosPDF(ordenesProcesadas, inicio, fin)
      toast.success('Informe de ingresos generado')
    }
  }

  const resetFiltros = () => {
    setFechaInicio('')
    setFechaFin('')
    setMecanicoId('')
    setEstadoOrden('')
    setCotizacionId('')
    setOrdenId('')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Reportes PDF</h1>
        <p className="text-slate-500 mt-1">Genere informes y documentos PDF del sistema</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportes.map((reporte) => (
          <div
            key={reporte.id}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setModalAbierto(reporte.id)}
          >
            <div className={`${reporte.color} w-16 h-16 rounded-lg flex items-center justify-center text-white mb-4`}>
              {reporte.icono}
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">{reporte.titulo}</h3>
            <p className="text-sm text-slate-500">{reporte.descripcion}</p>
            <div className="mt-4 flex items-center text-blue-600 text-sm font-medium">
              <Download className="w-4 h-4 mr-2" />
              Generar Reporte
            </div>
          </div>
        ))}
      </div>
      {modalAbierto !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-800">
                {reportes.find(r => r.id === modalAbierto)?.titulo}
              </h3>
              <button
                onClick={() => { setModalAbierto(null); resetFiltros() }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {modalAbierto === 1 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Cotización Pendiente</label>
                  <select
                    value={cotizacionId}
                    onChange={(e) => setCotizacionId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Seleccionar cotización...</option>
                    {cotizacionesDisponibles.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                  {cotizacionesDisponibles.length === 0 && (
                    <p className="text-xs text-slate-500 mt-1">No hay cotizaciones pendientes</p>
                  )}
                </div>
              )}
              {modalAbierto === 2 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Estado de Órdenes</label>
                  <select
                    value={estadoOrden}
                    onChange={(e) => setEstadoOrden(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Seleccionar estado...</option>
                    <option value="Pendiente">Pendiente</option>
                    <option value="En Proceso">En Proceso</option>
                    <option value="Completada">Completada</option>
                  </select>
                </div>
              )}
              {modalAbierto === 3 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Orden Completada</label>
                  <select
                    value={ordenId}
                    onChange={(e) => setOrdenId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Seleccionar orden...</option>
                    {ordenesCompletadas.map(o => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                  {ordenesCompletadas.length === 0 && (
                    <p className="text-xs text-slate-500 mt-1">No hay órdenes completadas</p>
                  )}
                </div>
              )}
              {modalAbierto === 5 && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Mecánico</label>
                    <select
                      value={mecanicoId}
                      onChange={(e) => setMecanicoId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Seleccionar mecánico...</option>
                      {mecanicos.map(m => (
                        <option key={m.id} value={m.id}>{m.nombres} {m.apellidos}</option>
                      ))}
                    </select>
                    {mecanicos.length === 0 && (
                      <p className="text-xs text-slate-500 mt-1">No hay mecánicos registrados</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Fecha Inicio</label>
                      <input
                        type="date"
                        value={fechaInicio}
                        onChange={(e) => setFechaInicio(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Fecha Fin</label>
                      <input
                        type="date"
                        value={fechaFin}
                        onChange={(e) => setFechaFin(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </>
              )}
              {modalAbierto === 6 && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Fecha Inicio</label>
                    <input
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Fecha Fin</label>
                    <input
                      type="date"
                      value={fechaFin}
                      onChange={(e) => setFechaFin(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => { setModalAbierto(null); resetFiltros() }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleGenerarReporte(modalAbierto)}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Generar PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}