// src/lib/generateReceiptPDF.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ========== utils ========== */
const money = n =>
  Number(n || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const fmtDate = d => {
  try {
    const dd = d instanceof Date ? d : new Date(d);
    return dd.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return String(d || "");
  }
};

/* ========== main ========== */
export default function generateReceiptPDF(payload = {}, options = {}) {
  const {
    companyName = "Siam Guard",
    companyAddress = "",
    companyPhone = "",
    companyTaxId = "",
    logoDataUrl,
    clientName = "",
    clientPhone = "",
    clientAddress = "",
    clientTaxId = "",
    receiptNo = "",
    issueDate = new Date(),
    items = [],
    discount = 0,
    alreadyPaid = 0,
    remarks = [
      "ธนาคารกสิกรไทย เลขที่บัญชี 201-8-860778",
      "Remark: บจก.สยามการ์ดโซลูชั่น (ประเทศไทย) จำกัด",
    ],
    footerNotice =
      "สินค้าตามใบสั่งซื้อนี้เมื่อลูกค้าได้รับมอบและตรวจสอบแล้วถือว่าเป็นทรัพย์สินของผู้ว่าจ้างและจะไม่รับคืนเงิน/คืนสินค้า",
  } = payload;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = 56;

  // ===== โลโก้ =====
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", M, y - 20, 80, 80);
    } catch {}
  }

  // ===== หัวเรื่อง =====
  doc.setFont("THSarabunNew", "bold");
  doc.setFontSize(22);
  doc.text("ใบเสร็จรับเงิน", W / 2, y, { align: "center" });

  // ===== ข้อมูลบริษัท =====
  y += 40;
  doc.setFont("THSarabunNew", "normal");
  doc.setFontSize(12);
  doc.text(companyName, M, y);
  y += 16;
  if (companyAddress) {
    const lines = doc.splitTextToSize(companyAddress, W - M * 2);
    lines.forEach(line => {
      doc.text(line, M, y);
      y += 16;
    });
  }
  if (companyPhone) {
    doc.text(`โทร: ${companyPhone}`, M, y);
    y += 16;
  }
  if (companyTaxId) {
    doc.text(`เลขประจำตัวผู้เสียภาษี: ${companyTaxId}`, M, y);
    y += 16;
  }

  // ===== ข้อมูลลูกค้า/เลขที่เอกสาร =====
  y += 20;
  const leftX = M,
    rightX = W / 2 + 20;
  doc.text(`ชื่อลูกค้า: ${clientName || "-"}`, leftX, y);
  doc.text(`เลขที่: ${receiptNo || "-"}`, rightX, y);
  y += 16;
  doc.text(`ที่อยู่: ${clientAddress || "-"}`, leftX, y);
  doc.text(`วันที่: ${fmtDate(issueDate)}`, rightX, y);
  y += 16;
  doc.text(`โทรศัพท์: ${clientPhone || "-"}`, leftX, y);
  doc.text(`เลขผู้เสียภาษี: ${clientTaxId || "-"}`, rightX, y);
  y += 24;

  // ===== ตารางรายการสินค้า/บริการ =====
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [
      ["ลำดับ", "รายละเอียด", "จำนวน", "ราคาต่อหน่วย", "จำนวนเงิน"],
    ],
    body: (items || []).length
      ? items.map((it, idx) => {
          const qty = Number(it.qty || it.quantity || 1);
          const price = Number(it.unitPrice || it.price || 0);
          return [
            String(idx + 1),
            String(it.description || it.name || ""),
            String(qty),
            money(price),
            money(qty * price),
          ];
        })
      : [["-", "-", "-", "-", "-"]],
    styles: { font: "THSarabunNew", fontSize: 12, lineWidth: 0.3 },
    headStyles: { fillColor: [230, 230, 230] },
    theme: "grid",
  });
  y = doc.lastAutoTable.finalY + 20;

  // ===== คำนวณยอด (ไม่มี VAT) =====
  const subTotal = (items || []).reduce(
    (s, it) => s + Number(it.qty || it.quantity || 1) * Number(it.unitPrice || it.price || 0),
    0
  );
  const afterDiscount = Math.max(0, subTotal - Number(discount || 0));
  const grandTotal = afterDiscount; // << ไม่มี VAT
  const netTotal = Math.max(0, grandTotal - Number(alreadyPaid || 0));

  const rows = [
    ["รวมเงิน", money(subTotal)],
    ...(Number(discount) > 0 ? [["ส่วนลด", `-${money(discount)}`]] : []),
    ...(Number(alreadyPaid) > 0 ? [["หักมัดจำ", `-${money(alreadyPaid)}`]] : []),
    ["รวมเงินทั้งสิ้น", money(netTotal)],
  ];

  rows.forEach(([label, val], i) => {
    doc.text(label, W - M - 200, y + i * 20);
    doc.text(val, W - M - 20, y + i * 20, { align: "right" });
  });
  y += rows.length * 20 + 20;

  // ===== หมายเหตุ =====
  doc.setFont("THSarabunNew", "bold");
  doc.text("หมายเหตุ:", M, y);
  doc.setFont("THSarabunNew", "normal");
  y += 16;
  remarks.forEach(line => {
    const lines = doc.splitTextToSize(line, W - M * 2);
    lines.forEach(ln => {
      doc.text(ln, M, y);
      y += 16;
    });
  });

  // ===== ลายเซ็น =====
  y = H - 100;
  doc.text("ลงชื่อ .................................................. ผู้รับเงิน", W - M - 200, y);

  // ===== บันทึก =====
  const fname = options.filename || `Receipt-${receiptNo || fmtDate(issueDate)}.pdf`;
  doc.save(fname);
}
