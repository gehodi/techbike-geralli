import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Search, Eye, AlertTriangle, CheckCircle, XCircle, Shield, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import ModalDetalle from '../components/ModalDetalle'
import ControlesPaginacion from '../components/ControlesPaginacion'

interface Garantia {
  id: string
  venta_id: string
  bicicleta_codigo: string
  bicicleta_info: string
  cliente_nombre: string
  cliente_telefono: string
  fecha_inicio: string
  fecha_fin: string
  duracion_meses: number
  estado: string
  dias_restantes: number
}

export default function Garantias() {
  const [garantias, setGarantias] = useState<Garantia[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<string>('todas')
  const [modalDetalle, setModalDetalle] = useState<Garantia | null>(null)
  const [paginaActual, setPaginaActual] = useState(1)
  const [registrosPorPagina, setRegistrosPorPagina] = useState(25)
  const [totalRegistros, setTotalRegistros] = useState(0)

  useEffect(() => {
    fetchGarantias()
  }, [paginaActual, registrosPorPagina, searchTerm, filtroEstado])

  async function fetchGarantias() {
    try {
      setLoading(true)
      let query = supabase
        .from('garantias')
        .select(`
          *,
          bicicletas_adquiridas(codigo_inventario, marca, modelo)
        `, { count: 'exact' })
        .order('fecha_fin', { ascending: true })

      if (searchTerm) {
        const term = `%${searchTerm}%`
        query = query.or(`cliente_nombre.ilike.${term},bicicletas_adquiridas.codigo_inventario.ilike.${term}`)
      }

      const { data, error, count } = await query
      if (error) throw error
      setTotalRegistros(count || 0)

      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const procesadas: Garantia[] = (data || []).map((g: any) => {
        const fechaFin = new Date(g.fecha_fin)
        const diffTime = fechaFin.getTime() - hoy.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return {
          ...g,
          bicicleta_codigo: g.bicicletas_adquiridas?.codigo_inventario || '-',
          bicicleta_info: `${g.bicicletas_adquiridas?.marca || ''} ${g.bicicletas_adquiridas?.modelo || ''}`.trim() || 'Bicicleta',
          dias_restantes: diffDays
        }
      })

      let filtradas = procesadas
      if (filtroEstado === 'vigentes') {
        filtradas = procesadas.filter(g => g.estado === 'vigente' && g.dias_restantes > 15)
      } else if (filtroEstado === 'por_vencer') {
        filtradas = procesadas.filter(g => g.estado === 'vigente' && g.dias_restantes >= 0 && g.dias_restantes <= 15)
      } else if (filtroEstado === 'vencidas') {
        filtradas = procesadas.filter(g => g.estado === 'vencida' || (g.estado === 'vigente' && g.dias_restantes < 0))
      } else if (filtroEstado === 'reclamadas') {
        filtradas = procesadas.filter(g => g.estado === 'reclamada')
      }

      const desde = (paginaActual - 1) * registrosPorPagina
      const hasta = desde + registrosPorPagina
      setGarantias(filtradas.slice(desde, hasta))
      if (filtroEstado !== 'todas') {
        setTotalRegistros(filtradas.length)
      }
    } catch (error: any) {
      console.error('Error cargando garantías:', error)
      toast.error('Error al cargar garantías: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const getEstadoColor = (estado: string, dias: number) => {
    if (estado === 'reclamada') return 'bg-purple-100 text-purple-800'
    if (estado === 'cancelada') return 'bg-gray-100 text-gray-800'
    if (dias < 0) return 'bg-red-100 text-red-800'
    if (dias <= 15) return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-100 text-green-800'
  }

  const getEstadoTexto = (estado: string, dias: number) => {
    if (estado === 'reclamada') return 'RECLAMADA'
    if (estado === 'cancelada') return 'CANCELADA'
    if (dias < 0) return 'VENCIDA'
    if (dias <= 15) return `POR VENCER (${dias}d)`
    return 'VIGENTE'
  }

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('es-CO') : '-'

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestión de Garantías</h1>
          <p className="text-slate-500 mt-1">Control de vigencias y reclamaciones</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: 'todas', label: 'Todas', icon: Shield },
          { id: 'vigentes', label: 'Vigentes', icon: CheckCircle },
          { id: 'por_vencer', label: 'Por Vencer (15d)', icon: Clock },
          { id: 'vencidas', label: 'Vencidas', icon: XCircle },
          { id: 'reclamadas', label: 'Reclamadas', icon: AlertTriangle },
        ].map((filtro) => {
          const Icon = filtro.icon
          return (
            <button
              key={filtro.id}
              onClick={() => { setFiltroEstado(filtro.id); setPaginaActual(1) }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                filtroEstado === filtro.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {filtro.label}
            </button>
          )
        })}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por cliente o código de bicicleta..."
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setPaginaActual(1) }}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">
            <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
            <p>Cargando garantías...</p>
          </div>
        ) : garantias.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {searchTerm ? 'No se encontraron garantías con ese criterio' : 'No hay garantías en esta categoría'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Bicicleta</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Cliente</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Inicio</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Vencimiento</th>
                    <th className="text-center px-6 py-3 text-sm font-medium text-slate-700">Estado</th>
                    <th className="sticky right-0 bg-slate-50 border-l-2 border-slate-200 px-6 py-3 text-sm font-medium text-slate-700 z-10">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {garantias.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-mono font-medium text-slate-900">{g.bicicleta_codigo}</div>
                        <div className="text-xs text-slate-500">{g.bicicleta_info}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-800">
                        <div>{g.cliente_nombre}</div>
                        <div className="text-xs text-slate-500">{g.cliente_telefono || '-'}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{formatDate(g.fecha_inicio)}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 font-medium">{formatDate(g.fecha_fin)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor(g.estado, g.dias_restantes)}`}>
                          {getEstadoTexto(g.estado, g.dias_restantes)}
                        </span>
                      </td>
                      <td className="sticky right-0 bg-white border-l-2 border-slate-200 px-6 py-4 text-right z-10">
                        <button
                          onClick={() => setModalDetalle(g)}
                          className="p-2 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ControlesPaginacion
        paginaActual={paginaActual}
        totalRegistros={totalRegistros}
        registrosPorPagina={registrosPorPagina}
        onPageChange={setPaginaActual}
        onRegistrosPorPaginaChange={(c) => { setRegistrosPorPagina(c); setPaginaActual(1) }}
      />

      {modalDetalle && (
        <ModalDetalle
          titulo={`Garantía - ${modalDetalle.bicicleta_codigo}`}
          campos={[
            { label: 'Bicicleta', value: `${modalDetalle.bicicleta_codigo} - ${modalDetalle.bicicleta_info}` },
            { label: 'Cliente', value: modalDetalle.cliente_nombre },
            { label: 'Teléfono', value: modalDetalle.cliente_telefono || '-' },
            { label: 'Fecha Inicio', value: modalDetalle.fecha_inicio, tipo: 'fecha' },
            { label: 'Fecha Fin', value: modalDetalle.fecha_fin, tipo: 'fecha' },
            { label: 'Duración', value: `${modalDetalle.duracion_meses} meses` },
            { label: 'Estado', value: getEstadoTexto(modalDetalle.estado, modalDetalle.dias_restantes), tipo: 'estado' },
          ]}
          onClose={() => setModalDetalle(null)}
        />
      )}
    </div>
  )
}