// src/lib/generateReceiptPDF.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/** ArrayBuffer -> base64 */
function ab2b64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** โหลดและลงทะเบียนฟอนต์ไทย (cache ครั้งเดียว) */
let _thaiFontReady = false;
async function ensureThaiFont(doc) {
  if (_thaiFontReady) {
    doc.setFont("THSarabunNew", "normal");
    return;
  }

  const base =
    (typeof process !== "undefined" &&
      process.env &&
      process.env.PUBLIC_URL &&
      process.env.PUBLIC_URL.replace(/\/$/, "")) ||
    "";
  const ver = (typeof window !== "undefined" && window.__FONT_VER__) || "1";

  const regularUrl = `${base}/fonts/THSarabunNew.ttf?v=${ver}`;
  const boldUrl    = `${base}/fonts/THSarabunNew-Bold.ttf?v=${ver}`;

  const [rRes, bRes] = await Promise.all([fetch(regularUrl), fetch(boldUrl)]);

  const bad = (res, name) =>
    !res.ok ||
    (res.headers && res.headers.get("content-type") &&
     !/font|octet-stream|application\/x-font-ttf/i.test(res.headers.get("content-type")));

  if (bad(rRes, "regular")) {
    throw new Error("โหลดฟอนต์ THSarabunNew.ttf ไม่สำเร็จ (path หรือ CORS ผิด)");
  }
  if (bad(bRes, "bold")) {
    throw new Error("โหลดฟอนต์ THSarabunNew-Bold.ttf ไม่สำเร็จ (path หรือ CORS ผิด)");
  }

  const [rBuf, bBuf] = await Promise.all([rRes.arrayBuffer(), bRes.arrayBuffer()]);

  // ชื่อไฟล์ใน VFS กับ family ต้องสอดคล้องกัน
  doc.addFileToVFS("THSarabunNew.ttf", ab2b64(rBuf));
  doc.addFont("THSarabunNew.ttf", "THSarabunNew", "normal");
  doc.addFileToVFS("THSarabunNew-Bold.ttf", ab2b64(bBuf));
  doc.addFont("THSarabunNew-Bold.ttf", "THSarabunNew", "bold");

  _thaiFontReady = true;
  doc.setFont("THSarabunNew", "normal");
}

function toMoney(n) {
  const v = Number(n || 0);
  return v.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function textBlock(doc, text, x, y, maxWidth, lineHeight = 14) {
  const lines = doc.splitTextToSize(String(text || ""), maxWidth);
  lines.forEach((ln, i) => doc.text(ln, x, y + i * lineHeight));
}
function makeFilename(receiptNo, clientName) {
  const safeName = String(clientName || "").trim().replace(/[\\/:*?"<>|]/g, "_");
  const id = receiptNo || new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `Receipt-${id}${safeName ? "-" + safeName : ""}.pdf`;
}

export default async function generateReceiptPDF(payload = {}, options = {}) {
  const {
    companyName = "Siam Guard",
    companyAddress = "",
    companyPhone = "",
    companyTaxId = "",
    logoDataUrl,

    clientName = "",
    clientPhone = "",
    clientAddress = "",

    receiptNo = "",
    issueDate = new Date(),

    items = [],
    discount = 0,
    vatRate = 0,
    alreadyPaid = 0,
    notes = "",
  } = payload;

  const doc = new jsPDF({ unit: "pt", format: "a4" });

  // ✅ ฝังฟอนต์ไทยให้เรียบร้อยก่อน
  await ensureThaiFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 48;
  let cursorY = 56;

  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, "PNG", marginX, cursorY - 8, 80, 80); } catch {}
  }

  // หัวเอกสาร
  doc.setFont("THSarabunNew", "bold");
  doc.setFontSize(20);
  doc.text("ใบเสร็จรับเงิน / RECEIPT", pageWidth - marginX, cursorY, { align: "right" });

  doc.setFont("THSarabunNew", "normal");
  doc.setFontSize(12);
  const companyLines = [
    companyName,
    companyAddress,
    companyPhone ? `โทร: ${companyPhone}` : "",
    companyTaxId ? `เลขประจำตัวผู้เสียภาษี: ${companyTaxId}` : "",
  ].filter(Boolean);
  companyLines.forEach((t, i) => doc.text(t, marginX + (logoDataUrl ? 88 : 0), cursorY + 20 + i * 16));

  // กล่องเลขที่/วันที่
  const rightBoxTop = cursorY + 6;
  const rightBoxW = 260;
  const rightBoxX = pageWidth - marginX - rightBoxW;
  const rightBoxH = 70;
  doc.roundedRect(rightBoxX, rightBoxTop, rightBoxW, rightBoxH, 6, 6);
  doc.setFont("THSarabunNew", "bold");
  doc.text("เลขที่ใบเสร็จ:", rightBoxX + 10, rightBoxTop + 22);
  doc.text("วันที่ออกเอกสาร:", rightBoxX + 10, rightBoxTop + 44);
  doc.setFont("THSarabunNew", "normal");
  const fmtDate = (d) => {
    try {
      const dd = d instanceof Date ? d : new Date(d);
      return dd.toLocaleDateString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit" });
    } catch { return String(d || ""); }
  };
  doc.text(receiptNo || "-", rightBoxX + 130, rightBoxTop + 22);
  doc.text(fmtDate(issueDate), rightBoxX + 130, rightBoxTop + 44);

  cursorY = Math.max(cursorY + 100, rightBoxTop + rightBoxH + 16);

  // ข้อมูลลูกค้า
  doc.setFont("THSarabunNew", "bold");
  doc.text("ข้อมูลลูกค้า", marginX, cursorY);
  doc.setFont("THSarabunNew", "normal");
  const custLines = [
    `ชื่อลูกค้า: ${clientName || "-"}`,
    `ที่อยู่: ${clientAddress || "-"}`,
    `โทร: ${clientPhone || "-"}`,
  ];
  custLines.forEach((t, i) => doc.text(t, marginX, cursorY + 20 + i * 16));
  cursorY += 70;

  // รายการตาราง
  const tableBody = (items || []).map((it, idx) => {
    const qty = Number(it.qty ?? it.quantity ?? 1);
    const unit = Number(it.unitPrice ?? it.price ?? 0);
    const amount = qty * unit;
    return [String(idx + 1), String(it.description ?? it.name ?? "-"), String(qty), toMoney(unit), toMoney(amount)];
  });

  const subTotal = (items || []).reduce(
    (sum, it) => sum + (Number(it.qty ?? it.quantity ?? 1) * Number(it.unitPrice ?? it.price ?? 0)),
    0
  );
  const afterDiscount = Math.max(0, subTotal - Number(discount || 0));
  const vat = Math.max(0, afterDiscount * Number(vatRate || 0));
  const grandTotal = afterDiscount + vat;
  const remaining = Math.max(0, grandTotal - Number(alreadyPaid || 0));

  autoTable(doc, {
    startY: cursorY,
    head: [["#", "รายการ", "จำนวน", "ราคาต่อหน่วย", "จำนวนเงิน"]],
    body: tableBody.length ? tableBody : [["-", "-", "-", "-", "-"]],
    styles: { font: "THSarabunNew", fontSize: 12, cellPadding: 6 },
    headStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [240, 240, 240] },
    columnStyles: {
      0: { halign: "center", cellWidth: 28 },
      2: { halign: "right", cellWidth: 60 },
      3: { halign: "right", cellWidth: 100 },
      4: { halign: "right", cellWidth: 110 },
    },
    foot: [
      ["", "", "", "รวม (Subtotal)", toMoney(subTotal)],
      ["", "", "", "ส่วนลด (Discount)", toMoney(discount)],
      ["", "", "", `ภาษีมูลค่าเพิ่ม ${Math.round((vatRate || 0) * 100)}%`, toMoney(vat)],
      ["", "", "", "ยอดสุทธิ (Total)", toMoney(grandTotal)],
      ["", "", "", "ชำระแล้ว (Paid)", toMoney(alreadyPaid)],
      ["", "", "", "คงเหลือ (Balance)", toMoney(remaining)],
    ],
    footStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [250, 250, 250], textColor: 20 },
    theme: "grid",
  });

  const lastY = doc.lastAutoTable?.finalY || cursorY;

  if (notes) {
    doc.setFont("THSarabunNew", "bold");
    doc.text("หมายเหตุ", marginX, lastY + 28);
    doc.setFont("THSarabunNew", "normal");
    textBlock(doc, notes, marginX, lastY + 46, pageWidth - marginX * 2, 16);
  }

  const fname = options.filename || makeFilename(receiptNo, clientName);
  doc.save(fname);
}
