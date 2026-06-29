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

# Conexión Supabase
supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

# --- MODELOS ---
class Movimiento(BaseModel):
    producto_id: str 
    tipo: str
    cantidad: float
    ubicacion_id: str = None 

# --- ENDPOINTS ---

@app.get("/")
def ruta_raiz():
    return {"status": "online", "message": "Backend Axioma Logística listo"}

# 1. Obtener inventario (Filtrado automáticamente por RLS)
@app.get("/api/v1/logistica/stock")
def obtener_stock():
    try:
        # La vista ya tiene los joins por producto_id y la RLS filtra por empresa
        response = supabase.table("vista_stock_detallado").select("producto_id, sku, nombre, stock_actual").execute()
        return {"success": True, "data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 2. Obtener reporte completo para Dashboard
@app.get("/api/v1/logistica/reporte-inventario")
def obtener_reporte_inventario():
    try:
        response = supabase.table("vista_reporte_inventario").select("*").execute()
        return {"success": True, "data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 3. Ventas diarias
@app.get("/api/v1/logistica/ventas-diarias")
def obtener_ventas_diarias():
    try:
        response = supabase.table("vista_ventas_mensuales").select("*").execute()
        
        labels = [str(row['fecha']) for row in response.data]
        data = [float(row['total']) for row in response.data]
        
        return {"labels": labels, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 4. Registrar movimiento
@app.post("/api/v1/logistica/movimientos")
def registrar_movimiento(movimiento: Movimiento, request: Request):
    try:
        # Extraer token de autenticación para que Supabase identifique al usuario
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            raise HTTPException(status_code=401, detail="No autorizado")
        
        token = auth_header.split(" ")[1]
        
        # Preparar inserción
        data_to_insert = movimiento.dict(exclude_none=True)
        data_to_insert["id"] = str(uuid.uuid4())
        
        # Ejecutar con el token del usuario actual
        # El RLS y el Trigger de BD se encargarán del empresa_id
        supabase.postgrest.auth(token)
        supabase.table("movimientos").insert(data_to_insert).execute()
        
        return {"success": True, "message": "Movimiento registrado correctamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))