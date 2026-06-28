from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from pydantic import BaseModel
import os
import uuid
from dotenv import load_dotenv
from datetime import datetime, timedelta

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
    empresa_id: str
    producto_id: str
    tipo: str
    cantidad: float
    ubicacion_id: str = None 

# --- ENDPOINTS ---

@app.get("/")
def ruta_raiz():
    return {"status": "online", "message": "Backend Axioma Logística listo"}

# 1. Obtener inventario simple
@app.get("/api/v1/logistica/stock")
def obtener_stock():
    try:
        response = supabase.table("vista_stock_detallado").select("sku, nombre, stock_actual").execute()
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

# 3. Nuevo Endpoint: Ventas diarias (Gráfico de línea)
@app.get("/api/v1/logistica/ventas-diarias")
def obtener_ventas_diarias():
    try:
        # SQL directo para agrupar por fecha los últimos 30 días
        query = """
        SELECT 
            DATE(timestamp) AS fecha, 
            SUM(ABS(cantidad)) AS total
        FROM movimientos
        WHERE tipo = 'SALIDA'
          AND timestamp >= NOW() - INTERVAL '30 days'
        GROUP BY fecha
        ORDER BY fecha ASC
        """
        # Ejecutamos a través de rpc o consulta directa si tu configuración lo permite.
        # Aquí usamos la forma estándar de Supabase para ejecutar SQL complejo
        response = supabase.rpc("execute_sql", {"query": query}).execute()
        
        # Transformamos los datos para Chart.js
        labels = [row['fecha'] for row in response.data]
        data = [row['total'] for row in response.data]
        
        return {"labels": labels, "data": data}
    except Exception as e:
        # Si no tienes configurado el RPC 'execute_sql', 
        # puedes usar una vista SQL simple en Supabase y llamarla con .select("*")
        raise HTTPException(status_code=500, detail=str(e))

# 4. Registrar movimiento
@app.post("/api/v1/logistica/movimientos")
def registrar_movimiento(movimiento: Movimiento):
    try:
        data_to_insert = movimiento.dict(exclude_none=True)
        data_to_insert["id"] = str(uuid.uuid4())
        
        supabase.table("movimientos").insert(data_to_insert).execute()
        return {"success": True, "message": "Movimiento registrado correctamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))