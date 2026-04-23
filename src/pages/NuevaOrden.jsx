import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export default function NuevaOrden() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [clientes, setClientes] = useState([])
  const [tecnicos, setTecnicos] = useState([])
  const [saving, setSaving] = useState(false)
  const [mostrarNuevoCliente, setMostrarNuevoCliente] = useState(false)

  const [form, setForm] = useState({
    cliente_id: '',
    tipo_equipo: '',
    marca: '',
    modelo: '',
    numero_serie: '',
    accesorios: '',
    descripcion_problema: '',
    tecnico_asignado_id: '',
    prioridad_sla: false,
  })

  const [nuevoCliente, setNuevoCliente] = useState({
    tipo: 'particular',
    nombre: '',
    nit: '',
    telefono: '',
    email: '',
    direccion: '',
    contrato_sla_activo: false,
  })

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    const { data: cls } = await supabase.from('cliente').select('*').order('nombre')
    setClientes(cls || [])

    const { data: tecs } = await supabase
      .from('usuario')
      .select('*')
      .eq('rol', 'tecnico')
      .eq('activo', true)
    setTecnicos(tecs || [])
  }

  async function crearCliente() {
    try {
      const { data, error } = await supabase
        .from('cliente')
        .insert({ ...nuevoCliente, sede_id: usuario?.sede_id })
        .select()
        .single()
      if (error) throw error
      setClientes(prev => [...prev, data])
      setForm(prev => ({ ...prev, cliente_id: data.id }))
      setMostrarNuevoCliente(false)
      toast.success('Cliente creado')
    } catch (err) {
      toast.error('Error al crear cliente: ' + err.message)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.cliente_id) return toast.error('Selecciona un cliente')
    if (!form.descripcion_problema) return toast.error('Describe el problema')

    setSaving(true)
    try {
      // Verificar si el cliente tiene SLA
      const clienteSel = clientes.find(c => c.id === form.cliente_id)
      const prioridadSla = clienteSel?.contrato_sla_activo || false

      const { data, error } = await supabase
        .from('orden_trabajo')
        .insert({
          ...form,
          sede_id: usuario?.sede_id,
          creado_por_id: usuario?.id,
          estado: 'recibido',
          prioridad_sla: prioridadSla,
          tecnico_asignado_id: form.tecnico_asignado_id || null,
        })
        .select()
        .single()

      if (error) throw error

      // Registrar transición inicial
      await supabase.from('transicion_estado').insert({
        ot_id: data.id,
        estado_anterior: null,
        estado_nuevo: 'recibido',
        usuario_id: usuario?.id,
        observaciones: 'Orden de trabajo creada',
      })

      toast.success(`Orden ${data.numero_ot} creada exitosamente`)
      navigate(`/ordenes/${data.id}`)
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <button onClick={() => navigate('/ordenes')} className="text-sm text-primary-500 hover:underline mb-2">
          ← Volver a Órdenes
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Nueva Orden de Trabajo</h1>
        <p className="text-sm text-gray-500">CU-01: Registrar equipo para diagnóstico/reparación</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Sección Cliente */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">1. Datos del Cliente</h2>
            <button type="button" onClick={() => setMostrarNuevoCliente(!mostrarNuevoCliente)}
              className="text-sm text-primary-500 hover:underline">
              {mostrarNuevoCliente ? 'Seleccionar existente' : '+ Nuevo cliente'}
            </button>
          </div>

          {mostrarNuevoCliente ? (
            <div className="space-y-3 bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select value={nuevoCliente.tipo} onChange={e => setNuevoCliente(p => ({ ...p, tipo: e.target.value }))} className="input-field">
                    <option value="particular">Particular</option>
                    <option value="empresarial">Empresarial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NIT</label>
                  <input type="text" value={nuevoCliente.nit} onChange={e => setNuevoCliente(p => ({ ...p, nit: e.target.value }))} className="input-field" placeholder="12345678-9" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo / Razón social *</label>
                <input type="text" required value={nuevoCliente.nombre} onChange={e => setNuevoCliente(p => ({ ...p, nombre: e.target.value }))} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input type="tel" value={nuevoCliente.telefono} onChange={e => setNuevoCliente(p => ({ ...p, telefono: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={nuevoCliente.email} onChange={e => setNuevoCliente(p => ({ ...p, email: e.target.value }))} className="input-field" />
                </div>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={nuevoCliente.contrato_sla_activo} onChange={e => setNuevoCliente(p => ({ ...p, contrato_sla_activo: e.target.checked }))} className="rounded" />
                <span className="text-sm text-gray-700">Contrato SLA activo</span>
              </label>
              <button type="button" onClick={crearCliente} className="btn-primary">Guardar Cliente</button>
            </div>
          ) : (
            <select required value={form.cliente_id} onChange={e => update('cliente_id', e.target.value)} className="input-field">
              <option value="">Seleccionar cliente...</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nombre} — {c.nit || 'S/NIT'} ({c.tipo}) {c.contrato_sla_activo ? '🔴 SLA' : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Sección Equipo */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">2. Datos del Equipo</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de equipo *</label>
              <select required value={form.tipo_equipo} onChange={e => update('tipo_equipo', e.target.value)} className="input-field">
                <option value="">Seleccionar...</option>
                <option value="Laptop">Laptop</option>
                <option value="Desktop">Desktop</option>
                <option value="All-in-One">All-in-One</option>
                <option value="Servidor">Servidor</option>
                <option value="Impresora">Impresora</option>
                <option value="Monitor">Monitor</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
              <input type="text" value={form.marca} onChange={e => update('marca', e.target.value)} className="input-field" placeholder="Ej: Dell, HP, Lenovo" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
              <input type="text" value={form.modelo} onChange={e => update('modelo', e.target.value)} className="input-field" placeholder="Ej: Latitude 5520" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">No. de Serie</label>
              <input type="text" value={form.numero_serie} onChange={e => update('numero_serie', e.target.value)} className="input-field" />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Accesorios entregados</label>
            <input type="text" value={form.accesorios} onChange={e => update('accesorios', e.target.value)} className="input-field" placeholder="Ej: Cargador, mouse, funda" />
          </div>
        </div>

        {/* Problema y asignación */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">3. Problema y Asignación</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del problema *</label>
            <textarea required rows={4} value={form.descripcion_problema} onChange={e => update('descripcion_problema', e.target.value)}
              className="input-field resize-none" placeholder="Describa detalladamente el problema reportado por el cliente..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Técnico asignado</label>
            <select value={form.tecnico_asignado_id} onChange={e => update('tecnico_asignado_id', e.target.value)} className="input-field">
              <option value="">Asignar después</option>
              {tecnicos.map(t => (
                <option key={t.id} value={t.id}>{t.nombre} {t.apellido}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => navigate('/ordenes')} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Guardando...' : '📋 Crear Orden de Trabajo'}
          </button>
        </div>
      </form>
    </div>
  )
}
