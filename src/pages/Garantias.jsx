import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'

export default function Garantias() {
  const [garantias, setGarantias] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('activa')

  useEffect(() => { cargar() }, [filtro])

  async function cargar() {
    setLoading(true)
    let query = supabase
      .from('garantia')
      .select(`
        *,
        orden_trabajo:ot_id(
          id, numero_ot, tipo_equipo, marca, modelo, fecha_cierre,
          cliente:cliente_id(nombre, nit, telefono)
        )
      `)
      .order('fecha_fin', { ascending: true })

    if (filtro) query = query.eq('estado', filtro)

    const { data } = await query
    setGarantias(data || [])
    setLoading(false)
  }

  async function crearOTGarantia(garantiaItem) {
    try {
      const otOriginal = garantiaItem.orden_trabajo

      // Crear nueva OT de garantía vinculada
      const { data: nuevaOT, error } = await supabase
        .from('orden_trabajo')
        .insert({
          cliente_id: otOriginal.cliente?.id || otOriginal.cliente_id,
          sede_id: otOriginal.sede_id,
          tipo_equipo: otOriginal.tipo_equipo,
          marca: otOriginal.marca,
          modelo: otOriginal.modelo,
          descripcion_problema: `Reclamo de garantía — OT original: ${otOriginal.numero_ot}`,
          estado: 'recibido',
          es_garantia: true,
          ot_original_id: otOriginal.id,
          prioridad_sla: false,
        })
        .select()
        .single()

      if (error) throw error

      // Actualizar estado de la garantía
      await supabase.from('garantia').update({ estado: 'reclamada' }).eq('id', garantiaItem.id)

      toast.success(`OT de garantía ${nuevaOT.numero_ot} creada`)
      cargar()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  function diasRestantes(fechaFin) {
    const hoy = new Date()
    const fin = new Date(fechaFin)
    const diff = Math.ceil((fin - hoy) / (1000 * 60 * 60 * 24))
    return diff
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Control de Garantías</h1>
          <p className="text-sm text-gray-500">RN-11: Garantía de 30 días calendario por reparación</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-6">
        {['activa', 'reclamada', 'vencida', ''].map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filtro === f ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {f === '' ? 'Todas' : f === 'activa' ? '🟢 Activas' : f === 'reclamada' ? '🟡 Reclamadas' : '⚪ Vencidas'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div></div>
      ) : garantias.length === 0 ? (
        <div className="card text-center py-12">
          <span className="text-4xl mb-3 block">🛡️</span>
          <p className="text-gray-500">No hay garantías con este filtro.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {garantias.map(g => {
            const dias = diasRestantes(g.fecha_fin)
            const ot = g.orden_trabajo
            return (
              <div key={g.id} className="card">
                <div className="flex items-start justify-between mb-3">
                  <Link to={`/ordenes/${ot?.id}`} className="font-mono text-sm font-bold text-primary-500 hover:underline">
                    {ot?.numero_ot}
                  </Link>
                  <span className={`badge ${g.estado === 'activa' ? 'bg-green-100 text-green-700' : g.estado === 'reclamada' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>
                    {g.estado}
                  </span>
                </div>

                <p className="text-sm font-medium">{ot?.tipo_equipo} {ot?.marca} {ot?.modelo}</p>
                <p className="text-xs text-gray-500">{ot?.cliente?.nombre} — {ot?.cliente?.telefono || ''}</p>

                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Inicio: {new Date(g.fecha_inicio).toLocaleDateString('es-GT')}</span>
                    <span>Fin: {new Date(g.fecha_fin).toLocaleDateString('es-GT')}</span>
                  </div>
                  {g.estado === 'activa' && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className={dias <= 5 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                          {dias > 0 ? `${dias} días restantes` : 'Vencida'}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${dias <= 5 ? 'bg-red-500' : dias <= 15 ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.max(0, Math.min(100, (dias / 30) * 100))}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                {g.estado === 'activa' && dias > 0 && (
                  <button onClick={() => crearOTGarantia(g)}
                    className="btn-accent w-full mt-3 text-sm">
                    🔄 Crear OT de Garantía
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
