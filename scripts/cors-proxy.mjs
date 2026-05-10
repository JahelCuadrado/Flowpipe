/**
 * Lightweight CORS proxy for browser development.
 * Proxies requests to YouTube's InnerTube API and other endpoints
 * that block cross-origin requests from localhost.
 *
 * Usage: node scripts/cors-proxy.mjs
 * The proxy runs on port 8090 by default.
 *
 * In the client, set VITE_CORS_PROXY_URL=http://localhost:8090
 * to route fetch requests through this proxy.
 */

import http from "node:http";
import https from "node:https";

const PORT = parseInt(process.env.PROXY_PORT ?? "8090", 10);

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
];

const server = http.createServer((req, res) => {
  const origin = req.headers.origin ?? "*";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-YouTube-Client-Name, X-YouTube-Client-Version, X-Goog-Api-Key, User-Agent",
      "Access-Control-Max-Age": "86400",
    });
    res.end();
    return;
  }

  // Extract target URL from query param: /proxy?url=<encoded-url>
  const parsed = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const targetUrl = parsed.searchParams.get("url");

  if (!targetUrl) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing 'url' query parameter" }));
    return;
  }

  // Validate target URL — only allow YouTube domains
  let targetParsed;
  try {
    targetParsed = new URL(targetUrl);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid target URL" }));
    return;
  }

  const allowedHosts = [
    "www.youtube.com",
    "youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtubei.googleapis.com",
    "www.google.com",
    "suggestqueries-clients6.youtube.com",
    "manifest.googlevideo.com",
  ];

  // Allow *.googlevideo.com for stream segments
  const isGooglevideo = targetParsed.hostname.endsWith(".googlevideo.com");
  if (!allowedHosts.includes(targetParsed.hostname) && !isGooglevideo) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Target host not allowed" }));
    return;
  }

  // Forward request headers (skip host and origin)
  const forwardHeaders = { ...req.headers };
  delete forwardHeaders.host;
  delete forwardHeaders.origin;
  delete forwardHeaders.referer;
  forwardHeaders.host = targetParsed.host;

  const options = {
    hostname: targetParsed.hostname,
    port: targetParsed.port || (targetParsed.protocol === "https:" ? 443 : 80),
    path: targetParsed.pathname + targetParsed.search,
    method: req.method,
    headers: forwardHeaders,
  };

  const transport = targetParsed.protocol === "https:" ? https : http;

  const proxyReq = transport.request(options, (proxyRes) => {
    const responseHeaders = {
      ...proxyRes.headers,
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Expose-Headers": "*",
    };
    // Remove security headers that block embedding
    delete responseHeaders["x-frame-options"];
    delete responseHeaders["content-security-policy"];

    res.writeHead(proxyRes.statusCode ?? 502, responseHeaders);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", (error) => {
    console.error(`[proxy] Error: ${error.message}`);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Proxy request failed" }));
  });

  // Forward request body for POST
  req.pipe(proxyReq, { end: true });
});

server.listen(PORT, () => {
  console.log(`[cors-proxy] Listening on http://localhost:${PORT}`);
  console.log(`[cors-proxy] Usage: /proxy?url=<encoded-target-url>`);
});
