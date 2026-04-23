import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

const ESTADO_SC_COLOR = {
  pendiente:          'bg-yellow-100 text-yellow-800',
  pedido_a_proveedor: 'bg-blue-100 text-blue-800',
  recibido_en_bodega: 'bg-teal-100 text-teal-800',
  despachado:         'bg-green-100 text-green-800',
  cancelado:          'bg-gray-100 text-gray-600',
}
const ESTADO_SC_LABEL = {
  pendiente:          '⏳ Pendiente',
  pedido_a_proveedor: '🚚 Pedido a proveedor',
  recibido_en_bodega: '📥 Recibido en bodega',
  despachado:         '✅ Despachado',
  cancelado:          '❌ Cancelado',
}

export default function Inventario() {
  const { usuario } = useAuth()
  const [tab, setTab] = useState('inventario') // 'inventario' | 'pedidos'
  const [repuestos, setRepuestos] = useState([])
  const [pedidosExternos, setPedidosExternos] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingPedidos, setLoadingPedidos] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroPedido, setFiltroPedido] = useState('pendiente')
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  // Modal gestión de pedido (solo bodega)
  const [pedidoActivo, setPedidoActivo] = useState(null)
  const [gestionForm, setGestionForm] = useState({ proveedor: '', fecha_estimada_llegada: '', nota_bodega: '' })

  const formInicial = { codigo: '', nombre: '', descripcion: '', categoria: '', precio_unitario: 0, stock_actual: 0, stock_minimo: 5, proveedor: '' }
  const [form, setForm] = useState(formInicial)

  useEffect(() => { cargar() }, [])
  useEffect(() => { if (tab === 'pedidos') cargarPedidos() }, [tab, filtroPedido])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('repuesto').select('*, sede:sede_id(nombre)').order('categoria, nombre')
    setRepuestos(data || [])
    setLoading(false)
  }

  async function cargarPedidos() {
    setLoadingPedidos(true)
    let query = supabase
      .from('solicitud_compra')
      .select(`
        *,
        orden_trabajo:ot_id(numero_ot, id, estado),
        cliente:ot_id(cliente:cliente_id(nombre)),
        solicitado_por_u:solicitado_por(nombre, apellido)
      `)
      .order('created_at', { ascending: false })
    if (filtroPedido) query = query.eq('estado', filtroPedido)
    const { data } = await query
    setPedidosExternos(data || [])
    setLoadingPedidos(false)
  }

  async function guardar() {
    try {
      const datos = { ...form, precio_unitario: parseFloat(form.precio_unitario), stock_actual: parseInt(form.stock_actual), stock_minimo: parseInt(form.stock_minimo) }
      if (editando) {
        const { error } = await supabase.from('repuesto').update(datos).eq('id', editando)
        if (error) throw error
        toast.success('Repuesto actualizado')
      } else {
        const { error } = await supabase.from('repuesto').insert({ ...datos, sede_id: usuario?.sede_id })
        if (error) throw error
        toast.success('Repuesto creado')
      }
      setShowForm(false)
      setEditando(null)
      setForm(formInicial)
      cargar()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  function editar(r) {
    setForm({ codigo: r.codigo, nombre: r.nombre, descripcion: r.descripcion || '', categoria: r.categoria || '', precio_unitario: r.precio_unitario, stock_actual: r.stock_actual, stock_minimo: r.stock_minimo, proveedor: r.proveedor || '' })
    setEditando(r.id)
    setShowForm(true)
  }

  function abrirGestion(pedido) {
    setPedidoActivo(pedido)
    setGestionForm({
      proveedor: pedido.proveedor || '',
      fecha_estimada_llegada: pedido.fecha_estimada_llegada || '',
      nota_bodega: pedido.nota_bodega || '',
    })
  }

  async function marcarPedidoAProveedor() {
    if (!gestionForm.proveedor.trim()) return toast.error('Ingresa el nombre del proveedor')
    try {
      await supabase.from('solicitud_compra').update({
        estado: 'pedido_a_proveedor',
        proveedor: gestionForm.proveedor.trim(),
        fecha_pedido_proveedor: new Date().toISOString(),
        fecha_estimada_llegada: gestionForm.fecha_estimada_llegada || null,
        nota_bodega: gestionForm.nota_bodega.trim() || null,
        atendido_por: usuario?.id,
      }).eq('id', pedidoActivo.id)
      toast.success('Pedido registrado con proveedor')
      setPedidoActivo(null)
      cargarPedidos()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  async function marcarRecibidoEnBodega() {
    try {
      // Si el pedido está vinculado a un repuesto en catálogo, incrementar su stock
      if (pedidoActivo.repuesto_id) {
        const rep = repuestos.find(r => r.id === pedidoActivo.repuesto_id)
        if (rep) {
          await supabase.from('repuesto').update({
            stock_actual: rep.stock_actual + pedidoActivo.cantidad
          }).eq('id', pedidoActivo.repuesto_id)
          toast.success(`Stock de "${rep.nombre}" actualizado: +${pedidoActivo.cantidad} unidades`)
        }
      }
      await supabase.from('solicitud_compra').update({
        estado: 'recibido_en_bodega',
        fecha_recepcion: new Date().toISOString(),
        nota_bodega: gestionForm.nota_bodega.trim() || pedidoActivo.nota_bodega,
        atendido_por: usuario?.id,
      }).eq('id', pedidoActivo.id)
      toast.success('Repuesto marcado como recibido en bodega. El técnico puede proceder.')
      setPedidoActivo(null)
      cargar()
      cargarPedidos()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  async function marcarDespachado() {
    try {
      await supabase.from('solicitud_compra').update({
        estado: 'despachado',
        atendido_por: usuario?.id,
      }).eq('id', pedidoActivo.id)
      toast.success('Repuesto despachado al técnico')
      setPedidoActivo(null)
      cargarPedidos()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  async function cancelarPedido(pedidoId) {
    if (!confirm('¿Cancelar esta solicitud de compra?')) return
    try {
      await supabase.from('solicitud_compra').update({ estado: 'cancelado' }).eq('id', pedidoId)
      toast.success('Solicitud cancelada')
      cargarPedidos()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  const categorias = [...new Set(repuestos.map(r => r.categoria).filter(Boolean))]
  const bajoStock = repuestos.filter(r => r.stock_actual <= r.stock_minimo)

  const filtrados = repuestos.filter(r => {
    if (filtroCategoria && r.categoria !== filtroCategoria) return false
    if (!busqueda) return true
    const t = busqueda.toLowerCase()
    return r.nombre?.toLowerCase().includes(t) || r.codigo?.toLowerCase().includes(t)
  })

  const pendientesCount = pedidosExternos.filter(p => p.estado === 'pendiente').length

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventario de Repuestos</h1>
        {tab === 'inventario' && (
          <button onClick={() => { setForm(formInicial); setEditando(null); setShowForm(true) }} className="btn-primary self-start">+ Nuevo Repuesto</button>
        )}
      </div>

      {/* Pestañas */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        <button onClick={() => setTab('inventario')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'inventario' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}>
          📦 Stock en Bodega
        </button>
        <button onClick={() => setTab('pedidos')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${tab === 'pedidos' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}>
          🛒 Pedidos Externos
          {pendientesCount > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{pendientesCount}</span>
          )}
        </button>
      </div>

      {/* ═══════════════════════ TAB: INVENTARIO ═══════════════════════ */}
      {tab === 'inventario' && (<>

      {/* Alerta de bajo stock */}
      {bajoStock.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-orange-800 mb-2">⚠️ {bajoStock.length} repuesto(s) con stock bajo o agotado:</p>
          <div className="flex flex-wrap gap-2">
            {bajoStock.map(r => (
              <span key={r.id} className="badge bg-orange-100 text-orange-800">
                [{r.codigo}] {r.nombre}: {r.stock_actual}/{r.stock_minimo}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Formulario */}
      {showForm && (
        <div className="card mb-6 border-2 border-primary-200">
          <h2 className="text-lg font-semibold mb-4">{editando ? 'Editar Repuesto' : 'Nuevo Repuesto'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
              <input required value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))} className="input-field" placeholder="RAM-DDR4-8" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <input value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} className="input-field" placeholder="Memoria, Almacenamiento..." />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input required value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio unitario (Q) *</label>
              <input type="number" min="0" step="0.01" value={form.precio_unitario} onChange={e => setForm(p => ({ ...p, precio_unitario: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock actual</label>
              <input type="number" min="0" value={form.stock_actual} onChange={e => setForm(p => ({ ...p, stock_actual: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock mínimo</label>
              <input type="number" min="0" value={form.stock_minimo} onChange={e => setForm(p => ({ ...p, stock_minimo: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
              <input value={form.proveedor} onChange={e => setForm(p => ({ ...p, proveedor: e.target.value }))} className="input-field" />
            </div>
          </div>
          <div className="flex gap-3 justify-end mt-4">
            <button onClick={() => { setShowForm(false); setEditando(null) }} className="btn-secondary">Cancelar</button>
            <button onClick={guardar} className="btn-primary" disabled={!form.codigo || !form.nombre}>Guardar</button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input type="text" placeholder="Buscar por código o nombre..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="input-field flex-1" />
        <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} className="input-field sm:w-48">
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full bg-white rounded-xl shadow-sm border border-gray-100">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Código</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Nombre</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Categoría</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Precio</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Stock</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Sede</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map(r => {
                const stockBajo = r.stock_actual <= r.stock_minimo
                return (
                  <tr key={r.id} className={`hover:bg-gray-50 ${stockBajo ? 'bg-orange-50/50' : ''}`}>
                    <td className="py-3 px-4 font-mono text-sm font-medium text-primary-600">{r.codigo}</td>
                    <td className="py-3 px-4 text-sm">{r.nombre}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{r.categoria || '—'}</td>
                    <td className="py-3 px-4 text-sm text-right font-medium">Q {parseFloat(r.precio_unitario).toFixed(2)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`badge ${stockBajo ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {r.stock_actual} / {r.stock_minimo}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">{r.sede?.nombre || '—'}</td>
                    <td className="py-3 px-4"><button onClick={() => editar(r)} className="text-sm text-primary-500 hover:underline">Editar</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 mt-2">{filtrados.length} repuestos</p>
        </div>
      )}

      </>)} {/* fin tab inventario */}

      {/* ═══════════════════════ TAB: PEDIDOS EXTERNOS ═══════════════════════ */}
      {tab === 'pedidos' && (
        <div>
          {/* Filtro de estado */}
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { val: 'pendiente', label: '⏳ Pendientes' },
              { val: 'pedido_a_proveedor', label: '🚚 En tránsito' },
              { val: 'recibido_en_bodega', label: '📥 En bodega' },
              { val: 'despachado', label: '✅ Despachados' },
              { val: '', label: 'Todos' },
            ].map(f => (
              <button key={f.val} onClick={() => setFiltroPedido(f.val)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtroPedido === f.val ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {f.label}
              </button>
            ))}
          </div>

          {loadingPedidos ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div></div>
          ) : pedidosExternos.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-400">No hay pedidos externos con este filtro.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pedidosExternos.map(pedido => (
                <div key={pedido.id} className="card">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* OT y cliente */}
                      <div className="flex items-center gap-2 mb-2">
                        <Link to={`/ordenes/${pedido.orden_trabajo?.id}`}
                          className="font-mono text-sm font-bold text-primary-500 hover:underline">
                          {pedido.orden_trabajo?.numero_ot}
                        </Link>
                        <span className={`badge text-xs ${ESTADO_SC_COLOR[pedido.estado]}`}>
                          {ESTADO_SC_LABEL[pedido.estado]}
                        </span>
                      </div>

                      {/* Repuesto solicitado */}
                      <p className="text-base font-semibold text-gray-900">{pedido.nombre_repuesto}</p>
                      <p className="text-sm text-gray-500">Cantidad: {pedido.cantidad}</p>

                      {/* Nota del técnico */}
                      {pedido.descripcion_tecnico && (
                        <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg p-2">
                          <p className="text-xs text-blue-600 font-medium">💬 Nota del técnico:</p>
                          <p className="text-sm text-blue-800 italic">"{pedido.descripcion_tecnico}"</p>
                        </div>
                      )}

                      {/* Info de gestión */}
                      {pedido.proveedor && <p className="text-sm text-gray-600 mt-2">🏪 Proveedor: <strong>{pedido.proveedor}</strong></p>}
                      {pedido.fecha_estimada_llegada && <p className="text-sm text-gray-600">📅 Llegada estimada: <strong>{new Date(pedido.fecha_estimada_llegada).toLocaleDateString('es-GT')}</strong></p>}
                      {pedido.nota_bodega && <p className="text-sm text-gray-600">📋 Nota bodega: {pedido.nota_bodega}</p>}
                      {pedido.fecha_recepcion && <p className="text-sm text-green-600">✅ Recibido: {new Date(pedido.fecha_recepcion).toLocaleString('es-GT')}</p>}

                      <p className="text-xs text-gray-400 mt-2">
                        Solicitado por {pedido.solicitado_por_u?.nombre} {pedido.solicitado_por_u?.apellido} — {new Date(pedido.created_at).toLocaleString('es-GT')}
                      </p>
                    </div>

                    {/* Acciones bodega */}
                    {usuario?.rol === 'bodega' || usuario?.rol === 'admin' ? (
                      <div className="flex flex-col gap-2 shrink-0">
                        {pedido.estado === 'pendiente' && (
                          <>
                            <button onClick={() => abrirGestion(pedido)}
                              className="btn-primary text-sm whitespace-nowrap">
                              🚚 Gestionar pedido
                            </button>
                            <button onClick={() => cancelarPedido(pedido.id)}
                              className="btn-secondary text-sm">Cancelar</button>
                          </>
                        )}
                        {pedido.estado === 'pedido_a_proveedor' && (
                          <button onClick={() => abrirGestion(pedido)}
                            className="btn-accent text-sm whitespace-nowrap">
                            📥 Marcar recibido
                          </button>
                        )}
                        {pedido.estado === 'recibido_en_bodega' && (
                          <button onClick={() => abrirGestion(pedido)}
                            className="btn-primary text-sm whitespace-nowrap">
                            📤 Despachar al técnico
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════ MODAL GESTIÓN PEDIDO ═══════════════════════ */}
      {pedidoActivo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Gestionar pedido externo</h2>
              <p className="text-sm text-gray-500 mb-4">{pedidoActivo.nombre_repuesto} — Cant: {pedidoActivo.cantidad}</p>

              {pedidoActivo.estado === 'pendiente' && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-700 uppercase">Registrar pedido a proveedor</p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor *</label>
                    <input type="text" value={gestionForm.proveedor}
                      onChange={e => setGestionForm(p => ({ ...p, proveedor: e.target.value }))}
                      className="input-field" placeholder="Nombre del proveedor o tienda" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha estimada de llegada</label>
                    <input type="date" value={gestionForm.fecha_estimada_llegada}
                      onChange={e => setGestionForm(p => ({ ...p, fecha_estimada_llegada: e.target.value }))}
                      className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nota para el técnico</label>
                    <textarea rows={2} value={gestionForm.nota_bodega}
                      onChange={e => setGestionForm(p => ({ ...p, nota_bodega: e.target.value }))}
                      className="input-field resize-none" placeholder="Ej: Conseguido con Importec, llegará el viernes" />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setPedidoActivo(null)} className="btn-secondary flex-1">Cancelar</button>
                    <button onClick={marcarPedidoAProveedor} className="btn-primary flex-1"
                      disabled={!gestionForm.proveedor.trim()}>
                      🚚 Confirmar pedido
                    </button>
                  </div>
                </div>
              )}

              {pedidoActivo.estado === 'pedido_a_proveedor' && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-700 uppercase">Confirmar llegada del repuesto</p>
                  {pedidoActivo.repuesto_id && (
                    <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm text-teal-800">
                      ✅ Al confirmar, el stock del repuesto en catálogo se incrementará automáticamente en <strong>{pedidoActivo.cantidad}</strong> unidades.
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nota adicional (opcional)</label>
                    <textarea rows={2} value={gestionForm.nota_bodega}
                      onChange={e => setGestionForm(p => ({ ...p, nota_bodega: e.target.value }))}
                      className="input-field resize-none" />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setPedidoActivo(null)} className="btn-secondary flex-1">Cancelar</button>
                    <button onClick={marcarRecibidoEnBodega} className="btn-accent flex-1">
                      📥 Marcar como recibido
                    </button>
                  </div>
                </div>
              )}

              {pedidoActivo.estado === 'recibido_en_bodega' && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-700 uppercase">Despachar al técnico</p>
                  <p className="text-sm text-gray-600">El repuesto está en bodega y listo para ser entregado al técnico que lo solicitó.</p>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setPedidoActivo(null)} className="btn-secondary flex-1">Cancelar</button>
                    <button onClick={marcarDespachado} className="btn-primary flex-1">
                      📤 Confirmar despacho
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}