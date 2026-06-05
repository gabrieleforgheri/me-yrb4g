const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.join(__dirname, "..");
const entryPath = path.join(rootDir, "index.js");
const templatePath = path.join(__dirname, "server-template.js");

function logDirectoryState() {
  const files = fs.readdirSync(rootDir).sort();
  console.log(`[ensure-entry] Files in ${rootDir}: ${files.join(", ")}`);
}

if (!fs.existsSync(entryPath)) {
  console.log("[ensure-entry] index.js missing, restoring from template");
  fs.copyFileSync(templatePath, entryPath);
  console.log("[ensure-entry] index.js restored");
}

if (!fs.existsSync(entryPath)) {
  logDirectoryState();
  throw new Error("index.js is still missing after restore attempt");
}

console.log("[ensure-entry] index.js is ready");
