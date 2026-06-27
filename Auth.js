const SUPABASE_URL = 'https://legtxgdwqjfzvlvheaao.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlZ3R4Z2R3cWpmenZsdmhlYWFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNjM5MDAsImV4cCI6MjA5NzYzOTkwMH0.EXACa14BiJshtfU8i-1SmpjTtOYjlCjyNUiazd8RX20'; // Usa la misma llave que ya confirmamos

const clienteAuth = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.getElementById('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const { data, error } = await clienteAuth.auth.signInWithPassword({ email, password });

    if (error) {
        alert("Error de acceso: " + error.message);
    } else {
        // Redirigir a tu dashboard principal
        window.location.href = 'index.html'; 
    }
};