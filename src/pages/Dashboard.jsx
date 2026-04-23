import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { ESTADOS } from '../utils/bpmEngine'
import { useAuth } from '../contexts/AuthContext'

function StatCard({ icon, label, value, color, sub }) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function KanbanColumn({ estado, ordenes }) {
  const info = ESTADOS[estado] || { label: estado, color: 'bg-gray-100 text-gray-800', icon: '📄' }
  const items = ordenes.filter(o => o.estado === estado)
  if (items.length === 0) return null

  return (
    <div className="min-w-[260px] max-w-[280px] flex-shrink-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={`badge ${info.color}`}>{info.icon} {info.label}</span>
        <span className="text-xs text-gray-400 font-medium">{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.map(ot => (
          <Link key={ot.id} to={`/ordenes/${ot.id}`}
            className="block bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex justify-between items-start mb-1">
              <span className="font-mono text-xs font-bold text-primary-500">{ot.numero_ot}</span>
              {ot.prioridad_sla && <span className="badge bg-red-100 text-red-700 text-[10px]">SLA</span>}
            </div>
            <p className="text-sm font-medium text-gray-900 truncate">{ot.tipo_equipo} {ot.marca}</p>
            <p className="text-xs text-gray-500 truncate mt-0.5">{ot.cliente?.nombre || 'Cliente'}</p>
            <p className="text-[10px] text-gray-400 mt-2">
              {new Date(ot.fecha_creacion).toLocaleDateString('es-GT')}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { usuario } = useAuth()
  const [stats, setStats] = useState({ activas: 0, cerradas: 0, sla: 0, garantias: 0, bajoStock: 0 })
  const [ordenes, setOrdenes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    try {
      // Cargar OTs activas con datos de cliente
      const { data: ots } = await supabase
        .from('orden_trabajo')
        .select('*, cliente:cliente_id(nombre, tipo, contrato_sla_activo)')
        .not('estado', 'in', '("cerrado","equipo_retirado")')
        .order('fecha_creacion', { ascending: false })
        .limit(50)

      setOrdenes(ots || [])

      // Contar stats
      const { count: activas } = await supabase
        .from('orden_trabajo')
        .select('*', { count: 'exact', head: true })
        .not('estado', 'in', '("cerrado","equipo_retirado")')

      const { count: cerradas } = await supabase
        .from('orden_trabajo')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'cerrado')

      const { count: sla } = await supabase
        .from('orden_trabajo')
        .select('*', { count: 'exact', head: true })
        .eq('prioridad_sla', true)
        .not('estado', 'in', '("cerrado","equipo_retirado")')

      const { count: garantias } = await supabase
        .from('garantia')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'activa')

      const { data: repuestos } = await supabase
        .from('repuesto')
        .select('id, stock_actual, stock_minimo')
      const bajoStock = (repuestos || []).filter(r => r.stock_actual <= r.stock_minimo).length

      setStats({
        activas: activas || 0,
        cerradas: cerradas || 0,
        sla: sla || 0,
        garantias: garantias || 0,
        bajoStock,
      })
    } catch (err) {
      console.error('Error cargando dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  const estadosKanban = [
    'recibido', 'pendiente_diagnostico', 'diagnosticado',
    'pendiente_autorizacion', 'autorizado', 'esperando_repuestos',
    'en_reparacion', 'en_pruebas', 'reparado', 'entregado',
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Bienvenido, {usuario?.nombre}. Vista general del sistema.</p>
        </div>
        {['recepcionista', 'admin'].includes(usuario?.rol) && (
          <Link to="/ordenes/nueva" className="btn-primary inline-flex items-center gap-2 self-start">
            + Nueva Orden de Trabajo
          </Link>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard icon="📋" label="OTs Activas" value={stats.activas} color="bg-blue-50" />
        <StatCard icon="✅" label="OTs Cerradas" value={stats.cerradas} color="bg-green-50" />
        <StatCard icon="⏱️" label="Tickets SLA" value={stats.sla} color="bg-red-50" sub="Activos" />
        <StatCard icon="🛡️" label="Garantías" value={stats.garantias} color="bg-purple-50" sub="Activas" />
        <StatCard icon="⚠️" label="Bajo Stock" value={stats.bajoStock} color="bg-orange-50" sub="Repuestos" />
      </div>

      {/* Kanban Board */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Tablero de Órdenes de Trabajo</h2>
        <p className="text-sm text-gray-500">Vista kanban del flujo BPM — click en una tarjeta para ver detalles</p>
      </div>

      {ordenes.length === 0 ? (
        <div className="card text-center py-12">
          <span className="text-4xl mb-3 block">📋</span>
          <p className="text-gray-500">No hay órdenes de trabajo activas.</p>
          <Link to="/ordenes/nueva" className="btn-primary inline-block mt-4">Crear primera OT</Link>
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {estadosKanban.map(estado => (
              <KanbanColumn key={estado} estado={estado} ordenes={ordenes} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}