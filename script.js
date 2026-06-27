// 1. Inicialización
const SUPABASE_URL = 'https://legtxgdwqjfzvlvheaao.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlZ3R4Z2R3cWpmenZsdmhlYWFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNjM5MDAsImV4cCI6MjA5NzYzOTkwMH0.EXACa14BiJshtfU8i-1SmpjTtOYjlCjyNUiazd8RX20'; // RECUERDA PONER AQUÍ LA NUEVA CLAVE

const clienteSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. Función global de navegación
window.mostrarSeccion = (id, el) => {
    document.querySelectorAll('.main-content > div[id^="seccion-"]').forEach(s => s.classList.add('hidden'));
    const seccion = document.getElementById('seccion-' + id);
    if(seccion) seccion.classList.remove('hidden');
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if(el) el.classList.add('active');
    
    if(id === 'dotacion') cargarDotacion();
};

// 3. Función del buscador (Nueva)
window.filtrarTabla = () => {
    const input = document.getElementById('buscadorDotacion');
    const filtro = input.value.toLowerCase();
    const tabla = document.getElementById('cuerpoTabla');
    const filas = tabla.getElementsByTagName('tr');

    for (let i = 0; i < filas.length; i++) {
        const textoFila = filas[i].textContent.toLowerCase();
        filas[i].style.display = textoFila.includes(filtro) ? "" : "none";
    }
};

// 4. Carga de datos de la tabla 'dotacion'
async function cargarDotacion() {
    const { data, error } = await clienteSupabase.from('dotacion').select('*');
    if (error) { console.error("Error cargando dotación:", error); return; }
    
    const tabla = document.getElementById('cuerpoTabla');
    if (tabla && data) {
        tabla.innerHTML = data.map(e => `
            <tr>
                <td>${e.nombre || ''} ${e.apellido || ''}</td>
                <td>${e.rol_cargo || ''}</td>
                <td>${e.area_operacion || ''}</td>
            </tr>
        `).join('');
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // Registro de nuevo usuario
    const form = document.getElementById('formNuevoUsuario');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = Object.fromEntries(new FormData(e.target));
            const { error } = await clienteSupabase.from('dotacion').insert([formData]);
            
            if (!error) {
                alert("Guardado exitosamente");
                e.target.reset();
                document.getElementById('modalRegistro').style.display = 'none';
                cargarDotacion();
            } else {
                alert("Error al guardar: " + error.message);
            }
        };
    }

    // Carga, agrupación y gráfico de 'asistencia'
    const ctx = document.getElementById('graficoRendimiento');
    if (ctx) {
        clienteSupabase.from('asistencia').select('fecha, cantidad_producida').then(({ data, error }) => {
            if (error) { console.error("Error gráfico:", error); return; }
            if (!data || data.length === 0) return;

            const mapaProduccion = data.reduce((acc, curr) => {
                const fecha = curr.fecha;
                acc[fecha] = (acc[fecha] || 0) + (curr.cantidad_producida || 0);
                return acc;
            }, {});

            const fechas = Object.keys(mapaProduccion).sort();
            const totales = fechas.map(f => mapaProduccion[f]);
            
            new Chart(ctx.getContext('2d'), { 
                type: 'bar', 
                data: { 
                    labels: fechas, 
                    datasets: [{ 
                        label: 'Total Producción Diaria', 
                        data: totales, 
                        backgroundColor: '#1aabf0' 
                    }] 
                }
            });
        });
    }
});