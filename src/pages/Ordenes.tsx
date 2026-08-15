import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Edit, X, Search, Eye, Package, Ban, Save, Plus, Wrench, CheckCircle, AlertTriangle, Lock, Camera } from 'lucide-react'
import toast from 'react-hot-toast'
import ModalDetalle from '../components/ModalDetalle'
import SelectorBicicletaCliente from '../components/SelectorBicicletaCliente'
import ControlesPaginacion from '../components/ControlesPaginacion'

interface OrdenServicio {
  id: number
  numero_orden: string
  cliente_id: string
  cliente_nombre: string
  bicicleta_id: string
  bicicleta_info: string
  bicicleta_foto?: string
  mecanico_id: number
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
  fecha_registro: string
}

interface Servicio { id: number; nombre: string; precio_cliente: number }
interface ItemInventario { id: number; nombre: string; stock_actual: number; stock_reservado: number; precio_venta: number }
interface DetalleItem {
  id: string | number
  tipo: 'servicio' | 'repuesto'
  servicio_id?: number
  item_inventario_id?: number
  nombre: string
  descripcion: string
  cantidad: number
  cantidad_usada?: number
  cantidad_dañada?: number
  precio_unitario: number
  subtotal: number
  estado_item?: string
  esNuevo?: boolean
}
interface Cliente { id: string; nombres: string; apellidos: string }
interface Mecanico { id: number; nombres: string; apellidos: string }
interface OrdenIndex { id: number; numero_orden: string; cliente_nombre: string; bicicleta_info: string }

export default function Ordenes() {
  const navigate = useNavigate()
  const formRef = useRef<HTMLDivElement>(null)
  const [ordenes, setOrdenes] = useState<OrdenServicio[]>([])
  const [ordenesIndex, setOrdenesIndex] = useState<OrdenIndex[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [mecanicos, setMecanicos] = useState<Mecanico[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [inventario, setInventario] = useState<ItemInventario[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [modalDetalle, setModalDetalle] = useState<OrdenServicio | null>(null)
  const [detalleServicios, setDetalleServicios] = useState<DetalleItem[]>([])
  const [detalleRepuestos, setDetalleRepuestos] = useState<DetalleItem[]>([])
  const [nuevoServicio, setNuevoServicio] = useState({ servicio_id: '', cantidad: '1' })
  const [nuevoRepuesto, setNuevoRepuesto] = useState({ item_id: '', cantidad: '1' })
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [completionOrdenId, setCompletionOrdenId] = useState<number | null>(null)
  const [completionData, setCompletionData] = useState<Record<string, { usada: number, dañada: number }>>({})
  const [completandoOrden, setCompletandoOrden] = useState(false)
  const [paginaActual, setPaginaActual] = useState(1)
  const [registrosPorPagina, setRegistrosPorPagina] = useState(25)
  const [totalRegistros, setTotalRegistros] = useState(0)
  const [formData, setFormData] = useState({
    numero_orden: '', cliente_id: '', bicicleta_id: '', mecanico_id: '',
    estado: 'Pendiente', diagnostico: '', trabajo_realizado: '',
    costo_estimado: '', costo_real: '', fecha_ingreso: '',
    fecha_entrega_estimada: '', fecha_entrega_real: '', notas: '',
    sintomas_cliente: '', trabajos_cotizados: '', cotizacion_id: ''
  })

  useEffect(() => {
    fetchClientes(); fetchMecanicos(); fetchServicios(); fetchInventario(); fetchOrdenesIndex()
  }, [])

  useEffect(() => {
    fetchOrdenes()
  }, [paginaActual, registrosPorPagina, searchTerm, ordenesIndex])

  async function fetchOrdenesIndex() {
    try {
      const { data, error } = await supabase
        .from('ordenes_servicio')
        .select('id, numero_orden, clientes(nombres, apellidos), bicicletas(marca, modelo)')
      if (error) throw error
      const index = (data || []).map((o: any) => ({
        id: o.id,
        numero_orden: o.numero_orden,
        cliente_nombre: o.clientes ? `${o.clientes.nombres} ${o.clientes.apellidos}` : 'Sin cliente',
        bicicleta_info: o.bicicletas ? `${o.bicicletas.marca} ${o.bicicletas.modelo}` : 'Sin bicicleta'
      }))
      setOrdenesIndex(index)
    } catch (error: any) {
      console.error('Error cargando índice de órdenes:', error)
    }
  }

  async function fetchOrdenes() {
    try {
      setLoading(true)
      let orString = ''
      if (searchTerm) {
        const term = `%${searchTerm}%`
        const partes = [`numero_orden.ilike.${term}`, `estado.ilike.${term}`]
        if (/^\d+$/.test(searchTerm.trim())) partes.push(`id.eq.${searchTerm.trim()}`)
        const idsCoincidentes = ordenesIndex
          .filter(o =>
            o.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            o.bicicleta_info.toLowerCase().includes(searchTerm.toLowerCase())
          )
          .map(o => o.id)
        if (idsCoincidentes.length > 0) partes.push(`id.in.(${idsCoincidentes.join(',')})`)
        orString = partes.join(',')
      }

      let countQuery = supabase.from('ordenes_servicio').select('*', { count: 'exact', head: true })
      if (orString) countQuery = countQuery.or(orString)
      const { count, error: countError } = await countQuery
      if (countError) throw countError
      setTotalRegistros(count || 0)

      const from = (paginaActual - 1) * registrosPorPagina
      const to = from + registrosPorPagina - 1

      let query = supabase
        .from('ordenes_servicio')
        .select(`*, clientes(nombres, apellidos), bicicletas(marca, modelo, numero_serie, cliente_id, foto_principal_url), mecanicos(nombres, apellidos)`)
        .order('fecha_ingreso', { ascending: false })
        .range(from, to)
      if (orString) query = query.or(orString)

      const { data, error } = await query
      if (error) throw error
      const procesadas = data?.map((o: any) => ({
        ...o,
        cliente_nombre: o.clientes ? `${o.clientes.nombres} ${o.clientes.apellidos}` : 'Sin cliente',
        bicicleta_info: o.bicicletas ? `${o.bicicletas.marca} ${o.bicicletas.modelo}` : 'Sin bicicleta',
        bicicleta_foto: o.bicicletas?.foto_principal_url || null,
        mecanico_nombre: o.mecanicos ? `${o.mecanicos.nombres} ${o.mecanicos.apellidos}` : 'Sin asignar'
      })) || []
      setOrdenes(procesadas)
      if (data && data.length === 0 && paginaActual > 1) setPaginaActual(1)
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

  async function fetchMecanicos() {
    const { data } = await supabase.from('mecanicos').select('id, nombres, apellidos').order('apellidos')
    setMecanicos(data || [])
  }

  async function fetchServicios() {
    const { data } = await supabase.from('servicios').select('id, nombre, precio_cliente').eq('activo', true).order('nombre')
    setServicios(data || [])
  }

  async function fetchInventario() {
    const { data } = await supabase.from('inventario').select('id, nombre, stock_actual, stock_reservado, precio_venta').eq('estado', 'disponible').order('nombre')
    setInventario(data || [])
  }

  async function fetchDetalleOrden(ordenId: number) {
    try {
      const { data, error } = await supabase.from('detalle_ordenes_servicio').select('*').eq('orden_id', ordenId)
      if (error) throw error
      setDetalleServicios((data || []).filter((d: any) => d.tipo === 'servicio').map((d: any) => ({
        id: d.id, tipo: 'servicio' as const, servicio_id: d.servicio_id,
        nombre: d.descripcion || 'Servicio', descripcion: d.descripcion || '',
        cantidad: d.cantidad, cantidad_usada: d.cantidad_usada, cantidad_dañada: d.cantidad_dañada,
        precio_unitario: d.precio_unitario, subtotal: d.subtotal, estado_item: d.estado_item, esNuevo: false
      })))
      setDetalleRepuestos((data || []).filter((d: any) => d.tipo === 'repuesto').map((d: any) => ({
        id: d.id, tipo: 'repuesto' as const, item_inventario_id: d.item_inventario_id,
        nombre: d.descripcion || 'Repuesto', descripcion: d.descripcion || '',
        cantidad: d.cantidad, cantidad_usada: d.cantidad_usada, cantidad_dañada: d.cantidad_dañada,
        precio_unitario: d.precio_unitario, subtotal: d.subtotal, estado_item: d.estado_item, esNuevo: false
      })))
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
      descripcion: servicio.nombre, cantidad, precio_unitario: servicio.precio_cliente, subtotal: cantidad * servicio.precio_cliente, esNuevo: true
    }])
    setNuevoServicio({ servicio_id: '', cantidad: '1' })
  }

  function agregarRepuesto() {
    if (!nuevoRepuesto.item_id) { toast.error('Seleccione un repuesto'); return }
    const itemInv = inventario.find(i => i.id === parseInt(nuevoRepuesto.item_id))
    if (!itemInv) return
    const cantidad = parseInt(nuevoRepuesto.cantidad) || 1
    const stockDisponible = itemInv.stock_actual - (itemInv.stock_reservado || 0)
    if (cantidad > stockDisponible) { toast.error(`Stock insuficiente. Disponible: ${stockDisponible}`); return }
    setDetalleRepuestos([...detalleRepuestos, {
      id: `r-${Date.now()}`, tipo: 'repuesto', item_inventario_id: itemInv.id, nombre: itemInv.nombre,
      descripcion: itemInv.nombre, cantidad, precio_unitario: itemInv.precio_venta || 0, subtotal: cantidad * (itemInv.precio_venta || 0), esNuevo: true
    }])
    setNuevoRepuesto({ item_id: '', cantidad: '1' })
  }

  function eliminarServicio(id: string | number) { setDetalleServicios(detalleServicios.filter(i => i.id !== id)) }
  function eliminarRepuesto(id: string | number) { setDetalleRepuestos(detalleRepuestos.filter(i => i.id !== id)) }
  const totalServicios = detalleServicios.reduce((sum, i) => sum + i.subtotal, 0)
  const totalRepuestos = detalleRepuestos.reduce((sum, i) => sum + i.subtotal, 0)
  const granTotal = totalServicios + totalRepuestos

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const data = {
        cliente_id: formData.cliente_id || null, bicicleta_id: formData.bicicleta_id || null,
        mecanico_id: formData.mecanico_id ? parseInt(formData.mecanico_id) : null, estado: formData.estado,
        diagnostico: formData.diagnostico || null, trabajo_realizado: formData.trabajo_realizado || null,
        costo_estimado: granTotal > 0 ? granTotal : (formData.costo_estimado ? parseFloat(formData.costo_estimado) : null),
        costo_real: formData.costo_real ? parseFloat(formData.costo_real) : null,
        fecha_ingreso: formData.fecha_ingreso, fecha_entrega_estimada: formData.fecha_entrega_estimada || null,
        fecha_entrega_real: formData.fecha_entrega_real || null, notas: formData.notas || null,
        sintomas_cliente: formData.sintomas_cliente || null, trabajos_cotizados: formData.trabajos_cotizados || null,
        cotizacion_id: formData.cotizacion_id ? parseInt(formData.cotizacion_id) : null
      }

      let ordenId = editingId
      if (editingId) {
        const { error } = await supabase.from('ordenes_servicio').update(data).eq('id', editingId)
        if (error) throw error
        const { data: detallesActuales } = await supabase.from('detalle_ordenes_servicio').select('*').eq('orden_id', editingId)
        for (const rep of (detallesActuales || []).filter((d: any) => d.tipo === 'repuesto')) {
          const { data: itemActual } = await supabase.from('inventario').select('stock_reservado').eq('id', rep.item_inventario_id).single()
          if (itemActual) {
            await supabase.from('inventario').update({ stock_reservado: Math.max(0, (itemActual.stock_reservado || 0) - rep.cantidad) }).eq('id', rep.item_inventario_id)
            await supabase.from('movimientos_inventario').insert({
              item_inventario_id: rep.item_inventario_id, tipo_movimiento: 'liberacion_reserva', cantidad: -rep.cantidad,
              stock_anterior: 0, stock_nuevo: 0, motivo: `Edición orden ${formData.numero_orden}`,
              orden_id: editingId, fecha_movimiento: new Date().toISOString(), usuario_responsable: 'sistema'
            })
          }
        }
        await supabase.from('detalle_ordenes_servicio').delete().eq('orden_id', editingId)
      } else {
        const { data: nuevaOrden, error } = await supabase.from('ordenes_servicio').insert([data]).select().single()
        if (error) throw error
        ordenId = nuevaOrden.id
        toast.success(`Orden registrada`)
      }

      const todosLosDetalles = [
        ...detalleServicios.map(s => ({
          orden_id: ordenId, tipo: 'servicio', servicio_id: s.servicio_id,
          descripcion: s.nombre, cantidad: s.cantidad, precio_unitario: s.precio_unitario, subtotal: s.subtotal, estado_item: 'pendiente'
        })),
        ...detalleRepuestos.map(r => ({
          orden_id: ordenId, tipo: 'repuesto', item_inventario_id: r.item_inventario_id,
          descripcion: r.nombre, cantidad: r.cantidad, precio_unitario: r.precio_unitario, subtotal: r.subtotal, estado_item: 'reservado'
        }))
      ]

      if (todosLosDetalles.length > 0) {
        const { error: errorDetalles } = await supabase.from('detalle_ordenes_servicio').insert(todosLosDetalles)
        if (errorDetalles) throw errorDetalles
        for (const rep of detalleRepuestos) {
          const { data: itemActual } = await supabase.from('inventario').select('stock_actual, stock_reservado').eq('id', rep.item_inventario_id).single()
          if (itemActual) {
            await supabase.from('inventario').update({ stock_reservado: (itemActual.stock_reservado || 0) + rep.cantidad }).eq('id', rep.item_inventario_id)
            await supabase.from('movimientos_inventario').insert({
              item_inventario_id: rep.item_inventario_id, tipo_movimiento: 'reserva_orden', cantidad: rep.cantidad,
              stock_anterior: itemActual.stock_actual, stock_nuevo: itemActual.stock_actual,
              motivo: `Reserva orden ${formData.numero_orden || ordenId}`,
              orden_id: ordenId, fecha_movimiento: new Date().toISOString(), usuario_responsable: 'sistema'
            })
          }
        }
      }
      resetForm(); fetchOrdenes(); fetchInventario(); fetchOrdenesIndex()
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    }
  }

  async function handleEdit(o: OrdenServicio) {
    if (o.estado === 'Completada') { toast.error('No se puede editar una orden completada'); return }
    setFormData({
      numero_orden: o.numero_orden, cliente_id: o.cliente_id || '', bicicleta_id: o.bicicleta_id || '',
      mecanico_id: o.mecanico_id?.toString() || '', estado: o.estado || 'Pendiente',
      diagnostico: o.diagnostico || '', trabajo_realizado: o.trabajo_realizado || '',
      costo_estimado: o.costo_estimado?.toString() || '', costo_real: o.costo_real?.toString() || '',
      fecha_ingreso: o.fecha_ingreso || '', fecha_entrega_estimada: o.fecha_entrega_estimada || '',
      fecha_entrega_real: o.fecha_entrega_real || '', notas: o.notas || '',
      sintomas_cliente: o.sintomas_cliente || '', trabajos_cotizados: o.trabajos_cotizados || '',
      cotizacion_id: o.cotizacion_id?.toString() || ''
    })
    setEditingId(o.id); setShowForm(true); await fetchDetalleOrden(o.id)
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  async function handleCancelarOrden(id: number, numeroOrden: string) {
    if (!confirm(`¿Está seguro de CANCELAR la orden ${numeroOrden}?\n\nSe liberarán las reservas de inventario.`)) return
    try {
      const { data: detalles } = await supabase.from('detalle_ordenes_servicio').select('*').eq('orden_id', id).eq('tipo', 'repuesto')
      for (const rep of (detalles || [])) {
        const { data: itemActual } = await supabase.from('inventario').select('stock_reservado').eq('id', rep.item_inventario_id).single()
        if (itemActual) await supabase.from('inventario').update({ stock_reservado: Math.max(0, (itemActual.stock_reservado || 0) - rep.cantidad) }).eq('id', rep.item_inventario_id)
      }
      const { error } = await supabase.from('ordenes_servicio').update({ estado: 'Cancelada' }).eq('id', id)
      if (error) throw error
      toast.success(`Orden ${numeroOrden} cancelada y reservas liberadas`)
      fetchOrdenes(); fetchInventario(); fetchOrdenesIndex()
    } catch (error: any) {
      toast.error('Error al cancelar: ' + error.message)
    }
  }

  async function abrirModalCompletado(orden: OrdenServicio) {
    if (!orden.id) { toast.error('ID de orden no válido'); return }
    const { data: detalleData, error } = await supabase.from('detalle_ordenes_servicio').select('*').eq('orden_id', orden.id)
    if (error) { toast.error('Error cargando detalle: ' + error.message); return }
    const todosLosDetalles: DetalleItem[] = (detalleData || []).map((d: any) => ({
      id: d.id, tipo: d.tipo, servicio_id: d.servicio_id, item_inventario_id: d.item_inventario_id,
      nombre: d.descripcion || (d.tipo === 'servicio' ? 'Servicio' : 'Repuesto'), descripcion: d.descripcion || '',
      cantidad: d.cantidad, cantidad_usada: d.cantidad_usada, cantidad_dañada: d.cantidad_dañada,
      precio_unitario: d.precio_unitario, subtotal: d.subtotal, estado_item: d.estado_item, esNuevo: false
    }))
    setDetalleServicios(todosLosDetalles.filter(d => d.tipo === 'servicio'))
    setDetalleRepuestos(todosLosDetalles.filter(d => d.tipo === 'repuesto'))
    const initialData: Record<string, { usada: number, dañada: number }> = {}
    todosLosDetalles.filter(d => d.tipo === 'repuesto').forEach((d) => {
      initialData[d.id] = { usada: d.cantidad_usada ?? d.cantidad, dañada: d.cantidad_dañada ?? 0 }
    })
    setCompletionOrdenId(orden.id); setCompletionData(initialData); setShowCompletionModal(true)
  }

  async function confirmarCompletado() {
    if (completandoOrden) {
      toast.error('Ya se está procesando esta orden')
      return
    }
    if (!completionOrdenId) {
      toast.error('ID de orden no válido')
      return
    }
    setCompletandoOrden(true)
    try {
      const { data: detallesBD, error: errorDetalles } = await supabase.from('detalle_ordenes_servicio').select('*').eq('orden_id', completionOrdenId)
      if (errorDetalles) throw errorDetalles
      let costoRealCalculado = 0
      for (const det of (detallesBD || [])) {
        if (det.tipo === 'servicio') costoRealCalculado += det.cantidad * det.precio_unitario
        else if (det.tipo === 'repuesto') {
          const ajuste = completionData[det.id] || { usada: det.cantidad, dañada: 0 }
          costoRealCalculado += ajuste.usada * det.precio_unitario
        }
      }
      for (const det of (detallesBD || []).filter((d: any) => d.tipo === 'repuesto')) {
        if (!det.item_inventario_id) continue
        const ajuste = completionData[det.id] || { usada: det.cantidad, dañada: 0 }
        // CORRECCIÓN: Comillas dobles en stock_dañado
        const { data: itemActual, error: errorItem } = await supabase.from('inventario').select('stock_actual, stock_reservado, "stock_dañado"').eq('id', det.item_inventario_id).single()
        if (errorItem) throw errorItem
        const nuevoStockActual = itemActual.stock_actual - ajuste.usada - ajuste.dañada
        const nuevoStockReservado = Math.max(0, (itemActual.stock_reservado || 0) - det.cantidad)
        const nuevoStockDanado = (itemActual.stock_dañado || 0) + ajuste.dañada
        await supabase.from('inventario').update({
          stock_actual: nuevoStockActual,
          stock_reservado: nuevoStockReservado,
          stock_dañado: nuevoStockDanado,
          estado: nuevoStockActual === 0 ? 'agotado' : 'disponible'
        }).eq('id', det.item_inventario_id)
        if (ajuste.usada > 0) {
          await supabase.from('movimientos_inventario').insert({
            item_inventario_id: det.item_inventario_id,
            tipo_movimiento: 'consumo_orden',
            cantidad: -ajuste.usada,
            stock_anterior: itemActual.stock_actual,
            stock_nuevo: nuevoStockActual,
            motivo: `Consumo orden completada`,
            orden_id: completionOrdenId,
            fecha_movimiento: new Date().toISOString(),
            usuario_responsable: 'sistema'
          })
        }
        if (ajuste.dañada > 0) {
          await supabase.from('inventario_dañado').insert({
            item_inventario_id: det.item_inventario_id,
            cantidad: ajuste.dañada,
            causa: 'daño_instalacion',
            descripcion: `Dañado durante orden de servicio`,
            orden_id: completionOrdenId,
            valor_perdida: ajuste.dañada * det.precio_unitario
          })
        }
        await supabase.from('detalle_ordenes_servicio').update({
          cantidad_usada: ajuste.usada,
          cantidad_dañada: ajuste.dañada,
          estado_item: 'usado'
        }).eq('id', det.id)
      }
      for (const det of (detallesBD || []).filter((d: any) => d.tipo === 'servicio')) {
        await supabase.from('detalle_ordenes_servicio').update({
          estado_item: 'completado',
          cantidad_usada: det.cantidad
        }).eq('id', det.id)
      }
      const { error: errorOrden } = await supabase.from('ordenes_servicio').update({
        estado: 'Completada',
        fecha_entrega_real: new Date().toISOString().split('T')[0],
        costo_real: costoRealCalculado
      }).eq('id', completionOrdenId)
      if (errorOrden) throw errorOrden
      toast.success(`Orden completada. Costo real: ${formatCurrency(costoRealCalculado)}`)
      setShowCompletionModal(false)
      setCompletionOrdenId(null)
      setCompletionData({})
      fetchOrdenes(); fetchInventario(); fetchOrdenesIndex()
    } catch (error: any) {
      toast.error('Error al completar: ' + error.message)
    } finally {
      setCompletandoOrden(false)
    }
  }

  function resetForm() {
    setFormData({
      numero_orden: '', cliente_id: '', bicicleta_id: '', mecanico_id: '',
      estado: 'Pendiente', diagnostico: '', trabajo_realizado: '',
      costo_estimado: '', costo_real: '', fecha_ingreso: '',
      fecha_entrega_estimada: '', fecha_entrega_real: '', notas: '',
      sintomas_cliente: '', trabajos_cotizados: '', cotizacion_id: ''
    })
    setEditingId(null); setShowForm(false)
    setDetalleServicios([]); setDetalleRepuestos([])
    setNuevoServicio({ servicio_id: '', cantidad: '1' }); setNuevoRepuesto({ item_id: '', cantidad: '1' })
  }

  const getEstadoColor = (estado: string) => {
    switch(estado) {
      case 'Pendiente': return 'bg-yellow-100 text-yellow-800'
      case 'En Proceso': return 'bg-blue-100 text-blue-800'
      case 'Completada': return 'bg-green-100 text-green-800'
      case 'Cancelada': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('es-CO') : '-'
  const formatCurrency = (v: number | null | undefined) => {
    if (v === null || v === undefined) return '$0'
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Órdenes de Servicio</h1>
          <p className="text-slate-500 mt-1">Gestión de órdenes de trabajo</p>
        </div>
        <div className="text-sm text-slate-500 italic">* Las órdenes se generan automáticamente al aprobar una cotización</div>
      </div>

      {showForm && (
        <div ref={formRef} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 scroll-mt-20">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">{editingId ? `Editar Orden ${formData.numero_orden}` : 'Nueva Orden'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Número de Orden</label><input type="text" value={formData.numero_orden} disabled className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500" /></div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cliente *</label>
                <select value={formData.cliente_id} onChange={(e) => setFormData({...formData, cliente_id: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required>
                  <option value="">Seleccionar...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombres} {c.apellidos}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bicicleta *</label>
                <SelectorBicicletaCliente clienteId={formData.cliente_id} value={formData.bicicleta_id} onChange={(bicicletaId) => setFormData({...formData, bicicleta_id: bicicletaId})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mecánico</label>
                <select value={formData.mecanico_id} onChange={(e) => setFormData({...formData, mecanico_id: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">Sin asignar</option>
                  {mecanicos.map(m => <option key={m.id} value={m.id}>{m.nombres} {m.apellidos}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                <select value={formData.estado} onChange={(e) => setFormData({...formData, estado: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="Pendiente">Pendiente</option>
                  <option value="En Proceso">En Proceso</option>
                  <option value="Completada">Completada</option>
                  <option value="Cancelada">Cancelada</option>
                </select>
              </div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Fecha Ingreso *</label><input type="date" value={formData.fecha_ingreso} onChange={(e) => setFormData({...formData, fecha_ingreso: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required /></div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Detalles Técnicos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Síntomas del Cliente</label><textarea value={formData.sintomas_cliente} onChange={(e) => setFormData({...formData, sintomas_cliente: e.target.value})} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Diagnóstico</label><textarea value={formData.diagnostico} onChange={(e) => setFormData({...formData, diagnostico: e.target.value})} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Trabajos Cotizados</label><textarea value={formData.trabajos_cotizados} onChange={(e) => setFormData({...formData, trabajos_cotizados: e.target.value})} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Trabajo Realizado</label><textarea value={formData.trabajo_realizado} onChange={(e) => setFormData({...formData, trabajo_realizado: e.target.value})} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><Wrench className="w-4 h-4" /> Servicios Técnicos</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Servicio</label><select value={nuevoServicio.servicio_id} onChange={(e) => setNuevoServicio({...nuevoServicio, servicio_id: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"><option value="">Seleccionar...</option>{servicios.map(s => <option key={s.id} value={s.id}>{s.nombre} - {formatCurrency(s.precio_cliente)}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Cantidad</label><input type="number" min="1" value={nuevoServicio.cantidad} onChange={(e) => setNuevoServicio({...nuevoServicio, cantidad: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" /></div>
                <div className="flex items-end"><button type="button" onClick={agregarServicio} className="w-full px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 flex items-center justify-center gap-2 text-sm"><Plus className="w-4 h-4" /> Agregar</button></div>
              </div>
              {detalleServicios.length > 0 && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-blue-200"><th className="text-left py-2 text-slate-700">Servicio</th><th className="text-right py-2 text-slate-700">Cant.</th><th className="text-right py-2 text-slate-700">P. Unit.</th><th className="text-right py-2 text-slate-700">Subtotal</th><th className="text-right py-2"></th></tr></thead>
                    <tbody>{detalleServicios.map((item) => (<tr key={item.id} className="border-b border-blue-100 last:border-0"><td className="py-2 text-slate-800">{item.nombre}</td><td className="text-right py-2 text-slate-600">{item.cantidad}</td><td className="text-right py-2 text-slate-600">{formatCurrency(item.precio_unitario)}</td><td className="text-right py-2 font-medium text-slate-800">{formatCurrency(item.subtotal)}</td><td className="text-right py-2"><button type="button" onClick={() => eliminarServicio(item.id)} className="text-red-600 hover:text-red-800"><X className="w-4 h-4" /></button></td></tr>))}</tbody>
                    <tfoot><tr className="font-semibold text-slate-800 border-t border-blue-300"><td colSpan={3} className="text-right py-2">Total Servicios:</td><td className="text-right py-2">{formatCurrency(totalServicios)}</td><td></td></tr></tfoot>
                  </table>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><Package className="w-4 h-4" /> Repuestos y Materiales</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Repuesto/Material</label><select value={nuevoRepuesto.item_id} onChange={(e) => setNuevoRepuesto({...nuevoRepuesto, item_id: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"><option value="">Seleccionar...</option>{inventario.map(i => <option key={i.id} value={i.id}>{i.nombre} (Disp: {i.stock_actual - (i.stock_reservado || 0)}) - {formatCurrency(i.precio_venta)}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Cantidad</label><input type="number" min="1" value={nuevoRepuesto.cantidad} onChange={(e) => setNuevoRepuesto({...nuevoRepuesto, cantidad: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" /></div>
                <div className="flex items-end"><button type="button" onClick={agregarRepuesto} className="w-full px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 flex items-center justify-center gap-2 text-sm"><Plus className="w-4 h-4" /> Agregar</button></div>
              </div>
              {detalleRepuestos.length > 0 && (
                <div className="bg-green-50 rounded-lg p-3">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-green-200"><th className="text-left py-2 text-slate-700">Repuesto/Material</th><th className="text-right py-2 text-slate-700">Cant.</th><th className="text-right py-2 text-slate-700">P. Unit.</th><th className="text-right py-2 text-slate-700">Subtotal</th><th className="text-right py-2"></th></tr></thead>
                    <tbody>{detalleRepuestos.map((item) => (<tr key={item.id} className="border-b border-green-100 last:border-0"><td className="py-2 text-slate-800">{item.nombre}</td><td className="text-right py-2 text-slate-600">{item.cantidad}</td><td className="text-right py-2 text-slate-600">{formatCurrency(item.precio_unitario)}</td><td className="text-right py-2 font-medium text-slate-800">{formatCurrency(item.subtotal)}</td><td className="text-right py-2"><button type="button" onClick={() => eliminarRepuesto(item.id)} className="text-red-600 hover:text-red-800"><X className="w-4 h-4" /></button></td></tr>))}</tbody>
                    <tfoot><tr className="font-semibold text-slate-800 border-t border-green-300"><td colSpan={3} className="text-right py-2">Total Repuestos:</td><td className="text-right py-2">{formatCurrency(totalRepuestos)}</td><td></td></tr></tfoot>
                  </table>
                </div>
              )}
            </div>

            <div className="border-t-2 border-slate-300 pt-4 bg-slate-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="text-right"><span className="text-slate-600">Total Servicios:</span><span className="ml-2 font-medium">{formatCurrency(totalServicios)}</span></div>
                <div className="text-right"><span className="text-slate-600">Total Repuestos:</span><span className="ml-2 font-medium">{formatCurrency(totalRepuestos)}</span></div>
                <div className="text-right border-l border-slate-300 pl-4"><span className="text-slate-800 font-semibold">GRAN TOTAL:</span><span className="ml-2 text-lg font-bold text-blue-600">{formatCurrency(granTotal)}</span></div>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={resetForm} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"><Save className="w-4 h-4" /> {editingId ? 'Actualizar' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      )}

      {showCompletionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-600" /> Completar Orden y Ajustar Inventario</h3>
              <p className="text-sm text-slate-500 mt-1">Confirme las cantidades reales usadas y reporte daños si los hubo.</p>
            </div>
            <div className="p-6 space-y-4">
              {detalleRepuestos.length === 0 ? (
                <p className="text-slate-500 text-center py-4">No hay repuestos en esta orden.</p>
              ) : (
                <div className="space-y-3">
                  {detalleRepuestos.map((item) => {
                    const data = completionData[item.id] || { usada: item.cantidad, dañada: 0 }
                    return (
                      <div key={item.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div className="font-medium text-slate-800 mb-2">{item.nombre} (Reservado: {item.cantidad})</div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Cantidad Usada</label>
                            <input type="number" min="0" max={item.cantidad} value={data.usada} onChange={(e) => setCompletionData({...completionData, [item.id]: {...data, usada: parseInt(e.target.value) || 0}})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-red-500" /> Cantidad Dañada</label>
                            <input type="number" min="0" max={data.usada} value={data.dañada} onChange={(e) => setCompletionData({...completionData, [item.id]: {...data, dañada: parseInt(e.target.value) || 0}})} className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm" />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => { setShowCompletionModal(false); setCompletionOrdenId(null); setCompletionData({}) }} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button 
                onClick={confirmarCompletado} 
                disabled={completandoOrden}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {completandoOrden ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" /> Confirmar Completado
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por número de orden, cliente, bicicleta o estado..."
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setPaginaActual(1) }}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (<div className="p-8 text-center text-slate-500">Cargando...</div>) : ordenes.length === 0 ? (<div className="p-8 text-center text-slate-500">{searchTerm ? 'No se encontraron órdenes' : 'No hay órdenes registradas'}</div>) : (
          <>
            <div className="overflow-x-auto">
              <div className="min-w-[1200px]">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Orden</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Foto</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Cliente</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Bicicleta</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Mecánico</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Ingreso</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">Estado</th>
                      <th className="sticky right-0 bg-slate-50 border-l-2 border-slate-200 px-6 py-3 text-sm font-medium text-slate-700 z-10 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {ordenes.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50 group">
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{o.numero_orden}</td>
                        <td className="px-6 py-4">
                          {o.bicicleta_foto ? (
                            <img src={o.bicicleta_foto} alt="Foto bicicleta" className="h-12 w-12 object-cover rounded-lg border border-slate-200 cursor-pointer hover:scale-110 transition-transform" onClick={(e) => { e.stopPropagation(); window.open(o.bicicleta_foto, '_blank') }} />
                          ) : (
                            <div className="h-12 w-12 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center"><Camera className="w-5 h-5 text-slate-400" /></div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{o.cliente_nombre}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{o.bicicleta_info}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{o.mecanico_nombre}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{formatDate(o.fecha_ingreso)}</td>
                        <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor(o.estado)}`}>{o.estado}</span></td>
                        <td className="sticky right-0 bg-white group-hover:bg-slate-50 border-l-2 border-slate-200 px-6 py-4 text-right z-10 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]">
                          <div className="flex justify-end gap-2">
                            {o.estado === 'Completada' ? (
                              <>
                                <button onClick={() => navigate(`/orden-completada/${o.id}`)} className="p-2 text-green-600 hover:bg-green-50 rounded" title="Ver detalle completo"><Eye className="w-4 h-4" /></button>
                                <span className="p-2 text-slate-400" title="Orden bloqueada"><Lock className="w-4 h-4" /></span>
                              </>
                            ) : (
                              <>
                                <button onClick={() => setModalDetalle(o)} className="p-2 text-slate-600 hover:bg-slate-100 rounded" title="Ver detalle"><Eye className="w-4 h-4" /></button>
                                <button onClick={() => handleEdit(o)} className="p-2 text-blue-600 hover:bg-blue-50 rounded" title="Editar"><Edit className="w-4 h-4" /></button>
                                {(o.estado === 'Pendiente' || o.estado === 'En Proceso') && (
                                  <button onClick={() => abrirModalCompletado(o)} className="p-2 text-green-600 hover:bg-green-50 rounded" title="Completar orden"><CheckCircle className="w-4 h-4" /></button>
                                )}
                                {o.estado !== 'Cancelada' && o.estado !== 'Completada' && (
                                  <button onClick={() => handleCancelarOrden(o.id, o.numero_orden)} className="p-2 text-red-600 hover:bg-red-50 rounded" title="Cancelar orden"><Ban className="w-4 h-4" /></button>
                                )}
                              </>
                            )}
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
          titulo={`Orden ${modalDetalle.numero_orden}`}
          campos={[
            { label: 'Foto Bicicleta', value: modalDetalle.bicicleta_foto, tipo: 'imagen' },
            { label: 'Cliente', value: modalDetalle.cliente_nombre },
            { label: 'Bicicleta', value: modalDetalle.bicicleta_info },
            { label: 'Mecánico', value: modalDetalle.mecanico_nombre },
            { label: 'Estado', value: modalDetalle.estado, tipo: 'estado' },
            { label: 'Fecha Ingreso', value: modalDetalle.fecha_ingreso, tipo: 'fecha' },
            { label: 'Fecha Entrega Estimada', value: modalDetalle.fecha_entrega_estimada, tipo: 'fecha' },
            { label: 'Fecha Entrega Real', value: modalDetalle.fecha_entrega_real, tipo: 'fecha' },
            { label: 'Costo Estimado', value: modalDetalle.costo_estimado, tipo: 'moneda' },
            { label: 'Costo Real', value: modalDetalle.costo_real, tipo: 'moneda' },
            { label: 'Síntomas del Cliente', value: modalDetalle.sintomas_cliente || '-', tipo: 'texto' },
            { label: 'Diagnóstico', value: modalDetalle.diagnostico || '-', tipo: 'texto' },
            { label: 'Trabajos Cotizados', value: modalDetalle.trabajos_cotizados || '-', tipo: 'texto' },
            { label: 'Trabajo Realizado', value: modalDetalle.trabajo_realizado || '-', tipo: 'texto' },
            { label: 'Notas', value: modalDetalle.notas || '-', tipo: 'texto' },
          ]}
          onClose={() => setModalDetalle(null)}
        />
      )}
    </div>
  )
}