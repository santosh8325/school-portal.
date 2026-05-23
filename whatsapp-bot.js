const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Configuration
const PORTAL_URL = process.env.PORTAL_URL || 'http://localhost:3000'; // Change this to your Render URL in production (e.g., https://your-school.onrender.com)
const BOT_SECRET = 'eduportal-bot-secret-12345';
const POLL_INTERVAL_MS = 60 * 1000; // Poll every 1 minute

console.log('Starting School Portal WhatsApp Bot...');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: false, // Set to true to hide the Chrome window
        args: ['--no-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log('\n==================================================');
    console.log('QR Code Received. Scan it with your WhatsApp app:');
    console.log('==================================================\n');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('\n==================================================');
    console.log('✅ WhatsApp Bot is Ready and Authenticated!');
    console.log(`📡 Polling ${PORTAL_URL} every ${POLL_INTERVAL_MS / 1000} seconds...`);
    console.log('==================================================\n');
    
    // Start polling the server
    setInterval(pollAbsences, POLL_INTERVAL_MS);
    pollAbsences(); // Initial poll
});

client.on('auth_failure', msg => {
    console.error('AUTHENTICATION FAILURE', msg);
});

async function pollAbsences() {
    try {
        const response = await fetch(`${PORTAL_URL}/api/bot/absent-alerts`, {
            headers: {
                'Authorization': `Bearer ${BOT_SECRET}`
            }
        });
        
        if (!response.ok) {
            console.error('Failed to fetch from portal:', response.status, response.statusText);
            return;
        }

        const alerts = await response.json();
        
        if (alerts.length > 0) {
            console.log(`Found ${alerts.length} new absence alert(s). Processing...`);
        }

        for (const alert of alerts) {
            // WhatsApp format for numbers: <countrycode><number>@c.us
            // Make sure the phone number from DB doesn't have spaces or + signs
            let formattedPhone = alert.parent_phone.replace(/\D/g, ''); 
            
            // Default to India country code if none provided (adjust as needed)
            if (formattedPhone.length === 10) {
                formattedPhone = '91' + formattedPhone; 
            }
            
            const chatId = `${formattedPhone}@c.us`;
            const message = `*School Alert*\nDear Parent,\nYour child *${alert.student_name}* is marked *Absent* today. Please check the school portal for more details.`;

            console.log(`Sending message to ${formattedPhone} for student ${alert.student_name}...`);
            
            try {
                await client.sendMessage(chatId, message);
                console.log(`Message sent successfully.`);
                
                // Mark as sent on the server
                await fetch(`${PORTAL_URL}/api/bot/mark-sent`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${BOT_SECRET}`
                    },
                    body: JSON.stringify({ attendance_id: alert.attendance_id })
                });
            } catch (err) {
                console.error(`Failed to send message to ${formattedPhone}:`, err.message);
            }
            
            // Wait 2 seconds between messages to avoid spam filters
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

    } catch (error) {
        console.error('Error polling portal:', error.message);
    }
}

client.initialize();
