const fs = require('fs');
const https = require('https');
const path = require('path');
const { exec } = require('child_process');

const KVDB_KEY = 'eduportal_180efd9e';
const KVDB_URL = `https://keyvalue.immanuel.co/api/KeyVal`;
// Target the local database that Render falls back to
const LOCAL_DB_PATH = path.join(__dirname, 'school.db');

async function updateLatestDbUrl(url) {
    return new Promise((resolve, reject) => {
        const req = https.request(`${KVDB_URL}/UpdateValue/${KVDB_KEY}/${encodeURIComponent(url)}`, { method: 'POST' }, (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', reject);
        req.end();
    });
}

async function uploadDb() {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(LOCAL_DB_PATH)) return resolve(null);
        
        // Read file and upload using native Node HTTPS
        const fileData = fs.readFileSync(LOCAL_DB_PATH);
        const req = https.request('https://paste.rs/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Length': fileData.length
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', async () => {
                const url = data.trim();
                if (url.startsWith('https://paste.rs')) {
                    await updateLatestDbUrl(url);
                    console.log('[CLOUD-SYNC] Successfully backed up database to', url);
                    resolve(url);
                } else {
                    reject(new Error('Invalid response from paste.rs: ' + url));
                }
            });
        });
        req.on('error', reject);
        req.write(fileData);
        req.end();
    });
}

function startSyncLoop() {
    console.log('[CLOUD-SYNC] Background sync worker started. Backing up every 5 minutes.');
    // Run backup every 5 minutes
    setInterval(() => {
        uploadDb().catch(e => console.error('[CLOUD-SYNC] Scheduled backup failed:', e.message));
    }, 5 * 60 * 1000);
}

module.exports = { startSyncLoop, uploadDb };
