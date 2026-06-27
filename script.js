// 1. Inicialización: USA SIEMPRE LA LLAVE 'anon public' (la que empieza con sb_publishable...)
const SUPABASE_URL = 'https://legtxgdwqjfzvlvheaao.supabase.co';
const SUPABASE_KEY = 'sb_secret_9wonPVz4wB5JUcSMFt6KXw_iwwPt3Kt'; // CAMBIA ESTO POR LA LLAVE PÚBLICA

const clienteSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. Función global para que el HTML la encuentre siempre
window.mostrarSeccion = (id, el) => {
    document.querySelectorAll('.main-content > div[id^="seccion-"]').forEach(s => s.classList.add('hidden'));
    const seccion = document.getElementById('seccion-' + id);
    if(seccion) seccion.classList.remove('hidden');
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if(el) el.classList.add('active');
    
    if(id === 'dotacion') cargarDotacion();
};

// 3. Carga de datos de la tabla 'dotacion'
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

    // Carga inicial del gráfico desde 'asistencia'
    clienteSupabase.from('asistencia').select('*').then(({ data, error }) => {
        if (error) console.error("Error gráfico:", error);
        if (!data) return;
        
        const ctx = document.getElementById('graficoRendimiento');
        if (ctx) {
            new Chart(ctx.getContext('2d'), { 
                type: 'bar', 
                data: { 
                    labels: data.map(d => d.fecha), 
                    datasets: [{ label: 'Asistencia', data: data.map(v => v.total), backgroundColor: '#1aabf0' }] 
                }
            });
        }
    });
});