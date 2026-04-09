const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const nodemailer = require('nodemailer');
const db = require('./database');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware configuration
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Strictly serve static files from public
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads folder exists
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
    fs.mkdirSync(path.join(__dirname, 'uploads'));
}

// Session configuration
app.use(session({
    secret: 'super-secure-school-secret-2026', // In production, use a secure env var
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true if using HTTPS
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

// Route Protection Middleware
const requireAuth = (roles) => (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized. Please login.' });
    }
    if (roles && !roles.includes(req.session.role)) {
        return res.status(403).json({ error: 'Forbidden. Insufficient permissions.' });
    }
    next();
};

const activityLogger = (req, res, next) => {
    if (req.session && req.session.userId && req.method !== 'GET') {
        const action = req.method + ' ' + req.path;
        db.run("INSERT INTO activity_logs (user_id, action, module, details) VALUES (?, ?, ?, ?)", [req.session.userId, action, req.path, JSON.stringify(req.body)]);
    }
    next();
};
app.use(activityLogger);

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// API: Setup School Configuration
app.get('/api/config', (req, res) => {
    db.get("SELECT * FROM school_config WHERE id = 1", (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
    });
});

app.post('/api/config', requireAuth(['admin']), (req, res) => {
    const { name, address, phone, history, achievements, principal_name, primary_color, secondary_color } = req.body;
    db.run(
        `UPDATE school_config SET name = ?, address = ?, phone = ?, history = ?, achievements = ?, principal_name = ?, primary_color = ?, secondary_color = ? WHERE id = 1`,
        [name, address, phone, history, achievements, principal_name, primary_color, secondary_color],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Configuration updated successfully' });
        }
    );
});

// Admin Image Uploads
app.post('/api/config/upload', requireAuth(['admin']), upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const imageType = req.body.type; // 'logo' or 'bg'
    const filePath = '/uploads/' + req.file.filename;

    if (imageType === 'logo') {
        db.run(`UPDATE school_config SET logo_url = ? WHERE id = 1`, [filePath], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ url: filePath });
        });
    } else if (imageType === 'bg') {
        db.run(`UPDATE school_config SET bg_url = ? WHERE id = 1`, [filePath], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ url: filePath });
        });
    } else {
        res.status(400).json({ error: 'Invalid image type specified' });
    }
});

// Mock Email Transporter
const transporter = nodemailer.createTransport({
    streamTransport: true,
    newline: 'windows'
});

// API: Authentication
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(401).json({ error: 'Invalid User ID or Password' });
        
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) return res.status(500).json({ error: 'Server error' });
            if (!isMatch) return res.status(401).json({ error: 'Invalid User ID or Password' });
            
            // Password logic matches digits+words enforced on frontend, backend just hashes.
            // Generate OTP
            const otpCode = '123456'; // Static string for demo purposes
            // Expires in 5 minutes
            const expiresAt = new Date(Date.now() + 5 * 60000).toISOString();
            
            db.run("INSERT INTO otp_auth (user_id, otp_code, expires_at) VALUES (?, ?, ?)", [user.id, otpCode, expiresAt], function(err) {
                if (err) return res.status(500).json({ error: 'Failed to generate OTP' });
                
                // Mock sending email
                const mailOptions = {
                    from: '"School System" <noreply@schoolportal.local>',
                    to: user.email || 'test@example.com',
                    subject: 'Your Login OTP',
                    text: `Your OTP for login is ${otpCode}. It expires in 5 minutes.`
                };
                
                transporter.sendMail(mailOptions, (error, info) => {
                    // We will just print the message info to the console since we are mocking email
                    console.log(`[OTP SENT TO ${user.email}] OTP Code: ${otpCode}`);
                    res.json({ message: 'OTP sent to registered email', tempId: user.id });
                });
            });
        });
    });
});

app.post('/api/auth/verify-otp', (req, res) => {
    const { tempId, otpCode } = req.body;
    db.get("SELECT * FROM otp_auth WHERE user_id = ? AND otp_code = ? ORDER BY id DESC LIMIT 1", [tempId, otpCode], (err, otpRecord) => {
        if (err || !otpRecord) return res.status(401).json({ error: 'Invalid OTP' });
        
        // Check expiration
        if (new Date() > new Date(otpRecord.expires_at)) {
            return res.status(401).json({ error: 'OTP has expired' });
        }
        
        db.get("SELECT * FROM users WHERE id = ?", [tempId], (err, user) => {
            if (err || !user) return res.status(500).json({ error: 'User not found' });
            
            // Setup Session
            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.role = user.role;
            req.session.className = user.class_name;
            
            db.run("INSERT INTO activity_logs (user_id, action, module, details) VALUES (?, ?, ?, ?)", [user.id, 'LOGIN', 'auth', 'Successful login with OTP']);
            
            res.json({ 
                message: 'Logged in successfully', 
                role: user.role, 
                username: user.username,
                redirect: '/dashboard.html'
            });
        });
    });
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out successfully' });
});

// API: User Session Data
app.get('/api/auth/me', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json({
        id: req.session.userId,
        username: req.session.username,
        role: req.session.role,
        className: req.session.className
    });
});

app.get('/api/student/dashboard', requireAuth(['student']), (req, res) => {
    // Deliver class-specific data relying strictly on secure session properties, preventing class hopping
    res.json({
        username: req.session.username,
        className: req.session.className,
        // Mocking some class specific schedule data based on session class_name
        schedule: [
            { time: "09:00 AM", subject: "Mathematics" },
            { time: "10:00 AM", subject: "Science" },
            { time: "11:00 AM", subject: "History" }
        ],
        announcements: `Welcome to ${req.session.className} portal. Final exams schedule has been posted.`
    });
});

app.get('/api/admin/system', requireAuth(['admin', 'principal']), (req, res) => {
    res.json({ message: "Admin systems operational" });
});

// --- CORE MODULE APIs ---

// 1. System Logs API
app.get('/api/logs', requireAuth(['principal', 'teacher']), (req, res) => {
    db.all(`SELECT activity_logs.*, users.username, users.role 
            FROM activity_logs 
            JOIN users ON activity_logs.user_id = users.id 
            ORDER BY activity_logs.created_at DESC LIMIT 100`, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 2. Attendance API
app.post('/api/attendance', requireAuth(['teacher']), (req, res) => {
    const { studentId, date, status } = req.body;
    db.run("INSERT INTO attendance (student_id, class_name, date, status, created_by) VALUES (?, ?, ?, ?, ?)",
        [studentId, req.session.className, date, status, req.session.userId],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            // Mock WhatsApp Notification on Absence
            if (status === 'Absent') {
                db.get("SELECT users.username, users.parent_id FROM users WHERE users.id = ?", [studentId], (err, row) => {
                    if (row) {
                        console.log(`[WHATSAPP MOCK] Notification simulated to Parent ID ${row.parent_id}: Your child ${row.username} is marked Absent on ${date}`);
                    }
                });
            }
            res.json({ message: 'Attendance recorded successfully' });
        }
    );
});

// 3. Homework APIs
app.post('/api/homework', requireAuth(['teacher']), (req, res) => {
    const { title, description, correctAnswer, dueDate } = req.body;
    db.run("INSERT INTO homework (teacher_id, class_name, title, description, correct_answer, due_date) VALUES (?, ?, ?, ?, ?, ?)",
        [req.session.userId, req.session.className, title, description, correctAnswer, dueDate],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Homework assigned successfully', id: this.lastID });
        }
    );
});

// Get homeworks
app.get('/api/homework', requireAuth(['teacher', 'student']), (req, res) => {
    if (req.session.role === 'student') {
        const query = `
            SELECT h.*, hs.selected_answer, hs.marks_obtained 
            FROM homework h 
            LEFT JOIN homework_submissions hs ON h.id = hs.homework_id AND hs.student_id = ?
            WHERE h.class_name = ? 
            ORDER BY h.created_at DESC
        `;
        db.all(query, [req.session.userId, req.session.className], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    } else {
        db.all("SELECT * FROM homework WHERE class_name = ? ORDER BY created_at DESC", [req.session.className], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    }
});

// Auto-grading submission
app.post('/api/homework/submit', requireAuth(['student']), (req, res) => {
    const { homeworkId, selectedAnswer } = req.body;
    
    // Check if already submitted
    db.get("SELECT * FROM homework_submissions WHERE homework_id = ? AND student_id = ?", [homeworkId, req.session.userId], (err, existing) => {
        if (err) return res.status(500).json({ error: err.message });
        if (existing) return res.status(403).json({ error: 'You have already submitted this assignment.' });
        
        db.get("SELECT * FROM homework WHERE id = ?", [homeworkId], (err, hw) => {
            if (err || !hw) return res.status(404).json({ error: 'Homework not found' });
            
            // Automation: Auto-evaluate
            const marksObtained = (hw.correct_answer === selectedAnswer) ? 100 : 0;
            
            db.run("INSERT INTO homework_submissions (homework_id, student_id, selected_answer, marks_obtained) VALUES (?, ?, ?, ?)",
                [homeworkId, req.session.userId, selectedAnswer, marksObtained],
                function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: 'Homework submitted automatically', marks: marksObtained, isCorrect: hw.correct_answer === selectedAnswer });
                }
            );
        });
    });
});

// 4. Fee Management API
app.get('/api/fees', requireAuth(['parent', 'student', 'principal']), (req, res) => {
    // If student, filter by their context
    let query = "SELECT fees.*, users.username FROM fees JOIN users ON fees.student_id = users.id";
    let params = [];
    
    if (req.session.role === 'student') {
        query += " WHERE student_id = ?";
        params.push(req.session.userId);
    } 
    
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Let the frontend HTML routing handle pages
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
