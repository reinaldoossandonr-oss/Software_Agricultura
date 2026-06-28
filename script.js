// 1. Inicialización
const API_URL = 'https://axioma-flux.onrender.com';
let miGrafico;
let graficoVentas; // Referencia para el nuevo gráfico

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

// Función para actualizar las tarjetas KPI (Nueva)
function actualizarKPIs(datos) {
    const optimos = datos.filter(p => p['Estado Stock'] === 'Óptimo').length;
    const reponer = datos.filter(p => p['Estado Stock'] === 'REPONER').length;
    
    document.getElementById('kpi-optimo').innerText = optimos;
    document.getElementById('kpi-reponer').innerText = reponer;
    document.getElementById('kpi-total').innerText = datos.length;
}

// 4. Carga de datos de productos
async function cargarInventario() {
    try {
        const response = await fetch(`${API_URL}/api/v1/logistica/reporte-inventario`);
        const result = await response.json();
        
        const tabla = document.getElementById('cuerpoTablaInventario');
        if (tabla && result.data) {
            // Actualizamos KPIs y tabla
            actualizarKPIs(result.data);
            
            tabla.innerHTML = result.data.map(p => {
                const estadoClass = p['Estado Stock'] === 'REPONER' ? 'badge-reponer' : 'badge-optimo';
                return `
                    <tr>
                        <td style="padding: 12px;">${p['Nombre'] || 'N/A'}</td>
                        <td style="padding: 12px;">${p['SKU'] || 'N/A'}</td>
                        <td style="padding: 12px; font-weight: bold;">${p['Stock Actual'] || 0}</td>
                        <td style="padding: 12px;">${p['Consumo Promedio Diario'] || 0}</td>
                        <td style="padding: 12px;">${p['Dias Inventario'] || 0}</td>
                        <td style="padding: 12px;">
                            <span class="badge ${estadoClass}">${p['Estado Stock']}</span>
                        </td>
                        <td style="padding: 12px; font-weight: bold; color: #ef4444;">${p['Cantidad a Reponer'] || 0}</td>
                    </tr>
                `;
            }).join('');
        }
    } catch (err) {
        console.error("Error cargando inventario:", err);
    }
}

// 5. Carga de datos para gráficos
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
                datasets: [{ label: 'Stock Disponible', data: data.map(p => p.stock_actual), backgroundColor: '#1aabf0' }] 
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    } catch (err) { console.error("Error gráfico stock:", err); }
}

// Nueva función para gráfico de línea de ventas (Nueva)
async function cargarGraficoVentas() {
    const ctx = document.getElementById('graficoVentas');
    if (!ctx) return;
    try {
        const response = await fetch(`${API_URL}/api/v1/logistica/ventas-diarias`);
        const result = await response.json(); 
        
        if (graficoVentas) graficoVentas.destroy();
        graficoVentas = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: result.labels,
                datasets: [{
                    label: 'Unidades Vendidas',
                    data: result.data,
                    borderColor: '#1aabf0',
                    backgroundColor: 'rgba(26, 171, 240, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    } catch (err) { console.error("Error gráfico ventas:", err); }
}

// 6. Cierre de sesión
window.cerrarSesion = async () => {
    try {
        if(typeof clienteSupabase !== 'undefined') await clienteSupabase.auth.signOut();
        window.location.href = 'login.html';
    } catch (err) { window.location.href = 'login.html'; }
};

// 7. Registro de movimientos
window.registrarMovimiento = async (event, tipo) => {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const datos = {};
    formData.forEach((value, key) => { datos[key] = value; });
    if (tipo === 'SALIDA') datos.cantidad = parseFloat(datos.cantidad) * -1;
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
            setTimeout(async () => {
                await cargarInventario();
                await cargarDatosGrafico();
                await cargarGraficoVentas(); // Actualiza también el gráfico nuevo
            }, 500);
        } else {
            const err = await response.json();
            alert('Error: ' + (err.detail || 'No se pudo registrar el movimiento.'));
        }
    } catch (err) {
        console.error("Error en registro:", err);
        alert("Error de conexión con el servidor.");
    }
};

document.addEventListener("DOMContentLoaded", () => {
    cargarInventario();
    cargarDatosGrafico();
    cargarGraficoVentas();
});