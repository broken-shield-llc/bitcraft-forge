import { describe, expect, it } from "vitest";
import { once } from "node:events";
import { get as httpGet } from "node:http";
import type { AddressInfo } from "node:net";
import { createLogger } from "@forge/logger";
import { startHealthHttpServer } from "./healthHttp.js";

function get(url: string): Promise<{ statusCode?: number; body: string }> {
  return new Promise((resolve, reject) => {
    httpGet(url, (res) => {
      let body = "";
      res.on("data", (c) => {
        body += String(c);
      });
      res.on("end", () => {
        resolve({ statusCode: res.statusCode, body });
      });
    }).on("error", reject);
  });
}

describe("startHealthHttpServer", () => {
  it("GET /health returns 200 JSON", async () => {
    const log = createLogger("error");
    const server = startHealthHttpServer(0, log);
    await once(server, "listening");
    const addr = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${addr.port}`;

    const ok = await get(`${base}/health`);
    expect(ok.statusCode).toBe(200);
    expect(JSON.parse(ok.body)).toEqual({ status: "ok" });

    const missing = await get(`${base}/missing`);
    expect(missing.statusCode).toBe(404);

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });
});
