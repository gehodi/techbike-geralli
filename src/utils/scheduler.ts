import { supabase } from '../lib/supabase'
import { hoyLocal, fechaLocalISO } from './fechas'

// =====================================================
// MOTOR DE PROGRAMACIÓN DE CAPACIDAD FINITA (FCS)
// Reglas: horario semanal variable, festivos, ausencias,
// split multi-día, VIP desplaza pendientes, internas al
// final del día (horas valle), buffer configurable.
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
interface Bloque { inicio: number; fin: number; ordenId?: number; desplazable?: boolean }
interface Calendario {
  config: ConfigTaller
  horarios: HorarioDia[]
  festivos: string[]
  festivosRecurrentes: string[]
  ausencias: Ausencia[]
}
interface Ocupacion { [clave: string]: Bloque[] } // clave = `${mecanicoId}|${fecha}`

const MIN_FRAG = 60 // fragmento mínimo aceptable al dividir una orden entre días

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
  return ((parseFecha(s).getDay() + 6) % 7) + 1 // 1=Lun ... 7=Dom
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
      auto_sugerir_subcontratacion: cfg?.auto_sugerir_subcontratacion ?? true
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

// Bloques libres del día para un mecánico (respeta almuerzo, ausencias parciales y buffer)
function bloquesLibres(cal: Calendario, ocup: Ocupacion, mecanicoId: number, fecha: string, minInicio: number): Bloque[] {
  const h = cal.horarios.find(x => x.dia_semana === dowDe(fecha))
  if (!h || !h.laborable) return []
  const open = Math.max(minDeHora(h.hora_apertura) ?? 480, minInicio)
  const close = minDeHora(h.hora_cierre) ?? 1020
  if (close <= open) return []
  const ocupados: Bloque[] = []
  // almuerzo
  const a = minDeHora(h.almuerzo_inicio)
  const b = minDeHora(h.almuerzo_fin)
  if (a !== null && b !== null) ocupados.push({ inicio: a, fin: b })
  // ausencia parcial: bloquea desde la apertura
  const aus = ausenciaDe(cal, mecanicoId, fecha)
  if (aus?.parcial) ocupados.push({ inicio: open, fin: open + Math.round((aus.horas_afectadas || 0) * 60) })
  // slots existentes + buffer de separación
  const buf = cal.config.minutos_buffer
  for (const s of ocup[`${mecanicoId}|${fecha}`] || []) ocupados.push({ inicio: s.inicio - buf, fin: s.fin + buf, ordenId: s.ordenId, desplazable: s.desplazable })
  // restar intervalos
  let libres: Bloque[] = [{ inicio: open, fin: close }]
  for (const o of ocupados) {
    const sig: Bloque[] = []
    for (const l of libres) {
      if (o.fin <= l.inicio || o.inicio >= l.fin) { sig.push(l); continue }
      if (o.inicio > l.inicio) sig.push({ inicio: l.inicio, fin: Math.min(o.inicio, l.fin) })
      if (o.fin < l.fin) sig.push({ inicio: Math.max(o.inicio, l.fin > o.fin ? o.fin : l.fin), fin: l.fin })
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
      if (take < restante && take < MIN_FRAG) continue // fragmento demasiado pequeño
      const inicio = direccion === 'adelante' ? blk.inicio : blk.fin - take
      slots.push({ fecha, inicio, fin: inicio + take, minutos: take, secuencia: slots.length + 1 })
      restante -= take
    }
  }
  if (restante > 0 || slots.length === 0) return null
  const ultimo = slots[slots.length - 1]
  return { slots, claveFin: `${ultimo.fecha}|${String(ultimo.fin).padStart(4, '0')}` }
}

// ---------- ocupación actual ----------
async function cargarOcupacion(desde: string): Promise<Ocupacion> {
  const { data } = await supabase
    .from('programacion_slots')
    .select('mecanico_id, fecha, hora_inicio, hora_fin, programacion_ordenes(id, estado, orden_id, ordenes_servicio(prioridad))')
    .gte('fecha', desde)
  const ocup: Ocupacion = {}
  for (const s of data || []) {
    const est = (s as any).programacion_ordenes?.estado
    if (!est || est === 'cancelada' || est === 'completada') continue
    const pri = (s as any).programacion_ordenes?.ordenes_servicio?.prioridad ?? 2
    const clave = `${s.mecanico_id}|${s.fecha}`
    if (!ocup[clave]) ocup[clave] = []
    ocup[clave].push({
      inicio: minDeHora(s.hora_inicio) ?? 0,
      fin: minDeHora(s.hora_fin) ?? 0,
      ordenId: (s as any).programacion_ordenes?.orden_id,
      desplazable: est === 'pendiente' && pri >= 2
    })
  }
  return ocup
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

// ---------- escritura con verificación optimista ----------
async function escribir(ordenId: number, mecanicoId: number, slots: SlotCalc[], minutos: number, fechaPrometida: string): Promise<boolean> {
  // re-validación de solapes justo antes de escribir
  for (const sl of slots) {
    const { data: choque } = await supabase
      .from('programacion_slots')
      .select('id, programacion_ordenes(estado)')
      .eq('mecanico_id', mecanicoId)
      .eq('fecha', sl.fecha)
      .lt('hora_inicio', hhmm(sl.fin))
      .gt('hora_fin', hhmm(sl.inicio))
    const activos = (choque || []).filter((c: any) => c.programacion_ordenes?.estado !== 'cancelada' && c.programacion_ordenes?.estado !== 'completada')
    if (activos.length > 0) return false
  }
  const { data: head, error: e1 } = await supabase
    .from('programacion_ordenes')
    .insert({ orden_id: ordenId, mecanico_id: mecanicoId, minutos_totales: minutos, fecha_prometida: fechaPrometida, estado: 'pendiente', tipo_asignacion: 'interna' })
    .select('id')
    .single()
  if (e1) {
    // si ya existía cabecera (reprogramación), reutilizarla
    const { data: exist } = await supabase.from('programacion_ordenes').select('id').eq('orden_id', ordenId).single()
    if (!exist) throw e1
    await supabase.from('programacion_slots').delete().eq('programacion_id', exist.id)
    await supabase.from('programacion_ordenes').update({ mecanico_id: mecanicoId, minutos_totales: minutos, fecha_prometida: fechaPrometida, estado: 'pendiente' }).eq('id', exist.id)
    var headId = exist.id
  } else {
    var headId = head.id
  }
  await supabase.from('programacion_slots').insert(
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

  // candidatos: especialidad requerida si aplica y hay especialistas
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

  // simulación por candidato
  let mejor: { mec: any; sim: NonNullable<ReturnType<typeof simular>> } | null = null
  for (const m of mecanicos) {
    const sim = simular(cal, ocup, m.id, T, direccion, fechaBase, false)
    if (sim && (!mejor || sim.claveFin < mejor.sim.claveFin)) mejor = { mec: m, sim }
  }
  if (!mejor) return { ok: false, error: `Sin capacidad en ${cal.config.horizonte_dias} días. Considera subcontratar o ampliar horario.` }

  // desplazamiento VIP (solo prioridad 1, máx. 3 órdenes pendientes)
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

  // reubicar órdenes desplazadas (cascada)
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
export async function previewPromesa(lineas: LineaServicio[], prioridad: number, serviciosCache: any[]): Promise<ResultadoProgramacion> {
  const cal = await cargarCalendario()
  let T = cal.config.minutos_buffer
  for (const l of lineas) {
    const s = serviciosCache.find(x => x.id === l.servicio_id)
    if (!s) continue
    T += (s.tiempo_preparacion_min || 0) + (s.tiempo_ejecucion_min || 0) * (l.cantidad || 1) + (s.tiempo_limpieza_min || 0)
  }
  if (T <= cal.config.minutos_buffer) return { ok: false, error: 'Selecciona servicios para calcular la promesa.' }
  const ocup = await cargarOcupacion(hoyLocal())
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