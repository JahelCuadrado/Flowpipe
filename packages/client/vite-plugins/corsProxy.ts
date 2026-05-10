/**
 * Vite plugin that adds a CORS proxy middleware at `/__proxy?url=<encoded-url>`.
 * Used in development to bypass cross-origin restrictions when the extractor
 * runs inside the browser and needs to reach YouTube / googlevideo.com.
 *
 * In production (Capacitor APK), Capacitor patches fetch() natively and
 * this proxy is not needed.
 */

import http from "node:http";
import https from "node:https";
import type { Plugin } from "vite";

const ALLOWED_HOSTS = [
  "www.youtube.com",
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtubei.googleapis.com",
  "www.google.com",
  "suggestqueries-clients6.youtube.com",
];

function isAllowedHost(hostname: string): boolean {
  if (ALLOWED_HOSTS.includes(hostname)) return true;
  if (hostname.endsWith(".googlevideo.com")) return true;
  return false;
}

export function corsProxyPlugin(): Plugin {
  return {
    name: "cors-proxy",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");

        if (url.pathname !== "/__proxy") {
          next();
          return;
        }

        const targetUrl = url.searchParams.get("url");
        if (!targetUrl) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing 'url' query parameter" }));
          return;
        }

        let target: URL;
        try {
          target = new URL(targetUrl);
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid target URL" }));
          return;
        }

        if (!isAllowedHost(target.hostname)) {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: `Host not allowed: ${target.hostname}` }));
          return;
        }

        // Forward headers (skip browser-specific ones)
        const forwardHeaders: Record<string, string | string[] | undefined> = {
          ...req.headers,
        };
        delete forwardHeaders.host;
        delete forwardHeaders.origin;
        delete forwardHeaders.referer;
        delete forwardHeaders.connection;
        forwardHeaders.host = target.host;

        const transport = target.protocol === "https:" ? https : http;

        const proxyReq = transport.request(
          {
            hostname: target.hostname,
            port: target.port || (target.protocol === "https:" ? 443 : 80),
            path: target.pathname + target.search,
            method: req.method ?? "GET",
            headers: forwardHeaders,
            timeout: 15_000,
          },
          (proxyRes) => {
            const responseHeaders: Record<string, string | string[]> = {};

            for (const [key, value] of Object.entries(proxyRes.headers)) {
              if (value === undefined) continue;
              const lk = key.toLowerCase();
              // Strip security headers that block embedding
              if (lk === "x-frame-options" || lk === "content-security-policy") continue;
              responseHeaders[key] = value;
            }

            responseHeaders["access-control-allow-origin"] = "*";
            responseHeaders["access-control-expose-headers"] = "*";

            res.writeHead(proxyRes.statusCode ?? 502, responseHeaders);
            proxyRes.pipe(res, { end: true });
          }
        );

        proxyReq.on("error", (error) => {
          // Only send error response if headers haven't been sent yet
          if (!res.headersSent) {
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: `Proxy error: ${error.message}` }));
          } else {
            res.end();
          }
        });

        proxyReq.on("timeout", () => {
          proxyReq.destroy();
          if (!res.headersSent) {
            res.writeHead(504, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Proxy request timed out" }));
          } else {
            res.end();
          }
        });

        // Handle CORS preflight
        if (req.method === "OPTIONS") {
          res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "86400",
          });
          res.end();
          return;
        }

        // Forward request body
        req.pipe(proxyReq, { end: true });
      });
    },
  };
}
