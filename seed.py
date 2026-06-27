import random
import uuid
from datetime import datetime, timedelta
from faker import Faker
from supabase import create_client, Client
import os
from dotenv import load_dotenv

fake = Faker('es_CL')  # Formato chileno 🇨🇱

# Credenciales de tu Supabase
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def generar_rut():
    rut = random.randint(15000000, 25000000)
    return f"{rut}-{random.choice(['K', '1', '2', '3', '4', '5', '6', '7', '8', '9'])}"

def poblar_sistema():
    print("⏳ Iniciando la inyección de datos para Axioma Brotalia...")
    
    # Generamos un UUID único para simular una empresa cliente
    EMPRESA_UUID = str(uuid.uuid4())
    
    roles_agro = ["Cosechador", "Operario Cedis", "Supervisor", "Operario de Planta"]
    areas_agro = ["Cuartel 4", "Línea de Packing", "Pasillo A"]
    tareas_agro = ["Cosecha Arándano", "Picking", "Despacho", "Selección Técnica"]

    empleados_ids = []
    print("👥 Creando 10 empleados en la tabla 'dotacion'...")
    
    for _ in range(10):
        nuevo_empleado = {
            "empresa_id": EMPRESA_UUID,
            "nombre": fake.first_name(),
            "apellido": fake.last_name(),
            "rut_identificacion": generar_rut(),
            "rol_cargo": random.choice(roles_agro),
            "area_operacion": random.choice(areas_agro),
            "activo": True
        }
        
        try:
            res = supabase.table("dotacion").insert(nuevo_empleado).execute()
            if res.data:
                # Guardamos el UUID generado por Supabase para el empleado
                empleados_ids.append(res.data[0]["id"])
        except Exception as e:
            print(f"❌ Error en tabla dotacion: {e}")
            return

    if not empleados_ids:
        print("❌ No se pudieron recuperar los UUIDs de los empleados.")
        return

    print("📅 Generando registros históricos de asistencia (TIMESTAMPTZ)...")
    fecha_fin = datetime.now()
    fecha_inicio = fecha_fin - timedelta(days=30)
    
    registros_asistencia = []
    fecha_actual = fecha_inicio

    while fecha_actual <= fecha_fin:
        # Saltamos los domingos
        if fecha_actual.weekday() == 6:
            fecha_actual += timedelta(days=1)
            continue

        for emp_id in empleados_ids:
            if random.random() < 0.15:
                continue  # Inasistencia simulada

            # Ajustamos la hora de entrada combinando la fecha actual con las 08:00 AM estándar
            hora_entrada = datetime.combine(fecha_actual.date(), datetime.min.time()) + timedelta(hours=8, minutes=random.randint(-15, 15))
            
            # Cálculo de horas extra y salida
            hace_extra = random.random() < 0.20
            horas_regulares = 8.5
            horas_extra = float(random.choice([1.0, 1.5, 2.0])) if hace_extra else 0.0
            
            hora_salida = hora_entrada + timedelta(hours=horas_regulares) + timedelta(hours=horas_extra)

            # Datos operativos compatibles con NUMERIC(10,2) y TEXT
            tipo_tarea = random.choice(tareas_agro)
            cantidad_producida = float(random.randint(120, 250)) if "Cosecha" in tipo_tarea or "Picking" in tipo_tarea else 0.0

            registro = {
                "empresa_id": EMPRESA_UUID,
                "empleado_id": emp_id,
                "fecha": fecha_actual.strftime("%Y-%m-%d"),
                # Formateamos como ISO 8601 (con zona horaria UTC "Z") para que TIMESTAMPTZ lo acepte de inmediato
                "hora_entrada": hora_entrada.isoformat() + "Z",
                "hora_salida": hora_salida.isoformat() + "Z",
                "cantidad_producida": cantidad_producida,
                "tipo_tarea": tipo_tarea,
                "horas_extra": horas_extra
            }
            registros_asistencia.append(registro)

        fecha_actual += timedelta(days=1)

    try:
        print(f"🚀 Insertando {len(registros_asistencia)} registros en la tabla 'asistencia'...")
        supabase.table("asistencia").insert(registros_asistencia).execute()
        print("✅ ¡Base de datos perfectamente poblada con tu estructura real!")
    except Exception as e:
        print(f"❌ Error al insertar en asistencia: {e}")

if __name__ == "__main__":
    poblar_sistema()