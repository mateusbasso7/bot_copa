require("dotenv").config();

const http = require("node:http");
const { handleDiscordRequest } = require("./app");

const port = Number(process.env.PORT || 3000);

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/api/health") {
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === "POST" && req.url === "/api/interactions") {
    await handleDiscordRequest(req, res);
    return;
  }

  res.statusCode = 404;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(port, () => {
  console.log(`Dev server online em http://localhost:${port}`);
});
