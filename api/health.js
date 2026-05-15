module.exports = function health(req, res) {
  res.statusCode = 200;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ ok: true }));
};
