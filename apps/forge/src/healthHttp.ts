import type { Logger } from "@forge/logger";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

/**
 * Minimal liveness server for orchestrators (e.g. ECS). `GET /health` → 200 JSON.
 * Binds on all interfaces (`0.0.0.0`). Use port `0` to pick an ephemeral port (tests).
 */
export function startHealthHttpServer(port: number, log: Logger): Server {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const path = req.url?.split("?")[0] ?? "";
    if (req.method !== "GET" || path !== "/health") {
      res.statusCode = 404;
      res.end();
      return;
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.statusCode = 200;
    res.end(JSON.stringify({ status: "ok" }));
  });

  server.on("error", (err) => {
    log.error("Health HTTP server error", String(err));
  });

  server.listen(port, "0.0.0.0", () => {
    const where = server.address();
    const label =
      typeof where === "object" && where !== null
        ? `${where.address}:${where.port}`
        : String(where);
    log.info(`Health check: GET http://${label}/health`);
  });

  return server;
}
