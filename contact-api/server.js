const express = require('express');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());

// ============================================
// CONFIGURAZIONE SMTP
// Modifica SOLO queste variabili d'ambiente
// nel file docker-compose.yml
// ============================================
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true per 465, false per 587
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

const RECIPIENT_EMAIL = process.env.RECIPIENT_EMAIL || process.env.SMTP_USER || '';

// Rate limiting semplice (max 5 richieste per IP ogni 15 min)
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minuti
const RATE_LIMIT_MAX = 5;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || now - entry.firstRequest > RATE_LIMIT_WINDOW) {
    rateLimit.set(ip, { firstRequest: now, count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// Pulizia rate limit ogni 30 min
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimit) {
    if (now - entry.firstRequest > RATE_LIMIT_WINDOW) rateLimit.delete(ip);
  }
}, 30 * 60 * 1000);

app.post('/api/contact', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.ip;

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Troppi messaggi. Riprova tra qualche minuto.' });
  }

  const { name, email, message } = req.body;

  // Validazione
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Tutti i campi sono obbligatori.' });
  }

  if (name.length > 100 || email.length > 100 || message.length > 5000) {
    return res.status(400).json({ error: 'Input troppo lungo.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Email non valida.' });
  }

  try {
    await transporter.sendMail({
      from: `"${name}" <${process.env.SMTP_USER}>`,
      replyTo: email,
      to: RECIPIENT_EMAIL,
      subject: `[yrb4g.com] Nuovo messaggio da ${name}`,
      text: `Nome: ${name}\nEmail: ${email}\n\nMessaggio:\n${message}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2 style="color: #333;">Nuovo messaggio dal sito</h2>
          <p><strong>Nome:</strong> ${name}</p>
          <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          <hr style="border: 1px solid #eee;">
          <p style="white-space: pre-wrap;">${message}</p>
        </div>
      `,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Errore invio email:', err.message);
    res.status(500).json({ error: 'Errore nell\'invio dell\'email.' });
  }
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Contact API in ascolto sulla porta ${PORT}`);
});
