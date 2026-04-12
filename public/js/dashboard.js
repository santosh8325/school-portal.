document.addEventListener('DOMContentLoaded', async () => {
    let currentUser = null;
    let schoolConfig = null;
    
    // Industrial Standard: Absolute base pathing
    const apiBase = '/api'; 
    const navContainer = document.getElementById('dynamic-nav');
    const viewContainer = document.getElementById('view-container');
    const logoutBtn = document.getElementById('logout-btn');
    
    const controller = new AbortController();
    const timeoutSignal = setTimeout(() => controller.abort(), 10000);

    try {
        const [userRes, cfgRes] = await Promise.all([
            fetch(`${apiBase}/auth/me`, { signal: controller.signal }),
            fetch(`${apiBase}/config`, { signal: controller.signal })
        ]);
        clearTimeout(timeoutSignal);

        if (!userRes.ok) { window.location.href = '/login.html'; return; }
        currentUser = await userRes.json();
        currentUser.role = (currentUser.role || '').toLowerCase(); // Forced normalization
        schoolConfig = await cfgRes.json();
        console.log('[PRO-GRADE] Identity Verified:', currentUser.username, currentUser.role);
    } catch (e) {
        console.error('[PRO-GRADE] Init Error:', e);
        window.location.href = '/login.html';
        return;
    }

    // --- Dynamic UI Branding ---
    const branding = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || ''; el?.classList.remove('skeleton-text'); };
    branding('briefing-school-name', schoolConfig.name);
    branding('briefing-history', schoolConfig.history || schoolConfig.address);
    branding('briefing-achievements', schoolConfig.achievements ? `✨ ${schoolConfig.achievements}` : '');
    branding('user-name', currentUser.username);
    branding('user-role', currentUser.role.toUpperCase());
    branding('user-initial', currentUser.username.charAt(0).toUpperCase());

    if (schoolConfig.primary_color) document.documentElement.style.setProperty('--primary-color', schoolConfig.primary_color);
    if (schoolConfig.logo_url) {
        const logo = document.getElementById('briefing-logo');
        if (logo) { logo.textContent = ''; logo.style.backgroundImage = `url(${schoolConfig.logo_url})`; logo.style.backgroundSize = 'contain'; }
    }

    // --- Role-Based Module Map ---
    const roleNavs = {
        principal: [
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'staffManager', label: 'Staff', icon: '👥' },
            { id: 'logs', label: 'Security', icon: '📋' }
        ],
        teacher: [
            { id: 'classDashboard', label: 'Dashboard', icon: '📊' },
            { id: 'studentAnalysis', label: 'Analysis', icon: '📈' },
            { id: 'studentManager', label: 'Students', icon: '👥' },
            { id: 'attendance', label: 'Attendance', icon: '✅' },
            { id: 'homework', label: 'Homework', icon: '📝' },
            { id: 'crossClass', label: 'Exchange', icon: '🔄' }
        ]
    };
    
    const navItems = roleNavs[currentUser.role] || [{ id: 'overview', label: 'Dashboard', icon: '🏠' }];
    navContainer.innerHTML = '';
    navItems.forEach((nav, idx) => {
        const btn = document.createElement('button');
        btn.className = 'nav-item ' + (idx === 0 ? 'active' : '');
        btn.innerHTML = `${nav.icon} ${nav.label}`;
        btn.onclick = () => {
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderView(nav.id);
        };
        navContainer.appendChild(btn);
    });

    logoutBtn.onclick = async () => { await fetch(`${apiBase}/auth/logout`, { method: 'POST' }); window.location.href = '/login.html'; };

    // --- Pro-Grade SPA Router ---
    function renderView(viewId) {
        viewContainer.innerHTML = `<div class="skeleton skeleton-title"></div><div class="skeleton skeleton-card" style="height:300px;"></div>`;
        setTimeout(() => {
            switch(viewId) {
                case 'overview': viewContainer.innerHTML = `<h2>Overview</h2><div class="card"><p>Welcome, ${currentUser.username}.</p></div>`; break;
                case 'studentAnalysis': viewContainer.innerHTML = `<h2>Academic Performance</h2><div class="card"><canvas id="radarChart"></canvas></div>`; break;
                case 'classDashboard': viewContainer.innerHTML = `<h2>Class Intelligence</h2><div class="grid-3 gap-20"><div class="card stat-card"><h3>Students</h3><h2 id="st-count">--</h2></div><div class="card stat-card"><h3>Class Avg</h3><h2>92%</h2></div><div class="card stat-card"><h3>HW Pending</h3><h2>3</h2></div></div>`; break;
                case 'studentManager': viewContainer.innerHTML = `<h2>Student Roster</h2><div id="student-list" class="card">Loading...</div>`; break;
                case 'attendance': viewContainer.innerHTML = `<h2>Live Attendance</h2><div id="att-list" class="card">Loading...</div>`; break;
                case 'crossClass': viewContainer.innerHTML = `<h2>Exchange Requests</h2><div id="cc-list" class="card">Loading...</div>`; break;
                default: viewContainer.innerHTML = `<h2>${viewId}</h2><p>Coming Soon.</p>`;
            }
            bindViewEvents(viewId);
        }, 300);
    }

    async function bindViewEvents(viewId) {
        if (viewId === 'studentAnalysis' && window.Chart) {
            new Chart(document.getElementById('radarChart'), {
                type: 'radar',
                data: { labels: ['Math', 'Sci', 'Eng', 'Hist', 'Art'], datasets: [{ label: 'Class', data: [80, 90, 70, 85, 95], borderColor: 'red' }] }
            });
        }
        if (viewId === 'classDashboard') {
            try {
                const data = await fetch(`${apiBase}/teacher/class-stats`).then(r => r.json());
                branding('st-count', data.totalStudents);
            } catch (err) {
                console.error(err);
                branding('st-count', 'Error');
            }
        }
        if (viewId === 'studentManager' || viewId === 'attendance') {
            const list = document.getElementById(viewId === 'studentManager' ? 'student-list' : 'att-list');
            try {
                const students = await fetch(`${apiBase}/teacher/students`).then(r => r.json());
                list.innerHTML = students.map(s => `<div class="hierarchy-item"><span>${s.username}</span><span>${s.status || 'Active'}</span></div>`).join('');
            } catch (err) {
                console.error(err);
                list.innerHTML = '<p>Error loading students.</p>';
            }
        }
        if (viewId === 'crossClass') {
            const list = document.getElementById('cc-list');
            try {
                const requests = await fetch(`${apiBase}/requests/cross-class`).then(r => r.json());
                list.innerHTML = requests.length ? requests.map(r => `<div class="hierarchy-item"><span>Class: ${r.requested_class}</span><span>${r.status}</span></div>`).join('') : '<p>No exchange requests.</p>';
            } catch (err) {
                console.error(err);
                list.innerHTML = '<p>Error loading exchange requests.</p>';
            }
        }
    }

    renderView(navItems[0].id);
});

// Profile Modal Global
window.showProfileModal = async function() {
    const overlay = document.getElementById('modal-overlay');
    overlay.style.display = 'flex';
    overlay.classList.remove('hidden');
    const user = await fetch('/api/profile').then(r => r.json());
    overlay.innerHTML = `<div class="profile-modal fade-in"><button onclick="window.closeProfileModal()" class="btn-close">&times;</button><h2>${user.username}</h2><p>${user.role}</p><div id="m-qr"></div></div>`;
    if (user.qr_token && window.QRCode) new QRCode(document.getElementById('m-qr'), { text: user.qr_token, width:150, height:150 });
};
window.closeProfileModal = () => { document.getElementById('modal-overlay').style.display='none'; };
