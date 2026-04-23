// Motor BPM — Máquina de Estados Finitos para Órdenes de Trabajo
// Basado en el flujo definido en el Capítulo 2, sección 2.2

export const ESTADOS = {
  recibido: { label: 'Recibido', color: 'bg-blue-100 text-blue-800', icon: '📥' },
  pendiente_diagnostico: { label: 'Pendiente Diagnóstico', color: 'bg-blue-100 text-blue-800', icon: '🔍' },
  diagnosticado: { label: 'Diagnosticado', color: 'bg-indigo-100 text-indigo-800', icon: '🔬' },
  pendiente_autorizacion: { label: 'Pendiente Autorización', color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
  autorizado: { label: 'Autorizado', color: 'bg-green-100 text-green-800', icon: '✅' },
  esperando_repuestos: { label: 'Esperando Repuestos', color: 'bg-orange-100 text-orange-800', icon: '📦' },
  en_reparacion: { label: 'En Reparación', color: 'bg-purple-100 text-purple-800', icon: '🔧' },
  en_pruebas: { label: 'En Pruebas', color: 'bg-cyan-100 text-cyan-800', icon: '🧪' },
  reparado: { label: 'Reparado', color: 'bg-teal-100 text-teal-800', icon: '✔️' },
  entregado: { label: 'Entregado', color: 'bg-green-100 text-green-800', icon: '🤝' },
  cerrado: { label: 'Cerrado', color: 'bg-gray-100 text-gray-800', icon: '🔒' },
  rechazado: { label: 'Rechazado', color: 'bg-red-100 text-red-800', icon: '❌' },
  equipo_retirado: { label: 'Equipo Retirado', color: 'bg-red-100 text-red-800', icon: '🚫' },
  reabierto: { label: 'Reabierto', color: 'bg-violet-100 text-violet-800', icon: '🔄' },
}

// Transiciones válidas: estado_actual -> [estados_posibles]
export const TRANSICIONES = {
  recibido: ['pendiente_diagnostico'],
  pendiente_diagnostico: ['diagnosticado'],
  diagnosticado: ['pendiente_autorizacion'],
  pendiente_autorizacion: ['autorizado', 'rechazado'],
  autorizado: ['esperando_repuestos', 'en_reparacion'],
  esperando_repuestos: ['en_reparacion'],
  en_reparacion: ['en_pruebas'],
  en_pruebas: ['reparado', 'en_reparacion'], // puede regresar si falla prueba
  reparado: ['entregado'],
  entregado: ['cerrado'],
  cerrado: ['reabierto'],
  rechazado: ['equipo_retirado'],
  equipo_retirado: [],
  reabierto: ['pendiente_diagnostico'],
}

// ============================================================
// PERMISOS POR TRANSICIÓN ESPECÍFICA: 'estadoOrigen_estadoDestino'
// Define exactamente qué rol puede ejecutar cada paso del flujo
// ============================================================
export const ROLES_POR_TRANSICION = {
  // FASE 1 — Recepcionista abre el diagnóstico
  'recibido_pendiente_diagnostico':           ['recepcionista', 'admin'],

  // FASE 2 — Técnico completa diagnóstico y envía a autorización
  'pendiente_diagnostico_diagnosticado':      ['tecnico', 'admin'],
  'diagnosticado_pendiente_autorizacion':     ['tecnico', 'admin'],

  // FASE 3 — Recepcionista registra decisión del cliente
  'pendiente_autorizacion_autorizado':        ['recepcionista', 'admin'],
  'pendiente_autorizacion_rechazado':         ['recepcionista', 'admin'],

  // FASE 4 — Técnico solicita repuestos
  'autorizado_esperando_repuestos':           ['tecnico', 'admin'],
  'autorizado_en_reparacion':                 ['tecnico', 'admin'], // si no requiere repuestos

  // FASE 5 — Bodega despacha (acción dentro del formulario de repuestos, no transición BPM)
  // La transición la hace el técnico cuando ya recibió los repuestos
  'esperando_repuestos_en_reparacion':        ['tecnico', 'admin'],

  // FASE 6 — Técnico ejecuta la reparación y envía a pruebas
  'en_reparacion_en_pruebas':                 ['tecnico', 'admin'],

  // FASE 7 — Jefe IT aprueba o regresa a reparación
  'en_pruebas_reparado':                      ['jefe_it', 'admin'],
  'en_pruebas_en_reparacion':                 ['jefe_it', 'admin'],

  // FASE 8 — Recepcionista entrega y cierra
  'reparado_entregado':                       ['recepcionista', 'admin'],
  'entregado_cerrado':                        ['recepcionista', 'admin'],

  // FLUJO RECHAZO — Recepcionista gestiona retiro
  'rechazado_equipo_retirado':                ['recepcionista', 'admin'],

  // GARANTÍA — Control de garantías reabre
  'cerrado_reabierto':                        ['control_garantias', 'admin', 'jefe_it'],
  'reabierto_pendiente_diagnostico':          ['recepcionista', 'admin'],
}

// ============================================================
// ACCESO A MÓDULOS POR ROL
// Define qué secciones del sidebar son visibles para cada rol
// ============================================================
export const MODULOS_POR_ROL = {
  admin:             ['dashboard', 'ordenes', 'clientes', 'inventario', 'garantias', 'usuarios'],
  jefe_it:           ['dashboard', 'ordenes', 'clientes', 'garantias', 'usuarios'],
  recepcionista:     ['dashboard', 'ordenes', 'clientes'],
  tecnico:           ['dashboard', 'ordenes'],
  bodega:            ['dashboard', 'inventario', 'ordenes'], // ordenes solo para despachar repuestos
  control_garantias: ['dashboard', 'garantias', 'ordenes'],
  soporte_sla:       ['dashboard', 'ordenes'],
}

/**
 * Verifica si una transición de estado es estructuralmente válida (BPM)
 */
export function esTransicionValida(estadoActual, estadoNuevo) {
  const transicionesPermitidas = TRANSICIONES[estadoActual] || []
  return transicionesPermitidas.includes(estadoNuevo)
}

/**
 * Verifica si un rol tiene permiso para ejecutar una transición específica
 */
export function puedeEjecutarTransicion(estadoActual, estadoNuevo, rolUsuario) {
  const clave = `${estadoActual}_${estadoNuevo}`
  const rolesPermitidos = ROLES_POR_TRANSICION[clave] || []
  return rolesPermitidos.includes(rolUsuario)
}

/**
 * Obtiene las transiciones posibles desde un estado FILTRADAS por rol del usuario
 */
export function obtenerTransicionesPermitidas(estadoActual, rolUsuario) {
  return (TRANSICIONES[estadoActual] || [])
    .filter(estadoNuevo => puedeEjecutarTransicion(estadoActual, estadoNuevo, rolUsuario))
    .map(estado => ({ estado, ...ESTADOS[estado] }))
}

/**
 * Obtiene TODAS las transiciones posibles (sin filtro de rol) — para visualización
 */
export function obtenerTransicionesPosibles(estadoActual) {
  return (TRANSICIONES[estadoActual] || []).map(estado => ({
    estado,
    ...ESTADOS[estado],
  }))
}

/**
 * Verifica si un rol tiene acceso a un módulo del sistema
 */
export function tieneAccesoModulo(rolUsuario, modulo) {
  const modulos = MODULOS_POR_ROL[rolUsuario] || []
  return modulos.includes(modulo)
}

/**
 * Verifica la regla RN-08: costo reparación > 60% valor equipo nuevo
 */
export function verificarRN08(costoReparacion, valorEquipoNuevo) {
  if (!valorEquipoNuevo || valorEquipoNuevo <= 0) return false
  const porcentaje = (costoReparacion / valorEquipoNuevo) * 100
  return porcentaje >= 60
}

/**
 * Verifica la regla RN-09: autorización requerida si costo > Q200
 */
export function requiereAutorizacion(costoReparacion) {
  return costoReparacion > 200
}

/**
 * Obtiene el label de acción para una transición
 */
export function getLabelTransicion(estadoNuevo) {
  const labels = {
    pendiente_diagnostico: 'Iniciar Diagnóstico',
    diagnosticado: 'Completar Diagnóstico',
    pendiente_autorizacion: 'Enviar a Autorización',
    autorizado: 'Autorizar Reparación',
    rechazado: 'Rechazar Reparación',
    esperando_repuestos: 'Solicitar Repuestos',
    en_reparacion: 'Iniciar Reparación',
    en_pruebas: 'Enviar a Pruebas',
    reparado: 'Aprobar Pruebas',
    entregado: 'Registrar Entrega',
    cerrado: 'Cerrar Orden',
    equipo_retirado: 'Registrar Retiro',
    reabierto: 'Reabrir por Garantía',
  }
  return labels[estadoNuevo] || estadoNuevo
}