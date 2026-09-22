import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getIo } from "../socket.js";
import crypto from "crypto";

const router = Router();

// In-memory store for active assistance requests.
// Structure: { [requestId]: { id, tableNo, reason, status: "PENDING", requestedAt } }
const activeRequests = new Map();

// In-memory store for recently accepted assistance calls (retained for 3 minutes)
// Key: tableNo, Value: { id, tableNo, acceptedBy, acceptedAt, status: "ACCEPTED" }
const recentAccepted = new Map();

// GET /api/assistance
// Waiters fetch active pending requests
router.get("/", requireAuth, (req, res) => {
  res.json(Array.from(activeRequests.values()));
});

// GET /api/assistance/status
// Customer or staff checks current call status for a table
router.get("/status", (req, res) => {
  const { tableNo } = req.query;
  if (!tableNo) {
    return res.status(400).json({ error: "Table number is required" });
  }

  // Check pending
  for (const r of activeRequests.values()) {
    if (String(r.tableNo) === String(tableNo)) {
      return res.json({ status: "PENDING", request: r });
    }
  }

  // Check recently accepted
  const accepted = recentAccepted.get(String(tableNo));
  if (accepted) {
    return res.json({ status: "ACCEPTED", request: accepted });
  }

  res.json({ status: "IDLE" });
});

// POST /api/assistance
// Customer requests assistance
router.post("/", (req, res) => {
  const { tableNo, reason } = req.body;
  if (!tableNo) {
    return res.status(400).json({ error: "Table number is required" });
  }

  // Clear previous accepted state for this table if any
  recentAccepted.delete(String(tableNo));

  // Prevent multiple duplicate pending requests for the same table
  for (const existing of activeRequests.values()) {
    if (String(existing.tableNo) === String(tableNo)) {
      return res.json({ success: true, message: "Request already active", request: existing });
    }
  }

  const id = crypto.randomUUID();
  const request = { 
    id, 
    tableNo: String(tableNo), 
    reason: reason || "General Assistance",
    status: "PENDING",
    requestedAt: new Date().toISOString() 
  };
  
  activeRequests.set(id, request);

  // Broadcast to all waiters, admins, and customer screens
  const io = getIo();
  if (io) {
    io.emit("assistance:new", request);
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

  // Remove from pending
  activeRequests.delete(id);

  const acceptedData = {
    id,
    tableNo: String(request.tableNo),
    acceptedBy: req.user?.name || "Waiter",
    acceptedAt: new Date().toISOString(),
    status: "ACCEPTED",
  };

  // Keep in recentAccepted for 3 minutes so customer or table overview sees status
  recentAccepted.set(String(request.tableNo), acceptedData);
  setTimeout(() => {
    recentAccepted.delete(String(request.tableNo));
  }, 3 * 60 * 1000);

  // Broadcast to EVERYONE (waiters, admin, and the customer) in real time
  const io = getIo();
  if (io) {
    io.emit("assistance:accepted", acceptedData);
  }

  res.json({ success: true, accepted: acceptedData });
});

export default router;
