import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "./routers";
import { createContext } from "./_core/trpc";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import FormData from "form-data";
import axios from "axios";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => { server.close(() => resolve(true)); });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(cookieParser());

  registerStorageProxy(app);

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
  });

  // Upload proxy for reverse image search
  app.post("/api/upload", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      // SerpApi allows sending the file directly as multipart
      const serpKey = process.env.SERPAPI_KEY;
      if (!serpKey) {
        res.status(500).json({ error: "SerpApi key not configured" });
        return;
      }

      // Axios is much more reliable with form-data in Node.js
      const formData = new FormData();
      formData.append("engine", "google_lens");
      formData.append("api_key", serpKey);
      formData.append("file", req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });

      console.log(`[upload] Sending file to SerpApi: ${req.file.originalname} (${req.file.size} bytes)`);

      const serpRes = await axios.post("https://serpapi.com/search.json", formData, {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 30000,
      });

      console.log(`[upload] SerpApi responded with status: ${serpRes.status}`);
      res.json(serpRes.data);
    } catch (err) {
      console.error("[upload] failed:", err);
      res.status(500).json({ error: "Upload search failed" });
    }
  });

  // Image download proxy
  app.get("/api/download", async (req, res) => {
    const url = req.query.url as string;
    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "Missing url parameter" });
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      res.status(400).json({ error: "Invalid URL" });
      return;
    }
    try {
      const upstream = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Referer: "https://www.google.com/",
        },
        signal: AbortSignal.timeout(20000),
      });
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: "Upstream fetch failed" });
        return;
      }
      const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      const rawName = url.split("/").pop()?.split("?")[0] ?? "image";
      const ext = rawName.includes(".") ? "" : ".jpg";
      res.setHeader("Content-Disposition", `attachment; filename="${rawName}${ext}"`);
      const buffer = await upstream.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (err) {
      console.error("[download proxy]", err);
      res.status(500).json({ error: "Download failed" });
    }
  });

  // tRPC
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

  // Static files (production)
  // In dev: __dirname = server/, public is at ../dist/public
  // In prod (esbuild): __dirname = dist/server/, public is at ../public
  const publicDir = path.join(__dirname, "..", "public");
  app.use(express.static(publicDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) console.log(`Port ${preferredPort} is busy, using port ${port}`);

  server.listen(port, () => {
    console.log(`✅ Visua running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
