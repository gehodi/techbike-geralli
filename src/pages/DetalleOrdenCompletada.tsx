import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Package, Wrench, AlertTriangle, DollarSign, FileDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { toPng } from 'html-to-image'

interface OrdenDetalle {
  id: number
  numero_orden: string
  cliente_nombre: string
  bicicleta_info: string
  mecanico_nombre: string
  estado: string
  diagnostico: string
  trabajo_realizado: string
  costo_estimado: number
  costo_real: number
  fecha_ingreso: string
  fecha_entrega_estimada: string
  fecha_entrega_real: string
  notas: string
  sintomas_cliente: string
  trabajos_cotizados: string
  cotizacion_id: number
}

interface DetalleItem {
  id: number
  tipo: 'servicio' | 'repuesto'
  descripcion: string
  cantidad: number
  cantidad_usada: number
  cantidad_dañada: number
  precio_unitario: number
  subtotal: number
  estado_item: string
}

interface CotizacionDetalle {
  id: number
  fecha_cotizacion: string
  total: number
  notas: string
  items: DetalleItem[]
}

export default function DetalleOrdenCompletada() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const contenidoRef = useRef<HTMLDivElement>(null)
  const [orden, setOrden] = useState<OrdenDetalle | null>(null)
  const [detalleOrden, setDetalleOrden] = useState<DetalleItem[]>([])
  const [cotizacion, setCotizacion] = useState<CotizacionDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [generandoPDF, setGenerandoPDF] = useState(false)

  useEffect(() => {
    if (id) {
      fetchDetalleOrden(parseInt(id))
    }
  }, [id])

  async function fetchDetalleOrden(ordenId: number) {
    try {
      const { data: ordenData, error: errorOrden } = await supabase
        .from('ordenes_servicio')
        .select(`*, clientes(nombres, apellidos), bicicletas(marca, modelo), mecanicos(nombres, apellidos)`)
        .eq('id', ordenId)
        .single()

      if (errorOrden) throw errorOrden

      let costoEstimado = parseFloat(String(ordenData.costo_estimado)) || 0
      const ordenCompleta: OrdenDetalle = {
        ...ordenData,
        cliente_nombre: `${ordenData.clientes?.nombres || ''} ${ordenData.clientes?.apellidos || ''}`.trim() || 'Sin cliente',
        bicicleta_info: `${ordenData.bicicletas?.marca || ''} ${ordenData.bicicletas?.modelo || ''}`.trim() || 'Sin bicicleta',
        mecanico_nombre: ordenData.mecanicos ? `${ordenData.mecanicos.nombres} ${ordenData.mecanicos.apellidos}` : 'Sin asignar',
        costo_estimado: costoEstimado,
        costo_real: parseFloat(String(ordenData.costo_real)) || 0
      }

      setOrden(ordenCompleta)

      const { data: detalleData, error: errorDetalle } = await supabase
        .from('detalle_ordenes_servicio')
        .select('*')
        .eq('orden_id', ordenId)

      if (errorDetalle) throw errorDetalle

      const detalleConvertido: DetalleItem[] = (detalleData || []).map((d: any) => ({
        id: d.id,
        tipo: d.tipo,
        descripcion: d.descripcion || '',
        cantidad: parseFloat(String(d.cantidad)) || 0,
        cantidad_usada: parseFloat(String(d.cantidad_usada)) || 0,
        cantidad_dañada: parseFloat(String(d.cantidad_dañada)) || 0,
        precio_unitario: parseFloat(String(d.precio_unitario)) || 0,
        subtotal: parseFloat(String(d.subtotal)) || 0,
        estado_item: d.estado_item || ''
      }))

      setDetalleOrden(detalleConvertido)

      if (ordenData.cotizacion_id) {
        const { data: cotizacionData, error: errorCotizacion } = await supabase
          .from('cotizaciones')
          .select('*')
          .eq('id', ordenData.cotizacion_id)
          .single()

        if (!errorCotizacion && cotizacionData) {
          const { data: itemsCotizacion } = await supabase
            .from('detalle_cotizaciones')
            .select('*')
            .eq('cotizacion_id', ordenData.cotizacion_id)

          const itemsConvertidos: DetalleItem[] = (itemsCotizacion || []).map((d: any) => ({
            id: d.id,
            tipo: d.tipo,
            descripcion: d.descripcion || '',
            cantidad: parseFloat(String(d.cantidad)) || 0,
            cantidad_usada: parseFloat(String(d.cantidad_usada)) || 0,
            cantidad_dañada: parseFloat(String(d.cantidad_dañada)) || 0,
            precio_unitario: parseFloat(String(d.precio_unitario)) || 0,
            subtotal: parseFloat(String(d.subtotal)) || 0,
            estado_item: d.estado_item || ''
          }))

          const cotizacionCompleta = {
            ...cotizacionData,
            total: parseFloat(String(cotizacionData.total)) || 0,
            notas: cotizacionData.notas || '',
            items: itemsConvertidos
          }

          setCotizacion(cotizacionCompleta)
          setOrden(prev => prev ? { ...prev, costo_estimado: cotizacionCompleta.total } : null)
        }
      }
    } catch (error: any) {
      toast.error('Error al cargar: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerarPDF() {
    if (!contenidoRef.current) {
      toast.error('No se puede capturar el contenido')
      return
    }

    setGenerandoPDF(true)
    const toastId = toast.loading('Generando PDF...')

    try {
      const dataUrl = await toPng(contenidoRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#f8fafc',
        cacheBust: true
      })

      const { default: jsPDF } = await import('jspdf')
      const imgWidth = 210
      const pdf = new jsPDF('p', 'mm', 'a4')
      
      const img = new Image()
      img.src = dataUrl
      
      await new Promise((resolve) => {
        img.onload = () => {
          const ratio = Math.min(
            (imgWidth - 20) / img.width,
            277 / img.height
          )
          const finalWidth = img.width * ratio
          const finalHeight = img.height * ratio
          const x = (imgWidth - finalWidth) / 2
          
          pdf.addImage(dataUrl, 'PNG', x, 10, finalWidth, finalHeight)
          pdf.save(`Orden_${orden?.numero_orden}_Detalle.pdf`)
          resolve(true)
        }
      })

      toast.dismiss(toastId)
      toast.success('PDF generado correctamente')
    } catch (error: any) {
      toast.dismiss(toastId)
      toast.error('Error al generar PDF: ' + error.message)
    } finally {
      setGenerandoPDF(false)
    }
  }

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('es-CO') : '-'

  const formatCurrency = (v: number | null | undefined) => {
    if (v === null || v === undefined) return '$0.00'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(v)
  }

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando...</div>
  if (!orden) return <div className="p-8 text-center text-red-600">Orden no encontrada</div>

  const totalServiciosOrden = detalleOrden
    .filter(d => d.tipo === 'servicio')
    .reduce((sum, d) => sum + (d.cantidad_usada || d.cantidad) * d.precio_unitario, 0)

  const totalRepuestosOrden = detalleOrden
    .filter(d => d.tipo === 'repuesto')
    .reduce((sum, d) => sum + (d.cantidad_usada || 0) * d.precio_unitario, 0)

  const totalServiciosCotizacion = cotizacion?.items
    .filter(d => d.tipo === 'servicio')
    .reduce((sum, d) => sum + d.subtotal, 0) || 0

  const totalRepuestosCotizacion = cotizacion?.items
    .filter(d => d.tipo === 'repuesto')
    .reduce((sum, d) => sum + d.subtotal, 0) || 0

  return (
    <div className="space-y-6 p-8">
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-600 hover:text-slate-800">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        
        <button
          onClick={handleGenerarPDF}
          disabled={generandoPDF}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generandoPDF ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generando...
            </>
          ) : (
            <>
              <FileDown className="w-4 h-4" />
              Generar PDF
            </>
          )}
        </button>
      </div>

      <div ref={contenidoRef} className="bg-slate-50 p-8 rounded-lg">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 mb-2">Orden {orden.numero_orden}</h1>
              <div className="flex gap-4 text-sm text-slate-600">
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full font-medium">COMPLETADA</span>
                <span>Ingreso: {formatDate(orden.fecha_ingreso)}</span>
                <span>Entrega: {formatDate(orden.fecha_entrega_real)}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-600">Costo Estimado</div>
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(orden.costo_estimado)}</div>
              <div className="text-sm text-slate-600 mt-2">Costo Real</div>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(orden.costo_real)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-slate-50 p-4 rounded-lg">
              <h3 className="font-semibold text-slate-800 mb-2">Información del Cliente</h3>
              <div className="space-y-1 text-sm">
                <div><span className="text-slate-600">Cliente:</span> <span className="font-medium">{orden.cliente_nombre}</span></div>
                <div><span className="text-slate-600">Bicicleta:</span> <span className="font-medium">{orden.bicicleta_info}</span></div>
                <div><span className="text-slate-600">Mecánico:</span> <span className="font-medium">{orden.mecanico_nombre}</span></div>
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <h3 className="font-semibold text-slate-800 mb-2">Detalles del Servicio</h3>
              <div className="space-y-1 text-sm">
                <div><span className="text-slate-600">Síntomas:</span> <div className="mt-1">{orden.sintomas_cliente || '-'}</div></div>
                <div><span className="text-slate-600">Diagnóstico:</span> <div className="mt-1">{orden.diagnostico || '-'}</div></div>
                <div><span className="text-slate-600">Trabajo Realizado:</span> <div className="mt-1">{orden.trabajo_realizado || '-'}</div></div>
              </div>
            </div>
          </div>
        </div>

        {cotizacion && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-600" />
              Comparación: Cotización #{cotizacion.id} vs Orden Ejecutada
            </h2>
            <div className="grid grid-cols-2 gap-6">
              <div className="border border-slate-200 rounded-lg p-4">
                <h3 className="font-semibold text-slate-800 mb-4 text-center bg-blue-50 p-2 rounded">COTIZACIÓN</h3>
                <div className="space-y-3 mb-4">
                  <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Wrench className="w-4 h-4" /> Servicios
                  </h4>
                  {cotizacion.items.filter(i => i.tipo === 'servicio').map((item) => (
                    <div key={item.id} className="flex justify-between text-sm bg-slate-50 p-2 rounded">
                      <span>{item.descripcion}</span>
                      <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                    </div>
                  ))}
                  <div className="border-t border-slate-200 pt-2 text-right font-semibold">
                    Total Servicios: {formatCurrency(totalServiciosCotizacion)}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Package className="w-4 h-4" /> Repuestos
                  </h4>
                  {cotizacion.items.filter(i => i.tipo === 'repuesto').map((item) => (
                    <div key={item.id} className="flex justify-between text-sm bg-slate-50 p-2 rounded">
                      <span>{item.descripcion}</span>
                      <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                    </div>
                  ))}
                  <div className="border-t border-slate-200 pt-2 text-right font-semibold">
                    Total Repuestos: {formatCurrency(totalRepuestosCotizacion)}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t-2 border-blue-200 text-right">
                  <div className="text-lg font-bold text-blue-600">TOTAL: {formatCurrency(cotizacion.total)}</div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-4">
                <h3 className="font-semibold text-slate-800 mb-4 text-center bg-green-50 p-2 rounded">ORDEN EJECUTADA</h3>
                <div className="space-y-3 mb-4">
                  <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Wrench className="w-4 h-4" /> Servicios
                  </h4>
                  {detalleOrden.filter(i => i.tipo === 'servicio').map((item) => (
                    <div key={item.id} className="flex justify-between text-sm bg-slate-50 p-2 rounded">
                      <div>
                        <div>{item.descripcion}</div>
                        <div className="text-xs text-slate-500">Usados: {item.cantidad_usada || item.cantidad}</div>
                      </div>
                      <span className="font-medium">
                        {formatCurrency((item.cantidad_usada || item.cantidad) * item.precio_unitario)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-slate-200 pt-2 text-right font-semibold">
                    Total Servicios: {formatCurrency(totalServiciosOrden)}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Package className="w-4 h-4" /> Repuestos
                  </h4>
                  {detalleOrden.filter(i => i.tipo === 'repuesto').map((item) => (
                    <div key={item.id} className="flex justify-between text-sm bg-slate-50 p-2 rounded">
                      <div>
                        <div>{item.descripcion}</div>
                        <div className="text-xs text-slate-500">
                          Usados: {item.cantidad_usada || 0} | 
                          Dañados: {item.cantidad_dañada || 0} | 
                          Reservados: {item.cantidad}
                        </div>
                      </div>
                      <span className="font-medium">
                        {formatCurrency((item.cantidad_usada || 0) * item.precio_unitario)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-slate-200 pt-2 text-right font-semibold">
                    Total Repuestos: {formatCurrency(totalRepuestosOrden)}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t-2 border-green-200 text-right">
                  <div className="text-lg font-bold text-green-600">TOTAL: {formatCurrency(orden.costo_real)}</div>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <h3 className="font-semibold text-yellow-800">Análisis de Diferencias</h3>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-slate-600">Diferencia Servicios:</span>
                  <div className={`font-bold ${totalServiciosOrden - totalServiciosCotizacion > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(totalServiciosOrden - totalServiciosCotizacion)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-600">Diferencia Repuestos:</span>
                  <div className={`font-bold ${totalRepuestosOrden - totalRepuestosCotizacion > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(totalRepuestosOrden - totalRepuestosCotizacion)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-600">Diferencia Total:</span>
                  <div className={`font-bold ${(orden.costo_real - (cotizacion.total || 0)) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(orden.costo_real - (cotizacion.total || 0))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}