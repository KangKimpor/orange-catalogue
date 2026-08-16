// server/apiApp.ts
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { boolean, decimal, index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull(),
  label: varchar("label", { length: 128 }).notNull(),
  sortOrder: int("sortOrder").notNull(),
  isVisible: boolean("isVisible").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [uniqueIndex("categories_slug_unique").on(table.slug)]);
var colors = mysqlTable("colors", {
  id: int("id").autoincrement().primaryKey(),
  khmerName: varchar("khmerName", { length: 128 }),
  englishName: varchar("englishName", { length: 128 }).notNull(),
  hex: varchar("hex", { length: 16 }).notNull(),
  normalizedKey: varchar("normalizedKey", { length: 160 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [uniqueIndex("colors_normalized_key_unique").on(table.normalizedKey)]);
var products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 160 }).notNull(),
  cleanedCode: varchar("cleanedCode", { length: 255 }).notNull(),
  displayName: varchar("displayName", { length: 255 }),
  categoryId: int("categoryId").references(() => categories.id),
  categorySource: mysqlEnum("categorySource", ["rule", "manual", "unassigned"]).default("unassigned").notNull(),
  isPublished: boolean("isPublished").default(true).notNull(),
  isRemovedFromLatestImport: boolean("isRemovedFromLatestImport").default(false).notNull(),
  reviewStatus: mysqlEnum("reviewStatus", ["clean", "needs_review", "archived"]).default("clean").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [uniqueIndex("products_slug_unique").on(table.slug), uniqueIndex("products_cleaned_code_unique").on(table.cleanedCode), index("products_category_id_idx").on(table.categoryId)]);
var variants = mysqlTable("variants", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  colorId: int("colorId").references(() => colors.id, { onDelete: "set null" }),
  posCode: varchar("posCode", { length: 255 }).notNull(),
  size: varchar("size", { length: 64 }),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  stockQuantity: int("stockQuantity").notNull(),
  isVisible: boolean("isVisible").default(true).notNull(),
  lastSeenImportId: int("lastSeenImportId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [uniqueIndex("variants_pos_code_unique").on(table.posCode), index("variants_product_id_idx").on(table.productId), index("variants_color_id_idx").on(table.colorId)]);
var productMedia = mysqlTable("product_media", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  variantId: int("variantId").references(() => variants.id, { onDelete: "set null" }),
  cloudinaryPublicId: varchar("cloudinaryPublicId", { length: 500 }).notNull(),
  optimizedUrl: text("optimizedUrl").notNull(),
  altText: varchar("altText", { length: 255 }),
  colorTag: varchar("colorTag", { length: 128 }),
  sortOrder: int("sortOrder").default(0).notNull(),
  isPrimary: boolean("isPrimary").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [index("product_media_product_id_idx").on(table.productId), index("product_media_variant_id_idx").on(table.variantId), uniqueIndex("product_media_public_id_unique").on(table.cloudinaryPublicId)]);
var imports = mysqlTable("imports", {
  id: int("id").autoincrement().primaryKey(),
  originalFilename: varchar("originalFilename", { length: 255 }).notNull(),
  digest: varchar("digest", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["preview", "applied", "failed", "rolled_back"]).notNull(),
  parsedRows: int("parsedRows").default(0).notNull(),
  summaryJson: json("summaryJson"),
  validationJson: json("validationJson"),
  appliedAt: timestamp("appliedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var importChanges = mysqlTable("import_changes", {
  id: int("id").autoincrement().primaryKey(),
  importId: int("importId").notNull().references(() => imports.id, { onDelete: "cascade" }),
  productId: int("productId").references(() => products.id, { onDelete: "set null" }),
  variantId: int("variantId").references(() => variants.id, { onDelete: "set null" }),
  posCode: varchar("posCode", { length: 255 }),
  changeType: mysqlEnum("changeType", ["new_product", "new_variant", "stock_price_update", "missing_from_import", "needs_review"]).notNull(),
  beforeJson: json("beforeJson"),
  afterJson: json("afterJson"),
  reviewStatus: mysqlEnum("reviewStatus", ["pending", "accepted", "ignored"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [index("import_changes_import_id_idx").on(table.importId)]);
var storeSettings = mysqlTable("store_settings", {
  key: varchar("key", { length: 128 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = { openId: user.openId };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = /* @__PURE__ */ new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app) {
  app.get("/manus-storage/*key", async (req, res) => {
    const wildcard = req.params.key;
    const key = Array.isArray(wildcard) ? wildcard.join("/") : wildcard;
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/storeRouter.ts
import crypto3 from "node:crypto";
import { TRPCError as TRPCError4 } from "@trpc/server";
import { SignJWT as SignJWT2, jwtVerify as jwtVerify2 } from "jose";
import { parse as parseCookie } from "cookie";
import { z as z2 } from "zod";

// server/catalogRules.ts
var PUBLIC_CATEGORIES = [
  { slug: "just-in", label: "Just In" },
  { slug: "tops", label: "Tops" },
  { slug: "jeans", label: "Jeans" },
  { slug: "shorts", label: "Shorts" },
  { slug: "pants", label: "Pants" }
];
var COLOR_MAP = {
  "\u1791\u17B9\u1780\u1794\u17CA\u17B7\u1785": { english: "Ink Blue", hex: "#2C3E5C", key: "ink-blue" },
  "\u1791\u17B9\u1780\u1794\u17B7\u1785": { english: "Ink Blue", hex: "#2C3E5C", key: "ink-blue" },
  "\u178F\u17D2\u1793\u17C4\u178F": { english: "Brown", hex: "#6B4A30", key: "brown" },
  "\u1788\u17BC\u1780": { english: "Pink", hex: "#D98AA0", key: "pink" },
  "\u1795\u17D2\u1791\u17C3\u1798\u17C1\u1783": { english: "Sky Blue", hex: "#7FA6C4", key: "sky-blue" },
  "\u1794\u17D2\u179A\u1795\u17C1\u17C7": { english: "Grey", hex: "#8B8983", key: "grey" },
  "\u1781\u17D2\u1798\u17C5": { english: "Black", hex: "#1A1A1A", key: "black" },
  "\u179F\u17B6\u1785\u17CB": { english: "Nude", hex: "#D9B99B", key: "nude" },
  "\u178F\u17D2\u1793\u17C4\u178F\u178A\u17B7\u178F": { english: "Dark Brown", hex: "#4A3220", key: "dark-brown" },
  "\u179F": { english: "White", hex: "#F2EEE4", key: "white" },
  "\u179F\u179A": { english: "White", hex: "#F2EEE4", key: "white" },
  "\u1781\u17C0\u179C": { english: "Blue", hex: "#3A5A78", key: "blue" },
  "\u1782\u17D2\u179A\u17B8\u1798": { english: "Cream", hex: "#E8DFC8", key: "cream" },
  "\u1794\u17C3\u178F\u1784": { english: "Green", hex: "#5B7A4F", key: "green" },
  "\u179F\u17D2\u179C\u17B6\u1799": { english: "Purple", hex: "#6B5178", key: "purple" },
  "\u179B\u17BF\u1784": { english: "Yellow", hex: "#D4B441", key: "yellow" },
  "\u1791\u17B9\u1780\u179F\u178E\u17D2\u178F\u17C2\u1780": { english: "Tan", hex: "#B49868", key: "tan" },
  "\u1788\u17BC\u1780\u179F\u17D2\u179A\u17B6\u179B": { english: "Light Pink", hex: "#E8B9C8", key: "light-pink" },
  "\u1780\u17D2\u179A\u17A0\u1798": { english: "Red", hex: "#A13A2E", key: "red" },
  "\u1781\u17C0\u179C\u179F\u17D2\u179A\u17B6\u179B": { english: "Light Blue", hex: "#A9C2D6", key: "light-blue" },
  "\u1780\u17D2\u179A\u17A0\u1798\u178A\u17B7\u178F": { english: "Dark Red", hex: "#7A2A20", key: "dark-red" },
  "\u179F\u17D2\u179B\u17C2": { english: "Olive", hex: "#6B6B45", key: "olive" },
  "\u178F\u17D2\u1793\u17C4\u178F\u179F\u17D2\u179A\u17B6\u179B": { english: "Light Brown", hex: "#9C7A54", key: "light-brown" },
  "\u1794\u17D2\u179A\u1795\u17C1\u17C7\u1780\u17D2\u179A\u1798\u17C9\u17C5": { english: "Dark Grey", hex: "#5A5852", key: "dark-grey" },
  "\u1781\u17C0\u179C\u1780\u17D2\u179A\u1798\u17C9\u17C5": { english: "Denim Blue", hex: "#33475A", key: "denim-blue" },
  "One Color": { english: "One Color", hex: "#7A7A7A", key: "one-color" }
};
function cleanProductCode(value) {
  return value.normalize("NFC").replace(/[\u200B\u200C\u200D\uFEFF]/g, "").replace(/\s*\(?\s*បញ្ចុះ\s*\)?\s*/g, " ").replace(/\s+/g, " ").trim();
}
function makeSlug(value) {
  const normalized = cleanProductCode(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return normalized || "untitled-product";
}
function classifyProduct(cleanedCode) {
  const upper = cleanedCode.trim().toUpperCase();
  if (/^(ZS|ZL)\b/.test(upper)) return "tops";
  if (/^(SK|SJ|WJ|FJ)\b/.test(upper)) return "jeans";
  if (/^SP\b/.test(upper)) return "shorts";
  if (/^LP\b/.test(upper)) return "pants";
  return "just-in";
}
function normalizeAttribute(value) {
  return String(value ?? "").normalize("NFC").replace(/[\u200B\u200C\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim();
}
function parseAttributes(value) {
  const compact = normalizeAttribute(value);
  const tokens = compact.split("-").map((token) => token.trim()).filter(Boolean);
  const size = tokens.find((token) => /^(XS|S|M|L|XL|XXL|FREE|ONE SIZE)$/i.test(token)) ?? null;
  const colorKhmer = tokens.find((token) => Boolean(COLOR_MAP[token])) ?? null;
  const known = colorKhmer ? COLOR_MAP[colorKhmer] : void 0;
  return {
    colorKhmer,
    colorEnglish: known?.english ?? (compact || "One Color"),
    colorHex: known?.hex ?? "#9A9A94",
    colorKey: known?.key ?? `unknown-${compact.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "one-color"}`,
    size
  };
}
function buildMessengerOrderUrl(input) {
  const text2 = [
    "Hi Orange, I would like to order:",
    `Product code: ${input.productCode}`,
    `Color: ${input.color}`,
    input.size ? `Size: ${input.size}` : null
  ].filter(Boolean).join("\n");
  return `https://m.me/OfficiallyDavit?text=${encodeURIComponent(text2)}`;
}

// server/supabase.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
var supabaseUrl = process.env.VITE_SUPABASE_URL;
var serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
function assertSupabaseConfig() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "The Supabase server configuration is unavailable." });
  }
  return { url: supabaseUrl, serviceRoleKey };
}
async function supabaseRequest(path, init = {}) {
  const { url, serviceRoleKey: serviceRoleKey2 } = assertSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey2,
      Authorization: `Bearer ${serviceRoleKey2}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init.headers
    }
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: `Supabase request failed: ${detail}` });
  }
  if (response.status === 204) return void 0;
  return response.json();
}
function supabaseEq(column, value) {
  if (value === null) return `${column}=is.null`;
  return `${column}=eq.${encodeURIComponent(String(value))}`;
}

// server/catalogDb.ts
async function fetchCatalogueRows(includeHidden = false) {
  const [categoryRows, productRows, variantRows, mediaRows, colorRows] = await Promise.all([
    supabaseRequest("categories?select=*&order=sort_order.asc"),
    supabaseRequest(`products?select=*${includeHidden ? "" : "&is_published=eq.true"}`),
    supabaseRequest("variants?select=*&is_visible=eq.true"),
    supabaseRequest("product_media?select=*&order=sort_order.asc"),
    supabaseRequest("colors?select=*&order=sort_order.asc")
  ]);
  return {
    categoryRows: categoryRows.map((row) => ({ id: row.id, slug: row.slug, label: row.label, sortOrder: row.sort_order, isVisible: row.is_visible })),
    productRows: productRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      cleanedCode: row.cleaned_code,
      displayName: row.display_name,
      categoryId: row.category_id,
      categorySource: row.category_source,
      isPublished: row.is_published,
      isRemovedFromLatestImport: row.is_removed_from_latest_import,
      reviewStatus: row.review_status
    })),
    variantRows: variantRows.map((row) => ({
      id: row.id,
      productId: row.product_id,
      colorId: row.color_id,
      posCode: row.pos_code,
      size: row.size,
      price: row.price,
      stockQuantity: row.stock_quantity,
      isVisible: row.is_visible,
      lastSeenImportId: row.last_seen_import_id
    })),
    mediaRows: mediaRows.map((row) => ({
      id: row.id,
      productId: row.product_id,
      variantId: row.variant_id,
      cloudinaryPublicId: row.cloudinary_public_id,
      optimizedUrl: row.optimized_url,
      altText: row.alt_text,
      colorTag: row.color_tag,
      sortOrder: row.sort_order,
      isPrimary: row.is_primary
    })),
    colorRows: colorRows.map((row) => ({
      id: row.id,
      khmerName: row.khmer_name,
      englishName: row.english_name,
      hex: row.hex,
      normalizedKey: row.normalized_key,
      sortOrder: row.sort_order
    }))
  };
}

// server/posImport.ts
import crypto from "node:crypto";
import * as XLSX from "xlsx";
var REQUIRED_COLUMNS = ["Code", "Name", "Price", "Stock Qty."];
var MAX_POS_IMPORT_BYTES = 5 * 1024 * 1024;
var MAX_POS_IMPORT_BASE64_LENGTH = Math.ceil(MAX_POS_IMPORT_BYTES * 4 / 3) + 4;
var MAX_POS_IMPORT_SHEETS = 3;
var MAX_POS_IMPORT_ROWS = 5e3;
function valueAsString(value) {
  if (value === void 0 || value === null) return "";
  return String(value).trim();
}
function asNumber(value) {
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}
function parsePosWorkbook(buffer) {
  if (!buffer.length) throw new Error("The POS workbook is empty.");
  if (buffer.length > MAX_POS_IMPORT_BYTES) throw new Error("The POS workbook exceeds the 5 MB upload limit.");
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  if (!workbook.SheetNames.length) throw new Error("The workbook does not contain a worksheet.");
  if (workbook.SheetNames.length > MAX_POS_IMPORT_SHEETS) throw new Error(`The POS workbook cannot contain more than ${MAX_POS_IMPORT_SHEETS} worksheets.`);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("The workbook does not contain a worksheet.");
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (rawRows.length > MAX_POS_IMPORT_ROWS) throw new Error(`The POS workbook cannot contain more than ${MAX_POS_IMPORT_ROWS} rows.`);
  const headerIndex = rawRows.findIndex((row) => {
    const cells = Array.isArray(row) ? row.map(valueAsString) : [];
    return REQUIRED_COLUMNS.every((column) => cells.includes(column));
  });
  if (headerIndex === -1) {
    throw new Error("The POS workbook must contain Code, Name, Price, and Stock Qty. columns.");
  }
  const rows = XLSX.utils.sheet_to_json(sheet, {
    range: headerIndex,
    defval: "",
    raw: false
  });
  const invalidRows = [];
  const items = [];
  let missingNameRows = 0;
  rows.forEach((row, index2) => {
    const posCode = valueAsString(row.Code);
    const sourceName = valueAsString(row.Name);
    const price = asNumber(row.Price);
    const stockQuantity = asNumber(row["Stock Qty."]);
    const sourceRow = headerIndex + index2 + 2;
    if (!posCode && !sourceName) return;
    if (!sourceName) {
      missingNameRows += 1;
      invalidRows.push({ row: sourceRow, reason: "Missing product Name." });
      return;
    }
    if (!posCode) {
      invalidRows.push({ row: sourceRow, reason: "Missing immutable POS Code." });
      return;
    }
    if (price === null || stockQuantity === null) {
      invalidRows.push({ row: sourceRow, reason: "Price or Stock Qty. is not numeric." });
      return;
    }
    const cleanedCode = cleanProductCode(sourceName);
    const attributes = parseAttributes(row.Attributes);
    items.push({
      posCode,
      cleanedCode,
      slug: makeSlug(cleanedCode),
      categorySlug: classifyProduct(cleanedCode),
      colorKhmer: attributes.colorKhmer,
      colorEnglish: attributes.colorEnglish,
      colorHex: attributes.colorHex,
      colorKey: attributes.colorKey,
      size: attributes.size,
      price,
      stockQuantity: Math.trunc(stockQuantity)
    });
  });
  const seen = /* @__PURE__ */ new Set();
  const duplicatePosCodes = /* @__PURE__ */ new Set();
  for (const item of items) {
    if (seen.has(item.posCode)) duplicatePosCodes.add(item.posCode);
    seen.add(item.posCode);
  }
  return {
    digest: crypto.createHash("sha256").update(buffer).digest("hex"),
    items,
    validation: {
      headerRow: headerIndex + 1,
      duplicatePosCodes: Array.from(duplicatePosCodes),
      invalidRows,
      missingNameRows
    }
  };
}

// server/loginRateLimit.ts
import crypto2 from "node:crypto";
function headerValue(value) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
function adminLoginClientKey(headers) {
  const forwarded = headerValue(headers["x-forwarded-for"]).split(",")[0]?.trim();
  const rawClientIdentifier = forwarded || headerValue(headers["x-real-ip"]).trim() || "unknown-client";
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("The secure session key is unavailable.");
  return crypto2.createHmac("sha256", secret).update(`orange-admin-login:${rawClientIdentifier}`).digest("hex");
}
async function checkAdminLoginRateLimit(clientKey, result) {
  return supabaseRequest("rpc/check_admin_login_rate_limit", {
    method: "POST",
    body: JSON.stringify({ p_client_key: clientKey, p_result: result })
  });
}

// server/storeRouter.ts
var ADMIN_COOKIE = "orange_admin_session";
var ADMIN_PASSWORD_KEY = "admin_password_hash";
var DAY_SECONDS = 60 * 60 * 12;
function tokenKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "The secure session key is unavailable." });
  return new TextEncoder().encode(secret);
}
function hashPassword(password) {
  const salt = crypto3.randomBytes(16).toString("hex");
  return `${salt}:${crypto3.scryptSync(password, salt, 64).toString("hex")}`;
}
function passwordMatches(password, encoded) {
  const [salt, expected] = encoded.split(":");
  if (!salt || !expected) return false;
  const actual = crypto3.scryptSync(password, salt, 64).toString("hex");
  return actual.length === expected.length && crypto3.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
function safeTextEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto3.timingSafeEqual(a, b);
}
async function readStoredPasswordHash() {
  const rows = await supabaseRequest(`store_settings?select=value&key=eq.${ADMIN_PASSWORD_KEY}&limit=1`);
  return rows[0]?.value ?? null;
}
async function savePasswordHash(value) {
  await supabaseRequest("store_settings?on_conflict=key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ key: ADMIN_PASSWORD_KEY, value }) });
}
async function issueAdminSession(ctx) {
  const token = await new SignJWT2({ role: "store_admin" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${DAY_SECONDS}s`).sign(tokenKey());
  ctx.res.cookie(ADMIN_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: DAY_SECONDS * 1e3 });
}
async function hasAdminSession(ctx) {
  const token = parseCookie(ctx.req.headers.cookie ?? "")[ADMIN_COOKIE];
  if (!token) return false;
  try {
    return (await jwtVerify2(token, tokenKey())).payload.role === "store_admin";
  } catch {
    return false;
  }
}
async function requireAdmin(ctx) {
  if (!await hasAdminSession(ctx)) throw new TRPCError4({ code: "UNAUTHORIZED", message: "Admin access is required." });
}
var publicAvailability = (quantity) => quantity > 0;
async function cataloguePayload(includeExactStock = false, includeHidden = false) {
  const { categoryRows, productRows, variantRows, mediaRows, colorRows } = await fetchCatalogueRows(includeHidden);
  const categoriesById = new Map(categoryRows.map((row) => [row.id, row]));
  const colorsById = new Map(colorRows.map((row) => [row.id, row]));
  const mediaByProduct = /* @__PURE__ */ new Map();
  const variantsByProduct = /* @__PURE__ */ new Map();
  for (const row of mediaRows) mediaByProduct.set(row.productId, [...mediaByProduct.get(row.productId) ?? [], row]);
  for (const row of variantRows) variantsByProduct.set(row.productId, [...variantsByProduct.get(row.productId) ?? [], row]);
  return {
    categories: categoryRows.filter((row) => row.isVisible),
    products: productRows.map((product) => {
      const grouped = /* @__PURE__ */ new Map();
      for (const variant of variantsByProduct.get(product.id) ?? []) grouped.set(variant.colorId, [...grouped.get(variant.colorId) ?? [], variant]);
      const colors2 = Array.from(grouped.entries()).map(([colorId, variants3]) => {
        const color = colorId ? colorsById.get(colorId) : void 0;
        return { id: colorId, khmerName: color?.khmerName ?? null, englishName: color?.englishName ?? "One Color", hex: color?.hex ?? "#9A9A94", available: variants3.some((v) => publicAvailability(v.stockQuantity)), variants: variants3.map((v) => ({ id: v.id, posCode: v.posCode, size: v.size, price: Number(v.price), available: publicAvailability(v.stockQuantity), ...includeExactStock ? { stockQuantity: v.stockQuantity } : {} })) };
      });
      const variants2 = variantsByProduct.get(product.id) ?? [];
      const category = product.categoryId ? categoriesById.get(product.categoryId) : void 0;
      return { id: product.id, slug: product.slug, displayName: product.displayName, cleanedCode: product.cleanedCode, category: category ? { slug: category.slug, label: category.label } : { slug: "just-in", label: "Just In" }, isPublished: product.isPublished, isRemovedFromLatestImport: product.isRemovedFromLatestImport, reviewStatus: product.reviewStatus, available: variants2.some((v) => publicAvailability(v.stockQuantity)), priceMin: variants2.length ? Math.min(...variants2.map((v) => Number(v.price))) : 0, priceMax: variants2.length ? Math.max(...variants2.map((v) => Number(v.price))) : 0, colors: colors2, media: (mediaByProduct.get(product.id) ?? []).map((media) => ({ id: media.id, url: media.optimizedUrl, altText: media.altText, isPrimary: media.isPrimary, variantId: media.variantId, colorTag: media.colorTag })) };
    })
  };
}
var importInput = z2.object({ filename: z2.string().min(1).max(255), base64: z2.string().min(16).max(MAX_POS_IMPORT_BASE64_LENGTH).regex(/^[A-Za-z0-9+/]+={0,2}$/, "The POS workbook payload is not valid base64.") });
async function createPreview(input) {
  const parsed = parsePosWorkbook(Buffer.from(input.base64, "base64"));
  if (parsed.validation.duplicatePosCodes.length) throw new TRPCError4({ code: "BAD_REQUEST", message: "The import contains duplicate immutable POS Codes." });
  const [existingVariants, existingProducts] = await Promise.all([supabaseRequest("variants?select=id,product_id,color_id,pos_code,size,price,stock_quantity"), supabaseRequest("products?select=id,cleaned_code,slug,category_source")]);
  const variantsByCode = new Map(existingVariants.map((row) => [row.pos_code, row]));
  const productsByCode = new Set(existingProducts.map((row) => row.cleaned_code));
  const previewed = /* @__PURE__ */ new Set();
  const incoming = new Set(parsed.items.map((item) => item.posCode));
  const changes = parsed.items.map((item) => {
    const current = variantsByCode.get(item.posCode);
    if (!current) {
      const newProduct = !productsByCode.has(item.cleanedCode) && !previewed.has(item.cleanedCode);
      if (newProduct) previewed.add(item.cleanedCode);
      return { type: newProduct ? "new_product" : "new_variant", posCode: item.posCode, code: item.cleanedCode, price: item.price, stock: item.stockQuantity };
    }
    const priceChanged = Number(current.price) !== item.price;
    const stockChanged = current.stock_quantity !== item.stockQuantity;
    return priceChanged || stockChanged ? { type: "updated", posCode: item.posCode, code: item.cleanedCode, priceChanged, stockChanged, price: item.price, stock: item.stockQuantity } : null;
  }).filter(Boolean);
  const missing = existingVariants.filter((row) => !incoming.has(row.pos_code)).map((row) => ({ type: "missing", posCode: row.pos_code }));
  const summary = { rows: parsed.items.length, newProducts: changes.filter((change) => change?.type === "new_product").length, newVariants: changes.filter((change) => change?.type === "new_variant").length, updatedVariants: changes.filter((change) => change?.type === "updated").length, missingVariants: missing.length, invalidRows: parsed.validation.invalidRows.length };
  const [importRow] = await supabaseRequest("imports", { method: "POST", body: JSON.stringify({ original_filename: input.filename, digest: parsed.digest, status: "preview", parsed_rows: parsed.items.length, summary_json: summary, validation_json: parsed.validation }) });
  const reviewRows = [...changes.filter(Boolean).map((change) => ({ import_id: importRow.id, pos_code: change.posCode, change_type: change.type === "updated" ? "stock_price_update" : change.type, after_json: change })), ...missing.map((change) => ({ import_id: importRow.id, pos_code: change.posCode, change_type: "missing_from_import", after_json: change }))];
  if (reviewRows.length) await supabaseRequest("import_changes", { method: "POST", body: JSON.stringify(reviewRows) });
  return { importId: importRow.id, summary, validation: parsed.validation, changes: [...changes.slice(0, 40), ...missing.slice(0, 40)] };
}
async function applyImport(input) {
  const parsed = parsePosWorkbook(Buffer.from(input.base64, "base64"));
  if (parsed.validation.invalidRows.length || parsed.validation.duplicatePosCodes.length) throw new TRPCError4({ code: "BAD_REQUEST", message: "Resolve invalid or duplicate POS rows before applying the import." });
  const imports2 = await supabaseRequest(`imports?select=id,status,digest&id=eq.${input.importId}&limit=1`);
  const importRow = imports2[0];
  if (!importRow || importRow.status !== "preview") throw new TRPCError4({ code: "NOT_FOUND", message: "The requested import preview is unavailable." });
  if (importRow.digest !== parsed.digest) throw new TRPCError4({ code: "BAD_REQUEST", message: "The file differs from the saved import preview. Create a new preview." });
  const [categoryRows, productRows, variantRows, colorRows] = await Promise.all([supabaseRequest("categories?select=id,slug"), supabaseRequest("products?select=id,cleaned_code,slug,category_source"), supabaseRequest("variants?select=id,product_id,color_id,pos_code,size,price,stock_quantity"), supabaseRequest("colors?select=id,normalized_key")]);
  const categories2 = new Map(categoryRows.map((row) => [row.slug, row]));
  const products2 = new Map(productRows.map((row) => [row.cleaned_code, row]));
  const variants2 = new Map(variantRows.map((row) => [row.pos_code, row]));
  const colors2 = new Map(colorRows.map((row) => [row.normalized_key, row]));
  const usedSlugs = new Set(productRows.map((row) => row.slug));
  const incoming = new Set(parsed.items.map((item) => item.posCode));
  let newProducts = 0;
  let newVariants = 0;
  let updatedVariants = 0;
  for (const item of parsed.items) {
    const category = categories2.get(item.categorySlug) ?? categories2.get("just-in");
    let product = products2.get(item.cleanedCode);
    if (!product) {
      let slug = item.slug;
      if (usedSlugs.has(slug)) slug = `${slug}-${crypto3.createHash("sha1").update(item.cleanedCode).digest("hex").slice(0, 6)}`;
      [product] = await supabaseRequest("products", { method: "POST", body: JSON.stringify({ slug, cleaned_code: item.cleanedCode, category_id: category?.id ?? null, category_source: item.categorySlug === "just-in" ? "unassigned" : "rule", review_status: item.categorySlug === "just-in" ? "needs_review" : "clean" }) });
      products2.set(item.cleanedCode, product);
      usedSlugs.add(slug);
      newProducts += 1;
    } else if (product.category_source !== "manual") await supabaseRequest(`products?${supabaseEq("id", product.id)}`, { method: "PATCH", body: JSON.stringify({ category_id: category?.id ?? null, category_source: item.categorySlug === "just-in" ? "unassigned" : "rule", review_status: item.categorySlug === "just-in" ? "needs_review" : "clean", is_removed_from_latest_import: false }) });
    let color = colors2.get(item.colorKey);
    if (!color) {
      [color] = await supabaseRequest("colors", { method: "POST", body: JSON.stringify({ khmer_name: item.colorKhmer, english_name: item.colorEnglish, hex: item.colorHex, normalized_key: item.colorKey }) });
      colors2.set(item.colorKey, color);
    }
    const current = variants2.get(item.posCode);
    const values = { product_id: product.id, color_id: color.id, size: item.size, price: item.price.toFixed(2), stock_quantity: item.stockQuantity, last_seen_import_id: input.importId, is_visible: true };
    if (current) {
      if (Number(current.price) !== item.price || current.stock_quantity !== item.stockQuantity || current.color_id !== color.id || current.size !== item.size) updatedVariants += 1;
      await supabaseRequest(`variants?${supabaseEq("id", current.id)}`, { method: "PATCH", body: JSON.stringify(values) });
    } else {
      await supabaseRequest("variants", { method: "POST", body: JSON.stringify({ ...values, pos_code: item.posCode }) });
      newVariants += 1;
    }
  }
  const missing = variantRows.filter((row) => !incoming.has(row.pos_code));
  const productIds = Array.from(new Set(missing.map((row) => row.product_id)));
  if (productIds.length) await supabaseRequest(`products?id=in.(${productIds.join(",")})`, { method: "PATCH", body: JSON.stringify({ is_removed_from_latest_import: true, review_status: "needs_review" }) });
  await supabaseRequest(`imports?${supabaseEq("id", input.importId)}`, { method: "PATCH", body: JSON.stringify({ status: "applied", applied_at: (/* @__PURE__ */ new Date()).toISOString(), summary_json: { newProducts, newVariants, updatedVariants, missingVariants: missing.length } }) });
  return { newProducts, newVariants, updatedVariants, missingVariants: missing.length };
}
var storeRouter = router({
  catalogue: router({ list: publicProcedure.query(() => cataloguePayload(false)), getBySlug: publicProcedure.input(z2.object({ slug: z2.string().min(1) })).query(async ({ input }) => {
    const product = (await cataloguePayload(false)).products.find((row) => row.slug === input.slug);
    if (!product) throw new TRPCError4({ code: "NOT_FOUND", message: "Product not found." });
    return product;
  }), categories: publicProcedure.query(() => PUBLIC_CATEGORIES), messengerUrl: publicProcedure.input(z2.object({ productCode: z2.string(), color: z2.string(), size: z2.string().nullable().optional() })).query(({ input }) => buildMessengerOrderUrl(input)) }),
  admin: router({
    session: publicProcedure.query(({ ctx }) => hasAdminSession(ctx)),
    login: publicProcedure.input(z2.object({ password: z2.string().min(1).max(1024) })).mutation(async ({ ctx, input }) => {
      const clientKey = adminLoginClientKey(ctx.req.headers);
      const preflight = await checkAdminLoginRateLimit(clientKey, "check");
      if (!preflight.allowed) throw new TRPCError4({ code: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts. Please try again later." });
      const stored = await readStoredPasswordHash();
      const initial = process.env.ADMIN_PASSWORD;
      const valid = stored ? passwordMatches(input.password, stored) : Boolean(initial && safeTextEqual(input.password, initial));
      const result = await checkAdminLoginRateLimit(clientKey, valid ? "success" : "failure");
      if (!valid) {
        if (!result.allowed) throw new TRPCError4({ code: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts. Please try again later." });
        throw new TRPCError4({ code: "UNAUTHORIZED", message: "Unable to sign in with those credentials." });
      }
      if (!result.allowed) throw new TRPCError4({ code: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts. Please try again later." });
      if (!stored) await savePasswordHash(hashPassword(input.password));
      await issueAdminSession(ctx);
      return { success: true };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(ADMIN_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
      return { success: true };
    }),
    changePassword: publicProcedure.input(z2.object({ currentPassword: z2.string().min(1), newPassword: z2.string().min(8) })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const stored = await readStoredPasswordHash();
      const valid = stored ? passwordMatches(input.currentPassword, stored) : input.currentPassword === process.env.ADMIN_PASSWORD;
      if (!valid) throw new TRPCError4({ code: "UNAUTHORIZED", message: "Current password is incorrect." });
      await savePasswordHash(hashPassword(input.newPassword));
      await issueAdminSession(ctx);
      return { success: true };
    }),
    overview: publicProcedure.query(async ({ ctx }) => {
      await requireAdmin(ctx);
      return cataloguePayload(true, true);
    }),
    updateProduct: publicProcedure.input(z2.object({ id: z2.number().int(), displayName: z2.string().max(255).nullable(), categoryId: z2.number().int().nullable(), isPublished: z2.boolean().optional(), reviewStatus: z2.enum(["clean", "needs_review", "archived"]).optional() })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      await supabaseRequest(`products?${supabaseEq("id", input.id)}`, { method: "PATCH", body: JSON.stringify({ display_name: input.displayName, category_id: input.categoryId, category_source: input.categoryId ? "manual" : "unassigned", ...input.isPublished === void 0 ? {} : { is_published: input.isPublished }, ...input.reviewStatus === void 0 ? {} : { review_status: input.reviewStatus } }) });
      return { success: true };
    }),
    previewImport: publicProcedure.input(importInput).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      return createPreview(input);
    }),
    applyImport: publicProcedure.input(importInput.extend({ importId: z2.number().int() })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      return applyImport(input);
    }),
    importHistory: publicProcedure.query(async ({ ctx }) => {
      await requireAdmin(ctx);
      const rows = await supabaseRequest("imports?select=id,original_filename,status,created_at&order=created_at.asc");
      return rows.map((row) => ({ id: row.id, originalFilename: row.original_filename, status: row.status, createdAt: row.created_at }));
    }),
    reviewQueue: publicProcedure.query(async ({ ctx }) => {
      await requireAdmin(ctx);
      const rows = await supabaseRequest("import_changes?select=id,pos_code,change_type,review_status&change_type=in.(stock_price_update,missing_from_import,needs_review)&limit=200");
      return rows.map((row) => ({ id: row.id, posCode: row.pos_code, changeType: row.change_type, reviewStatus: row.review_status }));
    }),
    resolveImportChange: publicProcedure.input(z2.object({ id: z2.number().int(), reviewStatus: z2.enum(["accepted", "ignored"]) })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      await supabaseRequest(`import_changes?${supabaseEq("id", input.id)}`, { method: "PATCH", body: JSON.stringify({ review_status: input.reviewStatus }) });
      return { success: true };
    }),
    signMediaUpload: publicProcedure.input(z2.object({ productCode: z2.string().min(1), categorySlug: z2.string().min(1), colorTag: z2.string().min(1) })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;
      if (!cloudName || !apiKey || !apiSecret) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Cloudinary media configuration is incomplete." });
      const normalized = input.productCode.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const timestamp2 = Math.floor(Date.now() / 1e3);
      const folder = `orange/products/${normalized}`;
      const tags = `orange,product:${normalized},category:${input.categorySlug},color:${input.colorTag}`;
      const signature = crypto3.createHash("sha1").update(`folder=${folder}&tags=${tags}&timestamp=${timestamp2}${apiSecret}`).digest("hex");
      return { uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, apiKey, timestamp: timestamp2, folder, tags, signature };
    }),
    registerMedia: publicProcedure.input(z2.object({ productId: z2.number().int(), variantId: z2.number().int().nullable().optional(), publicId: z2.string().min(1), secureUrl: z2.string().url(), altText: z2.string().max(255).nullable().optional(), colorTag: z2.string().max(128).nullable().optional(), isPrimary: z2.boolean().default(false) })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      if (!input.publicId.startsWith("orange/products/")) throw new TRPCError4({ code: "BAD_REQUEST", message: "The uploaded media is not in an approved Orange product folder." });
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      if (input.isPrimary) await supabaseRequest(`product_media?${supabaseEq("product_id", input.productId)}`, { method: "PATCH", body: JSON.stringify({ is_primary: false }) });
      await supabaseRequest("product_media", { method: "POST", body: JSON.stringify({ product_id: input.productId, variant_id: input.variantId ?? null, cloudinary_public_id: input.publicId, optimized_url: `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/${input.publicId}`, alt_text: input.altText ?? null, color_tag: input.colorTag ?? null, is_primary: input.isPrimary }) });
      return { success: true };
    })
  })
});

// server/routers.ts
var appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  }),
  store: storeRouter
  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/apiApp.ts
function createApiApp() {
  const app = express();
  app.use(express.json({ limit: "8mb" }));
  app.use(express.urlencoded({ limit: "8mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  return app;
}

// server/vercelEntry.ts
var vercelEntry_default = createApiApp();
export {
  vercelEntry_default as default
};
