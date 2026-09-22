// KOT (Kitchen Order Ticket) thermal printing.
//
// Opens a hidden 80mm-formatted ticket and triggers print. For TRUE silent
// auto-printing (no browser dialog), run Chrome/Chromium in kiosk-printing mode:
//
//   chrome --kiosk-printing --app=https://your-kitchen-url/kitchen
//
// With that flag, window.print() prints to the default printer with no dialog —
// giving fully automatic KOT printing on a thermal printer.

function ticketHtml(order, shopName) {
  const rows = order.items
    .map(
      (i) => `
      <tr>
        <td class="q">${i.qty}×</td>
        <td class="n">${escapeHtml(i.name)}${i.note ? `<div class="note">↳ ${escapeHtml(i.note)}</div>` : ""}</td>
      </tr>`
    )
    .join("");

  const when = new Date(order.createdAt || Date.now()).toLocaleString();
  const where =
    order.type === "DINE_IN"
      ? `TABLE ${order.table?.tableNo ?? "-"}`
      : order.type === "DELIVERY"
      ? "DELIVERY"
      : "TAKEAWAY";

  return `<!doctype html><html><head><meta charset="utf-8"><title>KOT ${order.orderNo}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body { width: 76mm; margin: 0 auto; padding: 6px 8px; font-family: 'Courier New', monospace; color: #000; }
    .center { text-align: center; }
    .shop { font-size: 15px; font-weight: 700; }
    .kot { font-size: 20px; font-weight: 800; letter-spacing: 2px; margin: 4px 0; }
    .meta { font-size: 12px; }
    .where { font-size: 16px; font-weight: 800; border: 2px solid #000; padding: 3px; margin: 6px 0; }
    hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { vertical-align: top; padding: 3px 0; font-size: 14px; }
    td.q { width: 34px; font-weight: 800; }
    td.n { font-weight: 700; }
    .note { font-size: 11px; font-weight: 400; padding-left: 2px; }
    .foot { font-size: 11px; margin-top: 6px; }
  </style></head>
  <body onload="window.print(); setTimeout(function(){ window.close(); }, 400);">
    <div class="center shop">${escapeHtml(shopName || "Kitchen")}</div>
    <div class="center kot">KOT</div>
    <div class="center meta">${escapeHtml(order.orderNo || "")}</div>
    <div class="center where">${where}</div>
    <div class="meta">${when}</div>
    <hr/>
    <table>${rows}</table>
    <hr/>
    <div class="center foot">*** Kitchen Copy ***</div>
  </body></html>`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/**
 * Print a KOT for one order. Opens a small print window that auto-prints and
 * closes itself. Returns false if the popup was blocked.
 */
export function printKOT(order, shopName) {
  const w = window.open("", "kot_print", "width=320,height=600");
  if (!w) return false;
  w.document.open();
  w.document.write(ticketHtml(order, shopName));
  w.document.close();
  return true;
}
