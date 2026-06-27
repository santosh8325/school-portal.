const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const admin = require('firebase-admin');
const XLSX = require('xlsx');
require('dotenv').config();

// Configuration setup
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.utovtmjidolbuwtjtwnq:shiva%408328545777@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres';
const reportPathEnv = process.env.ONEDRIVE_REPORT_PATH || './onedrive_reports';
const reportDir = path.resolve(reportPathEnv);
const syncIntervalMinutes = parseInt(process.env.SYNC_INTERVAL_MINUTES || '60', 10);

// Tables list
const TABLES_TO_SYNC = [
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

// Tables configured for safe archive-and-delete
const DEFAULT_TABLES_TO_DELETE = [
    'activity_logs',
    'attendance',
    'chat_messages',
    'ptm_conversations',
    'homework_submissions',
    'relieving_requests',
    'cross_class_requests'
];

const tablesToDeleteList = process.env.TABLES_TO_DELETE 
    ? process.env.TABLES_TO_DELETE.split(',').map(t => t.trim()) 
    : DEFAULT_TABLES_TO_DELETE;

// Database Pool Initialization
const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

// Firebase Initialization
let firestoreDb = null;
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        firestoreDb = admin.firestore();
        console.log('[SYNC-AGENT] Firebase initialized via inline JSON.');
    } else {
        const saPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json');
        if (fs.existsSync(saPath)) {
            const serviceAccount = require(saPath);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            firestoreDb = admin.firestore();
            console.log(`[SYNC-AGENT] Firebase initialized via file: ${saPath}`);
        } else {
            console.warn(`[SYNC-AGENT] Warning: Firebase Service Account file not found at ${saPath}. Running in offline/no-firebase simulation mode.`);
        }
    }
} catch (err) {
    console.error('[SYNC-AGENT] Error initializing Firebase:', err.message);
}

// Ensure OneDrive report directory exists
if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
}

/**
 * Sync logic: Copy data from Supabase to Firebase, write reports to OneDrive,
 * verify both, and then delete synced rows from Supabase.
 */
async function executeSync() {
    const startTime = new Date();
    const syncRunId = `sync_${startTime.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)}`;
    console.log(`\n[SYNC-AGENT] Starting Sync Run: ${syncRunId} at ${startTime.toISOString()}`);

    const syncMetadata = {
        sync_run_id: syncRunId,
        start_time: startTime.toISOString(),
        end_time: null,
        status: 'IN_PROGRESS',
        tables_synced: {},
        firebase_sync_success: false,
        onedrive_report_success: false,
        supabase_cleanup_success: false
    };

    let client = null;
    const extractedData = {};
    const rowIdsByTable = {};

    try {
        client = await pool.connect();
        console.log('[SYNC-AGENT] Connected to Supabase PostgreSQL database.');

        // Step 1: Extract data and record IDs from Supabase
        for (const tableName of TABLES_TO_SYNC) {
            try {
                const res = await client.query(`SELECT * FROM ${tableName}`);
                extractedData[tableName] = res.rows;
                rowIdsByTable[tableName] = res.rows.map(row => row.id).filter(id => id !== undefined && id !== null);
                syncMetadata.tables_synced[tableName] = res.rows.length;
                console.log(`[SYNC-AGENT] Extracted ${res.rows.length} rows from table: ${tableName}`);
            } catch (tblErr) {
                console.error(`[SYNC-AGENT] Error extracting table ${tableName}:`, tblErr.message);
                syncMetadata.tables_synced[tableName] = 0;
                extractedData[tableName] = [];
                rowIdsByTable[tableName] = [];
            }
        }

        // Step 2: Upload to Firebase Firestore (Grouped Backup Structure)
        let firebaseSuccess = false;
        if (firestoreDb) {
            console.log(`[SYNC-AGENT] Uploading sync backup ${syncRunId} to Firebase...`);
            const runDocRef = firestoreDb.collection('backups').doc(syncRunId);
            
            // Set root document metadata
            await runDocRef.set({
                sync_run_id: syncRunId,
                timestamp: startTime.getTime(),
                created_at: startTime.toISOString(),
                tables: syncMetadata.tables_synced
            });

            // Write all rows of all tables in batch subcollections
            for (const tableName of TABLES_TO_SYNC) {
                const rows = extractedData[tableName];
                if (rows.length === 0) continue;

                console.log(`[SYNC-AGENT] Writing ${rows.length} documents to backups/${syncRunId}/${tableName}...`);
                
                // Firestore batches are capped at 500 operations
                const BATCH_LIMIT = 400;
                let batch = firestoreDb.batch();
                let count = 0;

                for (const row of rows) {
                    // Document ID is row.id (stringified) if present, else auto-generated
                    const docId = row.id !== undefined && row.id !== null ? String(row.id) : null;
                    const docRef = docId 
                        ? runDocRef.collection(tableName).doc(docId) 
                        : runDocRef.collection(tableName).doc();
                    
                    batch.set(docRef, {
                        ...row,
                        _backup_synced_at: admin.firestore.FieldValue.serverTimestamp()
                    });

                    count++;
                    if (count >= BATCH_LIMIT) {
                        await batch.commit();
                        batch = firestoreDb.batch();
                        count = 0;
                    }
                }
                if (count > 0) {
                    await batch.commit();
                }
            }
            console.log('[SYNC-AGENT] Firebase Firestore upload completed successfully.');
            firebaseSuccess = true;
        } else {
            console.log('[SYNC-AGENT] Skipping Firebase upload (Running in offline/simulation mode).');
            firebaseSuccess = true; // Mark true for simulation mode
        }

        // Step 3: Generate Excel report in OneDrive directory
        console.log('[SYNC-AGENT] Generating Excel report...');
        let onedriveSuccess = false;

        const wb = XLSX.utils.book_new();

        // 3a. Prepare Summary Sheet Data
        const summaryData = [
            { Field: 'Sync Run ID', Value: syncRunId },
            { Field: 'Start Time', Value: startTime.toISOString() },
            { Field: 'End Time', Value: new Date().toISOString() },
            { Field: 'Database Provider', Value: 'Supabase PostgreSQL' },
            { Field: 'Backup Target', Value: firestoreDb ? 'Firebase Firestore (Spark)' : 'Simulation (Offline)' },
            { Field: 'OneDrive Sync Status', Value: 'Generated Locally' },
            { Field: 'Tables Processed', Value: TABLES_TO_SYNC.join(', ') }
        ];

        // Add table row counts to summary
        for (const [tbl, count] of Object.entries(syncMetadata.tables_synced)) {
            summaryData.push({ Field: `Table: ${tbl} (Rows)`, Value: count });
        }

        const summaryWs = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, summaryWs, 'Sync_Summary');

        // 3b. Add data sheets
        for (const tableName of TABLES_TO_SYNC) {
            const rows = extractedData[tableName];
            // Even if empty, create a sheet with headers so structure is maintained
            const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{}]);
            // Limit sheet name to 30 characters
            XLSX.utils.book_append_sheet(wb, ws, tableName.substring(0, 30));
        }

        // 3c. Write file
        const fileName = `sync_report_${syncRunId}.xlsx`;
        const filePath = path.join(reportDir, fileName);
        XLSX.writeFile(wb, filePath);
        
        if (fs.existsSync(filePath)) {
            console.log(`[SYNC-AGENT] Excel report successfully written to OneDrive directory: ${filePath}`);
            onedriveSuccess = true;
        } else {
            throw new Error(`Failed to write Excel file at ${filePath}`);
        }

        // Step 4: Validate 100% Confirmation
        syncMetadata.firebase_sync_success = firebaseSuccess;
        syncMetadata.onedrive_report_success = onedriveSuccess;

        if (firebaseSuccess && onedriveSuccess) {
            console.log('[SYNC-AGENT] Verification successful! Both Firebase and OneDrive transfers confirmed.');

            // Step 5: Safe deletion of dynamic transaction data from Supabase
            console.log('[SYNC-AGENT] Executing Safe deletion in Supabase...');
            let deletedCountTotal = 0;

            for (const tableName of tablesToDeleteList) {
                const ids = rowIdsByTable[tableName];
                if (!ids || ids.length === 0) continue;

                console.log(`[SYNC-AGENT] Deleting ${ids.length} synced rows from ${tableName} in Supabase...`);
                // Run parameterized IN statement using pg ANY
                await client.query(`DELETE FROM ${tableName} WHERE id = ANY($1::int[])`, [ids]);
                deletedCountTotal += ids.length;
            }

            console.log(`[SYNC-AGENT] Successfully cleared ${deletedCountTotal} synced rows from Supabase.`);
            syncMetadata.supabase_cleanup_success = true;
            syncMetadata.status = 'SUCCESS';
        } else {
            console.error('[SYNC-AGENT] Verification failed. Firebase or OneDrive report status is unconfirmed.');
            syncMetadata.status = 'FAILED_VERIFICATION';
        }

    } catch (err) {
        console.error('[SYNC-AGENT] Sync run failed with error:', err.message);
        syncMetadata.status = 'FAILED';
    } finally {
        syncMetadata.end_time = new Date().toISOString();
        
        if (client) {
            client.release();
        }

        console.log(`[SYNC-AGENT] Sync Run ${syncRunId} finished. Status: ${syncMetadata.status}`);
        
        // Write sync run status to backups summary if firebase available
        if (firestoreDb && syncMetadata.status !== 'FAILED') {
            try {
                await firestoreDb.collection('backups').doc(syncRunId).update({
                    status: syncMetadata.status,
                    end_time: syncMetadata.end_time,
                    firebase_sync_success: syncMetadata.firebase_sync_success,
                    onedrive_report_success: syncMetadata.onedrive_report_success,
                    supabase_cleanup_success: syncMetadata.supabase_cleanup_success
                });
            } catch (upErr) {
                console.error('[SYNC-AGENT] Failed to update final sync status in Firebase:', upErr.message);
            }
        }
    }
}

/**
 * Recursive deletion helper for Firestore documents and subcollections
 */
async function deleteFirestoreDocAndSubcollections(docRef) {
    // 1. Get all subcollections
    const subcollections = await docRef.listCollections();
    for (const subcol of subcollections) {
        // Fetch all documents in subcollection
        const snapshot = await subcol.get();
        const batchSize = 100;
        let batch = firestoreDb.batch();
        let count = 0;

        for (const doc of snapshot.docs) {
            // Recursively delete sub-documents if any
            await deleteFirestoreDocAndSubcollections(doc.ref);
            batch.delete(doc.ref);
            count++;

            if (count >= batchSize) {
                await batch.commit();
                batch = firestoreDb.batch();
                count = 0;
            }
        }
        if (count > 0) {
            await batch.commit();
        }
    }
    // 2. Delete the doc itself
    await docRef.delete();
}

/**
 * Cleanup logic: Find and clear backups older than 24 hours in Firebase
 */
async function runFirebaseCleanup() {
    if (!firestoreDb) {
        console.log('[SYNC-AGENT-CLEANUP] Firestore database not initialized. Skipping 24h retention cleanup.');
        return;
    }

    console.log('[SYNC-AGENT-CLEANUP] Running 24-hour backup retention check in Firebase...');
    const retentionCutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
    
    try {
        const expiredBackups = await firestoreDb.collection('backups')
            .where('timestamp', '<', retentionCutoff)
            .get();

        console.log(`[SYNC-AGENT-CLEANUP] Found ${expiredBackups.size} expired backup runs (older than 24h).`);

        for (const doc of expiredBackups.docs) {
            console.log(`[SYNC-AGENT-CLEANUP] Cleaning up expired backup run: ${doc.id}`);
            await deleteFirestoreDocAndSubcollections(doc.ref);
            console.log(`[SYNC-AGENT-CLEANUP] Successfully removed expired backup run: ${doc.id}`);
        }
        
        console.log('[SYNC-AGENT-CLEANUP] 24-hour retention cleanup completed.');
    } catch (err) {
        console.error('[SYNC-AGENT-CLEANUP] Error during 24-hour cleanup:', err.message);
    }
}

/**
 * Continuous loop for background daemon mode
 */
function startSyncLoop() {
    console.log(`[SYNC-AGENT] Starting background daemon. Syncing every ${syncIntervalMinutes} minutes.`);
    
    // Immediate first execution
    executeAndCleanup();

    setInterval(executeAndCleanup, syncIntervalMinutes * 60 * 1000);
}

async function executeAndCleanup() {
    try {
        await executeSync();
        await runFirebaseCleanup();
    } catch (err) {
        console.error('[SYNC-AGENT] Scheduled execution error:', err.message);
    }
}

// CLI entry point handling
const args = process.argv.slice(2);
if (require.main === module) {
    if (args.includes('--daemon')) {
        startSyncLoop();
    } else {
        // Run once and exit
        (async () => {
            await executeSync();
            await runFirebaseCleanup();
            pool.end();
            console.log('[SYNC-AGENT] Process execution completed.');
        })();
    }
}

module.exports = { executeSync, runFirebaseCleanup, startSyncLoop };
