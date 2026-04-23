import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'jefe_it', label: 'Jefe de Servicio IT' },
  { value: 'recepcionista', label: 'Recepcionista' },
  { value: 'tecnico', label: 'Técnico de Hardware' },
  { value: 'control_garantias', label: 'Control de Garantías' },
  { value: 'soporte_sla', label: 'Soporte SLA' },
  { value: 'bodega', label: 'Bodega' },
]

export default function Usuarios() {
  const { usuario: currentUser, registrar } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', password: '', rol: 'tecnico', sede_id: 'a1111111-1111-1111-1111-111111111111' })

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('usuario').select('*, sede:sede_id(nombre)').order('nombre')
    setUsuarios(data || [])
    setLoading(false)
  }

  async function crearUsuario() {
    try {
      await registrar(form.email, form.password, {
        nombre: form.nombre,
        apellido: form.apellido,
        rol: form.rol,
        sede_id: form.sede_id,
      })
      toast.success('Usuario creado exitosamente')
      setShowForm(false)
      setForm({ nombre: '', apellido: '', email: '', password: '', rol: 'tecnico', sede_id: 'a1111111-1111-1111-1111-111111111111' })
      cargar()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  async function toggleActivo(u) {
    try {
      await supabase.from('usuario').update({ activo: !u.activo }).eq('id', u.id)
      toast.success(u.activo ? 'Usuario desactivado' : 'Usuario activado')
      cargar()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h1>
          <p className="text-sm text-gray-500">Administrar usuarios, roles y accesos del sistema</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary self-start">+ Nuevo Usuario</button>
      </div>

      {showForm && (
        <div className="card mb-6 border-2 border-primary-200">
          <h2 className="text-lg font-semibold mb-4">Nuevo Usuario</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input required value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apellido *</label>
              <input required value={form.apellido} onChange={e => setForm(p => ({ ...p, apellido: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input type="email" required value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label>
              <input type="password" required minLength={6} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol *</label>
              <select value={form.rol} onChange={e => setForm(p => ({ ...p, rol: e.target.value }))} className="input-field">
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sede *</label>
              <select value={form.sede_id} onChange={e => setForm(p => ({ ...p, sede_id: e.target.value }))} className="input-field">
                <option value="a1111111-1111-1111-1111-111111111111">Región Central — Guatemala</option>
                <option value="b2222222-2222-2222-2222-222222222222">Región Occidente — Quetzaltenango</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 justify-end mt-4">
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
            <button onClick={crearUsuario} className="btn-primary" disabled={!form.nombre || !form.email || !form.password}>Crear Usuario</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full bg-white rounded-xl shadow-sm border border-gray-100">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Nombre</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Email</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Rol</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Sede</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Estado</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuarios.map(u => (
                <tr key={u.id} className={`hover:bg-gray-50 ${!u.activo ? 'opacity-50' : ''}`}>
                  <td className="py-3 px-4 text-sm font-medium">{u.nombre} {u.apellido}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{u.email}</td>
                  <td className="py-3 px-4"><span className="badge bg-primary-100 text-primary-700">{ROLES.find(r => r.value === u.rol)?.label || u.rol}</span></td>
                  <td className="py-3 px-4 text-sm text-gray-500">{u.sede?.nombre || '—'}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`badge ${u.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {u.id !== currentUser?.id && (
                      <button onClick={() => toggleActivo(u)} className="text-sm text-primary-500 hover:underline">
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
