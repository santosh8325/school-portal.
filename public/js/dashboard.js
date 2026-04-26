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
            { id: 'chartfy', label: 'Chartfy', icon: '💬' },
            { id: 'chatAudit', label: 'Chat Audit', icon: '👁️' },
            { id: 'logs', label: 'Security', icon: '📋' }
        ],
        teacher: [
            { id: 'classDashboard', label: 'Dashboard', icon: '📊' },
            { id: 'studentAnalysis', label: 'Analysis', icon: '📈' },
            { id: 'studentManager', label: 'Students', icon: '👥' },
            { id: 'attendance', label: 'Attendance', icon: '✅' },
            { id: 'homework', label: 'Homework', icon: '📝' },
            { id: 'chartfy', label: 'Chartfy', icon: '💬' },
            { id: 'crossClass', label: 'Exchange', icon: '🔄' }
        ],
        parent: [
            { id: 'overview', label: 'Dashboard', icon: '🏠' },
            { id: 'chartfy', label: 'Chartfy', icon: '💬' }
        ],
        student: [
            { id: 'overview', label: 'Dashboard', icon: '🏠' },
            { id: 'chartfy', label: 'Chartfy', icon: '💬' }
        ]
    };
    
    const navItems = roleNavs[currentUser.role] || [
        { id: 'overview', label: 'Dashboard', icon: '🏠' },
        { id: 'chartfy', label: 'Chartfy', icon: '💬' }
    ];
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
        if (window.chartfyInterval) clearInterval(window.chartfyInterval);
        viewContainer.innerHTML = `<div class="skeleton skeleton-title"></div><div class="skeleton skeleton-card" style="height:300px;"></div>`;
        setTimeout(() => {
            switch(viewId) {
                case 'overview': viewContainer.innerHTML = `<h2>Overview</h2><div class="card"><p>Welcome, ${currentUser.username}.</p></div>`; break;
                case 'staffManager': viewContainer.innerHTML = `<h2>Staff Management</h2><div id="staff-list" class="card">Loading...</div>`; break;
                case 'logs': viewContainer.innerHTML = `<h2>Security Logs</h2><div id="sec-logs" class="card" style="max-height:60vh;overflow-y:auto;">Loading...</div>`; break;
                case 'homework': viewContainer.innerHTML = `<h2>Homework Pipeline</h2><div id="hw-list" class="card" style="max-height:60vh;overflow-y:auto;">Loading...</div>`; break;
                case 'studentAnalysis': viewContainer.innerHTML = `<h2>Academic Performance</h2><div class="card"><canvas id="radarChart"></canvas></div>`; break;
                case 'classDashboard': viewContainer.innerHTML = `<h2>Class Intelligence</h2><div class="grid-3 gap-20"><div class="card stat-card"><h3>Students</h3><h2 id="st-count">--</h2></div><div class="card stat-card"><h3>Class Avg</h3><h2>92%</h2></div><div class="card stat-card"><h3>HW Pending</h3><h2>3</h2></div></div>`; break;
                case 'studentManager': viewContainer.innerHTML = `<h2>Student Roster</h2><div id="student-list" class="card">Loading...</div>`; break;
                case 'attendance': viewContainer.innerHTML = `<h2>Live Attendance</h2><div id="att-list" class="card">Loading...</div>`; break;
                case 'crossClass': viewContainer.innerHTML = `<h2>Exchange Requests</h2><div id="cc-list" class="card">Loading...</div>`; break;
                case 'chatAudit':
                    viewContainer.innerHTML = `<h2>Chartfy Oversight (Principal)</h2>
                    <div class="grid-2 gap-20">
                        <div class="card" style="display:flex; flex-direction:column; height:60vh;">
                            <h3 style="margin-bottom:10px;">Audit Log (All School)</h3>
                            <div id="cf-audit-area" style="flex:1; overflow-y:auto; background:#f9f9f9; padding:10px; border-radius:8px;">Loading...</div>
                            <div style="margin-top:10px; font-size:0.8rem; color:#666;"><i>Real-time school-wide messaging activity.</i></div>
                        </div>
                        <div class="card">
                            <h3 style="margin-bottom:10px;">Information</h3>
                            <p style="color:#666; font-size:0.9rem;">As a Principal, you have read-only audit access across the entire school in this MVP to monitor communications. Use the "Chartfy" tab to send messages yourself.</p>
                        </div>
                    </div>`;
                    break;
                case 'chartfy':
                    viewContainer.innerHTML = `<h2>Chartfy</h2>
                    <div class="grid-2 gap-20" style="grid-template-columns: 1fr 2fr;">
                        <div class="card" style="display:flex; flex-direction:column; height:60vh;">
                            <div style="display:flex; gap:10px; margin-bottom:15px;">
                                <input type="text" id="cf-lookup-input" placeholder="Enter Exact Username..." style="flex:1; padding:8px; border:1px solid #ccc; border-radius:4px;">
                                <button id="cf-lookup-btn" class="btn-primary" style="padding:8px 12px;">Start</button>
                            </div>
                            <h3 style="margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;">Inbox</h3>
                            <div id="cf-users-list" style="flex:1; overflow-y:auto;">Loading inbox...</div>
                        </div>
                        <div class="card" style="display:flex; flex-direction:column; height:60vh;">
                            <h3 id="cf-chat-title" style="margin-bottom:10px;">Select a conversation</h3>
                            <div id="cf-chat-area" style="flex:1; overflow-y:auto; background:#f9f9f9; padding:10px; border-radius:8px; display:flex; flex-direction:column; gap:10px;">
                                <div style="margin:auto; color:#ccc;">No conversation selected.</div>
                            </div>
                            <div style="margin-top:10px; display:flex; gap:10px;">
                                <input type="text" id="cf-msg-input" placeholder="Type a message or a link..." style="flex:1; padding:10px; border:1px solid #ccc; border-radius:6px;" disabled>
                                <button id="cf-send-btn" class="btn-primary" disabled>Send</button>
                            </div>
                        </div>
                    </div>`;
                    break;
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
            const data = await fetch(`${apiBase}/teacher/class-stats`).then(r => r.json());
            branding('st-count', data.totalStudents);
        }
        if (viewId === 'staffManager') {
            const staff = await fetch(`${apiBase}/principal/staff`).then(r => r.json());
            const list = document.getElementById('staff-list');
            list.innerHTML = staff.length ? staff.map(s => `<div class="hierarchy-item"><span><b>${s.username}</b> (${s.email})</span><span class="badge">${s.role}</span></div>`).join('') : '<p>No staff found.</p>';
        }

        if (viewId === 'logs') {
            const fetchLogs = async () => {
                const logs = await fetch(`${apiBase}/principal/logs`).then(r => r.json());
                const list = document.getElementById('sec-logs');
                if(list) list.innerHTML = logs.length ? logs.map(l => `<div style="padding:10px; border-bottom:1px solid #eee;"><strong>${l.username}</strong> performed <i>${l.action}</i> on ${l.module} <br><span style="font-size:0.75rem;color:#888;">${new Date(l.created_at).toLocaleString()}</span></div>`).join('') : '<p>No logs found.</p>';
            };
            fetchLogs();
            window.chartfyInterval = setInterval(fetchLogs, 4000); // Live logs polling! We piggyback on interval clears.
        }

        if (viewId === 'homework') {
            const hw = await fetch(`${apiBase}/teacher/homework`).then(r => r.json());
            const list = document.getElementById('hw-list');
            list.innerHTML = hw.length ? hw.map(h => `<div style="padding:10px; border-bottom:1px solid #eee;"><strong>${h.title}</strong> (Class: ${h.class_name})<br><p style="margin:5px 0; font-size:0.9rem;">${h.description}</p><span style="font-size:0.75rem;color:#888;">Due: ${new Date(h.due_date).toLocaleDateString()}</span></div>`).join('') : '<p style="color:#666;">No homework assigned yet. Add one in the Teacher Portal.</p>';
        }

        if (viewId === 'studentManager' || viewId === 'attendance') {
            const students = await fetch(`${apiBase}/teacher/students`).then(r => r.json());
            const list = document.getElementById(viewId === 'studentManager' ? 'student-list' : 'att-list');
            list.innerHTML = students.map(s => `<div class="hierarchy-item"><span>${s.username}</span><span>${s.status || 'Active'}</span></div>`).join('');
        }
        
        if (viewId === 'chatAudit' && currentUser.role === 'principal') {
            const formatLinks = (text) => {
                if (!text) return '';
                return text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:inherit; text-decoration:underline;">$1</a>');
            };
            
            const fetchAudit = async () => {
                const logs = await fetch(`${apiBase}/chartfy/audit`).then(r => r.json());
                const area = document.getElementById('cf-audit-area');
                if(area) area.innerHTML = logs.map(m => `<div style="padding:8px; border-bottom:1px solid #eee;"><strong>${m.sender_name}</strong> &rarr; <strong>${m.receiver_name}</strong>: ${formatLinks(m.message_text)} <div style="font-size:0.7em; color:#888;">${new Date(m.created_at).toLocaleString()}</div></div>`).join('');
                if (logs.length === 0 && area) area.innerHTML = `<div style="color:#666;">No messages found in your school.</div>`;
            };
            fetchAudit();
            window.chartfyInterval = setInterval(fetchAudit, 5000); 
        }
        
        if (viewId === 'chartfy') {
            const formatLinks = (text) => {
                if (!text) return '';
                return text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:inherit; text-decoration:underline;">$1</a>');
            };
            
            let currentPeer = null;

            const loadInbox = async () => {
                const users = await fetch(`${apiBase}/chartfy/conversations`).then(r => r.json());
                const list = document.getElementById('cf-users-list');
                if(!list) return;
                list.innerHTML = users.map(u => `
                    <div class="hierarchy-item" style="cursor:pointer; padding:10px; border-radius:6px; margin-bottom:5px; transition:0.2s; background:${currentPeer === u.id ? '#e9ecef' : 'transparent'};" onclick="window.loadChat(${u.id}, '${u.username}')">
                        <span>👤 <b>${u.username}</b></span><span class="badge" style="font-size:0.7rem;">${u.role}</span>
                    </div>`).join('');
                if (users.length === 0) list.innerHTML = `<p style="color:#ccc; font-size:0.9rem;">No active conversations.</p>`;
            };
            loadInbox();

            const lookupBtn = document.getElementById('cf-lookup-btn');
            const lookupInput = document.getElementById('cf-lookup-input');
            const handleLookup = async () => {
                const username = lookupInput.value.trim();
                if(!username) return;
                const r = await fetch(`${apiBase}/chartfy/lookup`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username })
                });
                const data = await r.json();
                if(!r.ok) { alert(data.error); return; }
                lookupInput.value = '';
                window.loadChat(data.id, data.username);
                // Temporarily add them to the top of inbox so it looks seamless
                const list = document.getElementById('cf-users-list');
                const tempHTML = `
                    <div class="hierarchy-item" style="cursor:pointer; padding:10px; border-radius:6px; margin-bottom:5px; transition:0.2s; background:#e9ecef;" onclick="window.loadChat(${data.id}, '${data.username}')">
                        <span>👤 <b>${data.username}</b></span><span class="badge" style="font-size:0.7rem;">${data.role}</span>
                    </div>`;
                if(list.innerHTML.includes('No active conversations')) list.innerHTML = '';
                if(!list.innerHTML.includes(data.username)) list.innerHTML = tempHTML + list.innerHTML;
            };
            if(lookupBtn) lookupBtn.onclick = handleLookup;
            if(lookupInput) lookupInput.onkeypress = (e) => { if(e.key === 'Enter') handleLookup(); };

            window.loadChat = (peerId, peerName) => {
                const title = document.getElementById('cf-chat-title');
                if(title) title.innerText = `Chat with ${peerName}`;
                const inp = document.getElementById('cf-msg-input');
                if(inp) inp.disabled = false;
                const btn = document.getElementById('cf-send-btn');
                if(btn) btn.disabled = false;
                if(inp) inp.focus();
                currentPeer = peerId;
                loadInbox(); // Refresh highlighting
                fetchChat();
            };

            let wasScrolledToBottom = true;

            const fetchChat = async () => {
                if (!currentPeer) return;
                const msgs = await fetch(`${apiBase}/chartfy/messages/${currentPeer}`).then(r => r.json());
                const area = document.getElementById('cf-chat-area');
                if (area) {
                    const tolerance = 10;
                    wasScrolledToBottom = area.scrollHeight - area.scrollTop - area.clientHeight <= tolerance;

                    area.innerHTML = msgs.length ? msgs.map(m => {
                        const isMe = m.sender_id === currentUser.id;
                        return `<div style="align-self: ${isMe ? 'flex-end' : 'flex-start'}; background: ${isMe ? 'var(--primary-color, #0f3c5f)' : '#e0e0e0'}; color: ${isMe ? '#fff' : '#000'}; padding: 8px 12px; border-radius: 12px; max-width: 80%; word-break: break-word; text-align: left;">
                            <div style="font-weight:bold; font-size:0.75rem; margin-bottom:4px; opacity:0.8;">${isMe ? 'You' : 'Them'} - ${new Date(m.created_at).toLocaleTimeString()}</div>
                            <div style="white-space: pre-wrap;">${formatLinks(m.message_text)}</div>
                        </div>`;
                    }).join('') : `<div style="margin:auto; color:#ccc;">Say hi to start the conversation!</div>`;
                    
                    if (wasScrolledToBottom) {
                        area.scrollTop = area.scrollHeight;
                    }
                }
            };

            window.chartfyInterval = setInterval(fetchChat, 2000);

            const sendBtn = document.getElementById('cf-send-btn');
            const msgInput = document.getElementById('cf-msg-input');
            const sendMsg = async () => {
                if (!msgInput) return;
                const txt = msgInput.value.trim();
                if (!txt || !currentPeer) return;
                msgInput.value = '';
                await fetch(`${apiBase}/chartfy/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ receiverId: currentPeer, message: txt })
                });
                loadInbox(); // Refresh inbox list just in case it's a new conversation
                fetchChat();
            };
            if(sendBtn) sendBtn.onclick = sendMsg;
            if(msgInput) msgInput.onkeypress = (e) => { if (e.key === 'Enter') sendMsg(); };
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
    const qrData = user.qr_token || `QR-${user.id}-${user.username}`;
    if (window.QRCode) new QRCode(document.getElementById('m-qr'), { text: qrData, width:150, height:150 });
};
window.closeProfileModal = () => { document.getElementById('modal-overlay').style.display='none'; };
