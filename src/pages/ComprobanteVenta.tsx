import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, FileDown, Printer, Bike, User, CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'
import { toPng } from 'html-to-image'

interface VentaDetalle {
  id: number
  numero_factura: string
  fecha_venta: string
  nombre_cliente: string
  documento_cliente: string
  telefono_cliente: string
  email_cliente: string
  monto_total: number
  observaciones: string
  bicicleta_codigo: string
  bicicleta_info: string
}

interface PagoDetalle {
  id: number
  metodo_pago: string
  monto: number
  referencia: string
  fecha_pago: string
}

export default function ComprobanteVenta() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const contenidoRef = useRef<HTMLDivElement>(null)
  
  const [venta, setVenta] = useState<VentaDetalle | null>(null)
  const [pagos, setPagos] = useState<PagoDetalle[]>([])
  const [loading, setLoading] = useState(true)
  const [generandoPDF, setGenerandoPDF] = useState(false)

  useEffect(() => {
    if (id) fetchVenta(parseInt(id))
  }, [id])

  async function fetchVenta(ventaId: number) {
    try {
      setLoading(true)
      
      // 1. Cargar datos de la venta
      const { data: ventaData, error: errorVenta } = await supabase
        .from('ventas')
        .select(`*, bicicletas_adquiridas(codigo_inventario, marca, modelo)`)
        .eq('id', ventaId)
        .single()

      if (errorVenta) throw errorVenta

      const ventaFormateada: VentaDetalle = {
        ...ventaData,
        bicicleta_codigo: ventaData.bicicletas_adquiridas?.codigo_inventario || '-',
        bicicleta_info: `${ventaData.bicicletas_adquiridas?.marca || ''} ${ventaData.bicicletas_adquiridas?.modelo || ''}`.trim() || 'Bicicleta Usada'
      }
      setVenta(ventaFormateada)

      // 2. Cargar métodos de pago
      const { data: pagosData, error: errorPagos } = await supabase
        .from('pagos_ventas')
        .select('*')
        .eq('venta_id', ventaId)
        .order('fecha_pago', { ascending: true })

      if (errorPagos) throw errorPagos
      setPagos(pagosData || [])

    } catch (error: any) {
      toast.error('Error al cargar el comprobante: ' + error.message)
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
        backgroundColor: '#ffffff',
        cacheBust: true
      })
      
      const { default: jsPDF } = await import('jspdf')
      const imgWidth = 210
      const pdf = new jsPDF('p', 'mm', 'a4')
      const img = new Image()
      img.src = dataUrl
      
      await new Promise((resolve) => {
        img.onload = () => {
          const ratio = Math.min((imgWidth - 20) / img.width, 277 / img.height)
          const finalWidth = img.width * ratio
          const finalHeight = img.height * ratio
          const x = (imgWidth - finalWidth) / 2
          pdf.addImage(dataUrl, 'PNG', x, 10, finalWidth, finalHeight)
          pdf.save(`Factura_${venta?.numero_factura}.pdf`)
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

  const formatCurrency = (v: number | null | undefined) => {
    if (v === null || v === undefined) return '$0.00'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v)
  }

  const formatDate = (d: string) => {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const getMetodoPagoLabel = (metodo: string) => {
    const labels: Record<string, string> = {
      'efectivo': 'Efectivo',
      'transferencia': 'Transferencia Bancaria',
      'tarjeta_credito': 'Tarjeta de Crédito',
      'tarjeta_debito': 'Tarjeta de Débito',
      'nequi': 'Nequi',
      'daviplata': 'Daviplata',
      'otro': 'Otro'
    }
    return labels[metodo] || metodo
  }

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando comprobante...</div>
  if (!venta) return <div className="p-8 text-center text-red-600">Venta no encontrada</div>

  return (
    <div className="space-y-6 p-4 lg:p-8">
      {/* Controles superiores */}
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-600 hover:text-slate-800">
          <ArrowLeft className="w-4 h-4" /> Volver a Ventas
        </button>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="bg-slate-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-700">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          <button
            onClick={handleGenerarPDF}
            disabled={generandoPDF}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
          >
            {generandoPDF ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generando...</>
            ) : (
              <><FileDown className="w-4 h-4" /> Descargar PDF</>
            )}
          </button>
        </div>
      </div>

      {/* Área imprimible / Capturable para PDF */}
      <div ref={contenidoRef} className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 max-w-4xl mx-auto">
        
        {/* Encabezado */}
        <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Taller Bike</h1>
            <p className="text-slate-600 mt-1">Comprobante de Venta</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-500">Factura N°</div>
            <div className="text-2xl font-bold text-blue-600 font-mono">{venta.numero_factura}</div>
            <div className="text-sm text-slate-500 mt-2">Fecha de Emisión</div>
            <div className="text-sm font-medium text-slate-800">{formatDate(venta.fecha_venta)}</div>
          </div>
        </div>

        {/* Información del Cliente y Bicicleta */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="bg-slate-50 p-4 rounded-lg">
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <User className="w-4 h-4" /> Datos del Cliente
            </h3>
            <div className="space-y-2 text-sm">
              <div><span className="text-slate-500">Nombre:</span> <span className="font-medium text-slate-900">{venta.nombre_cliente}</span></div>
              {venta.documento_cliente && <div><span className="text-slate-500">Documento:</span> <span className="font-medium text-slate-900">{venta.documento_cliente}</span></div>}
              {venta.telefono_cliente && <div><span className="text-slate-500">Teléfono:</span> <span className="font-medium text-slate-900">{venta.telefono_cliente}</span></div>}
              {venta.email_cliente && <div><span className="text-slate-500">Email:</span> <span className="font-medium text-slate-900">{venta.email_cliente}</span></div>}
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg">
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Bike className="w-4 h-4" /> Detalle del Producto
            </h3>
            <div className="space-y-2 text-sm">
              <div><span className="text-slate-500">Código:</span> <span className="font-mono font-medium text-slate-900">{venta.bicicleta_codigo}</span></div>
              <div><span className="text-slate-500">Descripción:</span> <span className="font-medium text-slate-900">{venta.bicicleta_info}</span></div>
              <div className="mt-3 pt-3 border-t border-slate-200">
                <span className="text-slate-500 block mb-1">Observaciones:</span>
                <span className="text-slate-700 italic">{venta.observaciones || 'Sin observaciones'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Desglose de Pagos */}
        <div className="mb-8">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Detalle de Pagos Realizados
          </h3>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Método de Pago</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Referencia</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-700">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagos.map((pago) => (
                  <tr key={pago.id}>
                    <td className="px-4 py-3 text-sm text-slate-800">{getMetodoPagoLabel(pago.metodo_pago)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 font-mono">{pago.referencia || '-'}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-slate-900">{formatCurrency(pago.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Total */}
        <div className="flex justify-end mb-8">
          <div className="w-full md:w-1/2 lg:w-1/3">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 flex justify-between items-center">
              <span className="text-lg font-bold text-slate-800">TOTAL PAGADO</span>
              <span className="text-2xl font-bold text-blue-700">{formatCurrency(venta.monto_total)}</span>
            </div>
          </div>
        </div>

        {/* Pie de página */}
        <div className="text-center pt-6 border-t border-slate-200">
          <p className="text-slate-600 font-medium">¡Gracias por su compra!</p>
          <p className="text-xs text-slate-400 mt-2">Este documento es un comprobante de pago válido.</p>
        </div>
      </div>
    </div>
  )
}