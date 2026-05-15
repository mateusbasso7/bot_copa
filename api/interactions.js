const { handleDiscordRequest } = require("../src/app");

module.exports = async function interactions(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "method not allowed" }));
    return;
  }

  await handleDiscordRequest(req, res);
};
