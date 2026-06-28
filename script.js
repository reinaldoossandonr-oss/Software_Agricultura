// 1. Inicialización
const API_URL = 'https://axioma-flux.onrender.com';

// Variable global para controlar la instancia del gráfico
let miGrafico;

// 2. Función global de navegación
window.mostrarSeccion = (id, el) => {
    document.querySelectorAll('main > div[id^="seccion-"]').forEach(s => s.classList.add('hidden'));
    const seccion = document.getElementById('seccion-' + id);
    if(seccion) seccion.classList.remove('hidden');
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if(el) el.classList.add('active');
    
    if(id === 'inventario') cargarInventario();
};

// 3. Función del buscador para Inventario
window.filtrarInventario = () => {
    const input = document.getElementById('buscadorInventario');
    const filtro = input.value.toLowerCase();
    const tabla = document.getElementById('cuerpoTablaInventario');
    if(!tabla) return;
    const filas = tabla.getElementsByTagName('tr');

    for (let i = 0; i < filas.length; i++) {
        const textoFila = filas[i].textContent.toLowerCase();
        filas[i].style.display = textoFila.includes(filtro) ? "" : "none";
    }
};

// 4. Carga de datos de productos (Tabla)
async function cargarInventario() {
    try {
        const response = await fetch(`${API_URL}/api/v1/logistica/stock`);
        const result = await response.json();
        
        const tabla = document.getElementById('cuerpoTablaInventario');
        if (tabla && result.data) {
            tabla.innerHTML = result.data.map(p => `
                <tr>
                    <td style="padding: 15px;">${p.sku}</td>
                    <td style="padding: 15px;">${p.nombre}</td>
                    <td style="padding: 15px;">${p.categoria}</td>
                    <td style="padding: 15px; font-weight: bold;">${p.stock_actual}</td>
                </tr>
            `).join('');
        }
    } catch (err) {
        console.error("Error cargando tabla:", err);
    }
}

// 5. Carga de datos para gráfico
async function cargarDatosGrafico() {
    const ctx = document.getElementById('graficoStock');
    if (!ctx) return;

    try {
        const response = await fetch(`${API_URL}/api/v1/logistica/stock`);
        const result = await response.json();
        const data = result.data;

        if (miGrafico) miGrafico.destroy();

        miGrafico = new Chart(ctx.getContext('2d'), { 
            type: 'bar', 
            data: { 
                labels: data.map(p => p.nombre), 
                datasets: [{ 
                    label: 'Stock Disponible', 
                    data: data.map(p => p.stock_actual), 
                    backgroundColor: '#1aabf0' 
                }] 
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    } catch (err) {
        console.error("Error cargando gráfico:", err);
    }
}

// 6. Cierre de sesión
window.cerrarSesion = async () => {
    try {
        if(typeof clienteSupabase !== 'undefined') {
            await clienteSupabase.auth.signOut();
        }
        window.location.href = 'login.html';
    } catch (err) {
        window.location.href = 'login.html';
    }
};

// 7. Registro de movimientos (Recepción, Picking, Ajuste)
window.registrarMovimiento = async (event, tipo) => {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const datos = Object.fromEntries(formData.entries());
    datos.tipo = tipo;

    try {
        const response = await fetch(`${API_URL}/api/v1/logistica/movimientos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });

        if (response.ok) {
            alert(`${tipo} registrado con éxito.`);
            form.reset();
            if (typeof cargarInventario === 'function') cargarInventario();
        } else {
            alert('Error al registrar en el servidor.');
        }
    } catch (err) {
        console.error("Error en registro:", err);
    }
};

// --- INICIALIZACIÓN AUTOMÁTICA ---
document.addEventListener("DOMContentLoaded", () => {
    cargarInventario();
    cargarDatosGrafico();
});