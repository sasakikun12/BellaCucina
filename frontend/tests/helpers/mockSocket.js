export const socketBus = {
  handlers: { "order:new": [], "order:updated": [], "table:updated": [] },
};

export function resetSocketBus() {
  socketBus.handlers = { "order:new": [], "order:updated": [], "table:updated": [] };
}

export function emitSocket(event, payload) {
  for (const cb of socketBus.handlers[event]) cb(payload);
}

function subscribe(event) {
  return (cb) => {
    socketBus.handlers[event].push(cb);
    return () => {
      socketBus.handlers[event] = socketBus.handlers[event].filter((h) => h !== cb);
    };
  };
}

export function useSocketMock() {
  return {
    onOrderNew: subscribe("order:new"),
    onOrderUpdated: subscribe("order:updated"),
    onTableUpdated: subscribe("table:updated"),
  };
}
