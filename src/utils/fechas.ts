// =====================================================
// Utilidades de FECHA DE CALENDARIO sin zona horaria fija.
// Regla de oro del sistema: las columnas de tipo "date"
// se escriben y se leen con el calendario LOCAL del
// dispositivo que opera. Así el comportamiento es
// idéntico y correcto en cualquier parte del mundo.
// Los instantes reales (timestamptz) NO usan esto.
// =====================================================

// Fecha de calendario de cualquier Date, en formato YYYY-MM-DD, sin conversión UTC
export function fechaLocalISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Día de hoy según el calendario del dispositivo
export function hoyLocal(): string {
  return fechaLocalISO(new Date())
}

// Primer día del mes actual del dispositivo (YYYY-MM-01)
export function inicioMesLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// Primer día del mes siguiente (límite exclusivo del rango de mes)
export function inicioMesSiguienteLocal(): string {
  const d = new Date()
  const n = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  return fechaLocalISO(n)
}

// Fecha local desplazada N días (ej. garantías por vencer en 15 días)
export function fechaLocalEnDias(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return fechaLocalISO(d)
}