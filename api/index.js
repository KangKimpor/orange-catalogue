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
  isJustIn: boolean("isJustIn").default(false).notNull(),
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
import crypto4 from "node:crypto";
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
  return null;
}
function normalizeAttribute(value) {
  return String(value ?? "").normalize("NFC").replace(/[\u200B\u200C\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim();
}
function parseAttributes(value) {
  const compact = normalizeAttribute(value);
  const tokens = compact.split("-").map((token) => token.trim()).filter(Boolean);
  const size = tokens.find((token) => /^(XS|S|M|L|XL|XXL|FREE|ONE SIZE)$/i.test(token)) ?? null;
  const colorKhmer = tokens.find((token) => token !== size) ?? null;
  const known = colorKhmer ? COLOR_MAP[colorKhmer] : void 0;
  const unicodeKey = colorKhmer ? Array.from(colorKhmer.normalize("NFC")).map((character) => character.codePointAt(0)?.toString(16)).join("-") : "one-color";
  return {
    colorKhmer,
    colorEnglish: known?.english ?? (colorKhmer || "One Color"),
    colorHex: known?.hex ?? "#9A9A94",
    colorKey: known?.key ?? `attribute-${unicodeKey}`,
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
    supabaseRequest(`products?select=*${includeHidden ? "" : "&is_published=eq.true&lifecycle_status=neq.discontinued"}`),
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
      isJustIn: row.is_just_in,
      isPublished: row.is_published,
      lifecycleStatus: row.lifecycle_status,
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
function categoryMap(rows) {
  return new Map(rows.map((row) => [row.id, { slug: row.slug, label: row.label, visible: row.is_visible }]));
}
function colorMap(rows) {
  return new Map(rows.map((row) => [row.id, { id: row.id, khmerName: row.khmer_name, englishName: row.english_name, hex: row.hex }]));
}
function groupByProduct(rows) {
  const grouped = /* @__PURE__ */ new Map();
  for (const row of rows) grouped.set(row.product_id, [...grouped.get(row.product_id) ?? [], row]);
  return grouped;
}
function cardColors(variants2, colorsById, lifecycleStatus) {
  const grouped = /* @__PURE__ */ new Map();
  for (const variant of variants2) grouped.set(variant.color_id, [...grouped.get(variant.color_id) ?? [], variant]);
  return Array.from(grouped.entries()).map(([colorId, groupedVariants]) => {
    const color = colorId ? colorsById.get(colorId) : void 0;
    return {
      id: colorId,
      englishName: color?.englishName ?? "One Color",
      hex: color?.hex ?? "#9A9A94",
      available: lifecycleStatus === "active" && groupedVariants.some((variant) => variant.stock_quantity > 0)
    };
  });
}
function cardProduct(product, variants2, primaryMedia, categoriesById, colorsById) {
  const category = product.category_id ? categoriesById.get(product.category_id) : void 0;
  const prices = variants2.map((variant) => Number(variant.price));
  return {
    id: product.id,
    slug: product.slug,
    displayName: product.display_name,
    cleanedCode: product.cleaned_code,
    category: category ? { slug: category.slug, label: category.label } : { slug: "unassigned", label: "Not in storefront" },
    isJustIn: product.is_just_in,
    isPublished: product.is_published,
    lifecycleStatus: product.lifecycle_status,
    isRemovedFromLatestImport: product.is_removed_from_latest_import,
    reviewStatus: product.review_status,
    available: product.lifecycle_status === "active" && variants2.some((variant) => variant.stock_quantity > 0),
    priceMin: prices.length ? Math.min(...prices) : 0,
    priceMax: prices.length ? Math.max(...prices) : 0,
    colors: cardColors(variants2, colorsById, product.lifecycle_status),
    media: primaryMedia ? [{ id: primaryMedia.id, url: primaryMedia.optimized_url, altText: primaryMedia.alt_text, isPrimary: primaryMedia.is_primary }] : []
  };
}
async function fetchStorefrontCards() {
  const [categoryRows, productRows, variantRows, mediaRows, colorRows] = await Promise.all([
    supabaseRequest("categories?select=id,slug,label,sort_order,is_visible&order=sort_order.asc"),
    supabaseRequest("products?select=id,slug,cleaned_code,display_name,category_id,category_source,is_just_in,is_published,lifecycle_status,is_removed_from_latest_import,review_status&is_published=eq.true&lifecycle_status=neq.discontinued"),
    supabaseRequest("variants?select=id,product_id,color_id,pos_code,size,price,stock_quantity,is_visible,last_seen_import_id&is_visible=eq.true"),
    supabaseRequest("product_media?select=id,product_id,variant_id,cloudinary_public_id,optimized_url,alt_text,color_tag,sort_order,is_primary&is_primary=eq.true&order=sort_order.asc"),
    supabaseRequest("colors?select=id,khmer_name,english_name,hex,normalized_key,sort_order&order=sort_order.asc")
  ]);
  const categoriesById = categoryMap(categoryRows);
  const colorsById = colorMap(colorRows);
  const variantsByProduct = groupByProduct(variantRows);
  const primaryMediaByProduct = new Map(mediaRows.map((media) => [media.product_id, media]));
  return {
    categories: categoryRows.filter((category) => category.is_visible).map((category) => ({ slug: category.slug, label: category.label })),
    products: productRows.filter((product) => Boolean(product.category_id && categoriesById.has(product.category_id))).map((product) => cardProduct(product, variantsByProduct.get(product.id) ?? [], primaryMediaByProduct.get(product.id), categoriesById, colorsById))
  };
}
async function fetchStorefrontProduct(slug) {
  const productRows = await supabaseRequest(`products?select=id,slug,cleaned_code,display_name,category_id,category_source,is_just_in,is_published,lifecycle_status,is_removed_from_latest_import,review_status&slug=eq.${encodeURIComponent(slug)}&is_published=eq.true&lifecycle_status=neq.discontinued&limit=1`);
  const product = productRows[0];
  if (!product) return null;
  const [categoryRows, variantRows, mediaRows] = await Promise.all([
    product.category_id ? supabaseRequest(`categories?select=id,slug,label,sort_order,is_visible&id=eq.${product.category_id}&limit=1`) : Promise.resolve([]),
    supabaseRequest(`variants?select=id,product_id,color_id,pos_code,size,price,stock_quantity,is_visible,last_seen_import_id&product_id=eq.${product.id}&is_visible=eq.true`),
    supabaseRequest(`product_media?select=id,product_id,variant_id,cloudinary_public_id,optimized_url,alt_text,color_tag,sort_order,is_primary&product_id=eq.${product.id}&order=sort_order.asc`)
  ]);
  const colorIds = Array.from(new Set(variantRows.map((variant) => variant.color_id).filter((id) => id !== null)));
  const colorRows = colorIds.length ? await supabaseRequest(`colors?select=id,khmer_name,english_name,hex,normalized_key,sort_order&id=in.(${colorIds.join(",")})&order=sort_order.asc`) : [];
  const categoriesById = categoryMap(categoryRows);
  const colorsById = colorMap(colorRows);
  const category = product.category_id && categoriesById.get(product.category_id) ? { slug: categoriesById.get(product.category_id).slug, label: categoriesById.get(product.category_id).label } : { slug: "unassigned", label: "Not in storefront" };
  const grouped = /* @__PURE__ */ new Map();
  for (const variant of variantRows) grouped.set(variant.color_id, [...grouped.get(variant.color_id) ?? [], variant]);
  const colors2 = Array.from(grouped.entries()).map(([colorId, variants2]) => {
    const color = colorId ? colorsById.get(colorId) : void 0;
    return {
      id: colorId,
      khmerName: color?.khmerName ?? null,
      englishName: color?.englishName ?? "One Color",
      hex: color?.hex ?? "#9A9A94",
      available: product.lifecycle_status === "active" && variants2.some((variant) => variant.stock_quantity > 0),
      variants: variants2.map((variant) => ({ id: variant.id, posCode: variant.pos_code, size: variant.size, price: Number(variant.price), available: product.lifecycle_status === "active" && variant.stock_quantity > 0 }))
    };
  });
  return {
    id: product.id,
    slug: product.slug,
    displayName: product.display_name,
    cleanedCode: product.cleaned_code,
    category,
    isJustIn: product.is_just_in,
    isPublished: product.is_published,
    lifecycleStatus: product.lifecycle_status,
    isRemovedFromLatestImport: product.is_removed_from_latest_import,
    reviewStatus: product.review_status,
    available: product.lifecycle_status === "active" && variantRows.some((variant) => variant.stock_quantity > 0),
    priceMin: variantRows.length ? Math.min(...variantRows.map((variant) => Number(variant.price))) : 0,
    priceMax: variantRows.length ? Math.max(...variantRows.map((variant) => Number(variant.price))) : 0,
    colors: colors2,
    media: mediaRows.map((media) => ({ id: media.id, url: media.optimized_url, altText: media.alt_text, isPrimary: media.is_primary, variantId: media.variant_id, colorTag: media.color_tag }))
  };
}

// server/posImport.ts
import crypto from "node:crypto";
import * as XLSX from "xlsx";
var REQUIRED_COLUMNS = ["Code", "Name", "Attributes", "Price", "Stock Qty."];
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
function extractExportDate(rawRows) {
  for (const row of rawRows) {
    for (const cell of Array.isArray(row) ? row : []) {
      const match = valueAsString(cell).match(/^export\s*date\s*:\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/i);
      if (!match) continue;
      const [, day, month, year] = match;
      const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
      if (parsed.getUTCFullYear() !== Number(year) || parsed.getUTCMonth() !== Number(month) - 1 || parsed.getUTCDate() !== Number(day)) continue;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  }
  return null;
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
  const exportDate = extractExportDate(rawRows);
  let missingNameRows = 0;
  rows.forEach((row, index2) => {
    const posCode = valueAsString(row.Code);
    const sourceName = valueAsString(row.Name);
    const rawAttribute = valueAsString(row.Attributes);
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
    const attributes = parseAttributes(rawAttribute);
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
      stockQuantity: Math.trunc(stockQuantity),
      rawName: sourceName,
      rawAttribute
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
    exportDate,
    productCount: new Set(items.map((item) => item.cleanedCode)).size,
    items,
    validation: {
      headerRow: headerIndex + 1,
      requiredColumns: REQUIRED_COLUMNS,
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

// server/cloudinaryMedia.ts
import crypto3 from "node:crypto";
function assertOrangeProductPublicId(publicId) {
  if (!publicId.startsWith("orange/products/")) {
    throw new Error("The media asset is outside the approved Orange product folder.");
  }
}
function cloudinaryDestroySignature(publicId, timestamp2, apiSecret) {
  return crypto3.createHash("sha1").update(`public_id=${publicId}&timestamp=${timestamp2}${apiSecret}`).digest("hex");
}
async function destroyCloudinaryProductImage(publicId, config, request = fetch) {
  assertOrangeProductPublicId(publicId);
  const timestamp2 = Math.floor(Date.now() / 1e3);
  const body = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp2),
    api_key: config.apiKey,
    signature: cloudinaryDestroySignature(publicId, timestamp2, config.apiSecret)
  });
  const response = await request(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) throw new Error("Cloudinary could not remove the photo.");
  const payload = await response.json();
  if (payload.result === "ok") return "ok";
  if (payload.result === "not found") return "not found";
  throw new Error("Cloudinary could not confirm photo removal.");
}

// server/storeRouter.ts
var ADMIN_COOKIE = "orange_admin_session";
var ADMIN_PASSWORD_KEY = "admin_password_hash";
var DAY_SECONDS = 60 * 60 * 12;
var ADMIN_PASSWORD_MIN_LENGTH = 4;
var adminPasswordChangeInput = z2.object({
  currentPassword: z2.string().min(1),
  newPassword: z2.string().min(ADMIN_PASSWORD_MIN_LENGTH)
});
function tokenKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "The secure session key is unavailable." });
  return new TextEncoder().encode(secret);
}
function hashPassword(password) {
  const salt = crypto4.randomBytes(16).toString("hex");
  return `${salt}:${crypto4.scryptSync(password, salt, 64).toString("hex")}`;
}
function passwordMatches(password, encoded) {
  const [salt, expected] = encoded.split(":");
  if (!salt || !expected) return false;
  const actual = crypto4.scryptSync(password, salt, 64).toString("hex");
  return actual.length === expected.length && crypto4.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
function safeTextEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto4.timingSafeEqual(a, b);
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
function testOnlyAdminPassword() {
  return process.env.VITEST ? process.env.ORANGE_TEST_ADMIN_PASSWORD : void 0;
}
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
    products: productRows.filter((product) => includeHidden || Boolean(product.categoryId && categoriesById.has(product.categoryId))).map((product) => {
      const grouped = /* @__PURE__ */ new Map();
      for (const variant of variantsByProduct.get(product.id) ?? []) grouped.set(variant.colorId, [...grouped.get(variant.colorId) ?? [], variant]);
      const colors2 = Array.from(grouped.entries()).map(([colorId, variants3]) => {
        const color = colorId ? colorsById.get(colorId) : void 0;
        return { id: colorId, khmerName: color?.khmerName ?? null, englishName: color?.englishName ?? "One Color", hex: color?.hex ?? "#9A9A94", available: variants3.some((v) => publicAvailability(v.stockQuantity)), variants: variants3.map((v) => ({ id: v.id, posCode: v.posCode, size: v.size, price: Number(v.price), available: publicAvailability(v.stockQuantity), ...includeExactStock ? { stockQuantity: v.stockQuantity } : {} })) };
      });
      const variants2 = variantsByProduct.get(product.id) ?? [];
      const category = product.categoryId ? categoriesById.get(product.categoryId) : void 0;
      return { id: product.id, slug: product.slug, displayName: product.displayName, cleanedCode: product.cleanedCode, category: category ? { slug: category.slug, label: category.label } : { slug: "unassigned", label: "Not in storefront" }, isJustIn: product.isJustIn, isPublished: product.isPublished, lifecycleStatus: product.lifecycleStatus, isRemovedFromLatestImport: product.isRemovedFromLatestImport, reviewStatus: product.reviewStatus, available: product.lifecycleStatus === "active" && variants2.some((v) => publicAvailability(v.stockQuantity)), priceMin: variants2.length ? Math.min(...variants2.map((v) => Number(v.price))) : 0, priceMax: variants2.length ? Math.max(...variants2.map((v) => Number(v.price))) : 0, colors: colors2, media: (mediaByProduct.get(product.id) ?? []).map((media) => ({ id: media.id, url: media.optimizedUrl, altText: media.altText, isPrimary: media.isPrimary, variantId: media.variantId, colorTag: media.colorTag })) };
    })
  };
}
var importInput = z2.object({ filename: z2.string().min(1).max(255), base64: z2.string().min(16).max(MAX_POS_IMPORT_BASE64_LENGTH).regex(/^[A-Za-z0-9+/]+={0,2}$/, "The POS workbook payload is not valid base64.") });
function importDetailChange(row) {
  const after = row.after_json ?? {};
  const before = row.before_json ?? {};
  const supported = /* @__PURE__ */ new Set(["new_product", "new_color", "new_size", "new_variant", "price_changed", "stock_changed", "price_and_stock_changed", "variant_updated", "updated", "missing"]);
  const type = supported.has(after.changeType) ? after.changeType : row.change_type === "missing_from_import" ? "missing" : row.change_type === "stock_price_update" ? "updated" : supported.has(row.change_type) ? row.change_type : "updated";
  return { id: row.id, type, code: after.code ?? before.code ?? "Unknown item", posCode: after.posCode ?? before.posCode ?? row.pos_code, color: after.color ?? before.color ?? null, previousColor: after.previousColor ?? before.previousColor ?? null, size: after.size ?? before.size ?? null, previousSize: after.previousSize ?? before.previousSize ?? null, colorChanged: Boolean(after.colorChanged), sizeChanged: Boolean(after.sizeChanged), priceChanged: Boolean(after.priceChanged), stockChanged: Boolean(after.stockChanged), rawName: after.rawName ?? before.rawName ?? null, rawAttribute: after.rawAttribute ?? before.rawAttribute ?? null, previousRawName: after.previousRawName ?? before.rawName ?? null, previousRawAttribute: after.previousRawAttribute ?? before.rawAttribute ?? null, previousPrice: after.previousPrice ?? before.previousPrice ?? null, price: after.price ?? null, previousStock: after.previousStock ?? before.previousStock ?? null, stock: after.stock ?? null, missingPosCodes: after.missingPosCodes ?? [] };
}
function reviewableImportChanges(changes) {
  return changes.filter((change) => change.type !== "missing" && (change.type !== "updated" && change.type !== "variant_updated" || change.priceChanged || change.stockChanged));
}
function previewVariantIdentity(posCode) {
  return posCode;
}
function groupImportChanges(changes) {
  const groups = /* @__PURE__ */ new Map();
  for (const change of reviewableImportChanges(changes)) groups.set(change.code, [...groups.get(change.code) ?? [], change]);
  return Array.from(groups, ([code, groupChanges]) => ({ code, changes: groupChanges.sort((left, right) => left.type.localeCompare(right.type) || (left.color ?? "").localeCompare(right.color ?? "") || (left.size ?? "").localeCompare(right.size ?? "") || (left.posCode ?? "").localeCompare(right.posCode ?? "")) })).sort((left, right) => left.code.localeCompare(right.code));
}
async function createPreview(input) {
  const parsed = parsePosWorkbook(Buffer.from(input.base64, "base64"));
  if (parsed.validation.duplicatePosCodes.length) throw new TRPCError4({ code: "BAD_REQUEST", message: "The import contains duplicate immutable POS Codes." });
  const [existingVariants, existingProducts, existingColors, appliedImports] = await Promise.all([
    supabaseRequest("variants?select=id,product_id,color_id,pos_code,size,price,stock_quantity,raw_name,raw_attribute"),
    supabaseRequest("products?select=id,cleaned_code,slug,category_source"),
    supabaseRequest("colors?select=id,normalized_key,english_name,khmer_name"),
    supabaseRequest(`imports?select=id&digest=eq.${parsed.digest}&status=eq.applied&limit=1`)
  ]);
  const productsByCode = new Set(existingProducts.map((row) => row.cleaned_code));
  const productsById = new Map(existingProducts.map((row) => [row.id, row]));
  const colorsById = new Map(existingColors.map((row) => [row.id, row]));
  const variantsByPosCode = new Map(existingVariants.map((row) => [previewVariantIdentity(row.pos_code), row]));
  const productColorKeys = /* @__PURE__ */ new Set();
  const productColorSizeKeys = /* @__PURE__ */ new Set();
  for (const row of existingVariants) {
    const product = productsById.get(row.product_id);
    const color = row.color_id ? colorsById.get(row.color_id) : void 0;
    if (!product || !color) continue;
    productColorKeys.add(`${product.cleaned_code}\0${color.normalized_key}`);
    productColorSizeKeys.add(`${product.cleaned_code}\0${color.normalized_key}\0${row.size ?? ""}`);
  }
  const newProductCodes = /* @__PURE__ */ new Set();
  const newColorKeys = /* @__PURE__ */ new Set();
  const newSizeKeys = /* @__PURE__ */ new Set();
  const incomingCodes = new Set(parsed.items.map((item) => item.posCode));
  const changes = [];
  for (const item of parsed.items) {
    const current = variantsByPosCode.get(previewVariantIdentity(item.posCode));
    const color = item.colorKhmer || item.colorEnglish;
    if (!current) {
      const modelIsNew = !productsByCode.has(item.cleanedCode);
      const productColorKey = `${item.cleanedCode}\0${item.colorKey}`;
      const productColorSizeKey = `${productColorKey}\0${item.size ?? ""}`;
      const type2 = modelIsNew ? "new_product" : !productColorKeys.has(productColorKey) ? "new_color" : !productColorSizeKeys.has(productColorSizeKey) ? "new_size" : "new_variant";
      if (modelIsNew) newProductCodes.add(item.cleanedCode);
      if (type2 === "new_color") newColorKeys.add(productColorKey);
      if (type2 === "new_size") newSizeKeys.add(productColorSizeKey);
      changes.push({ type: type2, code: item.cleanedCode, posCode: item.posCode, color, previousColor: null, size: item.size, previousSize: null, colorChanged: false, sizeChanged: false, priceChanged: false, stockChanged: false, rawName: item.rawName, rawAttribute: item.rawAttribute, previousRawName: null, previousRawAttribute: null, previousPrice: null, price: item.price, previousStock: null, stock: item.stockQuantity, missingPosCodes: [] });
      continue;
    }
    const previousColor = current.color_id ? colorsById.get(current.color_id) : void 0;
    const priceChanged = Number(current.price) !== item.price;
    const stockChanged = current.stock_quantity !== item.stockQuantity;
    const colorChanged = current.color_id ? previousColor?.normalized_key !== item.colorKey : Boolean(item.colorKey);
    const sizeChanged = current.size !== item.size;
    const rawNameChanged = (current.raw_name ?? null) !== (item.rawName ?? null);
    const rawAttributeChanged = (current.raw_attribute ?? null) !== (item.rawAttribute ?? null);
    if (!priceChanged && !stockChanged && !colorChanged && !sizeChanged && !rawNameChanged && !rawAttributeChanged) continue;
    const type = priceChanged && stockChanged ? "price_and_stock_changed" : priceChanged ? "price_changed" : stockChanged ? "stock_changed" : "variant_updated";
    changes.push({ type, code: item.cleanedCode, posCode: item.posCode, color, previousColor: previousColor?.khmer_name || previousColor?.english_name || null, size: item.size, previousSize: current.size, colorChanged, sizeChanged, priceChanged, stockChanged, rawName: item.rawName, rawAttribute: item.rawAttribute, previousRawName: current.raw_name ?? null, previousRawAttribute: current.raw_attribute ?? null, previousPrice: Number(current.price), price: item.price, previousStock: current.stock_quantity, stock: item.stockQuantity, missingPosCodes: [] });
  }
  const missingVariants = existingVariants.filter((row) => !incomingCodes.has(row.pos_code)).length;
  const summary = {
    rows: parsed.items.length,
    products: parsed.productCount,
    exportDate: parsed.exportDate,
    changedProducts: new Set(changes.map((change) => change.code)).size,
    changedVariants: changes.length,
    newProducts: newProductCodes.size,
    newColors: newColorKeys.size,
    newSizes: newSizeKeys.size,
    newVariants: changes.filter((change) => change.type === "new_variant").length,
    priceChanges: changes.filter((change) => change.type === "price_changed").length,
    stockChanges: changes.filter((change) => change.type === "stock_changed").length,
    priceAndStockChanges: changes.filter((change) => change.type === "price_and_stock_changed").length,
    updatedVariants: changes.filter((change) => ["price_changed", "stock_changed", "price_and_stock_changed", "variant_updated"].includes(change.type)).length,
    missingVariants,
    invalidRows: parsed.validation.invalidRows.length
  };
  const alreadyApplied = appliedImports[0];
  if (alreadyApplied) return { importId: alreadyApplied.id, summary, validation: parsed.validation, changes: [], changeGroups: [], alreadyApplied: true };
  const [importRow] = await supabaseRequest("imports", {
    method: "POST",
    body: JSON.stringify({ original_filename: input.filename, digest: parsed.digest, status: "preview", parsed_rows: parsed.items.length, source_export_date: parsed.exportDate, summary_json: summary, validation_json: { ...parsed.validation, productCount: parsed.productCount, exportDate: parsed.exportDate } })
  });
  return { importId: importRow.id, summary, validation: parsed.validation, changes, changeGroups: groupImportChanges(changes.map((change, index2) => ({ id: -(index2 + 1), ...change }))), alreadyApplied: false };
}
async function applyImport(input) {
  const parsed = parsePosWorkbook(Buffer.from(input.base64, "base64"));
  if (parsed.validation.invalidRows.length || parsed.validation.duplicatePosCodes.length) throw new TRPCError4({ code: "BAD_REQUEST", message: "Resolve invalid or duplicate POS rows before applying the import." });
  try {
    const summary = await supabaseRequest("rpc/apply_pos_import", {
      method: "POST",
      body: JSON.stringify({ p_import_id: input.importId, p_digest: parsed.digest, p_items: parsed.items })
    });
    const requiredSummaryFields = ["newProducts", "newColors", "newSizes", "newVariants", "priceChanges", "stockChanges", "priceAndStockChanges", "updatedVariants", "missingVariants"];
    if (!summary || requiredSummaryFields.some((field) => !Number.isInteger(summary[field]))) {
      throw new Error("The transactional POS import did not return a complete summary.");
    }
    return summary;
  } catch (error) {
    if (error instanceof TRPCError4) throw error;
    throw new TRPCError4({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "The POS import could not be applied. No catalogue changes were saved." });
  }
}
async function removeLatestAppliedImport(importId) {
  try {
    const summary = await supabaseRequest("rpc/rollback_pos_import", { method: "POST", body: JSON.stringify({ p_import_id: importId }) });
    if (!summary) throw new Error("The import removal did not return a result.");
    return summary;
  } catch (error) {
    throw new TRPCError4({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "The selected POS import could not be removed." });
  }
}
async function copyArchivedWebsiteContent(sourceProductId, targetProductId) {
  if (sourceProductId === targetProductId) throw new TRPCError4({ code: "BAD_REQUEST", message: "Choose a different archived item to reuse its website content." });
  const [sourceRows, targetRows] = await Promise.all([
    supabaseRequest(`products?select=id,display_name,category_id,category_source,is_just_in,lifecycle_status&${supabaseEq("id", sourceProductId)}&limit=1`),
    supabaseRequest(`products?select=id,display_name,category_id,category_source,is_just_in,lifecycle_status&${supabaseEq("id", targetProductId)}&limit=1`)
  ]);
  const source = sourceRows[0];
  const target = targetRows[0];
  if (!source || !target) throw new TRPCError4({ code: "NOT_FOUND", message: "The selected source or target item no longer exists." });
  if (source.lifecycle_status !== "discontinued") throw new TRPCError4({ code: "BAD_REQUEST", message: "Website content can be reused only from a discontinued item." });
  if (target.lifecycle_status === "discontinued") throw new TRPCError4({ code: "BAD_REQUEST", message: "Restore the target item before reusing archived content." });
  await supabaseRequest(`products?${supabaseEq("id", target.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ display_name: source.display_name, category_id: source.category_id, category_source: source.category_source, is_just_in: source.is_just_in })
  });
  const [sourceMedia, targetMedia] = await Promise.all([
    supabaseRequest(`product_media?select=product_id,variant_id,cloudinary_public_id,optimized_url,alt_text,color_tag,sort_order,is_primary&${supabaseEq("product_id", source.id)}&order=sort_order.asc`),
    supabaseRequest(`product_media?select=product_id,variant_id,cloudinary_public_id,optimized_url,alt_text,color_tag,sort_order,is_primary&${supabaseEq("product_id", target.id)}&order=sort_order.asc`)
  ]);
  const existingMedia = new Set(targetMedia.map((media) => `${media.cloudinary_public_id}:${media.color_tag ?? ""}`));
  const copiedRows = sourceMedia.filter((media) => !existingMedia.has(`${media.cloudinary_public_id}:${media.color_tag ?? ""}`)).map((media, index2) => ({ product_id: target.id, variant_id: null, cloudinary_public_id: media.cloudinary_public_id, optimized_url: media.optimized_url, alt_text: media.alt_text, color_tag: media.color_tag, sort_order: targetMedia.length + index2, is_primary: targetMedia.length === 0 && index2 === 0 }));
  if (copiedRows.length) await supabaseRequest("product_media", { method: "POST", body: JSON.stringify(copiedRows) });
  return { copiedMediaCount: copiedRows.length };
}
var storeRouter = router({
  catalogue: router({ list: publicProcedure.query(() => fetchStorefrontCards()), getBySlug: publicProcedure.input(z2.object({ slug: z2.string().min(1) })).query(async ({ input }) => {
    const product = await fetchStorefrontProduct(input.slug);
    if (!product) throw new TRPCError4({ code: "NOT_FOUND", message: "Product not found." });
    return product;
  }), categories: publicProcedure.query(() => PUBLIC_CATEGORIES), messengerUrl: publicProcedure.input(z2.object({ productCode: z2.string(), color: z2.string(), size: z2.string().nullable().optional() })).query(({ input }) => buildMessengerOrderUrl(input)) }),
  admin: router({
    session: publicProcedure.query(({ ctx }) => hasAdminSession(ctx)),
    login: publicProcedure.input(z2.object({ password: z2.string().min(1).max(1024) })).mutation(async ({ ctx, input }) => {
      const clientKey = adminLoginClientKey(ctx.req.headers);
      const testPassword = testOnlyAdminPassword();
      const preflight = testPassword ? { allowed: true } : await checkAdminLoginRateLimit(clientKey, "check");
      if (!preflight.allowed) throw new TRPCError4({ code: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts. Please try again later." });
      const stored = await readStoredPasswordHash();
      const initial = process.env.ADMIN_PASSWORD;
      const valid = testPassword ? safeTextEqual(input.password, testPassword) : stored ? passwordMatches(input.password, stored) : Boolean(initial && safeTextEqual(input.password, initial));
      const result = testPassword ? { allowed: true } : await checkAdminLoginRateLimit(clientKey, valid ? "success" : "failure");
      if (!valid) {
        if (!result.allowed) throw new TRPCError4({ code: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts. Please try again later." });
        throw new TRPCError4({ code: "UNAUTHORIZED", message: "Unable to sign in with those credentials." });
      }
      if (!result.allowed) throw new TRPCError4({ code: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts. Please try again later." });
      if (!stored && !testPassword) await savePasswordHash(hashPassword(input.password));
      await issueAdminSession(ctx);
      return { success: true };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(ADMIN_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
      return { success: true };
    }),
    changePassword: publicProcedure.input(adminPasswordChangeInput).mutation(async ({ ctx, input }) => {
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
    updateProduct: publicProcedure.input(z2.object({ id: z2.number().int(), displayName: z2.string().max(255).nullable(), categoryId: z2.number().int().nullable(), isJustIn: z2.boolean().optional(), lifecycleStatus: z2.enum(["active", "out_of_stock", "discontinued"]).optional() })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      await supabaseRequest(`products?${supabaseEq("id", input.id)}`, { method: "PATCH", body: JSON.stringify({ display_name: input.displayName, category_id: input.categoryId, category_source: input.categoryId ? "manual" : "unassigned", ...input.isJustIn === void 0 ? {} : { is_just_in: input.isJustIn }, ...input.lifecycleStatus === void 0 ? {} : { lifecycle_status: input.lifecycleStatus } }) });
      return { success: true };
    }),
    reuseArchivedContent: publicProcedure.input(z2.object({ sourceProductId: z2.number().int().positive(), targetProductId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      return copyArchivedWebsiteContent(input.sourceProductId, input.targetProductId);
    }),
    previewImport: publicProcedure.input(importInput).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      return createPreview(input);
    }),
    applyImport: publicProcedure.input(importInput.extend({ importId: z2.number().int() })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      return applyImport(input);
    }),
    removeImport: publicProcedure.input(z2.object({ importId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      return removeLatestAppliedImport(input.importId);
    }),
    importHistory: publicProcedure.query(async ({ ctx }) => {
      await requireAdmin(ctx);
      const rows = await supabaseRequest("imports?select=id,original_filename,status,created_at,applied_at,source_export_date,parsed_rows,summary_json&status=eq.applied&order=applied_at.desc,id.desc&limit=100");
      return rows.map((row, index2) => ({ id: row.id, originalFilename: row.original_filename, status: row.status, createdAt: row.created_at, appliedAt: row.applied_at ?? null, sourceExportDate: row.source_export_date ?? null, parsedRows: row.parsed_rows ?? 0, summary: row.summary_json ?? {}, canRemove: index2 === 0 }));
    }),
    importDetails: publicProcedure.input(z2.object({ importId: z2.number().int().positive() })).query(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const [imports2, changes, latestApplied] = await Promise.all([supabaseRequest(`imports?select=id,original_filename,status,created_at,applied_at,source_export_date,parsed_rows,summary_json&${supabaseEq("id", input.importId)}&limit=1`), supabaseRequest(`import_changes?select=id,import_id,product_id,variant_id,pos_code,change_type,before_json,after_json,created_at&${supabaseEq("import_id", input.importId)}&order=created_at.asc&limit=5000`), supabaseRequest("imports?select=id&status=eq.applied&order=applied_at.desc,id.desc&limit=1")]);
      const importRow = imports2[0];
      if (!importRow) throw new TRPCError4({ code: "NOT_FOUND", message: "The selected import was not found." });
      const detailChanges = reviewableImportChanges(changes.map(importDetailChange));
      return { id: importRow.id, originalFilename: importRow.original_filename, status: importRow.status, createdAt: importRow.created_at, appliedAt: importRow.applied_at ?? null, sourceExportDate: importRow.source_export_date ?? null, parsedRows: importRow.parsed_rows ?? 0, summary: importRow.summary_json ?? {}, changes: detailChanges, changeGroups: groupImportChanges(detailChanges), canRemove: latestApplied[0]?.id === importRow.id };
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
      const signature = crypto4.createHash("sha1").update(`folder=${folder}&tags=${tags}&timestamp=${timestamp2}${apiSecret}`).digest("hex");
      return { uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, apiKey, timestamp: timestamp2, folder, tags, signature };
    }),
    registerMedia: publicProcedure.input(z2.object({ productId: z2.number().int(), variantId: z2.number().int().nullable().optional(), publicId: z2.string().min(1), secureUrl: z2.string().url(), altText: z2.string().max(255).nullable().optional(), colorTag: z2.string().max(128).nullable().optional(), isPrimary: z2.boolean().default(false) })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      if (!input.publicId.startsWith("orange/products/")) throw new TRPCError4({ code: "BAD_REQUEST", message: "The uploaded media is not in an approved Orange product folder." });
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      if (input.isPrimary) await supabaseRequest(`product_media?${supabaseEq("product_id", input.productId)}`, { method: "PATCH", body: JSON.stringify({ is_primary: false }) });
      await supabaseRequest("product_media", { method: "POST", body: JSON.stringify({ product_id: input.productId, variant_id: input.variantId ?? null, cloudinary_public_id: input.publicId, optimized_url: `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/${input.publicId}`, alt_text: input.altText ?? null, color_tag: input.colorTag ?? null, is_primary: input.isPrimary }) });
      return { success: true };
    }),
    deleteMedia: publicProcedure.input(z2.object({ mediaId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const mediaRows = await supabaseRequest(`product_media?select=id,cloudinary_public_id&${supabaseEq("id", input.mediaId)}&limit=1`);
      const media = mediaRows[0];
      if (!media) throw new TRPCError4({ code: "NOT_FOUND", message: "The selected photo record was not found." });
      const otherAssociations = await supabaseRequest(`product_media?select=id&${supabaseEq("cloudinary_public_id", media.cloudinary_public_id)}&id=neq.${media.id}&limit=1`);
      if (!otherAssociations.length) {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;
        if (!cloudName || !apiKey || !apiSecret) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Cloudinary media configuration is incomplete." });
        try {
          await destroyCloudinaryProductImage(media.cloudinary_public_id, { cloudName, apiKey, apiSecret });
        } catch (error) {
          throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Cloudinary could not remove the photo." });
        }
      }
      await supabaseRequest(`product_media?${supabaseEq("id", media.id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
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
  app.use("/api/trpc", (req, res, next) => {
    const procedure = req.path.replace(/^\//, "");
    if (req.method === "GET" && (procedure === "store.catalogue.list" || procedure === "store.catalogue.getBySlug")) {
      res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    }
    next();
  });
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  return app;
}

// server/vercelEntry.ts
var vercelEntry_default = createApiApp();
export {
  vercelEntry_default as default
};
