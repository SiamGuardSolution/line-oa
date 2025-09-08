// src/lib/generateReceiptPDF.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

export default function generateReceiptPDF(payload = {}, options = {}) {
  const {
    companyName = "Siam Guard",
    companyAddress = "",
    companyPhone = "",
    companyTaxId = "",
    logoDataUrl, // optional base64

    // ลูกค้า
    clientName = "",
    clientPhone = "",
    clientAddress = "",

    // เอกสาร
    receiptNo = "",
    issueDate = new Date(),

    // รายการ/สรุปยอด
    items = [],           // [{ description, qty, unitPrice }]
    discount = 0,
    vatRate = 0,          // ปรับเป็น 0.07 ถ้าต้องการคิด VAT
    alreadyPaid = 0,
    notes = "",
  } = payload;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 48;
  let cursorY = 56;

  // โลโก้
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, "PNG", marginX, cursorY - 8, 80, 80); } catch {}
  }

  // หัวเอกสาร
  doc.setFontSize(18);
  doc.setFont(undefined, "bold");
  doc.text("ใบเสร็จรับเงิน / RECEIPT", pageWidth - marginX, cursorY, { align: "right" });

  doc.setFontSize(11);
  doc.setFont(undefined, "normal");
  const companyLines = [
    companyName,
    companyAddress,
    companyPhone ? `โทร: ${companyPhone}` : "",
    companyTaxId ? `เลขประจำตัวผู้เสียภาษี: ${companyTaxId}` : "",
  ].filter(Boolean);
  companyLines.forEach((t, i) => doc.text(t, marginX + (logoDataUrl ? 88 : 0), cursorY + 18 + i * 14));

  // กล่องเลขที่/วันที่
  const rightBoxTop = cursorY + 6;
  const rightBoxW = 260;
  const rightBoxX = pageWidth - marginX - rightBoxW;
  const rightBoxH = 70;
  doc.roundedRect(rightBoxX, rightBoxTop, rightBoxW, rightBoxH, 6, 6);
  doc.setFont(undefined, "bold");
  doc.text("เลขที่ใบเสร็จ:", rightBoxX + 10, rightBoxTop + 20);
  doc.text("วันที่ออกเอกสาร:", rightBoxX + 10, rightBoxTop + 42);
  doc.setFont(undefined, "normal");
  const fmtDate = (d) => {
    try {
      const dd = d instanceof Date ? d : new Date(d);
      return dd.toLocaleDateString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit" });
    } catch { return String(d || ""); }
  };
  doc.text(receiptNo || "-", rightBoxX + 130, rightBoxTop + 20);
  doc.text(fmtDate(issueDate), rightBoxX + 130, rightBoxTop + 42);

  cursorY = Math.max(cursorY + 100, rightBoxTop + rightBoxH + 16);

  // ข้อมูลลูกค้า
  doc.setFont(undefined, "bold");
  doc.text("ข้อมูลลูกค้า", marginX, cursorY);
  doc.setFont(undefined, "normal");
  const custLines = [
    `ชื่อลูกค้า: ${clientName || "-"}`,
    `ที่อยู่: ${clientAddress || "-"}`,
    `โทร: ${clientPhone || "-"}`,
  ];
  custLines.forEach((t, i) => doc.text(t, marginX, cursorY + 18 + i * 14));
  cursorY += 66;

  // รายการ
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
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [240, 240, 240] },
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
    footStyles: { fillColor: [250, 250, 250], textColor: 20, fontStyle: "bold" },
    theme: "grid",
  });

  const lastY = doc.lastAutoTable?.finalY || cursorY;

  if (notes) {
    doc.setFont(undefined, "bold");
    doc.text("หมายเหตุ", marginX, lastY + 28);
    doc.setFont(undefined, "normal");
    textBlock(doc, notes, marginX, lastY + 44, pageWidth - marginX * 2, 14);
  }

  const fname = options.filename || makeFilename(receiptNo, clientName);
  doc.save(fname);
}
