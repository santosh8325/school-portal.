const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./school.db');

db.serialize(() => {
    console.log("Renaming school_config to schools...");
    db.run(`CREATE TABLE IF NOT EXISTS schools (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT DEFAULT 'School Name',
        address TEXT,
        phone TEXT,
        history TEXT,
        achievements TEXT,
        principal_name TEXT,
        logo_url TEXT,
        bg_url TEXT,
        primary_color TEXT DEFAULT '#e53935',
        secondary_color TEXT DEFAULT '#ffcdd2'
    )`);

    db.run(`INSERT INTO schools (id, name, address, phone, history, achievements, principal_name, logo_url, bg_url, primary_color, secondary_color)
            SELECT id, name, address, phone, history, achievements, principal_name, logo_url, bg_url, primary_color, secondary_color 
            FROM school_config WHERE id = 1`, (err) => {
        if (err && err.message.includes('no such table')) {
            console.log("Table school_config missing, ignoring select insert");
        }
    });

    console.log("Adding school_id to users...");
    db.run(`ALTER TABLE users ADD COLUMN school_id INTEGER`, (err) => {
        if(err) console.log(err.message);
        
        console.log("Updating existing users to school_id = 1 (except admin)...");
        db.run(`UPDATE users SET school_id = 1 WHERE role != 'admin'`);
        db.run(`UPDATE users SET school_id = NULL WHERE role = 'admin'`);
    });

});

setTimeout(() => {
    db.close();
    console.log("Migration finished.");
}, 2000);
