// src/lib/generateContractPDF.js
import jsPDF from "jspdf";

/* ===================== Font utils (Thai Sarabun) ===================== */
function ab2b64(buf) {
  const u = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s);
}

// ใช้ชื่อ family ใหม่กันชน cache viewer
const FAMILY = "THSarabunSG";
let THAI_READY = false;

async function ensureThaiFont(doc) {
  if (THAI_READY) {
    doc.setFont(FAMILY, "normal");
    return;
  }
  // โหลดจาก public/fonts (ต้องมีไฟล์จริง) + bust cache
  const v = String(Date.now());
  const regularUrl = `/fonts/THSarabunNew.ttf?v=${v}`;
  const boldUrl = `/fonts/THSarabunNew-Bold.ttf?v=${v}`;

  const [rRes, bRes] = await Promise.all([fetch(regularUrl), fetch(boldUrl)]);
  if (!rRes.ok) throw new Error(`โหลดฟอนต์ไม่สำเร็จ: ${regularUrl}`);
  if (!bRes.ok) throw new Error(`โหลดฟอนต์ไม่สำเร็จ: ${boldUrl}`);

  const [rBuf, bBuf] = await Promise.all([rRes.arrayBuffer(), bRes.arrayBuffer()]);
  doc.addFileToVFS(`${FAMILY}-Regular.ttf`, ab2b64(rBuf));
  doc.addFont(`${FAMILY}-Regular.ttf`, FAMILY, "normal");
  doc.addFileToVFS(`${FAMILY}-Bold.ttf`, ab2b64(bBuf));
  doc.addFont(`${FAMILY}-Bold.ttf`, FAMILY, "bold");

  if (!doc.getFontList?.()[FAMILY]) throw new Error("ฟอนต์ไทยไม่ถูกลงทะเบียนกับ jsPDF");
  THAI_READY = true;
  doc.setFont(FAMILY, "normal");
}

/* ===================== Helpers ===================== */
const A4 = { w: 210, h: 297 }; // mm
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function thaiDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  const months = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}
function compactDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}${mm}${dd}`;
}
function diffMonths(a, b) {
  try {
    const d1 = new Date(a), d2 = new Date(b);
    return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth()) + 1;
  } catch { return "-"; }
}
function sanitize(s = "") {
  return String(s).replace(/[^a-zA-Z0-9ก-๙\-_.]+/g, "_");
}

/* ===================== Main ===================== */
export default async function generateContractPDF(data = {}, options = {}) {
  const {
    company = { name: "Siam Guard Solution", address: "—", phone: "—", taxId: "—" },
    customer = { name: "—", phone: "—", address: "—" },
    contract = {
      number: "",
      startDate: "",
      endDate: "",
      signDate: "",
      serviceType: "",
      packageName: "",
      serviceScope: "",
      frequency: "",
      priceText: "",
      paymentTerm: "ชำระเต็มจำนวนหลังรับบริการครั้งแรก",
      warranty: "รับประกันตลอดอายุสัญญาตามเงื่อนไขบริษัท",
      extraNote: "",
    },
    signatures = { companySignDataUrl: null, customerSignDataUrl: null },
  } = data || {};

  const {
    logoDataUrl = null,
    qrDataUrl = null,
    brand = { primary: "#0ea5e9" },
  } = options || {};

  // สร้างเอกสารหน่วย mm (เหมาะกับการพิมพ์)
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await ensureThaiFont(doc);

  // เมทาดาทา
  doc.setProperties({
    title: `CONTRACT ${contract.number || ""}`,
    author: company.name || "",
    subject: company.address || "",
    creator: company.name || "",
    keywords: [company.phone, company.taxId].filter(Boolean).join(", "),
  });

  const margin = { top: 18, right: 16, bottom: 18, left: 16 };
  const contentW = A4.w - margin.left - margin.right;
  let y = margin.top;

  // helpers วาดข้อความ/บรรทัด
  const line = (len = contentW, offsetY = 3, color = "#e5e7eb") => {
    doc.setDrawColor(color); doc.setLineWidth(0.3);
    doc.line(margin.left, y + offsetY, margin.left + len, y + offsetY);
    y += offsetY + 2;
  };
  const title = (text) => {
    doc.setFont(FAMILY, "bold");
    doc.setFontSize(22); doc.setTextColor(0, 0, 0);
    doc.text(text, A4.w / 2, y, { align: "center" });
    y += 8;
  };
  const paragraph = (text, opt = {}) => {
    const size = clamp(opt.size ?? 16, 10, 24);
    const lineH = clamp(opt.lineH ?? 7, 5, 12);
    doc.setFont(FAMILY, opt.bold ? "bold" : "normal");
    doc.setFontSize(size);
    const rows = doc.splitTextToSize(String(text || ""), contentW);
    rows.forEach((row) => {
      if (y > A4.h - margin.bottom) { doc.addPage(); y = margin.top; }
      doc.text(row, margin.left, y);
      y += lineH;
    });
    y += opt.after ?? 2;
  };
  const bullet = (text, opt = {}) => paragraph(`• ${text}`, opt);
  const drawSignature = (caption, dataUrl) => {
    const boxH = 30, boxW = 70, startX = margin.left + 8;
    doc.setDrawColor("#9ca3af"); doc.rect(startX, y, boxW, boxH);
    if (dataUrl) {
      try { doc.addImage(dataUrl, "PNG", startX + 2, y + 2, boxW - 4, boxH - 8, undefined, "FAST"); }
      catch {}
    }
    doc.setFont(FAMILY, "normal"); doc.setFontSize(14);
    doc.text(`(ลงชื่อ) ${caption}`, startX, y + boxH + 7);
    doc.setDrawColor("#9ca3af");
    doc.line(startX, y + boxH + 9, startX + boxW, y + boxH + 9);
    y += boxH + 16;
  };

  /* ========== Header ========== */
  if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", margin.left, y - 10, 24, 24);
  doc.setFont(FAMILY, "bold"); doc.setFontSize(18); doc.setTextColor(0, 0, 0);
  doc.text(company.name || "Siam Guard Solution", margin.left + 30, y);
  doc.setFont(FAMILY, "normal"); doc.setFontSize(12); doc.setTextColor(80);
  doc.text(
    [
      company.address || "—",
      `โทร. ${company.phone || "—"}`,
      `เลขประจำตัวผู้เสียภาษี: ${company.taxId || "—"}`,
    ],
    margin.left + 30, y + 6
  );
  if (qrDataUrl) doc.addImage(qrDataUrl, "PNG", A4.w - margin.right - 28, margin.top - 6, 28, 28);
  y += 14; doc.setDrawColor(brand.primary); line(contentW, 2, brand.primary);

  /* ========== Title ========== */
  title("สัญญาให้บริการกำจัดปลวก/แมลง");
  doc.setFont(FAMILY, "normal"); doc.setFontSize(14); doc.setTextColor(80);
  doc.text(`เลขที่สัญญา: ${contract.number || "—"}`, margin.left, y);
  y += 8; line();

  /* ========== Parties ========== */
  paragraph(
    `สัญญาฉบับนี้ทำขึ้น ณ วันที่ ${thaiDate(contract.signDate)} ระหว่าง ${company.name} (ต่อไปนี้เรียกว่า “ผู้ให้บริการ”) ` +
    `และคุณ ${customer.name} โทร. ${customer.phone} ที่อยู่ ${customer.address} (ต่อไปนี้เรียกว่า “ผู้ว่าจ้าง”) ` +
    `ซึ่งได้ตกลงทำสัญญากันดังต่อไปนี้`
  );

  /* ========== Service info ========== */
  bullet(`ประเภทบริการ: ${contract.serviceType || "—"}  /  แพ็กเกจ: ${contract.packageName || "—"}`);
  bullet(
    `ระยะเวลา: ${thaiDate(contract.startDate)} ถึง ${thaiDate(contract.endDate)} ` +
    `(รวม ${diffMonths(contract.startDate, contract.endDate)} เดือน)`
  );
  bullet(`ความถี่การบริการ: ${contract.frequency || "—"}`);
  bullet(`ค่าบริการ: ${contract.priceText || "—"}  เงื่อนไขชำระเงิน: ${contract.paymentTerm || "—"}`);
  if (contract.serviceScope) bullet(`ขอบเขตงาน: ${contract.serviceScope}`);
  if (contract.warranty)    bullet(`การรับประกัน: ${contract.warranty}`);
  if (contract.extraNote)   bullet(`หมายเหตุเพิ่มเติม: ${contract.extraNote}`);
  y += 2; line();

  /* ========== Clauses ========== */
  [
    "ผู้ให้บริการจะดำเนินงานตามมาตรฐานความปลอดภัย โดยใช้สารเคมี/ระบบที่ได้รับอนุญาตตามกฎหมาย",
    "ผู้ว่าจ้างอำนวยความสะดวกให้เข้าพื้นที่ตามนัด หากเลื่อนโปรดแจ้งล่วงหน้า 24 ชม.",
    "ระหว่างอายุสัญญา หากพบการระบาด ผู้ว่าจ้างร้องขอบริการแก้ไขได้ตามเงื่อนไขรับประกัน",
    "กรณีผิดนัดชำระ ผู้ให้บริการอาจเลื่อน/ระงับบริการจนกว่าจะชำระครบ",
    "คู่สัญญาเลิกสัญญาได้ หากอีกฝ่ายผิดสัญญาอย่างมีนัยสำคัญและไม่แก้ไขภายใน 15 วันนับแต่ได้รับแจ้ง",
    "สัญญานี้อยู่ภายใต้กฎหมายไทย และศาลไทยมีอำนาจ",
  ].forEach((c, i) => paragraph(`ข้อ ${i + 1}. ${c}`));

  y += 2; line();

  /* ========== Signatures ========== */
  paragraph("ลงชื่อคู่สัญญา", { bold: true, size: 16, after: 4 });
  drawSignature(`ผู้ว่าจ้าง (ลูกค้า): ${customer.name || ""}`, signatures.customerSignDataUrl);
  drawSignature(`ผู้ให้บริการ (บริษัท): ${company.name || ""}`, signatures.companySignDataUrl);

  doc.setFont(FAMILY, "normal"); doc.setFontSize(14);
  doc.text(`ลงนาม ณ วันที่ ${thaiDate(contract.signDate)}`, margin.left, y + 6);

  /* ========== Appendix note ========== */
  y += 14;
  paragraph("ภาคผนวก A – เอกสารแนบท้าย “เจต.pdf” ให้ถือเป็นส่วนหนึ่งของสัญญา", { size: 14 });

  const fileName = `CONTRACT-${contract.number || compactDate(contract.signDate)}-${sanitize(customer.name)}.pdf`;
  doc.save(fileName);
}
