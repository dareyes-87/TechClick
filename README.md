# ⚡ TechClick — Sistema de Gestión de Servicios IT

**Prototipo Funcional** — Proyecto del curso Administración de Tecnologías  
Carrera: Ingeniería en Sistemas

---

## 📋 Descripción

Sistema web para la gestión del ciclo completo de soporte técnico y reparación de hardware de **TechClick Corporación**, con operación en dos regiones: Guatemala y Quetzaltenango.

### Funcionalidades implementadas

- ✅ **Motor BPM** — Máquina de estados finitos para el ciclo de vida de Órdenes de Trabajo (13 estados)
- ✅ **Gestión de OT** — Creación, seguimiento y cierre con número único correlativo
- ✅ **Diagnóstico y Presupuesto** — Formulario técnico con reglas RN-08 (60%) y RN-09 (>Q200)
- ✅ **Autorización digital** — Flujo de aprobación/rechazo del cliente
- ✅ **Inventario de repuestos** — Stock en tiempo real con alertas de bajo stock (RN-10)
- ✅ **Garantías** — Registro automático de 30 días y creación de OTs de garantía (RN-11)
- ✅ **Dashboard con KPIs** — Vista kanban y métricas en tiempo real
- ✅ **Multi-sede** — Soporte para regiones Central y Occidente
- ✅ **Autenticación por roles** — 7 roles diferenciados con permisos
- ✅ **Log de auditoría** — Registro automático de cada transición de estado

### Arquitectura

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Frontend | React 18 + Tailwind CSS | SPA responsive, accesible desde tablets |
| Backend/API | Supabase (PostgreSQL + Auth + API REST) | Reemplaza Node.js+Express para el prototipo |
| Base de Datos | PostgreSQL 16 (vía Supabase) | Modelo ER completo con triggers y funciones |
| Despliegue | Vercel (frontend) + Supabase (backend) | Alternativa gratuita a AWS |

---


---

## 🧪 Pruebas Iniciales de Funcionamiento

### Caso de Prueba 1: Flujo completo de una OT

1. **Login** como Recepcionista
2. **Crear OT** → Registrar un equipo nuevo
3. **Login** como Técnico
4. **Avanzar a Diagnóstico** → Completar formulario de diagnóstico
5. **Verificar RN-08** → Ingresar costo > 60% del valor nuevo
6. **Verificar RN-09** → Costo > Q200 requiere autorización
7. **Autorizar** → Registrar autorización del cliente
8. **Solicitar repuestos** → Verificar descuento de inventario (RN-10)
9. **Reparar → Pruebas → Reparado → Entregar → Cerrar**
10. **Verificar garantía** → Se crea automáticamente (RN-11)

### Caso de Prueba 2: Rechazo de reparación

1. Crear OT → Diagnosticar → En autorización
2. **Rechazar** reparación
3. Verificar que avanza a "Equipo Retirado"

### Caso de Prueba 3: Garantía

1. Con una OT cerrada, ir a Garantías
2. Crear OT de garantía vinculada
3. Verificar que se marca como "es_garantia = true"

### Caso de Prueba 4: Inventario

1. Verificar stock de repuestos
2. Despachar un repuesto desde una OT
3. Verificar que el stock se descontó automáticamente
4. Verificar alertas de stock bajo

---

## 📁 Estructura del Proyecto

```
techclick/
├── index.html                    # Entry HTML
├── package.json                  # Dependencias
├── vite.config.js                # Configuración Vite
├── tailwind.config.js            # Colores corporativos TechClick
├── .env.example                  # Variables de entorno
├── supabase/
│   └── schema.sql                # Esquema completo de BD
└── src/
    ├── main.jsx                  # Punto de entrada React
    ├── App.jsx                   # Routing y Layout
    ├── index.css                 # Estilos globales + Tailwind
    ├── supabaseClient.js         # Cliente de Supabase
    ├── contexts/
    │   └── AuthContext.jsx       # Contexto de autenticación
    ├── utils/
    │   └── bpmEngine.js          # Motor BPM (FSM)
    └── pages/
        ├── Login.jsx             # Pantalla de login/registro
        ├── Dashboard.jsx         # Dashboard con KPIs y Kanban
        ├── OrdenesTrabajo.jsx    # Lista de OTs con filtros
        ├── NuevaOrden.jsx        # CU-01: Registrar OT
        ├── DetalleOrden.jsx      # Detalle + BPM + Diagnóstico
        ├── Clientes.jsx          # Gestión de clientes
        ├── Inventario.jsx        # Inventario con alertas
        ├── Garantias.jsx         # Control de garantías
        └── Usuarios.jsx          # Administración de usuarios
```


---

## ⚖️ Reglas de Negocio Implementadas

| Regla | Descripción | Implementación |
|-------|-------------|---------------|
| RN-07 | OT obligatoria con número único | Secuencia `ot_numero_seq` + trigger |
| RN-08 | Alerta si costo > 60% valor nuevo | Cálculo en diagnóstico + alerta UI |
| RN-09 | Autorización si costo > Q200 | Validación en BPM engine |
| RN-10 | Descuento automático de inventario | Trigger `descontar_inventario` |
| RN-11 | Garantía 30 días automática | Trigger `crear_garantia_auto` |

---

## 🛠️ Tecnologías Utilizadas

- **React 18** — Framework frontend
- **Tailwind CSS** — Diseño responsive
- **React Router v6** — Navegación SPA
- **Supabase** — PostgreSQL + Auth + API REST
- **Vite** — Build tool
- **React Hot Toast** — Notificaciones
- **Recharts** — Gráficas (disponible)

---

*TechClick Corporación © 2025 — Proyecto académico de Administración de Tecnologías*
