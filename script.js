// 1. Inicialización
const API_URL = 'https://axioma-flux.onrender.com';

// Variable global para controlar la instancia del gráfico
let miGrafico;

// 2. Función global de navegación
window.mostrarSeccion = (id, el) => {
    document.querySelectorAll('.main-content > div[id^="seccion-"]').forEach(s => s.classList.add('hidden'));
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
    const filas = tabla.getElementsByTagName('tr');

    for (let i = 0; i < filas.length; i++) {
        const textoFila = filas[i].textContent.toLowerCase();
        filas[i].style.display = textoFila.includes(filtro) ? "" : "none";
    }
};

// 4. Carga de datos de productos
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
        console.error("Error conectando con API Render:", err);
    }
}

// 5. Carga de datos para gráfico
async function cargarDatosGrafico(ctx) {
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
        console.error("Error cargando gráfico desde API:", err);
    }
}

// 6. Función para cerrar sesión (Añadida para el botón del HTML)
window.cerrarSesion = async () => {
    try {
        const { error } = await clienteSupabase.auth.signOut();
        if (error) throw error;
        window.location.href = 'login.html';
    } catch (err) {
        console.error("Error al cerrar sesión:", err);
        window.location.href = 'login.html';
    }
};

document.addEventListener("DOMContentLoaded", () => {
    const ctx = document.getElementById('graficoStock');
    if (ctx) cargarDatosGrafico(ctx);
});