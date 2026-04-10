const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'school.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error opening database " + err.message);
    } else {
        console.log("Connected to the SQLite database.");
        
        // Ensure tables exist
        db.serialize(() => {
            // Users table
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                password TEXT,
                email TEXT,
                role TEXT,
                class_name TEXT,
                parent_id INTEGER,
                status TEXT DEFAULT 'Active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) console.error(err);
                
                db.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
                    if (!row) {
                        const hash = bcrypt.hashSync('admin123', 10);
                        db.run("INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)", ['admin', hash, 'admin@school.local', 'admin']);
                    }
                });
                db.get("SELECT * FROM users WHERE username = 'principal01'", (err, row) => {
                    if (!row) {
                        const hash = bcrypt.hashSync('pass123', 10);
                        db.run("INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)", ['principal01', hash, 'principal@school.local', 'principal']);
                    }
                });
                db.get("SELECT * FROM users WHERE username = 'teacher01'", (err, row) => {
                    if (!row) {
                        const hash = bcrypt.hashSync('pass123', 10);
                        db.run("INSERT INTO users (username, password, email, role, class_name) VALUES (?, ?, ?, ?, ?)", ['teacher01', hash, 'teacher@school.local', 'teacher', 'Class 10-A']);
                    }
                });
                db.get("SELECT * FROM users WHERE username = 'parent01'", (err, row) => {
                    if (!row) {
                        const hash = bcrypt.hashSync('pass123', 10);
                        db.run("INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)", ['parent01', hash, 'parent@school.local', 'parent']);
                    }
                });
                db.get("SELECT * FROM users WHERE username = 'student01'", (err, row) => {
                    if (!row) {
                        const hash = bcrypt.hashSync('pass123', 10);
                        db.run("INSERT INTO users (username, password, email, role, class_name) VALUES (?, ?, ?, ?, ?)", ['student01', hash, 'student@school.local', 'student', 'Class 10-A']);
                    }
                });
            });

            // OTP Auth table
            db.run(`CREATE TABLE IF NOT EXISTS otp_auth (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                otp_code TEXT,
                expires_at DATETIME,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )`);

            // Activity Logs table
            db.run(`CREATE TABLE IF NOT EXISTS activity_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                action TEXT,
                module TEXT,
                details TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )`);
            
            // Attendance table
            db.run(`CREATE TABLE IF NOT EXISTS attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER,
                class_name TEXT,
                date DATE,
                status TEXT,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(student_id) REFERENCES users(id),
                FOREIGN KEY(created_by) REFERENCES users(id)
            )`);

            // Homework table
            db.run(`CREATE TABLE IF NOT EXISTS homework (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                teacher_id INTEGER,
                class_name TEXT,
                title TEXT,
                description TEXT,
                correct_answer TEXT,
                due_date DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(teacher_id) REFERENCES users(id)
            )`);
            
            // Homework Submissions table
            db.run(`CREATE TABLE IF NOT EXISTS homework_submissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                homework_id INTEGER,
                student_id INTEGER,
                selected_answer TEXT,
                marks_obtained INTEGER,
                submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(homework_id) REFERENCES homework(id),
                FOREIGN KEY(student_id) REFERENCES users(id)
            )`);

            // Fees table
            db.run(`CREATE TABLE IF NOT EXISTS fees (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER,
                amount DECIMAL(10,2),
                status TEXT,
                due_date DATE,
                paid_date DATE,
                FOREIGN KEY(student_id) REFERENCES users(id)
            )`);

            // School Configuration table
            db.run(`CREATE TABLE IF NOT EXISTS school_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                name TEXT,
                address TEXT,
                phone TEXT,
                history TEXT,
                achievements TEXT,
                principal_name TEXT,
                logo_url TEXT,
                bg_url TEXT,
                primary_color TEXT,
                secondary_color TEXT
            )`, (err) => {
                if (err) console.error(err);
                
                // Seed default configuration
                db.get("SELECT * FROM school_config WHERE id = 1", (err, row) => {
                    if (!row) {
                        db.run(`INSERT INTO school_config 
                        (id, name, address, phone, history, achievements, principal_name, logo_url, bg_url, primary_color, secondary_color) 
                        VALUES (1, 'Acme Global School', '123 Education Lane, Knowledge City', '+1 800 555 0199', 'Founded in 1999 to nurture young minds.', 'Ranked #1 in District 2025', 'Dr. Eleanor Vance', '/uploads/default-logo.png', '/uploads/default-bg.jpg', '#0f3c5f', '#d1e5f0')`);
                        console.log("Default school config seeded.");
                    }
                });
            });

            // Cross-Class Requests table
            db.run(`CREATE TABLE IF NOT EXISTS cross_class_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                teacher_id INTEGER,
                requested_class TEXT,
                status TEXT DEFAULT 'Pending Principal & Class-In-Charge Approval',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(teacher_id) REFERENCES users(id)
            )`);
            // Relieving Requests table
            db.run(`CREATE TABLE IF NOT EXISTS relieving_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER,
                teacher_id INTEGER,
                draft_text TEXT,
                status TEXT DEFAULT 'Pending Principal Approval',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(student_id) REFERENCES users(id),
                FOREIGN KEY(teacher_id) REFERENCES users(id)
            )`);

            // PTM Bookings table
            db.run(`CREATE TABLE IF NOT EXISTS ptm_bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                parent_id INTEGER,
                teacher_id INTEGER,
                booking_date DATE,
                booking_time TEXT,
                status TEXT DEFAULT 'Scheduled',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(parent_id) REFERENCES users(id),
                FOREIGN KEY(teacher_id) REFERENCES users(id)
            )`);

            // PTM Conversations (Data Silo) table
            db.run(`CREATE TABLE IF NOT EXISTS ptm_conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                booking_id INTEGER,
                sender_id INTEGER,
                message TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(booking_id) REFERENCES ptm_bookings(id),
                FOREIGN KEY(sender_id) REFERENCES users(id)
            )`);

            // Student Notes table
            db.run(`CREATE TABLE IF NOT EXISTS student_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER,
                date DATE,
                note_content TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(student_id) REFERENCES users(id)
            )`);

            // Tutors table
            db.run(`CREATE TABLE IF NOT EXISTS tutors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                subject TEXT,
                budget TEXT,
                lat REAL,
                lng REAL,
                verified BOOLEAN DEFAULT 1
            )`, (err) => {
                if (err) console.error(err);
                
                // Seed some tutors
                db.get("SELECT * FROM tutors", (err, row) => {
                    if (!row) {
                        db.run("INSERT INTO tutors (name, subject, budget, lat, lng, verified) VALUES ('Mr. Smith', 'Mathematics', '$30/hr', 40.7128, -74.0060, 1)");
                        db.run("INSERT INTO tutors (name, subject, budget, lat, lng, verified) VALUES ('Ms. Davis', 'Science', '$25/hr', 40.7138, -74.0050, 1)");
                        db.run("INSERT INTO tutors (name, subject, budget, lat, lng, verified) VALUES ('Dr. Brown', 'History', '$40/hr', 40.7148, -74.0070, 1)");
                    }
                });
            });
        });
    }
});

module.exports = db;

// HACK: Render is stubbornly locked into executing `node database.js`.
// To force the web server to start without touching the Render UI, 
// we intercept the direct execution of this file and boot the server.
if (require.main === module) {
    require('./server.js');
}
