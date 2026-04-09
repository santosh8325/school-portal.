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
            { id: 'logs', label: 'System Logs', icon: '📋' },
            { id: 'networking', label: 'School Network', icon: '🌍' }
        ],
        teacher: [
            { id: 'classDashboard', label: 'Class Dashboard', icon: '👨‍🏫' },
            { id: 'attendance', label: 'Attendance', icon: '✅' },
            { id: 'homework', label: 'Homework Mgmt', icon: '📚' },
            { id: 'logs', label: 'Activity Logs', icon: '📋' }
        ],
        parent: [
            { id: 'overview', label: 'Child Overview', icon: '👁️' },
            { id: 'fees', label: 'Fee Management', icon: '💰' }
        ],
        student: [
            { id: 'overview', label: 'My Overview', icon: '👁️' },
            { id: 'homeworkView', label: 'My Homework', icon: '📝' },
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
                case 'overview':
                    html = renderOverview();
                    break;
                case 'classDashboard':
                    html = renderClassDashboard();
                    break;
                case 'attendance':
                    html = renderAttendance();
                    break;
                case 'homework':
                    html = renderTeacherHomework();
                    break;
                case 'homeworkView':
                    html = renderStudentHomework();
                    break;
                case 'fees':
                    html = renderFees();
                    break;
                case 'logs':
                    html = renderLogs();
                    break;
                case 'networking':
                    html = renderNetworking();
                    break;
                default:
                    html = `<h2>Under Construction</h2><p>View ${viewId} is not yet implemented.</p>`;
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
                <h2>Class Management: ${currentUser.className || 'Unassigned'}</h2>
                <button class="btn-primary" onclick="alert('Request sent to admin for additional class access.')">Class & Request Access</button>
            </div>
            <div class="cards-grid">
                <div class="card stat-card"><h3>Total Students</h3><h2>32</h2></div>
                <div class="card stat-card"><h3>Today's Attendance</h3><h2>95%</h2></div>
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
            <div class="card">
                <form id="hw-form" class="standard-form">
                    <div class="input-group">
                        <label>Title</label>
                        <input type="text" id="hw-title" required>
                    </div>
                    <div class="input-group">
                        <label>Description</label>
                        <textarea id="hw-desc" rows="3" required></textarea>
                    </div>
                    <div class="input-group">
                        <label>Correct Answer (A, B, or C) - Hidden from student</label>
                        <select id="hw-answer">
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                        </select>
                    </div>
                    <div class="input-group">
                        <label>Due Date</label>
                        <input type="date" id="hw-due" required>
                    </div>
                    <button type="submit" class="btn-primary">Post Homework</button>
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
    
    // Bind Events & Charts
    function bindViewEvents(viewId) {
        if (viewId === 'overview') initOverviewChart();
        if (viewId === 'hwChart') initHWChart();
        if (viewId === 'fees') initFeesChart();
        
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
            document.getElementById('hw-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                await fetch('/api/homework', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        title: document.getElementById('hw-title').value,
                        description: document.getElementById('hw-desc').value,
                        correctAnswer: document.getElementById('hw-answer').value,
                        dueDate: document.getElementById('hw-due').value
                    })
                });
                document.getElementById('hw-msg').textContent = "Homework posted successfully!";
                initHWChart(); // Update chart
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
                        <td>${new Date(l.created_at).toLocaleString()}</td>
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
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                    datasets: [{ label: 'Platform Usage', data: [12, 19, 3, 5, 2], backgroundColor: '#3498db' }]
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
