from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client
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
        raise HTTPException(status_code=401, detail="Token no proporcionado")
    
    token = auth_header.split(" ")[1]
    supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    supabase.postgrest.auth(token)
    return supabase, token

# --- FUNCION MAESTRA: OBTENER EMPRESA POR EMAIL ---
def obtener_empresa_id(supabase, token):
    user_auth = supabase.auth.get_user(token)
    email = user_auth.user.email
    
    perfil = supabase.table("perfiles_usuario") \
        .select("empresa_id") \
        .eq("email", email) \
        .single().execute()
        
    return perfil.data["empresa_id"]

# --- ENDPOINTS ---

@app.get("/api/v1/usuario/info")
def obtener_info_usuario(request: Request):
    try:
        supabase, token = get_secure_client(request)
        return {"empresa_id": obtener_empresa_id(supabase, token)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/logistica/stock")
def obtener_stock(request: Request):
    try:
        supabase, token = get_secure_client(request)
        empresa_id = obtener_empresa_id(supabase, token)
        
        response = supabase.table("vista_stock_detallado") \
            .select("*").eq("empresa_id", empresa_id).execute()
        return {"success": True, "data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/logistica/reporte-inventario")
def obtener_reporte_inventario(request: Request):
    try:
        supabase, token = get_secure_client(request)
        empresa_id = obtener_empresa_id(supabase, token)
        
        response = supabase.table("vista_reporte_inventario") \
            .select("*").eq("empresa_id", empresa_id).execute()
        return {"success": True, "data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/logistica/ventas-diarias")
def obtener_ventas_diarias(request: Request):
    try:
        supabase, token = get_secure_client(request)
        empresa_id = obtener_empresa_id(supabase, token)
        
        response = supabase.table("vista_ventas_diarias") \
            .select("*").eq("empresa_id", empresa_id).execute()
        labels = [str(row['fecha']) for row in response.data]
        data = [float(row['total_ventas']) for row in response.data]
        return {"labels": labels, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/api/v1/logistica/movimientos")
def registrar_movimiento(movimiento: Movimiento, request: Request):
    try:
        supabase, token = get_secure_client(request)
        empresa_id = obtener_empresa_id(supabase, token)
        
        data_to_insert = movimiento.dict(exclude_none=True)
        data_to_insert["id"] = str(uuid.uuid4())
        data_to_insert["empresa_id"] = empresa_id # Seguridad adicional
        
        supabase.table("movimientos").insert(data_to_insert).execute()
        return {"success": True, "message": "Movimiento registrado"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))