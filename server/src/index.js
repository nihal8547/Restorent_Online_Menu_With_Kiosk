import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Server as SocketServer } from "socket.io";

// ---- Production safety: refuse to boot with insecure secret defaults ----
const IS_PROD = process.env.NODE_ENV === "production";
if (IS_PROD) {
  const missing = [];
  if (!process.env.JWT_SECRET) missing.push("JWT_SECRET");
  if (!process.env.INTEGRATION_ENC_KEY) missing.push("INTEGRATION_ENC_KEY");
  if (missing.length) {
    console.error(`FATAL: missing required secrets in production: ${missing.join(", ")}`);
    process.exit(1);
  }
}

import { setIo } from "./socket.js";
import authRoutes from "./routes/auth.js";
import menuRoutes from "./routes/menu.js";
import tableRoutes from "./routes/tables.js";
import orderRoutes from "./routes/orders.js";
import paymentRoutes from "./routes/payments.js";
import expenseRoutes from "./routes/expenses.js";
import reportRoutes from "./routes/reports.js";
import customerRoutes from "./routes/customers.js";
import billRoutes from "./routes/bill.js";
import webhookRoutes from "./routes/webhooks.js";
import waiterRoutes from "./routes/waiters.js";
import uploadRoutes from "./routes/upload.js";
import bannerRoutes from "./routes/banners.js";
import settingsRoutes from "./routes/settings.js";
import assistanceRoutes from "./routes/assistance.js";
import inventoryRoutes from "./routes/inventory.js";
import accountingRoutes from "./routes/accounting.js";
import integrationRoutes from "./routes/integrations.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

// Security headers. crossOriginResourcePolicy relaxed so the SPA on another
// origin can load uploaded images.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(","), credentials: true }));
// Capture the raw body (needed to verify HMAC webhook signatures).
app.use(express.json({ limit: "1mb", verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.set("trust proxy", 1); // correct client IPs behind a reverse proxy (for rate limiting)

// Rate limiters: strict on auth (brute-force) and webhooks (abuse), lighter elsewhere.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
const webhookLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false });
app.use("/api/auth", authLimiter);
app.use("/api/webhooks", webhookLimiter);
app.use("/api", apiLimiter);

// Health check
app.get("/api/health", (req, res) => res.json({ ok: true, service: "zafran", time: new Date() }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/tables", tableRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/bill", billRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/waiters", waiterRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/assistance", assistanceRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/accounting", accountingRoutes);
app.use("/api/integrations", integrationRoutes);

// Serve static files from the uploads directory
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

// 404 for unknown API routes
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

// Central error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === "P2025") return res.status(404).json({ error: "Record not found" });
  if (err.code === "P2002") return res.status(409).json({ error: "Duplicate value" });
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

// Socket.IO — clients join rooms by role screen.
const io = new SocketServer(server, {
  cors: { origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(",") },
});
setIo(io);

io.on("connection", (socket) => {
  // Staff rooms: "kitchen", "admin", "waiters"
  socket.on("join", (room) => {
    if (["kitchen", "admin", "waiters"].includes(room)) socket.join(room);
  });
  // Customer order room: "order:<orderToken>" — for per-order status tracking
  socket.on("watch:order", (orderToken) => {
    if (orderToken && typeof orderToken === "string" && orderToken.length < 100) {
      socket.join(`order:${orderToken}`);
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🍽️  Zafran API running on http://localhost:${PORT}`);
});
