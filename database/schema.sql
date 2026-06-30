-- ============================================================
-- FASE 2: SCHEMA COMPLETO — SaaS GESTIÓN DE INVENTARIO
-- Axioma Flux | Multi-Tenant | CPP | PostgreSQL / Supabase
-- ============================================================
-- Ejecutar en orden. Requiere Supabase Auth activo.
-- ============================================================


-- ============================================================
-- SECCIÓN 1: TABLAS
-- ============================================================

-- ------------------------------------------------------------
-- 1.1  EMPRESAS  (master / raíz multi-tenant)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS empresas (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre      TEXT        NOT NULL,
    ruc_nit     TEXT,
    plan        TEXT        NOT NULL DEFAULT 'free'
                            CHECK (plan IN ('free','pro','enterprise')),
    activo      BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE empresas IS 'Raíz de aislamiento multi-tenant. Cada fila es una empresa independiente.';

-- ------------------------------------------------------------
-- 1.2  PERFILES_USUARIOS  (extiende auth.users con empresa + rol)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS perfiles_usuarios (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    empresa_id  UUID        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    rol         TEXT        NOT NULL DEFAULT 'operador'
                            CHECK (rol IN ('admin','operador','viewer')),
    nombre      TEXT        NOT NULL,
    email       TEXT        NOT NULL,
    activo      BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE perfiles_usuarios IS 'Vincula auth.users con empresa_id y rol. empresa_id nunca viene del frontend.';

-- ------------------------------------------------------------
-- 1.3  CATEGORIAS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id  UUID        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nombre      TEXT        NOT NULL,
    descripcion TEXT,
    activo      BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(empresa_id, nombre)
);

-- ------------------------------------------------------------
-- 1.4  PROVEEDORES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proveedores (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id  UUID        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nombre      TEXT        NOT NULL,
    ruc_nit     TEXT,
    contacto    TEXT,
    email       TEXT,
    telefono    TEXT,
    direccion   TEXT,
    activo      BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 1.5  UBICACIONES  (almacén / centro de distribución / tienda)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ubicaciones (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id  UUID        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nombre      TEXT        NOT NULL,
    codigo      TEXT        NOT NULL,
    tipo        TEXT        NOT NULL DEFAULT 'almacen'
                            CHECK (tipo IN ('almacen','centro_distribucion','tienda','externo')),
    descripcion TEXT,
    activo      BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(empresa_id, codigo)
);
COMMENT ON TABLE ubicaciones IS 'Nivel alto: almacén o centro de distribución. Contiene múltiples posiciones.';

-- ------------------------------------------------------------
-- 1.6  POSICIONES  (Zona-Rack-Nivel dentro de una ubicación)
--      Ejemplo: A-3-2 → Zona A, Rack 3, Nivel 2
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS posiciones (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id       UUID        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    ubicacion_id     UUID        NOT NULL REFERENCES ubicaciones(id) ON DELETE CASCADE,
    zona             TEXT        NOT NULL,   -- Ej: 'A', 'B', 'Z'
    rack             TEXT        NOT NULL,   -- Ej: '1', '2', '10'
    nivel            TEXT        NOT NULL,   -- Ej: '1', '2', '3'
    -- Código compuesto generado automáticamente: 'A-3-2'
    codigo           TEXT        GENERATED ALWAYS AS (zona || '-' || rack || '-' || nivel) STORED,
    descripcion      TEXT,
    capacidad_maxima NUMERIC(12,3),          -- unidades máximas que soporta (opcional)
    activo           BOOLEAN     NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(empresa_id, ubicacion_id, zona, rack, nivel)
);
COMMENT ON TABLE posiciones IS 'Posición física dentro de un centro de distribución. Jerarquía: Zona → Rack → Nivel.';

-- ------------------------------------------------------------
-- 1.7  PRODUCTOS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS productos (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id           UUID         NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    sku                  TEXT         NOT NULL,
    nombre               TEXT         NOT NULL,
    descripcion          TEXT,
    categoria_id         UUID         REFERENCES categorias(id) ON DELETE SET NULL,
    proveedor_default_id UUID         REFERENCES proveedores(id) ON DELETE SET NULL,
    posicion_default_id  UUID         REFERENCES posiciones(id) ON DELETE SET NULL,
    unidad_medida        TEXT         NOT NULL DEFAULT 'unidad',
    precio_venta         NUMERIC(14,4),
    -- Costo Promedio Ponderado (CPP) — recalculado en cada ingreso confirmado
    costo_promedio       NUMERIC(14,4) NOT NULL DEFAULT 0,
    stock_minimo         NUMERIC(12,3) NOT NULL DEFAULT 0,
    activo               BOOLEAN      NOT NULL DEFAULT true,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE(empresa_id, sku)
);
COMMENT ON TABLE productos IS 'costo_promedio usa CPP. Se actualiza atómicamente al confirmar un ingreso.';

-- ------------------------------------------------------------
-- 1.8  LOTES  (trazabilidad por lote, base para FIFO futuro)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lotes (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          UUID         NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    producto_id         UUID         NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    proveedor_id        UUID         REFERENCES proveedores(id) ON DELETE SET NULL,
    numero_lote         TEXT,
    costo_unitario      NUMERIC(14,4) NOT NULL DEFAULT 0,   -- costo al momento del ingreso
    cantidad_inicial    NUMERIC(12,3) NOT NULL DEFAULT 0,
    cantidad_disponible NUMERIC(12,3) NOT NULL DEFAULT 0,
    fecha_ingreso       DATE         NOT NULL DEFAULT CURRENT_DATE,
    fecha_vencimiento   DATE,
    observaciones       TEXT,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT lote_cantidad_no_negativa CHECK (cantidad_disponible >= 0)
);

-- ------------------------------------------------------------
-- 1.9  ORDENES_MOVIMIENTO  (cabecera de cada operación)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ordenes_movimiento (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id   UUID         NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    tipo         TEXT         NOT NULL
                              CHECK (tipo IN ('ingreso','salida','ajuste','traslado')),
    fecha        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    referencia   TEXT,         -- número de factura, OC, etc.
    observaciones TEXT,
    usuario_id   UUID         NOT NULL REFERENCES perfiles_usuarios(id),
    estado       TEXT         NOT NULL DEFAULT 'borrador'
                              CHECK (estado IN ('borrador','confirmado','anulado')),
    costo_total  NUMERIC(14,4) NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
COMMENT ON TABLE ordenes_movimiento IS 'Cabecera de orden. Una orden puede tener N líneas en detalle_movimientos.';

-- ------------------------------------------------------------
-- 1.10  DETALLE_MOVIMIENTOS  (líneas de cada orden)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS detalle_movimientos (
    id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id           UUID          NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    orden_id             UUID          NOT NULL REFERENCES ordenes_movimiento(id) ON DELETE CASCADE,
    producto_id          UUID          NOT NULL REFERENCES productos(id),
    lote_id              UUID          REFERENCES lotes(id) ON DELETE SET NULL,
    -- Posición física de origen y destino
    posicion_origen_id   UUID          REFERENCES posiciones(id) ON DELETE SET NULL,
    posicion_destino_id  UUID          REFERENCES posiciones(id) ON DELETE SET NULL,
    cantidad             NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
    -- Snapshot del costo unitario al momento del movimiento
    costo_unitario       NUMERIC(14,4) NOT NULL DEFAULT 0,
    -- Generado: cantidad × costo_unitario
    costo_total          NUMERIC(14,4) GENERATED ALWAYS AS (cantidad * costo_unitario) STORED,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT now()
);
COMMENT ON TABLE detalle_movimientos IS 'empresa_id redundante para RLS sin JOINs costosos en políticas.';

-- ------------------------------------------------------------
-- 1.11  AUDITORIA  (log inmutable de cambios)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id        UUID,
    tabla             TEXT         NOT NULL,
    operacion         TEXT         NOT NULL CHECK (operacion IN ('INSERT','UPDATE','DELETE')),
    registro_id       UUID,
    usuario_id        UUID,
    datos_anteriores  JSONB,
    datos_nuevos      JSONB,
    ip_address        TEXT,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
COMMENT ON TABLE auditoria IS 'Solo escritura via trigger SECURITY DEFINER. Los usuarios no pueden insertarla directamente.';


-- ============================================================
-- SECCIÓN 2: ÍNDICES
-- ============================================================

-- empresa_id en todas las tablas (crítico para RLS + performance)
CREATE INDEX IF NOT EXISTS idx_perfiles_empresa    ON perfiles_usuarios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_perfiles_user       ON perfiles_usuarios(user_id);
CREATE INDEX IF NOT EXISTS idx_categorias_empresa  ON categorias(empresa_id);
CREATE INDEX IF NOT EXISTS idx_proveedores_empresa ON proveedores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ubicaciones_empresa ON ubicaciones(empresa_id);
CREATE INDEX IF NOT EXISTS idx_posiciones_empresa  ON posiciones(empresa_id);
CREATE INDEX IF NOT EXISTS idx_posiciones_ubicacion ON posiciones(ubicacion_id);
-- Búsqueda por código de posición (Zona-Rack-Nivel)
CREATE INDEX IF NOT EXISTS idx_posiciones_codigo   ON posiciones(empresa_id, codigo);
CREATE INDEX IF NOT EXISTS idx_productos_empresa   ON productos(empresa_id);
-- Búsqueda por SKU (crítico para autocompletado)
CREATE INDEX IF NOT EXISTS idx_productos_sku       ON productos(empresa_id, sku);
CREATE INDEX IF NOT EXISTS idx_productos_nombre    ON productos(empresa_id, nombre text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_lotes_empresa       ON lotes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_lotes_producto      ON lotes(producto_id);
CREATE INDEX IF NOT EXISTS idx_lotes_vencimiento   ON lotes(fecha_vencimiento) WHERE fecha_vencimiento IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ordenes_empresa     ON ordenes_movimiento(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_estado      ON ordenes_movimiento(empresa_id, estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_tipo        ON ordenes_movimiento(empresa_id, tipo);
CREATE INDEX IF NOT EXISTS idx_ordenes_fecha       ON ordenes_movimiento(empresa_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_detalle_empresa     ON detalle_movimientos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_detalle_orden       ON detalle_movimientos(orden_id);
CREATE INDEX IF NOT EXISTS idx_detalle_producto    ON detalle_movimientos(producto_id);
CREATE INDEX IF NOT EXISTS idx_detalle_pos_origen  ON detalle_movimientos(posicion_origen_id) WHERE posicion_origen_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_detalle_pos_destino ON detalle_movimientos(posicion_destino_id) WHERE posicion_destino_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auditoria_empresa   ON auditoria(empresa_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla     ON auditoria(tabla, operacion);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha     ON auditoria(created_at DESC);


-- ============================================================
-- SECCIÓN 3: FUNCIONES AUXILIARES
-- ============================================================

-- ------------------------------------------------------------
-- 3.1  get_empresa_id()
--      Obtiene empresa_id del usuario autenticado.
--      SECURITY DEFINER: puede leer perfiles_usuarios sin RLS.
--      NUNCA confiar en empresa_id enviado desde el frontend.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_empresa_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id
  FROM   perfiles_usuarios
  WHERE  user_id = auth.uid()
    AND  activo  = true
  LIMIT  1;
$$;

-- ------------------------------------------------------------
-- 3.2  tiene_rol(rol_requerido)
--      Devuelve TRUE si el usuario tiene el rol indicado o 'admin'.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION tiene_rol(rol_requerido TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   perfiles_usuarios
    WHERE  user_id = auth.uid()
      AND  activo  = true
      AND  (rol = rol_requerido OR rol = 'admin')
  );
$$;

-- ------------------------------------------------------------
-- 3.3  get_stock_actual(producto_id, empresa_id)
--      Calcula stock en tiempo real sumando movimientos confirmados.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_stock_actual(
  p_producto_id UUID,
  p_empresa_id  UUID
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    SUM(
      CASE om.tipo
        WHEN 'ingreso'  THEN  dm.cantidad
        WHEN 'salida'   THEN -dm.cantidad
        WHEN 'ajuste'   THEN  dm.cantidad   -- ajuste positivo; usar salida para reducción
        ELSE 0                               -- traslado no cambia stock total
      END
    ), 0
  )
  FROM  detalle_movimientos dm
  JOIN  ordenes_movimiento  om ON dm.orden_id = om.id
  WHERE dm.producto_id = p_producto_id
    AND dm.empresa_id  = p_empresa_id
    AND om.estado      = 'confirmado';
$$;

-- ------------------------------------------------------------
-- 3.4  get_stock_por_posicion(producto_id, posicion_id, empresa_id)
--      Stock de un producto en una posición física específica.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_stock_por_posicion(
  p_producto_id UUID,
  p_posicion_id UUID,
  p_empresa_id  UUID
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    SUM(
      CASE
        WHEN om.tipo = 'ingreso'  AND dm.posicion_destino_id = p_posicion_id THEN  dm.cantidad
        WHEN om.tipo = 'salida'   AND dm.posicion_origen_id  = p_posicion_id THEN -dm.cantidad
        WHEN om.tipo = 'traslado' AND dm.posicion_destino_id = p_posicion_id THEN  dm.cantidad
        WHEN om.tipo = 'traslado' AND dm.posicion_origen_id  = p_posicion_id THEN -dm.cantidad
        WHEN om.tipo = 'ajuste'   AND dm.posicion_destino_id = p_posicion_id THEN  dm.cantidad
        ELSE 0
      END
    ), 0
  )
  FROM  detalle_movimientos dm
  JOIN  ordenes_movimiento  om ON dm.orden_id = om.id
  WHERE dm.producto_id = p_producto_id
    AND dm.empresa_id  = p_empresa_id
    AND om.estado      = 'confirmado'
    AND (dm.posicion_origen_id = p_posicion_id OR dm.posicion_destino_id = p_posicion_id);
$$;

-- ------------------------------------------------------------
-- 3.5  set_updated_at()  — trigger genérico para updated_at
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_updated_at_empresas
  BEFORE UPDATE ON empresas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_updated_at_perfiles
  BEFORE UPDATE ON perfiles_usuarios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_updated_at_proveedores
  BEFORE UPDATE ON proveedores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_updated_at_productos
  BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_updated_at_ordenes
  BEFORE UPDATE ON ordenes_movimiento
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- SECCIÓN 4: FUNCIÓN PRINCIPAL — confirmar_orden_movimiento()
--
-- Procesa una orden completa en una sola transacción atómica.
-- • Valida stock suficiente para salidas y traslados.
-- • Recalcula CPP (Costo Promedio Ponderado) en ingresos.
-- • Usa snapshot de CPP para salidas/traslados.
-- • Actualiza cantidades en lotes.
-- • Bloquea la fila con FOR UPDATE para evitar condiciones de carrera.
-- ============================================================
CREATE OR REPLACE FUNCTION confirmar_orden_movimiento(p_orden_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orden          ordenes_movimiento%ROWTYPE;
  v_detalle        detalle_movimientos%ROWTYPE;
  v_empresa_id     UUID;
  v_stock_actual   NUMERIC;
  v_cpp_actual     NUMERIC;
  v_cpp_nuevo      NUMERIC;
  v_costo_total    NUMERIC := 0;
BEGIN

  -- 1. Obtener y bloquear la orden (previene condiciones de carrera)
  SELECT * INTO v_orden
  FROM   ordenes_movimiento
  WHERE  id = p_orden_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Orden no encontrada');
  END IF;

  -- 2. Validar pertenencia a la empresa del usuario activo
  IF v_orden.empresa_id IS DISTINCT FROM get_empresa_id() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sin permisos sobre esta orden');
  END IF;

  -- 3. Solo se pueden confirmar órdenes en estado 'borrador'
  IF v_orden.estado <> 'borrador' THEN
    RETURN jsonb_build_object('success', false, 'error',
      'La orden ya fue ' || v_orden.estado || '. Solo se pueden confirmar órdenes en borrador.');
  END IF;

  v_empresa_id := v_orden.empresa_id;

  -- 4. Procesar cada línea de la orden
  FOR v_detalle IN
    SELECT * FROM detalle_movimientos WHERE orden_id = p_orden_id ORDER BY created_at
  LOOP

    -- ── SALIDA / TRASLADO: validar stock suficiente ──────────────────────
    IF v_orden.tipo IN ('salida', 'traslado') THEN

      -- Traslado: verificar stock en la posición de origen
      IF v_orden.tipo = 'traslado' AND v_detalle.posicion_origen_id IS NOT NULL THEN
        v_stock_actual := get_stock_por_posicion(
          v_detalle.producto_id,
          v_detalle.posicion_origen_id,
          v_empresa_id
        );
      ELSE
        v_stock_actual := get_stock_actual(v_detalle.producto_id, v_empresa_id);
      END IF;

      IF v_stock_actual < v_detalle.cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente. Producto: % | Disponible: % | Solicitado: %',
          v_detalle.producto_id, v_stock_actual, v_detalle.cantidad;
      END IF;

      -- Snapshot: registrar el CPP vigente como costo_unitario de la línea
      UPDATE detalle_movimientos
      SET    costo_unitario = (
               SELECT costo_promedio FROM productos WHERE id = v_detalle.producto_id
             )
      WHERE  id = v_detalle.id;

      -- Actualizar lote si aplica
      IF v_detalle.lote_id IS NOT NULL AND v_orden.tipo = 'salida' THEN
        UPDATE lotes
        SET    cantidad_disponible = cantidad_disponible - v_detalle.cantidad
        WHERE  id          = v_detalle.lote_id
          AND  empresa_id  = v_empresa_id;
      END IF;

    -- ── INGRESO: recalcular CPP ──────────────────────────────────────────
    ELSIF v_orden.tipo = 'ingreso' THEN

      SELECT costo_promedio
      INTO   v_cpp_actual
      FROM   productos
      WHERE  id = v_detalle.producto_id;

      v_stock_actual := get_stock_actual(v_detalle.producto_id, v_empresa_id);

      -- CPP = (stock × cpp_actual + cantidad_nueva × costo_ingreso) / (stock + cantidad_nueva)
      IF (v_stock_actual + v_detalle.cantidad) > 0 THEN
        v_cpp_nuevo := (
          v_stock_actual * COALESCE(v_cpp_actual, 0)
          + v_detalle.cantidad * v_detalle.costo_unitario
        ) / (v_stock_actual + v_detalle.cantidad);

        UPDATE productos
        SET    costo_promedio = ROUND(v_cpp_nuevo, 4),
               updated_at     = now()
        WHERE  id          = v_detalle.producto_id
          AND  empresa_id  = v_empresa_id;
      END IF;

      -- Actualizar lote si aplica
      IF v_detalle.lote_id IS NOT NULL THEN
        UPDATE lotes
        SET    cantidad_disponible = cantidad_disponible + v_detalle.cantidad
        WHERE  id          = v_detalle.lote_id
          AND  empresa_id  = v_empresa_id;
      END IF;

    END IF;

    -- Acumular costo total de la orden
    v_costo_total := v_costo_total + (v_detalle.cantidad * v_detalle.costo_unitario);

  END LOOP;

  -- 5. Marcar la orden como confirmada
  UPDATE ordenes_movimiento
  SET    estado      = 'confirmado',
         costo_total = ROUND(v_costo_total, 4),
         updated_at  = now()
  WHERE  id = p_orden_id;

  RETURN jsonb_build_object(
    'success',      true,
    'orden_id',     p_orden_id,
    'costo_total',  v_costo_total
  );

EXCEPTION WHEN OTHERS THEN
  -- El RAISE dentro del loop ya ejecuta rollback implícito en Supabase RPC
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


-- ============================================================
-- SECCIÓN 5: FUNCIÓN — anular_orden_movimiento()
--
-- Revierte una orden confirmada.
-- • Solo admin puede anular órdenes confirmadas.
-- • Revierte cantidades en lotes afectados.
-- • Nota: el CPP no se recalcula automáticamente al anular
--   (se registra en auditoría para revisión manual si es necesario).
-- ============================================================
CREATE OR REPLACE FUNCTION anular_orden_movimiento(
  p_orden_id UUID,
  p_motivo   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orden ordenes_movimiento%ROWTYPE;
BEGIN

  SELECT * INTO v_orden
  FROM   ordenes_movimiento
  WHERE  id = p_orden_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Orden no encontrada');
  END IF;

  IF v_orden.empresa_id IS DISTINCT FROM get_empresa_id() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sin permisos');
  END IF;

  IF v_orden.estado = 'anulado' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La orden ya está anulada');
  END IF;

  -- Revertir lotes si la orden estaba confirmada
  IF v_orden.estado = 'confirmado' THEN
    IF v_orden.tipo = 'ingreso' THEN
      UPDATE lotes l
      SET    cantidad_disponible = l.cantidad_disponible - dm.cantidad
      FROM   detalle_movimientos dm
      WHERE  dm.orden_id  = p_orden_id
        AND  dm.lote_id   = l.id
        AND  dm.lote_id IS NOT NULL;
    ELSIF v_orden.tipo = 'salida' THEN
      UPDATE lotes l
      SET    cantidad_disponible = l.cantidad_disponible + dm.cantidad
      FROM   detalle_movimientos dm
      WHERE  dm.orden_id = p_orden_id
        AND  dm.lote_id  = l.id
        AND  dm.lote_id IS NOT NULL;
    END IF;
    -- Nota: el CPP queda marcado para recálculo manual.
    -- En versiones futuras se puede agregar recálculo total de CPP por producto.
  END IF;

  UPDATE ordenes_movimiento
  SET    estado        = 'anulado',
         observaciones = COALESCE(observaciones, '')
                         || CASE WHEN p_motivo IS NOT NULL
                                 THEN E'\n[ANULADO] ' || p_motivo
                                 ELSE '' END,
         updated_at    = now()
  WHERE  id = p_orden_id;

  RETURN jsonb_build_object('success', true, 'orden_id', p_orden_id);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


-- ============================================================
-- SECCIÓN 6: TRIGGER DE AUDITORÍA
-- ============================================================
CREATE OR REPLACE FUNCTION fn_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_registro_id UUID;
BEGIN
  BEGIN
    IF TG_OP = 'DELETE' THEN
      v_empresa_id  := (row_to_json(OLD) ->> 'empresa_id')::UUID;
      v_registro_id := (row_to_json(OLD) ->> 'id')::UUID;
    ELSE
      v_empresa_id  := (row_to_json(NEW) ->> 'empresa_id')::UUID;
      v_registro_id := (row_to_json(NEW) ->> 'id')::UUID;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_empresa_id := NULL;
  END;

  INSERT INTO auditoria (empresa_id, tabla, operacion, registro_id, usuario_id, datos_anteriores, datos_nuevos)
  VALUES (
    v_empresa_id,
    TG_TABLE_NAME,
    TG_OP,
    v_registro_id,
    auth.uid(),
    CASE WHEN TG_OP <> 'INSERT' THEN row_to_json(OLD)::JSONB ELSE NULL END,
    CASE WHEN TG_OP <> 'DELETE' THEN row_to_json(NEW)::JSONB ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Aplicar auditoría a tablas críticas
CREATE TRIGGER trg_auditoria_productos
  AFTER INSERT OR UPDATE OR DELETE ON productos
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria();

CREATE TRIGGER trg_auditoria_ordenes
  AFTER INSERT OR UPDATE OR DELETE ON ordenes_movimiento
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria();

CREATE TRIGGER trg_auditoria_detalle
  AFTER INSERT OR UPDATE OR DELETE ON detalle_movimientos
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria();

CREATE TRIGGER trg_auditoria_lotes
  AFTER INSERT OR UPDATE OR DELETE ON lotes
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria();


-- ============================================================
-- SECCIÓN 7: VISTAS
-- ============================================================

-- ------------------------------------------------------------
-- 7.1  v_stock_actual  —  stock vigente por producto con CPP
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW v_stock_actual AS
SELECT
  p.empresa_id,
  p.id                AS producto_id,
  p.sku,
  p.nombre,
  c.nombre            AS categoria,
  p.unidad_medida,
  p.costo_promedio,
  p.precio_venta,
  p.stock_minimo,
  COALESCE(SUM(
    CASE om.tipo
      WHEN 'ingreso' THEN  dm.cantidad
      WHEN 'salida'  THEN -dm.cantidad
      WHEN 'ajuste'  THEN  dm.cantidad
      ELSE 0
    END
  ), 0)               AS stock_actual,
  -- Consumo promedio diario (salidas últimos 30 días / 30)
  ROUND(COALESCE(SUM(
    CASE WHEN om.tipo = 'salida'
              AND om.fecha >= now() - INTERVAL '30 days'
         THEN dm.cantidad ELSE 0 END
  ) / 30.0, 0), 4)   AS consumo_promedio_diario,
  -- Valor del inventario a CPP
  p.costo_promedio * COALESCE(SUM(
    CASE om.tipo
      WHEN 'ingreso' THEN  dm.cantidad
      WHEN 'salida'  THEN -dm.cantidad
      WHEN 'ajuste'  THEN  dm.cantidad
      ELSE 0
    END
  ), 0)               AS valor_inventario
FROM       productos p
LEFT JOIN  categorias           c  ON p.categoria_id = c.id
LEFT JOIN  detalle_movimientos  dm ON dm.producto_id = p.id AND dm.empresa_id = p.empresa_id
LEFT JOIN  ordenes_movimiento   om ON dm.orden_id = om.id AND om.estado = 'confirmado'
GROUP BY p.empresa_id, p.id, p.sku, p.nombre, c.nombre,
         p.unidad_medida, p.costo_promedio, p.precio_venta, p.stock_minimo;

-- ------------------------------------------------------------
-- 7.2  v_tabla_principal  —  tabla dashboard con reglas de negocio
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW v_tabla_principal AS
SELECT
  va.*,
  -- Días de inventario
  CASE
    WHEN va.consumo_promedio_diario = 0 THEN NULL
    ELSE ROUND(va.stock_actual / va.consumo_promedio_diario, 1)
  END                 AS dias_inventario,
  -- Estado según regla < 45 días = Reponer
  CASE
    WHEN va.consumo_promedio_diario = 0        THEN 'Sin consumo'
    WHEN va.stock_actual / va.consumo_promedio_diario < 45 THEN 'Reponer'
    ELSE 'Óptimo'
  END                 AS estado,
  -- Cantidad a reponer: (consumo_mensual × 45) - stock_actual, mínimo 0
  CASE
    WHEN va.consumo_promedio_diario = 0 THEN 0
    ELSE GREATEST(0, ROUND((va.consumo_promedio_diario * 30 * 45) - va.stock_actual, 3))
  END                 AS cantidad_reponer
FROM v_stock_actual va;

-- ------------------------------------------------------------
-- 7.3  v_stock_por_posicion  —  stock físico en cada Zona-Rack-Nivel
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW v_stock_por_posicion AS
SELECT
  dm.empresa_id,
  p.id          AS producto_id,
  p.sku,
  p.nombre      AS producto_nombre,
  u.id          AS ubicacion_id,
  u.nombre      AS ubicacion_nombre,
  pos.id        AS posicion_id,
  pos.codigo    AS posicion_codigo,    -- Ej: A-3-2
  pos.zona,
  pos.rack,
  pos.nivel,
  SUM(
    CASE
      WHEN om.tipo IN ('ingreso','ajuste') AND dm.posicion_destino_id = pos.id THEN  dm.cantidad
      WHEN om.tipo = 'salida'              AND dm.posicion_origen_id  = pos.id THEN -dm.cantidad
      WHEN om.tipo = 'traslado'            AND dm.posicion_destino_id = pos.id THEN  dm.cantidad
      WHEN om.tipo = 'traslado'            AND dm.posicion_origen_id  = pos.id THEN -dm.cantidad
      ELSE 0
    END
  )             AS stock_posicion
FROM   detalle_movimientos dm
JOIN   ordenes_movimiento  om  ON dm.orden_id       = om.id AND om.estado = 'confirmado'
JOIN   productos           p   ON dm.producto_id    = p.id
JOIN   posiciones          pos ON (dm.posicion_origen_id = pos.id OR dm.posicion_destino_id = pos.id)
JOIN   ubicaciones         u   ON pos.ubicacion_id  = u.id
GROUP  BY dm.empresa_id, p.id, p.sku, p.nombre,
          u.id, u.nombre, pos.id, pos.codigo, pos.zona, pos.rack, pos.nivel
HAVING SUM(
    CASE
      WHEN om.tipo IN ('ingreso','ajuste') AND dm.posicion_destino_id = pos.id THEN  dm.cantidad
      WHEN om.tipo = 'salida'              AND dm.posicion_origen_id  = pos.id THEN -dm.cantidad
      WHEN om.tipo = 'traslado'            AND dm.posicion_destino_id = pos.id THEN  dm.cantidad
      WHEN om.tipo = 'traslado'            AND dm.posicion_origen_id  = pos.id THEN -dm.cantidad
      ELSE 0
    END
  ) <> 0;

-- ------------------------------------------------------------
-- 7.4  v_dashboard_stock_categoria  —  gráfico 1 del dashboard
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW v_dashboard_stock_categoria AS
SELECT
  va.empresa_id,
  c.id          AS categoria_id,
  c.nombre      AS categoria,
  COUNT(DISTINCT va.producto_id) AS total_productos,
  SUM(va.stock_actual)           AS stock_total,
  SUM(va.valor_inventario)       AS valor_total
FROM  v_stock_actual va
JOIN  productos      p  ON va.producto_id = p.id
JOIN  categorias     c  ON p.categoria_id = c.id
GROUP BY va.empresa_id, c.id, c.nombre;

-- ------------------------------------------------------------
-- 7.5  v_salidas_mensuales  —  gráfico 2 del dashboard (últimos 12 meses)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW v_salidas_mensuales AS
SELECT
  dm.empresa_id,
  DATE_TRUNC('month', om.fecha)  AS mes,
  COUNT(DISTINCT om.id)          AS total_ordenes,
  SUM(dm.cantidad)               AS cantidad_total,
  SUM(dm.costo_total)            AS costo_total
FROM  detalle_movimientos dm
JOIN  ordenes_movimiento  om ON dm.orden_id = om.id
WHERE om.tipo    = 'salida'
  AND om.estado  = 'confirmado'
  AND om.fecha  >= now() - INTERVAL '12 months'
GROUP BY dm.empresa_id, DATE_TRUNC('month', om.fecha)
ORDER BY mes;


-- ============================================================
-- SECCIÓN 8: ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE empresas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles_usuarios   ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias          ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ubicaciones         ENABLE ROW LEVEL SECURITY;
ALTER TABLE posiciones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_movimiento  ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalle_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria           ENABLE ROW LEVEL SECURITY;

-- IMPORTANTE: Forzar RLS incluso para el rol owner (solo service_role lo bypasea)
ALTER TABLE empresas            FORCE ROW LEVEL SECURITY;
ALTER TABLE perfiles_usuarios   FORCE ROW LEVEL SECURITY;
ALTER TABLE categorias          FORCE ROW LEVEL SECURITY;
ALTER TABLE proveedores         FORCE ROW LEVEL SECURITY;
ALTER TABLE ubicaciones         FORCE ROW LEVEL SECURITY;
ALTER TABLE posiciones          FORCE ROW LEVEL SECURITY;
ALTER TABLE productos           FORCE ROW LEVEL SECURITY;
ALTER TABLE lotes               FORCE ROW LEVEL SECURITY;
ALTER TABLE ordenes_movimiento  FORCE ROW LEVEL SECURITY;
ALTER TABLE detalle_movimientos FORCE ROW LEVEL SECURITY;
ALTER TABLE auditoria           FORCE ROW LEVEL SECURITY;

-- ── EMPRESAS ─────────────────────────────────────────────────────────────────
CREATE POLICY "empresas_ver_propia"
  ON empresas FOR SELECT
  USING (id = get_empresa_id());

CREATE POLICY "empresas_editar_propia"
  ON empresas FOR UPDATE
  USING (id = get_empresa_id() AND tiene_rol('admin'));

-- ── PERFILES_USUARIOS ────────────────────────────────────────────────────────
CREATE POLICY "perfiles_ver_empresa"
  ON perfiles_usuarios FOR SELECT
  USING (empresa_id = get_empresa_id());

CREATE POLICY "perfiles_crear"
  ON perfiles_usuarios FOR INSERT
  WITH CHECK (empresa_id = get_empresa_id() AND tiene_rol('admin'));

CREATE POLICY "perfiles_editar"
  ON perfiles_usuarios FOR UPDATE
  USING (empresa_id = get_empresa_id()
    AND (tiene_rol('admin') OR user_id = auth.uid()));

CREATE POLICY "perfiles_eliminar"
  ON perfiles_usuarios FOR DELETE
  USING (empresa_id = get_empresa_id() AND tiene_rol('admin'));

-- ── CATEGORIAS ───────────────────────────────────────────────────────────────
CREATE POLICY "categorias_ver"    ON categorias FOR SELECT USING (empresa_id = get_empresa_id());
CREATE POLICY "categorias_crear"  ON categorias FOR INSERT WITH CHECK (empresa_id = get_empresa_id() AND tiene_rol('operador'));
CREATE POLICY "categorias_editar" ON categorias FOR UPDATE USING (empresa_id = get_empresa_id() AND tiene_rol('operador'));
CREATE POLICY "categorias_borrar" ON categorias FOR DELETE USING (empresa_id = get_empresa_id() AND tiene_rol('admin'));

-- ── PROVEEDORES ──────────────────────────────────────────────────────────────
CREATE POLICY "proveedores_ver"    ON proveedores FOR SELECT USING (empresa_id = get_empresa_id());
CREATE POLICY "proveedores_crear"  ON proveedores FOR INSERT WITH CHECK (empresa_id = get_empresa_id() AND tiene_rol('operador'));
CREATE POLICY "proveedores_editar" ON proveedores FOR UPDATE USING (empresa_id = get_empresa_id() AND tiene_rol('operador'));
CREATE POLICY "proveedores_borrar" ON proveedores FOR DELETE USING (empresa_id = get_empresa_id() AND tiene_rol('admin'));

-- ── UBICACIONES ──────────────────────────────────────────────────────────────
CREATE POLICY "ubicaciones_ver"    ON ubicaciones FOR SELECT USING (empresa_id = get_empresa_id());
CREATE POLICY "ubicaciones_crear"  ON ubicaciones FOR INSERT WITH CHECK (empresa_id = get_empresa_id() AND tiene_rol('admin'));
CREATE POLICY "ubicaciones_editar" ON ubicaciones FOR UPDATE USING (empresa_id = get_empresa_id() AND tiene_rol('admin'));
CREATE POLICY "ubicaciones_borrar" ON ubicaciones FOR DELETE USING (empresa_id = get_empresa_id() AND tiene_rol('admin'));

-- ── POSICIONES ───────────────────────────────────────────────────────────────
CREATE POLICY "posiciones_ver"    ON posiciones FOR SELECT USING (empresa_id = get_empresa_id());
CREATE POLICY "posiciones_crear"  ON posiciones FOR INSERT WITH CHECK (empresa_id = get_empresa_id() AND tiene_rol('admin'));
CREATE POLICY "posiciones_editar" ON posiciones FOR UPDATE USING (empresa_id = get_empresa_id() AND tiene_rol('admin'));
CREATE POLICY "posiciones_borrar" ON posiciones FOR DELETE USING (empresa_id = get_empresa_id() AND tiene_rol('admin'));

-- ── PRODUCTOS ────────────────────────────────────────────────────────────────
CREATE POLICY "productos_ver"    ON productos FOR SELECT USING (empresa_id = get_empresa_id());
CREATE POLICY "productos_crear"  ON productos FOR INSERT WITH CHECK (empresa_id = get_empresa_id() AND tiene_rol('operador'));
CREATE POLICY "productos_editar" ON productos FOR UPDATE USING (empresa_id = get_empresa_id() AND tiene_rol('operador'));
CREATE POLICY "productos_borrar" ON productos FOR DELETE USING (empresa_id = get_empresa_id() AND tiene_rol('admin'));

-- ── LOTES ────────────────────────────────────────────────────────────────────
CREATE POLICY "lotes_ver"    ON lotes FOR SELECT USING (empresa_id = get_empresa_id());
CREATE POLICY "lotes_crear"  ON lotes FOR INSERT WITH CHECK (empresa_id = get_empresa_id() AND tiene_rol('operador'));
CREATE POLICY "lotes_editar" ON lotes FOR UPDATE USING (empresa_id = get_empresa_id() AND tiene_rol('operador'));
CREATE POLICY "lotes_borrar" ON lotes FOR DELETE USING (empresa_id = get_empresa_id() AND tiene_rol('admin'));

-- ── ORDENES_MOVIMIENTO ───────────────────────────────────────────────────────
CREATE POLICY "ordenes_ver"    ON ordenes_movimiento FOR SELECT USING (empresa_id = get_empresa_id());
CREATE POLICY "ordenes_crear"  ON ordenes_movimiento FOR INSERT WITH CHECK (empresa_id = get_empresa_id() AND tiene_rol('operador'));
CREATE POLICY "ordenes_editar" ON ordenes_movimiento FOR UPDATE USING (empresa_id = get_empresa_id() AND tiene_rol('operador'));
CREATE POLICY "ordenes_borrar" ON ordenes_movimiento FOR DELETE USING (empresa_id = get_empresa_id() AND tiene_rol('admin'));

-- ── DETALLE_MOVIMIENTOS ──────────────────────────────────────────────────────
CREATE POLICY "detalle_ver"    ON detalle_movimientos FOR SELECT USING (empresa_id = get_empresa_id());
CREATE POLICY "detalle_crear"  ON detalle_movimientos FOR INSERT WITH CHECK (empresa_id = get_empresa_id() AND tiene_rol('operador'));
CREATE POLICY "detalle_editar" ON detalle_movimientos FOR UPDATE USING (empresa_id = get_empresa_id() AND tiene_rol('operador'));
CREATE POLICY "detalle_borrar" ON detalle_movimientos FOR DELETE USING (empresa_id = get_empresa_id() AND tiene_rol('admin'));

-- ── AUDITORÍA — solo lectura para admin (escritura solo via trigger) ─────────
CREATE POLICY "auditoria_ver"
  ON auditoria FOR SELECT
  USING (empresa_id = get_empresa_id() AND tiene_rol('admin'));


-- ============================================================
-- SECCIÓN 9: PERMISOS
-- ============================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION get_empresa_id()                          TO authenticated;
GRANT EXECUTE ON FUNCTION tiene_rol(TEXT)                           TO authenticated;
GRANT EXECUTE ON FUNCTION get_stock_actual(UUID, UUID)              TO authenticated;
GRANT EXECUTE ON FUNCTION get_stock_por_posicion(UUID, UUID, UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION confirmar_orden_movimiento(UUID)          TO authenticated;
GRANT EXECUTE ON FUNCTION anular_orden_movimiento(UUID, TEXT)       TO authenticated;

-- auditoria: solo service_role puede insertar directamente (el trigger lo maneja)
REVOKE INSERT, UPDATE, DELETE ON auditoria FROM authenticated;


-- ============================================================
-- SECCIÓN 10: DATOS DE PRUEBA (descomenta para testing)
-- ============================================================
/*
-- Primero crea el usuario en Supabase Auth, luego ejecuta:

INSERT INTO empresas (id, nombre, plan)
VALUES ('00000000-0000-0000-0000-000000000001', 'Empresa Demo', 'pro');

INSERT INTO perfiles_usuarios (user_id, empresa_id, rol, nombre, email)
VALUES (
  '<UUID del usuario en auth.users>',
  '00000000-0000-0000-0000-000000000001',
  'admin',
  'Admin Demo',
  'admin@demo.com'
);

INSERT INTO ubicaciones (empresa_id, nombre, codigo, tipo)
VALUES ('00000000-0000-0000-0000-000000000001', 'Centro Distribución Principal', 'CD-01', 'centro_distribucion');

INSERT INTO posiciones (empresa_id, ubicacion_id, zona, rack, nivel)
VALUES
  ('00000000-0000-0000-0000-000000000001', '<ubicacion_id>', 'A', '1', '1'),  -- A-1-1
  ('00000000-0000-0000-0000-000000000001', '<ubicacion_id>', 'A', '1', '2'),  -- A-1-2
  ('00000000-0000-0000-0000-000000000001', '<ubicacion_id>', 'B', '3', '1'),  -- B-3-1
  ('00000000-0000-0000-0000-000000000001', '<ubicacion_id>', 'Z', '1', '3');  -- Z-1-3
*/
