import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createProxyMiddleware } from "http-proxy-middleware";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(cors());

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
