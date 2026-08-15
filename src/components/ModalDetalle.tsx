import { X } from 'lucide-react'

interface Campo {
  label: string
  value: string | number | null | undefined
  tipo?: 'texto' | 'moneda' | 'fecha' | 'estado' | 'imagen'
}

interface ModalDetalleProps {
  titulo: string
  campos: Campo[]
  onClose: () => void
}

export default function ModalDetalle({ titulo, campos, onClose }: ModalDetalleProps) {
  const formatearValor = (campo: Campo) => {
    if (campo.value === null || campo.value === undefined || campo.value === '') return '-'

    // NUEVO: Soporte para imágenes
    if (campo.tipo === 'imagen' && typeof campo.value === 'string') {
      return (
        <div className="space-y-2">
          <img
            src={campo.value}
            alt={campo.label}
            className="max-w-full h-auto max-h-80 rounded-lg border border-slate-200 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(campo.value as string, '_blank')}
          />
          <p className="text-xs text-slate-500 text-center">
            Clic en la imagen para abrir en tamaño completo
          </p>
        </div>
      )
    }

    if (campo.tipo === 'moneda' && typeof campo.value === 'number') {
      return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(campo.value)
    }
    if (campo.tipo === 'fecha' && typeof campo.value === 'string') {
      return new Date(campo.value).toLocaleDateString('es-CO')
    }
    if (campo.tipo === 'estado') {
      const colores: Record<string, string> = {
        'Pendiente': 'bg-yellow-100 text-yellow-800',
        'Cotizada': 'bg-blue-100 text-blue-800',
        'Aprobada': 'bg-green-100 text-green-800',
        'Rechazada': 'bg-red-100 text-red-800',
        'En proceso': 'bg-blue-100 text-blue-800',
        'Completada': 'bg-green-100 text-green-800',
        'Entregada': 'bg-purple-100 text-purple-800',
        'Cancelada': 'bg-red-100 text-red-800',
        'Activo': 'bg-green-100 text-green-800',
        'Inactivo': 'bg-red-100 text-red-800',
        'Vacaciones': 'bg-blue-100 text-blue-800',
        'Disponible': 'bg-green-100 text-green-800',
        'Stock Bajo': 'bg-yellow-100 text-yellow-800',
        'Agotado': 'bg-red-100 text-red-800'
      }
      const color = colores[campo.value as string] || 'bg-gray-100 text-gray-800'
      return <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>{campo.value}</span>
    }
    return String(campo.value)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-800">{titulo}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campos.map((campo, idx) => (
              <div
                key={idx}
                className={
                  (campo.tipo === 'texto' && String(campo.value).length > 50) ||
                  campo.tipo === 'imagen'
                    ? 'md:col-span-2'
                    : ''
                }
              >
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                  {campo.label}
                </label>
                <div className={`text-sm text-slate-900 bg-slate-50 p-2 rounded border border-slate-200 min-h-[36px] ${
                  campo.tipo === 'imagen' ? 'bg-white border-dashed' : ''
                }`}>
                  {formatearValor(campo)}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}