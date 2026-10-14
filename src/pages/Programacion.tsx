import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { CalendarDays, RefreshCw, AlertTriangle, Clock, PlayCircle, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { cargarCalendario, calcularCargaRango, programarOrden, reprogramarOrden, liberarProgramacion, liberarCotizacion } from '../utils/scheduler'

interface SlotView {
  id: number
  mecanico_id: number
  fecha: string
  hora_inicio: string
  hora_fin: string
  minutos: number
  orden_id: number | null
  cotizacion_id: number | null
  numero_orden: string
  cliente: string
  prioridad: number
  estado_orden: string
  estado_prog: string
  esTentativa: boolean
}
interface MecanicoView { id: number; nombres: string; apellidos: string }
interface OrdenSinProgramar { id: number; numero_orden: string; cliente: string; prioridad: number; estado: string }

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function Programacion() {
  const [mecanicos, setMecanicos] = useState<MecanicoView[]>([])
  const [slots, setSlots] = useState<SlotView[]>([])
  const [sinProgramar, setSinProgramar] = useState<OrdenSinProgramar[]>([])
  const [carga, setCarga] = useState<{ mecanicoId: number; comprometidos: number; disponibles: number }[]>([])
  const [cal, setCal] = useState<Awaited<ReturnType<typeof cargarCalendario>> | null>(null)
  const [horizonte, setHorizonte] = useState(7)
  const [loading, setLoading] = useState(true)
  const [modalSlot, setModalSlot] = useState<SlotView | null>(null)
  const [accionLoading, setAccionLoading] = useState(false)

  useEffect(() => { fetchAll() }, [])
  useEffect(() => { fetchCarga() }, [])

  function addDias(s: string, n: number): string {
    const p = s.split('-')
    const d = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]), 12)
    d.setDate(d.getDate() + n)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  function hoy(): string {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  function nombreDia(f: string): string {
    const p = f.split('-')
    return DIAS_SEMANA[new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]), 12).getDay()]
  }
  function fmtHora(h: string): string { return h.slice(0, 5) }
  function fmtH(min: number): string { return `${(min / 60).toFixed(1)}h` }

  async function fetchAll() {
    setLoading(true)
    try {
      const calendario = await cargarCalendario()
      setCal(calendario)
      const h = hoy()
      const { data: mec } = await supabase.from('mecanicos').select('id, nombres, apellidos').order('apellidos')
      setMecanicos(mec || [])
      const { data: sl } = await supabase
        .from('programacion_slots')
        .select('id, mecanico_id, fecha, hora_inicio, hora_fin, minutos, programacion_ordenes(id, orden_id, estado, cotizacion_id, cotizaciones(id, estado, fecha_cotizacion), ordenes_servicio(numero_orden, prioridad, estado, clientes(nombres, apellidos)))')
        .gte('fecha', h)
      const planos: SlotView[] = (sl || [])
        .map((s: any) => {
          const head = s.programacion_ordenes
          const esTentativa = head?.estado === 'tentativa'
          let incluir = true
          if (esTentativa) {
            const cot = head?.cotizaciones
            if (!cot || cot.estado !== 'Pendiente') incluir = false
            else {
              const vence = addDias((cot.fecha_cotizacion || h).slice(0, 10), calendario.config.dias_validez_promesa)
              incluir = vence >= h
            }
          }
          return {
            incluir,
            slot: {
              id: s.id,
              mecanico_id: s.mecanico_id,
              fecha: s.fecha,
              hora_inicio: s.hora_inicio,
              hora_fin: s.hora_fin,
              minutos: s.minutos,
              orden_id: head?.orden_id ?? null,
              cotizacion_id: head?.cotizacion_id ?? null,
              numero_orden: esTentativa
                ? `COT-#${head?.cotizacion_id}`
                : (head?.ordenes_servicio?.numero_orden || `#${head?.orden_id}`),
              cliente: esTentativa
                ? 'Cotización sin aprobar'
                : (head?.ordenes_servicio?.clientes ? `${head.ordenes_servicio.clientes.nombres} ${head.ordenes_servicio.clientes.apellidos}` : 'Interna'),
              prioridad: head?.ordenes_servicio?.prioridad ?? 2,
              estado_orden: head?.ordenes_servicio?.estado || '',
              estado_prog: head?.estado || '',
              esTentativa
            } as SlotView
          }
        })
        .filter((x: any) => x.incluir && x.slot.estado_prog !== 'cancelada')
        .map((x: any) => x.slot)
      setSlots(planos)
      const { data: ord } = await supabase
        .from('ordenes_servicio')
        .select('id, numero_orden, estado, prioridad, clientes(nombres, apellidos)')
        .in('estado', ['Pendiente', 'En Proceso'])
      const { data: prog } = await supabase.from('programacion_ordenes').select('orden_id').not('orden_id', 'is', null)
      const programadas = new Set((prog || []).map((p: any) => p.orden_id))
      setSinProgramar(
        (ord || [])
          .filter((o: any) => !programadas.has(o.id))
          .map((o: any) => ({
            id: o.id,
            numero_orden: o.numero_orden || `#${o.id}`,
            cliente: o.clientes ? `${o.clientes.nombres} ${o.clientes.apellidos}` : 'Interna',
            prioridad: o.prioridad ?? 2,
            estado: o.estado
          }))
      )
    } catch (error: any) {
      toast.error('Error cargando programación: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchCarga() {
    try {
      const h = hoy()
      const c = await calcularCargaRango(h, addDias(h, 6))
      setCarga(c)
    } catch (error: any) {
      console.error('Error cargando capacidad:', error)
    }
  }

  async function handleProgramar(o: OrdenSinProgramar) {
    setAccionLoading(true)
    const r = await programarOrden(o.id)
    setAccionLoading(false)
    if (r.ok) toast.success(`${o.numero_orden} programada: entrega ${r.fechaPrometida} con ${r.mecanicoNombre}`)
    else toast.error(r.error || 'No se pudo programar')
    fetchAll(); fetchCarga()
  }

  async function handleReprogramar(s: SlotView) {
    if (!s.orden_id) return
    setAccionLoading(true)
    const r = await reprogramarOrden(s.orden_id, 'Reprogramación desde Gantt')
    setAccionLoading(false)
    setModalSlot(null)
    if (r.ok) toast.success(`${s.numero_orden} reprogramada: entrega ${r.fechaPrometida} con ${r.mecanicoNombre}`)
    else toast.error(r.error || 'No se pudo reprogramar')
    fetchAll(); fetchCarga()
  }

  async function handleLiberar(s: SlotView) {
    if (!s.orden_id) return
    if (!confirm(`¿Liberar la programación de ${s.numero_orden}? La orden quedará sin programar.`)) return
    setAccionLoading(true)
    await liberarProgramacion(s.orden_id, 'Liberada desde Gantt')
    setAccionLoading(false)
    setModalSlot(null)
    toast.success('Programación liberada')
    fetchAll(); fetchCarga()
  }

  async function handleLiberarTentativa(s: SlotView) {
    if (!s.cotizacion_id) return
    if (!confirm(`¿Liberar la reserva de capacidad de ${s.numero_orden}? La cotización seguirá Pendiente pero sin capacidad apartada.`)) return
    setAccionLoading(true)
    await liberarCotizacion(s.cotizacion_id, 'Liberada desde Gantt')
    setAccionLoading(false)
    setModalSlot(null)
    toast.success('Reserva tentativa liberada')
    fetchAll(); fetchCarga()
  }

  function esFestivo(f: string): boolean {
    if (!cal) return false
    return cal.festivos.includes(f) || cal.festivosRecurrentes.includes(f.slice(5))
  }
  function ausenciaDe(mecId: number, f: string) {
    if (!cal) return null
    return cal.ausencias.find(a => a.mecanico_id === mecId && f >= a.fecha_inicio && f <= a.fecha_fin) || null
  }
  function colorSlot(s: SlotView): string {
    if (s.esTentativa) return 'bg-amber-50 border-amber-400 border-dashed text-amber-800'
    const base = s.prioridad === 1
      ? 'bg-purple-100 border-purple-400 text-purple-800'
      : s.prioridad === 4
        ? 'bg-green-100 border-green-400 text-green-800'
        : 'bg-blue-100 border-blue-400 text-blue-800'
    return s.estado_orden === 'Completada' ? `${base} opacity-50` : base
  }
  function colorCarga(pct: number): string {
    if (pct < 70) return 'bg-green-500'
    if (pct <= 90) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const dias = Array.from({ length: horizonte }, (_, i) => addDias(hoy(), i))
  const slotsDe = (mecId: number, f: string) =>
    slots.filter(s => s.mecanico_id === mecId && s.fecha === f).sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))

  const totalComp = carga.reduce((s, c) => s + c.comprometidos, 0)
  const totalDisp = carga.reduce((s, c) => s + c.disponibles, 0)
  const pctTaller = totalDisp > 0 ? Math.round((totalComp / totalDisp) * 100) : 0

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando programación...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><CalendarDays className="w-6 h-6 text-blue-600" /> Programación del Taller</h1>
          <p className="text-slate-500 mt-1">Carga de trabajo por mecánico y promesas de entrega</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            {[7, 14, 30].map(h => (
              <button key={h} onClick={() => setHorizonte(h)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${horizonte === h ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>
                {h} días
              </button>
            ))}
          </div>
          <button onClick={() => { fetchAll(); fetchCarga() }} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg" title="Recargar"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Panel de capacidad (próximos 7 días) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Clock className="w-4 h-4" /> Capacidad — próximos 7 días</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {carga.map(c => {
            const mec = mecanicos.find(m => m.id === c.mecanicoId)
            const pct = c.disponibles > 0 ? Math.round((c.comprometidos / c.disponibles) * 100) : 0
            return (
              <div key={c.mecanicoId} className="border border-slate-200 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-slate-700">{mec ? `${mec.nombres} ${mec.apellidos}` : `Mecánico ${c.mecanicoId}`}</span>
                  <span className={`text-sm font-bold ${pct < 70 ? 'text-green-600' : pct <= 90 ? 'text-yellow-600' : 'text-red-600'}`}>{pct}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${colorCarga(pct)}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <div className="text-xs text-slate-500 mt-1">{fmtH(c.comprometidos)} comprometidas de {fmtH(c.disponibles)}</div>
              </div>
            )
          })}
          <div className={`rounded-lg p-3 text-white ${pctTaller < 70 ? 'bg-green-600' : pctTaller <= 90 ? 'bg-yellow-600' : 'bg-red-600'}`}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold">Taller completo</span>
              <span className="text-sm font-bold">{pctTaller}%</span>
            </div>
            <div className="h-2 bg-white bg-opacity-30 rounded-full overflow-hidden">
              <div className="h-full bg-white" style={{ width: `${Math.min(100, pctTaller)}%` }} />
            </div>
            <div className="text-xs mt-1 opacity-90">{fmtH(totalComp)} de {fmtH(totalDisp)} {pctTaller > 90 ? '— ¡Sobrecarga! Considera subcontratar' : ''}</div>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">La carga incluye reservas tentativas de cotizaciones sin aprobar (vigentes según la validez configurada).</p>
      </div>

      {/* Órdenes sin programar */}
      {sinProgramar.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
          <h3 className="font-semibold text-amber-900 flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4" /> Órdenes activas sin programar ({sinProgramar.length})</h3>
          <div className="space-y-2">
            {sinProgramar.map(o => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-lg px-3 py-2 border border-amber-200">
                <div className="text-sm">
                  <span className="font-medium text-slate-800">{o.numero_orden}</span>
                  <span className="text-slate-600"> — {o.cliente}</span>
                  {o.prioridad === 1 && <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">VIP/Urgente</span>}
                  <span className="ml-2 text-xs text-slate-500">{o.estado}</span>
                </div>
                <button onClick={() => handleProgramar(o)} disabled={accionLoading} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                  <PlayCircle className="w-4 h-4" /> Programar ahora
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gantt por mecánico */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: 220 + dias.length * 130 }}>
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="sticky left-0 bg-slate-50 z-10 text-left px-4 py-3 text-sm font-medium text-slate-700" style={{ minWidth: 200 }}>Mecánico</th>
                  {dias.map(f => (
                    <th key={f} className={`px-2 py-3 text-center text-xs font-medium ${esFestivo(f) ? 'bg-red-50 text-red-600' : f === hoy() ? 'bg-blue-50 text-blue-700' : 'text-slate-600'}`}>
                      <div>{nombreDia(f)}</div>
                      <div className="font-semibold">{f.slice(8, 10)}/{f.slice(5, 7)}</div>
                      {esFestivo(f) && <div className="text-[10px]">Festivo</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {mecanicos.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="sticky left-0 bg-white z-10 px-4 py-3 text-sm font-medium text-slate-800 border-r border-slate-200">
                      {m.nombres} {m.apellidos}
                    </td>
                    {dias.map(f => {
                      const aus = ausenciaDe(m.id, f)
                      const sl = slotsDe(m.id, f)
                      return (
                        <td key={f} className={`px-1.5 py-2 align-top ${esFestivo(f) ? 'bg-red-50' : ''}`} style={{ minWidth: 130 }}>
                          {aus && !aus.parcial ? (
                            <div className="rounded-lg px-2 py-3 text-center text-[11px] text-red-700 font-medium border border-red-200" style={{ backgroundImage: 'repeating-linear-gradient(45deg,#fee2e2,#fee2e2 6px,#ffffff 6px,#ffffff 12px)' }}>
                              {aus.tipo.replace('_', ' ')}
                            </div>
                          ) : sl.length === 0 ? (
                            <div className="h-8" />
                          ) : (
                            <div className="space-y-1">
                              {sl.map(s => (
                                <button key={s.id} onClick={() => setModalSlot(s)} className={`w-full text-left rounded-lg border px-2 py-1 text-[11px] leading-tight hover:shadow transition ${colorSlot(s)}`} title={`${s.numero_orden} — ${s.cliente}`}>
                                  <div className="font-semibold">{fmtHora(s.hora_inicio)}–{fmtHora(s.hora_fin)}</div>
                                  <div className="truncate">{s.numero_orden}</div>
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="px-6 py-3 border-t border-slate-200 flex flex-wrap gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-200 border border-blue-400" /> Cliente normal</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-200 border border-purple-400" /> VIP / Urgente</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-200 border border-green-400" /> Interna</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-50 border border-dashed border-amber-400" /> Cotización sin aprobar</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded opacity-50 bg-blue-200 border border-blue-400" /> Completada</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-red-300" style={{ backgroundImage: 'repeating-linear-gradient(45deg,#fee2e2,#fee2e2 3px,#fff 3px,#fff 6px)' }} /> Ausencia</span>
        </div>
      </div>

      {/* Modal de slot */}
      {modalSlot && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-800">{modalSlot.esTentativa ? 'Reserva tentativa (cotización)' : 'Slot programado'}</h3>
              <button onClick={() => setModalSlot(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-2 text-sm text-slate-700">
              <div><span className="font-medium">{modalSlot.esTentativa ? 'Cotización:' : 'Orden:'}</span> {modalSlot.numero_orden}</div>
              <div><span className="font-medium">Cliente:</span> {modalSlot.cliente}</div>
              <div><span className="font-medium">Fecha:</span> {modalSlot.fecha} ({nombreDia(modalSlot.fecha)})</div>
              <div><span className="font-medium">Horario:</span> {fmtHora(modalSlot.hora_inicio)} – {fmtHora(modalSlot.hora_fin)} ({modalSlot.minutos} min)</div>
              {!modalSlot.esTentativa && (
                <div><span className="font-medium">Estado orden:</span> {modalSlot.estado_orden}</div>
              )}
              {modalSlot.esTentativa && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  Reserva de capacidad de una cotización sin aprobar. Se convierte en programación firme al aprobar la cotización; vence automáticamente según los días de validez configurados.
                </p>
              )}
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-2">
              {modalSlot.esTentativa ? (
                <button onClick={() => handleLiberarTentativa(modalSlot)} disabled={accionLoading} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 disabled:opacity-50">
                  <Trash2 className="w-4 h-4" /> Liberar reserva
                </button>
              ) : (
                <>
                  <button onClick={() => handleLiberar(modalSlot)} disabled={accionLoading} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 disabled:opacity-50">
                    <Trash2 className="w-4 h-4" /> Liberar
                  </button>
                  <button onClick={() => handleReprogramar(modalSlot)} disabled={accionLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50">
                    <RefreshCw className="w-4 h-4" /> Reprogramar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}