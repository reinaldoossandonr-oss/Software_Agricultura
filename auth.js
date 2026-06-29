
// Asegúrate de que esta sea la forma correcta de inicializar en tu versión de la librería
const SUPABASE_URL = 'https://legtxgdwqjfzvlvheaao.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlZ3R4Z2R3cWpmenZsdmhlYWFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNjM5MDAsImV4cCI6MjA5NzYzOTkwMH0.EXACa14BiJshtfU8i-1SmpjTtOYjlCjyNUiazd8RX20'; // Usa la misma llave que ya confirmamos

const clienteAuth = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. Lógica del formulario de Login
const loginForm = document.getElementById('loginForm');

if (loginForm) {
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            // Intentamos iniciar sesión
            const { data, error } = await clienteAuth.auth.signInWithPassword({ 
                email: email, 
                password: password 
            });

            if (error) {
                alert("Error de acceso: " + error.message);
                return;
            }

            // Si la sesión es válida, guardamos datos críticos para el backend
            if (data.session && data.session.access_token) {
                // Guardamos el token para peticiones autorizadas
                localStorage.setItem('supabase_token', data.session.access_token);
                
                // Guardamos el email para que el backend haga el match con la empresa
                if (data.user && data.user.email) {
                    localStorage.setItem('user_email', data.user.email);
                }
                
                // Redirigir al dashboard tras confirmar éxito
                window.location.href = 'index.html'; 
            } else {
                alert("Error: No se recibió la sesión correctamente.");
            }
        } catch (err) {
            console.error("Error inesperado:", err);
            alert("Ocurrió un error al procesar el inicio de sesión.");
        }
    };
}