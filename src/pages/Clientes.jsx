import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export default function Clientes() {
  const { usuario } = useAuth()
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)

  const formInicial = { tipo: 'particular', nombre: '', nit: '', telefono: '', email: '', direccion: '', contrato_sla_activo: false, nivel_sla: '' }
  const [form, setForm] = useState(formInicial)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('cliente').select('*, sede:sede_id(nombre)').order('nombre')
    setClientes(data || [])
    setLoading(false)
  }

  async function guardar() {
    try {
      if (editando) {
        const { error } = await supabase.from('cliente').update(form).eq('id', editando)
        if (error) throw error
        toast.success('Cliente actualizado')
      } else {
        const { error } = await supabase.from('cliente').insert({ ...form, sede_id: usuario?.sede_id })
        if (error) throw error
        toast.success('Cliente creado')
      }
      setShowForm(false)
      setEditando(null)
      setForm(formInicial)
      cargar()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  function editar(c) {
    setForm({ tipo: c.tipo, nombre: c.nombre, nit: c.nit || '', telefono: c.telefono || '', email: c.email || '', direccion: c.direccion || '', contrato_sla_activo: c.contrato_sla_activo, nivel_sla: c.nivel_sla || '' })
    setEditando(c.id)
    setShowForm(true)
  }

  const filtrados = clientes.filter(c => {
    if (!busqueda) return true
    const t = busqueda.toLowerCase()
    return c.nombre?.toLowerCase().includes(t) || c.nit?.toLowerCase().includes(t) || c.email?.toLowerCase().includes(t)
  })

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <button onClick={() => { setForm(formInicial); setEditando(null); setShowForm(true) }} className="btn-primary self-start">+ Nuevo Cliente</button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="card mb-6 border-2 border-primary-200">
          <h2 className="text-lg font-semibold mb-4">{editando ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
              <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))} className="input-field">
                <option value="particular">Particular</option>
                <option value="empresarial">Empresarial</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NIT</label>
              <input value={form.nit} onChange={e => setForm(p => ({ ...p, nit: e.target.value }))} className="input-field" placeholder="12345678-9" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre / Razón Social *</label>
              <input required value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="input-field" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
              <input value={form.direccion} onChange={e => setForm(p => ({ ...p, direccion: e.target.value }))} className="input-field" />
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.contrato_sla_activo} onChange={e => setForm(p => ({ ...p, contrato_sla_activo: e.target.checked }))} className="rounded" />
                <span className="text-sm text-gray-700">Contrato SLA activo</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 justify-end mt-4">
            <button onClick={() => { setShowForm(false); setEditando(null) }} className="btn-secondary">Cancelar</button>
            <button onClick={guardar} className="btn-primary" disabled={!form.nombre}>Guardar</button>
          </div>
        </div>
      )}

      {/* Búsqueda */}
      <div className="mb-4">
        <input type="text" placeholder="Buscar por nombre, NIT o email..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="input-field max-w-md" />
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full bg-white rounded-xl shadow-sm border border-gray-100">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Nombre</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Tipo</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">NIT</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Contacto</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">SLA</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm font-medium text-gray-900">{c.nombre}</td>
                  <td className="py-3 px-4"><span className={`badge ${c.tipo === 'empresarial' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>{c.tipo}</span></td>
                  <td className="py-3 px-4 text-sm text-gray-600">{c.nit || '—'}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{c.telefono || c.email || '—'}</td>
                  <td className="py-3 px-4">{c.contrato_sla_activo ? <span className="badge bg-red-100 text-red-700">SLA Activo</span> : <span className="text-xs text-gray-400">—</span>}</td>
                  <td className="py-3 px-4"><button onClick={() => editar(c)} className="text-sm text-primary-500 hover:underline">Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 mt-2">{filtrados.length} clientes</p>
        </div>
      )}
    </div>
  )
}
