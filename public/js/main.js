// Shared Logic for fetching Dynamic Theme and handling Login

// Securely load and apply the school configuration to the UI
async function loadSchoolConfig() {
    try {
        const res = await fetch('/api/config');
        if (!res.ok) throw new Error('Failed to load config');
        const config = await res.json();
        
        // Apply CSS Variables for the Theme
        const root = document.documentElement;
        if (config.primary_color) root.style.setProperty('--primary-color', config.primary_color);
        if (config.secondary_color) root.style.setProperty('--secondary-color', config.secondary_color);
        if (config.bg_url) root.style.setProperty('--bg-url', `url(${config.bg_url})`);
        
        // Update specific DOM nodes safely via textContent to strictly prevent XSS
        const safeTextUpdate = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        safeTextUpdate('school-name', config.name);
        safeTextUpdate('school-address', config.address);
        safeTextUpdate('school-history', config.history);
        safeTextUpdate('school-achievements', config.achievements);
        safeTextUpdate('school-principal', config.principal_name);
        safeTextUpdate('school-phone', config.phone);
        
        const logoEl = document.getElementById('school-logo');
        if (logoEl && config.logo_url) {
            logoEl.src = config.logo_url;
        }
        
    } catch (err) {
        console.error("Error loading theme", err);
    }
}

// Register Service Worker for aggressive offline caching
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(reg => {
            console.log('ServiceWorker registered successfully. Static content will now be cached on device.');
        }).catch(err => {
            console.warn('ServiceWorker registration failed: ', err);
        });
    });
}

// Make loadSchoolConfig globally available 
window.loadSchoolConfig = loadSchoolConfig;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadSchoolConfig();

    // Handle Landing Page Login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        // If query string has admin, pre-fill? Nah, standard security.
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errDiv = document.getElementById('login-error');
            
            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                
                const data = await res.json();
                if (res.ok && data.redirect) {
                    window.location.href = data.redirect;
                } else {
                    errDiv.textContent = data.error || 'Login failed';
                }
            } catch (err) {
                errDiv.textContent = 'Server connection error';
            }
        });
    }

    // Modal / Admin trigger check
    const adminLink = document.getElementById('open-admin-login');
    if (adminLink) {
        adminLink.addEventListener('click', (e) => {
            e.preventDefault();
            // In a real modal this would swap the form. 
            // Here, we can just autofill a visual state or just instruct the user.
            document.querySelector('.login-section h2').textContent = "Admin Login";
            document.getElementById('username').placeholder = "Enter admin username";
            document.getElementById('username').focus();
            document.getElementById('login-error').textContent = "";
        });
    }
});
