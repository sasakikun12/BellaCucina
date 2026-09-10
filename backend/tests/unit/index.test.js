import { describe, it, expect, afterAll, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const originalLog = console.log;
const logged = [];
console.log = (...args) => logged.push(args.join(" "));

delete require.cache[require.resolve("../../src/index")];
const { app, httpServer } = require("../../src/index");

describe("src/index.js (bootstrap do servidor)", () => {
  afterAll(async () => {
    console.log = originalLog;
    await new Promise((resolve) => httpServer.close(resolve));
  });

  it("exporta um app Express e um http.Server que está escutando", async () => {
    expect(typeof app).toBe("function");
    await vi.waitFor(() => expect(httpServer.listening).toBe(true));
  });

  it("loga o endereço em que está escutando", async () => {
    await vi.waitFor(() =>
      expect(logged.some((line) => /^Restaurant backend listening on http:\/\/127\.0\.0\.1:\d+$/.test(line))).toBe(true),
    );
  });
});
