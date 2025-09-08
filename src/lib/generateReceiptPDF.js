// src/lib/generateReceiptPDF.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/** ArrayBuffer -> base64 (สำหรับ addFileToVFS) */
function ab2b64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** โหลดและลงทะเบียนฟอนต์ไทย (cache ครั้งเดียว) */
let _thaiFontReady = false;
async function ensureThaiFont(doc) {
  if (_thaiFontReady) { doc.setFont("THSarabunNew", "normal"); return; }

  const base =
    (typeof process !== "undefined" &&
      process.env &&
      process.env.PUBLIC_URL &&
      process.env.PUBLIC_URL.replace(/\/$/, "")) || "";
  const ver = (typeof window !== "undefined" && window.__FONT_VER__) || "1";

  const regularUrl = `${base}/fonts/THSarabunNew.ttf?v=${ver}`;
  const boldUrl    = `${base}/fonts/THSarabunNew-Bold.ttf?v=${ver}`;

  const [rRes, bRes] = await Promise.all([fetch(regularUrl), fetch(boldUrl)]);
  if (!rRes.ok) throw new Error("โหลดฟอนต์ THSarabunNew.ttf ไม่สำเร็จ");
  if (!bRes.ok) throw new Error("โหลดฟอนต์ THSarabunNew-Bold.ttf ไม่สำเร็จ");

  const [rBuf, bBuf] = await Promise.all([rRes.arrayBuffer(), bRes.arrayBuffer()]);
  doc.addFileToVFS("THSarabunNew-Regular.ttf", ab2b64(rBuf));
  doc.addFont("THSarabunNew-Regular.ttf", "THSarabunNew", "normal");
  doc.addFileToVFS("THSarabunNew-Bold.ttf", ab2b64(bBuf));
  doc.addFont("THSarabunNew-Bold.ttf", "THSarabunNew", "bold");

  _thaiFontReady = true;
  doc.setFont("THSarabunNew", "normal");
}

const money = (n) =>
  Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d) => {
  try {
    const dd = d instanceof Date ? d : new Date(d);
    // 24/08/2568
    return dd.toLocaleDateString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch { return String(d || ""); }
};

function textBlock(doc, text, x, y, maxWidth, lh = 16) {
  const lines = doc.splitTextToSize(String(text || ""), maxWidth);
  lines.forEach((ln, i) => doc.text(ln, x, y + i * lh));
  return y + (lines.length - 1) * lh;
}

/**
 * payload ที่ใช้:
 * companyName, companyAddress, companyPhone, companyTaxId, logoDataUrl
 * clientName, clientPhone, clientAddress, clientTaxId, customerCode
 * receiptNo, issueDate, poNumber, termDays, dueDate
 * items[{ description, qty, unitPrice }], discount, vatRate, alreadyPaid, notes, bankRemark
 * footerNotice (ข้อความท้ายเอกสาร)
 */
export default async function generateReceiptPDF(payload = {}, options = {}) {
  const {
    // บริษัท
    companyName = "Siam Guard",
    companyAddress = "",
    companyPhone = "",
    companyTaxId = "",
    logoDataUrl,

    // ลูกค้า
    customerCode = "",
    clientName = "",
    clientPhone = "",
    clientAddress = "",
    clientTaxId = "",

    // เอกสาร
    receiptNo = "",
    issueDate = new Date(),
    poNumber = "",
    termDays = 0,
    dueDate,

    // รายการ/สรุปยอด
    items = [],
    discount = 0,
    vatRate = 0.07,
    alreadyPaid = 0, // มัดจำ
    notes = "",
    bankRemark = "",

    // ข้อความประกาศท้ายใบเสร็จ
    footerNotice = "สินค้าตามใบสั่งซื้อนี้เมื่อลูกค้าได้รับมอบและตรวจสอบแล้วถือว่าเป็นทรัพย์สินของผู้ว่าจ้างและจะไม่รับคืนเงิน/คืนสินค้า",
  } = payload;

  const _due = dueDate || new Date(new Date(issueDate).getTime() + termDays * 86400000);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await ensureThaiFont(doc);

    // ใช้ข้อมูลบริษัทเป็น metadata ของไฟล์ (แก้ no-unused-vars)
    doc.setProperties({
        title: `ใบเสร็จรับเงิน ${payload.receiptNo || ""}`,
        author: companyName || "",
        subject: companyAddress || "",
        creator: companyName || "",
        keywords: [companyPhone, companyTaxId].filter(Boolean).join(", "),
    });

  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  let y = 56;

  // โลโก้ (ถ้ามี)
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, "PNG", M, y - 8, 80, 80); } catch {}
  }

  // ชื่อเอกสาร (ไทยล้วน)
  doc.setFont("THSarabunNew", "bold"); doc.setFontSize(22);
  doc.text("ใบเสร็จรับเงิน", W / 2, y, { align: "center" });

  // กล่องข้อมูลซ้าย (ลูกค้า)
  const leftX = M, leftW = 380, leftPad = 10;
  const addrLines = doc.splitTextToSize(clientAddress || "-", leftW - leftPad * 2);
  const leftLines = [
    `รหัสลูกค้า: ${customerCode || "-"}`,
    `ชื่อลูกค้า: ${clientName || "-"}`,
    `เลขประจำตัวผู้เสียภาษี: ${clientTaxId || "-"}`,
    `ที่อยู่:`,
    ...addrLines,
    `โทรศัพท์: ${clientPhone || "-"}`,
  ];
  const leftH = leftPad * 2 + leftLines.length * 16 + 2;

  doc.roundedRect(leftX, y + 20, leftW, leftH, 6, 6);
  doc.setFont("THSarabunNew", "normal"); doc.setFontSize(12);
  let ly = y + 20 + leftPad + 6;
  leftLines.forEach((t) => { doc.text(t, leftX + leftPad, ly); ly += 16; });

  // กล่องข้อมูลขวา (เอกสาร)
  const rightW = 240, rightX = W - M - rightW, rightPad = 10;
  const rightLines = [
    `เลขที่: ${receiptNo || "-"}`,
    `วันที่: ${fmtDate(issueDate)}`,
    `เลขที่ใบสั่งซื้อ: ${poNumber || "-"}`,
    `เงื่อนไขการชำระเงิน: ${Number(termDays || 0)} วัน`,
    `ครบกำหนดชำระ: ${fmtDate(_due)}`,
  ];
  const rightH = rightPad * 2 + rightLines.length * 16 + 2;

  doc.roundedRect(rightX, y + 20, rightW, rightH, 6, 6);
  let ry = y + 20 + rightPad + 6;
  rightLines.forEach((t) => { doc.text(t, rightX + rightPad, ry); ry += 16; });

  y = Math.max(y + 20 + leftH, y + 20 + rightH) + 16;

  // ตารางสินค้า/บริการ (หัวคอลัมน์ไทย)
  const head = [[
    "ลำดับ",
    "จำนวน",
    "รหัสสินค้า / รายละเอียดสินค้า",
    "ราคา / หน่วย",
    "จำนวนเงิน",
  ]];

  const body = (items || []).map((it, idx) => {
    const qty = Number(it.qty ?? it.quantity ?? 1);
    const unit = Number(it.unitPrice ?? it.price ?? 0);
    const amount = qty * unit;
    const desc = String(it.description ?? it.name ?? "");
    return [String(idx + 1), String(qty), desc, money(unit), money(amount)];
  });

  const subTotal =
    (items || []).reduce((s, it) =>
      s + Number(it.qty ?? it.quantity ?? 1) * Number(it.unitPrice ?? it.price ?? 0), 0);

  const afterDiscount = Math.max(0, subTotal - Number(discount || 0));
  const vat = Math.max(0, afterDiscount * Number(vatRate || 0));
  const grandTotal = afterDiscount + vat;
  const deposit = Number(alreadyPaid || 0);
  const netTotal = Math.max(0, grandTotal - deposit);

  autoTable(doc, {
    startY: y,
    head,
    body: body.length ? body : [["-", "-", "-", "-", "-"]],
    styles: { font: "THSarabunNew", fontSize: 12, cellPadding: 6, lineWidth: 0.2 },
    headStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [245, 245, 245] },
    columnStyles: {
      0: { halign: "center", cellWidth: 40 },
      1: { halign: "center", cellWidth: 70 },
      2: { cellWidth: W - (M * 2 + 40 + 70 + 90 + 100) }, // กินพื้นที่ที่เหลือ
      3: { halign: "right", cellWidth: 90 },
      4: { halign: "right", cellWidth: 100 },
    },
    theme: "grid",
  });

  const tEnd = doc.lastAutoTable?.finalY || y;

  // ส่วนล่าง: หมายเหตุ (ซ้าย) + กล่องสรุปยอด (ขวา)
  const totalsW = 240;
  const totalsX = W - M - totalsW;
  const lineH = 24;

  // หมายเหตุ (ซ้าย)
  const remarkX = M;
  const remarkW = totalsX - M - 12;
  let noteY = tEnd + 16;

  const firstRemark = bankRemark ? `หมายเหตุ: ${bankRemark}` : "หมายเหตุ:";
  doc.setFont("THSarabunNew", "normal"); doc.setFontSize(12);
  textBlock(doc, firstRemark, remarkX, noteY, remarkW);
  if (notes) {
    noteY += 18;
    textBlock(doc, notes, remarkX, noteY, remarkW);
  }

  // กล่องสรุปยอด (ขวา)
  let ty = tEnd + 6;
  const rows = [
    ["รวมเงิน", money(subTotal), "normal"],
  ];
  if (Number(discount) > 0) rows.push(["ส่วนลด", `-${money(discount)}`, "normal"]);
  rows.push([`ภาษีมูลค่าเพิ่ม ${Math.round((vatRate || 0) * 100)}%`, money(vat), "normal"]);
  if (deposit > 0) rows.push(["หักมัดจำ", `-${money(deposit)}`, "highlight"]);
  rows.push(["รวมเงินทั้งสิ้น", money(netTotal), "bold"]);

  doc.setFontSize(12);
  rows.forEach(([label, val, style]) => {
    // พื้นหลังแถว (เฉพาะ "หักมัดจำ" ให้เป็นแถบฟ้า)
    if (style === "highlight") {
      doc.setFillColor(200, 228, 245);
      doc.rect(totalsX, ty, totalsW, lineH, "F");
    } else {
      doc.setDrawColor(230); doc.rect(totalsX, ty, totalsW, lineH);
    }
    // เส้นแบ่ง label|value บาง ๆ
    const mid = totalsX + totalsW - 110;

    doc.setFont("THSarabunNew", style === "bold" ? "bold" : "normal");
    doc.text(label, totalsX + 10, ty + 16);
    doc.text(val, totalsX + totalsW - 10, ty + 16, { align: "right" });

    doc.setDrawColor(235);
    doc.line(mid, ty, mid, ty + lineH);

    ty += lineH;
  });

  // ข้อความยืนยันรับเงิน + กล่องวิธีชำระเงิน + ช่องเซ็นชื่อ
  const boxY = Math.max(noteY + 60, ty + 10);
  doc.setFont("THSarabunNew", "normal");
  doc.text("ได้รับเงินดังรายการข้างต้นในใบเสร็จฯเรียบร้อย", M, boxY);

  // กล่องวิธีชำระเงิน
  const payY = boxY + 12;
  const payH = 88;
  doc.roundedRect(M, payY, W - M * 2, payH, 6, 6);
  let py = payY + 20;
  doc.text("การชำระเงิน:", M + 10, py); py += 18;
  doc.text("เช็คธนาคาร / สาขา: ____________________", M + 28, py); py += 18;
  doc.text("เลขที่บัญชี: ____________________", M + 28, py); py += 18;
  doc.text("ลงวันที่: ____________________", M + 28, py);

  // ช่องเซ็นชื่อ 3 ช่อง
  const signY = payY + payH + 16;
  const signW = (W - M * 2 - 32) / 3;
  for (let i = 0; i < 3; i++) {
    const x = M + i * (signW + 16);
    doc.line(x + 24, signY + 40, x + signW - 24, signY + 40);
    const label = i === 0 ? "ผู้รับเงิน" : (i === 1 ? "ผู้รับสินค้า" : "ผู้มีอำนาจลงนาม");
    doc.text(label, x + signW / 2, signY + 58, { align: "center" });
  }

  // ข้อความท้ายเอกสาร
  doc.setFont("THSarabunNew", "normal");
  doc.setFontSize(11);
  doc.text(footerNotice, M, signY + 90);

  const fname = options.filename || `Receipt-${receiptNo || fmtDate(issueDate)}.pdf`;
  doc.save(fname);
}
