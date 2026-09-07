import React from 'react'
import { useAuth } from './contexts/AuthContext'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Login from './pages/Login'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import Bicicletas from './pages/Bicicletas'
import Mecanicos from './pages/Mecanicos'
import Solicitudes from './pages/Solicitudes'
import Cotizaciones from './pages/Cotizaciones'
import Ordenes from './pages/Ordenes'
import OrdenesInternas from './pages/OrdenesInternas'
import DetalleOrdenCompletada from './pages/DetalleOrdenCompletada'
import Inventario from './pages/Inventario'
import Requisiciones from './pages/Requisiciones'
import HistorialInventario from './pages/HistorialInventario'
import Categorias from './pages/Categorias'
import Marcas from './pages/Marcas'
import Proveedores from './pages/Proveedores'
import ProveedoresBicicletasUsadas from './pages/ProveedoresBicicletasUsadas'
import TiposBicicletas from './pages/TiposBicicletas'
import Servicios from './pages/Servicios'
import RegistroDanos from './pages/RegistroDanos'
import Reportes from './pages/Reportes'
import BicicletasUsadas from './pages/BicicletasUsadas'
import VentasBicicletas from './pages/VentasBicicletas'
import Garantias from './pages/Garantias'
import ReclamacionesGarantia from './pages/ReclamacionesGarantia'
import CertificadoReacondicionamiento from './pages/CertificadoReacondicionamiento'
import ComprobanteVenta from './pages/ComprobanteVenta'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center">Cargando sistema...</div>
  if (!user) return <Navigate to="/login" />
  return children
}

function App() {
  const { user } = useAuth()

  if (!user) {
    return (
      <>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </>
    )
  }

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: '#1e293b',
            color: '#f8fafc',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#fff' },
          },
        }}
      />
      <Routes>
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/bicicletas" element={<Bicicletas />} />
          <Route path="/mecanicos" element={<Mecanicos />} />
          <Route path="/solicitudes" element={<Solicitudes />} />
          <Route path="/cotizaciones" element={<Cotizaciones />} />
          <Route path="/ordenes" element={<Ordenes />} />
          <Route path="/ordenes-internas" element={<OrdenesInternas />} />
          <Route path="/orden-completada/:id" element={<DetalleOrdenCompletada />} />
          <Route path="/inventario" element={<Inventario />} />
          <Route path="/requisiciones" element={<Requisiciones />} />
          <Route path="/historial-inventario" element={<HistorialInventario />} />
          <Route path="/categorias" element={<Categorias />} />
          <Route path="/marcas" element={<Marcas />} />
          <Route path="/proveedores" element={<Proveedores />} />
          <Route path="/proveedores-bicicletas-usadas" element={<ProveedoresBicicletasUsadas />} />
          <Route path="/tipos-bicicletas" element={<TiposBicicletas />} />
          <Route path="/servicios" element={<Servicios />} />
          <Route path="/registro-danos" element={<RegistroDanos />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route path="/bicicletas-usadas" element={<BicicletasUsadas />} />
          <Route path="/ventas-bicicletas" element={<VentasBicicletas />} />
          <Route path="/garantias" element={<Garantias />} />
          <Route path="/reclamaciones-garantia" element={<ReclamacionesGarantia />} />
        </Route>
        {/* Rutas fuera del Layout para impresión limpia */}
        <Route path="/certificado-reacondicionamiento/:id" element={<CertificadoReacondicionamiento />} />
        <Route path="/comprobante-venta/:id" element={<ComprobanteVenta />} />
      </Routes>
    </>
  )
}

export default App