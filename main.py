from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from datetime import datetime
from pydantic import BaseModel # Importación necesaria para la validación
import os
from dotenv import load_dotenv

app = FastAPI(title="Axioma Software Brotalia API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuración de conexión
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- MODELO DE DATOS PARA FORMULARIO ---
class NuevoEmpleado(BaseModel):
    empresa_id: str
    nombre: str
    apellido: str
    rut_identificacion: str
    rol_cargo: str
    area_operacion: str
    activo: bool = True

@app.get("/")
def ruta_raiz():
    return {"status": "online", "message": "Backend de Axioma Brotalia listo"}

# --- ENDPOINT DE INSERCIÓN (Para tu formulario) ---
@app.post("/api/v1/dotacion/nuevo")
def registrar_empleado(empleado: NuevoEmpleado):
    try:
        data, count = supabase.table("dotacion").insert([
            {
                "empresa_id": empleado.empresa_id,
                "nombre": empleado.nombre,
                "apellido": empleado.apellido,
                "rut_identificacion": empleado.rut_identificacion,
                "rol_cargo": empleado.rol_cargo,
                "area_operacion": empleado.area_operacion,
                "activo": empleado.activo
            }
        ]).execute()
        
        return {"success": True, "message": "Empleado ingresado en Axioma Analytics"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al registrar: {str(e)}")

# --- TUS ENDPOINTS EXISTENTES ---

@app.get("/api/v1/dotacion/resumen")
def resumen_dotacion():
    try:
        response = supabase.table("dotacion").select("id, nombre, apellido, rol_cargo, area_operacion, activo").execute()
        data = response.data
        total_empleados = len(data)
        activos = sum(1 for emp in data if emp["activo"])
        
        return {
            "success": True,
            "metricas": {"total_personal": total_empleados, "activos": activos, "inactivos": total_empleados - activos},
            "empleados": data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/asistencia/analitica")
def analitica_asistencia():
    try:
        response = supabase.table("asistencia").select("fecha, hora_entrada, hora_salida, cantidad_producida, horas_extra").execute()
        data = response.data
        cronologia = {}
        
        for registro in data:
            fecha = str(registro["fecha"])
            h_entrada_raw = registro["hora_entrada"]
            h_salida_raw = registro["hora_salida"]
            prod_cajas = float(registro["cantidad_producida"] or 0.0)
            extras = float(registro["horas_extra"] or 0.0)
            
            horas_regulares = 0.0
            if h_entrada_raw and h_salida_raw:
                t_entrada = datetime.fromisoformat(h_entrada_raw.replace('Z', '+00:00'))
                t_salida = datetime.fromisoformat(h_salida_raw.replace('Z', '+00:00'))
                diferencia = t_salida - t_entrada
                horas_regulares = diferencia.total_seconds() / 3600.0


            if fecha not in cronologia:
                cronologia[fecha] = {
                    "personal_presente": 0,
                    "horas_hombre_totales": 0.0,
                    "total_producido": 0.0,
                    "eficiencia_por_hora": 0.0
                }
            
            cronologia[fecha]["personal_presente"] += 1
            cronologia[fecha]["horas_hombre_totales"] += (horas_regulares + extras)
            cronologia[fecha]["total_producido"] += prod_cajas

        for fecha in cronologia:
            h_totales = cronologia[fecha]["horas_hombre_totales"]
            producido = cronologia[fecha]["total_producido"]
            if h_totales > 0:
                cronologia[fecha]["eficiencia_por_hora"] = round(producido / h_totales, 2)
            cronologia[fecha]["horas_hombre_totales"] = round(h_totales, 2)
            cronologia[fecha]["total_producido"] = round(producido, 2)

        return {"success": True, "cronologia_graficos": cronologia}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))