// Static site + contact API in one Node process, for the Pelican "node.js generic" egg.
// Replaces the nginx + contact-api docker-compose pair used on CT 201.

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const nodemailer = require("nodemailer");

const rootDir = __dirname;

// Pelican sets SERVER_PORT; .env holds the SMTP credentials (gitignored, never committed).
loadEnvFile(path.join(rootDir, ".env"));
const port = Number.parseInt(process.env.SERVER_PORT || process.env.PORT || "3000", 10);
const host = process.env.HOST || "0.0.0.0";

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
};

const CACHEABLE = /\.(css|js|woff2|jpeg|jpg|png|gif|ico|svg|webp)$/i;

// Everything nginx used to deny: dotfiles, the old backend, build and deploy files.
const DENIED = /(^|\/)(\.|contact-api\/|scripts\/|node_modules\/|apartments\/scraper\/|docker-compose|nginx\.conf|Dockerfile|package(-lock)?\.json)/i;

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

function loadEnvFile(file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

function send(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, { ...SECURITY_HEADERS, ...headers });
  response.end(body);
}

function sendText(response, statusCode, message) {
  send(response, statusCode, message, { "Content-Type": "text/plain; charset=utf-8" });
}

function sendJson(response, statusCode, payload) {
  send(response, statusCode, JSON.stringify(payload), { "Content-Type": "application/json" });
}

// Returns the relative path to serve, or null if the request must be refused.
function resolveRelativePath(requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath.split("?")[0]);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;

  const relative = path.posix.normalize(decoded).replace(/^\/+/, "");
  if (relative.startsWith("..")) return null;
  if (DENIED.test(relative)) return null;

  return relative === "" ? "index.html" : relative;
}

// try_files $uri $uri/index.html =404
function resolveFile(relative) {
  const candidate = path.resolve(rootDir, relative);
  if (candidate !== rootDir && !candidate.startsWith(rootDir + path.sep)) return null;

  let stats;
  try {
    stats = fs.statSync(candidate);
  } catch {
    return null;
  }
  if (stats.isFile()) return candidate;
  if (!stats.isDirectory()) return null;

  const indexFile = path.join(candidate, "index.html");
  return fs.existsSync(indexFile) ? indexFile : null;
}

function serveStatic(request, response) {
  const relative = resolveRelativePath(request.url || "/");
  if (relative === null) {
    sendText(response, 404, "Not Found");
    return;
  }

  const filePath = resolveFile(relative);
  if (!filePath) {
    sendText(response, 404, "Not Found");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendText(response, 500, "Internal Server Error");
      return;
    }
    const headers = {
      "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    };
    if (CACHEABLE.test(filePath)) headers["Cache-Control"] = "public, max-age=604800, immutable";
    send(response, 200, data, headers);
  });
}

// --- contact API (was contact-api/server.js behind an nginx /api/ proxy) ---

const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const rateLimit = new Map();

function isRateLimited(ip, now = Date.now()) {
  const entry = rateLimit.get(ip);
  if (!entry || now - entry.firstRequest > RATE_LIMIT_WINDOW) {
    rateLimit.set(ip, { firstRequest: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimit) {
    if (now - entry.firstRequest > RATE_LIMIT_WINDOW) rateLimit.delete(ip);
  }
}, 30 * 60 * 1000).unref();

function validateMessage({ name, email, message }) {
  if (!name || !email || !message) return "Tutti i campi sono obbligatori.";
  if (name.length > 100 || email.length > 100 || message.length > 5000) return "Input troppo lungo.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Email non valida.";
  return null;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

let transporter = null;
function getTransporter() {
  if (!transporter) {
    const smtpPort = Number.parseInt(process.env.SMTP_PORT || "587", 10);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: smtpPort,
      secure: smtpPort === 465 || process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER || "", pass: process.env.SMTP_PASS || "" },
    });
  }
  return transporter;
}

function readJsonBody(request, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("body too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

async function handleContact(request, response) {
  const ip = (request.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    request.socket.remoteAddress;

  if (isRateLimited(ip)) {
    sendJson(response, 429, { error: "Troppi messaggi. Riprova tra qualche minuto." });
    return;
  }

  let body;
  try {
    body = await readJsonBody(request);
  } catch {
    sendJson(response, 400, { error: "Richiesta non valida." });
    return;
  }

  const invalid = validateMessage(body);
  if (invalid) {
    sendJson(response, 400, { error: invalid });
    return;
  }

  const { name, email, message } = body;
  try {
    await getTransporter().sendMail({
      from: `"${name}" <${process.env.SMTP_USER}>`,
      replyTo: email,
      to: process.env.RECIPIENT_EMAIL || process.env.SMTP_USER || "",
      subject: `[yrb4g.com] Nuovo messaggio da ${name}`,
      text: `Nome: ${name}\nEmail: ${email}\n\nMessaggio:\n${message}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2 style="color: #333;">Nuovo messaggio dal sito</h2>
          <p><strong>Nome:</strong> ${escapeHtml(name)}</p>
          <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
          <hr style="border: 1px solid #eee;">
          <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
        </div>
      `,
    });
    sendJson(response, 200, { success: true });
  } catch (error) {
    console.error("Errore invio email:", error.message);
    sendJson(response, 500, { error: "Errore nell'invio dell'email." });
  }
}

const server = http.createServer((request, response) => {
  const urlPath = (request.url || "/").split("?")[0];

  if (urlPath === "/api/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }
  if (urlPath === "/api/contact") {
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method Not Allowed" });
      return;
    }
    handleContact(request, response);
    return;
  }
  if (urlPath.startsWith("/api/")) {
    sendJson(response, 404, { error: "Not Found" });
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    sendText(response, 405, "Method Not Allowed");
    return;
  }

  serveStatic(request, response);
});

if (require.main === module) {
  server.listen(port, host, () => {
    console.log(`yrb4g.com ready at http://${host}:${port}`);
  });

  const shutdown = () => {
    console.log("Shutting down...");
    server.close(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

module.exports = { server, resolveRelativePath, resolveFile, validateMessage, isRateLimited, rateLimit };
