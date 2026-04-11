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

    // ── Tab Switching Logic ──
    const tabTriggers = document.querySelectorAll('.tab-trigger');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            const target = trigger.dataset.tab;

            tabTriggers.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-pressed', 'false'); });
            tabPanels.forEach(p => p.classList.remove('active'));

            trigger.classList.add('active');
            trigger.setAttribute('aria-pressed', 'true');
            const panel = document.getElementById('tab-' + target);
            if (panel) panel.classList.add('active');
        });
    });

    // ── Dual Login Toggle Logic ──
    const btnUser = document.getElementById('btn-user-login');
    const btnAdmin = document.getElementById('btn-admin-login');
    const descEl = document.getElementById('gateway-desc');
    const ctaLink = document.getElementById('go-to-login');
    const ctaBtn = document.getElementById('login-cta-btn');

    if (btnUser && btnAdmin) {
        btnUser.addEventListener('click', () => {
            btnUser.classList.add('active');   btnUser.setAttribute('aria-pressed', 'true');
            btnAdmin.classList.remove('active'); btnAdmin.setAttribute('aria-pressed', 'false');
            if (descEl) {
                descEl.classList.remove('admin-mode');
                descEl.innerHTML = '<p>For <strong>Principals, Teachers, Parents &amp; Students</strong>. Access your school-specific dashboard securely with 2FA.</p>';
            }
            if (ctaLink) ctaLink.href = '/login.html';
            if (ctaBtn) ctaBtn.textContent = 'Proceed to Secure Login →';
        });

        btnAdmin.addEventListener('click', () => {
            btnAdmin.classList.add('active');   btnAdmin.setAttribute('aria-pressed', 'true');
            btnUser.classList.remove('active'); btnUser.setAttribute('aria-pressed', 'false');
            if (descEl) {
                descEl.classList.add('admin-mode');
                descEl.innerHTML = '<p>For <strong>Super Administrators</strong> only. Access the global control panel to manage all schools, principals, and configurations.</p>';
            }
            if (ctaLink) ctaLink.href = '/login.html?mode=admin';
            if (ctaBtn) ctaBtn.textContent = 'Access Admin Gateway →';
        });
    }

    // Handle Landing Page Login (legacy — kept for compat)
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
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
});
