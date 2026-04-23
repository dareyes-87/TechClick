import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { ESTADOS } from '../utils/bpmEngine'

const ROLES_CREAR_OT = ['recepcionista', 'admin', 'jefe_it']

export default function OrdenesTrabajo() {
  const { usuario } = useAuth()
  const [ordenes, setOrdenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => { cargar() }, [filtroEstado])

  async function cargar() {
    setLoading(true)
    try {
      let query = supabase
        .from('orden_trabajo')
        .select(`
          *, 
          cliente:cliente_id(nombre, nit, tipo, contrato_sla_activo),
          tecnico:tecnico_asignado_id(nombre, apellido),
          sede:sede_id(nombre)
        `)
        .order('fecha_creacion', { ascending: false })
        .limit(100)

      if (filtroEstado) query = query.eq('estado', filtroEstado)

      const { data, error } = await query
      if (error) throw error
      setOrdenes(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const filtradas = ordenes.filter(o => {
    if (!busqueda) return true
    const term = busqueda.toLowerCase()
    return (
      o.numero_ot?.toLowerCase().includes(term) ||
      o.cliente?.nombre?.toLowerCase().includes(term) ||
      o.tipo_equipo?.toLowerCase().includes(term) ||
      o.marca?.toLowerCase().includes(term)
    )
  })

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Órdenes de Trabajo</h1>
        {ROLES_CREAR_OT.includes(usuario?.rol) && (
          <Link to="/ordenes/nueva" className="btn-primary inline-flex items-center gap-2 self-start">
            + Nueva OT
          </Link>
        )}
      </div>

      {/* Filtros */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Buscar por No. OT, cliente, equipo..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="input-field flex-1"
          />
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="input-field sm:w-56">
            <option value="">Todos los estados</option>
            {Object.entries(ESTADOS).map(([key, val]) => (
              <option key={key} value={key}>{val.icon} {val.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filtradas.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">No se encontraron órdenes de trabajo.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full bg-white rounded-xl shadow-sm border border-gray-100">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">No. OT</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Cliente</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Equipo</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Estado</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Técnico</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Fecha</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Sede</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtradas.map(ot => {
                const est = ESTADOS[ot.estado] || { label: ot.estado, color: 'bg-gray-100 text-gray-800' }
                return (
                  <tr key={ot.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <Link to={`/ordenes/${ot.id}`} className="font-mono text-sm font-bold text-primary-500 hover:underline">
                        {ot.numero_ot}
                      </Link>
                      {ot.prioridad_sla && <span className="ml-2 badge bg-red-100 text-red-700 text-[10px]">SLA</span>}
                      {ot.es_garantia && <span className="ml-1 badge bg-purple-100 text-purple-700 text-[10px]">GAR</span>}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm font-medium text-gray-900">{ot.cliente?.nombre}</div>
                      <div className="text-xs text-gray-500">{ot.cliente?.nit || '—'}</div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">
                      {ot.tipo_equipo} {ot.marca} {ot.modelo}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge ${est.color}`}>{est.icon} {est.label}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">
                      {ot.tecnico ? `${ot.tecnico.nombre} ${ot.tecnico.apellido}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {new Date(ot.fecha_creacion).toLocaleDateString('es-GT')}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">{ot.sede?.nombre}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}