import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createProxyMiddleware } from "http-proxy-middleware";
import cors from "cors";

import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Lista de origens permitidas (localhost e domínio em produção)
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    ...(process.env.APP_URL ? [process.env.APP_URL.replace(/\/+$/, "")] : [])
  ];

  const isOriginAllowed = (origin?: string): boolean => {
    if (!origin) return true; // Permite requisições same-origin ou server-to-server sem Origin
    if (allowedOrigins.includes(origin)) return true;
    // Permite domínios Vercel do projeto (*.vercel.app)
    if (/^https:\/\/[a-zA-Z0-9_-]+\.vercel\.app$/.test(origin)) return true;
    return false;
  };

  app.use(cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Bloqueio de CORS: Origem "${origin}" não permitida.`));
      }
    },
    credentials: true
  }));

  // Rate Limiting básico em memória para proteção contra negação de serviço
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  const RATE_LIMIT_WINDOW_MS = 60 * 1000; // Janela de 1 minuto
  const RATE_LIMIT_MAX_REQUESTS = 240; // Até 240 req/min por IP (folga suficiente para tiles e chunks)

  app.use((req, res, next) => {
    const rawIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const clientData = rateLimitMap.get(rawIp);

    if (!clientData || now > clientData.resetTime) {
      rateLimitMap.set(rawIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    } else {
      clientData.count += 1;
      if (clientData.count > RATE_LIMIT_MAX_REQUESTS) {
        res.setHeader("Retry-After", Math.ceil((clientData.resetTime - now) / 1000));
        return res.status(429).json({ error: "Limite de requisições excedido. Aguarde um momento." });
      }
    }
    next();
  });

  // Desabilitar cache para index.html garantindo que o navegador sempre receba os hashes mais atuais de CSS e JS
  app.use((req, res, next) => {
    if (req.path === "/" || req.path === "/index.html") {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
    next();
  });

  // Fallback inteligente para requisições de CSS/JS com hashes antigos de builds anteriores
  app.use("/assets", (req, res, next) => {
    const distAssetsPath = path.join(process.cwd(), "dist", "assets");
    const requestedFile = path.join(distAssetsPath, req.path);

    if (fs.existsSync(requestedFile)) {
      return next();
    }

    // Se o navegador requisitou um arquivo CSS cujo hash mudou no build recente (ex: index-DpxYvesP.css)
    if (req.path.endsWith(".css")) {
      try {
        if (fs.existsSync(distAssetsPath)) {
          const files = fs.readdirSync(distAssetsPath);
          const latestCss = files.find(f => f.startsWith("index-") && f.endsWith(".css"));
          if (latestCss) {
            res.setHeader("Content-Type", "text/css; charset=utf-8");
            return res.sendFile(path.join(distAssetsPath, latestCss));
          }
        }
      } catch (err) {
        // Fall through
      }
    }

    next();
  });

  // Proxy the parquet file (Restrito a métodos GET e HEAD com cabeçalho de origem seguro)
  app.use("/parquet", (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("Allow", "GET, HEAD");
      return res.status(405).json({ error: "Método não permitido no proxy. Apenas consultas GET e HEAD são autorizadas." });
    }
    next();
  });

  app.use(
    "/parquet",
    createProxyMiddleware({
      target: "https://pub-2bd417d213f04fae9ffd18d26ad95d5b.r2.dev",
      changeOrigin: true,
      pathRewrite: {
        "^/parquet": "", // remove /parquet prefix
      },
      on: {
        proxyRes: (proxyRes, req, res) => {
          const reqOrigin = req.headers["origin"] as string;
          if (isOriginAllowed(reqOrigin)) {
            proxyRes.headers["access-control-allow-origin"] = reqOrigin;
          } else {
            delete proxyRes.headers["access-control-allow-origin"];
          }
          proxyRes.headers["access-control-expose-headers"] = "content-length, content-range, accept-ranges";
        }
      }
    })
  );

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
