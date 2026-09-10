const { createServer } = require("http");
const { createApp } = require("./app");
const { initSocket } = require("./socket");

const app = createApp();
const httpServer = createServer(app);

initSocket(httpServer);

/* v8 ignore next */
const PORT = Number(process.env.PORT) || 4000;

/* v8 ignore next */
const HOST = process.env.HOST || "127.0.0.1";
httpServer.listen(PORT, HOST, () => {
  console.log(`Restaurant backend listening on http://${HOST}:${PORT}`);
});

module.exports = { app, httpServer };
