import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { AlertTriangle, TrendingDown, Package, ShoppingCart } from 'lucide-react'
import toast from 'react-hot-toast'

interface ItemBajoStock {
  id: number
  nombre: string
  codigo: string
  stock_actual: number
  stock_reservado: number
  stock_minimo: number
  precio_compra: number
  disponible: number
}

export default function AlertasStock() {
  const navigate = useNavigate()
  const [itemsBajos, setItemsBajos] = useState<ItemBajoStock[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchItemsBajos()
  }, [])

  async function fetchItemsBajos() {
    try {
      const { data, error } = await supabase
        .from('inventario')
        .select('id, nombre, codigo, stock_actual, stock_reservado, stock_minimo, precio_compra')
        .eq('estado', 'disponible')
      
      if (error) throw error
      
      const bajos = (data || [])
        .map((i: any) => ({
          ...i,
          disponible: i.stock_actual - (i.stock_reservado || 0)
        }))
        .filter((i: ItemBajoStock) => i.disponible <= i.stock_minimo)
        .sort((a: ItemBajoStock, b: ItemBajoStock) => a.disponible - b.disponible)
      
      setItemsBajos(bajos)
    } catch (error: any) {
      console.error('Error cargando alertas:', error)
    } finally {
      setLoading(false)
    }
  }

  function crearRequisicion(item: ItemBajoStock) {
    const cantidadSugerida = Math.max(item.stock_minimo * 2, 10)
    navigate('/requisiciones', { 
      state: { 
        itemPreseleccionado: item.id,
        tipoSolicitud: 'reposicion',
        cantidadSugerida: cantidadSugerida,
        motivo: `Stock bajo: ${item.disponible} disponibles (mínimo: ${item.stock_minimo})`
      } 
    })
  }

  if (loading) return <div className="p-4 text-center text-slate-500">Cargando alertas...</div>

  if (itemsBajos.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
        <Package className="w-12 h-12 text-green-600 mx-auto mb-2" />
        <h3 className="font-semibold text-green-800">Todo en orden</h3>
        <p className="text-sm text-green-600 mt-1">No hay items con stock bajo</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
      <div className="bg-red-50 px-6 py-4 border-b border-red-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <h3 className="font-semibold text-red-800">Alertas de Stock Bajo</h3>
        </div>
        <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold">
          {itemsBajos.length}
        </span>
      </div>
      <div className="divide-y divide-slate-200 max-h-96 overflow-y-auto">
        {itemsBajos.map((item) => {
          const nivel = item.disponible === 0 ? 'crítico' : item.disponible <= item.stock_minimo / 2 ? 'alto' : 'moderado'
          const colorNivel = nivel === 'crítico' ? 'bg-red-100 text-red-800' : nivel === 'alto' ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800'
          
          return (
            <div key={item.id} className="p-4 hover:bg-slate-50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-slate-900">{item.nombre}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorNivel}`}>
                      {nivel.toUpperCase()}
                    </span>
                  </div>
                  {item.codigo && <div className="text-xs text-slate-500 font-mono mb-2">{item.codigo}</div>}
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <div className="text-slate-500">Disponible</div>
                      <div className={`font-bold ${item.disponible === 0 ? 'text-red-600' : 'text-slate-900'}`}>
                        {item.disponible}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Reservado</div>
                      <div className="font-medium text-orange-600">{item.stock_reservado || 0}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Mínimo</div>
                      <div className="font-medium text-slate-900">{item.stock_minimo}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">P. Compra</div>
                      <div className="font-medium text-slate-900">
                        ${new Intl.NumberFormat('es-CO').format(item.precio_compra || 0)}
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => crearRequisicion(item)}
                  className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium whitespace-nowrap"
                  title="Crear requisición de reposición"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Reponer
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}