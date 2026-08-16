import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerStorageProxy } from "./_core/storageProxy";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";

export function createApiApp() {
  const app = express();
  app.use(express.json({ limit: "8mb" }));
  app.use(express.urlencoded({ limit: "8mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.use("/api/trpc", (req, res, next) => {
    const procedure = req.path.replace(/^\//, "");
    if (req.method === "GET" && (procedure === "store.catalogue.list" || procedure === "store.catalogue.getBySlug")) {
      // Public product data may be up to one minute old; admin and mutation paths remain uncached.
      res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    }
    next();
  });
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  return app;
}
