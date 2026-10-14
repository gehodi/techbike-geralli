import { supabase } from '../lib/supabase'
import { hoyLocal, fechaLocalISO } from './fechas'

// =====================================================
// MOTOR DE PROGRAMACIÓN DE CAPACIDAD FINITA (FCS)
// Reservas duras (órdenes) + tentativas (cotizaciones)
// ✅ FIX: una cotización nunca se esquiva a sí misma
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
interface Bloque {
  inicio: number
  fin: number
  ordenId?: number
  cotizacionId?: number
  desplazable?: boolean
}
interface Calendario {
  config: ConfigTaller
  horarios: HorarioDia[]
  festivos: string[]
  festivosRecurrentes: string[]
  ausencias: Ausencia[]
}
interface Ocupacion { [clave: string]: Bloque[] }

const MIN_FRAG = 60

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

// ---------- carga de calendario ----------
export async function cargarCalendario(): Promise<Calendario> {
  const { data: cfg } = await supabase.from('taller_configuracion').select('*').eq('id', 1).single()
  const { data: hor } = await supabase.from('taller_horarios').select('*')
  const { data: dnl } = await supabase.from('dias_no_laborables').select('fecha, recurrente_anual')
  const { data: aus } = await supabase.from('ausencias_mecanico').select('*').eq('aprobada', true).gte('fecha_fin', hoyLocal())
  return {
    config: {
      minutos_buffer: cfg?.minutos_buffer ?? 15,
      horizonte_dias: cfg?.horizonte_dias ?? 30,
      umbral_sobrecarga: cfg?.umbral_sobrecarga ?? 90,
      minutos_verificacion_retorno: cfg?.minutos_verificacion_retorno ?? 30,
      auto_sugerir_subcontratacion: cfg?.auto_sugerir_subcontratacion ?? true,
      dias_validez_promesa: cfg?.dias_validez_promesa ?? 7
    },
    horarios: (hor || []) as HorarioDia[],
    festivos: (dnl || []).filter((d: any) => !d.recurrente_anual).map((d: any) => d.fecha),
    festivosRecurrentes: (dnl || []).filter((d: any) => d.recurrente_anual).map((d: any) => d.fecha.slice(5)),
    ausencias: (aus || []) as Ausencia[]
  }
}

function esDiaNoLaborable(cal: Calendario, fecha: string): boolean {
  if (cal.festivos.includes(fecha)) return true
  if (cal.festivosRecurrentes.includes(fecha.slice(5))) return true
  const h = cal.horarios.find(x => x.dia_semana === dowDe(fecha))
  return !h || !h.laborable
}

function ausenciaDe(cal: Calendario, mecanicoId: number, fecha: string): Ausencia | null {
  return cal.ausencias.find(a => a.mecanico_id === mecanicoId && fecha >= a.fecha_inicio && fecha <= a.fecha_fin) || null
}

// Bloques libres del día para un mecánico
function bloquesLibres(cal: Calendario, ocup: Ocupacion, mecanicoId: number, fecha: string, minInicio: number): Bloque[] {
  const h = cal.horarios.find(x => x.dia_semana === dowDe(fecha))
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
  for (const s of ocup[`${mecanicoId}|${fecha}`] || []) ocupados.push({ inicio: s.inicio - buf, fin: s.fin + buf, ordenId: s.ordenId, cotizacionId: s.cotizacionId, desplazable: s.desplazable })
  let libres: Bloque[] = [{ inicio: open, fin: close }]
  for (const o of ocupados) {
    const sig: Bloque[] = []
    for (const l of libres) {
      if (o.fin <= l.inicio || o.inicio >= l.fin) { sig.push(l); continue }
      if (o.inicio > l.inicio) sig.push({ inicio: l.inicio, fin: Math.min(o.inicio, l.fin) })
      if (o.fin < l.fin) sig.push({ inicio: Math.max(o.fin, l.inicio), fin: l.fin })
    }
    libres = sig.filter(x => x.fin - x.inicio > 0)
  }
  return libres
}

// Simulación de colocación de T minutos para un mecánico
function simular(
  cal: Calendario,
  ocup: Ocupacion,
  mecanicoId: number,
  T: number,
  direccion: 'adelante' | 'atras',
  fechaBase: string,
  ignorarDesplazables: boolean
): { slots: SlotCalc[]; claveFin: string } | null {
  let restante = T
  const slots: SlotCalc[] = []
  for (let i = 0; i <= cal.config.horizonte_dias && restante > 0; i++) {
    const fecha = addDias(fechaBase, i)
    if (esDiaNoLaborable(cal, fecha)) continue
    const aus = ausenciaDe(cal, mecanicoId, fecha)
    if (aus && !aus.parcial) continue
    let ocupDia = ocup[`${mecanicoId}|${fecha}`] || []
    if (ignorarDesplazables) ocupDia = ocupDia.filter(b => !b.desplazable)
    const ocupTmp: Ocupacion = { ...ocup, [`${mecanicoId}|${fecha}`]: ocupDia }
    const minInicio = fecha === hoyLocal() ? ahoraMin() : 0
    let bloques = bloquesLibres(cal, ocupTmp, mecanicoId, fecha, minInicio)
    if (direccion === 'atras') bloques = [...bloques].reverse()
    for (const blk of bloques) {
      if (restante <= 0) break
      const len = blk.fin - blk.inicio
      if (len <= 0) continue
      const take = Math.min(len, restante)
      if (take < restante && take < MIN_FRAG) continue
      const inicio = direccion === 'adelante' ? blk.inicio : blk.fin - take
      slots.push({ fecha, inicio, fin: inicio + take, minutos: take, secuencia: slots.length + 1 })
      restante -= take
    }
  }
  if (restante > 0 || slots.length === 0) return null
  const ultimo = slots[slots.length - 1]
  return { slots, claveFin: `${ultimo.fecha}|${String(ultimo.fin).padStart(4, '0')}` }
}

// ---------- ocupación actual (duras + UNA tentativa vigente por cotización) ----------
async function cargarOcupacion(desde: string): Promise<Ocupacion> {
  const cal = await cargarCalendario()
  const hoy = hoyLocal()
  const { data } = await supabase
    .from('programacion_slots')
    .select('mecanico_id, fecha, hora_inicio, hora_fin, programacion_ordenes(id, estado, orden_id, cotizacion_id, cotizaciones(estado, fecha_cotizacion), ordenes_servicio(prioridad))')
    .gte('fecha', desde)
  // Pasada 1: cabecera tentativa VIGENTE más reciente por cotización (anti-fantasmas)
  const maxTentativa: Record<number, number> = {}
  for (const s of data || []) {
    const head = (s as any).programacion_ordenes
    if (!head || head.estado !== 'tentativa' || !head.cotizacion_id) continue
    const cot = head.cotizaciones
    if (!cot || cot.estado !== 'Pendiente') continue
    const vence = addDias((cot.fecha_cotizacion || hoy).slice(0, 10), cal.config.dias_validez_promesa)
    if (vence < hoy) continue
    if (!maxTentativa[head.cotizacion_id] || head.id > maxTentativa[head.cotizacion_id]) {
      maxTentativa[head.cotizacion_id] = head.id
    }
  }
  // Pasada 2: construir ocupación
  const ocup: Ocupacion = {}
  for (const s of data || []) {
    const head = (s as any).programacion_ordenes
    const est = head?.estado
    if (!est || est === 'cancelada' || est === 'completada') continue
    let incluir = false
    if (est === 'tentativa') {
      incluir = !!head?.cotizacion_id && maxTentativa[head.cotizacion_id] === head.id
    } else {
      incluir = true
    }
    if (!incluir) continue
    const pri = head?.ordenes_servicio?.prioridad ?? 2
    const clave = `${s.mecanico_id}|${s.fecha}`
    if (!ocup[clave]) ocup[clave] = []
    ocup[clave].push({
      inicio: minDeHora(s.hora_inicio) ?? 0,
      fin: minDeHora(s.hora_fin) ?? 0,
      ordenId: head?.orden_id ?? undefined,
      cotizacionId: head?.cotizacion_id ?? undefined,
      desplazable: est === 'pendiente' && pri >= 2
    })
  }
  return ocup
}

// ✅ FIX: quitar de la ocupación los bloques de una cotización dada
// (para que una cotización nunca compita contra su propia reserva previa)
function quitarCotizacion(ocup: Ocupacion, cotizacionId: number): Ocupacion {
  const out: Ocupacion = {}
  for (const clave of Object.keys(ocup)) {
    const bloques = ocup[clave].filter(b => b.cotizacionId !== cotizacionId)
    if (bloques.length > 0) out[clave] = bloques
  }
  return out
}

// ---------- duración de la orden ----------
export async function minutosDeOrden(ordenId: number): Promise<number> {
  const { data: cfg } = await supabase.from('taller_configuracion').select('minutos_buffer').eq('id', 1).single()
  const buffer = cfg?.minutos_buffer ?? 15
  const { data: det } = await supabase.from('detalle_ordenes_servicio').select('tipo, cantidad, servicio_id').eq('orden_id', ordenId).eq('tipo', 'servicio')
  if (!det || det.length === 0) return 0
  const ids = det.map((d: any) => d.servicio_id)
  const { data: srv } = await supabase.from('servicios').select('id, tiempo_preparacion_min, tiempo_ejecucion_min, tiempo_limpieza_min').in('id', ids)
  const mapa = new Map((srv || []).map((s: any) => [s.id, s]))
  let t = buffer
  for (const d of det) {
    const s = mapa.get(d.servicio_id)
    if (!s) continue
    t += (s.tiempo_preparacion_min || 0) + (s.tiempo_ejecucion_min || 0) * (d.cantidad || 1) + (s.tiempo_limpieza_min || 0)
  }
  return t
}

function minutosDeLineas(lineas: LineaServicio[], serviciosCache: any[], buffer: number): number {
  let t = buffer
  for (const l of lineas) {
    const s = serviciosCache.find(x => x.id === l.servicio_id)
    if (!s) continue
    t += (s.tiempo_preparacion_min || 0) + (s.tiempo_ejecucion_min || 0) * (l.cantidad || 1) + (s.tiempo_limpieza_min || 0)
  }
  return t
}

// ---------- escritura con verificación optimista ----------
async function escribir(ordenId: number, mecanicoId: number, slots: SlotCalc[], minutos: number, fechaPrometida: string): Promise<boolean> {
  for (const sl of slots) {
    const { data: choque } = await supabase
      .from('programacion_slots')
      .select('id, programacion_ordenes(estado)')
      .eq('mecanico_id', mecanicoId)
      .eq('fecha', sl.fecha)
      .lt('hora_inicio', hhmm(sl.fin))
      .gt('hora_fin', hhmm(sl.inicio))
    const activos = (choque || []).filter((c: any) => {
      const e = c.programacion_ordenes?.estado
      return e && e !== 'cancelada' && e !== 'completada' && e !== 'tentativa'
    })
    if (activos.length > 0) return false
  }
  const { data: exist } = await supabase.from('programacion_ordenes').select('id').eq('orden_id', ordenId).single()
  let headId: number
  if (exist) {
    await supabase.from('programacion_slots').delete().eq('programacion_id', exist.id)
    const { error } = await supabase.from('programacion_ordenes').update({
      mecanico_id: mecanicoId, minutos_totales: minutos, fecha_prometida: fechaPrometida, estado: 'pendiente', tipo_asignacion: 'interna'
    }).eq('id', exist.id)
    if (error) return false
    headId = exist.id
  } else {
    const { data: head, error } = await supabase.from('programacion_ordenes').insert({
      orden_id: ordenId, mecanico_id: mecanicoId, minutos_totales: minutos, fecha_prometida: fechaPrometida, estado: 'pendiente', tipo_asignacion: 'interna'
    }).select('id').single()
    if (error || !head) return false
    headId = head.id
  }
  const { error: errSlots } = await supabase.from('programacion_slots').insert(
    slots.map(sl => ({
      programacion_id: headId,
      mecanico_id: mecanicoId,
      fecha: sl.fecha,
      hora_inicio: hhmm(sl.inicio),
      hora_fin: hhmm(sl.fin),
      minutos: sl.minutos,
      secuencia: sl.secuencia
    }))
  )
  if (errSlots) return false
  await supabase.from('ordenes_servicio').update({ mecanico_id: mecanicoId, fecha_entrega_estimada: fechaPrometida }).eq('id', ordenId)
  await supabase.from('auditoria_programacion').insert({ programacion_id: headId, accion: 'programacion_automatica', detalle: { mecanico_id: mecanicoId, slots, minutos } })
  return true
}

export async function liberarProgramacion(ordenId: number, motivo: string): Promise<void> {
  const { data: head } = await supabase.from('programacion_ordenes').select('id').eq('orden_id', ordenId).single()
  if (!head) return
  await supabase.from('auditoria_programacion').insert({ programacion_id: head.id, accion: 'liberacion', detalle: { motivo } })
  await supabase.from('programacion_slots').delete().eq('programacion_id', head.id)
  await supabase.from('programacion_ordenes').delete().eq('id', head.id)
}

// ---------- RESERVAS TENTATIVAS (cotizaciones sin aprobar) ----------
// ✅ ROBUSTO: borra TODAS las tentativas de la cotización (sin .single() que fallaba en silencio)
export async function liberarCotizacion(cotizacionId: number, motivo: string): Promise<void> {
  const { data: heads } = await supabase
    .from('programacion_ordenes')
    .select('id')
    .eq('cotizacion_id', cotizacionId)
    .eq('estado', 'tentativa')
  if (!heads || heads.length === 0) return
  const ids = heads.map((h: any) => h.id)
  for (const id of ids) {
    await supabase.from('auditoria_programacion').insert({ programacion_id: id, accion: 'liberacion_tentativa', detalle: { motivo } })
  }
  await supabase.from('programacion_slots').delete().in('programacion_id', ids)
  await supabase.from('programacion_ordenes').delete().in('id', ids)
}

// ✅ FIX DE RAÍZ: primero libera la reserva previa, LUEGO carga ocupación y simula.
// Así la cotización nunca se esquiva a sí misma ni deja huecos huérfanos.
export async function programarCotizacion(cotizacionId: number, lineas: LineaServicio[], serviciosCache: any[]): Promise<ResultadoProgramacion> {
  const cal = await cargarCalendario()
  const T = minutosDeLineas(lineas, serviciosCache, cal.config.minutos_buffer)
  if (T <= cal.config.minutos_buffer) return { ok: false, error: 'Agrega servicios a la cotización para calcular la promesa.' }
  // 1) Se libera ANTES de simular (elimina el fantasma de la propia cotización)
  await liberarCotizacion(cotizacionId, 'Recálculo de promesa por guardado/edición de cotización')
  // 2) Ocupación limpia + doble seguro: se excluyen bloques de esta cotización
  let ocup = await cargarOcupacion(hoyLocal())
  ocup = quitarCotizacion(ocup, cotizacionId)
  const { data: todos } = await supabase.from('mecanicos').select('id, nombres, apellidos')
  let mejor: { mec: any; sim: NonNullable<ReturnType<typeof simular>> } | null = null
  for (const m of todos || []) {
    const sim = simular(cal, ocup, m.id, T, 'adelante', hoyLocal(), false)
    if (sim && (!mejor || sim.claveFin < mejor.sim.claveFin)) mejor = { mec: m, sim }
  }
  if (!mejor) return { ok: false, error: `Sin capacidad en ${cal.config.horizonte_dias} días. Considera subcontratar o ampliar horario.` }
  // 3) Inserción de la nueva reserva única
  const { data: head, error } = await supabase.from('programacion_ordenes').insert({
    orden_id: null,
    cotizacion_id: cotizacionId,
    mecanico_id: mejor.mec.id,
    minutos_totales: T,
    fecha_prometida: mejor.sim.slots[mejor.sim.slots.length - 1].fecha,
    estado: 'tentativa',
    tipo_asignacion: 'interna'
  }).select('id').single()
  if (error || !head) return { ok: false, error: 'No se pudo guardar la reserva tentativa: ' + (error?.message || '') }
  await supabase.from('programacion_slots').insert(
    mejor.sim.slots.map(sl => ({
      programacion_id: head.id,
      mecanico_id: mejor!.mec.id,
      fecha: sl.fecha,
      hora_inicio: hhmm(sl.inicio),
      hora_fin: hhmm(sl.fin),
      minutos: sl.minutos,
      secuencia: sl.secuencia
    }))
  )
  // 4) Dedupe defensivo post-inserción (cubre guardados concurrentes)
  const { data: heads } = await supabase
    .from('programacion_ordenes')
    .select('id')
    .eq('cotizacion_id', cotizacionId)
    .eq('estado', 'tentativa')
    .order('id', { ascending: false })
  if (heads && heads.length > 1) {
    const viejos = heads.slice(1).map((h: any) => h.id)
    await supabase.from('programacion_slots').delete().in('programacion_id', viejos)
    await supabase.from('programacion_ordenes').delete().in('id', viejos)
  }
  await supabase.from('auditoria_programacion').insert({ programacion_id: head.id, accion: 'reserva_tentativa', detalle: { cotizacion_id: cotizacionId, slots: mejor.sim.slots, minutos: T } })
  return {
    ok: true,
    mecanicoId: mejor.mec.id,
    mecanicoNombre: `${mejor.mec.nombres} ${mejor.mec.apellidos}`,
    fechaPrometida: mejor.sim.slots[mejor.sim.slots.length - 1].fecha,
    minutosTotales: T,
    slots: mejor.sim.slots
  }
}

// Convierte la reserva tentativa en programación dura al aprobar la cotización
export async function confirmarCotizacion(cotizacionId: number, ordenId: number): Promise<ResultadoProgramacion> {
  const { data: head } = await supabase.from('programacion_ordenes').select('*').eq('cotizacion_id', cotizacionId).eq('estado', 'tentativa').order('id', { ascending: false }).limit(1).maybeSingle()
  if (!head) return { ok: false, error: 'La cotización no tiene reserva tentativa vigente.' }
  const { data: slots } = await supabase.from('programacion_slots').select('*').eq('programacion_id', head.id).order('secuencia')
  if (!slots || slots.length === 0) return { ok: false, error: 'Reserva tentativa sin slots.' }
  for (const sl of slots) {
    const { data: choque } = await supabase
      .from('programacion_slots')
      .select('id, programacion_ordenes(estado)')
      .eq('mecanico_id', head.mecanico_id)
      .eq('fecha', sl.fecha)
      .lt('hora_inicio', sl.hora_fin)
      .gt('hora_fin', sl.hora_inicio)
      .neq('programacion_id', head.id)
    const duros = (choque || []).filter((c: any) => {
      const e = c.programacion_ordenes?.estado
      return e && e !== 'cancelada' && e !== 'completada' && e !== 'tentativa'
    })
    if (duros.length > 0) {
      await liberarCotizacion(cotizacionId, 'Conflicto de capacidad al aprobar; se reprograma la orden')
      return { ok: false, error: 'El slot reservado fue tomado antes de aprobar. Se reprogramará la orden.' }
    }
  }
  const { error } = await supabase.from('programacion_ordenes').update({ orden_id: ordenId, estado: 'pendiente' }).eq('id', head.id)
  if (error) return { ok: false, error: error.message }
  await supabase.from('ordenes_servicio').update({ mecanico_id: head.mecanico_id, fecha_entrega_estimada: head.fecha_prometida }).eq('id', ordenId)
  await supabase.from('auditoria_programacion').insert({ programacion_id: head.id, accion: 'conversion_tentativa_a_orden', detalle: { cotizacion_id: cotizacionId, orden_id: ordenId } })
  const { data: mec } = await supabase.from('mecanicos').select('nombres, apellidos').eq('id', head.mecanico_id).single()
  return {
    ok: true,
    mecanicoId: head.mecanico_id,
    mecanicoNombre: mec ? `${mec.nombres} ${mec.apellidos}` : undefined,
    fechaPrometida: head.fecha_prometida,
    minutosTotales: head.minutos_totales
  }
}

// ---------- programación principal ----------
export async function programarOrden(ordenId: number, opts?: { mecanicoForzado?: number; permitirDesplazar?: boolean; motivo?: string }): Promise<ResultadoProgramacion> {
  const cal = await cargarCalendario()
  const T = await minutosDeOrden(ordenId)
  if (T <= 0) return { ok: false, error: 'La orden no tiene servicios con tiempo definido. Agrega servicios y vuelve a programar.' }
  const { data: orden } = await supabase.from('ordenes_servicio').select('prioridad, tipo_orden, fecha_ingreso').eq('id', ordenId).single()
  const prioridad = orden?.prioridad ?? 2
  const direccion: 'adelante' | 'atras' = prioridad === 4 ? 'atras' : 'adelante'
  const fechaBase = hoyLocal()
  const ocup = await cargarOcupacion(fechaBase)

  const { data: det } = await supabase.from('detalle_ordenes_servicio').select('servicio_id').eq('orden_id', ordenId).eq('tipo', 'servicio')
  const ids = (det || []).map((d: any) => d.servicio_id)
  let especialidad: string | null = null
  if (ids.length) {
    const { data: srv } = await supabase.from('servicios').select('requiere_especialista, especialidad').in('id', ids)
    const req = (srv || []).find((s: any) => s.requiere_especialista && s.especialidad)
    if (req) especialidad = req.especialidad
  }
  let mecanicos: any[] = []
  const { data: todos } = await supabase.from('mecanicos').select('id, nombres, apellidos')
  mecanicos = todos || []
  let aviso: string | undefined
  if (especialidad) {
    const { data: esp } = await supabase.from('mecanico_especialidades').select('mecanico_id').eq('especialidad', especialidad)
    const idsEsp = new Set((esp || []).map((e: any) => e.mecanico_id))
    if (idsEsp.size > 0) mecanicos = mecanicos.filter(m => idsEsp.has(m.id))
    else aviso = `Ningún mecánico tiene la especialidad "${especialidad}". Se asignó al mejor disponible.`
  }
  if (opts?.mecanicoForzado) mecanicos = mecanicos.filter(m => m.id === opts.mecanicoForzado)
  if (mecanicos.length === 0) return { ok: false, error: 'No hay mecánicos candidatos disponibles.' }

  let mejor: { mec: any; sim: NonNullable<ReturnType<typeof simular>> } | null = null
  for (const m of mecanicos) {
    const sim = simular(cal, ocup, m.id, T, direccion, fechaBase, false)
    if (sim && (!mejor || sim.claveFin < mejor.sim.claveFin)) mejor = { mec: m, sim }
  }
  if (!mejor) return { ok: false, error: `Sin capacidad en ${cal.config.horizonte_dias} días. Considera subcontratar o ampliar horario.` }

  let desplazadas: number[] = []
  if (prioridad === 1 && opts?.permitirDesplazar !== false) {
    let mejorVIP: { mec: any; sim: NonNullable<ReturnType<typeof simular>> } | null = null
    for (const m of mecanicos) {
      const sim = simular(cal, ocup, m.id, T, 'adelante', fechaBase, true)
      if (sim && (!mejorVIP || sim.claveFin < mejorVIP.sim.claveFin)) mejorVIP = { mec: m, sim }
    }
    if (mejorVIP && mejorVIP.sim.claveFin < mejor.sim.claveFin) {
      const afectadas = new Set<number>()
      for (const sl of mejorVIP.sim.slots) {
        for (const b of ocup[`${mejorVIP.mec.id}|${sl.fecha}`] || []) {
          if (b.desplazable && b.ordenId && b.inicio < sl.fin && b.fin > sl.inicio) afectadas.add(b.ordenId)
        }
      }
      if (afectadas.size <= 3) {
        desplazadas = [...afectadas]
        mejor = { mec: mejorVIP.mec, sim: mejorVIP.sim }
      }
    }
  }

  const escrito = await escribir(ordenId, mejor.mec.id, mejor.sim.slots, T, mejor.sim.slots[mejor.sim.slots.length - 1].fecha)
  if (!escrito) return { ok: false, error: 'Capacidad modificada durante la programación. Reintenta.' }

  for (const oid of desplazadas) {
    await liberarProgramacion(oid, 'Desplazada por orden prioritaria/VIP')
    await programarOrden(oid, { permitirDesplazar: false })
  }

  return {
    ok: true,
    aviso,
    mecanicoId: mejor.mec.id,
    mecanicoNombre: `${mejor.mec.nombres} ${mejor.mec.apellidos}`,
    fechaPrometida: mejor.sim.slots[mejor.sim.slots.length - 1].fecha,
    minutosTotales: T,
    slots: mejor.sim.slots,
    desplazadas
  }
}

export async function reprogramarOrden(ordenId: number, motivo: string, mecanicoForzado?: number): Promise<ResultadoProgramacion> {
  await liberarProgramacion(ordenId, motivo)
  const r = await programarOrden(ordenId, { mecanicoForzado })
  if (r.ok) {
    const { data: head } = await supabase.from('programacion_ordenes').select('id').eq('orden_id', ordenId).single()
    if (head) await supabase.from('auditoria_programacion').insert({ programacion_id: head.id, accion: 'reprogramacion', detalle: { motivo } })
  }
  return r
}

// ---------- vista previa (asistente de promesa, sin escribir) ----------
// ✅ FIX: opcionalmente excluye la reserva de la cotización que se está editando
export async function previewPromesa(lineas: LineaServicio[], prioridad: number, serviciosCache: any[], excluirCotizacion?: number): Promise<ResultadoProgramacion> {
  const cal = await cargarCalendario()
  const T = minutosDeLineas(lineas, serviciosCache, cal.config.minutos_buffer)
  if (T <= cal.config.minutos_buffer) return { ok: false, error: 'Selecciona servicios para calcular la promesa.' }
  let ocup = await cargarOcupacion(hoyLocal())
  if (excluirCotizacion) ocup = quitarCotizacion(ocup, excluirCotizacion)
  const direccion: 'adelante' | 'atras' = prioridad === 4 ? 'atras' : 'adelante'
  const { data: todos } = await supabase.from('mecanicos').select('id, nombres, apellidos')
  let mejor: { mec: any; sim: NonNullable<ReturnType<typeof simular>> } | null = null
  for (const m of todos || []) {
    const sim = simular(cal, ocup, m.id, T, direccion, hoyLocal(), false)
    if (sim && (!mejor || sim.claveFin < mejor.sim.claveFin)) mejor = { mec: m, sim }
  }
  if (!mejor) return { ok: false, error: 'Sin capacidad en el horizonte. Considera subcontratar.' }
  return {
    ok: true,
    mecanicoId: mejor.mec.id,
    mecanicoNombre: `${mejor.mec.nombres} ${mejor.mec.apellidos}`,
    fechaPrometida: mejor.sim.slots[mejor.sim.slots.length - 1].fecha,
    minutosTotales: T,
    slots: mejor.sim.slots
  }
}

// ---------- carga para panel de capacidad ----------
export async function calcularCargaRango(desde: string, hasta: string): Promise<{ mecanicoId: number; comprometidos: number; disponibles: number }[]> {
  const cal = await cargarCalendario()
  const { data: mec } = await supabase.from('mecanicos').select('id')
  const ocup = await cargarOcupacion(desde)
  const out: { mecanicoId: number; comprometidos: number; disponibles: number }[] = []
  for (const m of mec || []) {
    let comp = 0
    let disp = 0
    let f = desde
    while (f <= hasta) {
      if (!esDiaNoLaborable(cal, f) && !ausenciaDe(cal, m.id, f)) {
        const h = cal.horarios.find(x => x.dia_semana === dowDe(f))
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