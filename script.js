document.addEventListener("DOMContentLoaded", () => {
    // 1. Inicialización
    const clienteSupabase = supabase.createClient(
        'https://legtxgdwqjfzvlvheaao.supabase.co', 
        'sb_publishable_OpquiXUBHpb7_a9MvT92Qw_jC8V1...'
    );

    function mostrarMensaje(t, e) {
        const f = document.getElementById('mensaje-feedback');
        if (!f) return;
        f.textContent = t; f.style.display = 'block';
        f.style.backgroundColor = e ? '#d1fae5' : '#fee2e2';
        f.style.color = e ? '#065f46' : '#991b1b';
        setTimeout(() => f.style.display = 'none', 4000);
    }

    // Hacemos que la función sea global para que el onclick funcione
    window.mostrarSeccion = function(id, el) {
        const seccion = document.getElementById('seccion-' + id);
        if (!seccion) return;
        document.querySelectorAll('.main-content > div[id^="seccion-"]').forEach(s => s.classList.add('hidden'));
        seccion.classList.remove('hidden');
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        el.classList.add('active');
        if(id === 'dotacion') cargarDotacion();
    };

    async function cargarDotacion() {
        const { data, error } = await clienteSupabase.from('empleados').select('*');
        if (error) return console.error("Error cargando dotación:", error);
        const cuerpo = document.getElementById('cuerpoTabla');
        if (cuerpo) {
            cuerpo.innerHTML = data.map(e => `<tr><td style="padding:15px; border-bottom:1px solid #eee;">${e.nombre} ${e.apellido}</td><td style="padding:15px; border-bottom:1px solid #eee;">${e.rol_cargo}</td><td style="padding:15px; border-bottom:1px solid #eee;">${e.area_operacion}</td></tr>`).join('');
        }
    }

    const form = document.getElementById('formNuevoUsuario');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.target));
            const { error } = await clienteSupabase.from('empleados').insert([data]);
            if (!error) {
                mostrarMensaje("Empleado registrado con éxito", true);
                document.getElementById('modalRegistro').style.display='none';
                e.target.reset();
                cargarDotacion();
            } else {
                mostrarMensaje("Error: " + error.message, false);
            }
        };
    }

    // Carga inicial
    const graf = document.getElementById('graficoRendimiento');
    if (graf) {
        clienteSupabase.from('produccion').select('*').then(({ data }) => {
            if (!data) return;
            new Chart(graf.getContext('2d'), { 
                type: 'bar', 
                data: { labels: data.map(d => d.fecha), datasets: [{ label: 'Producción', data: data.map(v => v.total), backgroundColor: '#1aabf0' }] }, 
                options: { responsive: true, maintainAspectRatio: false } 
            });
        });
    }
});