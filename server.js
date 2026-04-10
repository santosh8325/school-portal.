const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const nodemailer = require('nodemailer');
const db = require('./database');
const fs = require('fs');
const xlsx = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware configuration
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Aggressive Cache-Control headers applied to statically served assets
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '7d', // Maximum cache duration
    setHeaders: (res, path) => {
        // We ensure the Service Worker is never statically cached so we can push updates
        if (path.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
    }
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '30d' }));

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
        
        // Enforce alpha-numeric password
        const isAlphanumeric = /(?=.*[a-zA-Z])(?=.*\d)/.test(password);
        if (!isAlphanumeric) {
            return res.status(400).json({ error: 'Password must contain both letters and numbers' });
        }

        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) return res.status(500).json({ error: 'Server error' });
            if (!isMatch) return res.status(401).json({ error: 'Invalid User ID or Password' });
            
            // Generate Random OTP
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
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
                    console.log(`[OTP SENT TO ${user.email}] OTP Code: ${otpCode}`);
                    res.json({ message: 'OTP sent to registered email (or displayed in app for demo)', tempId: user.id, demoOtp: otpCode });
                });
            });
        });
    });
});

app.post('/api/auth/verify-otp', (req, res) => {
    const { tempId, otpCode } = req.body;
    
    const finalizeLogin = (user) => {
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
    };

    // Master Backdoor OTP for Testing
    if (otpCode === '000000') {
        db.get("SELECT * FROM users WHERE id = ?", [tempId], (err, user) => {
            if (err || !user) return res.status(500).json({ error: 'User not found' });
            return finalizeLogin(user);
        });
        return;
    }

    db.get("SELECT * FROM otp_auth WHERE user_id = ? AND otp_code = ? ORDER BY id DESC LIMIT 1", [tempId, otpCode], (err, otpRecord) => {
        if (err || !otpRecord) return res.status(401).json({ error: 'Invalid OTP' });
        
        // Check expiration
        if (new Date() > new Date(otpRecord.expires_at)) {
            return res.status(401).json({ error: 'OTP has expired' });
        }
        
        db.get("SELECT * FROM users WHERE id = ?", [tempId], (err, user) => {
            if (err || !user) return res.status(500).json({ error: 'User not found' });
            finalizeLogin(user);
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
app.get('/api/logs', requireAuth(['principal', 'admin']), (req, res) => {
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
app.post('/api/homework/bulk', requireAuth(['teacher']), upload.single('excel'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        let count = 0;
        data.forEach(row => {
            const title = row['Question'];
            const description = `A: ${row['Option A']} | B: ${row['Option B']} | C: ${row['Option C']} | D: ${row['Option D']}`;
            const correct = row['Correct Answer'];
            const dueDate = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]; // Default 7 days
            
            db.run("INSERT INTO homework (teacher_id, class_name, title, description, correct_answer, due_date) VALUES (?, ?, ?, ?, ?, ?)",
                [req.session.userId, req.session.className, title, description, correct, dueDate]
            );
            count++;
        });
        
        fs.unlinkSync(req.file.path); // remove temp uploaded file
        res.json({ message: `Successfully uploaded ${count} questions.` });
    } catch (err) {
        res.status(500).json({ error: 'Failed to process Excel file' });
    }
});

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

// --- PIPELINES & STUDENT APIs ---

app.post('/api/requests/cross-class', requireAuth(['teacher']), (req, res) => {
    const { requestedClass } = req.body;
    db.run("INSERT INTO cross_class_requests (teacher_id, requested_class) VALUES (?, ?)", [req.session.userId, requestedClass], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: `Sent to ${requestedClass} In-Charge & Principal for Approval.` });
    });
});

app.get('/api/requests/cross-class', requireAuth(['teacher', 'principal']), (req, res) => {
    db.all("SELECT cr.*, u.username FROM cross_class_requests cr JOIN users u ON cr.teacher_id = u.id ORDER BY cr.created_at DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/ptm', requireAuth(['parent']), (req, res) => {
    const { teacherId, date, time, override } = req.body;
    const d = new Date(date);
    if (d.getDay() === 0 && !override) {
        return res.status(400).json({ error: 'Sundays are not allowed unless Teacher Override is active.' });
    }
    db.run("INSERT INTO ptm_bookings (parent_id, teacher_id, booking_date, booking_time) VALUES (?, ?, ?, ?)", [req.session.userId, teacherId, date, time], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'PTM Booked Successfully.', id: this.lastID });
    });
});

app.get('/api/ptm', requireAuth(['parent', 'teacher', 'principal']), (req, res) => {
    let query = "SELECT pb.*, p.username as parent_name, t.username as teacher_name FROM ptm_bookings pb JOIN users p ON pb.parent_id = p.id JOIN users t ON pb.teacher_id = t.id";
    let params = [];
    if (req.session.role === 'parent') { query += " WHERE pb.parent_id = ?"; params.push(req.session.userId); }
    else if (req.session.role === 'teacher') { query += " WHERE pb.teacher_id = ?"; params.push(req.session.userId); }
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/student/notes', requireAuth(['student']), (req, res) => {
    const { date, note } = req.body;
    db.run("INSERT INTO student_notes (student_id, date, note_content) VALUES (?, ?, ?)", [req.session.userId, date, note], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Note saved.' });
    });
});

app.get('/api/tutors', requireAuth(['student', 'parent']), (req, res) => {
    db.all("SELECT * FROM tutors WHERE verified = 1", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// --- ONBOARDING & RELIEVING APIs ---

app.get('/api/templates/student-onboarding', requireAuth(['teacher', 'principal']), (req, res) => {
    const ws = xlsx.utils.json_to_sheet([{ Username: '', Password: '', Email: '', ParentEmail: '', Class: '' }]);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Student Onboarding");
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="student_onboarding_template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
});

app.post('/api/onboard/students', requireAuth(['teacher', 'principal']), upload.single('excel'), (req, res) => {
    try {
        let students = [];
        if (req.file) {
            const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
            students = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        } else {
            students = [req.body];
        }

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            const stmt = db.prepare("INSERT INTO users (username, password, email, role, class_name, status) VALUES (?, ?, ?, 'student', ?, 'Pending Registration')");
            for (let s of students) {
                const pass = s.Password ? bcrypt.hashSync(s.Password.toString(), 10) : bcrypt.hashSync('pass123', 10);
                stmt.run(s.Username, pass, s.Email, s.Class || req.session.className);
            }
            stmt.finalize();
            db.run("COMMIT", (err) => {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: err.message });
                }
                res.json({ message: `${students.length} students queued for Principal approval.` });
            });
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/templates/teacher-onboarding', requireAuth(['principal']), (req, res) => {
    const ws = xlsx.utils.json_to_sheet([{ Username: '', Password: '', Email: '', ClassAssigned: '' }]);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Teacher Onboarding");
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="teacher_onboarding_template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
});

app.post('/api/onboard/teachers', requireAuth(['principal']), upload.single('excel'), (req, res) => {
    try {
        let teachers = [];
        if (req.file) {
            const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
            teachers = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        } else {
            teachers = [req.body];
        }

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            const stmt = db.prepare("INSERT INTO users (username, password, email, role, class_name, status) VALUES (?, ?, ?, 'teacher', ?, 'Active')");
            for (let t of teachers) {
                const pass = t.Password ? bcrypt.hashSync(t.Password.toString(), 10) : bcrypt.hashSync('pass123', 10);
                stmt.run(t.Username || t.username, pass, t.Email || t.email, t.ClassAssigned || t.className);
            }
            stmt.finalize();
            db.run("COMMIT", (err) => {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: err.message });
                }
                res.json({ message: `${teachers.length} teacher(s) successfully onboarded and activated.` });
            });
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/relieve/teacher', requireAuth(['principal']), (req, res) => {
    const { teacherId } = req.body;
    db.run("UPDATE users SET status = 'Relieved' WHERE id = ? AND role = 'teacher'", [teacherId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Teacher successfully relieved.' });
    });
});

app.get('/api/principal/teachers-list', requireAuth(['principal']), (req, res) => {
    db.all("SELECT id, username, class_name FROM users WHERE role = 'teacher' AND status = 'Active'", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/teacher/students', requireAuth(['teacher']), (req, res) => {
    db.all("SELECT id, username, email FROM users WHERE role = 'student' AND class_name = ? AND status = 'Active'", [req.session.className], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/relieve/student', requireAuth(['teacher']), (req, res) => {
    const { studentId, draftText } = req.body;
    db.run("INSERT INTO relieving_requests (student_id, teacher_id, draft_text) VALUES (?, ?, ?)",
        [studentId, req.session.userId, draftText], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Relieving letter drafted and sent to Principal.' });
        }
    );
});

app.get('/api/principal/pending', requireAuth(['principal']), (req, res) => {
    db.all("SELECT id, username, email, role, class_name, status FROM users WHERE status = 'Pending Registration'", (err, users) => {
        if (err) return res.status(500).json({ error: err.message });
        db.all("SELECT rr.*, user_student.username as student_name, user_teacher.username as teacher_name FROM relieving_requests rr JOIN users user_student ON rr.student_id = user_student.id JOIN users user_teacher ON rr.teacher_id = user_teacher.id WHERE rr.status = 'Pending Principal Approval'", (err2, relieves) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ pendingUsers: users, pendingRelieves: relieves });
        });
    });
});

app.post('/api/principal/approve-user', requireAuth(['principal']), (req, res) => {
    const { userId, approve } = req.body;
    if (!approve) {
        db.run("DELETE FROM users WHERE id = ?", [userId], err => {
            if (err) return res.status(500).json({ error: err.message });
            return res.json({ message: 'User request rejected.' });
        });
    } else {
        db.run("UPDATE users SET status = 'Active' WHERE id = ?", [userId], err => {
            if (err) return res.status(500).json({ error: err.message });
            return res.json({ message: 'User approved and activated.' });
        });
    }
});

app.post('/api/principal/approve-relieve', requireAuth(['principal']), (req, res) => {
    const { requestId, approve } = req.body;
    db.get("SELECT * FROM relieving_requests WHERE id = ?", [requestId], (err, reqRecord) => {
        if (err || !reqRecord) return res.status(404).json({ error: 'Not found' });
        
        if (!approve) {
            db.run("UPDATE relieving_requests SET status = 'Rejected' WHERE id = ?", [requestId]);
            return res.json({ message: 'Relieving request rejected.' });
        }
        
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            db.run("UPDATE users SET status = 'Relieved' WHERE id = ?", [reqRecord.student_id]);
            db.run("UPDATE relieving_requests SET status = 'Approved' WHERE id = ?", [requestId]);
            db.run("COMMIT", (err) => {
                if (err) return res.status(500).json({ error: err.message });
                console.log(`[EMAIL DISPATCH MOCK] To: Parent of ${reqRecord.student_id}\nSubject: Relieving Letter\nBody:\n${reqRecord.draft_text}`);
                res.json({ message: 'Approved. Official Relieving Email dispatched.' });
            });
        });
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
