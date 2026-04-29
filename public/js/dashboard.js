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
            { id: 'manageTeacher', label: 'Manage Teacher', icon: '👩‍🏫' },
            { id: 'staffManager', label: 'Staff', icon: '👥' },
            { id: 'staffAttendance', label: 'Attendance', icon: '✅' },
            { id: 'enrollManage', label: 'Enroll', icon: '➕' },
            { id: 'requests', label: 'Requests', icon: '📬' },
            { id: 'chartfy', label: 'Chartfy', icon: '💬' },
            { id: 'chatAudit', label: 'Chat Audit', icon: '👁️' },
            { id: 'logs', label: 'Security', icon: '📋' }
        ],
        teacher: [
            { id: 'classDashboard', label: 'Dashboard', icon: '📊' },
            { id: 'studentAnalysis', label: 'Analysis', icon: '📈' },
            { id: 'studentsAttendance', label: 'Students & Attendance', icon: '👥' },
            { id: 'homework', label: 'Homework', icon: '📝' },
            { id: 'teacherYoutube', label: 'YouTube', icon: '▶️' },
            { id: 'teacherOneDrive', label: 'OneDrive', icon: '☁️' },
            { id: 'chartfy', label: 'Chartfy', icon: '💬' },
            { id: 'crossClass', label: 'Exchange', icon: '🔄' }
        ],
        parent: [
            { id: 'overview', label: 'Dashboard', icon: '🏠' },
            { id: 'enrollTutor', label: 'Add Tutor', icon: '📚' },
            { id: 'chartfy', label: 'Chartfy', icon: '💬' }
        ],
        student: [
            { id: 'overview', label: 'Dashboard', icon: '🏠' },
            { id: 'studentYoutube', label: 'YouTube', icon: '▶️' },
            { id: 'studentOneDrive', label: 'OneDrive', icon: '☁️' },
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
                case 'overview': 
                    if (currentUser.role === 'principal') {
                        viewContainer.innerHTML = `<h2>School-Wide Advanced Analytics</h2>
                        <div class="grid-4 gap-20" style="margin-bottom: 20px;">
                            <div class="card stat-card"><h3>Current Enrollment</h3><h2 id="adv-enrollment">--</h2><span id="adv-enrollment-trend"></span></div>
                            <div class="card stat-card"><h3>Avg Attendance</h3><h2 id="adv-attendance">--</h2><span id="adv-attendance-trend"></span></div>
                            <div class="card stat-card"><h3>Average GPA</h3><h2 id="adv-gpa">--</h2><span id="adv-gpa-trend"></span></div>
                            <div class="card stat-card"><h3>Target Completion</h3><h2 id="adv-completion">--</h2><span id="adv-completion-trend"></span></div>
                        </div>
                        <div class="grid-2 gap-20" style="margin-bottom: 20px;">
                            <div class="card"><h3>Subject Performance (Last 3 Terms)</h3><canvas id="performanceChart" style="max-height:250px;"></canvas></div>
                            <div class="card"><h3>Attendance Heatmap (Chronic Absences)</h3><canvas id="heatmapChart" style="max-height:250px;"></canvas></div>
                        </div>
                        <div class="card" style="margin-bottom: 20px;">
                            <h3>At-Risk Students Action List</h3>
                            <table style="width:100%; border-collapse: collapse; text-align:left;">
                                <tr style="border-bottom:2px solid #eee;"><th>Student Name</th><th>Flagged Subject</th><th>Current GPA</th><th>Attendance YTD</th></tr>
                                <tbody id="adv-atrisk-body"><tr><td colspan="4">Loading...</td></tr></tbody>
                            </table>
                        </div>`;
                    } else if (currentUser.role === 'parent') {
                        viewContainer.innerHTML = `<h2>Overview</h2><div class="grid-3 gap-20"><div class="card stat-card"><h3>Children</h3><h2 id="ov-children">--</h2></div><div class="card stat-card"><h3>Fees Due</h3><h2 id="ov-fees">--</h2></div><div class="card stat-card"><h3>Pending PTM</h3><h2 id="ov-ptm">--</h2></div></div>`;
                    } else {
                        viewContainer.innerHTML = `<h2>Overview</h2><div class="card"><p>Welcome, ${currentUser.username}.</p></div>`;
                    }
                    break;
                case 'manageTeacher': viewContainer.innerHTML = `<h2>Manage Teachers</h2><div class="card"><p>Assign classes to teachers to manage their access.</p><div id="mt-list" style="margin-top:10px;">Loading teachers...</div></div>`; break;
                case 'staffManager': viewContainer.innerHTML = `<h2>Staff Management</h2><div id="staff-list" class="card">Loading...</div>`; break;
                case 'staffAttendance': viewContainer.innerHTML = `<h2>Staff Attendance</h2><div class="card"><p>Mark today's attendance for the teaching staff.</p><div id="staff-att-list" style="margin-top:15px; display:flex; flex-direction:column; gap:10px;">Loading staff roster...</div></div>`; break;
                case 'requests': viewContainer.innerHTML = `<h2>Pending Requests</h2><div id="principal-req-list" class="card">Loading...</div>`; break;
                case 'logs': viewContainer.innerHTML = `<h2>Security Logs</h2><div id="sec-logs" class="card" style="max-height:60vh;overflow-y:auto;">Loading...</div>`; break;
                case 'homework': viewContainer.innerHTML = `<h2>Homework Pipeline</h2><div class="grid-2 gap-20"><div class="card" style="display:flex; flex-direction:column;"><h3 style="margin-bottom:10px;">Assign New Homework</h3><div style="display:flex; flex-direction:column; gap:10px;"><input type="text" id="hw-title" placeholder="Homework Title" style="padding:8px; border:1px solid #ccc; border-radius:4px;"><textarea id="hw-desc" placeholder="Details/Description" rows="4" style="padding:8px; border:1px solid #ccc; border-radius:4px; resize:vertical;"></textarea><input type="date" id="hw-due" style="padding:8px; border:1px solid #ccc; border-radius:4px;"><button id="hw-submit-btn" class="btn-primary" style="padding:10px;">Assign</button></div><hr style="margin:15px 0; border:1px solid #eee;"><h3 style="margin-bottom:10px;">Bulk Upload (Excel)</h3><div style="display:flex; flex-direction:column; gap:10px;"><input type="file" id="hw-excel-file" accept=".xlsx, .xls" style="padding:8px; border:1px solid #ccc; border-radius:4px;"><button id="hw-excel-btn" style="padding:10px; background:#28a745; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">Upload Excel</button><span style="font-size:0.75rem; color:#888;">Expected columns: Title, Description, Due Date</span></div></div><div id="hw-list" class="card" style="max-height:60vh;overflow-y:auto;">Loading...</div></div>`; break;
                case 'studentAnalysis': viewContainer.innerHTML = `<h2>Academic Performance</h2><div class="card"><canvas id="radarChart"></canvas></div>`; break;
                case 'classDashboard': viewContainer.innerHTML = `<h2>Class Intelligence</h2>
                        <div class="grid-4 gap-20" style="margin-bottom: 20px;">
                            <div class="card stat-card"><h3>Class Size</h3><h2 id="adv-enrollment">--</h2><span id="adv-enrollment-trend"></span></div>
                            <div class="card stat-card"><h3>Avg Attendance</h3><h2 id="adv-attendance">--</h2><span id="adv-attendance-trend"></span></div>
                            <div class="card stat-card"><h3>Average GPA</h3><h2 id="adv-gpa">--</h2><span id="adv-gpa-trend"></span></div>
                            <div class="card stat-card"><h3>Target Completion</h3><h2 id="adv-completion">--</h2><span id="adv-completion-trend"></span></div>
                        </div>
                        <div class="grid-2 gap-20" style="margin-bottom: 20px;">
                            <div class="card"><h3>Subject Performance (Last 3 Terms)</h3><canvas id="performanceChart" style="max-height:250px;"></canvas></div>
                            <div class="card"><h3>Attendance Heatmap</h3><canvas id="heatmapChart" style="max-height:250px;"></canvas></div>
                        </div>
                        <div class="card">
                            <h3>At-Risk Students (Class)</h3>
                            <table style="width:100%; text-align:left; border-collapse:collapse;">
                                <tr style="border-bottom:2px solid #eee;"><th>Name</th><th>Flagged Subject</th><th>GPA</th><th>Attendance</th></tr>
                                <tbody id="adv-atrisk-body"><tr><td colspan="4">Loading...</td></tr></tbody>
                            </table>
                        </div>`; break;
                case 'studentsAttendance':
                    viewContainer.innerHTML = `
                    <h2>👥 Students &amp; Attendance</h2>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; align-items:start;">
                        <!-- LEFT: Student Details -->
                        <div class="card" style="display:flex; flex-direction:column; gap:0;">
                            <h3 style="margin-bottom:14px; display:flex; align-items:center; gap:8px;">🎓 Student Roster</h3>
                            <div id="student-list" style="display:flex; flex-direction:column; gap:10px;">Loading...</div>
                        </div>
                        <!-- RIGHT: Attendance -->
                        <div class="card" style="display:flex; flex-direction:column; gap:0;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                <h3 style="display:flex; align-items:center; gap:8px; margin:0;">✅ Today's Attendance</h3>
                                <button id="att-download-btn" style="display:flex; align-items:center; gap:6px; padding:7px 14px; background:#1e6f3e; color:#fff; border:none; border-radius:8px; cursor:pointer; font-size:0.82rem; font-weight:600; box-shadow:0 2px 6px rgba(0,0,0,0.15); transition:background 0.2s;" onmouseover="this.style.background='#155c32'" onmouseout="this.style.background='#1e6f3e'">📥 Download Excel</button>
                            </div>
                            <p style="color:#888; font-size:0.82rem; margin-bottom:14px;">Take attendance for your class. Select carefully.</p>
                            <div id="att-list" style="display:flex; flex-direction:column; gap:10px;">Loading class roster...</div>
                        </div>
                    </div>`;
                    break;
                case 'crossClass':
                    viewContainer.innerHTML = `
                    <h2>🔄 Exchange &amp; Enroll</h2>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; align-items:start;">
                        <!-- LEFT: Exchange Requests -->
                        <div class="card">
                            <h3 style="margin-bottom:14px;">🔄 Exchange Requests</h3>
                            <div style="display:flex; gap:8px; margin-bottom:14px;">
                                <input type="text" id="cc-class-input" placeholder="Request class (e.g. 10-B)" style="flex:1; padding:8px; border:1px solid #ccc; border-radius:6px;">
                                <button id="cc-submit-btn" class="btn-primary" style="padding:8px 14px;">Request</button>
                            </div>
                            <div id="cc-list" style="display:flex; flex-direction:column; gap:8px;">Loading...</div>
                        </div>
                        <!-- RIGHT: Enroll New Student/Parent -->
                        <div class="card">
                            <h3 style="margin-bottom:6px;">➕ Enroll New Member</h3>
                            <p style="color:#888; font-size:0.82rem; margin-bottom:14px;">Requests go to Principal for approval.</p>
                            <div style="display:flex; flex-direction:column; gap:10px;">
                                <select id="enroll-role" style="padding:9px; border:1px solid #ccc; border-radius:6px;">
                                    <option value="student">👦 Student</option>
                                    <option value="parent">👨‍👩‍👦 Parent</option>
                                </select>
                                <input type="text" id="enroll-name" placeholder="Full Name" style="padding:9px; border:1px solid #ccc; border-radius:6px;">
                                <input type="text" id="enroll-username" placeholder="Username" style="padding:9px; border:1px solid #ccc; border-radius:6px;">
                                <input type="password" id="enroll-password" placeholder="Password" style="padding:9px; border:1px solid #ccc; border-radius:6px;">
                                <input type="text" id="enroll-class" placeholder="Class (e.g. 10-A) — for students" style="padding:9px; border:1px solid #ccc; border-radius:6px;">
                                <input type="email" id="enroll-email" placeholder="Email (optional)" style="padding:9px; border:1px solid #ccc; border-radius:6px;">
                                <button id="enroll-submit-btn" class="btn-primary" style="padding:10px; background:#1e6f3e;">📨 Submit for Approval</button>
                                <div id="enroll-msg" style="font-size:0.85rem; margin-top:4px;"></div>
                            </div>
                            <hr style="margin:18px 0;">
                            <h4 style="margin-bottom:10px;">📋 My Submissions</h4>
                            <div id="my-enroll-list" style="display:flex; flex-direction:column; gap:6px; max-height:200px; overflow-y:auto;">Loading...</div>
                        </div>
                    </div>`;
                    break;
                case 'enrollManage':
                    viewContainer.innerHTML = `
                    <h2>➕ Enrollment Management</h2>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; align-items:start;">
                        <!-- LEFT: Direct Enroll -->
                        <div class="card">
                            <h3 style="margin-bottom:6px;">🎓 Directly Enroll</h3>
                            <p style="color:#888; font-size:0.82rem; margin-bottom:14px;">As Principal, enroll anyone instantly.</p>
                            <div style="display:flex; flex-direction:column; gap:10px;">
                                <select id="p-enroll-role" style="padding:9px; border:1px solid #ccc; border-radius:6px;">
                                    <option value="teacher">👩‍🏫 Teacher</option>
                                    <option value="student">👦 Student</option>
                                    <option value="parent">👨‍👩‍👦 Parent</option>
                                </select>
                                <input type="text" id="p-enroll-name" placeholder="Full Name" style="padding:9px; border:1px solid #ccc; border-radius:6px;">
                                <input type="text" id="p-enroll-username" placeholder="Username" style="padding:9px; border:1px solid #ccc; border-radius:6px;">
                                <input type="password" id="p-enroll-password" placeholder="Password" style="padding:9px; border:1px solid #ccc; border-radius:6px;">
                                <input type="text" id="p-enroll-class" placeholder="Class (e.g. 10-A) — for students/teachers" style="padding:9px; border:1px solid #ccc; border-radius:6px;">
                                <input type="email" id="p-enroll-email" placeholder="Email (optional)" style="padding:9px; border:1px solid #ccc; border-radius:6px;">
                                <button id="p-enroll-btn" class="btn-primary" style="padding:10px;">✅ Enroll Now</button>
                                <div id="p-enroll-msg" style="font-size:0.85rem; margin-top:4px;"></div>
                            </div>
                        </div>
                        <!-- RIGHT: Approval Queue -->
                        <div class="card">
                            <h3 style="margin-bottom:10px;">📬 Approval Queue</h3>
                            <div id="p-enroll-queue" style="display:flex; flex-direction:column; gap:10px; max-height:70vh; overflow-y:auto;">Loading...</div>
                        </div>
                    </div>`;
                    break;
                case 'enrollTutor':
                    viewContainer.innerHTML = `
                    <h2>📚 Add a Tutor</h2>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; align-items:start;">
                        <div class="card">
                            <h3 style="margin-bottom:10px;">📨 Request New Tutor</h3>
                            <p style="color:#888; font-size:0.82rem; margin-bottom:14px;">Submit a tutor request — Principal must approve before account is created.</p>
                            <div style="display:flex; flex-direction:column; gap:10px;">
                                <input type="text" id="t-enroll-name" placeholder="Tutor Full Name" style="padding:9px; border:1px solid #ccc; border-radius:6px;">
                                <input type="text" id="t-enroll-username" placeholder="Username" style="padding:9px; border:1px solid #ccc; border-radius:6px;">
                                <input type="password" id="t-enroll-password" placeholder="Password" style="padding:9px; border:1px solid #ccc; border-radius:6px;">
                                <input type="email" id="t-enroll-email" placeholder="Email (optional)" style="padding:9px; border:1px solid #ccc; border-radius:6px;">
                                <button id="t-enroll-btn" class="btn-primary" style="padding:10px;">📨 Submit for Approval</button>
                                <div id="t-enroll-msg" style="font-size:0.85rem; margin-top:4px;"></div>
                            </div>
                        </div>
                        <div class="card">
                            <h3 style="margin-bottom:10px;">📋 My Tutor Requests</h3>
                            <div id="t-enroll-list" style="display:flex; flex-direction:column; gap:8px; max-height:60vh; overflow-y:auto;">Loading...</div>
                        </div>
                    </div>`;
                    break;
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
                case 'teacherYoutube':
                    viewContainer.innerHTML = `<h2>▶️ YouTube Manager</h2>
                    <div class="grid-2 gap-20">
                        <div class="card">
                            <h3 style="margin-bottom:12px;">📡 Class Channel Setting</h3>
                            <p style="color:#666;font-size:0.85rem;margin-bottom:10px;">Set one YouTube channel your students will see. They can only access this channel.</p>
                            <div style="display:flex;flex-direction:column;gap:10px;">
                                <input type="text" id="yt-ch-name" placeholder="Channel Name (e.g. Khan Academy)" style="padding:9px;border:1px solid #ccc;border-radius:6px;">
                                <input type="text" id="yt-ch-url" placeholder="Channel URL (e.g. https://youtube.com/@khan)" style="padding:9px;border:1px solid #ccc;border-radius:6px;">
                                <button id="yt-ch-save-btn" class="btn-primary" style="padding:10px;">💾 Save Channel</button>
                            </div>
                            <div id="yt-ch-current" style="margin-top:14px;padding:10px;background:#f0f7ff;border-radius:8px;display:none;"></div>
                        </div>
                        <div class="card" style="display:flex;flex-direction:column;">
                            <h3 style="margin-bottom:12px;">🎬 Add Video to Playlist</h3>
                            <div style="display:flex;flex-direction:column;gap:10px;">
                                <input type="text" id="yt-vid-title" placeholder="Video Title" style="padding:9px;border:1px solid #ccc;border-radius:6px;">
                                <input type="text" id="yt-vid-url" placeholder="YouTube Video URL" style="padding:9px;border:1px solid #ccc;border-radius:6px;">
                                <button id="yt-vid-add-btn" class="btn-primary" style="padding:10px;background:#c00;">➕ Add Video</button>
                            </div>
                            <h3 style="margin-top:16px;margin-bottom:10px;">📋 Playlist</h3>
                            <div id="yt-vid-list" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;">Loading...</div>
                        </div>
                    </div>`;
                    break;
                case 'teacherOneDrive':
                    viewContainer.innerHTML = `<h2>☁️ OneDrive Manager</h2>
                    <div class="grid-2 gap-20">
                        <div class="card">
                            <h3 style="margin-bottom:12px;">📂 Share a File / Folder</h3>
                            <p style="color:#666;font-size:0.85rem;margin-bottom:10px;">Paste a OneDrive share link. Students will see these files in their OneDrive tab.</p>
                            <div style="display:flex;flex-direction:column;gap:10px;">
                                <input type="text" id="od-file-title" placeholder="File Title (e.g. Chapter 5 Notes)" style="padding:9px;border:1px solid #ccc;border-radius:6px;">
                                <select id="od-file-type" style="padding:9px;border:1px solid #ccc;border-radius:6px;">
                                    <option value="document">📄 Document</option>
                                    <option value="presentation">📊 Presentation</option>
                                    <option value="spreadsheet">📈 Spreadsheet</option>
                                    <option value="folder">📁 Folder</option>
                                    <option value="pdf">📕 PDF</option>
                                    <option value="other">📎 Other</option>
                                </select>
                                <input type="text" id="od-file-url" placeholder="OneDrive Share URL" style="padding:9px;border:1px solid #ccc;border-radius:6px;">
                                <button id="od-file-add-btn" class="btn-primary" style="padding:10px;">📤 Share File</button>
                            </div>
                        </div>
                        <div class="card">
                            <h3 style="margin-bottom:12px;">📋 Shared Files</h3>
                            <div id="od-file-list" style="display:flex;flex-direction:column;gap:8px;">Loading...</div>
                        </div>
                    </div>`;
                    break;
                case 'studentYoutube':
                    viewContainer.innerHTML = `<h2>▶️ Class YouTube Channel</h2>
                    <div id="yt-student-channel-banner" style="margin-bottom:16px;"></div>
                    <div class="card">
                        <h3 style="margin-bottom:12px;">🎬 Assigned Videos</h3>
                        <div id="yt-student-list" style="display:flex;flex-direction:column;gap:12px;">Loading...</div>
                    </div>`;
                    break;
                case 'studentOneDrive':
                    viewContainer.innerHTML = `<h2>☁️ Class OneDrive Files</h2>
                    <div class="card">
                        <p style="color:#666;font-size:0.85rem;margin-bottom:14px;">Files shared by your class teacher. Click to open in a new tab.</p>
                        <div id="od-student-list" style="display:flex;flex-direction:column;gap:10px;">Loading...</div>
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
        if ((viewId === 'classDashboard' && currentUser.role === 'teacher') || (viewId === 'overview' && currentUser.role === 'principal')) {
            const data = await fetch(`${apiBase}/analytics/advanced`).then(r => r.json());
            
            // Tier 1: KPIs
            ['enrollment', 'attendance', 'gpa', 'completion'].forEach(key => {
                const mapId = key;
                const d = data.kpis[key === 'completion' ? 'completionRate' : key];
                branding(`adv-${mapId}`, d.value);
                const trendEl = document.getElementById(`adv-${mapId}-trend`);
                if (trendEl) {
                    const isPositive = d.trend > 0;
                    const color = (isPositive === d.upIsGood) ? 'green' : 'red';
                    const icon = isPositive ? '▲' : (d.trend < 0 ? '▼' : '-');
                    trendEl.style.color = color;
                    trendEl.innerHTML = `${icon} ${Math.abs(d.trend)}%`;
                }
            });

            // Tier 2: Visuals
            if (window.Chart) {
                const perfCtx = document.getElementById('performanceChart');
                if (perfCtx) {
                    new Chart(perfCtx, {
                        type: 'line',
                        data: data.charts.performance,
                        options: {
                            responsive: true,
                            onClick: (evt, elements, chart) => {
                                if (elements.length > 0) {
                                    const datasetIndex = elements[0].datasetIndex;
                                    const subjectLabel = data.charts.performance.datasets[datasetIndex].label;
                                    // Tier 3: Drill-down filter
                                    const tbody = document.getElementById('adv-atrisk-body');
                                    const filtered = data.atRisk.filter(s => s.subject === subjectLabel);
                                    tbody.innerHTML = filtered.length ? filtered.map(s => `<tr><td style="padding:10px;">${s.name}</td><td style="padding:10px;">${s.subject}</td><td style="padding:10px; color:red;">${s.gpa}</td><td style="padding:10px;">${s.attendance}</td></tr>`).join('') : '<tr><td colspan="4" style="padding:10px;text-align:center;">No students at risk.</td></tr>';
                                }
                            }
                        }
                    });
                }
                const heatCtx = document.getElementById('heatmapChart');
                if (heatCtx) {
                    new Chart(heatCtx, {
                        type: 'bar',
                        data: {
                            labels: data.charts.attendanceHeatmap.labels,
                            datasets: [{ label: 'Absences', data: data.charts.attendanceHeatmap.data, backgroundColor: '#ff9800' }]
                        }
                    });
                }
            }

            // Tier 3: Initial Load
            const tbody = document.getElementById('adv-atrisk-body');
            if (tbody) {
                tbody.innerHTML = data.atRisk.map(s => `<tr><td style="padding:10px;">${s.name}</td><td style="padding:10px;">${s.subject}</td><td style="padding:10px; color:red;">${s.gpa}</td><td style="padding:10px;">${s.attendance}</td></tr>`).join('');
            }
        }
        if (viewId === 'overview' && currentUser.role === 'parent') {
            const data = await fetch(`${apiBase}/parent/overview-stats`).then(r => r.json());
            branding('ov-children', data.childrenCount);
            branding('ov-fees', data.feesDue);
            branding('ov-ptm', data.pendingPtm);
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
            const loadHomework = async () => {
                const hw = await fetch(`${apiBase}/teacher/homework`).then(r => r.json());
                const list = document.getElementById('hw-list');
                if (list) {
                    list.innerHTML = hw.length ? hw.map(h => `<div style="padding:10px; border-bottom:1px solid #eee;"><strong>${h.title}</strong> (Class: ${h.class_name})<br><p style="margin:5px 0; font-size:0.9rem;">${h.description}</p><span style="font-size:0.75rem;color:#888;">Due: ${new Date(h.due_date).toLocaleDateString()}</span></div>`).join('') : '<p style="color:#666;">No homework assigned yet.</p>';
                }
            };
            loadHomework();

            const assignBtn = document.getElementById('hw-submit-btn');
            if (assignBtn) {
                assignBtn.onclick = async () => {
                    const title = document.getElementById('hw-title').value.trim();
                    const desc = document.getElementById('hw-desc').value.trim();
                    const due = document.getElementById('hw-due').value;
                    if (!title || !desc || !due) return alert("Please fill all fields.");
                    
                    assignBtn.disabled = true;
                    assignBtn.textContent = "Assigning...";
                    const res = await fetch(`${apiBase}/teacher/homework`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title, description: desc, due_date: due })
                    });
                    assignBtn.disabled = false;
                    assignBtn.textContent = "Assign";
                    
                    if (res.ok) {
                        document.getElementById('hw-title').value = '';
                        document.getElementById('hw-desc').value = '';
                        document.getElementById('hw-due').value = '';
                        loadHomework();
                    } else {
                        const err = await res.json();
                        alert("Error: " + err.error);
                    }
                };
            }

            const excelBtn = document.getElementById('hw-excel-btn');
            if (excelBtn) {
                excelBtn.onclick = async () => {
                    const fileInput = document.getElementById('hw-excel-file');
                    const file = fileInput.files[0];
                    if (!file) return alert("Please select an Excel file first.");
                    
                    excelBtn.disabled = true;
                    excelBtn.textContent = "Uploading...";
                    
                    const formData = new FormData();
                    formData.append('excelFile', file);
                    
                    try {
                        const res = await fetch(`${apiBase}/teacher/homework/bulk`, {
                            method: 'POST',
                            body: formData
                        });
                        if (res.ok) {
                            const data = await res.json();
                            alert(`Success! Imported ${data.count} homework assignment(s).`);
                            fileInput.value = '';
                            loadHomework();
                        } else {
                            const err = await res.json();
                            alert("Error: " + err.error);
                        }
                    } catch (e) {
                        alert("Error uploading file.");
                    }
                    excelBtn.disabled = false;
                    excelBtn.textContent = "Upload Excel";
                };
            }
        }

        if (viewId === 'studentsAttendance') {
            const students = await fetch(`${apiBase}/teacher/students`).then(r => r.json());
            const className = currentUser.class_name || 'Class';

            // LEFT PANEL: Student roster details
            const studentList = document.getElementById('student-list');
            if (studentList) {
                studentList.innerHTML = students.length ? students.map((s, idx) => `
                    <div class="hierarchy-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; border-radius:8px; background:${idx % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent'};">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="width:34px; height:34px; border-radius:50%; background:var(--primary-color,#0f3c5f); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.9rem;">${s.username.charAt(0).toUpperCase()}</div>
                            <div>
                                <div style="font-weight:600;">${s.username}</div>
                                <div style="font-size:0.75rem; color:#888;">Roll #${idx + 1} &bull; ${className}</div>
                            </div>
                        </div>
                        <span style="font-size:0.78rem; padding:3px 10px; border-radius:20px; background:#e8f5e9; color:#2e7d32; font-weight:600;">${s.status || 'Active'}</span>
                    </div>`).join('') : '<p style="color:#aaa;">No students assigned to your class.</p>';
            }

            // RIGHT PANEL: Attendance
            const attList = document.getElementById('att-list');
            const today = new Date().toISOString().split('T')[0];
            const preAtt = await fetch(`${apiBase}/teacher/attendance/today`).then(r => r.json());
            const attMap = {};
            preAtt.forEach(a => attMap[a.student_id] = a.status);

            if (attList) {
                attList.innerHTML = students.length ? students.map(s => {
                    const status = attMap[s.id];
                    const controls = status
                        ? `<span style="font-weight:bold; color:${status === 'Present' ? '#2e7d32' : '#c62828'}; margin-right:8px;">${status === 'Present' ? '✅' : '❌'} ${status}</span><button onclick="resetAttendanceUI(${s.id}, '${today}')" class="btn-secondary" style="padding:4px 8px; font-size:0.78rem; border-radius:4px; border:1px solid #ccc; cursor:pointer;">Edit</button>`
                        : `<button onclick="markAttendance(${s.id}, '${today}', 'Present')" class="btn-primary" style="background:#2e7d32; padding:5px 12px; font-size:0.82rem;">✅ Present</button><button onclick="markAttendance(${s.id}, '${today}', 'Absent')" class="btn-danger" style="padding:5px 12px; font-size:0.82rem;">❌ Absent</button>`;
                    return `
                    <div class="hierarchy-item" style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px;">
                        <span style="font-weight:600;">${s.username}</span>
                        <div style="display:flex; gap:8px; align-items:center;" id="att-controls-${s.id}">
                            ${controls}
                        </div>
                    </div>`;
                }).join('') : '<p style="color:#aaa;">No students assigned.</p>';
            }

            // ---- DOWNLOAD EXCEL BUTTON ----
            const dlBtn = document.getElementById('att-download-btn');
            if (dlBtn) {
                dlBtn.onclick = () => {
                    if (!window.XLSX) { alert('Excel library not loaded. Please refresh the page.'); return; }

                    // Build rows: re-read latest attMap from DOM controls
                    const rows = [['Roll No', 'Student Name', 'Class', 'Date', 'Status']];
                    students.forEach((s, idx) => {
                        // Read live status from DOM in case teacher just marked attendance
                        const ctrl = document.getElementById('att-controls-' + s.id);
                        let liveStatus = attMap[s.id] || 'Not Marked';
                        if (ctrl) {
                            const span = ctrl.querySelector('span');
                            if (span) {
                                const txt = span.textContent.trim();
                                if (txt.includes('Present')) liveStatus = 'Present';
                                else if (txt.includes('Absent')) liveStatus = 'Absent';
                            }
                        }
                        rows.push([idx + 1, s.username, className, today, liveStatus]);
                    });

                    const ws = window.XLSX.utils.aoa_to_sheet(rows);

                    // Style header row width
                    ws['!cols'] = [
                        { wch: 10 }, { wch: 25 }, { wch: 12 }, { wch: 14 }, { wch: 14 }
                    ];

                    const wb = window.XLSX.utils.book_new();
                    window.XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
                    window.XLSX.writeFile(wb, `Attendance_${className}_${today}.xlsx`);
                };
            }

            window.markAttendance = async (studentId, date, status) => {
                const res = await fetch(`${apiBase}/teacher/attendance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ studentId, date, status })
                });
                if (res.ok) {
                    const ctrl = document.getElementById('att-controls-' + studentId);
                    if (ctrl) {
                        ctrl.innerHTML = `<span style="font-weight:bold; color:${status === 'Present' ? '#2e7d32' : '#c62828'}; margin-right:8px;">${status === 'Present' ? '✅' : '❌'} ${status}</span>
                        <button onclick="resetAttendanceUI(${studentId}, '${date}')" class="btn-secondary" style="padding:4px 8px; font-size:0.78rem; border-radius:4px; border:1px solid #ccc; cursor:pointer;">Edit</button>`;
                    }
                } else {
                    alert('Error marking attendance.');
                }
            };

            window.resetAttendanceUI = (studentId, date) => {
                const ctrl = document.getElementById('att-controls-' + studentId);
                if (ctrl) {
                    ctrl.innerHTML = `
                        <button onclick="markAttendance(${studentId}, '${date}', 'Present')" class="btn-primary" style="background:#2e7d32; padding:5px 12px; font-size:0.82rem;">✅ Present</button>
                        <button onclick="markAttendance(${studentId}, '${date}', 'Absent')" class="btn-danger" style="padding:5px 12px; font-size:0.82rem;">❌ Absent</button>
                    `;
                }
            };
        }

        if (viewId === 'staffAttendance' && currentUser.role === 'principal') {
            const staff = await fetch(`${apiBase}/principal/staff`).then(r => r.json());
            const teachers = staff.filter(s => s.role === 'teacher' || s.role === 'staff');
            const list = document.getElementById('staff-att-list');
            const today = new Date().toISOString().split('T')[0];
            const preAtt = await fetch(`${apiBase}/principal/attendance/today`).then(r => r.json());
            const attMap = {};
            preAtt.forEach(a => attMap[a.student_id] = a.status);
            
            list.innerHTML = teachers.length ? teachers.map(s => {
                const status = attMap[s.id];
                const controls = status 
                    ? `<span style="font-weight:bold; color:${status === 'Present' ? 'green' : 'red'}; margin-right:10px;">${status}</span><button onclick="resetStaffAttendanceUI(${s.id}, '${today}')" class="btn-secondary" style="padding:4px 8px; font-size:0.8rem; border-radius:4px; border:1px solid #ccc; cursor:pointer;">Edit</button>`
                    : `<button onclick="markStaffAttendance(${s.id}, '${today}', 'Present')" class="btn-primary" style="background:green;">Present</button><button onclick="markStaffAttendance(${s.id}, '${today}', 'Absent')" class="btn-danger">Absent</button>`;
                return `
                <div class="hierarchy-item" style="display:flex; justify-content:space-between; align-items:center;">
                    <span><b>${s.username}</b></span>
                    <div style="display:flex; gap:10px; align-items:center;" id="staff-att-controls-${s.id}">
                        ${controls}
                    </div>
                </div>
                `;
            }).join('') : '<p>No teachers assigned.</p>';
            
            window.markStaffAttendance = async (studentId, date, status) => {
                const res = await fetch(`${apiBase}/principal/attendance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ studentId, date, status })
                });
                if(res.ok) {
                    const ctrl = document.getElementById('staff-att-controls-' + studentId);
                    if (ctrl) {
                        ctrl.innerHTML = `<span style="font-weight:bold; color:${status === 'Present' ? 'green' : 'red'}; margin-right:10px;">${status}</span>
                        <button onclick="resetStaffAttendanceUI(${studentId}, '${date}')" class="btn-secondary" style="padding:4px 8px; font-size:0.8rem; border-radius:4px; border:1px solid #ccc; cursor:pointer;">Edit</button>`;
                    }
                } else {
                    alert('Error marking attendance.');
                }
            };

            window.resetStaffAttendanceUI = (studentId, date) => {
                const ctrl = document.getElementById('staff-att-controls-' + studentId);
                if (ctrl) {
                    ctrl.innerHTML = `
                        <button onclick="markStaffAttendance(${studentId}, '${date}', 'Present')" class="btn-primary" style="background:green;">Present</button>
                        <button onclick="markStaffAttendance(${studentId}, '${date}', 'Absent')" class="btn-danger">Absent</button>
                    `;
                }
            };
        }

        if (viewId === 'requests' && currentUser.role === 'principal') {
            const list = document.getElementById('principal-req-list');
            try {
                const reqs = await fetch(`${apiBase}/principal/requests`).then(r => r.json());
                let html = '';
                if (reqs.crossClass && reqs.crossClass.length) {
                    html += `<h3>Cross-Class Requests</h3>` + reqs.crossClass.map(r => `
                        <div class="hierarchy-item" style="display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <b>${r.teacher_name}</b> requested: ${r.requested_class}<br>
                                <span style="font-size:0.8rem; color:${r.status==='Approved'?'green':'orange'};">${r.status}</span>
                            </div>
                            ${r.status !== 'Approved' ? `<button onclick="approveRequest('crossClass', ${r.id})" class="btn-primary" style="background:#28a745;">Approve</button>` : `<span style="color:#28a745; font-weight:bold;">Approved</span>`}
                        </div>
                    `).join('');
                }
                if (reqs.relieving && reqs.relieving.length) {
                    html += `<h3 style="margin-top:15px;">Relieving Requests</h3>` + reqs.relieving.map(r => `
                        <div class="hierarchy-item" style="display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <b>${r.teacher_name}</b> requested relief regarding <b>${r.student_name}</b><br>
                                <i>"${r.draft_text}"</i><br>
                                <span style="font-size:0.8rem; color:${r.status==='Approved'?'green':'orange'};">${r.status}</span>
                            </div>
                            ${r.status !== 'Approved' ? `<button onclick="approveRequest('relieving', ${r.id})" class="btn-primary" style="background:#28a745;">Approve</button>` : `<span style="color:#28a745; font-weight:bold;">Approved</span>`}
                        </div>
                    `).join('');
                }
                list.innerHTML = html || '<p>No pending requests.</p>';

                window.approveRequest = async (type, id) => {
                    const res = await fetch(`${apiBase}/principal/requests/approve`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type, id })
                    });
                    if (res.ok) {
                        renderView('requests');
                    } else {
                        alert('Error approving request.');
                    }
                };
            } catch (err) {
                list.innerHTML = '<p style="color:red;">Error loading requests.</p>';
            }
        }

        if (viewId === 'manageTeacher') {
            const staff = await fetch(`${apiBase}/principal/staff`).then(r => r.json());
            const teachers = staff.filter(s => s.role === 'teacher');
            const list = document.getElementById('mt-list');
            list.innerHTML = teachers.length ? teachers.map(t => `
                <div class="hierarchy-item" style="display:flex; justify-content:space-between; align-items:center;">
                    <span><b>${t.username}</b> (Current: ${t.class_name || 'None'})</span>
                    <div style="display:flex; gap:10px;">
                        <input type="text" id="assign-class-${t.id}" placeholder="e.g. 10-A" style="padding:5px; border:1px solid #ccc; width:100px;">
                        <button onclick="assignClass(${t.id})" class="btn-primary" style="padding:5px 10px;">Assign</button>
                    </div>
                </div>
            `).join('') : '<p>No teachers available.</p>';
            
            window.assignClass = async (teacherId) => {
                const className = document.getElementById(`assign-class-${teacherId}`).value.trim();
                if (!className) return alert("Enter a valid class name.");
                const res = await fetch(`${apiBase}/principal/assign-class`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ teacherId, className })
                });
                if(res.ok) {
                    alert('Class successfully assigned!');
                    renderView('manageTeacher'); // reload view
                } else {
                    alert('Error assigning class.');
                }
            };
        }
        
        if (viewId === 'crossClass') {
            // Load exchange requests
            const loadCcList = async () => {
                const requests = await fetch(`${apiBase}/requests/cross-class`).then(r => r.json());
                const list = document.getElementById('cc-list');
                if (list) {
                    list.innerHTML = requests.length ? requests.map(req =>
                        `<div class="hierarchy-item" style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px;">
                            <div>
                                <strong>→ ${req.requested_class}</strong>
                                <div style="font-size:0.78rem; color:#888;">${new Date(req.created_at).toLocaleDateString()}</div>
                            </div>
                            <span style="font-size:0.78rem; padding:3px 10px; border-radius:20px; background:${req.status === 'Approved' ? '#e8f5e9' : '#fff3e0'}; color:${req.status === 'Approved' ? '#2e7d32' : '#e65100'}; font-weight:600;">${req.status}</span>
                        </div>`
                    ).join('') : '<p style="color:#aaa; padding:10px;">No exchange requests yet.</p>';
                }
            };
            loadCcList();

            const ccBtn = document.getElementById('cc-submit-btn');
            if (ccBtn) ccBtn.onclick = async () => {
                const cls = document.getElementById('cc-class-input').value.trim();
                if (!cls) return alert('Please enter a class name.');
                const r = await fetch(`${apiBase}/requests/cross-class`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ requestedClass: cls }) });
                if (r.ok) { document.getElementById('cc-class-input').value = ''; loadCcList(); }
                else { const e = await r.json(); alert(e.error); }
            };

            // Enroll form
            const loadMyEnrollments = async () => {
                const reqs = await fetch(`${apiBase}/enroll/my-requests`).then(r => r.json());
                const list = document.getElementById('my-enroll-list');
                if (list) {
                    const statusColor = { Pending: '#e65100', Approved: '#2e7d32', Rejected: '#c62828' };
                    list.innerHTML = reqs.length ? reqs.map(r =>
                        `<div style="padding:8px 10px; border-radius:8px; border:1px solid #eee; font-size:0.82rem;">
                            <b>${r.username}</b> (${r.role}${r.class_name ? ' · ' + r.class_name : ''})
                            <span style="float:right; color:${statusColor[r.status] || '#555'}; font-weight:700;">${r.status}</span>
                            ${r.reject_reason ? '<div style="color:#c62828; margin-top:3px;">' + r.reject_reason + '</div>' : ''}
                        </div>`
                    ).join('') : '<p style="color:#aaa; font-size:0.85rem;">No submissions yet.</p>';
                }
            };
            loadMyEnrollments();

            const enrollBtn = document.getElementById('enroll-submit-btn');
            const enrollMsg = document.getElementById('enroll-msg');
            if (enrollBtn) enrollBtn.onclick = async () => {
                const role = document.getElementById('enroll-role').value;
                const full_name = document.getElementById('enroll-name').value.trim();
                const username = document.getElementById('enroll-username').value.trim();
                const password = document.getElementById('enroll-password').value;
                const class_name = document.getElementById('enroll-class').value.trim();
                const email = document.getElementById('enroll-email').value.trim();
                if (!username || !password) return (enrollMsg.innerHTML = '<span style="color:red;">Username and password are required.</span>');
                enrollBtn.disabled = true; enrollBtn.textContent = 'Submitting...';
                const r = await fetch(`${apiBase}/enroll/request`, {
                    method: 'POST', headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ role, full_name, username, password, class_name, email })
                });
                const data = await r.json();
                enrollBtn.disabled = false; enrollBtn.textContent = '📨 Submit for Approval';
                if (r.ok) {
                    enrollMsg.innerHTML = `<span style="color:#2e7d32;">✅ ${data.message}</span>`;
                    ['enroll-name','enroll-username','enroll-password','enroll-class','enroll-email'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
                    loadMyEnrollments();
                } else {
                    enrollMsg.innerHTML = `<span style="color:red;">❌ ${data.error}</span>`;
                }
            };
        }

        if (viewId === 'enrollManage' && currentUser.role === 'principal') {
            // ---- Direct Enroll ----
            const pEnrollBtn = document.getElementById('p-enroll-btn');
            const pEnrollMsg = document.getElementById('p-enroll-msg');
            if (pEnrollBtn) pEnrollBtn.onclick = async () => {
                const role = document.getElementById('p-enroll-role').value;
                const full_name = document.getElementById('p-enroll-name').value.trim();
                const username = document.getElementById('p-enroll-username').value.trim();
                const password = document.getElementById('p-enroll-password').value;
                const class_name = document.getElementById('p-enroll-class').value.trim();
                const email = document.getElementById('p-enroll-email').value.trim();
                if (!username || !password) return (pEnrollMsg.innerHTML = '<span style="color:red;">Username and password required.</span>');
                pEnrollBtn.disabled = true; pEnrollBtn.textContent = 'Enrolling...';
                const r = await fetch(`${apiBase}/principal/enroll`, {
                    method: 'POST', headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ role, full_name, username, password, class_name, email })
                });
                const data = await r.json();
                pEnrollBtn.disabled = false; pEnrollBtn.textContent = '✅ Enroll Now';
                if (r.ok) {
                    pEnrollMsg.innerHTML = `<span style="color:#2e7d32;">✅ ${data.message}</span>`;
                    ['p-enroll-name','p-enroll-username','p-enroll-password','p-enroll-class','p-enroll-email'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
                } else {
                    pEnrollMsg.innerHTML = `<span style="color:red;">❌ ${data.error}</span>`;
                }
            };

            // ---- Approval Queue ----
            const loadQueue = async () => {
                const reqs = await fetch(`${apiBase}/principal/enrollment-requests`).then(r => r.json());
                const queue = document.getElementById('p-enroll-queue');
                if (!queue) return;
                const statusColor = { Pending: '#e65100', Approved: '#2e7d32', Rejected: '#c62828' };
                if (!reqs.length) { queue.innerHTML = '<p style="color:#aaa;">No enrollment requests yet.</p>'; return; }
                queue.innerHTML = reqs.map(r => `
                    <div style="padding:12px; border:1px solid #eee; border-radius:10px; background:#fafafa;" id="eq-${r.id}">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <div>
                                <b>${r.username}</b>
                                <span style="font-size:0.78rem; margin-left:8px; padding:2px 8px; border-radius:12px; background:#e3f2fd; color:#1565c0;">${r.role}</span>
                                ${r.class_name ? `<span style="font-size:0.78rem; color:#888; margin-left:6px;">· ${r.class_name}</span>` : ''}
                            </div>
                            <span style="font-size:0.78rem; font-weight:700; color:${statusColor[r.status] || '#555'};">${r.status}</span>
                        </div>
                        <div style="font-size:0.78rem; color:#666; margin-bottom:8px;">Requested by <b>${r.requester_name}</b> (${r.requester_role}) · ${new Date(r.created_at).toLocaleDateString()}</div>
                        ${r.status === 'Pending' ? `
                        <div style="display:flex; gap:8px;">
                            <button onclick="approveEnrollment(${r.id})" class="btn-primary" style="padding:5px 14px; background:#2e7d32; font-size:0.82rem;">✅ Approve</button>
                            <button onclick="rejectEnrollment(${r.id})" class="btn-danger" style="padding:5px 14px; font-size:0.82rem;">❌ Reject</button>
                        </div>` : ''}
                        ${r.status === 'Rejected' && r.reject_reason ? `<div style="font-size:0.78rem; color:#c62828; margin-top:4px;">Reason: ${r.reject_reason}</div>` : ''}
                    </div>`).join('');

                window.approveEnrollment = async (id) => {
                    const r = await fetch(`${apiBase}/principal/enrollment-requests/approve`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id }) });
                    const data = await r.json();
                    if (r.ok) { alert(data.message); loadQueue(); }
                    else alert(data.error);
                };
                window.rejectEnrollment = async (id) => {
                    const reason = prompt('Reason for rejection (optional):') || '';
                    const r = await fetch(`${apiBase}/principal/enrollment-requests/reject`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, reason }) });
                    if (r.ok) loadQueue();
                };
            };
            loadQueue();
        }

        if (viewId === 'enrollTutor' && currentUser.role === 'parent') {
            const loadTutorReqs = async () => {
                const reqs = await fetch(`${apiBase}/enroll/my-requests`).then(r => r.json());
                const list = document.getElementById('t-enroll-list');
                if (list) {
                    const statusColor = { Pending: '#e65100', Approved: '#2e7d32', Rejected: '#c62828' };
                    list.innerHTML = reqs.length ? reqs.map(r =>
                        `<div style="padding:8px 10px; border-radius:8px; border:1px solid #eee; font-size:0.83rem;">
                            <b>${r.username}</b> (${r.role})
                            <span style="float:right; color:${statusColor[r.status] || '#555'}; font-weight:700;">${r.status}</span>
                            ${r.reject_reason ? '<div style="color:#c62828; margin-top:3px;">' + r.reject_reason + '</div>' : ''}
                        </div>`
                    ).join('') : '<p style="color:#aaa; font-size:0.85rem;">No tutor requests yet.</p>';
                }
            };
            loadTutorReqs();

            const tBtn = document.getElementById('t-enroll-btn');
            const tMsg = document.getElementById('t-enroll-msg');
            if (tBtn) tBtn.onclick = async () => {
                const full_name = document.getElementById('t-enroll-name').value.trim();
                const username = document.getElementById('t-enroll-username').value.trim();
                const password = document.getElementById('t-enroll-password').value;
                const email = document.getElementById('t-enroll-email').value.trim();
                if (!username || !password) return (tMsg.innerHTML = '<span style="color:red;">Username and password required.</span>');
                tBtn.disabled = true; tBtn.textContent = 'Submitting...';
                const r = await fetch(`${apiBase}/enroll/request`, {
                    method: 'POST', headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ role: 'tutor', full_name, username, password, email })
                });
                const data = await r.json();
                tBtn.disabled = false; tBtn.textContent = '📨 Submit for Approval';
                if (r.ok) {
                    tMsg.innerHTML = `<span style="color:#2e7d32;">✅ ${data.message}</span>`;
                    ['t-enroll-name','t-enroll-username','t-enroll-password','t-enroll-email'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
                    loadTutorReqs();
                } else {
                    tMsg.innerHTML = `<span style="color:red;">❌ ${data.error}</span>`;
                }
            };
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

        // ---- TEACHER YOUTUBE MANAGER ----
        if (viewId === 'teacherYoutube') {
            const getYtEmbedId = (url) => {
                const m = url.match(/(?:v=|youtu\.be\/|embed\/)([^&?/]+)/);
                return m ? m[1] : null;
            };

            const loadChannel = async () => {
                const ch = await fetch(`${apiBase}/teacher/youtube/channel`).then(r => r.json());
                const box = document.getElementById('yt-ch-current');
                if (ch && box) {
                    box.style.display = 'block';
                    box.innerHTML = `<strong>Current Channel:</strong> <a href="${ch.channel_url}" target="_blank" rel="noopener">${ch.channel_name}</a>`;
                    document.getElementById('yt-ch-name').value = ch.channel_name || '';
                    document.getElementById('yt-ch-url').value = ch.channel_url || '';
                }
            };
            loadChannel();

            const loadVideos = async () => {
                const vids = await fetch(`${apiBase}/teacher/youtube/videos`).then(r => r.json());
                const list = document.getElementById('yt-vid-list');
                if (!list) return;
                list.innerHTML = vids.length ? vids.map(v => {
                    const eid = getYtEmbedId(v.video_url);
                    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border:1px solid #eee;border-radius:8px;gap:10px;">
                        <div style="display:flex;align-items:center;gap:10px;">
                            ${eid ? `<img src="https://img.youtube.com/vi/${eid}/default.jpg" style="width:80px;border-radius:4px;">` : '🎬'}
                            <span><b>${v.video_title}</b><br><a href="${v.video_url}" target="_blank" style="font-size:0.78rem;color:#1565c0;">Open ↗</a></span>
                        </div>
                        <button onclick="removeYtVideo(${v.id})" style="background:#c00;color:#fff;border:none;border-radius:6px;padding:5px 10px;cursor:pointer;">🗑 Remove</button>
                    </div>`;
                }).join('') : '<p style="color:#aaa;">No videos yet. Add from the form.</p>';
            };
            loadVideos();

            window.removeYtVideo = async (id) => {
                await fetch(`${apiBase}/teacher/youtube/videos/${id}`, { method: 'DELETE' });
                loadVideos();
            };

            const saveChBtn = document.getElementById('yt-ch-save-btn');
            if (saveChBtn) saveChBtn.onclick = async () => {
                const channel_name = document.getElementById('yt-ch-name').value.trim();
                const channel_url = document.getElementById('yt-ch-url').value.trim();
                if (!channel_url) return alert('Please enter a channel URL.');
                await fetch(`${apiBase}/teacher/youtube/channel`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ channel_name, channel_url }) });
                loadChannel();
                alert('Channel saved!');
            };

            const addVidBtn = document.getElementById('yt-vid-add-btn');
            if (addVidBtn) addVidBtn.onclick = async () => {
                const video_title = document.getElementById('yt-vid-title').value.trim();
                const video_url = document.getElementById('yt-vid-url').value.trim();
                if (!video_url) return alert('Please enter a video URL.');
                await fetch(`${apiBase}/teacher/youtube/videos`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ video_title, video_url }) });
                document.getElementById('yt-vid-title').value = '';
                document.getElementById('yt-vid-url').value = '';
                loadVideos();
            };
        }

        // ---- TEACHER ONEDRIVE MANAGER ----
        if (viewId === 'teacherOneDrive') {
            const fileIcons = { document:'📄', presentation:'📊', spreadsheet:'📈', folder:'📁', pdf:'📕', other:'📎' };

            const loadFiles = async () => {
                const files = await fetch(`${apiBase}/teacher/onedrive`).then(r => r.json());
                const list = document.getElementById('od-file-list');
                if (!list) return;
                list.innerHTML = files.length ? files.map(f => `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border:1px solid #eee;border-radius:8px;">
                        <span>${fileIcons[f.file_type] || '📎'} <b>${f.file_title}</b><br><a href="${f.file_url}" target="_blank" style="font-size:0.78rem;color:#1565c0;">Open in OneDrive ↗</a></span>
                        <button onclick="removeOdFile(${f.id})" style="background:#c00;color:#fff;border:none;border-radius:6px;padding:5px 10px;cursor:pointer;">🗑</button>
                    </div>`).join('') : '<p style="color:#aaa;">No files shared yet.</p>';
            };
            loadFiles();

            window.removeOdFile = async (id) => {
                await fetch(`${apiBase}/teacher/onedrive/${id}`, { method: 'DELETE' });
                loadFiles();
            };

            const addFileBtn = document.getElementById('od-file-add-btn');
            if (addFileBtn) addFileBtn.onclick = async () => {
                const file_title = document.getElementById('od-file-title').value.trim();
                const file_url = document.getElementById('od-file-url').value.trim();
                const file_type = document.getElementById('od-file-type').value;
                if (!file_url) return alert('Please enter a file URL.');
                await fetch(`${apiBase}/teacher/onedrive`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ file_title, file_url, file_type }) });
                document.getElementById('od-file-title').value = '';
                document.getElementById('od-file-url').value = '';
                loadFiles();
            };
        }

        // ---- STUDENT YOUTUBE VIEWER ----
        if (viewId === 'studentYoutube') {
            const getYtEmbedId = (url) => {
                const m = url.match(/(?:v=|youtu\.be\/|embed\/)([^&?/]+)/);
                return m ? m[1] : null;
            };
            const data = await fetch(`${apiBase}/student/youtube`).then(r => r.json());

            const banner = document.getElementById('yt-student-channel-banner');
            if (banner) {
                if (data.channel) {
                    banner.innerHTML = `<div class="card" style="background:linear-gradient(135deg,#ff0000,#cc0000);color:#fff;padding:16px 20px;border-radius:12px;">
                        <h3 style="margin:0 0 4px;">📡 Class Channel: ${data.channel.channel_name}</h3>
                        <a href="${data.channel.channel_url}" target="_blank" rel="noopener" style="color:#ffe0e0;font-size:0.9rem;">${data.channel.channel_url} ↗</a>
                    </div>`;
                } else {
                    banner.innerHTML = `<div class="card" style="color:#888;"><p>Your teacher hasn't set a YouTube channel yet.</p></div>`;
                }
            }

            const list = document.getElementById('yt-student-list');
            if (list) {
                list.innerHTML = data.videos.length ? data.videos.map(v => {
                    const eid = getYtEmbedId(v.video_url);
                    return `<div style="border:1px solid #eee;border-radius:10px;overflow:hidden;">
                        ${eid ? `<iframe width="100%" height="220" src="https://www.youtube.com/embed/${eid}" frameborder="0" allowfullscreen style="display:block;"></iframe>` : ''}
                        <div style="padding:10px;"><b>${v.video_title}</b> <a href="${v.video_url}" target="_blank" style="font-size:0.8rem;color:#c00;">Watch on YouTube ↗</a></div>
                    </div>`;
                }).join('') : '<p style="color:#aaa;">No videos assigned yet by your teacher.</p>';
            }
        }

        // ---- STUDENT ONEDRIVE VIEWER ----
        if (viewId === 'studentOneDrive') {
            const fileIcons = { document:'📄', presentation:'📊', spreadsheet:'📈', folder:'📁', pdf:'📕', other:'📎' };
            const files = await fetch(`${apiBase}/student/onedrive`).then(r => r.json());
            const list = document.getElementById('od-student-list');
            if (list) {
                list.innerHTML = files.length ? files.map(f => `
                    <a href="${f.file_url}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:14px;padding:12px;border:1px solid #dde;border-radius:10px;text-decoration:none;color:inherit;transition:background 0.2s;" onmouseover="this.style.background='#f0f7ff'" onmouseout="this.style.background='transparent'">
                        <span style="font-size:2rem;">${fileIcons[f.file_type] || '📎'}</span>
                        <span><b>${f.file_title}</b><br><span style="font-size:0.78rem;color:#1565c0;">Click to open in OneDrive ↗</span></span>
                    </a>`).join('') : '<p style="color:#aaa;">No files shared by your teacher yet.</p>';
            }
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
