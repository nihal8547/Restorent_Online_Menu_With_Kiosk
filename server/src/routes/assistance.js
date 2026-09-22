import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getIo } from "../socket.js";
import crypto from "crypto";

const router = Router();

// In-memory store for active assistance requests.
// Structure: { [requestId]: { id, tableNo, requestedAt } }
const activeRequests = new Map();

// GET /api/assistance
// Waiters fetch active requests
router.get("/", requireAuth, (req, res) => {
  res.json(Array.from(activeRequests.values()));
});

// POST /api/assistance
// Customer requests assistance
router.post("/", (req, res) => {
  const { tableNo } = req.body;
  if (!tableNo) {
    return res.status(400).json({ error: "Table number is required" });
  }

  // Prevent multiple requests for the same table (spam prevention on backend)
  for (const req of activeRequests.values()) {
    if (req.tableNo === tableNo) {
      return res.json({ success: true, message: "Request already active" });
    }
  }

  const id = crypto.randomUUID();
  const request = { id, tableNo, requestedAt: new Date().toISOString() };
  
  activeRequests.set(id, request);

  // Broadcast to all waiters and admins
  const io = getIo();
  if (io) {
    io.to("waiters").to("admin").emit("assistance:new", request);
  }

  res.json({ success: true, request });
});

// POST /api/assistance/:id/accept
// Waiter accepts the request
router.post("/:id/accept", requireAuth, (req, res) => {
  const { id } = req.params;
  const request = activeRequests.get(id);

  if (!request) {
    // Maybe someone else already accepted it
    return res.status(404).json({ error: "Request not found or already accepted" });
  }

  activeRequests.delete(id);

  // Broadcast that it was accepted so others can remove it from their screen
  const io = getIo();
  if (io) {
    io.to("waiters").to("admin").emit("assistance:accepted", {
      id,
      tableNo: request.tableNo,
      acceptedBy: req.user.name,
    });
  }

  res.json({ success: true });
});

export default router;
