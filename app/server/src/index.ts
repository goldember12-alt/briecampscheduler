import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server } from "socket.io";
import { configureApp } from "./app";

const port = Number(process.env.PORT ?? 3001);
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN ?? "*"
  }
});

configureApp(app, io);
configureStaticFrontend(app);

io.on("connection", (socket) => {
  socket.emit("connected", { ok: true });
});

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Camp assignment API listening on http://localhost:${port}`);
  if (process.env.SERVE_STATIC === "true") {
    console.log(`Open this computer: http://localhost:${port}`);
    for (const url of networkUrls(port)) {
      console.log(`Counselor network URL: ${url}`);
    }
    console.log("Keep this window open while counselors are using the app.");
  }
});

function configureStaticFrontend(app: express.Express) {
  if (process.env.SERVE_STATIC !== "true") {
    return;
  }

  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const staticDir = resolve(projectRoot, "dist/client");
  const indexHtml = resolve(staticDir, "index.html");

  if (!existsSync(indexHtml)) {
    console.warn("Built frontend not found. Run npm run build before starting local production mode.");
    return;
  }

  app.use(express.static(staticDir));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api") || req.path.startsWith("/socket.io")) {
      next();
      return;
    }
    res.sendFile(indexHtml);
  });
}

function networkUrls(port: number) {
  const urls: string[] = [];
  for (const details of Object.values(networkInterfaces())) {
    for (const detail of details ?? []) {
      if (detail.family === "IPv4" && !detail.internal) {
        urls.push(`http://${detail.address}:${port}`);
      }
    }
  }
  return urls.length > 0 ? urls : [`http://<this-computer-ip>:${port}`];
}
