import cors from "cors";
import express from "express";
import type { Express } from "express";
import type { Server as SocketServer } from "socket.io";
import { createApiRouter } from "./routes/api";

export function createApp(io?: SocketServer) {
  return configureApp(express(), io);
}

export function configureApp(app: Express, io?: SocketServer) {
  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN ?? true
    })
  );
  app.use(express.json());
  app.use("/api", createApiRouter(io));

  return app;
}
