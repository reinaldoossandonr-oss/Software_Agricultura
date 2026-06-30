# Guía de Deploy — Axioma Flux

Guía paso a paso para llevar el proyecto a producción.
Stack: **Supabase** (BD) · **Render** (Backend) · **Vercel** (Frontend)

---

## Prerequisitos

- Cuenta en [GitHub](https://github.com)
- Cuenta en [Render](https://render.com)
- Cuenta en [Vercel](https://vercel.com)
- Proyecto en Supabase ya configurado ✅ (schema aplicado en Fase 2)

---

## PASO 1 — Obtener credenciales de Supabase

En tu dashboard de Supabase → **Settings → API**:

| Variable | Dónde encontrarla |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | Project API keys → **anon public** |
| `SUPABASE_SERVICE_ROLE_KEY` | Project API keys → **service_role** ⚠️ mantener secreto |
| `SUPABASE_JWT_SECRET` | JWT Settings → JWT Secret |

> ⚠️ **NUNCA** expongas `SUPABASE_SERVICE_ROLE_KEY` ni `SUPABASE_JWT_SECRET` en el código o en GitHub.

---

## PASO 2 — Subir el código a GitHub

```bash
# En la carpeta raíz del proyecto
git init
git add .
git commit -m "feat: initial commit — Axioma Flux SaaS Inventario"

# Crear repositorio en GitHub (privado recomendado) y luego:
git remote add origin https://github.com/TU_USUARIO/axioma-flux.git
git branch -M main
git push -u origin main
```

---

## PASO 3 — Deploy del Backend en Render

1. Ir a [render.com/new](https://render.com/new) → **Web Service**
2. Conectar tu repositorio de GitHub
3. Configurar:
   - **Name:** `axioma-flux-api`
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. En **Environment Variables**, agregar:

```
SUPABASE_URL          = https://legtxgdwqjfzvlvheaao.supabase.co
SUPABASE_ANON_KEY     = <tu anon key>
SUPABASE_SERVICE_ROLE_KEY = <tu service role key>
SUPABASE_JWT_SECRET   = <tu jwt secret>
ALLOWED_ORIGINS       = http://localhost:3000    ← actualizar después con URL de Vercel
ENVIRONMENT           = production
```

5. Click **Create Web Service**
6. Esperar el deploy (2-3 minutos)
7. **Copiar la URL del servicio:** `https://axioma-flux-api.onrender.com`

> 💡 **Nota plan gratuito:** Render free tiene cold starts de ~30 segundos si el servicio está inactivo. Para producción real, usar el plan Starter ($7/mes).

---

## PASO 4 — Deploy del Frontend en Vercel

1. Ir a [vercel.com/new](https://vercel.com/new)
2. Importar tu repositorio de GitHub
3. Configurar:
   - **Framework Preset:** Next.js (detectado automáticamente)
   - **Root Directory:** `frontend`
4. En **Environment Variables**, agregar:

```
NEXT_PUBLIC_SUPABASE_URL      = https://legtxgdwqjfzvlvheaao.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = <tu anon key>
NEXT_PUBLIC_API_URL           = https://axioma-flux-api.onrender.com
```

5. Click **Deploy**
6. Esperar el deploy (1-2 minutos)
7. **Copiar la URL del frontend:** `https://axioma-flux.vercel.app`

---

## PASO 5 — Actualizar CORS en Render

Ahora que tienes la URL de Vercel, actualiza la variable `ALLOWED_ORIGINS` en Render:

1. Render Dashboard → tu servicio → **Environment**
2. Editar `ALLOWED_ORIGINS`:
   ```
   https://axioma-flux.vercel.app,http://localhost:3000
   ```
3. **Save Changes** → Render redeploya automáticamente

---

## PASO 6 — Crear el primer usuario administrador

1. Ve a tu dashboard de Supabase → **Authentication → Users**
2. Click **Add user** → ingresa email y contraseña del primer admin
3. Copia el UUID del usuario creado
4. Ve a **SQL Editor** y ejecuta:

```sql
-- Primero crear la empresa
INSERT INTO empresas (nombre, plan)
VALUES ('Tu Empresa SA', 'pro')
RETURNING id;

-- Luego crear el perfil (reemplaza los UUIDs)
INSERT INTO perfiles_usuarios (user_id, empresa_id, rol, nombre, email)
VALUES (
  '<UUID del usuario en auth.users>',
  '<UUID de la empresa recién creada>',
  'admin',
  'Nombre del Admin',
  'admin@tuempresa.com'
);
```

5. Ir a la URL de Vercel → ingresar con las credenciales → ¡listo!

---

## PASO 7 — Configurar usuarios adicionales

Para agregar más usuarios a la misma empresa:

1. Crear usuario en Supabase Auth (o enviar invitación)
2. Insertar en `perfiles_usuarios` con el mismo `empresa_id` y el rol correspondiente:
   - `admin` → acceso total
   - `operador` → crear/editar movimientos y productos
   - `viewer` → solo lectura

---

## Flujo de actualizaciones

Gracias a `autoDeploy: true` en `render.yaml`:

```
Haces push a main en GitHub
        ↓
Render redeploya el backend automáticamente
        ↓
Vercel redeploya el frontend automáticamente
```

---

## Variables de entorno — Resumen completo

### Backend (Render)
| Variable | Descripción | Secreto |
|---|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase | No |
| `SUPABASE_ANON_KEY` | Clave pública de Supabase | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave admin de Supabase | ⚠️ Sí |
| `SUPABASE_JWT_SECRET` | Secret para verificar JWTs | ⚠️ Sí |
| `ALLOWED_ORIGINS` | URLs del frontend separadas por coma | No |
| `ENVIRONMENT` | `production` | No |

### Frontend (Vercel)
| Variable | Descripción | Secreto |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública de Supabase | No |
| `NEXT_PUBLIC_API_URL` | URL del backend en Render | No |

---

## Verificación final

Después del deploy, verificar que todo funcione:

- [ ] `GET https://axioma-flux-api.onrender.com/health` → `{"status": "ok"}`
- [ ] `GET https://axioma-flux-api.onrender.com/docs` → Swagger UI visible
- [ ] Login en Vercel con el usuario admin creado
- [ ] Dashboard carga sin errores
- [ ] Crear una categoría en Catálogos → Categorías
- [ ] Crear un producto de prueba
- [ ] Crear una orden de ingreso con ese producto y confirmarla
- [ ] Verificar que el stock se actualice en el Dashboard
