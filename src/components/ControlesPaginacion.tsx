import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

interface ControlesPaginacionProps {
  paginaActual: number
  totalRegistros: number
  registrosPorPagina: number
  onPageChange: (pagina: number) => void
  onRegistrosPorPaginaChange: (cantidad: number) => void
}

export default function ControlesPaginacion({
  paginaActual,
  totalRegistros,
  registrosPorPagina,
  onPageChange,
  onRegistrosPorPaginaChange
}: ControlesPaginacionProps) {
  const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina)

  if (totalRegistros === 0) return null

  return (
    <div className="bg-white px-6 py-4 border-t border-slate-200">
      <div className="flex items-center justify-between">
        {/* Información de registros */}
        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-600">
            Mostrando{' '}
            <span className="font-medium text-slate-900">
              {Math.min((paginaActual - 1) * registrosPorPagina + 1, totalRegistros)}
            </span>{' '}
            a{' '}
            <span className="font-medium text-slate-900">
              {Math.min(paginaActual * registrosPorPagina, totalRegistros)}
            </span>{' '}
            de{' '}
            <span className="font-medium text-slate-900">{totalRegistros}</span>{' '}
            registros
          </div>

          {/* Selector de registros por página */}
          <select
            value={registrosPorPagina}
            onChange={(e) => onRegistrosPorPaginaChange(parseInt(e.target.value))}
            className="px-3 py-1 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value={10}>10 por página</option>
            <option value={25}>25 por página</option>
            <option value={50}>50 por página</option>
            <option value={100}>100 por página</option>
          </select>
        </div>

        {/* Controles de navegación */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(1)}
            disabled={paginaActual === 1}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
            title="Primera página"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>

          <button
            onClick={() => onPageChange(paginaActual - 1)}
            disabled={paginaActual === 1}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
            title="Página anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="px-4 py-2 text-sm font-medium text-slate-700">
            Página {paginaActual} de {totalPaginas}
          </span>

          <button
            onClick={() => onPageChange(paginaActual + 1)}
            disabled={paginaActual === totalPaginas}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
            title="Página siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => onPageChange(totalPaginas)}
            disabled={paginaActual === totalPaginas}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
            title="Última página"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}