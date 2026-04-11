document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const otpForm = document.getElementById('otp-form');
    let currentTempId = null;

    // Detect Admin Gateway mode from query param set by the toggle on index.html
    const urlParams = new URLSearchParams(window.location.search);
    const isAdminMode = urlParams.get('mode') === 'admin';
    if (isAdminMode) {
        const heading = document.getElementById('login-heading');
        const subtext = document.getElementById('login-subtext');
        const usernameInput = document.getElementById('username');
        if (heading) heading.textContent = '🛡️ Admin Gateway';
        if (subtext) subtext.textContent = 'Super Admin access only. All actions are logged.';
        if (usernameInput) usernameInput.placeholder = 'Admin username';
        // Visual badge
        const badge = document.createElement('div');
        badge.id = 'admin-mode-badge';
        badge.style.cssText = 'background:#1a252f;color:white;padding:0.4rem 1rem;border-radius:6px;font-size:0.8rem;text-align:center;margin-bottom:1rem;font-weight:600;';
        badge.textContent = '⚠️ Admin Portal — Restricted Access';
        if (loginForm) loginForm.prepend(badge);
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const msgEl = document.getElementById('login-message');
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            
            submitBtn.disabled = true;
            submitBtn.textContent = "Authenticating...";
            msgEl.textContent = "";
            
            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                
                const data = await res.json();
                
                if (res.ok) {
                    currentTempId = data.tempId;
                    if (data.demoOtp) {
                        alert("IN-APP OTP GENERATED (Demo): " + data.demoOtp);
                    }
                    // Transition effect
                    document.getElementById('login-form-wrapper').style.opacity = 0;
                    setTimeout(() => {
                        document.getElementById('login-form-wrapper').classList.add('hidden');
                        document.getElementById('otp-form-wrapper').classList.remove('hidden');
                        document.getElementById('otp-form-wrapper').style.opacity = 1;
                    }, 300);
                } else {
                    msgEl.textContent = data.error || 'Login failed';
                }
            } catch (err) {
                msgEl.textContent = 'Network error. Please try again.';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = "Secure Login";
            }
        });
    }

    if (otpForm) {
        otpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const otpCode = document.getElementById('otpCode').value;
            const msgEl = document.getElementById('otp-message');
            const submitBtn = otpForm.querySelector('button[type="submit"]');
            
            submitBtn.disabled = true;
            submitBtn.textContent = "Verifying...";
            msgEl.textContent = "";
            
            try {
                const res = await fetch('/api/auth/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tempId: currentTempId, otpCode })
                });
                
                const data = await res.json();
                
                if (res.ok) {
                    // Success, redirecting
                    submitBtn.textContent = "Success! Redirecting...";
                    window.location.href = data.redirect;
                } else {
                    msgEl.textContent = data.error || 'OTP Verification failed';
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Verify Identity";
                }
            } catch (err) {
                msgEl.textContent = 'Network error. Please try again.';
                submitBtn.disabled = false;
                submitBtn.textContent = "Verify Identity";
            }
        });
    }
});
