// Smallest thing that fails if the server logic breaks. Run: node scripts/selftest.js
const assert = require("node:assert");
const path = require("node:path");
const { resolveRelativePath, resolveFile, validateMessage, isRateLimited, rateLimit } = require("..");

// path resolution
assert.strictEqual(resolveRelativePath("/"), "index.html");
assert.strictEqual(resolveRelativePath("/contact/"), "contact/");
assert.strictEqual(resolveRelativePath("/css/style.css?v=2"), "css/style.css");
// traversal is normalised away, so it can never resolve to a file outside the site root
for (const attack of ["/../../etc/passwd", "/%2e%2e/%2e%2e/etc/passwd", "//etc/passwd"]) {
  assert.strictEqual(resolveFile(resolveRelativePath(attack)), null, `must not escape root: ${attack}`);
}
assert.strictEqual(resolveRelativePath("/.env"), null, "dotfiles must be refused");
assert.strictEqual(resolveRelativePath("/contact-api/server.js"), null);
assert.strictEqual(resolveRelativePath("/package.json"), null);
assert.strictEqual(resolveRelativePath("/nginx.conf"), null);

// directory index, the thing plain fs.readFile got wrong
assert.strictEqual(resolveFile("contact"), path.join(__dirname, "..", "contact", "index.html"));
assert.strictEqual(resolveFile("index.html"), path.join(__dirname, "..", "index.html"));
assert.strictEqual(resolveFile("nope/nothing.html"), null);

// contact validation
assert.match(validateMessage({}), /obbligatori/);
assert.match(validateMessage({ name: "a", email: "nope", message: "hi" }), /Email/);
assert.match(validateMessage({ name: "a", email: "a@b.co", message: "x".repeat(5001) }), /lungo/);
assert.strictEqual(validateMessage({ name: "a", email: "a@b.co", message: "hi" }), null);

// rate limit: 5 through, 6th blocked, window reset lets it through again
rateLimit.clear();
for (let i = 0; i < 5; i++) assert.strictEqual(isRateLimited("1.2.3.4"), false, `request ${i + 1}`);
assert.strictEqual(isRateLimited("1.2.3.4"), true, "6th request must be limited");
assert.strictEqual(isRateLimited("1.2.3.4", Date.now() + 16 * 60 * 1000), false, "window must reset");

console.log("selftest ok");
