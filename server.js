const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const nodemailer = require('nodemailer');
const db = require('./database');
const fs = require('fs');
const xlsx = require('xlsx');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/ping', (req, res) => res.send('pong'));

// CSP for industrial stability
app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline'; img-src * data: blob:;");
    next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '7d',
    setHeaders: (res, path) => { if (path.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache'); }
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '30d' }));

if (!fs.existsSync(path.join(__dirname, 'uploads'))) fs.mkdirSync(path.join(__dirname, 'uploads'));

app.use(session({
    secret: 'super-secure-school-secret-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 1000 * 60 * 60 * 24 }
}));

const requireAuth = (roles) => (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    const currentRole = (req.session.role || '').toLowerCase();
    const allowedRoles = roles.map(r => r.toLowerCase());
    if (roles && !allowedRoles.includes(currentRole)) return res.status(403).json({ error: 'Forbidden' });
    next();
};

app.use((req, res, next) => {
    if (req.session && req.session.userId && req.method !== 'GET') {
        const action = req.method + ' ' + req.path;
        db.run("INSERT INTO activity_logs (user_id, action, module, details) VALUES (?, ?, ?, ?)", [req.session.userId, action, req.path, JSON.stringify(req.body)]);
    }
    next();
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

// --- API ENDPOINTS ---

app.get(['/api/config', '/api/school/:schoolId/info'], (req, res) => {
    const schoolId = req.params.schoolId || req.session.schoolId;
    if (schoolId) {
        db.get("SELECT * FROM schools WHERE id = ?", [schoolId], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(row || {});
        });
    } else {
        res.json({ name: "EduPortal", primary_color: "#1a252f", achievements: "Powering Education." });
    }
});

app.post('/api/config', requireAuth(['admin']), (req, res) => {
    const { schoolId, name, address, phone, history, achievements, principal_name, primary_color, secondary_color } = req.body;
    db.run(`UPDATE schools SET name = ?, address = ?, phone = ?, history = ?, achievements = ?, principal_name = ?, primary_color = ?, secondary_color = ? WHERE id = ?`,
        [name, address, phone, history, achievements, principal_name, primary_color, secondary_color, schoolId],
        function(err) { if (err) return res.status(500).json({ error: err.message }); res.json({ message: 'Success' }); }
    );
});

app.get('/api/auth/me', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    res.json({ id: req.session.userId, username: req.session.username, role: req.session.role, className: req.session.className });
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (!user) return res.status(401).json({ error: 'Invalid Credentials' });
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (!isMatch) return res.status(401).json({ error: 'Invalid Credentials' });
            const otpCode = '000000'; // Master OTP for Pro-Demo
            const expiresAt = new Date(Date.now() + 5 * 60000).toISOString();
            db.run("INSERT INTO otp_auth (user_id, otp_code, expires_at) VALUES (?, ?, ?)", [user.id, otpCode, expiresAt], () => {
                res.json({ message: 'OTP sent', tempId: user.id, demoOtp: otpCode });
            });
        });
    });
});

app.post('/api/auth/verify-otp', (req, res) => {
    const { tempId, otpCode } = req.body;
    db.get("SELECT * FROM users WHERE id = ?", [tempId], (err, user) => {
        if (!user) return res.status(404).json({ error: 'User not found' });
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;
        req.session.className = user.class_name;
        req.session.schoolId = user.school_id;
        res.json({ message: 'Success', role: user.role, redirect: user.role === 'admin' ? '/admin.html' : `/school/${user.school_id}/dashboard` });
    });
});

app.post('/api/auth/logout', (req, res) => { req.session.destroy(); res.json({ message: 'Logged out' }); });

app.get('/api/profile', requireAuth(['principal', 'teacher', 'parent', 'student']), (req, res) => {
    db.get("SELECT * FROM users WHERE id = ?", [req.session.userId], (err, row) => res.json(row));
});

app.get('/api/auth/my-qr', requireAuth(['principal', 'teacher', 'parent', 'student']), (req, res) => {
    db.get('SELECT qr_token FROM users WHERE id = ?', [req.session.userId], (err, row) => res.json({ qrToken: row.qr_token }));
});

// --- NEW TEACHER APIs ---

app.get('/api/teacher/students', requireAuth(['teacher']), (req, res) => {
    db.all("SELECT * FROM users WHERE role = 'student' AND class_name = ? AND school_id = ?", [req.session.className, req.session.schoolId], (err, rows) => res.json(rows));
});

app.get('/api/teacher/class-stats', requireAuth(['teacher']), (req, res) => {
    db.get("SELECT COUNT(*) as count FROM users WHERE role = 'student' AND class_name = ? AND school_id = ?", [req.session.className, req.session.schoolId], (err, row) => {
        res.json({ totalStudents: row ? row.count : 0, avgAttendance: 92, pendingHw: 3 });
    });
});

app.get('/api/requests/cross-class', requireAuth(['teacher', 'principal']), (req, res) => {
    db.all("SELECT * FROM cross_class_requests WHERE school_id = ?", [req.session.schoolId], (err, rows) => res.json(rows || []));
});

app.post('/api/requests/cross-class', requireAuth(['teacher']), (req, res) => {
    const { requestedClass } = req.body;
    db.run("INSERT INTO cross_class_requests (teacher_id, requested_class, school_id) VALUES (?, ?, ?)", [req.session.userId, requestedClass, req.session.schoolId], () => res.json({ message: 'Success' }));
});

// --- NEW PRINCIPAL APIs ---

app.get('/api/principal/staff', requireAuth(['principal']), (req, res) => {
    db.all("SELECT id, username, email, role, class_name, status FROM users WHERE role IN ('teacher', 'staff', 'admin_staff') AND school_id = ?", [req.session.schoolId], (err, rows) => res.json(rows || []));
});

app.get('/api/principal/logs', requireAuth(['principal']), (req, res) => {
    db.all(`
        SELECT a.*, u.username 
        FROM activity_logs a 
        JOIN users u ON a.user_id = u.id 
        WHERE u.school_id = ? 
        ORDER BY a.created_at DESC 
        LIMIT 50
    `, [req.session.schoolId], (err, rows) => res.json(rows || []));
});

app.get('/api/teacher/homework', requireAuth(['teacher']), (req, res) => {
    db.all("SELECT * FROM homework WHERE teacher_id = ? ORDER BY created_at DESC", [req.session.userId], (err, rows) => res.json(rows || []));
});

// --- CHARTFY APIs ---

app.get('/api/chartfy/users', requireAuth(['principal', 'teacher', 'parent', 'student']), (req, res) => {
    db.all("SELECT id, username, role FROM users WHERE school_id = ? AND id != ?", [req.session.schoolId, req.session.userId], (err, rows) => {
        res.json(rows || []);
    });
});

app.get('/api/chartfy/messages/:peerId', requireAuth(['principal', 'teacher', 'parent', 'student']), (req, res) => {
    const peerId = req.params.peerId;
    db.all("SELECT * FROM chat_messages WHERE school_id = ? AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)) ORDER BY created_at ASC", 
        [req.session.schoolId, req.session.userId, peerId, peerId, req.session.userId], 
        (err, rows) => res.json(rows || [])
    );
});

app.post('/api/chartfy/messages', requireAuth(['principal', 'teacher', 'parent', 'student']), (req, res) => {
    const { receiverId, message } = req.body;
    db.run("INSERT INTO chat_messages (school_id, sender_id, receiver_id, message_text) VALUES (?, ?, ?, ?)", 
        [req.session.schoolId, req.session.userId, receiverId, message], 
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, messageId: this.lastID });
        }
    );
});

app.get('/api/chartfy/audit', requireAuth(['principal']), (req, res) => {
    db.all(`
        SELECT c.*, s.username as sender_name, r.username as receiver_name 
        FROM chat_messages c
        JOIN users s ON c.sender_id = s.id
        JOIN users r ON c.receiver_id = r.id
        WHERE c.school_id = ?
        ORDER BY c.created_at DESC LIMIT 200
    `, [req.session.schoolId], (err, rows) => res.json(rows || []));
});

// --- HTML ROUTES ---

app.get('/school/:schoolId/dashboard', (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/dashboard', (req, res) => res.redirect('/'));

app.listen(PORT, () => console.log(`[PRO-GRADE] Server running on http://localhost:${PORT}`));
