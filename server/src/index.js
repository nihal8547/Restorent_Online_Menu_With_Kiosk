import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server as SocketServer } from "socket.io";

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

const app = express();
const server = http.createServer(app);

const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

app.use(cors({ origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(","), credentials: true }));
app.use(express.json({ limit: "1mb" }));

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
  socket.on("join", (room) => {
    if (["kitchen", "admin", "waiters"].includes(room)) socket.join(room);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🍽️  Zafran API running on http://localhost:${PORT}`);
});
