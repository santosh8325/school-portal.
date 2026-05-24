const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');
const path = require('path');
const fs = require('fs');

const sqliteDbPath = path.join(__dirname, 'school.db');

if (!fs.existsSync(sqliteDbPath)) {
    console.error(`[MIGRATION ERROR] SQLite database not found at ${sqliteDbPath}`);
    process.exit(1);
}

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:shiva%408328545777@db.utovtmjidolbuwtjtwnq.supabase.co:5432/postgres';

const sqliteDb = new sqlite3.Database(sqliteDbPath);
const pgClient = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

const tables = [
    'schools',
    'users',
    'otp_auth',
    'activity_logs',
    'attendance',
    'homework',
    'homework_submissions',
    'fees',
    'cross_class_requests',
    'relieving_requests',
    'ptm_bookings',
    'ptm_conversations',
    'student_notes',
    'chat_messages',
    'tutors',
    'class_youtube_channel',
    'class_youtube_videos',
    'enrollment_requests',
    'class_onedrive_files'
];

async function initializeSchema(client) {
    console.log('[MIGRATION] Creating tables in PostgreSQL sequentially...');
    
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

    console.log('[MIGRATION] Tables initialized in PostgreSQL.');
}

async function runMigration() {
    console.log('[MIGRATION] Starting SQLite to Supabase PostgreSQL migration...');
    await pgClient.connect();
    console.log('[MIGRATION] Connected to PostgreSQL.');
    
    // Create tables first
    await initializeSchema(pgClient);
    
    // Disable triggers and foreign keys temporarily for replication role
    await pgClient.query("SET session_replication_role = 'replica'");
    console.log('[MIGRATION] Temporarily disabled foreign keys & triggers.');

    try {
        for (const table of tables) {
            console.log(`\n[MIGRATION] Migrating table: ${table}...`);
            
            // Read rows from SQLite
            const rows = await new Promise((resolve, reject) => {
                sqliteDb.all(`SELECT * FROM ${table}`, [], (err, rows) => {
                    if (err) {
                        // If table doesn't exist in SQLite, skip it
                        if (err.message.includes('no such table')) {
                            console.log(`[MIGRATION] Table ${table} does not exist in SQLite, skipping.`);
                            resolve(null);
                        } else {
                            reject(err);
                        }
                    } else {
                        resolve(rows);
                    }
                });
            });

            if (rows === null) continue;
            console.log(`[MIGRATION] Found ${rows.length} rows in SQLite.`);

            // Clear table in PostgreSQL
            await pgClient.query(`TRUNCATE TABLE ${table} CASCADE`);
            console.log(`[MIGRATION] Cleared existing rows in Postgres ${table}.`);

            if (rows.length === 0) continue;

            // Get columns from the first row
            const columns = Object.keys(rows[0]);
            const colList = columns.join(', ');
            
            // Prepare insert statement
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            const insertSql = `INSERT INTO ${table} (${colList}) VALUES (${placeholders})`;

            // Insert rows into PostgreSQL
            for (const row of rows) {
                const values = columns.map(col => {
                    let val = row[col];
                    // Map SQLite booleans or numbers to boolean types in PG if target column is boolean
                    if (table === 'attendance' && (col === 'message_sent' || col === 'notifications_triggered')) {
                        val = val === 1 || val === true || val === '1';
                    }
                    if (table === 'tutors' && col === 'verified') {
                        val = val === 1 || val === true || val === '1';
                    }
                    return val;
                });
                await pgClient.query(insertSql, values);
            }
            console.log(`[MIGRATION] Successfully inserted ${rows.length} rows into Postgres ${table}.`);

            // Reset serial sequence
            try {
                await pgClient.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1)) FROM ${table}`);
                console.log(`[MIGRATION] Reset sequence for ${table}.`);
            } catch (seqErr) {
                // If it doesn't have a sequence, ignore
                console.log(`[MIGRATION] No sequence to reset for ${table} or ignored: ${seqErr.message}`);
            }
        }
        
        console.log('\n[MIGRATION] All tables migrated successfully!');
    } catch (err) {
        console.error('[MIGRATION ERROR] Migration failed:', err.message);
    } finally {
        // Re-enable triggers and foreign keys
        try {
            await pgClient.query("SET session_replication_role = 'origin'");
            console.log('[MIGRATION] Re-enabled foreign keys & triggers.');
        } catch (repErr) {
            console.error('[MIGRATION ERROR] Failed to re-enable triggers:', repErr.message);
        }
        
        await pgClient.end();
        sqliteDb.close();
        console.log('[MIGRATION] Done.');
    }
}

runMigration();
