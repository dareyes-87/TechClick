import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { ESTADOS, obtenerTransicionesPermitidas, esTransicionValida, getLabelTransicion, verificarRN08, requiereAutorizacion, puedeEjecutarTransicion } from '../utils/bpmEngine'
import toast from 'react-hot-toast'

export default function DetalleOrden() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [ot, setOt] = useState(null)
  const [diagnostico, setDiagnostico] = useState(null)
  const [autorizacion, setAutorizacion] = useState(null)
  const [transiciones, setTransiciones] = useState([])
  const [solicitudesRep, setSolicitudesRep] = useState([])
  const [solicitudesCompra, setSolicitudesCompra] = useState([])
  const [garantia, setGarantia] = useState(null)
  const [loading, setLoading] = useState(true)

  // Formularios
  const [showDiagForm, setShowDiagForm] = useState(false)
  const [showAuthForm, setShowAuthForm] = useState(false)
  const [showRepForm, setShowRepForm] = useState(false)
  const [showCompraForm, setShowCompraForm] = useState(false)

  const [diagForm, setDiagForm] = useState({
    hallazgos: '',
    componentes_defectuosos: '',
    costo_estimado_reparacion: 0,
    valor_equipo_nuevo_equivalente: 0,
  })

  const [compraForm, setCompraForm] = useState({
    nombre_repuesto: '',
    cantidad: 1,
    descripcion_tecnico: '',
    repuesto_id: '',
  })

  const [repuestos, setRepuestos] = useState([])
  const [repuestosSinStock, setRepuestosSinStock] = useState([])
  const [repSeleccionado, setRepSeleccionado] = useState('')
  const [repCantidad, setRepCantidad] = useState(1)

  useEffect(() => { cargarTodo() }, [id])

  async function cargarTodo() {
    setLoading(true)
    try {
      // Cargar OT
      const { data: otData } = await supabase
        .from('orden_trabajo')
        .select(`*, cliente:cliente_id(*), tecnico:tecnico_asignado_id(nombre, apellido), sede:sede_id(nombre, ciudad)`)
        .eq('id', id)
        .single()
      setOt(otData)

      // Cargar diagnóstico
      const { data: diagData } = await supabase.from('diagnostico').select('*').eq('ot_id', id).maybeSingle()
      setDiagnostico(diagData)

      // Cargar autorización
      const { data: authData } = await supabase.from('autorizacion').select('*').eq('ot_id', id).maybeSingle()
      setAutorizacion(authData)

      // Cargar transiciones
      const { data: trans } = await supabase
        .from('transicion_estado')
        .select('*, usuario:usuario_id(nombre, apellido)')
        .eq('ot_id', id)
        .order('fecha_hora', { ascending: true })
      setTransiciones(trans || [])

      // Cargar solicitudes de repuestos en stock
      const { data: sols } = await supabase
        .from('solicitud_repuesto')
        .select('*, repuesto:repuesto_id(nombre, codigo, precio_unitario)')
        .eq('ot_id', id)
      setSolicitudesRep(sols || [])

      // Cargar solicitudes de compra externa
      const { data: solsCompra } = await supabase
        .from('solicitud_compra')
        .select('*, solicitado_por_u:solicitado_por(nombre, apellido), atendido_por_u:atendido_por(nombre, apellido)')
        .eq('ot_id', id)
        .order('created_at', { ascending: true })
      setSolicitudesCompra(solsCompra || [])

      // Cargar garantía
      const { data: garData } = await supabase.from('garantia').select('*').eq('ot_id', id).maybeSingle()
      setGarantia(garData)

      // Cargar repuestos disponibles (con stock)
      const { data: reps } = await supabase.from('repuesto').select('*').gt('stock_actual', 0).order('nombre')
      setRepuestos(reps || [])

      // Cargar repuestos sin stock (para mostrar en solicitud de compra)
      const { data: sinStock } = await supabase.from('repuesto').select('*').lte('stock_actual', 0).order('nombre')
      setRepuestosSinStock(sinStock || [])
    } catch (err) {
      console.error(err)
      toast.error('Error cargando orden')
    } finally {
      setLoading(false)
    }
  }

  async function cambiarEstado(nuevoEstado, observaciones = '') {
    if (!esTransicionValida(ot.estado, nuevoEstado)) {
      return toast.error('Transición no permitida')
    }

    try {
      const { error } = await supabase
        .from('orden_trabajo')
        .update({ estado: nuevoEstado, ...(nuevoEstado === 'cerrado' ? { fecha_cierre: new Date().toISOString() } : {}) })
        .eq('id', id)
      if (error) throw error

      // Log manual (el trigger también lo hace)
      await supabase.from('transicion_estado').insert({
        ot_id: id,
        estado_anterior: ot.estado,
        estado_nuevo: nuevoEstado,
        usuario_id: usuario?.id,
        observaciones: observaciones || `Transición a ${ESTADOS[nuevoEstado]?.label}`,
      })

      toast.success(`Estado actualizado: ${ESTADOS[nuevoEstado]?.label}`)
      cargarTodo()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  async function guardarDiagnostico() {
    try {
      const costo = parseFloat(diagForm.costo_estimado_reparacion) || 0
      const valorNuevo = parseFloat(diagForm.valor_equipo_nuevo_equivalente) || 0
      const porcentaje = valorNuevo > 0 ? (costo / valorNuevo) * 100 : 0
      const reqAuth = requiereAutorizacion(costo)

      const datos = {
        ot_id: id,
        hallazgos: diagForm.hallazgos,
        componentes_defectuosos: diagForm.componentes_defectuosos ? JSON.parse(`[${diagForm.componentes_defectuosos.split(',').map(s => `"${s.trim()}"`).join(',')}]`) : [],
        costo_estimado_reparacion: costo,
        valor_equipo_nuevo_equivalente: valorNuevo,
        porcentaje_costo_vs_nuevo: porcentaje,
        requiere_autorizacion: reqAuth,
        firma_tecnico: true,
      }

      if (diagnostico) {
        await supabase.from('diagnostico').update(datos).eq('id', diagnostico.id)
      } else {
        await supabase.from('diagnostico').insert(datos)
      }

      // Avanzar estado a diagnosticado
      if (ot.estado === 'pendiente_diagnostico') {
        await cambiarEstado('diagnosticado', 'Diagnóstico completado')
      }

      // Alerta RN-08
      if (verificarRN08(costo, valorNuevo)) {
        toast('⚠️ RN-08: El costo de reparación supera el 60% del valor de un equipo nuevo', { duration: 6000, icon: '⚠️' })
      }

      setShowDiagForm(false)
      toast.success('Diagnóstico guardado')
      cargarTodo()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  async function guardarAutorizacion(autorizar) {
    try {
      const costo = diagnostico?.costo_estimado_reparacion || 0

      if (autorizar) {
        await supabase.from('autorizacion').insert({
          ot_id: id,
          tipo: 'digital',
          costo_autorizado: costo,
          firma_cliente_digital: true,
          medio_autorizacion: 'Sistema web',
        })
        await cambiarEstado('autorizado', 'Cliente autorizó reparación')
      } else {
        await cambiarEstado('rechazado', 'Cliente rechazó reparación')
      }

      setShowAuthForm(false)
      cargarTodo()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  async function solicitarRepuesto() {
    if (!repSeleccionado) return toast.error('Selecciona un repuesto')
    try {
      await supabase.from('solicitud_repuesto').insert({
        ot_id: id,
        repuesto_id: repSeleccionado,
        cantidad: repCantidad,
        estado: 'solicitado',
      })
      toast.success('Repuesto solicitado')
      setRepSeleccionado('')
      setRepCantidad(1)
      cargarTodo()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  async function despacharRepuesto(solId) {
    try {
      await supabase.from('solicitud_repuesto').update({ estado: 'despachado', fecha_despacho: new Date().toISOString() }).eq('id', solId)
      toast.success('Repuesto despachado (inventario descontado automáticamente)')
      cargarTodo()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  async function solicitarCompraExterna() {
    if (!compraForm.nombre_repuesto.trim()) return toast.error('Ingresa el nombre del repuesto')
    if (!compraForm.cantidad || compraForm.cantidad < 1) return toast.error('Ingresa una cantidad válida')
    try {
      await supabase.from('solicitud_compra').insert({
        ot_id: id,
        nombre_repuesto: compraForm.nombre_repuesto.trim(),
        cantidad: parseInt(compraForm.cantidad),
        descripcion_tecnico: compraForm.descripcion_tecnico.trim(),
        repuesto_id: compraForm.repuesto_id || null,
        estado: 'pendiente',
        solicitado_por: usuario?.id,
      })
      toast.success('Solicitud de compra enviada a bodega')
      setCompraForm({ nombre_repuesto: '', cantidad: 1, descripcion_tecnico: '', repuesto_id: '' })
      setShowCompraForm(false)
      cargarTodo()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div></div>
  }

  if (!ot) {
    return <div className="card text-center py-12"><p className="text-gray-500">Orden no encontrada</p></div>
  }

  const estadoInfo = ESTADOS[ot.estado] || { label: ot.estado, color: 'bg-gray-100', icon: '📄' }
  // Solo muestra transiciones que el rol actual puede ejecutar
  const transicionesPermitidas = obtenerTransicionesPermitidas(ot.estado, usuario?.rol)
  // Transiciones posibles en total (para mostrar aviso cuando hay acciones bloqueadas)
  const hayAccionesBloqueadas = (ot.estado !== 'cerrado' && ot.estado !== 'equipo_retirado') &&
    transicionesPermitidas.length === 0

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => navigate('/ordenes')} className="text-sm text-primary-500 hover:underline mb-4">
        ← Volver a Órdenes
      </button>

      {/* Header */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{ot.numero_ot}</h1>
              <span className={`badge text-sm ${estadoInfo.color}`}>{estadoInfo.icon} {estadoInfo.label}</span>
              {ot.prioridad_sla && <span className="badge bg-red-100 text-red-700">⏱️ SLA</span>}
              {ot.es_garantia && <span className="badge bg-purple-100 text-purple-700">🛡️ Garantía</span>}
            </div>
            <p className="text-sm text-gray-500 mt-1">{ot.sede?.nombre} — Creada {new Date(ot.fecha_creacion).toLocaleString('es-GT')}</p>
          </div>
        </div>

        {/* Acciones BPM — solo las permitidas para el rol actual */}
        {transicionesPermitidas.length > 0 ? (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2 font-medium uppercase">Acciones disponibles</p>
            <div className="flex flex-wrap gap-2">
              {transicionesPermitidas.map(t => {
                if (t.estado === 'diagnosticado' && !diagnostico) {
                  return <button key={t.estado} onClick={() => setShowDiagForm(true)} className="btn-primary text-sm">🔬 Completar Diagnóstico</button>
                }
                if (t.estado === 'autorizado' || t.estado === 'rechazado') {
                  return <button key={t.estado} onClick={() => setShowAuthForm(true)}
                    className={t.estado === 'autorizado' ? 'btn-primary text-sm' : 'btn-danger text-sm'}>
                    {getLabelTransicion(t.estado)}
                  </button>
                }
                if (t.estado === 'esperando_repuestos') {
                  return <button key={t.estado} onClick={() => { setShowRepForm(true); cambiarEstado('esperando_repuestos') }}
                    className="btn-accent text-sm">📦 {getLabelTransicion(t.estado)}</button>
                }
                return (
                  <button key={t.estado} onClick={() => cambiarEstado(t.estado)}
                    className="btn-primary text-sm">
                    {getLabelTransicion(t.estado)}
                  </button>
                )
              })}
            </div>
          </div>
        ) : hayAccionesBloqueadas ? (
          // El flujo tiene acciones pendientes pero este rol no puede ejecutarlas
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <span className="text-amber-500 text-lg">🔒</span>
              <p className="text-sm text-amber-800">
                Esta orden está esperando acción de otro rol. Tu perfil (<strong>{usuario?.rol}</strong>) no tiene permiso para ejecutar el siguiente paso.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info equipo */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Equipo</h2>
            <div className="grid grid-cols-2 gap-y-3 text-sm">
              <div><span className="text-gray-500">Tipo:</span> <span className="font-medium ml-2">{ot.tipo_equipo}</span></div>
              <div><span className="text-gray-500">Marca:</span> <span className="font-medium ml-2">{ot.marca || '—'}</span></div>
              <div><span className="text-gray-500">Modelo:</span> <span className="font-medium ml-2">{ot.modelo || '—'}</span></div>
              <div><span className="text-gray-500">Serie:</span> <span className="font-medium ml-2">{ot.numero_serie || '—'}</span></div>
              <div className="col-span-2"><span className="text-gray-500">Accesorios:</span> <span className="ml-2">{ot.accesorios || 'Ninguno'}</span></div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-sm text-gray-500 mb-1">Problema reportado:</p>
              <p className="text-sm">{ot.descripcion_problema}</p>
            </div>
          </div>

          {/* Formulario Diagnóstico */}
          {showDiagForm && (
            <div className="card border-2 border-primary-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">🔬 Formulario de Diagnóstico</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hallazgos del diagnóstico *</label>
                  <textarea rows={4} value={diagForm.hallazgos} onChange={e => setDiagForm(p => ({ ...p, hallazgos: e.target.value }))}
                    className="input-field resize-none" placeholder="Detalle los hallazgos de las pruebas de hardware (RAM, disco, GPU, fuente, placa base)..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Componentes defectuosos (separados por coma)</label>
                  <input type="text" value={diagForm.componentes_defectuosos} onChange={e => setDiagForm(p => ({ ...p, componentes_defectuosos: e.target.value }))}
                    className="input-field" placeholder="Ej: RAM slot 2, Fuente de poder, Ventilador CPU" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Costo estimado reparación (Q) *</label>
                    <input type="number" min="0" step="0.01" value={diagForm.costo_estimado_reparacion}
                      onChange={e => setDiagForm(p => ({ ...p, costo_estimado_reparacion: e.target.value }))}
                      className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor equipo nuevo equiv. (Q)</label>
                    <input type="number" min="0" step="0.01" value={diagForm.valor_equipo_nuevo_equivalente}
                      onChange={e => setDiagForm(p => ({ ...p, valor_equipo_nuevo_equivalente: e.target.value }))}
                      className="input-field" />
                  </div>
                </div>

                {/* Indicadores de reglas de negocio */}
                {diagForm.costo_estimado_reparacion > 200 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                    ⚠️ <strong>RN-09:</strong> Costo mayor a Q200.00 — Se requerirá autorización del cliente.
                  </div>
                )}
                {verificarRN08(parseFloat(diagForm.costo_estimado_reparacion) || 0, parseFloat(diagForm.valor_equipo_nuevo_equivalente) || 0) && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                    🚨 <strong>RN-08:</strong> El costo de reparación supera el 60% del valor de un equipo nuevo equivalente. Se debe informar al cliente.
                  </div>
                )}

                <div className="flex gap-3 justify-end">
                  <button type="button" onClick={() => setShowDiagForm(false)} className="btn-secondary">Cancelar</button>
                  <button type="button" onClick={guardarDiagnostico} className="btn-primary" disabled={!diagForm.hallazgos}>
                    ✅ Firmar y Guardar Diagnóstico
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Diagnóstico guardado */}
          {diagnostico && !showDiagForm && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">🔬 Diagnóstico</h2>
              <p className="text-sm mb-2">{diagnostico.hallazgos}</p>
              <div className="grid grid-cols-2 gap-3 text-sm mt-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500">Costo reparación</p>
                  <p className="text-xl font-bold text-gray-900">Q {parseFloat(diagnostico.costo_estimado_reparacion).toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500">% vs equipo nuevo</p>
                  <p className="text-xl font-bold text-gray-900">{parseFloat(diagnostico.porcentaje_costo_vs_nuevo || 0).toFixed(1)}%</p>
                </div>
              </div>
              {diagnostico.firma_tecnico && <p className="text-xs text-green-600 mt-3">✅ Firmado digitalmente por técnico</p>}
            </div>
          )}

          {/* Formulario Autorización */}
          {showAuthForm && (
            <div className="card border-2 border-yellow-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">⏳ Autorización del Cliente</h2>
              {diagnostico && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <p className="text-sm text-gray-500">Costo a autorizar:</p>
                  <p className="text-2xl font-bold text-gray-900">Q {parseFloat(diagnostico.costo_estimado_reparacion).toFixed(2)}</p>
                  {diagnostico.requiere_autorizacion && (
                    <p className="text-xs text-yellow-700 mt-1">⚠️ RN-09: Requiere autorización por ser mayor a Q200.00</p>
                  )}
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => guardarAutorizacion(true)} className="btn-primary flex-1">
                  ✅ Cliente Autoriza
                </button>
                <button onClick={() => guardarAutorizacion(false)} className="btn-danger flex-1">
                  ❌ Cliente Rechaza
                </button>
              </div>
              <button onClick={() => setShowAuthForm(false)} className="btn-secondary w-full mt-2">Cancelar</button>
            </div>
          )}

          {/* Autorización guardada */}
          {autorizacion && !showAuthForm && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">✅ Autorización</h2>
              <p className="text-sm">Costo autorizado: <strong>Q {parseFloat(autorizacion.costo_autorizado).toFixed(2)}</strong></p>
              <p className="text-xs text-gray-500 mt-1">Fecha: {new Date(autorizacion.fecha_autorizacion).toLocaleString('es-GT')} — Medio: {autorizacion.medio_autorizacion}</p>
            </div>
          )}

          {/* Repuestos en stock */}
          {(showRepForm || solicitudesRep.length > 0 || ['esperando_repuestos', 'en_reparacion', 'autorizado'].includes(ot.estado)) && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">📦 Repuestos en Bodega</h2>

              {/* Formulario agregar repuesto con stock */}
              {['esperando_repuestos', 'autorizado', 'en_reparacion'].includes(ot.estado) && ['tecnico', 'admin'].includes(usuario?.rol) && (
                <div className="flex flex-col sm:flex-row gap-2 mb-4 bg-gray-50 rounded-lg p-3">
                  <select value={repSeleccionado} onChange={e => setRepSeleccionado(e.target.value)} className="input-field flex-1">
                    <option value="">Seleccionar repuesto disponible...</option>
                    {repuestos.map(r => (
                      <option key={r.id} value={r.id}>
                        [{r.codigo}] {r.nombre} — Q{r.precio_unitario} (Stock: {r.stock_actual})
                      </option>
                    ))}
                  </select>
                  <input type="number" min={1} value={repCantidad} onChange={e => setRepCantidad(parseInt(e.target.value))}
                    className="input-field w-20" />
                  <button onClick={solicitarRepuesto} className="btn-primary whitespace-nowrap">+ Solicitar</button>
                </div>
              )}

              {/* Lista de solicitudes en stock */}
              {solicitudesRep.length > 0 ? (
                <div className="space-y-2">
                  {solicitudesRep.map(s => (
                    <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                      <div>
                        <p className="text-sm font-medium">[{s.repuesto?.codigo}] {s.repuesto?.nombre}</p>
                        <p className="text-xs text-gray-500">Cant: {s.cantidad} — Q {(s.repuesto?.precio_unitario * s.cantidad).toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`badge ${s.estado === 'despachado' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {s.estado}
                        </span>
                        {s.estado === 'solicitado' && usuario?.rol === 'bodega' && (
                          <button onClick={() => despacharRepuesto(s.id)} className="text-xs btn-accent py-1 px-2">
                            Despachar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="text-right text-sm font-semibold text-gray-700 pt-2 border-t">
                    Total repuestos: Q {solicitudesRep.reduce((sum, s) => sum + (s.repuesto?.precio_unitario || 0) * s.cantidad, 0).toFixed(2)}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 mb-2">No se han solicitado repuestos de bodega</p>
              )}
            </div>
          )}

          {/* ── REPUESTOS EXTERNOS ── */}
          {['esperando_repuestos', 'autorizado', 'en_reparacion', 'pendiente_diagnostico', 'diagnosticado'].includes(ot.estado) && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">🛒 Repuestos Externos</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Piezas no disponibles en bodega — se gestionan con proveedor</p>
                </div>
                {['tecnico', 'admin'].includes(usuario?.rol) && (
                  <button onClick={() => setShowCompraForm(!showCompraForm)}
                    className="btn-accent text-sm">
                    {showCompraForm ? 'Cancelar' : '+ Solicitar'}
                  </button>
                )}
              </div>

              {/* Formulario solicitud de compra — solo técnico */}
              {showCompraForm && ['tecnico', 'admin'].includes(usuario?.rol) && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4 space-y-3">
                  <p className="text-sm font-medium text-orange-800">📋 Nueva solicitud a bodega para compra externa</p>

                  {/* Opción 1: si ya está en catálogo pero sin stock */}
                  {repuestosSinStock.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        ¿Está en catálogo pero sin stock? (opcional)
                      </label>
                      <select value={compraForm.repuesto_id}
                        onChange={e => {
                          const rep = repuestosSinStock.find(r => r.id === e.target.value)
                          setCompraForm(p => ({
                            ...p,
                            repuesto_id: e.target.value,
                            nombre_repuesto: rep ? rep.nombre : p.nombre_repuesto,
                          }))
                        }}
                        className="input-field">
                        <option value="">No está en catálogo — ingresaré el nombre</option>
                        {repuestosSinStock.map(r => (
                          <option key={r.id} value={r.id}>[{r.codigo}] {r.nombre} (Stock: 0)</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nombre del repuesto *</label>
                    <input type="text" value={compraForm.nombre_repuesto}
                      onChange={e => setCompraForm(p => ({ ...p, nombre_repuesto: e.target.value }))}
                      className="input-field" placeholder="Ej: Batería HP Pavilion 14 / Altavoz interno 4Ω / Bisagra derecha..." />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Cantidad *</label>
                    <input type="number" min={1} value={compraForm.cantidad}
                      onChange={e => setCompraForm(p => ({ ...p, cantidad: e.target.value }))}
                      className="input-field w-28" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Nota para bodega (especificaciones técnicas, urgencia, alternativas)
                    </label>
                    <textarea rows={3} value={compraForm.descripcion_tecnico}
                      onChange={e => setCompraForm(p => ({ ...p, descripcion_tecnico: e.target.value }))}
                      className="input-field resize-none"
                      placeholder="Ej: Batería modelo HS04, 14.8V 2200mAh. Alternativa compatible: HS03. Urgente, cliente tiene SLA." />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowCompraForm(false)} className="btn-secondary text-sm">Cancelar</button>
                    <button onClick={solicitarCompraExterna} className="btn-accent text-sm"
                      disabled={!compraForm.nombre_repuesto.trim()}>
                      📨 Enviar solicitud a bodega
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de solicitudes externas */}
              {solicitudesCompra.length > 0 ? (
                <div className="space-y-3">
                  {solicitudesCompra.map(sc => {
                    const estadoColor = {
                      pendiente: 'bg-yellow-100 text-yellow-800',
                      pedido_a_proveedor: 'bg-blue-100 text-blue-800',
                      recibido_en_bodega: 'bg-teal-100 text-teal-800',
                      despachado: 'bg-green-100 text-green-800',
                      cancelado: 'bg-gray-100 text-gray-600',
                    }
                    const estadoLabel = {
                      pendiente: '⏳ Pendiente',
                      pedido_a_proveedor: '🚚 Pedido a proveedor',
                      recibido_en_bodega: '📥 Recibido en bodega',
                      despachado: '✅ Despachado al técnico',
                      cancelado: '❌ Cancelado',
                    }
                    return (
                      <div key={sc.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{sc.nombre_repuesto}</p>
                            <p className="text-xs text-gray-500">Cant: {sc.cantidad}</p>
                            {sc.descripcion_tecnico && (
                              <p className="text-xs text-gray-600 mt-1 italic">"{sc.descripcion_tecnico}"</p>
                            )}
                            {sc.proveedor && (
                              <p className="text-xs text-blue-600 mt-1">🏪 Proveedor: {sc.proveedor}</p>
                            )}
                            {sc.fecha_estimada_llegada && (
                              <p className="text-xs text-gray-500">📅 Llegada est.: {new Date(sc.fecha_estimada_llegada).toLocaleDateString('es-GT')}</p>
                            )}
                            {sc.nota_bodega && (
                              <p className="text-xs text-teal-700 mt-1">💬 Bodega: {sc.nota_bodega}</p>
                            )}
                          </div>
                          <span className={`badge text-xs shrink-0 ${estadoColor[sc.estado]}`}>
                            {estadoLabel[sc.estado]}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2">
                          Solicitado por {sc.solicitado_por_u?.nombre} — {new Date(sc.created_at).toLocaleString('es-GT')}
                        </p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No hay solicitudes de compra externa para esta OT</p>
              )}
            </div>
          )}

          {/* Garantía */}
          {garantia && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">🛡️ Garantía</h2>
              <div className="text-sm">
                <p>Tipo: <strong>{garantia.tipo}</strong></p>
                <p>Vigencia: {new Date(garantia.fecha_inicio).toLocaleDateString('es-GT')} — {new Date(garantia.fecha_fin).toLocaleDateString('es-GT')}</p>
                <span className={`badge mt-2 ${garantia.estado === 'activa' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                  {garantia.estado}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Columna lateral */}
        <div className="space-y-6">
          {/* Cliente */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">👤 Cliente</h3>
            <p className="font-medium">{ot.cliente?.nombre}</p>
            <p className="text-sm text-gray-500">{ot.cliente?.nit || 'S/NIT'}</p>
            <p className="text-xs text-gray-400 mt-1">{ot.cliente?.tipo} — {ot.cliente?.telefono}</p>
            {ot.cliente?.contrato_sla_activo && (
              <span className="badge bg-red-100 text-red-700 mt-2">🔴 Contrato SLA</span>
            )}
          </div>

          {/* Técnico */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">🔧 Técnico Asignado</h3>
            {ot.tecnico ? (
              <p className="font-medium">{ot.tecnico.nombre} {ot.tecnico.apellido}</p>
            ) : (
              <p className="text-sm text-gray-500">Sin asignar</p>
            )}
          </div>

          {/* Timeline de transiciones */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">📜 Historial (Auditoría)</h3>
            {transiciones.length === 0 ? (
              <p className="text-sm text-gray-500">Sin transiciones registradas</p>
            ) : (
              <div className="space-y-3">
                {transiciones.map((t, i) => (
                  <div key={t.id} className="relative pl-6">
                    <div className="absolute left-0 top-1 w-3 h-3 rounded-full bg-primary-500"></div>
                    {i < transiciones.length - 1 && <div className="absolute left-[5px] top-4 w-0.5 h-full bg-gray-200"></div>}
                    <p className="text-xs font-medium text-gray-900">
                      {t.estado_anterior ? `${ESTADOS[t.estado_anterior]?.label} → ` : ''}{ESTADOS[t.estado_nuevo]?.label}
                    </p>
                    <p className="text-[10px] text-gray-500">{t.observaciones}</p>
                    <p className="text-[10px] text-gray-400">
                      {t.usuario ? `${t.usuario.nombre} ${t.usuario.apellido}` : 'Sistema'} — {new Date(t.fecha_hora).toLocaleString('es-GT')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}