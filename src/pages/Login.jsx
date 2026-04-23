import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export default function Login() {
  const [modo, setModo] = useState('login') // 'login' | 'registro'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [rol, setRol] = useState('recepcionista')
  const [sedeId, setSedeId] = useState('a1111111-1111-1111-1111-111111111111')
  const [loading, setLoading] = useState(false)
  const { login, registrar } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (modo === 'login') {
        await login(email, password)
        toast.success('Bienvenido a TechClick')
        navigate('/')
      } else {
        await registrar(email, password, { nombre, apellido, rol, sede_id: sedeId })
        toast.success('Cuenta creada. Inicia sesión.')
        setModo('login')
      }
    } catch (err) {
      toast.error(err.message || 'Error de autenticación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 via-primary-600 to-primary-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl backdrop-blur mb-4">
            <span className="text-3xl">⚡</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">TechClick</h1>
          <p className="text-primary-200 mt-1">Sistema de Gestión de Servicios IT</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            {modo === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {modo === 'registro' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                    <input type="text" required value={nombre} onChange={e => setNombre(e.target.value)}
                      className="input-field" placeholder="Juan" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
                    <input type="text" required value={apellido} onChange={e => setApellido(e.target.value)}
                      className="input-field" placeholder="Pérez" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                  <select value={rol} onChange={e => setRol(e.target.value)} className="input-field">
                    <option value="recepcionista">Recepcionista</option>
                    <option value="tecnico">Técnico de Hardware</option>
                    <option value="jefe_it">Jefe de Servicio IT</option>
                    <option value="control_garantias">Control de Garantías</option>
                    <option value="soporte_sla">Soporte SLA</option>
                    <option value="bodega">Bodega</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sede</label>
                  <select value={sedeId} onChange={e => setSedeId(e.target.value)} className="input-field">
                    <option value="a1111111-1111-1111-1111-111111111111">Región Central — Guatemala</option>
                    <option value="b2222222-2222-2222-2222-222222222222">Región Occidente — Quetzaltenango</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="input-field" placeholder="usuario@techclick.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
                className="input-field" placeholder="••••••••" />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
              {loading ? 'Procesando...' : modo === 'login' ? 'Ingresar' : 'Crear Cuenta'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={() => setModo(modo === 'login' ? 'registro' : 'login')}
              className="text-sm text-primary-500 hover:text-primary-600 font-medium">
              {modo === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
            </button>
          </div>
        </div>

        <p className="text-center text-primary-200 text-xs mt-6">
          TechClick Corporación © 2025 — Proyecto Administración de Tecnologías
        </p>
      </div>
    </div>
  )
}
