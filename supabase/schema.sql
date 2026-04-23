-- ============================================================
-- TechClick Corporación — Sistema de Gestión de Servicios IT
-- Schema SQL para Supabase (PostgreSQL)
-- ============================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE rol_usuario AS ENUM (
  'recepcionista', 'tecnico', 'jefe_it', 
  'control_garantias', 'soporte_sla', 'admin', 'bodega'
);

CREATE TYPE tipo_cliente AS ENUM ('particular', 'empresarial');

CREATE TYPE estado_ot AS ENUM (
  'recibido',
  'pendiente_diagnostico',
  'diagnosticado',
  'pendiente_autorizacion',
  'autorizado',
  'esperando_repuestos',
  'en_reparacion',
  'en_pruebas',
  'reparado',
  'entregado',
  'cerrado',
  'rechazado',
  'equipo_retirado',
  'reabierto'
);

CREATE TYPE estado_solicitud_repuesto AS ENUM (
  'solicitado', 'despachado', 'recibido', 'devuelto'
);

CREATE TYPE estado_garantia AS ENUM ('activa', 'vencida', 'reclamada');
CREATE TYPE tipo_garantia AS ENUM ('reparacion', 'producto_nuevo');
CREATE TYPE tipo_autorizacion AS ENUM ('digital', 'escrita', 'automatica');

-- ============================================================
-- TABLAS PRINCIPALES
-- ============================================================

-- Sedes regionales
CREATE TABLE sede (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(100) NOT NULL,
  ciudad VARCHAR(100) NOT NULL,
  direccion TEXT,
  telefono VARCHAR(20),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usuarios del sistema (vinculados a auth.users de Supabase)
CREATE TABLE usuario (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  rol rol_usuario NOT NULL,
  sede_id UUID REFERENCES sede(id),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clientes
CREATE TABLE cliente (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo tipo_cliente NOT NULL DEFAULT 'particular',
  nombre VARCHAR(200) NOT NULL,
  nit VARCHAR(20),
  telefono VARCHAR(20),
  email VARCHAR(255),
  direccion TEXT,
  contrato_sla_activo BOOLEAN DEFAULT false,
  nivel_sla VARCHAR(20),
  sede_id UUID REFERENCES sede(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Secuencia para número correlativo de OT
CREATE SEQUENCE ot_numero_seq START WITH 1000;

-- Órdenes de Trabajo (tabla central)
CREATE TABLE orden_trabajo (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_ot VARCHAR(20) NOT NULL UNIQUE DEFAULT 'OT-' || LPAD(nextval('ot_numero_seq')::TEXT, 6, '0'),
  cliente_id UUID NOT NULL REFERENCES cliente(id),
  sede_id UUID NOT NULL REFERENCES sede(id),
  tecnico_asignado_id UUID REFERENCES usuario(id),
  creado_por_id UUID REFERENCES usuario(id),
  tipo_equipo VARCHAR(100) NOT NULL,
  marca VARCHAR(100),
  modelo VARCHAR(100),
  numero_serie VARCHAR(100),
  accesorios TEXT,
  descripcion_problema TEXT NOT NULL,
  estado estado_ot NOT NULL DEFAULT 'recibido',
  es_garantia BOOLEAN DEFAULT false,
  ot_original_id UUID REFERENCES orden_trabajo(id),
  prioridad_sla BOOLEAN DEFAULT false,
  fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
  fecha_cierre TIMESTAMPTZ,
  notas TEXT
);

-- Diagnóstico técnico
CREATE TABLE diagnostico (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ot_id UUID NOT NULL REFERENCES orden_trabajo(id) ON DELETE CASCADE,
  hallazgos TEXT NOT NULL,
  componentes_defectuosos JSONB DEFAULT '[]',
  costo_estimado_reparacion DECIMAL(10,2) NOT NULL DEFAULT 0,
  valor_equipo_nuevo_equivalente DECIMAL(10,2),
  porcentaje_costo_vs_nuevo DECIMAL(5,2),
  requiere_autorizacion BOOLEAN DEFAULT false,
  firma_tecnico BOOLEAN DEFAULT false,
  fecha_diagnostico TIMESTAMPTZ DEFAULT NOW()
);

-- Autorización del cliente
CREATE TABLE autorizacion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ot_id UUID NOT NULL REFERENCES orden_trabajo(id) ON DELETE CASCADE,
  tipo tipo_autorizacion NOT NULL DEFAULT 'digital',
  costo_autorizado DECIMAL(10,2) NOT NULL,
  firma_cliente_digital BOOLEAN DEFAULT false,
  fecha_autorizacion TIMESTAMPTZ DEFAULT NOW(),
  medio_autorizacion VARCHAR(100),
  observaciones TEXT
);

-- Catálogo de repuestos
CREATE TABLE repuesto (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  categoria VARCHAR(100),
  precio_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock_actual INTEGER NOT NULL DEFAULT 0,
  stock_minimo INTEGER NOT NULL DEFAULT 5,
  sede_id UUID REFERENCES sede(id),
  proveedor VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Solicitudes de repuestos para una OT
CREATE TABLE solicitud_repuesto (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ot_id UUID NOT NULL REFERENCES orden_trabajo(id) ON DELETE CASCADE,
  repuesto_id UUID NOT NULL REFERENCES repuesto(id),
  cantidad INTEGER NOT NULL DEFAULT 1,
  estado estado_solicitud_repuesto NOT NULL DEFAULT 'solicitado',
  firma_recepcion_tecnico BOOLEAN DEFAULT false,
  fecha_solicitud TIMESTAMPTZ DEFAULT NOW(),
  fecha_despacho TIMESTAMPTZ
);

-- Log de auditoría de transiciones de estado BPM
CREATE TABLE transicion_estado (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ot_id UUID NOT NULL REFERENCES orden_trabajo(id) ON DELETE CASCADE,
  estado_anterior estado_ot,
  estado_nuevo estado_ot NOT NULL,
  usuario_id UUID REFERENCES usuario(id),
  observaciones TEXT,
  fecha_hora TIMESTAMPTZ DEFAULT NOW()
);

-- Registro de garantías
CREATE TABLE garantia (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ot_id UUID NOT NULL REFERENCES orden_trabajo(id) ON DELETE CASCADE,
  fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  estado estado_garantia NOT NULL DEFAULT 'activa',
  tipo tipo_garantia NOT NULL DEFAULT 'reparacion'
);

-- ============================================================
-- FUNCIONES Y TRIGGERS
-- ============================================================

-- Función para generar número de OT automáticamente
CREATE OR REPLACE FUNCTION generar_numero_ot()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_ot IS NULL OR NEW.numero_ot = '' THEN
    NEW.numero_ot := 'OT-' || LPAD(nextval('ot_numero_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_generar_numero_ot
  BEFORE INSERT ON orden_trabajo
  FOR EACH ROW
  EXECUTE FUNCTION generar_numero_ot();

-- Función para registrar transiciones de estado automáticamente
CREATE OR REPLACE FUNCTION log_transicion_estado()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.estado IS DISTINCT FROM NEW.estado THEN
    INSERT INTO transicion_estado (ot_id, estado_anterior, estado_nuevo)
    VALUES (NEW.id, OLD.estado, NEW.estado);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_log_transicion
  AFTER UPDATE ON orden_trabajo
  FOR EACH ROW
  EXECUTE FUNCTION log_transicion_estado();

-- Función para descontar inventario al despachar repuesto (RN-10)
CREATE OR REPLACE FUNCTION descontar_inventario()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'despachado' AND OLD.estado = 'solicitado' THEN
    UPDATE repuesto
    SET stock_actual = stock_actual - NEW.cantidad
    WHERE id = NEW.repuesto_id AND stock_actual >= NEW.cantidad;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock insuficiente para el repuesto solicitado';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_descontar_inventario
  BEFORE UPDATE ON solicitud_repuesto
  FOR EACH ROW
  EXECUTE FUNCTION descontar_inventario();

-- Función para crear garantía automáticamente al cerrar OT (RN-11)
CREATE OR REPLACE FUNCTION crear_garantia_auto()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'cerrado' AND OLD.estado != 'cerrado' AND NEW.es_garantia = false THEN
    INSERT INTO garantia (ot_id, fecha_inicio, fecha_fin, tipo)
    VALUES (NEW.id, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 'reparacion');
    
    NEW.fecha_cierre := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_crear_garantia
  BEFORE UPDATE ON orden_trabajo
  FOR EACH ROW
  EXECUTE FUNCTION crear_garantia_auto();

-- ============================================================
-- VISTAS ÚTILES
-- ============================================================

-- Vista de OTs con información completa
CREATE OR REPLACE VIEW vista_ordenes_completa AS
SELECT 
  ot.id,
  ot.numero_ot,
  ot.estado,
  ot.tipo_equipo,
  ot.marca,
  ot.modelo,
  ot.descripcion_problema,
  ot.fecha_creacion,
  ot.fecha_cierre,
  ot.es_garantia,
  ot.prioridad_sla,
  c.nombre AS cliente_nombre,
  c.nit AS cliente_nit,
  c.tipo AS cliente_tipo,
  c.telefono AS cliente_telefono,
  c.contrato_sla_activo,
  s.nombre AS sede_nombre,
  u.nombre || ' ' || u.apellido AS tecnico_nombre,
  d.costo_estimado_reparacion,
  d.hallazgos AS diagnostico_hallazgos,
  g.estado AS garantia_estado,
  g.fecha_fin AS garantia_fecha_fin
FROM orden_trabajo ot
LEFT JOIN cliente c ON ot.cliente_id = c.id
LEFT JOIN sede s ON ot.sede_id = s.id
LEFT JOIN usuario u ON ot.tecnico_asignado_id = u.id
LEFT JOIN diagnostico d ON d.ot_id = ot.id
LEFT JOIN garantia g ON g.ot_id = ot.id;

-- Vista de KPIs del dashboard
CREATE OR REPLACE VIEW vista_kpis AS
SELECT
  (SELECT COUNT(*) FROM orden_trabajo WHERE estado NOT IN ('cerrado', 'equipo_retirado')) AS ots_activas,
  (SELECT COUNT(*) FROM orden_trabajo WHERE estado = 'cerrado') AS ots_cerradas,
  (SELECT COUNT(*) FROM orden_trabajo WHERE prioridad_sla = true AND estado NOT IN ('cerrado', 'equipo_retirado')) AS ots_sla_activas,
  (SELECT COUNT(*) FROM garantia WHERE estado = 'activa') AS garantias_activas,
  (SELECT COUNT(*) FROM repuesto WHERE stock_actual <= stock_minimo) AS repuestos_bajo_stock,
  (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (fecha_cierre - fecha_creacion)) / 3600), 0) FROM orden_trabajo WHERE fecha_cierre IS NOT NULL) AS promedio_horas_cierre;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE sede ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE orden_trabajo ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostico ENABLE ROW LEVEL SECURITY;
ALTER TABLE autorizacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE repuesto ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitud_repuesto ENABLE ROW LEVEL SECURITY;
ALTER TABLE transicion_estado ENABLE ROW LEVEL SECURITY;
ALTER TABLE garantia ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para el prototipo (usuarios autenticados)
CREATE POLICY "Usuarios autenticados pueden ver sedes" ON sede FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Usuarios autenticados pueden gestionar usuarios" ON usuario FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Usuarios autenticados pueden gestionar clientes" ON cliente FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Usuarios autenticados pueden gestionar OTs" ON orden_trabajo FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Usuarios autenticados pueden gestionar diagnósticos" ON diagnostico FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Usuarios autenticados pueden gestionar autorizaciones" ON autorizacion FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Usuarios autenticados pueden gestionar repuestos" ON repuesto FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Usuarios autenticados pueden gestionar solicitudes" ON solicitud_repuesto FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Usuarios autenticados pueden ver transiciones" ON transicion_estado FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Usuarios autenticados pueden gestionar garantías" ON garantia FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- DATOS SEMILLA (Seed Data)
-- ============================================================

-- Sedes
INSERT INTO sede (id, nombre, ciudad, direccion, telefono) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'Región Central', 'Ciudad de Guatemala', 'Zona 10, Ciudad de Guatemala', '2222-1111'),
  ('b2222222-2222-2222-2222-222222222222', 'Región Occidente', 'Quetzaltenango', 'Zona 1, Quetzaltenango', '7777-2222');

-- Repuestos de ejemplo
INSERT INTO repuesto (codigo, nombre, categoria, precio_unitario, stock_actual, stock_minimo, sede_id) VALUES
  ('RAM-DDR4-8', 'Memoria RAM DDR4 8GB', 'Memoria', 250.00, 20, 5, 'a1111111-1111-1111-1111-111111111111'),
  ('RAM-DDR4-16', 'Memoria RAM DDR4 16GB', 'Memoria', 450.00, 15, 5, 'a1111111-1111-1111-1111-111111111111'),
  ('SSD-256', 'Disco SSD 256GB SATA', 'Almacenamiento', 350.00, 12, 3, 'a1111111-1111-1111-1111-111111111111'),
  ('SSD-512', 'Disco SSD 512GB NVMe', 'Almacenamiento', 550.00, 8, 3, 'a1111111-1111-1111-1111-111111111111'),
  ('HDD-1TB', 'Disco HDD 1TB 7200RPM', 'Almacenamiento', 400.00, 10, 3, 'a1111111-1111-1111-1111-111111111111'),
  ('PSU-500', 'Fuente de Poder 500W 80+', 'Fuente de Poder', 300.00, 6, 2, 'a1111111-1111-1111-1111-111111111111'),
  ('PSU-650', 'Fuente de Poder 650W 80+ Bronze', 'Fuente de Poder', 450.00, 4, 2, 'a1111111-1111-1111-1111-111111111111'),
  ('MB-H510', 'Placa Base Intel H510', 'Placa Base', 650.00, 5, 2, 'a1111111-1111-1111-1111-111111111111'),
  ('MB-B550', 'Placa Base AMD B550', 'Placa Base', 750.00, 4, 2, 'a1111111-1111-1111-1111-111111111111'),
  ('FAN-120', 'Ventilador CPU 120mm', 'Refrigeración', 150.00, 15, 5, 'a1111111-1111-1111-1111-111111111111'),
  ('PASTA-T', 'Pasta Térmica 4g', 'Refrigeración', 45.00, 30, 10, 'a1111111-1111-1111-1111-111111111111'),
  ('CABLE-SATA', 'Cable SATA III', 'Cables', 25.00, 40, 10, 'a1111111-1111-1111-1111-111111111111'),
  ('GPU-1650', 'Tarjeta Gráfica GTX 1650', 'GPU', 1800.00, 3, 1, 'a1111111-1111-1111-1111-111111111111'),
  ('RAM-DDR4-8-X', 'Memoria RAM DDR4 8GB', 'Memoria', 250.00, 18, 5, 'b2222222-2222-2222-2222-222222222222'),
  ('SSD-256-X', 'Disco SSD 256GB SATA', 'Almacenamiento', 350.00, 10, 3, 'b2222222-2222-2222-2222-222222222222'),
  ('PSU-500-X', 'Fuente de Poder 500W 80+', 'Fuente de Poder', 300.00, 5, 2, 'b2222222-2222-2222-2222-222222222222'),
  ('PASTA-T-X', 'Pasta Térmica 4g', 'Refrigeración', 45.00, 25, 10, 'b2222222-2222-2222-2222-222222222222');
