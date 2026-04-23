import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from './contexts/AuthContext'
import { tieneAccesoModulo } from './utils/bpmEngine'
import { Toaster } from 'react-hot-toast'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import OrdenesTrabajo from './pages/OrdenesTrabajo'
import NuevaOrden from './pages/NuevaOrden'
import DetalleOrden from './pages/DetalleOrden'
import Clientes from './pages/Clientes'
import Inventario from './pages/Inventario'
import Garantias from './pages/Garantias'
import Usuarios from './pages/Usuarios'

function ProtectedRoute({ children, modulo }) {
  const { isAuthenticated, loading, usuario } = useAuth()
  if (loading) return <LoadingScreen />
  if (!isAuthenticated) return <Navigate to="/login" />
  // Si se especifica un módulo, verificar acceso por rol
  if (modulo && usuario && !tieneAccesoModulo(usuario.rol, modulo)) {
    return <Navigate to="/" />
  }
  return children
}

function LoadingScreen() {
  return (
    <div className="h-screen flex items-center justify-center bg-primary-500">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-white text-lg">Cargando TechClick...</p>
      </div>
    </div>
  )
}

// modulo: clave usada en MODULOS_POR_ROL del bpmEngine
const navItems = [
  { to: '/',           icon: '📊', label: 'Dashboard',           modulo: 'dashboard'  },
  { to: '/ordenes',    icon: '📋', label: 'Órdenes de Trabajo',   modulo: 'ordenes'    },
  { to: '/clientes',   icon: '👥', label: 'Clientes',             modulo: 'clientes'   },
  { to: '/inventario', icon: '📦', label: 'Inventario',           modulo: 'inventario' },
  { to: '/garantias',  icon: '🛡️', label: 'Garantías',            modulo: 'garantias'  },
  { to: '/usuarios',   icon: '⚙️', label: 'Usuarios',             modulo: 'usuarios'   },
]

const ROL_LABEL = {
  admin:             'Administrador',
  recepcionista:     'Recepcionista',
  tecnico:           'Técnico de Hardware',
  jefe_it:           'Jefe de Servicio IT',
  control_garantias: 'Control de Garantías',
  soporte_sla:       'Soporte SLA',
  bodega:            'Bodega',
}

// Badge de color por rol para el sidebar
const ROL_COLOR = {
  admin:             'bg-red-500/20 text-red-200',
  jefe_it:           'bg-purple-500/20 text-purple-200',
  recepcionista:     'bg-blue-500/20 text-blue-200',
  tecnico:           'bg-green-500/20 text-green-200',
  bodega:            'bg-orange-500/20 text-orange-200',
  control_garantias: 'bg-teal-500/20 text-teal-200',
  soporte_sla:       'bg-yellow-500/20 text-yellow-200',
}

function Layout({ children }) {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  // Filtrar nav items según el rol del usuario actual
  const itemsVisibles = navItems.filter(item =>
    usuario ? tieneAccesoModulo(usuario.rol, item.modulo) : false
  )

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-primary-500 text-white transform transition-transform lg:transform-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} flex flex-col`}>
        <div className="p-5 border-b border-primary-400">
          <h1 className="text-xl font-bold tracking-tight">⚡ TechClick</h1>
          <p className="text-primary-200 text-xs mt-1">Sistema de Servicios IT</p>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {itemsVisibles.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                  isActive
                    ? 'bg-primary-600 border-r-4 border-accent-500 text-white'
                    : 'text-primary-100 hover:bg-primary-600/50 hover:text-white'
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-primary-400">
          <div className="text-sm font-medium">{usuario?.nombre} {usuario?.apellido}</div>
          <span className={`inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${ROL_COLOR[usuario?.rol] || 'bg-white/10 text-white'}`}>
            {ROL_LABEL[usuario?.rol] || usuario?.rol}
          </span>
          <div className="text-primary-300 text-xs mt-1">{usuario?.sede?.nombre}</div>
          <button onClick={handleLogout} className="mt-3 text-xs text-primary-200 hover:text-white transition-colors">
            Cerrar sesión →
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 lg:px-6">
          <button className="lg:hidden text-gray-600" onClick={() => setSidebarOpen(true)}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex-1">
            <span className="text-sm text-gray-500">
              {usuario?.sede?.nombre} — {usuario?.sede?.ciudad}
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  const { loading } = useAuth()

  if (loading) return <LoadingScreen />

  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute modulo="dashboard"><Layout><Dashboard /></Layout></ProtectedRoute>} />
        <Route path="/ordenes" element={<ProtectedRoute modulo="ordenes"><Layout><OrdenesTrabajo /></Layout></ProtectedRoute>} />
        <Route path="/ordenes/nueva" element={<ProtectedRoute modulo="ordenes"><Layout><NuevaOrden /></Layout></ProtectedRoute>} />
        <Route path="/ordenes/:id" element={<ProtectedRoute modulo="ordenes"><Layout><DetalleOrden /></Layout></ProtectedRoute>} />
        <Route path="/clientes" element={<ProtectedRoute modulo="clientes"><Layout><Clientes /></Layout></ProtectedRoute>} />
        <Route path="/inventario" element={<ProtectedRoute modulo="inventario"><Layout><Inventario /></Layout></ProtectedRoute>} />
        <Route path="/garantias" element={<ProtectedRoute modulo="garantias"><Layout><Garantias /></Layout></ProtectedRoute>} />
        <Route path="/usuarios" element={<ProtectedRoute modulo="usuarios"><Layout><Usuarios /></Layout></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  )
}