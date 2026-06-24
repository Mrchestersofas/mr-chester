-- ============================================================
-- MR. CHESTER — Base de datos Supabase
-- Ejecuta este SQL en: Supabase > SQL Editor > New query
-- ============================================================

-- CLIENTES
create table clientes (
  id uuid default gen_random_uuid() primary key,
  nombre text not null,
  telefono text,
  email text,
  created_at timestamptz default now()
);

-- PEDIDOS
create table pedidos (
  id uuid default gen_random_uuid() primary key,
  numero text unique not null,  -- ej: MC-081
  cliente_id uuid references clientes(id),
  tipo_sofa text not null,
  material text not null,
  color text not null,
  cantidad int not null default 1,
  fecha_entrega date not null,
  prioridad text not null default 'normal', -- normal | alta | urgente
  estado text not null default 'pendiente', -- pendiente | estructura | tapizado | costura | control_calidad | listo | entregado
  precio_venta numeric(12,2) not null default 0,
  observaciones text,
  created_at timestamptz default now()
);

-- MATERIALES / INVENTARIO
create table materiales (
  id uuid default gen_random_uuid() primary key,
  nombre text not null,
  stock_actual numeric(10,2) not null default 0,
  stock_minimo numeric(10,2) not null default 0,
  unidad text not null,  -- kg | metro | m2 | unidad | rollo
  costo_unitario numeric(12,2) not null default 0,
  proveedor text,
  created_at timestamptz default now()
);

-- COMPONENTES POR TIPO DE SOFÁ (receta de materiales)
create table componentes_sofa (
  id uuid default gen_random_uuid() primary key,
  tipo_sofa text not null,
  material_id uuid references materiales(id),
  cantidad_requerida numeric(10,2) not null
);

-- HISTORIAL DE ESTADOS (trazabilidad del pedido)
create table historial_estados (
  id uuid default gen_random_uuid() primary key,
  pedido_id uuid references pedidos(id),
  estado_anterior text,
  estado_nuevo text not null,
  nota text,
  created_at timestamptz default now()
);

-- ============================================================
-- DATOS DE EJEMPLO — Materiales
-- ============================================================
insert into materiales (nombre, stock_actual, stock_minimo, unidad, costo_unitario, proveedor) values
  ('Espuma HR-40',        18,  50,  'kg',     12500,  'Espumas del Valle'),
  ('Tela lino gris',      12,  30,  'metro',  18000,  'Textiles Andinos'),
  ('Cuero natural café',  45,  20,  'm2',     85000,  'Cueros Premium'),
  ('Madera pino',        280, 100,  'metro',   4200,  'Maderas del Norte'),
  ('Hilo tapicero #40',    3,  10,  'rollo',   8500,  'Insumos Textiles'),
  ('Terciopelo azul',     38,  15,  'metro',  32000,  'Textiles Andinos'),
  ('Resortes zigzag',    120,  60,  'unidad',  1800,  'Herrajes y Más'),
  ('Pegante tapicero',     8,   5,  'litro',  15000,  'Insumos Textiles'),
  ('Guata sintética',     25,  10,  'kg',      9500,  'Espumas del Valle'),
  ('Cuero sintético',     60,  25,  'metro',  28000,  'Cueros Premium');

-- ============================================================
-- DATOS DE EJEMPLO — Clientes
-- ============================================================
insert into clientes (nombre, telefono, email) values
  ('Almacenes ABC',  '3001234567', 'compras@almacenesabc.com'),
  ('Decorarte S.A.', '3109876543', 'pedidos@decorarte.co'),
  ('Casa Concept',   '3204567890', 'diseño@casaconcept.com'),
  ('Muebles Norte',  '3156789012', 'ventas@mueblesnorte.co'),
  ('Hogar y Más',    '3012345678', 'info@hogarymas.com');

-- ============================================================
-- FUNCIÓN: Generar número de pedido automático
-- ============================================================
create or replace function generar_numero_pedido()
returns trigger as $$
declare
  ultimo int;
begin
  select coalesce(max(cast(split_part(numero, '-', 2) as int)), 0)
  into ultimo
  from pedidos;
  new.numero := 'MC-' || lpad((ultimo + 1)::text, 3, '0');
  return new;
end;
$$ language plpgsql;

create trigger trigger_numero_pedido
before insert on pedidos
for each row
when (new.numero is null or new.numero = '')
execute function generar_numero_pedido();

-- ============================================================
-- FUNCIÓN: Guardar historial automático de cambios de estado
-- ============================================================
create or replace function registrar_cambio_estado()
returns trigger as $$
begin
  if old.estado is distinct from new.estado then
    insert into historial_estados (pedido_id, estado_anterior, estado_nuevo)
    values (new.id, old.estado, new.estado);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trigger_historial_estado
after update on pedidos
for each row
execute function registrar_cambio_estado();

-- ============================================================
-- PERMISOS (Row Level Security) — por ahora abierto para pruebas
-- Activa RLS y agrega autenticación cuando estés listo
-- ============================================================
alter table clientes enable row level security;
alter table pedidos enable row level security;
alter table materiales enable row level security;
alter table componentes_sofa enable row level security;
alter table historial_estados enable row level security;

create policy "acceso_total" on clientes for all using (true);
create policy "acceso_total" on pedidos for all using (true);
create policy "acceso_total" on materiales for all using (true);
create policy "acceso_total" on componentes_sofa for all using (true);
create policy "acceso_total" on historial_estados for all using (true);
