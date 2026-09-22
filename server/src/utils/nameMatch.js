// Lightweight menu-item name matcher used to auto-suggest a mapping from a
// delivery platform's product name.

function tokens(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// Score two names by token overlap (Jaccard-ish), 0..1.
function score(a, b) {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return 0;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return common / Math.max(ta.size, tb.size);
}

/**
 * Find the best matching menu item for a platform product name.
 * items: [{ id, name }]. Returns { id, score } or null if nothing reasonable.
 */
export function bestMenuItemMatch(name, items) {
  if (!name) return null;
  let best = null;
  for (const it of items) {
    const s = score(name, it.name);
    if (!best || s > best.score) best = { id: it.id, score: s };
  }
  // Require at least one shared token to avoid nonsense suggestions.
  return best && best.score > 0 ? best : null;
}
