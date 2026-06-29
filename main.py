from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from pydantic import BaseModel
import os
import uuid
from dotenv import load_dotenv

# Configuración
load_dotenv()
app = FastAPI(title="Axioma Logística API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

# --- MODELOS ---
class Movimiento(BaseModel):
    producto_id: str 
    tipo: str
    cantidad: float
    ubicacion_id: str = None 

# --- FUNCION AUXILIAR DE SEGURIDAD ---
def get_secure_client(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token no proporcionado o inválido")
    
    token = auth_header.split(" ")[1]
    supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    supabase.postgrest.auth(token)
    return supabase

# --- ENDPOINTS ---

@app.get("/")
def ruta_raiz():
    return {"status": "online", "message": "Backend Axioma Logística listo"}

# Nuevo endpoint para obtener info de empresa
@app.get("/api/v1/usuario/info")
def obtener_info_usuario(request: Request):
    try:
        supabase = get_secure_client(request)
        user = supabase.auth.get_user()
        
        # Consultamos el empresa_id asociado al UID del token en tu tabla de perfiles
        info = supabase.table("perfiles_usuario") \
            .select("empresa_id") \
            .eq("user_id", user.user.id) \
            .single().execute()
            
        return {"empresa_id": info.data["empresa_id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 1. Obtener inventario
@app.get("/api/v1/logistica/stock")
def obtener_stock(request: Request):
    try:
        supabase = get_secure_client(request)
        response = supabase.table("vista_stock_detallado").select("producto_id, sku, nombre, stock_actual").execute()
        return {"success": True, "data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 2. Obtener reporte completo
@app.get("/api/v1/logistica/reporte-inventario")
def obtener_reporte_inventario(request: Request):
    try:
        supabase = get_secure_client(request)
        response = supabase.table("vista_reporte_inventario").select("*").execute()
        return {"success": True, "data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 3. Ventas diarias
@app.get("/api/v1/logistica/ventas-diarias")
def obtener_ventas_diarias(request: Request):
    try:
        supabase = get_secure_client(request)
        response = supabase.table("vista_ventas_diarias").select("*").execute()
        labels = [str(row['fecha']) for row in response.data]
        data = [float(row['total_ventas']) for row in response.data]
        return {"labels": labels, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
# 4. Registrar movimiento
@app.post("/api/v1/logistica/movimientos")
def registrar_movimiento(movimiento: Movimiento, request: Request):
    try:
        supabase = get_secure_client(request)
        data_to_insert = movimiento.dict(exclude_none=True)
        data_to_insert["id"] = str(uuid.uuid4())
        supabase.table("movimientos").insert(data_to_insert).execute()
        return {"success": True, "message": "Movimiento registrado correctamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))