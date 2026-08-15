import { useAuth } from './contexts/AuthContext'
import { Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login'
import Layout from './components/Layout'
import Clientes from './pages/Clientes'

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center">Cargando sistema...</div>
  if (!user) return <Navigate to="/login" />
  return children
}

function App() {
  const { user } = useAuth()
  
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<h1 className="text-2xl font-bold text-slate-800">Dashboard (Próximamente)</h1>} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/bicicletas" element={<h1 className="text-2xl font-bold text-slate-800">Módulo de Bicicletas (Próximamente)</h1>} />
        <Route path="/ordenes" element={<h1 className="text-2xl font-bold text-slate-800">Módulo de Órdenes (Próximamente)</h1>} />
        <Route path="/inventario" element={<h1 className="text-2xl font-bold text-slate-800">Módulo de Inventario (Próximamente)</h1>} />
        <Route path="/mecanicos" element={<h1 className="text-2xl font-bold text-slate-800">Módulo de Mecánicos (Próximamente)</h1>} />
      </Route>
    </Routes>
  )
}

export default App