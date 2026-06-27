// Configuración de Supabase (Vercel inyectará estas variables)
const supabase = supabase.createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_KEY
);

function mostrarMensaje(t, e) {
    const f = document.getElementById('mensaje-feedback');
    f.textContent = t; f.style.display = 'block';
    f.style.backgroundColor = e ? '#d1fae5' : '#fee2e2';
    f.style.color = e ? '#065f46' : '#991b1b';
    setTimeout(() => f.style.display = 'none', 4000);
}

function mostrarSeccion(id, el) {
    document.querySelectorAll('.main-content > div[id^="seccion-"]').forEach(s => s.classList.add('hidden'));
    document.getElementById('seccion-' + id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
    if(id === 'dotacion') cargarDotacion();
}

async function cargarDotacion() {
    // Reemplazo de fetch local por consulta Supabase
    const { data, error } = await supabase.from('empleados').select('*');
    if (error) return console.error("Error cargando dotación:", error);
    
    document.getElementById('cuerpoTabla').innerHTML = data.map(e => `
        <tr>
            <td style="padding:15px; border-bottom:1px solid #eee;">${e.nombre} ${e.apellido}</td>
            <td style="padding:15px; border-bottom:1px solid #eee;">${e.rol_cargo}</td>
            <td style="padding:15px; border-bottom:1px solid #eee;">${e.area_operacion}</td>
        </tr>`).join('');
}

document.getElementById('formNuevoUsuario').onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    
    // Inserción en Supabase
    const { error } = await supabase.from('empleados').insert([data]);
    
    if (!error) {
        mostrarMensaje("Empleado registrado con éxito", true);
        document.getElementById('modalRegistro').style.display='none';
        e.target.reset();
        cargarDotacion();
    } else {
        mostrarMensaje("Error: " + error.message, false);
    }
};

// Carga inicial del gráfico (Ajusta 'produccion' al nombre de tu tabla)
supabase.from('produccion').select('*').then(({ data }) => {
    const ctx = document.getElementById('graficoRendimiento').getContext('2d');
    new Chart(ctx, { 
        type: 'bar', 
        data: { 
            labels: data.map(d => d.fecha), 
            datasets: [{ label: 'Producción', data: data.map(v => v.total), backgroundColor: '#1aabf0' }] 
        }, 
        options: { responsive: true, maintainAspectRatio: false } 
    });
});