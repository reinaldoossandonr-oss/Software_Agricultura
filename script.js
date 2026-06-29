// 1. Inicialización
const API_URL = 'https://axioma-flux.onrender.com';
let miGrafico;
let graficoVentas;

// Helper para obtener el token de autenticación
const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('supabase_token') || ''}`
});

// Función para obtener y mostrar el email del usuario desde el token
function mostrarUsuario() {
    const token = localStorage.getItem('supabase_token');
    if (!token) return;

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const email = payload.email || 'Usuario';
        
        const el = document.getElementById('user-display');
        if (el) el.innerText = email;
    } catch (e) {
        console.error("Error al decodificar el token:", e);
    }
}

// Nueva función corregida para obtener y mostrar el empresa_id
async function mostrarEmpresa() {
    try {
        // Llamamos a nuestro nuevo endpoint del backend
        const response = await fetch(`${API_URL}/api/v1/usuario/info`, { 
            headers: getHeaders() 
        });
        
        if (!response.ok) {
            console.error("No se pudo obtener info de empresa:", response.status);
            return;
        }

        const result = await response.json();
        
        // --- AQUÍ ESTÁ LA CLAVE ---
        const el = document.getElementById('empresa-display');
        if (el) {
            el.innerText = result.empresa_id || 'Sin empresa';
            // Guardamos esto en memoria local para que otras funciones lo usen
            localStorage.setItem('empresa_id', result.empresa_id);
        }
    } catch (e) {
        console.error("Error al obtener empresa:", e);
    }
}

// 2. Función global de navegación
window.mostrarSeccion = (id, el) => {
    document.querySelectorAll('main > div[id^="seccion-"]').forEach(s => s.classList.add('hidden'));
    const seccion = document.getElementById('seccion-' + id);
    if(seccion) seccion.classList.remove('hidden');
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if(el) el.classList.add('active');
    
    if(id === 'inventario') cargarInventario();
};

// 3. Función del buscador
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

// Función para cerrar sesión
window.cerrarSesion = () => {
    localStorage.removeItem('supabase_token');
    window.location.href = 'login.html';
};

function actualizarKPIs(datos) {
    const optimos = datos.filter(p => p.estado_stock === 'Óptimo').length;
    const reponer = datos.filter(p => p.estado_stock === 'REPONER').length;
    
    document.getElementById('kpi-optimo').innerText = optimos;
    document.getElementById('kpi-reponer').innerText = reponer;
    document.getElementById('kpi-total').innerText = datos.length;
}

// 4. Carga de Inventario
async function cargarInventario() {
    try {
        const response = await fetch(`${API_URL}/api/v1/logistica/reporte-inventario`, { headers: getHeaders() });
        const result = await response.json();
        
        const tabla = document.getElementById('cuerpoTablaInventario');
        if (tabla && result.data) {
            actualizarKPIs(result.data);
            tabla.innerHTML = result.data.map(p => {
                const estadoClass = p.estado_stock === 'REPONER' ? 'badge-reponer' : 'badge-optimo';
                return `
                    <tr>
                        <td style="padding: 12px;">${p.nombre || 'N/A'}</td>
                        <td style="padding: 12px;">${p.sku || 'N/A'}</td>
                        <td style="padding: 12px; font-weight: bold;">${p.stock_actual || 0}</td>
                        <td style="padding: 12px;">${p.consumo_promedio_diario || 0}</td>
                        <td style="padding: 12px;">${p.dias_inventario || 0}</td>
                        <td style="padding: 12px;">
                            <span class="badge ${estadoClass}">${p.estado_stock || 'N/A'}</span>
                        </td>
                        <td style="padding: 12px; font-weight: bold; color: #ef4444;">${p.cantidad_a_reponer || 0}</td>
                    </tr>
                `;
            }).join('');
        }
    } catch (err) { console.error("Error inventario:", err); }
}

// 5. Gráficos
async function cargarDatosGrafico() {
    const ctx = document.getElementById('graficoStock');
    if (!ctx) return;
    try {
        const response = await fetch(`${API_URL}/api/v1/logistica/stock`, { headers: getHeaders() });
        const result = await response.json();
        const data = result.data || [];

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

async function cargarGraficoVentas() {
    const ctx = document.getElementById('graficoVentas');
    if (!ctx) return;
    try {
        const response = await fetch(`${API_URL}/api/v1/logistica/ventas-diarias`, { headers: getHeaders() });
        if (!response.ok) throw new Error("Error en servidor: " + response.status);
        const result = await response.json(); 
        
        if (graficoVentas) graficoVentas.destroy();
        graficoVentas = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: result.labels || [],
                datasets: [{
                    label: 'Unidades Vendidas',
                    data: result.data || [],
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

// 6. Registro de movimientos
window.registrarMovimiento = async (event, tipo) => {
    event.preventDefault();
    const form = event.target;
    const datos = {
        producto_id: form.producto_id.value,
        cantidad: parseFloat(form.cantidad.value),
        tipo: tipo
    };
    if (tipo === 'SALIDA') datos.cantidad *= -1;

    try {
        const response = await fetch(`${API_URL}/api/v1/logistica/movimientos`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(datos)
        });

        if (response.ok) {
            alert(`${tipo} registrado con éxito.`);
            form.reset();
            cargarInventario();
            cargarDatosGrafico();
            cargarGraficoVentas();
        } else {
            const err = await response.json();
            alert('Error: ' + (err.detail || 'No se pudo registrar.'));
        }
    } catch (err) { alert("Error de conexión."); }
};

document.addEventListener("DOMContentLoaded", async () => {
    console.log("Iniciando carga de dashboard...");
    
    // Mostramos usuario y empresa al cargar
    mostrarUsuario();
    mostrarEmpresa();
    
    if (!localStorage.getItem('supabase_token')) {
        console.warn("Advertencia: No hay token guardado.");
    }

    try {
        await Promise.all([
            cargarInventario(),
            cargarDatosGrafico(),
            cargarGraficoVentas()
        ]);
        console.log("Carga de datos finalizada.");
    } catch (err) {
        console.error("Error detectado en la carga inicial:", err);
    }
});