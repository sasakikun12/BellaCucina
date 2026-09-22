const { Server } = require("socket.io");
const { verifyToken } = require("./utils/jwt");

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      /* v8 ignore next */
      origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Missing auth token"));
    try {
      const payload = verifyToken(token);
      socket.data.user = payload;
      next();
    } catch {
      next(new Error("Invalid auth token"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    console.log(`[socket] connected: ${user?.name} (${user?.role})`);
    socket.on("disconnect", () => {
      console.log(`[socket] disconnected: ${user?.name}`);
    });
  });

  return io;
}

function getIo() {
  if (!io) throw new Error("Socket.io not initialized yet");
  return io;
}

const emitOrderNew = (order) => getIo().emit("order:new", order);
const emitOrderUpdated = (order) => getIo().emit("order:updated", order);
const emitTableUpdated = (table) => getIo().emit("table:updated", table);

module.exports = {
  initSocket,
  emitOrderNew,
  emitOrderUpdated,
  emitTableUpdated,
};
