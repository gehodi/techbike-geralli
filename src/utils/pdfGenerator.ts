import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Función auxiliar para agregar encabezado
function agregarEncabezado(doc: jsPDF, titulo: string, subtitulo?: string) {
  doc.setFontSize(20)
  doc.setTextColor(30, 41, 59)
  doc.setFont('helvetica', 'bold')
  doc.text(titulo, 105, 20, { align: 'center' })
  if (subtitulo) {
    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139)
    doc.setFont('helvetica', 'normal')
    doc.text(subtitulo, 105, 28, { align: 'center' })
  }
  doc.setDrawColor(30, 41, 59)
  doc.setLineWidth(1)
  doc.line(10, 35, 200, 35)
}

// Función auxiliar para agregar pie de página
function agregarPiePagina(doc: jsPDF) {
  const fecha = new Date().toLocaleDateString('es-CO')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generado el: ${fecha}`, 105, 285, { align: 'center' })
  doc.text('Space Bike - Sistema de Gestión', 105, 290, { align: 'center' })
}

// Helper para obtener lastAutoTable con tipo correcto
function getLastAutoTableFinalY(doc: jsPDF): number {
  return (doc as any).lastAutoTable?.finalY ?? 40
}

// 1. GENERAR COTIZACIÓN PDF
export const generarCotizacionPDF = async (cotizacion: any, detalle: any[]) => {
  const doc = new jsPDF()
  agregarEncabezado(doc, 'COTIZACIÓN DE SERVICIO', `N° ${cotizacion.id}`)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Cliente: ${cotizacion.cliente_nombre}`, 14, 45)
  doc.text(`Bicicleta: ${cotizacion.bicicleta_info}`, 14, 52)
  doc.text(`Fecha: ${new Date(cotizacion.fecha_cotizacion).toLocaleDateString('es-CO')}`, 14, 59)

  const servicios = detalle.filter(d => d.tipo === 'servicio')
  if (servicios.length > 0) {
    autoTable(doc, {
      startY: 70,
      head: [['SERVICIOS TÉCNICOS', 'Cant.', 'P. Unit.', 'Subtotal']],
      body: servicios.map(s => [
        s.nombre,
        s.cantidad,
        `$${s.precio_unitario.toLocaleString('es-CO')}`,
        `$${s.subtotal.toLocaleString('es-CO')}`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] }
    })
  }

  const repuestos = detalle.filter(d => d.tipo === 'repuesto')
  let startY = getLastAutoTableFinalY(doc) + 10
  if (repuestos.length > 0) {
    autoTable(doc, {
      startY: startY,
      head: [['REPUESTOS Y MATERIALES', 'Cant.', 'P. Unit.', 'Subtotal']],
      body: repuestos.map(r => [
        r.nombre,
        r.cantidad,
        `$${r.precio_unitario.toLocaleString('es-CO')}`,
        `$${r.subtotal.toLocaleString('es-CO')}`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [34, 197, 94] }
    })
    startY = getLastAutoTableFinalY(doc) + 10
  }

  const totalServicios = servicios.reduce((sum, s) => sum + s.subtotal, 0)
  const totalRepuestos = repuestos.reduce((sum, r) => sum + r.subtotal, 0)
  const granTotal = totalServicios + totalRepuestos

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Total Servicios: $${totalServicios.toLocaleString('es-CO')}`, 140, startY)
  doc.text(`Total Repuestos: $${totalRepuestos.toLocaleString('es-CO')}`, 140, startY + 7)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(`TOTAL: $${granTotal.toLocaleString('es-CO')}`, 140, startY + 15)

  if (cotizacion.notas) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Notas:', 14, startY + 30)
    doc.text(cotizacion.notas, 14, startY + 37, { maxWidth: 180 })
  }

  agregarPiePagina(doc)
  doc.save(`Cotizacion_${cotizacion.id}.pdf`)
}

// 2. GENERAR ÓRDENES POR ESTADO PDF
export const generarOrdenesPorEstadoPDF = (ordenes: any[], estado: string) => {
  const doc = new jsPDF()
  agregarEncabezado(doc, 'ÓRDENES DE SERVICIO', `Estado: ${estado}`)

  const body = ordenes.map(o => [
    o.numero_orden,
    o.cliente_nombre,
    o.bicicleta_info,
    o.mecanico_nombre,
    new Date(o.fecha_ingreso).toLocaleDateString('es-CO'),
    `$${(o.costo_estimado || 0).toLocaleString('es-CO')}`
  ])

  autoTable(doc, {
    startY: 45,
    head: [['N° Orden', 'Cliente', 'Bicicleta', 'Mecánico', 'Fecha Ingreso', 'Costo Estimado']],
    body: body,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] }
  })

  const total = ordenes.reduce((sum, o) => sum + (o.costo_estimado || 0), 0)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(`Total Órdenes: ${ordenes.length} | Valor Total: $${total.toLocaleString('es-CO')}`, 14, getLastAutoTableFinalY(doc) + 15)
  agregarPiePagina(doc)
  doc.save(`Ordenes_${estado}.pdf`)
}

// 3. COMPARAR ORDEN VS COTIZACIÓN PDF
export const generarComparacionPDF = (orden: any, _cotizacion: any, detalleOrden: any[], _detalleCotizacion: any[]) => {
  const doc = new jsPDF()
  agregarEncabezado(doc, 'COMPARACIÓN: ORDEN vs COTIZACIÓN', `Orden N° ${orden.numero_orden}`)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Cliente: ${orden.cliente_nombre}`, 14, 45)
  doc.text(`Bicicleta: ${orden.bicicleta_info}`, 14, 52)

  const body = detalleOrden.map((itemOrden: any) => [
    itemOrden.descripcion,
    itemOrden.tipo === 'servicio' ? 'Servicio' : 'Repuesto',
    itemOrden.cantidad,
    `$${(itemOrden.precio_unitario || 0).toLocaleString('es-CO')}`,
    `$${(itemOrden.subtotal || 0).toLocaleString('es-CO')}`,
    '✓'
  ])

  autoTable(doc, {
    startY: 65,
    head: [['Descripción', 'Tipo', 'Cant.', 'P. Unit.', 'Subtotal', 'Estado']],
    body: body,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] }
  })

  const totalReal = detalleOrden.reduce((sum: number, d: any) => sum + (d.subtotal || 0), 0)
  const startY = getLastAutoTableFinalY(doc) + 15
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Total Real: $${totalReal.toLocaleString('es-CO')}`, 14, startY)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text(`GRAN TOTAL: $${totalReal.toLocaleString('es-CO')}`, 14, startY + 15)

  agregarPiePagina(doc)
  doc.save(`Comparacion_Orden_${orden.id}.pdf`)
}

// 4. LISTADO DE INVENTARIO PDF
export const generarInventarioPDF = (inventario: any[]) => {
  const doc = new jsPDF('l')
  agregarEncabezado(doc, 'INVENTARIO DE REPUESTOS Y MATERIALES', `Total Items: ${inventario.length}`)

  const body = inventario.map(i => {
    const disponible = i.stock_actual - (i.stock_reservado || 0)
    const estado = disponible <= 0 ? 'Agotado' : disponible <= i.stock_minimo ? 'Stock Bajo' : 'Disponible'
    return [
      i.codigo || '-',
      i.nombre,
      i.categoria || '-',
      i.marca || '-',
      i.stock_actual,
      i.stock_reservado || 0,
      disponible,
      estado,
      `$${(i.precio_venta || 0).toLocaleString('es-CO')}`
    ]
  })

  autoTable(doc, {
    startY: 45,
    head: [['Código', 'Nombre', 'Categoría', 'Marca', 'Stock Actual', 'Reservado', 'Disponible', 'Estado', 'P. Venta']],
    body: body,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    styles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 50 },
      6: { fontStyle: 'bold' }
    }
  })

  agregarPiePagina(doc)
  doc.save('Inventario_Completo.pdf')
}

// 5. ÓRDENES POR MECÁNICO PDF
export const generarOrdenesPorMecanicoPDF = (ordenes: any[], mecanico: string, fechaInicio: string, fechaFin: string) => {
  const doc = new jsPDF()
  agregarEncabezado(doc, 'ÓRDENES ASIGNADAS POR MECÁNICO', `${mecanico}`)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Período: ${new Date(fechaInicio).toLocaleDateString('es-CO')} - ${new Date(fechaFin).toLocaleDateString('es-CO')}`, 105, 38, { align: 'center' })

  const body = ordenes.map(o => [
    o.numero_orden,
    o.cliente_nombre,
    o.bicicleta_info,
    o.estado,
    new Date(o.fecha_ingreso).toLocaleDateString('es-CO'),
    o.fecha_entrega_real ? new Date(o.fecha_entrega_real).toLocaleDateString('es-CO') : 'Pendiente',
    `$${(o.costo_real || 0).toLocaleString('es-CO')}`
  ])

  autoTable(doc, {
    startY: 50,
    head: [['N° Orden', 'Cliente', 'Bicicleta', 'Estado', 'Fecha Ingreso', 'Fecha Entrega', 'Costo Real']],
    body: body,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] }
  })

  const completadas = ordenes.filter(o => o.estado === 'Completada').length
  const totalIngresos = ordenes.reduce((sum, o) => sum + (o.costo_real || 0), 0)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(`Total Órdenes: ${ordenes.length} | Completadas: ${completadas} | Ingresos: $${totalIngresos.toLocaleString('es-CO')}`, 14, getLastAutoTableFinalY(doc) + 15)
  agregarPiePagina(doc)
  doc.save(`Ordenes_Mecanico_${mecanico.replace(/\s/g, '_')}.pdf`)
}

// 6. INGRESOS POR ÓRDENES PDF
export const generarIngresosPDF = (ordenes: any[], fechaInicio: string, fechaFin: string) => {
  const doc = new jsPDF()
  agregarEncabezado(doc, 'INFORME DE INGRESOS POR ÓRDENES COMPLETADAS')

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Período: ${new Date(fechaInicio).toLocaleDateString('es-CO')} - ${new Date(fechaFin).toLocaleDateString('es-CO')}`, 105, 38, { align: 'center' })

  let totalServicios = 0
  let totalRepuestos = 0

  const body = ordenes.map(o => {
    const servicios = o.total_servicios || 0
    const repuestos = o.total_repuestos || 0
    totalServicios += servicios
    totalRepuestos += repuestos
    return [
      o.numero_orden,
      o.cliente_nombre,
      new Date(o.fecha_entrega_real).toLocaleDateString('es-CO'),
      `$${servicios.toLocaleString('es-CO')}`,
      `$${repuestos.toLocaleString('es-CO')}`,
      `$${(o.costo_real || 0).toLocaleString('es-CO')}`
    ]
  })

  autoTable(doc, {
    startY: 50,
    head: [['N° Orden', 'Cliente', 'Fecha Entrega', 'Servicios', 'Repuestos', 'Total']],
    body: body,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] }
  })

  const startY = getLastAutoTableFinalY(doc) + 15
  const granTotal = totalServicios + totalRepuestos

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Total Servicios: $${totalServicios.toLocaleString('es-CO')}`, 14, startY)
  doc.text(`Total Repuestos: $${totalRepuestos.toLocaleString('es-CO')}`, 14, startY + 7)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text(`INGRESO TOTAL: $${granTotal.toLocaleString('es-CO')}`, 14, startY + 17)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(`Total Órdenes Completadas: ${ordenes.length}`, 14, startY + 27)

  agregarPiePagina(doc)
  doc.save(`Ingresos_${fechaInicio}_a_${fechaFin}.pdf`)
}