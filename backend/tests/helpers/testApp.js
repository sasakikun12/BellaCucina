import { createServer } from "node:http";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createApp } = require("../../src/app");
const { initSocket } = require("../../src/socket");

export function createTestApp() {
  const app = createApp();
  initSocket(createServer());
  return app;
}
