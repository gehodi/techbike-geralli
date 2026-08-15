import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Función auxiliar para agregar encabezado con logo
function agregarEncabezado(doc: jsPDF, titulo: string, subtitulo?: string) {
  doc.setFontSize(20)
  doc.setTextColor(30, 41, 59)
  doc.setFont(undefined, 'bold')
  doc.text('SPACE BIKE', 105, 15, { align: 'center' })
  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  doc.setFont(undefined, 'normal')
  doc.text('Taller de Bicicletas', 105, 22, { align: 'center' })
  doc.setDrawColor(30, 41, 59)
  doc.setLineWidth(0.5)
  doc.line(14, 26, 196, 26)
  doc.setFontSize(14)
  doc.setTextColor(30, 41, 59)
  doc.setFont(undefined, 'bold')
  doc.text(titulo, 105, 35, { align: 'center' })
  if (subtitulo) {
    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139)
    doc.setFont(undefined, 'normal')
    doc.text(subtitulo, 105, 42, { align: 'center' })
  }
}

// Función auxiliar para agregar pie de página
function agregarPiePagina(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text(`Space Bike - Sistema de Gestión`, 105, 285, { align: 'center' })
    doc.text(`Página ${i} de ${pageCount}`, 105, 290, { align: 'center' })
    doc.text(`Generado el: ${new Date().toLocaleDateString('es-CO')}`, 105, 295, { align: 'center' })
  }
}

// Función auxiliar para agregar sección de información
function agregarSeccionInfo(doc: jsPDF, campos: { label: string; value: string }[], startY: number) {
  let y = startY
  doc.setFontSize(10)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(30, 41, 59)
  campos.forEach(campo => {
    if (y > 270) {
      doc.addPage()
      y = 20
    }
    doc.text(`${campo.label}:`, 14, y)
    doc.setFont(undefined, 'normal')
    doc.setTextColor(60, 60, 60)
    const textoLargo = doc.splitTextToSize(campo.value, 130)
    doc.text(textoLargo, 70, y)
    y += Math.max(7, textoLargo.length * 5)
    doc.setFont(undefined, 'bold')
    doc.setTextColor(30, 41, 59)
  })
  return y
}

// 1. GENERAR COTIZACIÓN PDF
export const generarCotizacionPDF = async (cotizacion: any, detalle: any[]) => {
  const doc = new jsPDF()
  agregarEncabezado(doc, 'COTIZACIÓN DE SERVICIO', `N° ${cotizacion.id}`)
  
  doc.setFontSize(11)
  doc.setTextColor(30, 41, 59)
  doc.setFont(undefined, 'bold')
  doc.text('DATOS DEL CLIENTE', 14, 52)
  doc.setFont(undefined, 'normal')
  doc.text(`Cliente: ${cotizacion.cliente_nombre}`, 14, 58)
  doc.text(`Bicicleta: ${cotizacion.bicicleta_info}`, 14, 64)
  doc.text(`Fecha: ${new Date(cotizacion.fecha_cotizacion).toLocaleDateString('es-CO')}`, 14, 70)
  
  const servicios = detalle.filter(d => d.tipo === 'servicio')
  let startY = 78
  if (servicios.length > 0) {
    autoTable(doc, {
      startY: startY,
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
    startY = doc.lastAutoTable.finalY + 10
  }
  
  const repuestos = detalle.filter(d => d.tipo === 'repuesto')
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
    startY = doc.lastAutoTable.finalY + 10
  }
  
  const totalServicios = servicios.reduce((sum, s) => sum + s.subtotal, 0)
  const totalRepuestos = repuestos.reduce((sum, r) => sum + r.subtotal, 0)
  const granTotal = totalServicios + totalRepuestos
  
  doc.setFontSize(11)
  doc.setTextColor(30, 41, 59)
  doc.text(`Total Servicios: $${totalServicios.toLocaleString('es-CO')}`, 140, startY)
  doc.text(`Total Repuestos: $${totalRepuestos.toLocaleString('es-CO')}`, 140, startY + 7)
  doc.setFontSize(13)
  doc.setFont(undefined, 'bold')
  doc.text(`TOTAL: $${granTotal.toLocaleString('es-CO')}`, 140, startY + 15)
  
  if (cotizacion.notas) {
    doc.setFontSize(10)
    doc.setFont(undefined, 'normal')
    doc.text('Notas:', 14, startY + 25)
    doc.text(cotizacion.notas, 14, startY + 31, { maxWidth: 180 })
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
    startY: 50,
    head: [['N° Orden', 'Cliente', 'Bicicleta', 'Mecánico', 'Fecha Ingreso', 'Costo Estimado']],
    body: body,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] }
  })
  
  const total = ordenes.reduce((sum, o) => sum + (o.costo_estimado || 0), 0)
  doc.setFontSize(12)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text(`Total Órdenes: ${ordenes.length} | Valor Total: $${total.toLocaleString('es-CO')}`, 14, doc.lastAutoTable.finalY + 15)
  
  agregarPiePagina(doc)
  doc.save(`Ordenes_${estado}.pdf`)
}

// 3. GENERAR DETALLE DE ORDEN PDF (COMPARACIÓN)
export const generarComparacionPDF = (orden: any, cotizacion: any, detalleOrden: any[], detalleCotizacion: any[]) => {
  const doc = new jsPDF()
  agregarEncabezado(doc, 'DETALLE DE ORDEN DE SERVICIO', `Orden N° ${orden.numero_orden}`)
  
  // Sección 1: Información General de la Orden
  const infoGeneral = [
    { label: 'Cliente', value: orden.cliente_nombre || '-' },
    { label: 'Bicicleta', value: orden.bicicleta_info || '-' },
    { label: 'Mecánico', value: orden.mecanico_nombre || 'Sin asignar' },
    { label: 'Estado', value: orden.estado || '-' },
    { label: 'Fecha Ingreso', value: orden.fecha_ingreso ? new Date(orden.fecha_ingreso).toLocaleDateString('es-CO') : '-' },
    { label: 'Fecha Entrega Estimada', value: orden.fecha_entrega_estimada ? new Date(orden.fecha_entrega_estimada).toLocaleDateString('es-CO') : '-' },
    { label: 'Fecha Entrega Real', value: orden.fecha_entrega_real ? new Date(orden.fecha_entrega_real).toLocaleDateString('es-CO') : '-' },
  ]
  
  let y = agregarSeccionInfo(doc, infoGeneral, 50)
  y += 5
  
  // Sección 2: Costos
  doc.setFontSize(10)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text('COSTOS:', 14, y)
  y += 6
  doc.setFont(undefined, 'normal')
  doc.setTextColor(60, 60, 60)
  doc.text(`Costo Estimado: $${(orden.costo_estimado || 0).toLocaleString('es-CO')}`, 14, y)
  y += 6
  doc.text(`Costo Real: $${(orden.costo_real || 0).toLocaleString('es-CO')}`, 14, y)
  y += 10
  
  // Sección 3: Información Técnica
  const infoTecnica = [
    { label: 'Síntomas del Cliente', value: orden.sintomas_cliente || '-' },
    { label: 'Diagnóstico', value: orden.diagnostico || '-' },
    { label: 'Trabajos Cotizados', value: orden.trabajos_cotizados || '-' },
    { label: 'Trabajo Realizado', value: orden.trabajo_realizado || '-' },
    { label: 'Notas', value: orden.notas || '-' },
  ]
  
  y = agregarSeccionInfo(doc, infoTecnica, y)
  y += 5
  
  // Sección 4: Detalle de Servicios
  const servicios = detalleOrden.filter(d => d.tipo === 'servicio')
  if (servicios.length > 0) {
    if (y > 240) {
      doc.addPage()
      y = 20
    }
    doc.setFontSize(11)
    doc.setFont(undefined, 'bold')
    doc.setTextColor(30, 41, 59)
    doc.text('SERVICIOS TÉCNICOS', 14, y)
    y += 5
    
    autoTable(doc, {
      startY: y,
      head: [['Servicio', 'Cant.', 'P. Unit.', 'Subtotal', 'Estado']],
      body: servicios.map(s => [
        s.descripcion || s.nombre || '-',
        s.cantidad,
        `$${(s.precio_unitario || 0).toLocaleString('es-CO')}`,
        `$${(s.subtotal || 0).toLocaleString('es-CO')}`,
        s.estado_item || '-'
      ]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] }
    })
    y = doc.lastAutoTable.finalY + 10
  }
  
  // Sección 5: Detalle de Repuestos
  const repuestos = detalleOrden.filter(d => d.tipo === 'repuesto')
  if (repuestos.length > 0) {
    if (y > 240) {
      doc.addPage()
      y = 20
    }
    doc.setFontSize(11)
    doc.setFont(undefined, 'bold')
    doc.setTextColor(30, 41, 59)
    doc.text('REPUESTOS Y MATERIALES', 14, y)
    y += 5
    
    autoTable(doc, {
      startY: y,
      head: [['Repuesto', 'Cant.', 'Cant. Usada', 'Cant. Dañada', 'P. Unit.', 'Subtotal', 'Estado']],
      body: repuestos.map(r => [
        r.descripcion || r.nombre || '-',
        r.cantidad,
        r.cantidad_usada ?? '-',
        r.cantidad_dañada ?? 0,
        `$${(r.precio_unitario || 0).toLocaleString('es-CO')}`,
        `$${(r.subtotal || 0).toLocaleString('es-CO')}`,
        r.estado_item || '-'
      ]),
      theme: 'striped',
      headStyles: { fillColor: [34, 197, 94] }
    })
    y = doc.lastAutoTable.finalY + 10
  }
  
  // Sección 6: Totales
  const totalServicios = servicios.reduce((sum, s) => sum + (s.subtotal || 0), 0)
  const totalRepuestos = repuestos.reduce((sum, r) => sum + (r.subtotal || 0), 0)
  const granTotal = totalServicios + totalRepuestos
  
  if (y > 250) {
    doc.addPage()
    y = 20
  }
  
  doc.setFontSize(11)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text(`Total Servicios: $${totalServicios.toLocaleString('es-CO')}`, 14, y)
  y += 7
  doc.text(`Total Repuestos: $${totalRepuestos.toLocaleString('es-CO')}`, 14, y)
  y += 7
  doc.setFontSize(13)
  doc.text(`GRAN TOTAL: $${granTotal.toLocaleString('es-CO')}`, 14, y)
  
  agregarPiePagina(doc)
  doc.save(`Orden_${orden.numero_orden}_Detalle.pdf`)
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
    startY: 50,
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
  doc.setTextColor(100, 116, 139)
  doc.text(`Período: ${new Date(fechaInicio).toLocaleDateString('es-CO')} - ${new Date(fechaFin).toLocaleDateString('es-CO')}`, 105, 48, { align: 'center' })
  
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
    startY: 56,
    head: [['N° Orden', 'Cliente', 'Bicicleta', 'Estado', 'Fecha Ingreso', 'Fecha Entrega', 'Costo Real']],
    body: body,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] }
  })
  
  const completadas = ordenes.filter(o => o.estado === 'Completada').length
  const totalIngresos = ordenes.reduce((sum, o) => sum + (o.costo_real || 0), 0)
  doc.setFontSize(11)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text(`Total Órdenes: ${ordenes.length} | Completadas: ${completadas} | Ingresos: $${totalIngresos.toLocaleString('es-CO')}`, 14, doc.lastAutoTable.finalY + 15)
  
  agregarPiePagina(doc)
  doc.save(`Ordenes_Mecanico_${mecanico.replace(/\s/g, '_')}.pdf`)
}

// 6. INGRESOS POR ÓRDENES PDF
export const generarIngresosPDF = (ordenes: any[], fechaInicio: string, fechaFin: string) => {
  const doc = new jsPDF()
  agregarEncabezado(doc, 'INFORME DE INGRESOS POR ÓRDENES COMPLETADAS')
  
  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  doc.text(`Período: ${new Date(fechaInicio).toLocaleDateString('es-CO')} - ${new Date(fechaFin).toLocaleDateString('es-CO')}`, 105, 48, { align: 'center' })
  
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
    startY: 56,
    head: [['N° Orden', 'Cliente', 'Fecha Entrega', 'Servicios', 'Repuestos', 'Total']],
    body: body,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] }
  })
  
  const startY = doc.lastAutoTable.finalY + 15
  const granTotal = totalServicios + totalRepuestos
  
  doc.setFontSize(11)
  doc.setTextColor(30, 41, 59)
  doc.text(`Total Servicios: $${totalServicios.toLocaleString('es-CO')}`, 14, startY)
  doc.text(`Total Repuestos: $${totalRepuestos.toLocaleString('es-CO')}`, 14, startY + 7)
  doc.setFontSize(13)
  doc.setFont(undefined, 'bold')
  doc.text(`INGRESO TOTAL: $${granTotal.toLocaleString('es-CO')}`, 14, startY + 17)
  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(`Total Órdenes Completadas: ${ordenes.length}`, 14, startY + 27)
  
  agregarPiePagina(doc)
  doc.save(`Ingresos_${fechaInicio}_a_${fechaFin}.pdf`)
}