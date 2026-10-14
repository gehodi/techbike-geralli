import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Settings, CalendarDays, CalendarOff, UserX, Save, Plus, Trash2, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface HorarioRow {
  dia_semana: number
  laborable: boolean
  hora_apertura: string
  hora_cierre: string
  almuerzo_inicio: string
  almuerzo_fin: string
}
interface DiaNoLaborable { id: number; fecha: string; tipo: string; descripcion: string; recurrente_anual: boolean }
interface Ausencia {
  id: number
  mecanico_id: number
  mecanico_nombre?: string
  fecha_inicio: string
  fecha_fin: string
  tipo: string
  parcial: boolean
  horas_afectadas: number | null
  aprobada: boolean
  motivo: string
}
interface Config {
  minutos_buffer: number
  horizonte_dias: number
  umbral_sobrecarga: number
  minutos_verificacion_retorno: number
  auto_sugerir_subcontratacion: boolean
  dias_validez_promesa: number
}

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const TIPOS_DNL = ['festivo', 'cierre_taller', 'mantenimiento', 'otro']
const TIPOS_AUSENCIA = ['vacaciones', 'permiso', 'incapacidad', 'cita_personal', 'capacitacion']

export default function ConfiguracionTaller() {
  const [config, setConfig] = useState<Config>({
    minutos_buffer: 15, horizonte_dias: 30, umbral_sobrecarga: 90,
    minutos_verificacion_retorno: 30, auto_sugerir_subcontratacion: true, dias_validez_promesa: 7
  })
  const [horarios, setHorarios] = useState<HorarioRow[]>([])
  const [dnl, setDnl] = useState<DiaNoLaborable[]>([])
  const [ausencias, setAusencias] = useState<Ausencia[]>([])
  const [mecanicos, setMecanicos] = useState<{ id: number; nombres: string; apellidos: string }[]>([])
  const [newDnl, setNewDnl] = useState({ fecha: '', tipo: 'festivo', descripcion: '', recurrente_anual: false })
  const [newAus, setNewAus] = useState({
    mecanico_id: '', fecha_inicio: '', fecha_fin: '', tipo: 'vacaciones',
    parcial: false, horas_afectadas: '', motivo: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const { data: cfg } = await supabase.from('taller_configuracion').select('*').eq('id', 1).single()
    if (cfg) setConfig({
      minutos_buffer: cfg.minutos_buffer, horizonte_dias: cfg.horizonte_dias,
      umbral_sobrecarga: cfg.umbral_sobrecarga, minutos_verificacion_retorno: cfg.minutos_verificacion_retorno,
      auto_sugerir_subcontratacion: cfg.auto_sugerir_subcontratacion,
      dias_validez_promesa: cfg.dias_validez_promesa ?? 7
    })
    const { data: hor } = await supabase.from('taller_horarios').select('*').order('dia_semana')
    setHorarios((hor || []).map((h: any) => ({
      dia_semana: h.dia_semana,
      laborable: h.laborable,
      hora_apertura: (h.hora_apertura || '').slice(0, 5),
      hora_cierre: (h.hora_cierre || '').slice(0, 5),
      almuerzo_inicio: (h.almuerzo_inicio || '').slice(0, 5),
      almuerzo_fin: (h.almuerzo_fin || '').slice(0, 5)
    })))
    const { data: d } = await supabase.from('dias_no_laborables').select('*').order('fecha')
    setDnl(d || [])
    const { data: a } = await supabase.from('ausencias_mecanico').select('*, mecanicos(nombres, apellidos)').order('fecha_inicio', { ascending: false })
    setAusencias((a || []).map((x: any) => ({ ...x, mecanico_nombre: x.mecanicos ? `${x.mecanicos.nombres} ${x.mecanicos.apellidos}` : '—' })))
    const { data: m } = await supabase.from('mecanicos').select('id, nombres, apellidos').order('apellidos')
    setMecanicos(m || [])
  }

  async function saveConfig() {
    setSaving(true)
    const { error } = await supabase.from('taller_configuracion').update({
      minutos_buffer: config.minutos_buffer,
      horizonte_dias: config.horizonte_dias,
      umbral_sobrecarga: config.umbral_sobrecarga,
      minutos_verificacion_retorno: config.minutos_verificacion_retorno,
      auto_sugerir_subcontratacion: config.auto_sugerir_subcontratacion,
      dias_validez_promesa: config.dias_validez_promesa
    }).eq('id', 1)
    setSaving(false)
    if (error) { toast.error('Error: ' + error.message); return }
    toast.success('Parámetros guardados')
  }

  async function saveHorarios() {
    for (const h of horarios) {
      if (!h.laborable) continue
      if (!h.hora_apertura || !h.hora_cierre || h.hora_apertura >= h.hora_cierre) {
        toast.error(`${DIAS[h.dia_semana - 1]}: horario de apertura/cierre inválido`)
        return
      }
      const tieneAlmuerzo = h.almuerzo_inicio || h.almuerzo_fin
      if (tieneAlmuerzo && (!h.almuerzo_inicio || !h.almuerzo_fin || h.almuerzo_inicio >= h.almuerzo_fin)) {
        toast.error(`${DIAS[h.dia_semana - 1]}: almuerzo incompleto o inválido (déjalo vacío o completa ambos)`)
        return
      }
    }
    setSaving(true)
    const rows = horarios.map(h => ({
      dia_semana: h.dia_semana,
      laborable: h.laborable,
      hora_apertura: h.laborable ? h.hora_apertura : null,
      hora_cierre: h.laborable ? h.hora_cierre : null,
      almuerzo_inicio: h.laborable && h.almuerzo_inicio ? h.almuerzo_inicio : null,
      almuerzo_fin: h.laborable && h.almuerzo_fin ? h.almuerzo_fin : null
    }))
    const { error } = await supabase.from('taller_horarios').upsert(rows, { onConflict: 'dia_semana' })
    setSaving(false)
    if (error) { toast.error('Error: ' + error.message); return }
    toast.success('Horario semanal guardado')
  }

  async function addDnl() {
    if (!newDnl.fecha) { toast.error('Selecciona la fecha'); return }
    const { error } = await supabase.from('dias_no_laborables').insert({
      fecha: newDnl.fecha, tipo: newDnl.tipo,
      descripcion: newDnl.descripcion || null, recurrente_anual: newDnl.recurrente_anual
    })
    if (error) { toast.error('Error: ' + error.message); return }
    toast.success('Día no laborable registrado')
    setNewDnl({ fecha: '', tipo: 'festivo', descripcion: '', recurrente_anual: false })
    fetchAll()
  }

  async function deleteDnl(id: number) {
    if (!confirm('¿Eliminar este día no laborable?')) return
    await supabase.from('dias_no_laborables').delete().eq('id', id)
    toast.success('Eliminado')
    fetchAll()
  }

  async function addAusencia() {
    if (!newAus.mecanico_id || !newAus.fecha_inicio || !newAus.fecha_fin) {
      toast.error('Mecánico y fechas son obligatorios')
      return
    }
    if (newAus.fecha_fin < newAus.fecha_inicio) { toast.error('Fecha fin anterior a inicio'); return }
    if (newAus.parcial && (!newAus.horas_afectadas || parseFloat(newAus.horas_afectadas) <= 0)) {
      toast.error('Indica las horas afectadas del día')
      return
    }
    const { error } = await supabase.from('ausencias_mecanico').insert({
      mecanico_id: parseInt(newAus.mecanico_id),
      fecha_inicio: newAus.fecha_inicio,
      fecha_fin: newAus.fecha_fin,
      tipo: newAus.tipo,
      parcial: newAus.parcial,
      horas_afectadas: newAus.parcial ? parseFloat(newAus.horas_afectadas) : null,
      motivo: newAus.motivo || null,
      aprobada: false
    })
    if (error) { toast.error('Error: ' + error.message); return }
    toast.success('Ausencia registrada (pendiente de aprobación)')
    setNewAus({ mecanico_id: '', fecha_inicio: '', fecha_fin: '', tipo: 'vacaciones', parcial: false, horas_afectadas: '', motivo: '' })
    fetchAll()
  }

  async function toggleAprobada(a: Ausencia) {
    await supabase.from('ausencias_mecanico').update({ aprobada: !a.aprobada }).eq('id', a.id)
    toast.success(a.aprobada ? 'Ausencia revocada' : 'Ausencia aprobada')
    fetchAll()
  }

  async function deleteAusencia(id: number) {
    if (!confirm('¿Eliminar esta ausencia?')) return
    await supabase.from('ausencias_mecanico').delete().eq('id', id)
    toast.success('Eliminada')
    fetchAll()
  }

  const setHor = (i: number, campo: keyof HorarioRow, valor: any) => {
    const copy = [...horarios]
    ;(copy[i] as any)[campo] = valor
    setHorarios(copy)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Settings className="w-6 h-6 text-blue-600" /> Configuración del Taller</h1>
        <p className="text-slate-500 mt-1">Parámetros del planificador, horario semanal, festivos y ausencias</p>
      </div>

      {/* Parámetros globales */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-800 mb-4">Parámetros del planificador</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Buffer entre órdenes (min)</label>
            <input type="number" min="0" value={config.minutos_buffer} onChange={(e) => setConfig({ ...config, minutos_buffer: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Horizonte de programación (días)</label>
            <input type="number" min="1" value={config.horizonte_dias} onChange={(e) => setConfig({ ...config, horizonte_dias: parseInt(e.target.value) || 30 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Umbral sobrecarga (%)</label>
            <input type="number" min="50" max="100" value={config.umbral_sobrecarga} onChange={(e) => setConfig({ ...config, umbral_sobrecarga: parseInt(e.target.value) || 90 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Verificación retorno (min)</label>
            <input type="number" min="0" value={config.minutos_verificacion_retorno} onChange={(e) => setConfig({ ...config, minutos_verificacion_retorno: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          {/* ✅ NUEVO: validez de la promesa en cotizaciones */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Validez promesa cotización (días)</label>
            <input type="number" min="1" max="90" value={config.dias_validez_promesa} onChange={(e) => setConfig({ ...config, dias_validez_promesa: parseInt(e.target.value) || 7 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            <p className="text-xs text-slate-500 mt-1">Días que una cotización sin aprobar reserva capacidad antes de vencerse.</p>
          </div>
        </div>
        <label className="flex items-center gap-2 mt-4 text-sm text-slate-700">
          <input type="checkbox" checked={config.auto_sugerir_subcontratacion} onChange={(e) => setConfig({ ...config, auto_sugerir_subcontratacion: e.target.checked })} className="w-4 h-4" />
          Sugerir subcontratación automática cuando el taller esté saturado
        </label>
        <div className="flex justify-end mt-4">
          <button onClick={saveConfig} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50">
            <Save className="w-4 h-4" /> Guardar parámetros
          </button>
        </div>
      </div>

      {/* Horario semanal */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Horario semanal (variable por día)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Día</th>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Laborable</th>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Apertura</th>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Cierre</th>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Almuerzo inicio</th>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Almuerzo fin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {horarios.map((h, i) => (
                <tr key={h.dia_semana}>
                  <td className="px-4 py-2 font-medium text-slate-800">{DIAS[h.dia_semana - 1]}</td>
                  <td className="px-4 py-2"><input type="checkbox" checked={h.laborable} onChange={(e) => setHor(i, 'laborable', e.target.checked)} className="w-4 h-4" /></td>
                  <td className="px-4 py-2"><input type="time" disabled={!h.laborable} value={h.hora_apertura} onChange={(e) => setHor(i, 'hora_apertura', e.target.value)} className="px-2 py-1 border border-slate-300 rounded disabled:bg-slate-100 disabled:text-slate-400" /></td>
                  <td className="px-4 py-2"><input type="time" disabled={!h.laborable} value={h.hora_cierre} onChange={(e) => setHor(i, 'hora_cierre', e.target.value)} className="px-2 py-1 border border-slate-300 rounded disabled:bg-slate-100 disabled:text-slate-400" /></td>
                  <td className="px-4 py-2"><input type="time" disabled={!h.laborable} value={h.almuerzo_inicio} onChange={(e) => setHor(i, 'almuerzo_inicio', e.target.value)} className="px-2 py-1 border border-slate-300 rounded disabled:bg-slate-100 disabled:text-slate-400" /></td>
                  <td className="px-4 py-2"><input type="time" disabled={!h.laborable} value={h.almuerzo_fin} onChange={(e) => setHor(i, 'almuerzo_fin', e.target.value)} className="px-2 py-1 border border-slate-300 rounded disabled:bg-slate-100 disabled:text-slate-400" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={saveHorarios} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50">
            <Save className="w-4 h-4" /> Guardar horario
          </button>
        </div>
      </div>

      {/* Días no laborables */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><CalendarOff className="w-4 h-4" /> Días no laborables (festivos y cierres)</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
          <input type="date" value={newDnl.fecha} onChange={(e) => setNewDnl({ ...newDnl, fecha: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          <select value={newDnl.tipo} onChange={(e) => setNewDnl({ ...newDnl, tipo: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
            {TIPOS_DNL.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
          <input type="text" placeholder="Descripción (ej. Navidad)" value={newDnl.descripcion} onChange={(e) => setNewDnl({ ...newDnl, descripcion: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={newDnl.recurrente_anual} onChange={(e) => setNewDnl({ ...newDnl, recurrente_anual: e.target.checked })} className="w-4 h-4" />
            Recurrente cada año
          </label>
          <button onClick={addDnl} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </div>
        <div className="space-y-2">
          {dnl.length === 0 && <p className="text-sm text-slate-500">Sin días no laborables registrados.</p>}
          {dnl.map(d => (
            <div key={d.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-200 text-sm">
              <span><strong>{d.fecha}</strong> — {d.tipo.replace('_', ' ')} {d.descripcion && `· ${d.descripcion}`} {d.recurrente_anual && <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">anual</span>}</span>
              <button onClick={() => deleteDnl(d.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Ausencias */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><UserX className="w-4 h-4" /> Ausencias de mecánicos (vacaciones, permisos, incapacidades)</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-2">
          <select value={newAus.mecanico_id} onChange={(e) => setNewAus({ ...newAus, mecanico_id: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
            <option value="">Mecánico...</option>
            {mecanicos.map(m => <option key={m.id} value={m.id}>{m.nombres} {m.apellidos}</option>)}
          </select>
          <input type="date" value={newAus.fecha_inicio} onChange={(e) => setNewAus({ ...newAus, fecha_inicio: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          <input type="date" value={newAus.fecha_fin} onChange={(e) => setNewAus({ ...newAus, fecha_fin: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          <select value={newAus.tipo} onChange={(e) => setNewAus({ ...newAus, tipo: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
            {TIPOS_AUSENCIA.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={newAus.parcial} onChange={(e) => setNewAus({ ...newAus, parcial: e.target.checked })} className="w-4 h-4" />
            Día parcial (blokea mañana)
          </label>
          {newAus.parcial && (
            <input type="number" min="1" max="8" step="0.5" placeholder="Horas afectadas" value={newAus.horas_afectadas} onChange={(e) => setNewAus({ ...newAus, horas_afectadas: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          )}
          <input type="text" placeholder="Motivo" value={newAus.motivo} onChange={(e) => setNewAus({ ...newAus, motivo: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          <button onClick={addAusencia} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Registrar ausencia
          </button>
        </div>
        <div className="space-y-2">
          {ausencias.length === 0 && <p className="text-sm text-slate-500">Sin ausencias registradas.</p>}
          {ausencias.map(a => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200 text-sm">
              <span>
                <strong>{a.mecanico_nombre}</strong> · {a.fecha_inicio} → {a.fecha_fin} · {a.tipo.replace('_', ' ')}
                {a.parcial && ` · parcial (${a.horas_afectadas}h)`}
                {a.motivo && ` · ${a.motivo}`}
              </span>
              <div className="flex items-center gap-2">
                {a.aprobada ? (
                  <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Aprobada</span>
                ) : (
                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">Pendiente</span>
                )}
                <button onClick={() => toggleAprobada(a)} className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded text-xs font-medium">
                  {a.aprobada ? 'Revocar' : 'Aprobar'}
                </button>
                <button onClick={() => deleteAusencia(a.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}