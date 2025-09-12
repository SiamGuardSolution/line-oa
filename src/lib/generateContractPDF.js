// src/lib/generateContractPDF.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ---------- helpers ---------- */
const T = (v) => Array.isArray(v) ? v.map(x => String(x ?? "")) : String(v ?? "");
const fmtThaiDate = (d) => {
  try {
    if (!d) return "";
    const dd = d instanceof Date ? d : new Date(d);
    return dd.toLocaleDateString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch { return String(d || ""); }
};
const addMonths = (date, months) => {
  if (!date) return null;
  const d = date instanceof Date ? new Date(date) : new Date(date);
  if (isNaN(d)) return null;
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0); // รักษาวันสิ้นเดือน
  return d;
};

/* ---------- spacing presets ---------- */
const SPACING = {
  afterTable: 22,
  afterTermsHeader: 10,
  termLine: 15,
  termItemGap: 10,
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
 *   company: { name, address, phone },
 *   client:  { name, phone, address, facebook },
 *   service: { type, packageName, basePrice, addons:[{name, price}], intervalMonths?:number, autoDueFirstN?:number },
 *   schedule: [ { round, dueDate?, date?, visitDate?, visit?, note? }, ... ], // ใช้เป็นค่ากำหนดเองแทน auto-gen ได้
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
    startDate, // ✅ เพิ่มรองรับ
    endDate,
    company   = {},
    client    = {},
    service   = {},
    schedule  = [],
    terms     = [],
    signatures = {},
    logoDataUrl,
  } = data;

  const intervalMonths = Number(service.intervalMonths ?? 4);
  const autoDueFirstN  = Number(service.autoDueFirstN ?? 3);

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
  ];
  const rightLines = [
    `เลขที่สัญญา: ${contractNumber || "-"}`,
    `วันที่ทำสัญญา: ${fmtThaiDate(contractDate)}`,
    `เริ่มต้นสัญญา: ${fmtThaiDate(startDate)}`,
    `สิ้นสุดสัญญา: ${fmtThaiDate(endDate)}`,
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
    y = (doc.lastAutoTable?.finalY || y) + SPACING.afterTable;
  }

  /* ===== ตารางรอบบริการแบบเทมเพลต: 3 แถวบน + 5 แถวล่าง ===== */
  // เตรียมข้อมูล 8 แถว: ใช้ schedule ถ้ามี, ไม่งั้น auto-gen 'วันครบกำหนด' จาก startDate
  const MAX_ROWS = 8;
  const sched = [];
  for (let i = 0; i < MAX_ROWS; i++) {
    const item = schedule[i] || {};
    const dueRaw   = item.dueDate ?? item.due ?? item.date;
    const visitRaw = item.visitDate ?? item.visit ?? "";
    const note     = item.note ?? "";
    let due = fmtThaiDate(dueRaw);

    // ถ้าไม่มี schedule และมี startDate => เติมอัตโนมัติเฉพาะช่วงแรกตาม autoDueFirstN
    if (!schedule.length && startDate && i < autoDueFirstN) {
      const d = addMonths(startDate, intervalMonths * (i + 1));
      due = fmtThaiDate(d);
    }
    sched.push({ due, visit: fmtThaiDate(visitRaw), note });
  }

  const headCols = [
    "ครั้งที่",
    "วันครบกำหนด",
    "วันที่นัดเข้าบริการ",
    "ลงชื่อเข้าบริการ",
    "ลงชื่อผู้รับบริการ",
    "หมายเหตุ",
  ];

  // ตารางบน (3 แถว)
  autoTable(doc, {
    startY: y,
    head: [headCols],
    body: Array.from({ length: 3 }, (_, i) => [
      String(i + 1),
      sched[i]?.due || "",
      sched[i]?.visit || "",
      "",
      "",
      sched[i]?.note || "",
    ]),
    styles: { font: FAMILY, fontSize: 10, cellPadding: 2 },
    headStyles: { font: FAMILY, fontStyle: "bold", fillColor: [225, 233, 245], textColor: 0 },
    theme: "grid",
    margin: { left: M, right: M },
    columnStyles: {
      0: { cellWidth: 32, halign: "center" },
      1: { cellWidth: 90, halign: "center" },
      2: { cellWidth: 110, halign: "center" },
      3: { cellWidth: 110 },
      4: { cellWidth: 110 },
      5: { cellWidth: "auto" },
    },
  });
  y = (doc.lastAutoTable?.finalY || y) + 8;

  // ตารางล่าง (5 แถว)
  autoTable(doc, {
    startY: y,
    head: [headCols],
    body: Array.from({ length: 5 }, (_, i) => {
      const idx = i + 3; // 4..8
      return [
        String(idx + 1),
        sched[idx]?.due || "",
        sched[idx]?.visit || "",
        "",
        "",
        sched[idx]?.note || "",
      ];
    }),
    styles: { font: FAMILY, fontSize: 10, cellPadding: 2 },
    headStyles: { font: FAMILY, fontStyle: "bold", fillColor: [225, 233, 245], textColor: 0 },
    theme: "grid",
    margin: { left: M, right: M },
    columnStyles: {
      0: { cellWidth: 32, halign: "center" },
      1: { cellWidth: 90, halign: "center" },
      2: { cellWidth: 110, halign: "center" },
      3: { cellWidth: 110 },
      4: { cellWidth: 110 },
      5: { cellWidth: "auto" },
    },
  });
  y = (doc.lastAutoTable?.finalY || y) + SPACING.afterTable;

  /* ---------- ข้อกำหนดและเงื่อนไข (ตัดหน้าให้อัตโนมัติ) ---------- */
  if (terms.length) {
    doc.setFont(FAMILY, "bold");
    doc.text(T("ข้อกำหนดและเงื่อนไข"), M, y);
    doc.setFont(FAMILY, "normal");
    y += SPACING.afterTermsHeader;

    const maxW = W - M * 2;

    for (let i = 0; i < terms.length; i++) {
      const lines = doc.splitTextToSize(`${i + 1}. ${terms[i]}`, maxW);
      const needH = lines.length * SPACING.termLine + SPACING.termItemGap;

      if (y + needH > H - 200) {
        doc.addPage();
        await ensureThaiFont(doc);
        y = 56;
      }

      const baseY = y;
      for (let j = 0; j < lines.length; j++) {
        doc.text(T(lines[j]), M, baseY + j * SPACING.termLine);
      }
      y = baseY + lines.length * SPACING.termLine + SPACING.termItemGap;
    }
  }

  /* ---------- พื้นที่ลายเซ็น (จัดกลุ่มให้อยู่กึ่งกลางหน้า) ---------- */
  y = Math.max(y, H - 200);
  const gap = 24;
  const colW = (W - M * 2 - gap) / 2;
  const boxH2 = 110;

  const groupW = colW * 2 + gap;
  const startX = (W - groupW) / 2;

  // บริษัท
  doc.roundedRect(startX, y, colW, boxH2, 6, 6);
  doc.text(T("ลงชื่อผู้แทนบริษัท"), startX + 12, y + 20);
  doc.text(T("(.................................................)"), startX + 12, y + 84);
  if (signatures.companyRep) doc.text(T(`ชื่อ: ${signatures.companyRep}`), startX + 12, y + 100);

  // ลูกค้า
  const rightX = startX + colW + gap;
  doc.roundedRect(rightX, y, colW, boxH2, 6, 6);
  doc.text(T("ลงชื่อลูกค้า/ผู้ว่าจ้าง"), rightX + 12, y + 20);
  doc.text(T("(.................................................)"), rightX + 12, y + 84);
  if (signatures.clientRep) doc.text(T(`ชื่อ: ${signatures.clientRep}`), rightX + 12, y + 100);

  // บันทึกไฟล์
  doc.save(fileName);
}
