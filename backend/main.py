"""
Axioma Flux — SaaS Gestión de Inventario
Backend: FastAPI + Supabase (PostgreSQL)

Principios:
  • Security by design: empresa_id siempre desde JWT, nunca del cliente.
  • Multi-tenant isolation: RLS en BD + validación en cada endpoint.
  • Atomic operations: confirmar/anular órdenes via funciones PostgreSQL.
  • Nunca se expone service_role al frontend.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config.settings import settings
from routers import auth, catalogs, ubicaciones, productos, ordenes, dashboard

app = FastAPI(
    title="Axioma Flux — Inventario API",
    description="Backend SaaS multi-tenant para gestión de inventario con posiciones físicas.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ─────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── ROUTERS ──────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(productos.router)
app.include_router(catalogs.router)
app.include_router(ubicaciones.router)
app.include_router(ordenes.router)


# ── HEALTH CHECK ─────────────────────────────────────────────
@app.get("/", tags=["health"], summary="Health check")
async def root():
    return {"status": "ok", "app": "Axioma Flux API", "version": "1.0.0"}


@app.get("/health", tags=["health"], summary="Health check detallado")
async def health():
    return {
        "status": "ok",
        "environment": settings.ENVIRONMENT,
        "supabase_url": settings.SUPABASE_URL,
    }
