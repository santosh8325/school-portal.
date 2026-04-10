document.addEventListener('DOMContentLoaded', async () => {
    let currentUser = null;
    
    // Elements
    const navContainer = document.getElementById('dynamic-nav');
    const viewContainer = document.getElementById('view-container');
    const logoutBtn = document.getElementById('logout-btn');
    
    // Fetch user context
    try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
            window.location.href = '/login.html';
            return;
        }
        currentUser = await res.json();
    } catch (e) {
        window.location.href = '/login.html';
        return;
    }
    
    // Update Sidebar Profile
    document.getElementById('user-name').textContent = currentUser.username;
    document.getElementById('user-role').textContent = currentUser.role.toUpperCase();
    document.getElementById('user-initial').textContent = currentUser.username.charAt(0).toUpperCase();
    
    // Define Navigation based on Role
    const roleNavs = {
        principal: [
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'staffManager', label: 'Approvals & Staff', icon: '✅' },
            { id: 'logs', label: 'System Logs', icon: '📋' },
            { id: 'networking', label: 'School Network', icon: '🌍' }
        ],
        teacher: [
            { id: 'classDashboard', label: 'Class Dashboard', icon: '👨‍🏫' },
            { id: 'studentAnalysis', label: 'Student-Wise Analysis', icon: '📈' },
            { id: 'studentManager', label: 'Student Manager (Onboard/Relieve)', icon: '👥' },
            { id: 'attendance', label: 'Attendance', icon: '✅' },
            { id: 'homework', label: 'Homework Mgmt', icon: '📚' },
            { id: 'crossClass', label: 'Cross-Class Requests', icon: '🔄' }
        ],
        parent: [
            { id: 'overview', label: 'Child Analytics', icon: '📈' },
            { id: 'ptmView', label: 'PTM Booking', icon: '📅' },
            { id: 'fees', label: 'Fee Management', icon: '💰' }
        ],
        student: [
            { id: 'overview', label: 'My Overview', icon: '👁️' },
            { id: 'homeworkView', label: 'My Homework', icon: '📝' },
            { id: 'studentNotes', label: 'Daily Notes', icon: '📓' },
            { id: 'tutors', label: 'Guru Finder', icon: '🔍' },
            { id: 'fees', label: 'My Fees', icon: '💰' }
        ]
    };
    
    const allowedNavs = roleNavs[currentUser.role];
    
    // Build Navigation
    allowedNavs.forEach((nav, index) => {
        const btn = document.createElement('button');
        btn.className = 'nav-item ' + (index === 0 ? 'active' : '');
        btn.innerHTML = `${nav.icon} ${nav.label}`;
        btn.dataset.view = nav.id;
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderView(nav.id);
        });
        navContainer.appendChild(btn);
    });
    
    // Logout Logic
    logoutBtn.addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login.html';
    });
    
    // Render initial view
    if (allowedNavs.length > 0) {
        renderView(allowedNavs[0].id);
    }
    
    // --- View Templates & Render Logic ---
    function renderView(viewId) {
        viewContainer.style.opacity = 0;
        
        setTimeout(() => {
            let html = '';
            
            switch(viewId) {
                case 'overview': html = renderOverview(); break;
                case 'classDashboard': html = renderClassDashboard(); break;
                case 'attendance': html = renderAttendance(); break;
                case 'homework': html = renderTeacherHomework(); break;
                case 'homeworkView': html = renderStudentHomework(); break;
                case 'fees': html = renderFees(); break;
                case 'logs': html = renderLogs(); break;
                case 'networking': html = renderNetworking(); break;
                case 'crossClass': html = renderCrossClass(); break;
                case 'ptmView': html = renderPTMView(); break;
                case 'studentNotes': html = renderStudentNotes(); break;
                case 'tutors': html = renderTutors(); break;
                case 'studentAnalysis': html = renderStudentAnalysis(); break;
                case 'studentManager': html = renderStudentManager(); break;
                case 'staffManager': html = renderStaffManager(); break;
                default: html = `<h2>Under Construction</h2><p>View ${viewId} is not yet implemented.</p>`;
            }
            
            viewContainer.innerHTML = html;
            viewContainer.style.opacity = 1;
            
            // Post render bindings
            bindViewEvents(viewId);
            
        }, 300);
    }
    
    // Component Renderers (Simple string interpolation for SPA)
    function renderOverview() {
        return `
            <div class="view-header"><h2>Welcome, ${currentUser.username}</h2></div>
            <div class="cards-grid">
                <div class="card stat-card" onclick="renderView('${currentUser.role === 'principal' ? 'logs' : 'fees'}')">
                    <h3>Quick Access</h3>
                    <p>Click to view detailed data exploration.</p>
                </div>
                <div class="card stat-card">
                    <h3>Recent Announcements</h3>
                    <p>Mid-term exams module begins next week. Please be prepared.</p>
                </div>
            </div>
            <div class="chart-section card mt-20">
                <h3>Analytics Overview</h3>
                <canvas id="overviewChart" height="100"></canvas>
            </div>
        `;
    }
    
    function renderClassDashboard() {
        return `
            <div class="view-header">
                <h2>Class Analysis: ${currentUser.className || 'Unassigned'}</h2>
            </div>
            <div class="cards-grid">
                <div class="card stat-card"><h3 style="color:var(--text-light)">Total Students</h3><h2>32</h2></div>
                <div class="card stat-card"><h3 style="color:var(--text-light)">Average Attendance</h3><h2>95%</h2></div>
                <div class="card stat-card"><h3 style="color:var(--text-light)">Task Submissions</h3><h2>88%</h2></div>
            </div>
            <div class="mt-20 card chart-section">
                <h3 style="color:var(--primary-color)">Class Performance Trend</h3>
                <canvas id="classDashboardChart" height="100"></canvas>
            </div>
        `;
    }

    function renderAttendance() {
        return `
            <div class="view-header"><h2>Mark Attendance</h2></div>
            <div class="card">
                <form id="attendance-form" class="standard-form">
                    <div class="input-group">
                        <label>Student ID (for demo, use 2 for student01)</label>
                        <input type="number" id="att-student-id" required>
                    </div>
                    <div class="input-group">
                        <label>Date</label>
                        <input type="date" id="att-date" required>
                    </div>
                    <div class="input-group">
                        <label>Status</label>
                        <select id="att-status">
                            <option value="Present">Present</option>
                            <option value="Absent">Absent</option>
                        </select>
                    </div>
                    <button type="submit" class="btn-primary">Record Attendance</button>
                    <p id="att-msg" class="mt-10"></p>
                </form>
            </div>
        `;
    }

    function renderTeacherHomework() {
        return `
            <div class="view-header"><h2>Assign Homework</h2></div>
            
            <div class="card mb-20" style="background-color: var(--secondary-color); border: 1px solid var(--primary-color);">
                <h3>Bulk Upload via Excel</h3>
                <form id="bulk-hw-form" class="standard-form mt-10" enctype="multipart/form-data">
                    <div class="input-group">
                        <label>Select Excel Template (.xlsx)</label>
                        <input type="file" id="hw-excel" accept=".xlsx" required>
                    </div>
                    <button type="submit" class="btn-primary mt-10">Upload & Parse</button>
                    <p id="bulk-hw-msg" class="mt-10"></p>
                </form>
            </div>

            <div class="card">
                <h3>Manual Entry (Infinite Scroll)</h3>
                <form id="hw-form" class="standard-form mt-10">
                    <div id="infinite-hw-container">
                        <div class="hw-line-entry flex gap-10 mb-10" style="display:flex; gap:10px; margin-bottom:10px;">
                            <input type="text" class="hw-dyn-title full-width" placeholder="Question Title" required>
                            <input type="text" class="hw-dyn-desc full-width" placeholder="Options (A, B, C, D)" required>
                            <select class="hw-dyn-ans" required>
                                <option value="">Ans</option>
                                <option value="A">A</option>
                                <option value="B">B</option>
                                <option value="C">C</option>
                                <option value="D">D</option>
                            </select>
                        </div>
                    </div>
                    <div class="input-group mt-10">
                        <label>Due Date</label>
                        <input type="date" id="hw-due" required>
                    </div>
                    <button type="submit" class="btn-primary mt-10">Post All</button>
                    <p id="hw-msg" class="mt-10"></p>
                </form>
            </div>
            
            <div class="mt-20 card chart-section">
                <h3>Homework Performance Analytics</h3>
                <canvas id="hwChart" height="100"></canvas>
            </div>
        `;
    }

    function renderStudentHomework() {
        return `
            <div class="view-header"><h2>My Homework</h2></div>
            <div id="student-hw-list" class="cards-grid">
                <div class="loader-container"><div class="spinner"></div></div>
            </div>
        `;
    }

    function renderFees() {
        return `
            <div class="view-header"><h2>Fee Management</h2></div>
            <div class="card chart-section">
                <h3>Fee Collection Trend</h3>
                <canvas id="feesChart" height="100"></canvas>
            </div>
        `;
    }

    function renderLogs() {
        return `
            <div class="view-header"><h2>System Activity Logs</h2></div>
            <div class="card scrollable-table">
                <table class="data-table" id="logs-table">
                    <thead><tr><th>Time</th><th>User</th><th>Role</th><th>Action</th><th>Module</th></tr></thead>
                    <tbody><tr><td colspan="5">Loading logs...</td></tr></tbody>
                </table>
            </div>
        `;
    }
    
    function renderNetworking() {
        return `
            <div class="view-header"><h2>School Networking Portal</h2></div>
            <div class="cards-grid">
                <div class="card text-center"><div class="school-icon">🏫</div><h3>Valley High</h3><button class="btn-secondary mt-10">Collaborate</button></div>
                <div class="card text-center"><div class="school-icon">🏛️</div><h3>City Prep Institute</h3><button class="btn-secondary mt-10">Collaborate</button></div>
            </div>
        `;
    }
    
    function renderCrossClass() {
        return `
            <div class="view-header"><h2>Cross-Class Data Requests</h2></div>
            <div class="card mb-20">
                <form id="cross-class-form" class="standard-form">
                    <div class="input-group">
                        <label>Target Class Name (e.g. Class 10-B)</label>
                        <input type="text" id="cc-class" required>
                    </div>
                    <button type="submit" class="btn-primary">Request Access</button>
                    <p id="cc-msg" class="mt-10"></p>
                </form>
            </div>
            <div class="card scrollable-table">
                <h3>My Requests</h3>
                <table class="data-table" id="cc-table">
                    <thead><tr><th>Requested Class</th><th>Status</th><th>Date</th></tr></thead>
                    <tbody><tr><td colspan="3">Loading...</td></tr></tbody>
                </table>
            </div>
        `;
    }

    function renderPTMView() {
        if(currentUser.role === 'parent') {
            return `
                <div class="view-header"><h2>Parent-Teacher Meeting Booking</h2></div>
                <div class="card mb-20">
                    <form id="ptm-form" class="standard-form">
                        <div class="input-group">
                            <label>Select Teacher ID (e.g. 3 for teacher01)</label>
                            <input type="number" id="ptm-teacher" required>
                        </div>
                        <div class="input-group">
                            <label>Date</label>
                            <input type="date" id="ptm-date" required>
                        </div>
                        <div class="input-group">
                            <label>Time</label>
                            <input type="time" id="ptm-time" required>
                        </div>
                        <div class="input-group mt-10" style="display:flex; align-items:center;">
                            <input type="checkbox" id="ptm-override" style="width:auto; margin-right:5px;">
                            <label style="margin:0;">Teacher Override (Allow Sunday Booking)</label>
                        </div>
                        <button type="submit" class="btn-primary mt-10">Book PTM</button>
                        <p id="ptm-msg" class="mt-10"></p>
                    </form>
                </div>
                <div class="card scrollable-table">
                    <h3>My Bookings & Private Tab</h3>
                    <table class="data-table" id="ptm-table">
                        <thead><tr><th>Teacher</th><th>Date</th><th>Time</th><th>Status</th></tr></thead>
                        <tbody><tr><td colspan="4">Loading...</td></tr></tbody>
                    </table>
                </div>
            `;
        } else {
            return `
                <div class="view-header"><h2>PTM Requests</h2></div>
                <div class="card scrollable-table">
                    <table class="data-table" id="ptm-table">
                        <thead><tr><th>Parent</th><th>Date</th><th>Time</th><th>Status</th></tr></thead>
                        <tbody><tr><td colspan="4">Loading...</td></tr></tbody>
                    </table>
                </div>
            `;
        }
    }

    function renderStudentNotes() {
        return `
            <div class="view-header"><h2>My Daily Notes</h2></div>
            <div class="card">
                <form id="notes-form" class="standard-form">
                    <div class="input-group">
                        <label>Date</label>
                        <input type="date" id="note-date" required>
                    </div>
                    <div class="input-group">
                        <label>Rich Text Notebook</label>
                        <textarea id="note-content" rows="6" placeholder="Document your daily learnings here..." required></textarea>
                    </div>
                    <button type="submit" class="btn-primary mt-10">Save to Notebook</button>
                    <p id="note-msg" class="mt-10"></p>
                </form>
            </div>
        `;
    }

    function renderTutors() {
        return `
            <div class="view-header"><h2>Guru Finder (Verified Tutors)</h2></div>
            <div class="card mb-20" style="background:var(--secondary-color); padding:1rem; text-align:center;">
                <p>📍 Location Services mocked for near you.</p>
            </div>
            <div id="tutors-list" class="cards-grid">
                <div class="loader-container"><div class="spinner"></div></div>
            </div>
        `;
    }
    
    function renderStudentAnalysis() {
        return `
            <div class="view-header"><h2>Student-Wise Analysis</h2></div>
            <div class="card mb-20 chart-section">
                <canvas id="studentAnalysisChart" height="80"></canvas>
            </div>
            <div class="card scrollable-table">
                <table class="data-table" id="student-analysis-table">
                    <thead><tr><th>Student</th><th>Performance Trend</th><th>Status</th></tr></thead>
                    <tbody><tr><td colspan="3">Loading...</td></tr></tbody>
                </table>
            </div>
        `;
    }

    function renderStudentManager() {
        return `
            <div class="view-header"><h2>Student Manager</h2></div>
            
            <div class="cards-grid">
                <div class="card">
                    <h3 style="color:var(--primary-color)">Onboard via Excel</h3>
                    <p class="mt-10" style="font-size:0.85rem">Download the template, fill it out, and upload multiple students simultaneously.</p>
                    <a href="/api/templates/student-onboarding" class="btn-secondary mt-10" style="display:inline-block; text-decoration:none;">Download Template</a>
                    <form id="bulk-onboard-form" class="mt-20">
                        <input type="file" id="onboard-excel" accept=".xlsx" required>
                        <button type="submit" class="btn-primary mt-10 full-width">Upload & Onboard</button>
                    </form>
                    <p id="bulk-onboard-msg" class="mt-10 font-bold"></p>
                </div>
                <div class="card">
                    <h3 style="color:var(--primary-color)">Manual Onboarding</h3>
                    <form id="manual-onboard-form" class="standard-form mt-10">
                        <input type="text" id="mo-user" placeholder="Username" required class="mb-10" style="width:100%; padding:8px;">
                        <input type="email" id="mo-email" placeholder="Email" required class="mb-10" style="width:100%; padding:8px;">
                        <input type="text" id="mo-class" placeholder="Class Name (e.g. Class 10-B)" required class="mb-10" style="width:100%; padding:8px;">
                        <button type="submit" class="btn-primary full-width">Add Student</button>
                        <p id="mo-msg" class="mt-10 font-bold"></p>
                    </form>
                </div>
            </div>

            <div class="card mt-20">
                <h3 style="color:var(--error)">Relieve Student</h3>
                <p class="mt-10" style="font-size:0.85rem">Generate an official relieving letter for a graduating or transferring student.</p>
                <form id="relieve-form" class="standard-form mt-10">
                    <select id="relieve-student" required class="mb-10" style="width:100%; padding:8px;">
                        <option value="">Loading Students...</option>
                    </select>
                    <textarea id="relieve-draft" rows="6" required style="width:100%; padding:8px; margin-bottom: 10px;">Dear Parent,
We formally confirm that your child has successfully completed their obligations at Acme Global School. They demonstrated remarkable growth and dedication.
We wish them the best in their future endeavors.
Warm regards,
[Teacher Name]</textarea>
                    <button type="submit" class="btn-danger full-width mt-10">Submit Relieving Request</button>
                    <p id="relieve-msg" class="mt-10 font-bold"></p>
                </form>
            </div>
        `;
    }

    function renderStaffManager() {
        return `
            <div class="view-header"><h2>Staff & Approvals Management (Principal)</h2></div>
            
            <div class="cards-grid mb-20">
                <div class="card">
                    <h3 style="color:var(--primary-color)">Onboard Teacher</h3>
                    <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #eee;">
                        <span style="font-size:0.85rem">Bulk Add via Excel (<a href="/api/templates/teacher-onboarding" style="text-decoration:none;">Download Template</a>)</span>
                        <form id="bulk-teacher-form" class="mt-10" style="display:flex; gap:10px; flex-wrap:wrap;">
                            <input type="file" id="teacher-excel" accept=".xlsx" required style="flex:1; min-width: 150px;">
                            <button type="submit" class="btn-primary">Upload</button>
                        </form>
                        <p id="bulk-teacher-msg" class="font-bold mt-10"></p>
                    </div>
                    <form id="onboard-teacher-form" class="standard-form">
                        <span style="font-size:0.85rem; display:block; margin-bottom:5px;">Manual Add:</span>
                        <input type="text" id="ot-user" placeholder="Teacher Username" required class="mb-10 w-100" style="width:100%; padding:8px;">
                        <input type="text" id="ot-pass" placeholder="Password" required class="mb-10 w-100" style="width:100%; padding:8px;">
                        <input type="email" id="ot-email" placeholder="Email" required class="mb-10 w-100" style="width:100%; padding:8px;">
                        <input type="text" id="ot-class" placeholder="Assigned Class (e.g. Class 10-A)" class="mb-10 w-100" style="width:100%; padding:8px;">
                        <button type="submit" class="btn-primary full-width">Add Active Teacher</button>
                        <p id="ot-msg" class="mt-10 font-bold"></p>
                    </form>
                </div>
                <div class="card">
                    <h3 style="color:var(--error)">Relieve Teacher</h3>
                    <form id="relieve-teacher-form" class="standard-form mt-10">
                        <select id="rt-select" required class="mb-10" style="width:100%; padding:8px;">
                            <option value="">Loading Teachers...</option>
                        </select>
                        <button type="submit" class="btn-danger full-width mt-10">Relieve Teacher</button>
                        <p id="rt-msg" class="mt-10 font-bold"></p>
                    </form>
                </div>
            </div>

            <div class="cards-grid" style="grid-template-columns: 1fr;">
                <div class="card scrollable-table">
                    <h3 style="color:var(--primary-color)">Pending Users (Students Onboarding)</h3>
                    <table class="data-table mt-10" id="pending-users-table">
                        <thead><tr><th>User</th><th>Role</th><th>Class</th><th>Action</th></tr></thead>
                        <tbody><tr><td colspan="4">Loading...</td></tr></tbody>
                    </table>
                </div>
                <div class="card scrollable-table mt-20">
                    <h3 style="color:var(--error)">Pending Relieving Requests (Students)</h3>
                    <table class="data-table mt-10" id="pending-relieves-table">
                        <thead><tr><th>Student</th><th>Requested By</th><th>Action</th></tr></thead>
                        <tbody><tr><td colspan="3">Loading...</td></tr></tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // Bind Events & Charts
    function bindViewEvents(viewId) {
        if (viewId === 'overview') initOverviewChart();
        if (viewId === 'hwChart') initHWChart();
        if (viewId === 'fees') initFeesChart();

        if (viewId === 'studentAnalysis') {
            const ctx = document.getElementById('studentAnalysisChart');
            if(ctx) {
                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ['Alice', 'Bob', 'Charlie', 'David'],
                        datasets: [{ label: 'Average Marks', data: [85, 92, 78, 60], backgroundColor: ['#2ecc71', '#2ecc71', '#f1c40f', '#e74c3c'] }]
                    }
                });
            }
            const tbody = document.querySelector('#student-analysis-table tbody');
            if(tbody) tbody.innerHTML = `
                <tr><td>Alice</td><td><span style="color:green">↑ +5%</span></td><td>Excellent</td></tr>
                <tr><td>Bob</td><td><span style="color:green">↑ +2%</span></td><td>Excellent</td></tr>
                <tr><td>Charlie</td><td><span style="color:orange">↓ -4%</span></td><td>Needs Focus</td></tr>
                <tr><td>David</td><td><span style="color:red">↓ -10%</span></td><td>At Risk</td></tr>
            `;
        }
        
        if (viewId === 'studentManager') {
            const bulkForm = document.getElementById('bulk-onboard-form');
            if (bulkForm) bulkForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData();
                formData.append('excel', document.getElementById('onboard-excel').files[0]);
                const res = await fetch('/api/onboard/students', { method: 'POST', body: formData });
                const data = await res.json();
                document.getElementById('bulk-onboard-msg').textContent = data.message || data.error;
            });

            const manualForm = document.getElementById('manual-onboard-form');
            if (manualForm) manualForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const payload = { Username: document.getElementById('mo-user').value, Email: document.getElementById('mo-email').value, Class: document.getElementById('mo-class').value };
                const res = await fetch('/api/onboard/students', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
                const data = await res.json();
                document.getElementById('mo-msg').textContent = data.message || data.error;
            });

            const relieveForm = document.getElementById('relieve-form');
            const studentSelect = document.getElementById('relieve-student');
            if(studentSelect) {
                fetch('/api/teacher/students').then(r=>r.json()).then(students => {
                    studentSelect.innerHTML = '<option value="">Select Student...</option>' + students.map(s => `<option value="${s.id}">${s.username} (${s.email})</option>`).join('');
                });
                relieveForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const payload = { studentId: studentSelect.value, draftText: document.getElementById('relieve-draft').value };
                    const res = await fetch('/api/relieve/student', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
                    const data = await res.json();
                    document.getElementById('relieve-msg').textContent = data.message || data.error;
                    studentSelect.value = '';
                });
            }
        }

        if (viewId === 'staffManager') {
            window.refreshStaffTables = () => {
                fetch('/api/principal/pending').then(r=>r.json()).then(data => {
                    const pendingStudents = data.pendingUsers.filter(u => u.role === 'student');
                    const uBody = document.querySelector('#pending-users-table tbody');
                    if(!pendingStudents || !pendingStudents.length) uBody.innerHTML = '<tr><td colspan="4">No pending students.</td></tr>';
                    else uBody.innerHTML = pendingStudents.map(u => `<tr><td>${u.username} (${u.email})</td><td>${u.role}</td><td>${u.class_name || 'N/A'}</td><td><button class="btn-primary btn-sm" onclick="approveUser(${u.id}, true)">Approve</button> <button class="btn-danger btn-sm" onclick="approveUser(${u.id}, false)">Reject</button></td></tr>`).join('');

                    const rBody = document.querySelector('#pending-relieves-table tbody');
                    if(!data.pendingRelieves || !data.pendingRelieves.length) rBody.innerHTML = '<tr><td colspan="3">No pending relieving requests.</td></tr>';
                    else rBody.innerHTML = data.pendingRelieves.map(r => `<tr><td>${r.student_name}</td><td>${r.teacher_name}</td><td><button class="btn-primary btn-sm" onclick="approveRelieve(${r.id}, true)">Send Letter</button> <button class="btn-danger btn-sm" onclick="approveRelieve(${r.id}, false)">Reject</button></td></tr>`).join('');
                });
            };

            window.approveUser = async (id, approve) => {
                await fetch('/api/principal/approve-user', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: id, approve }) });
                window.refreshStaffTables();
            };
            window.approveRelieve = async (id, approve) => {
                await fetch('/api/principal/approve-relieve', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ requestId: id, approve }) });
                window.refreshStaffTables();
            };

            const otForm = document.getElementById('onboard-teacher-form');
            if (otForm && !otForm.dataset.bound) {
                otForm.dataset.bound = 'true';
                otForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const payload = {
                        username: document.getElementById('ot-user').value,
                        password: document.getElementById('ot-pass').value,
                        email: document.getElementById('ot-email').value,
                        className: document.getElementById('ot-class').value || null
                    };
                    const res = await fetch('/api/onboard/teachers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                    const data = await res.json();
                    document.getElementById('ot-msg').textContent = data.message || data.error;
                    if(res.ok) { document.getElementById('onboard-teacher-form').reset(); window.refreshStaffTables(); }
                });
            }

            const bulkTForm = document.getElementById('bulk-teacher-form');
            if (bulkTForm && !bulkTForm.dataset.bound) {
                bulkTForm.dataset.bound = 'true';
                bulkTForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const formData = new FormData();
                    formData.append('excel', document.getElementById('teacher-excel').files[0]);
                    const res = await fetch('/api/onboard/teachers', { method: 'POST', body: formData });
                    const data = await res.json();
                    document.getElementById('bulk-teacher-msg').textContent = data.message || data.error;
                    if(res.ok) { document.getElementById('bulk-teacher-form').reset(); window.refreshStaffTables(); }
                });
            }

            const rtSelect = document.getElementById('rt-select');
            const rtForm = document.getElementById('relieve-teacher-form');
            window.refreshTeachersDropdown = () => {
                if (rtSelect) {
                    fetch('/api/principal/teachers-list').then(r=>r.json()).then(teachers => {
                        rtSelect.innerHTML = '<option value="">Select Teacher...</option>' + teachers.map(t => `<option value="${t.id}">${t.username} (${t.class_name || 'Unassigned'})</option>`).join('');
                    });
                }
            };
            if (rtForm && !rtForm.dataset.bound) {
                rtForm.dataset.bound = 'true';
                rtForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    if (!rtSelect.value) return;
                    const res = await fetch('/api/relieve/teacher', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacherId: rtSelect.value }) });
                    const data = await res.json();
                    document.getElementById('rt-msg').textContent = data.message || data.error;
                    if(res.ok) { window.refreshStaffTables(); window.refreshTeachersDropdown(); }
                });
            }
            window.refreshTeachersDropdown();
            window.refreshStaffTables();
        }

        if (viewId === 'classDashboard') {
            const ctx = document.getElementById('classDashboardChart');
            if(ctx) {
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                        datasets: [{ label: 'Average Score', data: [75, 82, 85, 88], borderColor: '#e53935', tension: 0.1 }]
                    }
                });
            }
        }

        if (viewId === 'crossClass') {
            const form = document.getElementById('cross-class-form');
            if(form) {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const res = await fetch('/api/requests/cross-class', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ requestedClass: document.getElementById('cc-class').value })
                    });
                    const data = await res.json();
                    document.getElementById('cc-msg').textContent = data.message || data.error;
                    bindViewEvents('crossClass');
                });
            }
            fetch('/api/requests/cross-class').then(r=>r.json()).then(reqs => {
                const tbody = document.querySelector('#cc-table tbody');
                if(!reqs || !reqs.length) { tbody.innerHTML = '<tr><td colspan="3">No requests found.</td></tr>'; return; }
                tbody.innerHTML = reqs.map(r => `<tr><td>${r.requested_class}</td><td><span class="badge ${r.status.includes('Pending')?'yellow':'green'}">${r.status}</span></td><td>${new Date(r.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td></tr>`).join('');
            });
        }

        if (viewId === 'ptmView') {
            const form = document.getElementById('ptm-form');
            if(form) {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const res = await fetch('/api/ptm', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            teacherId: document.getElementById('ptm-teacher').value,
                            date: document.getElementById('ptm-date').value,
                            time: document.getElementById('ptm-time').value,
                            override: document.getElementById('ptm-override').checked
                        })
                    });
                    const data = await res.json();
                    document.getElementById('ptm-msg').textContent = data.message || data.error;
                    bindViewEvents('ptmView');
                });
            }
            fetch('/api/ptm').then(r=>r.json()).then(ptms => {
                const tbody = document.querySelector('#ptm-table tbody');
                if(ptms.error || !ptms.length) { tbody.innerHTML = '<tr><td colspan="4">No bookings found.</td></tr>'; return; }
                tbody.innerHTML = ptms.map(p => `<tr><td>${currentUser.role==='parent'?p.teacher_name:p.parent_name}</td><td>${p.booking_date}</td><td>${p.booking_time}</td><td>${p.status}</td></tr>`).join('');
            });
        }

        if (viewId === 'studentNotes') {
            document.getElementById('notes-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const res = await fetch('/api/student/notes', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ date: document.getElementById('note-date').value, note: document.getElementById('note-content').value })
                });
                const data = await res.json();
                document.getElementById('note-msg').textContent = data.message || "Saved.";
                document.getElementById('note-content').value = "";
            });
        }

        if (viewId === 'tutors') {
            fetch('/api/tutors').then(r=>r.json()).then(tutors => {
                const list = document.getElementById('tutors-list');
                if(tutors.error || !tutors.length) { list.innerHTML = '<p>No tutors found nearby.</p>'; return; }
                list.innerHTML = tutors.map(t => `
                    <div class="card text-center" style="border:1px solid gold;">
                        <div class="school-icon">🎓</div>
                        <h3>${t.name} <span style="color:var(--success)">✓</span></h3>
                        <p><strong>Subject:</strong> ${t.subject}</p>
                        <p><strong>Budget:</strong> ${t.budget}</p>
                        <button class="btn-primary mt-10" onclick="alert('Contacted ${t.name}')">Message Guru</button>
                    </div>
                `).join('');
            });
        }
        
        if (viewId === 'attendance') {
            document.getElementById('attendance-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const res = await fetch('/api/attendance', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        studentId: document.getElementById('att-student-id').value,
                        date: document.getElementById('att-date').value,
                        status: document.getElementById('att-status').value
                    })
                });
                const msg = document.getElementById('att-msg');
                msg.textContent = (res.ok) ? "Attendance logged successfully!" : "Error logging attendance.";
            });
        }
        
        if (viewId === 'homework') {
            const container = document.getElementById('infinite-hw-container');
            const attachInfiniteScroll = (row) => {
                const inputs = row.querySelectorAll('input, select');
                inputs.forEach(input => {
                    input.addEventListener('input', () => {
                        if(row === container.lastElementChild) {
                            const hasValue = Array.from(inputs).some(i => i.value !== '');
                            if (hasValue) {
                                const newRow = row.cloneNode(true);
                                newRow.querySelectorAll('input').forEach(i => { i.value = ''; i.removeAttribute('required'); });
                                newRow.querySelectorAll('select').forEach(i => { i.value = ''; i.removeAttribute('required'); });
                                attachInfiniteScroll(newRow);
                                container.appendChild(newRow);
                            }
                        }
                    });
                });
            };
            attachInfiniteScroll(container.firstElementChild);

            document.getElementById('hw-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const rows = container.querySelectorAll('.hw-line-entry');
                const dueDate = document.getElementById('hw-due').value;
                for (let row of rows) {
                    const title = row.querySelector('.hw-dyn-title').value;
                    const desc = row.querySelector('.hw-dyn-desc').value;
                    const ans = row.querySelector('.hw-dyn-ans').value;
                    if(title && desc && ans) {
                        await fetch('/api/homework', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ title, description: desc, correctAnswer: ans, dueDate })
                        });
                    }
                }
                document.getElementById('hw-msg').textContent = "Homework posted successfully!";
                initHWChart();
            });

            document.getElementById('bulk-hw-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const file = document.getElementById('hw-excel').files[0];
                if (!file) return;
                const formData = new FormData();
                formData.append('excel', file);
                
                const btn = document.querySelector('#bulk-hw-form button');
                btn.textContent = "Uploading...";
                
                const res = await fetch('/api/homework/bulk', { method: 'POST', body: formData });
                const data = await res.json();
                
                btn.textContent = "Upload & Parse";
                document.getElementById('bulk-hw-msg').textContent = data.message || data.error;
                initHWChart();
            });

            initHWChart();
        }
        
        if (viewId === 'homeworkView') {
            fetch('/api/homework').then(res => res.json()).then(hws => {
                const list = document.getElementById('student-hw-list');
                if (hws.length === 0) { list.innerHTML = '<p>No homework assigned.</p>'; return; }
                
                list.innerHTML = hws.map(hw => {
                    if (hw.selected_answer) {
                        const color = (hw.marks_obtained === 100) ? 'var(--success)' : 'var(--error)';
                        return `
                        <div class="card hw-card" style="border-left: 4px solid ${color}">
                            <h3>${hw.title}</h3>
                            <p>${hw.description}</p>
                            <p class="mt-10 font-bold" style="color: ${color}">Already Submitted. Marks: ${hw.marks_obtained}/100</p>
                        </div>
                        `;
                    } else {
                        return `
                        <div class="card hw-card">
                            <h3>${hw.title}</h3>
                            <p>${hw.description}</p>
                            <div class="hw-options mt-10">
                                <button class="btn-bubbling" onclick="submitHw(${hw.id}, 'A')">A</button>
                                <button class="btn-bubbling" onclick="submitHw(${hw.id}, 'B')">B</button>
                                <button class="btn-bubbling" onclick="submitHw(${hw.id}, 'C')">C</button>
                            </div>
                            <p id="hw-res-${hw.id}" class="mt-10 font-bold"></p>
                        </div>
                        `;
                    }
                }).join('');
            });
        }
        
        if (viewId === 'logs') {
            fetch('/api/logs').then(res => res.json()).then(logs => {
                const tbody = document.querySelector('#logs-table tbody');
                tbody.innerHTML = logs.map(l => `
                    <tr>
                        <td>${new Date(l.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                        <td>${l.username}</td>
                        <td><span class="badge ${l.role}">${l.role}</span></td>
                        <td>${l.action}</td>
                        <td>${l.module}</td>
                    </tr>
                `).join('');
            });
        }
    }
    
    // Global function for homework submission
    window.submitHw = async (id, answer) => {
        const res = await fetch('/api/homework/submit', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ homeworkId: id, selectedAnswer: answer })
        });
        const data = await res.json();
        const msgEl = document.getElementById(`hw-res-${id}`);
        if(res.ok) {
            msgEl.textContent = `Submitted! Marks: ${data.marks}/100`;
            msgEl.style.color = data.isCorrect ? 'var(--success)' : 'var(--error)';
            msgEl.previousElementSibling.style.display = 'none'; // hide options
        } else {
            msgEl.textContent = data.error;
        }
    };
    
    // Charts logic
    function initOverviewChart() {
        const ctx = document.getElementById('overviewChart');
        if(ctx) {
            const chartData = [85, 60, 45, 90, 75]; // Mocked Analytics
            const standardColors = chartData.map(val => val >= 80 ? '#2ecc71' : val >= 50 ? '#f1c40f' : '#e74c3c');
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                    datasets: [{ label: 'Standardized Analytics (%)', data: chartData, backgroundColor: standardColors }]
                }
            });
        }
    }
    
    function initHWChart() {
        const ctx = document.getElementById('hwChart');
        if(ctx) {
            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Option A (Correct)', 'Option B', 'Option C'],
                    datasets: [{ data: [70, 20, 10], backgroundColor: ['#2ecc71', '#e74c3c', '#f1c40f'] }]
                }
            });
        }
    }
    
    function initFeesChart() {
        const ctx = document.getElementById('feesChart');
        if(ctx) {
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
                    datasets: [{ label: 'Fees Collected ($)', data: [5000, 6000, 4500, 8000, 9000], borderColor: '#0f3c5f', tension: 0.1 }]
                }
            });
        }
    }
});
