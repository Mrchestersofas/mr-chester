# 🛋️ Mr. Chester — Sistema de Gestión de Fábrica

## Qué incluye esta versión
- ✅ Dashboard con métricas en tiempo real
- ✅ Registro y seguimiento de pedidos
- ✅ Formulario de nuevo pedido
- ✅ Programación de producción con tablero Kanban
- ✅ Inventario de materiales con alertas de stock
- ✅ Costos y márgenes por tipo de sofá
- ✅ Directorio de clientes con notificaciones por WhatsApp
- ✅ Historial automático de cambios de estado

---

## Instalación paso a paso

### Paso 1 — Crear la base de datos (Supabase, gratis)

1. Ve a [https://supabase.com](https://supabase.com) y crea una cuenta gratis
2. Crea un proyecto nuevo (elige la región más cercana a Colombia: US East)
3. Ve a **SQL Editor** → **New query**
4. Copia y pega el contenido del archivo `src/lib/schema.sql`
5. Haz clic en **Run** — esto crea todas las tablas y carga datos de ejemplo
6. Ve a **Settings → API** y copia:
   - `Project URL` (algo como `https://abc123.supabase.co`)
   - `anon public` key

### Paso 2 — Configurar las variables de entorno

1. En la carpeta del proyecto, copia el archivo de ejemplo:
   ```
   cp .env.example .env.local
   ```
2. Abre `.env.local` y pega las credenciales de Supabase:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anonima
   ```

### Paso 3 — Instalar Node.js (si no lo tienes)

1. Ve a [https://nodejs.org](https://nodejs.org) y descarga la versión LTS
2. Instala y verifica que funcione:
   ```
   node --version
   ```

### Paso 4 — Instalar y ejecutar la aplicación

Abre una terminal en la carpeta del proyecto y ejecuta:

```bash
npm install
npm run dev
```

Abre tu navegador en: **http://localhost:3000**

### Paso 5 — Publicar en internet (Vercel, gratis)

1. Ve a [https://vercel.com](https://vercel.com) y crea una cuenta gratis
2. Sube la carpeta del proyecto a [https://github.com](https://github.com)
3. En Vercel, haz clic en **New Project** y conecta tu repositorio de GitHub
4. Agrega las variables de entorno (`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
5. Haz clic en **Deploy** — ¡en 2 minutos tienes tu app en internet!

---

## Módulos incluidos

| Módulo | Ruta | Descripción |
|---|---|---|
| Dashboard | `/` | Métricas, alertas y resumen del día |
| Pedidos | `/pedidos` | Lista completa con filtros y cambio de estado |
| Nuevo pedido | `/pedidos/nuevo` | Formulario completo |
| Producción | `/produccion` | Tablero Kanban + tabla por fecha de entrega |
| Materiales | `/materiales` | Inventario con alertas y actualización de stock |
| Costos | `/costos` | Márgenes por tipo de sofá y por pedido |
| Clientes | `/clientes` | Directorio con historial y notificación WhatsApp |

---

## Próximas funcionalidades (siguiente versión)

- [ ] Login con contraseña para proteger el sistema
- [ ] App móvil (PWA instalable en celular)
- [ ] Notificaciones automáticas por email
- [ ] Exportar órdenes de compra en PDF
- [ ] Calendario visual de producción (Gantt)
- [ ] Módulo de operarios y asignación de tareas
- [ ] Reportes mensuales en Excel

---

## Soporte

Si tienes problemas con la instalación, el error más común es:
- **Variables de entorno incorrectas**: verifica que `.env.local` tenga las credenciales exactas de Supabase
- **Node.js no instalado**: necesitas la versión 18 o superior

Versión: 1.0.0 | Mr. Chester Factory ERP
