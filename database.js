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
                parent_id INTEGER
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
