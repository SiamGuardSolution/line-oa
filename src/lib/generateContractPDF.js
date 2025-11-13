// src/lib/generateContractPDF.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as PKG from "../config/packages";

/* ---------- helpers ---------- */
const pkgLabel = (k) =>
  typeof PKG.getPackageLabel === "function"
    ? PKG.getPackageLabel(k)
    : (PKG.PACKAGE_LABEL?.[k] ?? String(k));

const pkgPrice = (k) => {
  const fn = PKG.getPackagePrice;
  const map = PKG.PACKAGE_PRICE;
  const v = (typeof fn === "function") ? fn(k) : map?.[k];
  return Number(v ?? 0);
};

// แปลงวันที่ -> เดือน/ปี (ปฏิทินไทย) เช่น "10/2568"
const fmtThaiMonthYear = (d) => {
  try {
    if (!d) return "";
    const dd = d instanceof Date ? d : new Date(d);
    return dd.toLocaleDateString("th-TH", { year: "numeric", month: "2-digit" });
  } catch { return ""; }
};

// ใช้แสดงวันที่จุดอื่นที่ยังต้องเป็นวัน/เดือน/ปี แบบไทย
const fmtThaiDate = (d) => {
  try {
    if (!d) return "";
    const dd = d instanceof Date ? d : new Date(d);
    return dd.toLocaleDateString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch { return String(d || ""); }
};

// เพิ่มเดือนโดยรักษาวันสิ้นเดือน
const addMonths = (date, months) => {
  if (!date) return null;
  const d = date instanceof Date ? new Date(date) : new Date(date);
  if (isNaN(d)) return null;
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
};

// พิมพ์ข้อความแบบปลอดภัย
const TXT = (doc, text, x, y, opts) => {
  const S = v => (v == null ? "" : String(v));
  const isNum = n => typeof n === "number" && isFinite(n);
  if (!isNum(x) || !isNum(y)) return;
  if (Array.isArray(text)) {
    const lines = text.map(S).filter(Boolean);
    if (lines.length) doc.text(lines, x, y, opts);
  } else {
    doc.text(S(text), x, y, opts);
  }
};

// เดา pkgKey จากข้อมูลสัญญา ถ้าไม่มีคีย์มา
const derivePkgKey = (service = {}, rawAll = {}) => {
  const direct = (service.pkgKey || rawAll.pkg || rawAll.package || "").toString().toLowerCase();
  if (["spray", "bait", "mix"].includes(direct)) return direct;

  const raw = `${service.packageName || ""}|${service.type || ""}|${rawAll.serviceType || ""}`.toLowerCase();
  if (/mix|ผสม|combo/.test(raw)) return "mix";
  if (/bait|เหยื่อ/.test(raw))  return "bait";
  if (/spray|ฉีดพ่น/.test(raw)) return "spray";

  const p = Number(service.basePrice || 0) || Number((rawAll.priceText || "").replace(/[^\d.]/g, "")) || 0;
  if (p === pkgPrice("mix"))   return "mix";
  if (p === pkgPrice("bait"))  return "bait";
  if (p === pkgPrice("spray")) return "spray";

  return "mix";
};

/* ---------- spacing presets ---------- */
const SPACING = {
  afterTable: 18,
  beforeTermsHeader: 14,
  afterTermsHeader: 18,
  termLine: 12,
  termItemGap: 4,
};
const SIGN_RESERVE = 150;

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
 *   service: {
 *     pkgKey?, type, packageName, basePrice, addons:[{name, price}],
 *     spraySchedule?: Array,
 *     intervalMonthsSpray?, intervalDaysBait?,
 *     topTitle?
 *   },
 *   schedule: [ { dueDate?, date?, visitDate?, visit?, note? }, ... ],
 *   terms: [ "..." ],
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
    logoDataUrl,
  } = data;

  const fileName = opts.fileName || `Contract_${contractNumber || Date.now()}.pdf`;
  const contractDateToShow = startDate ?? contractDate ?? new Date();

  // ===== ผูกกับ config กลาง =====
  const pkgKey     = derivePkgKey(service, data);
  const pkgName    = service.packageName || pkgLabel(pkgKey);
  const basePrice  = (service.basePrice ?? null) !== null ? service.basePrice : pkgPrice(pkgKey);

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
  TXT(doc, "สัญญาบริการกำจัดปลวก", W / 2, y, { align: "center" });
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
    `วันที่ทำสัญญา: ${fmtThaiDate(contractDateToShow)}`,
    `วันสิ้นสุดสัญญา: ${fmtThaiDate(endDate)}`,
  ];
  const leftH = pad * 2 + leftLines.length * lineH + 2;
  const rightH = pad * 2 + rightLines.length * lineH + 2;
  const boxH = Math.max(leftH, rightH);

  doc.roundedRect(boxX, boxY, contentW, boxH, 6, 6);
  doc.setDrawColor(230); doc.line(boxX + leftW, boxY, boxX + leftW, boxY + boxH);

  let ly = boxY + pad + 6; leftLines.forEach(t => { TXT(doc, t, boxX + pad, ly); ly += lineH; });
  let ry = boxY + pad + 6; rightLines.forEach(t => { TXT(doc, t, boxX + leftW + pad, ry); ry += lineH; });

  y = boxY + boxH + 16;

  // ผู้รับบริการ
  const custLines = [
    `ผู้รับบริการ: ${client.name || "-"}`,
    ...doc.splitTextToSize(`ที่อยู่: ${client.address || "-"}`, contentW),
    `โทรศัพท์: ${client.phone || "-"}`,
    client.facebook ? `Facebook/Line: ${client.facebook}` : "",
  ].filter(Boolean);
  custLines.forEach((t, i) => TXT(doc, t, M, y + i * 16));
  y += custLines.length * 16 + 10;

  // รายละเอียดแพ็กเกจ (ชื่อมาจาก config)
  const addons = Array.isArray(service.addons) ? service.addons : [];
  const pkgLines = [
    `แพ็กเกจ: ${pkgName}`,
    (basePrice != null) ? `ราคาแพ็กเกจ: ${Number(basePrice).toLocaleString("th-TH")} บาท` : "",
  ].filter(Boolean);
  pkgLines.forEach((t, i) => TXT(doc, t, M, y + i * 16));
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

  /* ===== ตารางรอบบริการ (เฉพาะ Spray เท่านั้น) ===== */

  const DEFAULT_SPRAY_ROWS = 2;

  const mapItem = (it) => ({
    mmYY: fmtThaiMonthYear(it?.dueDate ?? it?.due ?? it?.visitDate ?? it?.visit ?? it?.date),
    note:  it?.note ?? "",
  });

  const spraySrc = Array.isArray(service.spraySchedule) ? service.spraySchedule : null;

  // ใช้ spraySchedule ก่อน ถ้าไม่มีให้ใช้ schedule ทั้งหมดเป็นรอบฉีดพ่น
  const baseSprayList = spraySrc || (Array.isArray(schedule) ? schedule : []);

  let maxTop = DEFAULT_SPRAY_ROWS;
  if (baseSprayList.length) {
    maxTop = baseSprayList.length;
  }

  const MAX_TOP = maxTop;
  const schedTop = [];

  baseSprayList.slice(0, MAX_TOP).forEach(it => schedTop.push(mapItem(it)));

  // เติมออโต้ให้ครบจำนวนแถวตามจำนวนรอบ (สร้างเดือน/ปีจาก startDate + ช่วงห่าง)
  const intMonthsSpray = Number(service.intervalMonthsSpray ?? service.intervalMonths ?? 4);

  for (let i = schedTop.length; i < MAX_TOP; i++) {
    const d = startDate ? addMonths(startDate, intMonthsSpray * (i + 1)) : null;
    schedTop.push({ mmYY: fmtThaiMonthYear(d), note: "" });
  }

  const topTitle = service.topTitle ?? "ตารางบริการฉีดพ่น (Spray)";

  const headCols = [
    "ครั้งที่",
    "เดือน/ปี",
    "ลงชื่อเข้าบริการ",
    "ลงชื่อผู้รับบริการ",
    "หมายเหตุ",
  ];

  const TITLE_GAP = 2;
  const TABLE_GAP = 24;

  // ตารางบน (Spray) — แสดงเสมอ
  doc.setFont(FAMILY, "bold");
  TXT(doc, topTitle, M, y);
  doc.setFont(FAMILY, "normal");

  autoTable(doc, {
    startY: y + TITLE_GAP,
    head: [headCols],
    body: schedTop.map((row, i) => ([
      String(i + 1),
      row.mmYY || "",
      "",
      "",
      row.note || "",
    ])),
    styles: { font: FAMILY, fontSize: 10, cellPadding: 2 },
    headStyles: { font: FAMILY, fontStyle: "bold", fillColor: [225, 233, 245], textColor: 0 },
    theme: "grid",
    margin: { left: M, right: M },
    columnStyles: {
      0: { cellWidth: 40,  halign: "center" }, // ครั้งที่
      1: { cellWidth: 80,  halign: "center" }, // เดือน/ปี
      2: { cellWidth: 120 },                   // ลงชื่อเข้าบริการ
      3: { cellWidth: 120 },                   // ลงชื่อผู้รับบริการ
      4: { cellWidth: "auto" },                // หมายเหตุ
    },
  });
  y = (doc.lastAutoTable?.finalY || y) + TABLE_GAP;

  /* ---------- ข้อกำหนดและเงื่อนไข ---------- */
  if (terms.length) {
    y += SPACING.beforeTermsHeader;
    doc.setFont(FAMILY, "bold");
    TXT(doc, "ข้อกำหนดและเงื่อนไข", M, y);
    doc.setFont(FAMILY, "normal");
    y += SPACING.afterTermsHeader;

    const maxW = W - M * 2;
    const breakAt = H - SIGN_RESERVE;

    for (let i = 0; i < terms.length; i++) {
      const text = `${i + 1}. ${String(terms[i] ?? "")}`;
      const lines = doc.splitTextToSize(text, maxW);
      const needH = lines.length * SPACING.termLine + SPACING.termItemGap;

      if (y + needH > breakAt) {
        doc.addPage();
        await ensureThaiFont(doc);
        y = 56;
      }

      let lineY = y;
      for (let j = 0; j < lines.length; j++) {
        TXT(doc, lines[j], M, lineY);
        lineY += SPACING.termLine;
      }
      y = lineY + SPACING.termItemGap;
    }
  }

  // บันทึกไฟล์
  doc.save(fileName);
}
