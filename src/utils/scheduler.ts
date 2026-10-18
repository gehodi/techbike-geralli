import { supabase } from '../lib/supabase'
import { hoyLocal, fechaLocalISO } from './fechas'

// =====================================================
// MOTOR FCS — replanificación global determinista.
// Invariante: cada cambio de capacidad re-planifica TODO el backlog
// de mejor a peor sobre ocupación acumulada => compactación inherente,
// sin slots fantasma, mismo input = mismo Gantt.
// Jerarquía: 1 VIP > 2 Cliente/Cotización > 3 Interna urgente > 4 Interna normal.
// Inamovibles: órdenes 'En Proceso' (trabajo iniciado) se conservan fijos.
// Anti-hang: 1 replanificación por operación + lecturas/escrituras EN LOTE.
// =====================================================

export interface HorarioDia {
  dia_semana: number
  laborable: boolean
  hora_apertura: string | null
  hora_cierre: string | null
  almuerzo_inicio: string | null
  almuerzo_fin: string | null
}
export interface ConfigTaller {
  minutos_buffer: number
  horizonte_dias: number
  umbral_sobrecarga: number
  minutos_verificacion_retorno: number
  auto_sugerir_subcontratacion: boolean
  dias_validez_promesa: number
}
export interface Ausencia {
  mecanico_id: number
  tipo: string
  fecha_inicio: string
  fecha_fin: string
  parcial: boolean
  horas_afectadas: number | null
}
export interface SlotCalc { fecha: string; inicio: number; fin: number; minutos: number; secuencia: number }
export interface LineaServicio { servicio_id: number; cantidad: number }
export interface ResultadoProgramacion {
  ok: boolean
  error?: string
  aviso?: string
  mecanicoId?: number
  mecanicoNombre?: string
  fechaPrometida?: string
  minutosTotales?: number
  slots?: SlotCalc[]
  desplazadas?: number[]
}
interface Bloque { inicio: number; fin: number }
interface Calendario {
  config: ConfigTaller
  horarios: HorarioDia[]
  festivos: string[]
  festivosRecurrentes: string[]
  ausencias: Ausencia[]
}
interface Ocupacion { [clave: string]: Bloque[] }
type Mec = { id: number; nombres: string; apellidos: string }
interface Item {
  kind: 'O' | 'C' | 'N'
  id: number
  prioridad: number
  T: number
  fechaBase: string
  mecanicoForzado?: number
  clave: string
}
interface Asignacion { mec: Mec; slots: SlotCalc[]; T: number; prometida: string }

const MIN_FRAG = 60
const CHUNK = 12

// ---------- utilidades de tiempo ----------
function minDeHora(h: string | null): number | null {
  if (!h) return null
  const p = h.split(':')
  return parseInt(p[0]) * 60 + parseInt(p[1])
}
function parseFecha(s: string): Date {
  const p = s.split('-')
  return new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]), 12)
}
function addDias(s: string, n: number): string {
  const d = parseFecha(s)
  d.setDate(d.getDate() + n)
  return fechaLocalISO(d)
}
function dowDe(s: string): number {
  return ((parseFecha(s).getDay() + 6) % 7) + 1
}
function ahoraMin(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}
function hhmm(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}
async function chunked<T>(arr: T[], fn: (t: T) => Promise<any>): Promise<void> {
  for (let i = 0; i < arr.length; i += CHUNK) {
    await Promise.all(arr.slice(i, i + CHUNK).map(fn))
  }
}

// ---------- calendario ----------
export async function cargarCalendario(): Promise<Calendario> {
  const [cfgR, horR, dnlR, ausR] = await Promise.all([
    supabase.from('taller_configuracion').select('*').eq('id', 1).single(),
    supabase.from('taller_horarios').select('*'),
    supabase.from('dias_no_laborables').select('fecha, recurrente_anual'),
    supabase.from('ausencias_mecanico').select('*').eq('aprobada', true).gte('fecha_fin', hoyLocal())
  ])
  const cfg = cfgR.data as any
  const dnl = (dnlR.data || []) as any[]
  return {
    config: {
      minutos_buffer: cfg?.minutos_buffer ?? 15,
      horizonte_dias: cfg?.horizonte_dias ?? 30,
      umbral_sobrecarga: cfg?.umbral_sobrecarga ?? 90,
      minutos_verificacion_retorno: cfg?.minutos_verificacion_retorno ?? 30,
      auto_sugerir_subcontratacion: cfg?.auto_sugerir_subcontratacion ?? true,
      dias_validez_promesa: cfg?.dias_validez_promesa ?? 7
    },
    horarios: (horR.data || []) as HorarioDia[],
    festivos: dnl.filter((d) => !d.recurrente_anual).map((d) => d.fecha),
    festivosRecurrentes: dnl.filter((d) => d.recurrente_anual).map((d) => String(d.fecha).slice(5)),
    ausencias: (ausR.data || []) as Ausencia[]
  }
}
function esDiaNoLaborable(cal: Calendario, fecha: string): boolean {
  if (cal.festivos.includes(fecha)) return true
  if (cal.festivosRecurrentes.includes(fecha.slice(5))) return true
  const h = cal.horarios.find((x) => x.dia_semana === dowDe(fecha))
  return !h || !h.laborable
}
function ausenciaDe(cal: Calendario, mecanicoId: number, fecha: string): Ausencia | null {
  return cal.ausencias.find((a) => a.mecanico_id === mecanicoId && fecha >= a.fecha_inicio && fecha <= a.fecha_fin) || null
}

// ---------- bloques libres / simulación pura ----------
function bloquesLibres(cal: Calendario, ocup: Ocupacion, mecanicoId: number, fecha: string, minInicio: number): Bloque[] {
  const h = cal.horarios.find((x) => x.dia_semana === dowDe(fecha))
  if (!h || !h.laborable) return []
  const open = Math.max(minDeHora(h.hora_apertura) ?? 480, minInicio)
  const close = minDeHora(h.hora_cierre) ?? 1020
  if (close <= open) return []
  const ocupados: Bloque[] = []
  const a = minDeHora(h.almuerzo_inicio)
  const b = minDeHora(h.almuerzo_fin)
  if (a !== null && b !== null) ocupados.push({ inicio: a, fin: b })
  const aus = ausenciaDe(cal, mecanicoId, fecha)
  if (aus?.parcial) ocupados.push({ inicio: open, fin: open + Math.round((aus.horas_afectadas || 0) * 60) })
  const buf = cal.config.minutos_buffer
  for (const s of ocup[`${mecanicoId}|${fecha}`] || []) ocupados.push({ inicio: s.inicio - buf, fin: s.fin + buf })
  let libres: Bloque[] = [{ inicio: open, fin: close }]
  for (const o of ocupados) {
    const sig: Bloque[] = []
    for (const l of libres) {
      if (o.fin <= l.inicio || o.inicio >= l.fin) { sig.push(l); continue }
      if (o.inicio > l.inicio) sig.push({ inicio: l.inicio, fin: Math.min(o.inicio, l.fin) })
      if (o.fin < l.fin) sig.push({ inicio: Math.max(o.fin, l.inicio), fin: l.fin })
    }
    libres = sig.filter((x) => x.fin - x.inicio > 0)
  }
  return libres
}
function simular(cal: Calendario, ocup: Ocupacion, mecanicoId: number, T: number, fechaBase: string): SlotCalc[] | null {
  let restante = T
  const slots: SlotCalc[] = []
  for (let i = 0; i <= cal.config.horizonte_dias && restante > 0; i++) {
    const fecha = addDias(fechaBase, i)
    if (esDiaNoLaborable(cal, fecha)) continue
    const aus = ausenciaDe(cal, mecanicoId, fecha)
    if (aus && !aus.parcial) continue
    const minInicio = fecha === hoyLocal() ? ahoraMin() : 0
    for (const blk of bloquesLibres(cal, ocup, mecanicoId, fecha, minInicio)) {
      if (restante <= 0) break
      const len = blk.fin - blk.inicio
      if (len <= 0) continue
      const take = Math.min(len, restante)
      if (take < restante && take < MIN_FRAG) continue
      slots.push({ fecha, inicio: blk.inicio, fin: blk.inicio + take, minutos: take, secuencia: slots.length + 1 })
      restante -= take
    }
  }
  if (restante > 0 || slots.length === 0) return null
  return slots
}
function mejorEn(cal: Calendario, ocup: Ocupacion, mecanicos: Mec[], T: number, fechaBase: string): { mec: Mec; slots: SlotCalc[] } | null {
  let mejor: { mec: Mec; slots: SlotCalc[] } | null = null
  let mejorFin = ''
  for (const m of mecanicos) {
    const slots = simular(cal, ocup, m.id, T, fechaBase)
    if (!slots) continue
    const u = slots[slots.length - 1]
    const fin = `${u.fecha}|${String(u.fin).padStart(4, '0')}`
    if (!mejor || fin < mejorFin) { mejor = { mec: m, slots }; mejorFin = fin }
  }
  return mejor
}
function inyectar(ocup: Ocupacion, mecanicoId: number, slots: SlotCalc[]): void {
  for (const sl of slots) {
    const c = `${mecanicoId}|${sl.fecha}`
    if (!ocup[c]) ocup[c] = []
    ocup[c].push({ inicio: sl.inicio, fin: sl.fin })
  }
}

// ---------- NÚCLEO PURO ----------
function planificar(cal: Calendario, inamovibles: Ocupacion, items: Item[], todosMec: Mec[]): { asig: Map<string, Asignacion>; sinAsignar: string[] } {
  const orden = [...items].sort((a, b) => {
    if (a.prioridad !== b.prioridad) return a.prioridad - b.prioridad
    if (a.fechaBase !== b.fechaBase) return a.fechaBase < b.fechaBase ? -1 : 1
    return a.id - b.id
  })
  const ocup: Ocupacion = {}
  for (const k of Object.keys(inamovibles)) ocup[k] = inamovibles[k].map((b) => ({ ...b }))
  const asig = new Map<string, Asignacion>()
  const sinAsignar: string[] = []
  for (const it of orden) {
    const mecanicos = it.mecanicoForzado ? todosMec.filter((m) => m.id === it.mecanicoForzado) : todosMec
    const r = mejorEn(cal, ocup, mecanicos, it.T, hoyLocal())
    if (!r) { sinAsignar.push(it.clave); continue }
    const u = r.slots[r.slots.length - 1]
    asig.set(it.clave, { mec: r.mec, slots: r.slots, T: it.T, prometida: u.fecha })
    inyectar(ocup, r.mec.id, r.slots)
  }
  return { asig, sinAsignar }
}

// ---------- lecturas EN LOTE ----------
async function cargarInamovibles(desde: string): Promise<Ocupacion> {
  const { data } = await supabase
    .from('programacion_slots')
    .select('mecanico_id, fecha, hora_inicio, hora_fin, programacion_ordenes(estado, orden_id, ordenes_servicio(estado))')
    .gte('fecha', desde)
  const ocup: Ocupacion = {}
  for (const s of data || []) {
    const head = (s as any).programacion_ordenes
    if (!head) continue
    if (head.estado === 'cancelada' || head.estado === 'completada' || head.estado === 'tentativa') continue
    if (head.ordenes_servicio?.estado !== 'En Proceso') continue
    const clave = `${s.mecanico_id}|${s.fecha}`
    if (!ocup[clave]) ocup[clave] = []
    ocup[clave].push({ inicio: minDeHora(s.hora_inicio) ?? 0, fin: minDeHora(s.hora_fin) ?? 0 })
  }
  return ocup
}

function duracionDesdeDetalles(det: { cantidad: number; servicio_id: number }[], srvMap: Map<number, any>, buffer: number): number {
  let t = buffer
  for (const d of det) {
    const s = srvMap.get(d.servicio_id)
    if (!s) continue
    t += (s.tiempo_preparacion_min || 0) + (s.tiempo_ejecucion_min || 0) * (d.cantidad || 1) + (s.tiempo_limpieza_min || 0)
  }
  return t
}

async function cargarReubicables(cal: Calendario, buffer: number, excluir: Set<string>): Promise<{ items: Item[]; srvMap: Map<number, any> }> {
  const [srvR, ordsR, cotsR] = await Promise.all([
    supabase.from('servicios').select('id, tiempo_preparacion_min, tiempo_ejecucion_min, tiempo_limpieza_min'),
    supabase.from('ordenes_servicio').select('id, prioridad, fecha_ingreso').eq('estado', 'Pendiente'),
    supabase.from('cotizaciones').select('id, fecha_cotizacion').eq('estado', 'Pendiente')
  ])
  const srvMap = new Map((srvR.data || []).map((s: any) => [s.id, s]))
  const hoy = hoyLocal()

  const ordIds = (ordsR.data || []).map((o: any) => o.id)
  const detOrdR = ordIds.length
    ? await supabase.from('detalle_ordenes_servicio').select('orden_id, cantidad, servicio_id').in('orden_id', ordIds).eq('tipo', 'servicio')
    : { data: [] as any[] }
  const porOrden = new Map<number, { cantidad: number; servicio_id: number }[]>()
  for (const d of detOrdR.data || []) {
    const arr = porOrden.get(d.orden_id) || []
    arr.push({ cantidad: d.cantidad, servicio_id: d.servicio_id })
    porOrden.set(d.orden_id, arr)
  }

  const cotsVigentes = (cotsR.data || []).filter((c: any) => {
    const vence = addDias(String(c.fecha_cotizacion || hoy).slice(0, 10), cal.config.dias_validez_promesa)
    return vence >= hoy
  })
  const cotIds = cotsVigentes.map((c: any) => c.id)
  const detCotR = cotIds.length
    ? await supabase.from('detalle_cotizaciones').select('cotizacion_id, cantidad, servicio_id').in('cotizacion_id', cotIds).eq('tipo', 'servicio')
    : { data: [] as any[] }
  const porCot = new Map<number, LineaServicio[]>()
  for (const d of detCotR.data || []) {
    const arr = porCot.get(d.cotizacion_id) || []
    arr.push({ servicio_id: d.servicio_id, cantidad: d.cantidad })
    porCot.set(d.cotizacion_id, arr)
  }

  const items: Item[] = []
  for (const o of ordsR.data || []) {
    const clave = `O${o.id}`
    if (excluir.has(clave)) continue
    const T = duracionDesdeDetalles(porOrden.get(o.id) || [], srvMap, buffer)
    if (T <= 0) continue
    items.push({ kind: 'O', id: o.id, prioridad: o.prioridad ?? 2, T, fechaBase: String(o.fecha_ingreso || hoy).slice(0, 10), clave })
  }
  for (const c of cotsVigentes) {
    const clave = `C${c.id}`
    if (excluir.has(clave)) continue
    const lineas = porCot.get(c.id) || []
    if (lineas.length === 0) continue
    const T = duracionDesdeDetalles(lineas.map((l) => ({ cantidad: l.cantidad, servicio_id: l.servicio_id })), srvMap, buffer)
    if (T <= buffer) continue
    items.push({ kind: 'C', id: c.id, prioridad: 2, T, fechaBase: String(c.fecha_cotizacion || hoy).slice(0, 10), clave })
  }
  return { items, srvMap }
}

// ---------- COMMIT EN LOTE ----------
async function commit(_cal: Calendario, asig: Map<string, Asignacion>, items: Item[], excluir: Set<string>): Promise<void> {
  const ordIds = items.filter((i) => i.kind === 'O').map((i) => i.id)
  const exclO = [...excluir].filter((k) => k.startsWith('O')).map((k) => parseInt(k.slice(1)))
  const purgarO = [...new Set([...ordIds, ...exclO])]

  const headsO = purgarO.length ? (await supabase.from('programacion_ordenes').select('id').in('orden_id', purgarO)).data || [] : []
  const headsT = (await supabase.from('programacion_ordenes').select('id').eq('estado', 'tentativa')).data || []
  const headPurgeIds = [...new Set([...headsO, ...headsT].map((h: any) => h.id))]
  if (headPurgeIds.length) await supabase.from('programacion_slots').delete().in('programacion_id', headPurgeIds)

  if (purgarO.length) await supabase.from('programacion_ordenes').delete().in('orden_id', purgarO)
  await supabase.from('programacion_ordenes').delete().eq('estado', 'tentativa')

  const filasHead = items.map((it) => {
    const a = asig.get(it.clave)
    if (!a) return null
    return {
      orden_id: it.kind === 'O' ? it.id : null,
      cotizacion_id: it.kind === 'C' ? it.id : null,
      mecanico_id: a.mec.id,
      minutos_totales: a.T,
      fecha_prometida: a.prometida,
      estado: it.kind === 'C' ? 'tentativa' : 'pendiente',
      tipo_asignacion: 'interna'
    }
  }).filter(Boolean) as any[]
  if (filasHead.length === 0) return
  const { data: headsNew, error: errH } = await supabase.from('programacion_ordenes').insert(filasHead).select('id, orden_id, cotizacion_id')
  if (errH || !headsNew) return
  const headByO = new Map<number, number>()
  const headByC = new Map<number, number>()
  for (const h of headsNew as any[]) {
    if (h.orden_id != null) headByO.set(h.orden_id, h.id)
    if (h.cotizacion_id != null) headByC.set(h.cotizacion_id, h.id)
  }

  const filasSlot: any[] = []
  for (const it of items) {
    const a = asig.get(it.clave)
    if (!a) continue
    const hid = it.kind === 'O' ? headByO.get(it.id) : headByC.get(it.id)
    if (hid == null) continue
    for (const sl of a.slots) filasSlot.push({ programacion_id: hid, mecanico_id: a.mec.id, fecha: sl.fecha, hora_inicio: hhmm(sl.inicio), hora_fin: hhmm(sl.fin), minutos: sl.minutos, secuencia: sl.secuencia })
  }
  if (filasSlot.length) await supabase.from('programacion_slots').insert(filasSlot)

  const idsO = items.filter((i) => i.kind === 'O').map((i) => i.id)
  await chunked(idsO, async (oid) => {
    const a = asig.get(`O${oid}`)
    if (!a) return
    await supabase.from('ordenes_servicio').update({ mecanico_id: a.mec.id, fecha_entrega_estimada: a.prometida }).eq('id', oid)
  })
  const idsC = items.filter((i) => i.kind === 'C').map((i) => i.id)
  await chunked(idsC, async (cid) => {
    const a = asig.get(`C${cid}`)
    if (!a) return
    await supabase.from('cotizaciones').update({ fecha_entrega_estimada: a.prometida }).eq('id', cid)
  })

  const aud: any[] = []
  for (const it of items) {
    const a = asig.get(it.clave)
    if (!a) continue
    const hid = it.kind === 'O' ? headByO.get(it.id) : headByC.get(it.id)
    if (hid == null) continue
    aud.push({ programacion_id: hid, accion: 'replanificacion', detalle: { item: it.clave, mecanico_id: a.mec.id, minutos: a.T, prometida: a.prometida } })
  }
  if (aud.length) void Promise.resolve(supabase.from('auditoria_programacion').insert(aud)).catch(() => {})
}

// ---------- REPLANIFICADOR GLOBAL ----------
async function replanificarTodo(pin?: { clave: string; mecanicoForzado?: number }, excluir?: Set<string>): Promise<{ asig: Map<string, Asignacion>; sinAsignar: string[]; items: Item[] }> {
  const cal = await cargarCalendario()
  const buffer = cal.config.minutos_buffer
  const ex = excluir || new Set<string>()
  const [todosR, inamovibles, rec] = await Promise.all([
    supabase.from('mecanicos').select('id, nombres, apellidos'),
    cargarInamovibles(hoyLocal()),
    cargarReubicables(cal, buffer, ex)
  ])
  const mecanicos = (todosR.data || []) as Mec[]
  let items = rec.items
  if (pin) {
    const it = items.find((i) => i.clave === pin.clave)
    if (it && pin.mecanicoForzado) it.mecanicoForzado = pin.mecanicoForzado
  }
  const { asig, sinAsignar } = planificar(cal, inamovibles, items, mecanicos)
  await commit(cal, asig, items, ex)
  return { asig, sinAsignar, items }
}

function resDe(asig: Map<string, Asignacion>, clave: string, sinAsignar: string[], _items: Item[], avisoExtra?: string): ResultadoProgramacion {
  const a = asig.get(clave)
  if (!a) {
    const msg = sinAsignar.includes(clave)
      ? 'Sin capacidad en el horizonte para este ítem. Considera subcontratar o ampliar horario.'
      : 'Ítem no encontrado en el backlog activo.'
    return { ok: false, error: msg }
  }
  return {
    ok: true,
    aviso: avisoExtra,
    mecanicoId: a.mec.id,
    mecanicoNombre: `${a.mec.nombres} ${a.mec.apellidos}`,
    fechaPrometida: a.prometida,
    minutosTotales: a.T,
    slots: a.slots,
    desplazadas: []
  }
}

// =====================================================
// WRAPPERS (firmas idénticas a las que importan los .tsx)
// =====================================================

export async function programarOrden(ordenId: number, opts?: { mecanicoForzado?: number; permitirDesplazar?: boolean; motivo?: string }): Promise<ResultadoProgramacion> {
  const { asig, sinAsignar, items } = await replanificarTodo(opts?.mecanicoForzado ? { clave: `O${ordenId}`, mecanicoForzado: opts.mecanicoForzado } : undefined)
  return resDe(asig, `O${ordenId}`, sinAsignar, items, items.length > 1 ? `Backlog re-compactado (${items.length} ítems reevaluados).` : undefined)
}

export async function reprogramarOrden(ordenId: number, motivo: string, mecanicoForzado?: number): Promise<ResultadoProgramacion> {
  const { asig, sinAsignar, items } = await replanificarTodo(mecanicoForzado ? { clave: `O${ordenId}`, mecanicoForzado } : undefined)
  if (asig.get(`O${ordenId}`)) {
    void Promise.resolve(supabase.from('auditoria_programacion').insert({ programacion_id: null as any, accion: 'reprogramacion', detalle: { orden_id: ordenId, motivo } })).catch(() => {})
  }
  return resDe(asig, `O${ordenId}`, sinAsignar, items)
}

export async function liberarProgramacion(ordenId: number, motivo: string): Promise<void> {
  await replanificarTodo(undefined, new Set([`O${ordenId}`]))
  void Promise.resolve(supabase.from('auditoria_programacion').insert({ programacion_id: null as any, accion: 'liberacion', detalle: { orden_id: ordenId, motivo } })).catch(() => {})
}

export async function programarCotizacion(cotizacionId: number, _lineas: LineaServicio[], _serviciosCache: any[]): Promise<ResultadoProgramacion> {
  const { asig, sinAsignar, items } = await replanificarTodo()
  return resDe(asig, `C${cotizacionId}`, sinAsignar, items)
}

export async function liberarCotizacion(cotizacionId: number, motivo: string): Promise<void> {
  await replanificarTodo(undefined, new Set([`C${cotizacionId}`]))
  void Promise.resolve(supabase.from('auditoria_programacion').insert({ programacion_id: null as any, accion: 'liberacion_tentativa', detalle: { cotizacion_id: cotizacionId, motivo } })).catch(() => {})
}

export async function confirmarCotizacion(cotizacionId: number, ordenId: number): Promise<ResultadoProgramacion> {
  const { asig, sinAsignar, items } = await replanificarTodo()
  void Promise.resolve(supabase.from('auditoria_programacion').insert({ programacion_id: null as any, accion: 'conversion_tentativa_a_orden', detalle: { cotizacion_id: cotizacionId, orden_id: ordenId } })).catch(() => {})
  return resDe(asig, `O${ordenId}`, sinAsignar, items)
}

export async function previewPromesa(lineas: LineaServicio[], prioridad: number, serviciosCache: any[], excluirCotizacion?: number): Promise<ResultadoProgramacion> {
  const cal = await cargarCalendario()
  const buffer = cal.config.minutos_buffer
  const T = duracionDesdeDetalles(lineas.map((l) => ({ cantidad: l.cantidad, servicio_id: l.servicio_id })), new Map(serviciosCache.map((s: any) => [s.id, s])), buffer)
  if (T <= buffer) return { ok: false, error: 'Selecciona servicios para calcular la promesa.' }
  const ex = excluirCotizacion ? new Set([`C${excluirCotizacion}`]) : new Set<string>()
  const [todosR, inamovibles, rec] = await Promise.all([
    supabase.from('mecanicos').select('id, nombres, apellidos'),
    cargarInamovibles(hoyLocal()),
    cargarReubicables(cal, buffer, ex)
  ])
  const nuevo: Item = { kind: 'N', id: 0, prioridad, T, fechaBase: hoyLocal(), clave: 'NEW' }
  const { asig } = planificar(cal, inamovibles, [...rec.items, nuevo], (todosR.data || []) as Mec[])
  const a = asig.get('NEW')
  if (!a) return { ok: false, error: 'Sin capacidad en el horizonte. Considera subcontratar.' }
  return { ok: true, mecanicoId: a.mec.id, mecanicoNombre: `${a.mec.nombres} ${a.mec.apellidos}`, fechaPrometida: a.prometida, minutosTotales: a.T, slots: a.slots }
}

export async function minutosDeOrden(ordenId: number): Promise<number> {
  const { data: cfg } = await supabase.from('taller_configuracion').select('minutos_buffer').eq('id', 1).single()
  const buffer = cfg?.minutos_buffer ?? 15
  const [detR, srvR] = await Promise.all([
    supabase.from('detalle_ordenes_servicio').select('cantidad, servicio_id').eq('orden_id', ordenId).eq('tipo', 'servicio'),
    supabase.from('servicios').select('id, tiempo_preparacion_min, tiempo_ejecucion_min, tiempo_limpieza_min')
  ])
  if (!detR.data || detR.data.length === 0) return 0
  const srvMap = new Map((srvR.data || []).map((s: any) => [s.id, s]))
  return duracionDesdeDetalles(detR.data as any[], srvMap, buffer)
}

export async function calcularCargaRango(desde: string, hasta: string): Promise<{ mecanicoId: number; comprometidos: number; disponibles: number }[]> {
  const [cal, mecR, slotsR] = await Promise.all([
    cargarCalendario(),
    supabase.from('mecanicos').select('id'),
    supabase.from('programacion_slots').select('mecanico_id, fecha, hora_inicio, hora_fin, programacion_ordenes(estado)').gte('fecha', desde)
  ])
  const ocup: Ocupacion = {}
  for (const s of slotsR.data || []) {
    const st = (s as any).programacion_ordenes?.estado
    if (!st || st === 'cancelada' || st === 'completada') continue
    const clave = `${s.mecanico_id}|${s.fecha}`
    if (!ocup[clave]) ocup[clave] = []
    ocup[clave].push({ inicio: minDeHora(s.hora_inicio) ?? 0, fin: minDeHora(s.hora_fin) ?? 0 })
  }
  const out: { mecanicoId: number; comprometidos: number; disponibles: number }[] = []
  for (const m of mecR.data || []) {
    let comp = 0, disp = 0, f = desde
    while (f <= hasta) {
      if (!esDiaNoLaborable(cal, f) && !ausenciaDe(cal, m.id, f)) {
        const h = cal.horarios.find((x) => x.dia_semana === dowDe(f))
        const alm = (minDeHora(h?.almuerzo_fin ?? null) ?? 0) - (minDeHora(h?.almuerzo_inicio ?? null) ?? 0)
        disp += Math.max(0, (minDeHora(h?.hora_cierre ?? null) ?? 0) - (minDeHora(h?.hora_apertura ?? null) ?? 0) - alm)
      }
      for (const b of ocup[`${m.id}|${f}`] || []) comp += b.fin - b.inicio
      f = addDias(f, 1)
    }
    out.push({ mecanicoId: m.id, comprometidos: comp, disponibles: disp })
  }
  return out
}