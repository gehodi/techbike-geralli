import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, FileDown, Printer, Shield, Bike } from 'lucide-react'
import toast from 'react-hot-toast'
import { toPng } from 'html-to-image'

interface CertificadoData {
  numero_factura: string
  fecha_venta: string
  cliente_nombre: string
  cliente_documento: string
  bicicleta_codigo: string
  bicicleta_marca: string
  bicicleta_modelo: string
  bicicleta_color: string
  bicicleta_ano: number
  bicicleta_serie: string
  bicicleta_tipo: string
  garantia_inicio: string
  garantia_fin: string
  garantia_duracion: number
}

export default function CertificadoReacondicionamiento() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const contenidoRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<CertificadoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [generandoPDF, setGenerandoPDF] = useState(false)

  useEffect(() => {
    if (id) fetchCertificado(id)
  }, [id])

  async function fetchCertificado(ventaId: string) {
    try {
      setLoading(true)
      const { data: ventaData, error: errorVenta } = await supabase
        .from('ventas')
        .select(`
          numero_factura,
          fecha_venta,
          nombre_cliente,
          documento_cliente,
          bicicletas_adquiridas(
            codigo_inventario,
            marca,
            modelo,
            color,
            ano_fabricacion,
            numero_serie,
            tipos_de_bicicletas(nombre)
          )
        `)
        .eq('id', ventaId)
        .single()
      if (errorVenta) throw errorVenta

      const { data: garantiaData, error: errorGarantia } = await supabase
        .from('garantias')
        .select('fecha_inicio, fecha_fin, duracion_meses')
        .eq('venta_id', ventaId)
        .single()
      if (errorGarantia) throw errorGarantia

      // ✅ CORRECCIÓN: bicicletas_adquiridas es un array, acceder con [0]
      const bici = ventaData.bicicletas_adquiridas?.[0]
      const tipoBici = bici?.tipos_de_bicicletas?.[0]

      const certificado: CertificadoData = {
        numero_factura: ventaData.numero_factura,
        fecha_venta: ventaData.fecha_venta,
        cliente_nombre: ventaData.nombre_cliente,
        cliente_documento: ventaData.documento_cliente || '',
        bicicleta_codigo: bici?.codigo_inventario || '',
        bicicleta_marca: bici?.marca || '',
        bicicleta_modelo: bici?.modelo || '',
        bicicleta_color: bici?.color || '',
        bicicleta_ano: bici?.ano_fabricacion || 0,
        bicicleta_serie: bici?.numero_serie || '',
        bicicleta_tipo: tipoBici?.nombre || '',
        garantia_inicio: garantiaData.fecha_inicio,
        garantia_fin: garantiaData.fecha_fin,
        garantia_duracion: garantiaData.duracion_meses
      }
      setData(certificado)
    } catch (error: any) {
      toast.error('Error al cargar certificado: ' + error.message)
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
          pdf.save(`Certificado_${data?.bicicleta_codigo}.pdf`)
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

  const formatDate = (d: string) => {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando certificado...</div>
  if (!data) return <div className="p-8 text-center text-red-600">Certificado no encontrado</div>

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-600 hover:text-slate-800">
          <ArrowLeft className="w-4 h-4" /> Volver
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

      <div ref={contenidoRef} className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 max-w-4xl mx-auto">
        <div className="text-center border-b-2 border-slate-800 pb-6 mb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Taller Bike</h1>
          <div className="flex items-center justify-center gap-2 text-slate-600">
            <Shield className="w-5 h-5" />
            <h2 className="text-xl font-semibold">Certificado de Reacondicionamiento y Garantía</h2>
          </div>
          <p className="text-sm text-slate-500 mt-2">Factura N°: {data.numero_factura}</p>
        </div>

        <div className="mb-6">
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2 border-b border-slate-200 pb-2">
            <Bike className="w-4 h-4" /> Datos de la Bicicleta
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500 block">Código de Inventario:</span>
              <span className="font-mono font-medium text-slate-900">{data.bicicleta_codigo}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Tipo:</span>
              <span className="font-medium text-slate-900">{data.bicicleta_tipo || '-'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Marca:</span>
              <span className="font-medium text-slate-900">{data.bicicleta_marca || '-'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Modelo:</span>
              <span className="font-medium text-slate-900">{data.bicicleta_modelo || '-'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Color:</span>
              <span className="font-medium text-slate-900">{data.bicicleta_color || '-'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Año de Fabricación:</span>
              <span className="font-medium text-slate-900">{data.bicicleta_ano || '-'}</span>
            </div>
            {data.bicicleta_serie && (
              <div className="col-span-2">
                <span className="text-slate-500 block">Número de Serie:</span>
                <span className="font-mono font-medium text-slate-900">{data.bicicleta_serie}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mb-6">
          <h3 className="font-semibold text-slate-800 mb-3 border-b border-slate-200 pb-2">Datos del Cliente</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500 block">Nombre:</span>
              <span className="font-medium text-slate-900">{data.cliente_nombre}</span>
            </div>
            {data.cliente_documento && (
              <div>
                <span className="text-slate-500 block">Documento:</span>
                <span className="font-medium text-slate-900">{data.cliente_documento}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-3">Términos de Garantía</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Fecha de Inicio:</span>
              <span className="font-medium text-slate-900">{formatDate(data.garantia_inicio)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Fecha de Vencimiento:</span>
              <span className="font-medium text-slate-900">{formatDate(data.garantia_fin)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Duración:</span>
              <span className="font-medium text-slate-900">{data.garantia_duracion} meses</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-700 mb-2"><strong>Cobertura:</strong> Garantía limitada contra defectos de funcionamiento en componentes mecánicos y estructurales de la bicicleta. La garantía cubre exclusivamente la mano de obra de reparación.</p>
            <p className="text-xs text-slate-700"><strong>Exclusiones:</strong> No cubre: desgaste normal por uso, daños por accidentes, mal uso, robo, ni componentes consumibles (frenos, cadenas, llantas).</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mt-12 pt-8 border-t border-slate-200">
          <div className="text-center">
            <div className="border-b border-slate-400 mb-2 h-16"></div>
            <p className="text-xs text-slate-600">Firma del Vendedor</p>
            <p className="text-xs text-slate-500 mt-1">Taller Bike</p>
          </div>
          <div className="text-center">
            <div className="border-b border-slate-400 mb-2 h-16"></div>
            <p className="text-xs text-slate-600">Firma del Cliente</p>
            <p className="text-xs text-slate-500 mt-1">{data.cliente_nombre}</p>
          </div>
        </div>

        <div className="text-center mt-8 pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-500">Este certificado acredita que la bicicleta ha sido reacondicionada profesionalmente y cuenta con garantía limitada.</p>
          <p className="text-xs text-slate-400 mt-1">Fecha de emisión: {formatDate(data.fecha_venta)}</p>
        </div>
      </div>
    </div>
  )
}