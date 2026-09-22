import crypto from "crypto";

// AES-256-GCM encryption for secrets at rest (API keys, webhook secrets).
// The key is derived from INTEGRATION_ENC_KEY (preferred) or JWT_SECRET.
// Set a strong INTEGRATION_ENC_KEY in production and keep it stable — rotating
// it makes previously stored secrets unreadable (they'd need re-entering).
const KEY = crypto
  .createHash("sha256")
  .update(String(process.env.INTEGRATION_ENC_KEY || process.env.JWT_SECRET || "dev-integration-key"))
  .digest();

// Encrypt a string → base64(iv | authTag | ciphertext). Returns null for empty.
export function encrypt(plain) {
  if (plain == null || plain === "") return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

// Decrypt a value produced by encrypt(). Returns null if missing/corrupt.
export function decrypt(b64) {
  if (!b64) return null;
  try {
    const raw = Buffer.from(b64, "base64");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const enc = raw.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// Mask a secret for display, e.g. "••••ab12". Never returns the full value.
export function mask(plain) {
  if (!plain) return null;
  const s = String(plain);
  return s.length <= 4 ? "••••" : "••••" + s.slice(-4);
}

// Constant-time comparison of two secrets.
export function safeEqual(a, b) {
  if (!a || !b) return false;
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// HMAC-SHA256 of a raw body (Buffer or string) with a secret, in the given
// digest encoding ("hex" | "base64"). Used to verify delivery-platform webhooks
// that sign the payload rather than sending a static shared secret.
export function hmacSha256(rawBody, secret, encoding = "hex") {
  return crypto
    .createHmac("sha256", String(secret))
    .update(rawBody ?? Buffer.alloc(0))
    .digest(encoding);
}
