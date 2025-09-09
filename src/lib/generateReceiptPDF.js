// src/lib/generateReceiptPDF.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ---------- utils ---------- */
function ab2b64(buf){const u=new Uint8Array(buf);let s="";for(let i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);return btoa(s);}
const money = n => Number(n||0).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtDate = d => { try{ const dd=d instanceof Date?d:new Date(d); return dd.toLocaleDateString("th-TH",{year:"numeric",month:"2-digit",day:"2-digit"});}catch{return String(d||"");}};
function textBlock(doc,text,x,y,maxW,lh=16){const lines=doc.splitTextToSize(String(text||""),maxW);lines.forEach((ln,i)=>doc.text(ln,x,y+i*lh));return y+(lines.length-1)*lh;}

/* ---------- font loader (no process.env, cache-busted) ---------- */
const FAMILY = "THSarabunSG";

// แคชไฟล์ฟอนต์ (base64) ไว้ในหน่วยความจำ โหลดครั้งเดียวพอ
let B64_REG = null;
let B64_BOLD = null;

// เก็บรายการเอกสารที่ลงทะเบียนฟอนต์แล้ว (กันลงซ้ำใน doc เดิม)
const REGISTERED = new WeakSet();

async function loadFontsB64() {
  if (B64_REG && B64_BOLD) return { reg: B64_REG, bold: B64_BOLD };
  // ไม่ใส่ timestamp แล้ว เพื่อให้ browser cache ได้
  const regularUrl = `/fonts/THSarabunNew.ttf`;
  const boldUrl    = `/fonts/THSarabunNew-Bold.ttf`;
  const [rRes, bRes] = await Promise.all([fetch(regularUrl), fetch(boldUrl)]);
  if (!rRes.ok) throw new Error(`โหลดฟอนต์ไม่สำเร็จ: ${regularUrl}`);
  if (!bRes.ok) throw new Error(`โหลดฟอนต์ไม่สำเร็จ: ${boldUrl}`);
  const [rBuf, bBuf] = await Promise.all([rRes.arrayBuffer(), bRes.arrayBuffer()]);
  B64_REG  = ab2b64(rBuf);
  B64_BOLD = ab2b64(bBuf);
  return { reg: B64_REG, bold: B64_BOLD };
}

async function ensureThaiFont(doc) {
  // ถ้า doc นี้ถูกลงทะเบียนแล้ว ข้ามได้
  if (REGISTERED.has(doc) && doc.getFontList?.()[FAMILY]) {
    doc.setFont(FAMILY, "normal");
    return;
  }
  // โหลด base64 จากแคช (หรือเครือข่ายถ้ายังไม่เคยโหลด)
  const { reg, bold } = await loadFontsB64();

  // ลงทะเบียนฟอนต์กับ doc "ทุกครั้งที่สร้าง doc ใหม่"
  doc.addFileToVFS(`${FAMILY}-Regular.ttf`, reg);
  doc.addFont(`${FAMILY}-Regular.ttf`, FAMILY, "normal");
  doc.addFileToVFS(`${FAMILY}-Bold.ttf`, bold);
  doc.addFont(`${FAMILY}-Bold.ttf`, FAMILY, "bold");

  if (!doc.getFontList?.()[FAMILY]) throw new Error("ฟอนต์ไทยไม่ถูกลงทะเบียนกับ jsPDF");
  REGISTERED.add(doc);
  doc.setFont(FAMILY, "normal");
}

/* ---------- main ---------- */
export default async function generateReceiptPDF(payload={}, options={}){
  const {
    companyName="Siam Guard",
    companyAddress="", companyPhone="", companyTaxId="", logoDataUrl,
    customerCode="", clientName="", clientPhone="", clientAddress="", clientTaxId="",
    receiptNo="", issueDate=new Date(), poNumber="", termDays=0, dueDate,
    items=[], discount=0, vatRate=0.07, alreadyPaid=0, notes="", bankRemark="",
    footerNotice="สินค้าตามใบสั่งซื้อนี้เมื่อลูกค้าได้รับมอบและตรวจสอบแล้วถือว่าเป็นทรัพย์สินของผู้ว่าจ้างและจะไม่รับคืนเงิน/คืนสินค้า",
  } = payload;

  const _due = dueDate || new Date(new Date(issueDate).getTime()+termDays*86400000);

  const doc = new jsPDF({ unit:"pt", format:"a4", compress:false });
  await ensureThaiFont(doc);

  doc.setProperties({
    title:`ใบเสร็จรับเงิน ${receiptNo||""}`,
    author:companyName, subject:companyAddress, creator:companyName,
    keywords:[companyPhone,companyTaxId].filter(Boolean).join(", "),
  });

  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  let y = 56;

  // โลโก้ (ถ้ามี)
  if(logoDataUrl){ try{ doc.addImage(logoDataUrl,"PNG",M,y-8,80,80);}catch{} }

  // หัวเรื่อง
  doc.setFont(FAMILY,"bold"); doc.setFontSize(22);
  doc.text("ใบเสร็จรับเงิน", W/2, y, { align:"center" });

  /* ===== กล่องลูกค้า/เอกสาร — กรอบใหญ่ 1 อัน + เส้นแบ่ง ===== */
  const contentW = W - M * 2;
  const pad = 10;
  const lineH = 16;

  let leftW  = Math.max(260, Math.round(contentW * 0.60));
  let rightW = contentW - leftW;
  if (rightW < 200) { rightW = 200; leftW = contentW - rightW; }

  const boxX = M;
  const boxY = y + 20;

  const leftLines = [
    `รหัสลูกค้า: ${customerCode || "-"}`,
    `ชื่อลูกค้า: ${clientName || "-"}`,
    `เลขประจำตัวผู้เสียภาษี: ${clientTaxId || "-"}`,
    ...doc.splitTextToSize(`ที่อยู่: ${clientAddress || "-"}`, leftW - pad * 2),
    `โทรศัพท์: ${clientPhone || "-"}`,
  ];
  const rightLines = [
    `เลขที่: ${receiptNo || "-"}`,
    `วันที่: ${fmtDate(issueDate)}`,
    `เลขที่ใบสั่งซื้อ: ${poNumber || "-"}`,
    `เงื่อนไขการชำระเงิน: ${Number(termDays || 0)} วัน`,
    `ครบกำหนดชำระ: ${fmtDate(_due)}`,
  ];

  const leftH  = pad * 2 + leftLines.length  * lineH + 2;
  const rightH = pad * 2 + rightLines.length * lineH + 2;
  const boxH   = Math.max(leftH, rightH);

  doc.roundedRect(boxX, boxY, contentW, boxH, 6, 6);   // กรอบใหญ่
  doc.setDrawColor(230);
  doc.line(boxX + leftW, boxY, boxX + leftW, boxY + boxH); // เส้นแบ่ง

  // พิมพ์ข้อความ
  doc.setFont(FAMILY, "normal"); doc.setFontSize(12);
  let ly = boxY + pad + 6; leftLines.forEach(t => { doc.text(t, boxX + pad, ly); ly += lineH; });
  let ry = boxY + pad + 6; rightLines.forEach(t => { doc.text(t, boxX + leftW + pad, ry); ry += lineH; });

  // ดัน Y ลงมาถัดจากกล่อง (ห้ามมีบรรทัดคำนวณซ้ำอีก)
  y = boxY + boxH + 16;

  /* ===== คำนวณยอดรวม ===== */
  const subTotal=(items||[]).reduce((s,it)=> s+Number(it.qty??it.quantity??1)*Number(it.unitPrice??it.price??0),0);
  const afterDiscount=Math.max(0, subTotal-Number(discount||0));
  const vat=Math.max(0, afterDiscount*Number(vatRate||0));
  const grandTotal=afterDiscount+vat;
  const netTotal=Math.max(0, grandTotal-Number(alreadyPaid||0));

  /* ===== ตารางรายการ ===== */
  autoTable(doc, {
    startY: y,
    tableWidth: contentW - 8, // กันขอบซึม
    head: [["ลำดับ","จำนวน","รหัสสินค้า / รายละเอียดสินค้า","ราคา / หน่วย","จำนวนเงิน"]],
    body: (items || []).length
      ? (items || []).map((it, idx) => {
          const qty  = Number(it.qty ?? it.quantity ?? 1);
          const unit = Number(it.unitPrice ?? it.price ?? 0);
          const amt  = qty * unit;
          const desc = String(it.description ?? it.name ?? "");
          return [String(idx + 1), String(qty), desc, money(unit), money(amt)];
        })
      : [["-","-","-","-","-"]],
    styles: {
      font: FAMILY, fontSize: 12, cellPadding: 6,
      lineWidth: 0.4, lineColor: [180,180,180], overflow: "linebreak",
    },
    headStyles: { font: FAMILY, fontStyle: "bold", fillColor: [220,220,220], textColor: [0,0,0], lineWidth: 0.6 },
    alternateRowStyles: { fillColor: [248,248,248] },
    columnStyles: {
      0: { halign: "center", cellWidth: 38 },
      1: { halign: "center", cellWidth: 64 },
      3: { halign: "right",  cellWidth: 88 },
      4: { halign: "right",  cellWidth: 96 },
      2: { cellWidth: "auto" },
    },
    theme: "grid",
  });

  const tableEndY = doc.lastAutoTable?.finalY || y;

  /* ===== หมายเหตุ (ซ้าย) + กล่องสรุป (ขวา) ===== */
  const totalsW = 240;
  const totalsX = W - M - totalsW;
  const rowH   = 24;

  // หมายเหตุซ้าย
  let noteY = tableEndY + 12;
  const remarkW = totalsX - M - 12;
  const firstRemark = bankRemark ? `หมายเหตุ: ${bankRemark}` : "หมายเหตุ:";
  textBlock(doc, firstRemark, M, noteY, remarkW);
  if (notes) { noteY += 18; textBlock(doc, notes, M, noteY, remarkW); }
  const noteEndY = noteY + 12;

  // กล่องสรุปขวา
  let ty = tableEndY + 6;
  const rows = [
    ["รวมเงิน", money(subTotal), "normal"],
    ...(Number(discount) > 0 ? [["ส่วนลด", `-${money(discount)}`, "normal"]] : []),
    [`ภาษีมูลค่าเพิ่ม ${Math.round((vatRate || 0) * 100)}%`, money(vat), "normal"],
    ...(Number(alreadyPaid) > 0 ? [["หักมัดจำ", `-${money(alreadyPaid)}`, "highlight"]] : []),
    ["รวมเงินทั้งสิ้น", money(netTotal), "bold"],
  ];
  rows.forEach(([label, val, style]) => {
    if (style === "highlight") { doc.setFillColor(200, 228, 245); doc.rect(totalsX, ty, totalsW, rowH, "F"); }
    else { doc.setDrawColor(230); doc.rect(totalsX, ty, totalsW, rowH); }
    const mid = totalsX + totalsW - 110;
    doc.setFont(FAMILY, style === "bold" ? "bold" : "normal");
    doc.text(label, totalsX + 10, ty + 16);
    doc.text(val,   totalsX + totalsW - 10, ty + 16, { align: "right" });
    doc.setDrawColor(235); doc.line(mid, ty, mid, ty + rowH);
    ty += rowH;
  });
  const totalsEndY = ty;

  // จัด y ให้ต่อจากส่วนที่สูงกว่า
  y = Math.max(noteEndY, totalsEndY) + 16;

  /* ===== ข้อความรับเงิน + วิธีชำระ + เซ็นชื่อ ===== */
  doc.setFont(FAMILY, "normal");
  doc.text("ได้รับเงินดังรายการข้างต้นในใบเสร็จฯเรียบร้อย", M, y);

  const payY = y + 12, payH = 88;
  doc.roundedRect(M, payY, W - M * 2, payH, 6, 6);
  let py = payY + 20;
  doc.text("การชำระเงิน:", M + 10, py); py += 18;
  doc.text("เช็คธนาคาร / สาขา: ____________________", M + 28, py); py += 18;
  doc.text("เลขที่บัญชี: ____________________", M + 28, py); py += 18;
  doc.text("ลงวันที่: ____________________", M + 28, py);

  // ช่องเซ็นชื่อ
  const signY = payY + payH + 16;
  const signW = (W - M * 2 - 32) / 3;
  for (let i = 0; i < 3; i++) {
    const x = M + i * (signW + 16);
    doc.line(x + 24, signY + 40, x + signW - 24, signY + 40);
    const label = i === 0 ? "ผู้รับเงิน" : (i === 1 ? "ผู้รับสินค้า" : "ผู้มีอำนาจลงนาม");
    doc.text(label, x + signW / 2, signY + 58, { align: "center" });
  }

  // ท้ายเอกสาร
  doc.setFontSize(11); doc.setFont(FAMILY, "normal");
  doc.text(footerNotice, M, signY + 90);

  const fname = options.filename || `Receipt-${receiptNo || fmtDate(issueDate)}.pdf`;
  doc.save(fname);
}
