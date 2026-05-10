import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { registerSearchRoutes } from "./routes/searchRoutes.js";
import { registerStreamRoutes } from "./routes/streamRoutes.js";
import { registerChannelRoutes } from "./routes/channelRoutes.js";
import { registerPlaylistRoutes } from "./routes/playlistRoutes.js";
import { registerCommentsRoutes } from "./routes/commentsRoutes.js";
import { registerKioskRoutes } from "./routes/kioskRoutes.js";
import { globalErrorHandler } from "./middleware/errorHandler.js";
import { initExtractor } from "./services/extractorInit.js";

const PORT = parseInt(process.env["SERVER_PORT"] ?? "3001", 10);
const HOST = process.env["SERVER_HOST"] ?? "0.0.0.0";

async function bootstrap(): Promise<void> {
  const server = Fastify({
    logger: {
      level: "info",
      transport: {
        target: "pino-pretty",
        options: { translateTime: "HH:MM:ss Z", ignore: "pid,hostname" },
      },
    },
  });

  // ─── Plugins ────────────────────────────────────────────────────────
  await server.register(cors, {
    origin: true,
    methods: ["GET", "POST"],
  });

  await server.register(rateLimit, {
    max: parseInt(process.env["RATE_LIMIT_MAX"] ?? "100", 10),
    timeWindow: parseInt(process.env["RATE_LIMIT_WINDOW_MS"] ?? "60000", 10),
  });

  // ─── Global Error Handler ──────────────────────────────────────────
  server.setErrorHandler(globalErrorHandler);

  // ─── Initialize Extractor ──────────────────────────────────────────
  initExtractor();

  // ─── Routes ────────────────────────────────────────────────────────
  await server.register(registerSearchRoutes, { prefix: "/api/v1" });
  await server.register(registerStreamRoutes, { prefix: "/api/v1" });
  await server.register(registerChannelRoutes, { prefix: "/api/v1" });
  await server.register(registerPlaylistRoutes, { prefix: "/api/v1" });
  await server.register(registerCommentsRoutes, { prefix: "/api/v1" });
  await server.register(registerKioskRoutes, { prefix: "/api/v1" });

  // ─── Health Check ──────────────────────────────────────────────────
  server.get("/health", async () => ({ status: "ok", timestamp: Date.now() }));

  // ─── Start ─────────────────────────────────────────────────────────
  await server.listen({ port: PORT, host: HOST });
}

bootstrap().catch((error: unknown) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
