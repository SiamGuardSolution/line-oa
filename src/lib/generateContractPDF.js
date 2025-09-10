// src/lib/generateContractPDF.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ---------- helpers ---------- */
const T = (v) => Array.isArray(v) ? v.map(x => String(x ?? "")) : String(v ?? "");
const fmtThaiDate = (d) => {
  try {
    const dd = d instanceof Date ? d : new Date(d);
    return dd.toLocaleDateString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch { return String(d || ""); }
};

/* ---------- font loader (same pattern as generateReceiptPDF) ---------- */
const FAMILY = "THSarabunSG";
let B64_REG = null, B64_BOLD = null;
const REGISTERED = new WeakSet();
function ab2b64(buf){ const u=new Uint8Array(buf); let s=""; for(let i=0;i<u.length;i++) s+=String.fromCharCode(u[i]); return btoa(s); }

async function loadFontsB64(){
  if (B64_REG && B64_BOLD) return { reg: B64_REG, bold: B64_BOLD };
  const [rRes, bRes] = await Promise.all([
    fetch("/fonts/THSarabunNew.ttf"),
    fetch("/fonts/THSarabunNew-Bold.ttf"),
  ]);
  if (!rRes.ok || !bRes.ok) throw new Error("โหลดฟอนต์ไม่สำเร็จ");
  const [rBuf, bBuf] = await Promise.all([rRes.arrayBuffer(), bRes.arrayBuffer()]);
  B64_REG = ab2b64(rBuf); B64_BOLD = ab2b64(bBuf);
  return { reg: B64_REG, bold: B64_BOLD };
}
async function ensureThaiFont(doc){
  if (REGISTERED.has(doc) && doc.getFontList?.()[FAMILY]) { doc.setFont(FAMILY, "normal"); return; }
  const { reg, bold } = await loadFontsB64();
  doc.addFileToVFS(`${FAMILY}-Regular.ttf`, reg);  doc.addFont(`${FAMILY}-Regular.ttf`, FAMILY, "normal");
  doc.addFileToVFS(`${FAMILY}-Bold.ttf`,    bold); doc.addFont(`${FAMILY}-Bold.ttf`,    FAMILY, "bold");
  if (!doc.getFontList?.()[FAMILY]) throw new Error("ฟอนต์ไทยไม่ถูกลงทะเบียนกับ jsPDF");
  REGISTERED.add(doc); doc.setFont(FAMILY, "normal");
}

/* ---------- main ---------- */
/**
 * @param {Object} data
 * {
 *   contractNumber, contractDate, startDate, endDate,
 *   company: { name, address, phone, taxId },
 *   client:  { name, phone, address, facebook, taxId },
 *   service: { type, packageName, basePrice, addons:[{name, price}] },
 *   schedule: [{round, date, note}],
 *   terms: [ "..." ],
 *   signatures: { companyRep, clientRep },
 *   logoDataUrl?
 * }
 * @param {Object} opts  { fileName }
 */
export default async function generateContractPDF(data = {}, opts = {}) {
  const {
    contractNumber = "",
    contractDate   = new Date(),
    startDate,
    endDate,
    company   = {},
    client    = {},
    service   = {},
    schedule  = [],
    terms     = [],
    signatures = {},
    logoDataUrl,
  } = data;

  const fileName = opts.fileName || `Contract_${contractNumber || Date.now()}.pdf`;
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: false });
  await ensureThaiFont(doc);
  doc.setFontSize(12);

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = 56;

  // โลโก้ (ถ้ามี)
  if (logoDataUrl) { try { doc.addImage(logoDataUrl, "PNG", M, y - 8, 80, 80); } catch {} }

  // หัวกระดาษ
  doc.setFont(FAMILY, "bold"); doc.setFontSize(20);
  doc.text(T("สัญญาบริการกำจัดปลวก"), W / 2, y, { align: "center" });
  doc.setFont(FAMILY, "normal"); doc.setFontSize(12);

  // กล่องข้อมูลบริษัท/สัญญา (สองคอลัมน์)
  const contentW = W - M * 2, pad = 10, lineH = 16;
  let leftW = Math.max(260, Math.round(contentW * 0.55));
  let rightW = contentW - leftW; if (rightW < 220) { rightW = 220; leftW = contentW - rightW; }
  const boxX = M, boxY = y + 18;

  const leftLines = [
    `ผู้ให้บริการ: ${company.name || "-"}`,
    ...doc.splitTextToSize(`ที่อยู่: ${company.address || "-"}`, leftW - pad * 2),
    `โทรศัพท์: ${company.phone || "-"}`,
    `เลขประจำตัวผู้เสียภาษี: ${company.taxId || "-"}`,
  ];
  const rightLines = [
    `เลขที่สัญญา: ${contractNumber || "-"}`,
    `วันที่ทำสัญญา: ${fmtThaiDate(contractDate)}`,
    `เริ่มให้บริการ: ${fmtThaiDate(startDate || "-")}`,
    `สิ้นสุดสัญญา: ${fmtThaiDate(endDate || "-")}`,
  ];
  const leftH = pad * 2 + leftLines.length * lineH + 2;
  const rightH = pad * 2 + rightLines.length * lineH + 2;
  const boxH = Math.max(leftH, rightH);

  doc.roundedRect(boxX, boxY, contentW, boxH, 6, 6);
  doc.setDrawColor(230); doc.line(boxX + leftW, boxY, boxX + leftW, boxY + boxH);

  let ly = boxY + pad + 6; leftLines.forEach(t => { doc.text(T(t), boxX + pad, ly); ly += lineH; });
  let ry = boxY + pad + 6; rightLines.forEach(t => { doc.text(T(t), boxX + leftW + pad, ry); ry += lineH; });

  y = boxY + boxH + 16;

  // ผู้รับบริการ
  const custLines = [
    `ผู้รับบริการ: ${client.name || "-"}`,
    `เลขประจำตัวผู้เสียภาษี: ${client.taxId || "-"}`,
    ...doc.splitTextToSize(`ที่อยู่: ${client.address || "-"}`, contentW),
    `โทรศัพท์: ${client.phone || "-"}`,
    client.facebook ? `Facebook/Line: ${client.facebook}` : "",
  ].filter(Boolean);
  custLines.forEach((t, i) => doc.text(T(t), M, y + i * 16));
  y += custLines.length * 16 + 10;

  // รายละเอียดแพ็กเกจ
  const s = service || {};
  const addons = Array.isArray(s.addons) ? s.addons : [];
  const pkgLines = [
    s.type ? `ประเภทบริการ: ${s.type}` : "",
    s.packageName ? `แพ็กเกจ: ${s.packageName}` : "",
    (s.basePrice != null) ? `ราคาแพ็กเกจ: ${Number(s.basePrice).toLocaleString("th-TH")} บาท` : "",
  ].filter(Boolean);
  pkgLines.forEach((t, i) => doc.text(T(t), M, y + i * 16));
  y += pkgLines.length * 16 + 6;

  // ตาราง Add-on
  if (addons.length) {
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      tableWidth: contentW,
      head: [["รายการเสริม (Add-on)", "ราคา (บาท)"]],
      body: addons.map(a => [a.name || "-", (a.price != null ? Number(a.price).toLocaleString("th-TH") : "-")]),
      styles: { font: FAMILY, fontSize: 12, cellPadding: 6, lineWidth: 0.4, lineColor: [180, 180, 180] },
      headStyles: { font: FAMILY, fontStyle: "bold", fillColor: [220, 220, 220], textColor: [0, 0, 0], lineWidth: 0.6 },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      theme: "grid",
    });
    y = doc.lastAutoTable?.finalY + 12;
  }

  // ตารางรอบบริการ
  if (schedule.length) {
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      tableWidth: contentW,
      head: [["รอบที่", "วันที่", "หมายเหตุ"]],
      body: schedule.map(sv => [String(sv.round ?? ""), fmtThaiDate(sv.date || ""), sv.note || ""]),
      styles: { font: FAMILY, fontSize: 12, cellPadding: 6, lineWidth: 0.4, lineColor: [180, 180, 180] },
      headStyles: { font: FAMILY, fontStyle: "bold", fillColor: [220, 220, 220], textColor: [0, 0, 0], lineWidth: 0.6 },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      theme: "grid",
    });
    y = doc.lastAutoTable?.finalY + 12;
  }

  // ข้อกำหนดและเงื่อนไข (ใช้ for-loop ทั้งชั้นนอก/ใน เพื่อลด no-loop-func)
if (terms.length) {
  doc.setFont(FAMILY, "bold");
  doc.text(T("ข้อกำหนดและเงื่อนไข"), M, y);
  doc.setFont(FAMILY, "normal");
  y += 10;

  const maxW = W - M * 2;

  for (let i = 0; i < terms.length; i++) {
    const lines = doc.splitTextToSize(`${i + 1}. ${terms[i]}`, maxW);
    const needH = lines.length * 14 + 6;

    if (y + needH > H - 180) {
      doc.addPage();
      await ensureThaiFont(doc);
      y = 56;
    }

    // ✅ ใช้ลูปปกติแทน forEach เพื่อไม่สร้างฟังก์ชันในลูป
    const baseY = y;
    for (let j = 0; j < lines.length; j++) {
      doc.text(T(lines[j]), M, baseY + j * 14);
    }
    y = baseY + lines.length * 14 + 6;
  }
}

  // พื้นที่ลายเซ็น (ตรึงไว้ใกล้ล่าง)
  y = Math.max(y, H - 200);
  const gap = 24;
  const colW = (W - M * 2 - gap) / 2;
  const boxH2 = 110;

  // บริษัท
  doc.roundedRect(M, y, colW, boxH2, 6, 6);
  doc.text(T("ลงชื่อผู้แทนบริษัท"), M + 12, y + 20);
  doc.text(T("(.................................................)"), M + 12, y + 84);
  if (signatures.companyRep) doc.text(T(`ชื่อ: ${signatures.companyRep}`), M + 12, y + 100);

  // ลูกค้า
  const rightX = M + colW + gap;
  doc.roundedRect(rightX, y, colW, boxH2, 6, 6);
  doc.text(T("ลงชื่อลูกค้า/ผู้ว่าจ้าง"), rightX + 12, y + 20);
  doc.text(T("(.................................................)"), rightX + 12, y + 84);
  if (signatures.clientRep) doc.text(T(`ชื่อ: ${signatures.clientRep}`), rightX + 12, y + 100);

  // บันทึกไฟล์
  doc.save(fileName);
}
