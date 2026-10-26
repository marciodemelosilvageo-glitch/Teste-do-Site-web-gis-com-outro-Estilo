import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createProxyMiddleware } from "http-proxy-middleware";
import cors from "cors";

import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(cors());

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

  // Proxy the parquet file
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
          // ensure CORS headers are set
          proxyRes.headers["access-control-allow-origin"] = "*";
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
