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
  const isPlatform = order.source && order.source !== "IN_HOUSE";
  
  let where = "TAKEAWAY";
  if (order.type === "DINE_IN") {
    where = `TABLE ${order.table?.tableNo ?? "-"}`;
  } else if (isPlatform) {
    where = `🛵 ${order.source} DELIVERY`;
  } else if (order.type === "DELIVERY") {
    where = "IN-HOUSE DELIVERY";
  }

  const partnerHeader = isPlatform
    ? `<div class="partner-box">
        <div class="partner-name">★ ${escapeHtml(order.source)} PARTNER ORDER ★</div>
        ${order.platformRef ? `<div class="partner-ref">PICKUP REF: <strong>${escapeHtml(order.platformRef)}</strong></div>` : ""}
        ${order.deliveryInfo?.name ? `<div class="partner-meta">Customer: ${escapeHtml(order.deliveryInfo.name)} ${escapeHtml(order.deliveryInfo.phone || "")}</div>` : ""}
        ${order.deliveryInfo?.zone ? `<div class="partner-meta">Zone: ${escapeHtml(order.deliveryInfo.zone)}</div>` : ""}
      </div>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><title>KOT ${order.orderNo}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body { width: 76mm; margin: 0 auto; padding: 6px 8px; font-family: 'Courier New', monospace; color: #000; }
    .center { text-align: center; }
    .shop { font-size: 15px; font-weight: 700; }
    .kot { font-size: 20px; font-weight: 800; letter-spacing: 2px; margin: 4px 0; }
    .meta { font-size: 12px; }
    .where { font-size: 16px; font-weight: 800; border: 2px solid #000; padding: 4px; margin: 6px 0; text-align: center; }
    .partner-box { border: 2px dashed #000; padding: 5px; margin: 6px 0; text-align: center; }
    .partner-name { font-size: 14px; font-weight: 900; letter-spacing: 1px; }
    .partner-ref { font-size: 15px; margin: 2px 0; }
    .partner-meta { font-size: 11px; }
    hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { vertical-align: top; padding: 3px 0; font-size: 14px; }
    td.q { width: 34px; font-weight: 800; }
    td.n { font-weight: 700; }
    .note { font-size: 11px; font-weight: 400; padding-left: 2px; }
    .special-note { background: #eee; padding: 4px; border-left: 3px solid #000; font-size: 11px; font-weight: bold; margin: 4px 0; }
    .foot { font-size: 11px; margin-top: 6px; }
  </style></head>
  <body onload="window.print(); setTimeout(function(){ window.close(); }, 400);">
    <div class="center shop">${escapeHtml(shopName || "Kitchen")}</div>
    <div class="center kot">KOT</div>
    <div class="center meta">${escapeHtml(order.orderNo || "")}</div>
    <div class="where">${where}</div>
    ${partnerHeader}
    <div class="meta">${when}</div>
    <hr/>
    <table>${rows}</table>
    ${order.note ? `<div class="special-note">INSTRUCTION: ${escapeHtml(order.note)}</div>` : ""}
    <hr/>
    <div class="center foot">${isPlatform ? `*** PREPAID VIA ${order.source} - DO NOT CHARGE ***` : "*** Kitchen Copy ***"}</div>
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
