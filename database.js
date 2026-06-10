const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Use the Singapore regional connection pooler which is IPv4-compatible (runs on both Render and Local dev)
const defaultConnectionString = 'postgresql://postgres.utovtmjidolbuwtjtwnq:shiva%408328545777@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres';
const connectionString = process.env.DATABASE_URL || defaultConnectionString;

const pool = new Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

// Helper to translate SQLite queries into PostgreSQL compatible queries
function translateSql(sql) {
    let index = 1;
    // Replace '?' with '$1', '$2', etc.
    let translatedSql = sql.replace(/\?/g, () => `$${index++}`);
    
    // SQLite: datetime('now', '-30 minutes') -> Postgres: CURRENT_TIMESTAMP - INTERVAL '30 minutes'
    translatedSql = translatedSql.replace(/datetime\(\s*'now'\s*,\s*'-30 minutes'\s*\)/gi, "CURRENT_TIMESTAMP - INTERVAL '30 minutes'");
    
    return translatedSql;
}

// Mimic the sqlite3 database instance API
const db = {
    // Run queries (inserts, updates, deletes)
    run(sql, ...args) {
        let params = [];
        let callback = null;
        
        if (args.length === 1 && typeof args[0] === 'function') {
            callback = args[0];
        } else if (args.length === 2) {
            params = args[0];
            callback = args[1];
        } else if (args.length > 2) {
            // In case of multiple parameters spread
            if (typeof args[args.length - 1] === 'function') {
                callback = args[args.length - 1];
                params = args.slice(0, -1);
            } else {
                params = args;
            }
        }

        let translatedSql = translateSql(sql);
        const isInsert = /^\s*insert\s+/i.test(translatedSql);
        
        // Append RETURNING id to INSERT statements to get lastID
        if (isInsert && !/\s+returning\s+/i.test(translatedSql)) {
            translatedSql += ' RETURNING id';
        }

        pool.query(translatedSql, params, (err, res) => {
            if (err) {
                if (callback) callback(err);
                return;
            }
            
            // Emulate sqlite3 callback context (this.lastID and this.changes)
            const context = {
                lastID: undefined,
                changes: res.rowCount
            };
            if (isInsert && res.rows && res.rows.length > 0) {
                context.lastID = res.rows[0].id;
            }
            
            if (callback) {
                callback.call(context, null);
            }
        });
        return this;
    },

    // Get a single row
    get(sql, ...args) {
        let params = [];
        let callback = null;
        
        if (args.length === 1 && typeof args[0] === 'function') {
            callback = args[0];
        } else if (args.length === 2) {
            params = args[0];
            callback = args[1];
        } else if (args.length > 2) {
            if (typeof args[args.length - 1] === 'function') {
                callback = args[args.length - 1];
                params = args.slice(0, -1);
            } else {
                params = args;
            }
        }

        const translatedSql = translateSql(sql);
        pool.query(translatedSql, params, (err, res) => {
            if (err) {
                if (callback) callback(err);
                return;
            }
            const row = res.rows && res.rows.length > 0 ? res.rows[0] : null;
            if (callback) callback(null, row);
        });
        return this;
    },

    // Get all rows
    all(sql, ...args) {
        let params = [];
        let callback = null;
        
        if (args.length === 1 && typeof args[0] === 'function') {
            callback = args[0];
        } else if (args.length === 2) {
            params = args[0];
            callback = args[1];
        } else if (args.length > 2) {
            if (typeof args[args.length - 1] === 'function') {
                callback = args[args.length - 1];
                params = args.slice(0, -1);
            } else {
                params = args;
            }
        }

        const translatedSql = translateSql(sql);
        pool.query(translatedSql, params, (err, res) => {
            if (err) {
                if (callback) callback(err);
                return;
            }
            if (callback) callback(null, res.rows || []);
        });
        return this;
    },

    // No-op for serialize to mimic sqlite3
    serialize(callback) {
        if (callback) callback();
        return this;
    },

    // Close pool
    close(callback) {
        pool.end(callback);
    }
};

// Create tables and seed data sequentially
async function initializeSchema() {
    let client;
    try {
        client = await pool.connect();
        console.log('[SUPABASE] Initializing PostgreSQL schema sequentially...');
        
        // 1. Create tables sequentially in order of dependencies
        await client.query(`CREATE TABLE IF NOT EXISTS schools (
            id SERIAL PRIMARY KEY,
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
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) UNIQUE,
            password TEXT,
            email TEXT,
            phone TEXT,
            role TEXT,
            class_name TEXT,
            parent_id INTEGER,
            school_id INTEGER REFERENCES schools(id),
            qr_token TEXT,
            reports_to INTEGER,
            status TEXT DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS otp_auth (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            otp_code TEXT,
            expires_at TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS activity_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            action TEXT,
            module TEXT,
            details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS attendance (
            id SERIAL PRIMARY KEY,
            student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            class_name TEXT,
            date DATE,
            status TEXT,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            message_sent BOOLEAN DEFAULT FALSE,
            notifications_triggered BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS homework (
            id SERIAL PRIMARY KEY,
            teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            class_name TEXT,
            title TEXT,
            description TEXT,
            correct_answer TEXT,
            due_date TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS homework_submissions (
            id SERIAL PRIMARY KEY,
            homework_id INTEGER REFERENCES homework(id) ON DELETE CASCADE,
            student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            selected_answer TEXT,
            marks_obtained INTEGER,
            submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS fees (
            id SERIAL PRIMARY KEY,
            student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            amount DECIMAL(10,2),
            status TEXT,
            due_date DATE,
            paid_date DATE
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS cross_class_requests (
            id SERIAL PRIMARY KEY,
            teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            requested_class TEXT,
            school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
            status TEXT DEFAULT 'Pending Principal & Class-In-Charge Approval',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS relieving_requests (
            id SERIAL PRIMARY KEY,
            student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            draft_text TEXT,
            status TEXT DEFAULT 'Pending Principal Approval',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS ptm_bookings (
            id SERIAL PRIMARY KEY,
            parent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            booking_date DATE,
            booking_time TEXT,
            status TEXT DEFAULT 'Scheduled',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS ptm_conversations (
            id SERIAL PRIMARY KEY,
            booking_id INTEGER REFERENCES ptm_bookings(id) ON DELETE CASCADE,
            sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS student_notes (
            id SERIAL PRIMARY KEY,
            student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            date DATE,
            note_content TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS chat_messages (
            id SERIAL PRIMARY KEY,
            school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
            sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            message_text TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS tutors (
            id SERIAL PRIMARY KEY,
            name TEXT,
            subject TEXT,
            budget TEXT,
            lat REAL,
            lng REAL,
            verified BOOLEAN DEFAULT TRUE
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS class_youtube_channel (
            id SERIAL PRIMARY KEY,
            teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            class_name TEXT,
            school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
            channel_url TEXT,
            channel_name TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS class_youtube_videos (
            id SERIAL PRIMARY KEY,
            teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            class_name TEXT,
            school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
            video_url TEXT,
            video_title TEXT,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS enrollment_requests (
            id SERIAL PRIMARY KEY,
            school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
            requested_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
            full_name TEXT,
            username TEXT,
            password_plain TEXT,
            role TEXT,
            class_name TEXT,
            email TEXT,
            phone TEXT,
            parent_id INTEGER,
            status TEXT DEFAULT 'Pending',
            reject_reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS class_onedrive_files (
            id SERIAL PRIMARY KEY,
            teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            class_name TEXT,
            school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
            file_url TEXT,
            file_title TEXT,
            file_type TEXT DEFAULT 'document',
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Seed default school with ID = 1 if empty
        const schoolRes = await client.query('SELECT * FROM schools WHERE id = 1');
        if (schoolRes.rows.length === 0) {
            await client.query(`INSERT INTO schools 
            (id, name, address, phone, history, achievements, principal_name, logo_url, bg_url, primary_color, secondary_color) 
            VALUES (1, 'Acme Global School', '123 Education Lane, Knowledge City', '+1 800 555 0199', 'Founded in 1999 to nurture young minds.', 'Ranked #1 in District 2025', 'Dr. Eleanor Vance', '/uploads/default-logo.png', '/uploads/default-bg.jpg', '#0f3c5f', '#d1e5f0')`);
            // Reset serial sequence
            await client.query(`SELECT setval(pg_get_serial_sequence('schools', 'id'), COALESCE(MAX(id), 1)) FROM schools`);
            console.log('[SUPABASE] Default school seeded.');
        }

        // Seed default users if users table is empty
        const usersCount = await client.query('SELECT COUNT(*) FROM users');
        if (parseInt(usersCount.rows[0].count, 10) === 0) {
            const adminHash = bcrypt.hashSync('admin123', 10);
            await client.query("INSERT INTO users (username, password, email, role, school_id) VALUES ($1, $2, $3, $4, $5)", ['admin', adminHash, 'admin@school.local', 'admin', null]);

            const passHash = bcrypt.hashSync('pass123', 10);
            await client.query("INSERT INTO users (username, password, email, role, school_id) VALUES ($1, $2, $3, $4, $5)", ['principal01', passHash, 'principal@school.local', 'principal', 1]);
            await client.query("INSERT INTO users (username, password, email, role, class_name, school_id) VALUES ($1, $2, $3, $4, $5, $6)", ['teacher01', passHash, 'teacher@school.local', 'teacher', 'Class 10-A', 1]);
            await client.query("INSERT INTO users (username, password, email, phone, role, school_id) VALUES ($1, $2, $3, $4, $5, $6)", ['parent01', passHash, 'parent@school.local', '+1234567890', 'parent', 1]);
            await client.query("INSERT INTO users (username, password, email, role, class_name, school_id) VALUES ($1, $2, $3, $4, $5, $6)", ['student01', passHash, 'student@school.local', 'student', 'Class 10-A', 1]);
            console.log('[SUPABASE] Default users seeded.');
        }

        // Seed tutors if empty
        const tutorsCount = await client.query('SELECT COUNT(*) FROM tutors');
        if (parseInt(tutorsCount.rows[0].count, 10) === 0) {
            await client.query("INSERT INTO tutors (name, subject, budget, lat, lng, verified) VALUES ('Mr. Smith', 'Mathematics', '$30/hr', 40.7128, -74.0060, true)");
            await client.query("INSERT INTO tutors (name, subject, budget, lat, lng, verified) VALUES ('Ms. Davis', 'Science', '$25/hr', 40.7138, -74.0050, true)");
            await client.query("INSERT INTO tutors (name, subject, budget, lat, lng, verified) VALUES ('Dr. Brown', 'History', '$40/hr', 40.7148, -74.0070, true)");
            console.log('[SUPABASE] Default tutors seeded.');
        }

        console.log('[SUPABASE] Schema initialized successfully.');
    } catch (err) {
        console.error('[SUPABASE] Error initializing schema:', err.message);
    } finally {
        if (client) client.release();
    }
}

// Run schema initialization on module load
initializeSchema();

module.exports = db;

// Intercept direct execution of this file to boot the server (similar to SQLite behavior)
if (require.main === module) {
    require('./server.js');
}
