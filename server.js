const express = require("express");
const path = require("node:path");

const port = Number.parseInt(
  process.env.SERVER_PORT || process.env.PORT || "3000",
  10
);
const host = process.env.HOST || "0.0.0.0";

const app = express();

app.use(express.static(path.join(__dirname)));

const server = app.listen(port, host, () => {
  console.log(`Static site ready at http://${host}:${port}`);
});

function shutdown() {
  console.log("Shutting down...");
  server.close(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
