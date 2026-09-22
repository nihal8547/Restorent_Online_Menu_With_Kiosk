import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma.js";
import { signToken, requireAuth } from "../middleware/auth.js";

const router = Router();

// POST /api/auth/login  { username, password }
router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    const user = await prisma.user.findUnique({ where: { username: String(username).trim() } });
    if (!user || !user.active) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, name: user.name, username: user.username, role: user.role },
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// PUT /api/auth/profile { name, username, password }
router.put("/profile", requireAuth, async (req, res, next) => {
  try {
    const { name, username, password } = req.body || {};
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (username) updateData.username = username.trim();
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No data to update" });
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData
    });

    res.json({
      user: { id: updated.id, name: updated.name, username: updated.username, role: updated.role }
    });
  } catch (e) {
    if (e.code === 'P2002') {
      return res.status(400).json({ error: "Username already exists" });
    }
    next(e);
  }
});

export default router;
