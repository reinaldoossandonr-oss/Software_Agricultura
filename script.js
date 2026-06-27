document.addEventListener("DOMContentLoaded", () => {
    const clienteSupabase = supabase.createClient(
        'https://legtxgdwqjfzvlvheaao.supabase.co', 
        'sb_publishable_OpquiXUBHpb7_a9MvT92Qw_jC8V1...'
    );

    window.mostrarSeccion = (id, el) => {
        document.querySelectorAll('.main-content > div[id^="seccion-"]').forEach(s => s.classList.add('hidden'));
        document.getElementById('seccion-' + id).classList.remove('hidden');
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        el.classList.add('active');
        if(id === 'dotacion') cargarDotacion();
    };

    async function cargarDotacion() {
        const { data } = await clienteSupabase.from('empleados').select('*');
        if (data) {
            document.getElementById('cuerpoTabla').innerHTML = data.map(e => `
                <tr><td>${e.nombre} ${e.apellido}</td><td>${e.rol_cargo}</td><td>${e.area_operacion}</td></tr>
            `).join('');
        }
    }

    document.getElementById('formNuevoUsuario').onsubmit = async (e) => {
        e.preventDefault();
        const formData = Object.fromEntries(new FormData(e.target));
        await clienteSupabase.from('empleados').insert([formData]);
        alert("Guardado");
        document.getElementById('modalRegistro').style.display='none';
        cargarDotacion();
    };

    clienteSupabase.from('produccion').select('*').then(({ data }) => {
        if (!data) return;
        new Chart(document.getElementById('graficoRendimiento').getContext('2d'), { 
            type: 'bar', 
            data: { labels: data.map(d => d.fecha), datasets: [{ label: 'Producción', data: data.map(v => v.total), backgroundColor: '#1aabf0' }] }
        });
    });
});