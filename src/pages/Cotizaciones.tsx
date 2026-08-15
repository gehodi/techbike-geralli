import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Edit, Trash2, Save, X, Search, Eye, CheckCircle, Wrench, Package, Camera, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import ModalDetalle from '../components/ModalDetalle'
import ControlesPaginacion from '../components/ControlesPaginacion'

interface Cotizacion {
  id: number
  solicitud_id: number
  cliente_nombre: string
  bicicleta_info: string
  bicicleta_foto?: string
  fecha_cotizacion: string
  fecha_entrega_estimada: string
  total: number
  estado: string
  notas: string
  fecha_registro: string
}

interface Solicitud {
  id: number
  cliente_nombre: string
  bicicleta_info: string
  fue_cotizada: boolean
  estado: string
}

interface Servicio {
  id: number
  nombre: string
  precio_cliente: number
}

interface ItemInventario {
  id: number
  nombre: string
  stock_actual: number
  stock_reservado: number
  precio_venta: number
}

interface DetalleItem {
  id: string
  tipo: 'servicio' | 'repuesto'
  servicio_id?: number
  item_inventario_id?: number
  nombre: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

export default function Cotizaciones() {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([])
  const [solicitudesDisponibles, setSolicitudesDisponibles] = useState<Solicitud[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [inventario, setInventario] = useState<ItemInventario[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [modalDetalle, setModalDetalle] = useState<Cotizacion | null>(null)
  const [paginaActual, setPaginaActual] = useState(1)
  const [registrosPorPagina, setRegistrosPorPagina] = useState(25)
  const [totalRegistros, setTotalRegistros] = useState(0)
  const [formData, setFormData] = useState({
    solicitud_id: '', fecha_cotizacion: '', fecha_entrega_estimada: '', notas: ''
  })
  const [detalleServicios, setDetalleServicios] = useState<DetalleItem[]>([])
  const [detalleRepuestos, setDetalleRepuestos] = useState<DetalleItem[]>([])
  const [nuevoServicio, setNuevoServicio] = useState({ servicio_id: '', cantidad: '1' })
  const [nuevoRepuesto, setNuevoRepuesto] = useState({ item_id: '', cantidad: '1' })

  useEffect(() => {
    fetchSolicitudesDisponibles()
    fetchServicios()
    fetchInventario()
  }, [])

  useEffect(() => {
    fetchCotizaciones()
  }, [paginaActual, registrosPorPagina, searchTerm])

  async function fetchCotizaciones() {
    try {
      setLoading(true)

      let countQuery = supabase.from('cotizaciones').select('*', { count: 'exact', head: true })
      if (searchTerm) {
        const term = `%${searchTerm}%`
        const esNumero = /^\d+$/.test(searchTerm.trim())
        const condiciones = [`notas.ilike.${term}`, `estado.ilike.${term}`]
        if (esNumero) condiciones.push(`id.eq.${searchTerm.trim()}`)
        countQuery = countQuery.or(condiciones.join(','))
      }
      const { count, error: countError } = await countQuery
      if (countError) throw countError
      setTotalRegistros(count || 0)

      const from = (paginaActual - 1) * registrosPorPagina
      const to = from + registrosPorPagina - 1

      let query = supabase
        .from('cotizaciones')
        .select(`*, solicitudes_servicio (
          cliente_id,
          bicicleta_id,
          clientes (nombres, apellidos),
          bicicletas (marca, modelo, foto_principal_url)
        )`)
        .order('fecha_cotizacion', { ascending: false })
        .range(from, to)

      if (searchTerm) {
        const term = `%${searchTerm}%`
        const esNumero = /^\d+$/.test(searchTerm.trim())
        const condiciones = [`notas.ilike.${term}`, `estado.ilike.${term}`]
        if (esNumero) condiciones.push(`id.eq.${searchTerm.trim()}`)
        query = query.or(condiciones.join(','))
      }

      const { data, error } = await query
      if (error) throw error

      const procesadas = data?.map((c: any) => ({
        ...c,
        cliente_nombre: c.solicitudes_servicio?.clientes
          ? `${c.solicitudes_servicio.clientes.nombres} ${c.solicitudes_servicio.clientes.apellidos}`
          : 'Sin cliente',
        bicicleta_info: c.solicitudes_servicio?.bicicletas
          ? `${c.solicitudes_servicio.bicicletas.marca} ${c.solicitudes_servicio.bicicletas.modelo}`
          : 'Sin bicicleta',
        bicicleta_foto: c.solicitudes_servicio?.bicicletas?.foto_principal_url || null
      })) || []

      setCotizaciones(procesadas)

      if (data && data.length === 0 && paginaActual > 1) {
        setPaginaActual(1)
      }
    } catch (error: any) {
      toast.error('Error al cargar: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchSolicitudesDisponibles() {
    try {
      const { data, error } = await supabase
        .from('solicitudes_servicio')
        .select(`id, estado, fue_cotizada, clientes(nombres, apellidos), bicicletas(marca, modelo)`)
        .eq('estado', 'Aprobada')
        .eq('fue_cotizada', false)
        .order('id', { ascending: false })
      if (error) throw error
      const procesadas = data?.map((s: any) => ({
        id: s.id,
        estado: s.estado,
        fue_cotizada: s.fue_cotizada,
        cliente_nombre: s.clientes
          ? `${s.clientes.nombres} ${s.clientes.apellidos}`
          : 'Sin cliente',
        bicicleta_info: s.bicicletas
          ? `${s.bicicletas.marca} ${s.bicicletas.modelo}`
          : 'Sin bicicleta'
      })) || []
      setSolicitudesDisponibles(procesadas)
    } catch (error: any) {
      console.error('Error cargando solicitudes:', error)
    }
  }

  async function fetchServicios() {
    const { data } = await supabase
      .from('servicios')
      .select('id, nombre, precio_cliente')
      .eq('activo', true)
      .order('nombre')
    setServicios(data || [])
  }

  async function fetchInventario() {
    const { data } = await supabase
      .from('inventario')
      .select('id, nombre, stock_actual, stock_reservado, precio_venta')
      .eq('estado', 'disponible')
      .order('nombre')
    setInventario(data || [])
  }

  async function fetchDetalleCotizacion(cotizacionId: number) {
    try {
      const { data, error } = await supabase
        .from('detalle_cotizaciones')
        .select('*')
        .eq('cotizacion_id', cotizacionId)
      if (error) throw error
      const servicios = (data || [])
        .filter((d: any) => d.tipo === 'servicio')
        .map((d: any) => ({
          id: d.id.toString(),
          tipo: 'servicio' as const,
          servicio_id: d.servicio_id,
          nombre: d.descripcion || 'Servicio',
          descripcion: d.descripcion || '',
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario,
          subtotal: d.subtotal
        }))
      const repuestos = (data || [])
        .filter((d: any) => d.tipo === 'repuesto')
        .map((d: any) => ({
          id: d.id.toString(),
          tipo: 'repuesto' as const,
          item_inventario_id: d.item_inventario_id,
          nombre: d.descripcion || 'Repuesto',
          descripcion: d.descripcion || '',
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario,
          subtotal: d.subtotal
        }))
      setDetalleServicios(servicios)
      setDetalleRepuestos(repuestos)
    } catch (error: any) {
      console.error('Error cargando detalle:', error)
    }
  }

  function agregarServicio() {
    if (!nuevoServicio.servicio_id) { toast.error('Seleccione un servicio'); return }
    const servicio = servicios.find(s => s.id === parseInt(nuevoServicio.servicio_id))
    if (!servicio) return
    const cantidad = parseInt(nuevoServicio.cantidad) || 1
    setDetalleServicios([...detalleServicios, {
      id: `s-${Date.now()}`, tipo: 'servicio', servicio_id: servicio.id, nombre: servicio.nombre,
      descripcion: servicio.nombre, cantidad, precio_unitario: servicio.precio_cliente, subtotal: cantidad * servicio.precio_cliente
    }])
    setNuevoServicio({ servicio_id: '', cantidad: '1' })
  }

  function agregarRepuesto() {
    if (!nuevoRepuesto.item_id) { toast.error('Seleccione un repuesto'); return }
    const itemInv = inventario.find(i => i.id === parseInt(nuevoRepuesto.item_id))
    if (!itemInv) return
    const cantidad = parseInt(nuevoRepuesto.cantidad) || 1
    const stockDisponible = itemInv.stock_actual - (itemInv.stock_reservado || 0)
    if (cantidad > stockDisponible) {
      toast.error(`Stock insuficiente. Disponible: ${stockDisponible} (Reservado: ${itemInv.stock_reservado || 0})`)
      return
    }
    setDetalleRepuestos([...detalleRepuestos, {
      id: `r-${Date.now()}`, tipo: 'repuesto', item_inventario_id: itemInv.id, nombre: itemInv.nombre,
      descripcion: itemInv.nombre, cantidad, precio_unitario: itemInv.precio_venta || 0, subtotal: cantidad * (itemInv.precio_venta || 0)
    }])
    setNuevoRepuesto({ item_id: '', cantidad: '1' })
  }

  const eliminarServicio = (id: string) => setDetalleServicios(detalleServicios.filter(i => i.id !== id))
  const eliminarRepuesto = (id: string) => setDetalleRepuestos(detalleRepuestos.filter(i => i.id !== id))
  const totalServicios = detalleServicios.reduce((sum, i) => sum + i.subtotal, 0)
  const totalRepuestos = detalleRepuestos.reduce((sum, i) => sum + i.subtotal, 0)
  const granTotal = totalServicios + totalRepuestos

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const data = {
        solicitud_id: formData.solicitud_id ? parseInt(formData.solicitud_id) : null,
        fecha_cotizacion: formData.fecha_cotizacion,
        fecha_entrega_estimada: formData.fecha_entrega_estimada || null,
        total: granTotal, estado: 'Pendiente', notas: formData.notas || null
      }
      let cotizacionId = editingId
      if (editingId) {
        const { error } = await supabase.from('cotizaciones').update(data).eq('id', editingId)
        if (error) throw error
        await supabase.from('detalle_cotizaciones').delete().eq('cotizacion_id', editingId)
      } else {
        const { data: nuevaCot, error } = await supabase.from('cotizaciones').insert([data]).select().single()
        if (error) throw error
        cotizacionId = nuevaCot.id
        toast.success(`Cotización #${cotizacionId} registrada`)
      }
      if (detalleServicios.length > 0 && cotizacionId) {
        await supabase.from('detalle_cotizaciones').insert(detalleServicios.map(s => ({
          cotizacion_id: cotizacionId, tipo: 'servicio', servicio_id: s.servicio_id,
          descripcion: s.nombre, cantidad: s.cantidad, precio_unitario: s.precio_unitario, subtotal: s.subtotal
        })))
      }
      if (detalleRepuestos.length > 0 && cotizacionId) {
        await supabase.from('detalle_cotizaciones').insert(detalleRepuestos.map(r => ({
          cotizacion_id: cotizacionId, tipo: 'repuesto', item_inventario_id: r.item_inventario_id,
          descripcion: r.nombre, cantidad: r.cantidad, precio_unitario: r.precio_unitario, subtotal: r.subtotal
        })))
      }
      if (!editingId) {
        resetForm(); fetchCotizaciones(); fetchSolicitudesDisponibles()
      } else {
        toast.success('Cotización actualizada'); setShowForm(false); fetchCotizaciones()
      }
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    }
  }

  async function handleAprobarCotizacion(cotizacion: Cotizacion) {
    if (cotizacion.estado === 'Aprobada') {
      toast.error('No se puede aprobar una cotización ya aprobada')
      return
    }
    if (!confirm(`¿Aprobar cotización #${cotizacion.id} y generar orden de servicio?`)) return
    try {
      const { error: errorUpdate } = await supabase.from('cotizaciones').update({ estado: 'Aprobada' }).eq('id', cotizacion.id)
      if (errorUpdate) throw errorUpdate
      if (cotizacion.solicitud_id) {
        const { error: errorSolicitud } = await supabase.from('solicitudes_servicio').update({ fue_cotizada: true }).eq('id', cotizacion.solicitud_id)
        if (errorSolicitud) throw errorSolicitud
      }
      const { data: solicitudData, error: errorSol } = await supabase
        .from('solicitudes_servicio').select('cliente_id, bicicleta_id, sintomas').eq('id', cotizacion.solicitud_id).single()
      if (errorSol || !solicitudData) throw new Error('Solicitud no encontrada')
      let nuevoNumeroOrden = 'ORD-001'
      let intento = 1
      while (intento <= 100) {
        const { data: ultimaOrden, error: errorConsulta } = await supabase
          .from('ordenes_servicio').select('numero_orden').order('id', { ascending: false }).limit(1)
        if (errorConsulta) throw errorConsulta
        if (ultimaOrden && ultimaOrden.length > 0 && ultimaOrden[0].numero_orden) {
          const match = ultimaOrden[0].numero_orden.match(/ORD-(\d+)/)
          nuevoNumeroOrden = match && match[1]
            ? `ORD-${String(parseInt(match[1], 10) + intento).padStart(3, '0')}`
            : `ORD-${String(intento).padStart(3, '0')}`
        } else {
          nuevoNumeroOrden = `ORD-${String(intento).padStart(3, '0')}`
        }
        const { data: existe, error: errorExiste } = await supabase
          .from('ordenes_servicio').select('id').eq('numero_orden', nuevoNumeroOrden).limit(1)
        if (errorExiste) throw errorExiste
        if (!existe || existe.length === 0) break
        intento++
      }
      const { data: nuevaOrden, error: errorOrden } = await supabase.from('ordenes_servicio').insert([{
        numero_orden: nuevoNumeroOrden, cliente_id: solicitudData.cliente_id, bicicleta_id: solicitudData.bicicleta_id,
        mecanico_id: null, estado: 'Pendiente', diagnostico: solicitudData.sintomas || '', trabajo_realizado: '',
        costo_estimado: cotizacion.total, costo_real: 0, fecha_ingreso: new Date().toISOString().split('T')[0],
        fecha_entrega_estimada: cotizacion.fecha_entrega_estimada, sintomas_cliente: solicitudData.sintomas,
        trabajos_cotizados: cotizacion.notas, cotizacion_id: cotizacion.id, notas: `Generada desde cotización #${cotizacion.id}`
      }]).select().single()
      if (errorOrden) throw errorOrden
      const ordenId = nuevaOrden.id
      const { data: detalleCotizacion, error: errorDetalle } = await supabase
        .from('detalle_cotizaciones').select('*').eq('cotizacion_id', cotizacion.id)
      if (errorDetalle) throw errorDetalle
      if (detalleCotizacion && detalleCotizacion.length > 0) {
        const { error: errorInsertDetalle } = await supabase.from('detalle_ordenes_servicio').insert(detalleCotizacion.map((d: any) => ({
          orden_id: ordenId, tipo: d.tipo, servicio_id: d.servicio_id, item_inventario_id: d.item_inventario_id,
          descripcion: d.descripcion, cantidad: d.cantidad, cantidad_usada: null, cantidad_dañada: 0,
          estado_item: 'reservado', precio_unitario: d.precio_unitario, subtotal: d.subtotal
        })))
        if (errorInsertDetalle) throw errorInsertDetalle
        const repuestos = detalleCotizacion.filter((d: any) => d.tipo === 'repuesto')
        for (const repuesto of repuestos) {
          const { data: itemActual, error: errorItem } = await supabase
            .from('inventario').select('stock_actual, stock_reservado').eq('id', repuesto.item_inventario_id).single()
          if (errorItem) throw errorItem
          const { error: errorUpdateStock } = await supabase.from('inventario')
            .update({ stock_reservado: (itemActual.stock_reservado || 0) + repuesto.cantidad })
            .eq('id', repuesto.item_inventario_id)
          if (errorUpdateStock) throw errorUpdateStock
          const { error: errorMovimiento } = await supabase.from('movimientos_inventario').insert({
            item_inventario_id: repuesto.item_inventario_id, tipo_movimiento: 'reserva_orden',
            cantidad: repuesto.cantidad, stock_anterior: itemActual.stock_actual, stock_nuevo: itemActual.stock_actual,
            motivo: `Reserva para orden ${nuevoNumeroOrden}`, referencia: `ORD-${ordenId}`, orden_id: ordenId,
            fecha_movimiento: new Date().toISOString(), usuario_responsable: 'sistema'
          })
          if (errorMovimiento) throw errorMovimiento
        }
      }
      toast.success(`✅ Cotización aprobada. Orden ${nuevoNumeroOrden} creada con detalle copiado`)
      fetchCotizaciones(); fetchSolicitudesDisponibles(); fetchInventario()
    } catch (error: any) {
      toast.error('Error al aprobar: ' + error.message)
    }
  }

  function handleEdit(c: Cotizacion) {
    if (c.estado === 'Aprobada') {
      toast.error('No se puede modificar una cotización ya aprobada')
      return
    }
    setFormData({
      solicitud_id: c.solicitud_id?.toString() || '', fecha_cotizacion: c.fecha_cotizacion,
      fecha_entrega_estimada: c.fecha_entrega_estimada || '', notas: c.notas || ''
    })
    setEditingId(c.id); setShowForm(true); fetchDetalleCotizacion(c.id)
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta cotización?')) return
    try {
      await supabase.from('detalle_cotizaciones').delete().eq('cotizacion_id', id)
      const { error } = await supabase.from('cotizaciones').delete().eq('id', id)
      if (error) throw error
      toast.success('Cotización eliminada')
      fetchCotizaciones(); fetchSolicitudesDisponibles()
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    }
  }

  function resetForm() {
    setFormData({ solicitud_id: '', fecha_cotizacion: new Date().toISOString().split('T')[0], fecha_entrega_estimada: '', notas: '' })
    setEditingId(null); setShowForm(false)
    setDetalleServicios([]); setDetalleRepuestos([])
    setNuevoServicio({ servicio_id: '', cantidad: '1' }); setNuevoRepuesto({ item_id: '', cantidad: '1' })
  }

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'Pendiente': return 'bg-yellow-100 text-yellow-800'
      case 'Aprobada': return 'bg-green-100 text-green-800'
      case 'Rechazada': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('es-CO') : '-'
  const formatCurrency = (v: number | null | undefined) => {
    if (v === null || v === undefined) return '$0'
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
  }

  function tablaDetalle(items: DetalleItem[], onEliminar: (id: string) => void, c: { bg: string; head: string; row: string; foot: string }, total: number) {
    return (
      <div className={`${c.bg} rounded-lg p-3`}>
        <table className="w-full text-sm">
          <thead><tr className={c.head}>
            <th className="text-left py-2 text-slate-700">Descripción</th>
            <th className="text-right py-2 text-slate-700">Cant.</th>
            <th className="text-right py-2 text-slate-700">P. Unit.</th>
            <th className="text-right py-2 text-slate-700">Subtotal</th>
            <th className="text-right py-2 text-slate-700"></th>
          </tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className={c.row}>
                <td className="py-2 text-slate-800">{item.nombre}</td>
                <td className="text-right py-2 text-slate-600">{item.cantidad}</td>
                <td className="text-right py-2 text-slate-600">{formatCurrency(item.precio_unitario)}</td>
                <td className="text-right py-2 font-medium text-slate-800">{formatCurrency(item.subtotal)}</td>
                <td className="text-right py-2">
                  <button type="button" onClick={() => onEliminar(item.id)} className="text-red-600 hover:text-red-800"><X className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className={`font-semibold text-slate-800 ${c.foot}`}>
            <td colSpan={3} className="text-right py-2">Total:</td>
            <td className="text-right py-2">{formatCurrency(total)}</td>
            <td></td>
          </tr></tfoot>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cotizaciones</h1>
          <p className="text-slate-500 mt-1">Gestión de cotizaciones de servicio</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(!showForm) }} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{showForm ? 'Cancelar' : 'Nueva Cotización'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">{editingId ? `Editar Cotización #${editingId}` : 'Nueva Cotización'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Solicitud *</label>
                <select value={formData.solicitud_id} onChange={(e) => setFormData({...formData, solicitud_id: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required disabled={!!editingId}>
                  <option value="">Seleccionar solicitud aprobada...</option>
                  {solicitudesDisponibles.map(s => (
                    <option key={s.id} value={s.id}>#{s.id} - {s.cliente_nombre} - {s.bicicleta_info}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">Solo se muestran solicitudes Aprobadas y no cotizadas</p>
              </div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Fecha Cotización *</label><input type="date" value={formData.fecha_cotizacion} onChange={(e) => setFormData({...formData, fecha_cotizacion: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Fecha Entrega Estimada</label><input type="date" value={formData.fecha_entrega_estimada} onChange={(e) => setFormData({...formData, fecha_entrega_estimada: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
              <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Notas / Observaciones</label><textarea value={formData.notas} onChange={(e) => setFormData({...formData, notas: e.target.value})} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
            </div>
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><Wrench className="w-4 h-4" /> Servicios Técnicos</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Servicio</label>
                  <select value={nuevoServicio.servicio_id} onChange={(e) => setNuevoServicio({...nuevoServicio, servicio_id: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                    <option value="">Seleccionar...</option>
                    {servicios.map(s => (<option key={s.id} value={s.id}>{s.nombre} - {formatCurrency(s.precio_cliente)}</option>))}
                  </select>
                </div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Cantidad</label><input type="number" min="1" value={nuevoServicio.cantidad} onChange={(e) => setNuevoServicio({...nuevoServicio, cantidad: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" /></div>
                <div className="flex items-end"><button type="button" onClick={agregarServicio} className="w-full px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 flex items-center justify-center gap-2 text-sm"><Plus className="w-4 h-4" /> Agregar</button></div>
              </div>
              {detalleServicios.length > 0 && tablaDetalle(detalleServicios, eliminarServicio, { bg: 'bg-blue-50', head: 'border-b border-blue-200', row: 'border-b border-blue-100 last:border-0', foot: 'border-t border-blue-300' }, totalServicios)}
            </div>
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><Package className="w-4 h-4" /> Repuestos y Materiales</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Repuesto/Material</label>
                  <select value={nuevoRepuesto.item_id} onChange={(e) => setNuevoRepuesto({...nuevoRepuesto, item_id: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                    <option value="">Seleccionar...</option>
                    {inventario.map(i => (<option key={i.id} value={i.id}>{i.nombre} (Disp: {i.stock_actual - (i.stock_reservado || 0)}) - {formatCurrency(i.precio_venta)}</option>))}
                  </select>
                </div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Cantidad</label><input type="number" min="1" value={nuevoRepuesto.cantidad} onChange={(e) => setNuevoRepuesto({...nuevoRepuesto, cantidad: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" /></div>
                <div className="flex items-end"><button type="button" onClick={agregarRepuesto} className="w-full px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 flex items-center justify-center gap-2 text-sm"><Plus className="w-4 h-4" /> Agregar</button></div>
              </div>
              {detalleRepuestos.length > 0 && tablaDetalle(detalleRepuestos, eliminarRepuesto, { bg: 'bg-green-50', head: 'border-b border-green-200', row: 'border-b border-green-100 last:border-0', foot: 'border-t border-green-300' }, totalRepuestos)}
            </div>
            <div className="border-t-2 border-slate-300 pt-4 bg-slate-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="text-right"><span className="text-slate-600">Total Servicios:</span><span className="ml-2 font-medium">{formatCurrency(totalServicios)}</span></div>
                <div className="text-right"><span className="text-slate-600">Total Repuestos:</span><span className="ml-2 font-medium">{formatCurrency(totalRepuestos)}</span></div>
                <div className="text-right border-l border-slate-300 pl-4"><span className="text-slate-800 font-semibold">GRAN TOTAL:</span><span className="ml-2 text-lg font-bold text-blue-600">{formatCurrency(granTotal)}</span></div>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={resetForm} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"><Save className="w-4 h-4" /> {editingId ? 'Actualizar' : 'Guardar Cotización'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Buscar por ID, notas o estado..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPaginaActual(1) }} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (<div className="p-8 text-center text-slate-500">Cargando...</div>) : cotizaciones.length === 0 ? (
          <div className="p-8 text-center text-slate-500">{searchTerm ? 'No se encontraron cotizaciones' : 'No hay cotizaciones registradas'}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div className="min-w-[1100px]">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">ID</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Foto</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Cliente</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Bicicleta</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Fecha</th>
                      <th className="text-right px-6 py-3 text-sm font-medium text-slate-700">Total</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Estado</th>
                      <th className="sticky right-0 bg-slate-50 border-l-2 border-slate-200 px-6 py-3 text-sm font-medium text-slate-700 z-10 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {cotizaciones.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50 cursor-pointer group" onClick={() => setModalDetalle(c)}>
                        <td className="px-6 py-4 text-sm font-mono text-slate-600">#{c.id}</td>
                        <td className="px-6 py-4">
                          {c.bicicleta_foto ? (
                            <img src={c.bicicleta_foto} alt="Foto bicicleta" className="h-12 w-12 object-cover rounded-lg border border-slate-200 cursor-pointer hover:scale-110 transition-transform" onClick={(e) => { e.stopPropagation(); window.open(c.bicicleta_foto, '_blank') }} />
                          ) : (
                            <div className="h-12 w-12 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center"><Camera className="w-5 h-5 text-slate-400" /></div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{c.cliente_nombre}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{c.bicicleta_info}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{formatDate(c.fecha_cotizacion)}</td>
                        <td className="px-6 py-4 text-sm text-right font-medium">{formatCurrency(c.total)}</td>
                        <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor(c.estado)}`}>{c.estado}</span></td>
                        <td className="sticky right-0 bg-white group-hover:bg-slate-50 border-l-2 border-slate-200 px-6 py-4 text-right z-10 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setModalDetalle(c)} className="p-2 text-slate-600 hover:bg-slate-100 rounded" title="Ver detalle"><Eye className="w-4 h-4" /></button>
                            {c.estado !== 'Aprobada' && (
                              <button onClick={() => handleAprobarCotizacion(c)} className="p-2 text-green-600 hover:bg-green-50 rounded" title="Aprobar y generar orden"><CheckCircle className="w-4 h-4" /></button>
                            )}
                            {c.estado !== 'Aprobada' ? (
                              <button onClick={() => handleEdit(c)} className="p-2 text-blue-600 hover:bg-blue-50 rounded" title="Editar"><Edit className="w-4 h-4" /></button>
                            ) : (
                              <span className="p-2 text-slate-400" title="Cotización aprobada - No editable"><Lock className="w-4 h-4" /></span>
                            )}
                            <button onClick={() => handleDelete(c.id)} className="p-2 text-red-600 hover:bg-red-50 rounded" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
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
              onRegistrosPorPaginaChange={(cantidad) => { setRegistrosPorPagina(cantidad); setPaginaActual(1) }}
            />
          </>
        )}
      </div>

      {modalDetalle && (
        <ModalDetalle
          titulo={`Cotización #${modalDetalle.id}`}
          campos={[
            { label: 'Foto Bicicleta', value: modalDetalle.bicicleta_foto, tipo: 'imagen' },
            { label: 'Cliente', value: modalDetalle.cliente_nombre },
            { label: 'Bicicleta', value: modalDetalle.bicicleta_info },
            { label: 'ID Solicitud', value: modalDetalle.solicitud_id ? `#${modalDetalle.solicitud_id}` : '-' },
            { label: 'Fecha Cotización', value: modalDetalle.fecha_cotizacion, tipo: 'fecha' },
            { label: 'Fecha Entrega Estimada', value: modalDetalle.fecha_entrega_estimada || '-', tipo: 'fecha' },
            { label: 'Total', value: modalDetalle.total, tipo: 'moneda' },
            { label: 'Estado', value: modalDetalle.estado, tipo: 'estado' },
            { label: 'Notas', value: modalDetalle.notas || '-', tipo: 'texto' },
          ]}
          onClose={() => setModalDetalle(null)}
        />
      )}
    </div>
  )
}