// src/lib/generateReceiptPDF.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ---------- utils ---------- */
const T = (v) => Array.isArray(v) ? v.map(x => String(x ?? "")) : String(v ?? "");

// ===== แปลงจำนวนเงินเป็นคำอ่านภาษาไทย =====
const TH_NUM = ['ศูนย์','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'];
const TH_POS = ['', 'สิบ','ร้อย','พัน','หมื่น','แสน'];

function readUnderMillion(numStr){
  let s = '';
  const str = String(parseInt(numStr,10)||0);
  const len = str.length;
  for(let i=0;i<len;i++){
    const d = +str[i]; if(d===0) continue;
    const pos = len - i - 1; // 0=หน่วย,1=สิบ,...
    if(pos === 0){
      if(d === 1 && len > 1) s += 'เอ็ด';
      else s += TH_NUM[d];
    }else if(pos === 1){
      if(d === 1) s += 'สิบ';
      else if(d === 2) s += 'ยี่สิบ';
      else s += TH_NUM[d] + 'สิบ';
    }else{
      s += TH_NUM[d] + TH_POS[pos];
    }
  }
  return s || 'ศูนย์';
}

function readNumberThai(numStr){
  const str = String(parseInt(numStr,10)||0);
  if(str.length <= 6) return readUnderMillion(str);
  const head = str.slice(0, str.length - 6);
  const tail = str.slice(str.length - 6);
  const tailVal = parseInt(tail,10);
  return readNumberThai(head) + 'ล้าน' + (tailVal ? readUnderMillion(tail) : '');
}

function bahtText(amount){
  const n = Math.round((Number(amount)||0) * 100) / 100;
  const [baht, satang] = n.toFixed(2).split('.');
  const bahtPart = readNumberThai(baht) + 'บาท';
  if(satang === '00') return bahtPart + 'ถ้วน';
  return bahtPart + readNumberThai(satang) + 'สตางค์';
}

/* ---------- หมายเหตุค่าเริ่มต้น (ใช้เมื่อไม่มี remarkLines/bankRemark) ---------- */
const DEFAULT_REMARK_LINES = [
  "ธนาคารกสิกรไทย เลขที่บัญชี 201-8-860778\nRemark: บจก.สยามการ์ดโซลูชั่น (ประเทศไทย) จำกัด",
];

function ab2b64(buf){const u=new Uint8Array(buf);let s="";for(let i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);return btoa(s);}
const money = n => Number(n||0).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtDate = d => { try{ const dd=d instanceof Date?d:new Date(d); return dd.toLocaleDateString("th-TH",{year:"numeric",month:"2-digit",day:"2-digit"});}catch{return String(d||"");}};
function textBlock(doc, text, x, y, maxW, lh=16) {
  const lines = doc.splitTextToSize(String(text || ""), maxW);
  lines.forEach((ln, i) => doc.text(String(ln), x, y + i * lh));
  return y + lines.length * lh;
}

/* ---------- font loader ---------- */
const FAMILY = "THSarabunSG";
let B64_REG = null, B64_BOLD = null;
const REGISTERED = new WeakSet();

async function loadFontsB64(){
  if(B64_REG && B64_BOLD) return {reg:B64_REG, bold:B64_BOLD};
  const [rRes,bRes] = await Promise.all([
    fetch("/fonts/THSarabunNew.ttf"),
    fetch("/fonts/THSarabunNew-Bold.ttf")
  ]);
  if(!rRes.ok || !bRes.ok) throw new Error("โหลดฟอนต์ไม่สำเร็จ");
  const [rBuf,bBuf] = await Promise.all([rRes.arrayBuffer(), bRes.arrayBuffer()]);
  B64_REG = ab2b64(rBuf); B64_BOLD = ab2b64(bBuf);
  return {reg:B64_REG, bold:B64_BOLD};
}
async function ensureThaiFont(doc){
  if(REGISTERED.has(doc) && doc.getFontList?.()[FAMILY]){ doc.setFont(FAMILY,"normal"); return; }
  const {reg,bold} = await loadFontsB64();
  doc.addFileToVFS(`${FAMILY}-Regular.ttf`, reg);  doc.addFont(`${FAMILY}-Regular.ttf`, FAMILY, "normal");
  doc.addFileToVFS(`${FAMILY}-Bold.ttf`,    bold); doc.addFont(`${FAMILY}-Bold.ttf`,    FAMILY, "bold");
  if(!doc.getFontList?.()[FAMILY]) throw new Error("ฟอนต์ไทยไม่ถูกลงทะเบียนกับ jsPDF");
  REGISTERED.add(doc); doc.setFont(FAMILY,"normal");
}

/* ---------- main ---------- */
/**
 * options:
 *  - filename?: string
 *  - returnType?: 'save' | 'blob' | 'bloburl' | 'arraybuffer' | 'datauristring'
 *  - autoSave?: boolean
 *  - vatEnabled?: boolean   // ✅ override ได้จาก options
 *  - vatRate?: number       // ✅ override ได้จาก options
 */
export default async function generateReceiptPDF(payload={}, options={}){
  const {
    companyName="Siam Guard", companyAddress="", companyPhone="", companyTaxId="", logoDataUrl,
    clientName="", clientPhone="", clientAddress="", clientTaxId="",
    receiptNo="", issueDate=new Date(),
    // วันเริ่มสัญญา (รองรับหลายคีย์)
    contractStartDate, startDate, startYMD, service1Date,
    items=[], discount=0,
    vatEnabled: _vatEnabled = false,   // ✅ เปิด/ปิด VAT จาก payload
    vatRate: _vatRate = 0,             // ✅ อัตรา VAT จาก payload
    alreadyPaid=0,
    footerNotice="สินค้าตามใบสั่งซื้อนี้เมื่อลูกค้าได้รับมอบและตรวจสอบแล้วถือว่าเป็นทรัพย์สินของผู้ว่าจ้างและจะไม่รับคืนเงิน/คืนสินค้า",
    // ใหม่: หมายเหตุ/ธนาคารแบบกำหนดเอง
    remarkLines,       // string[] (optional)
    bankRemark,        // string (optional)
  } = payload;

  // ✅ อนุญาต override จาก options (+ fallback 7% เมื่อเปิด VAT แต่ไม่ได้ส่งอัตรามา)
  const vatEnabled = (options.vatEnabled ?? _vatEnabled) ? true : false;
  const rawRate    = Number(options.vatRate ?? _vatRate ?? 0);
  const vatRate    = vatEnabled ? (rawRate > 0 ? rawRate : 0.07) : 0;

  const contractStart =
    contractStartDate ?? startDate ?? startYMD ?? service1Date ?? issueDate;

  const doc = new jsPDF({ unit:"pt", format:"a4", compress:false });
  await ensureThaiFont(doc);

  // metadata
  doc.setProperties({
    title: `ใบเสร็จรับเงิน ${receiptNo||""}`,
    author: companyName, subject: companyAddress, creator: companyName,
    keywords: [companyPhone,companyTaxId].filter(Boolean).join(", "),
  });

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = 56;

  // โลโก้
  if(logoDataUrl){ try{ doc.addImage(logoDataUrl,"PNG",M,y-8,80,80);}catch{} }

  // หัวเรื่อง
  doc.setFont(FAMILY,"bold"); doc.setFontSize(22);
  doc.text(T("ใบเสร็จรับเงิน"), W/2, y, { align:"center" });

  /* ===== กล่องลูกค้า/เอกสาร ===== */
  const contentW = W - M*2, pad = 10, lineH = 16;
  let leftW = Math.max(260, Math.round(contentW*0.60));
  let rightW = contentW - leftW; if(rightW<200){ rightW=200; leftW=contentW-rightW; }
  const boxX = M, boxY = y+20;

  const leftLines = [
    `ชื่อลูกค้า: ${clientName || "-"}`,
    `เลขประจำตัวผู้เสียภาษี: ${clientTaxId || "-"}`,
    ...doc.splitTextToSize(`ที่อยู่: ${clientAddress || "-"}`, leftW - pad*2),
    `โทรศัพท์: ${clientPhone || "-"}`,
  ];

  // ใช้ "วันที่เริ่มสัญญา" เป็นข้อมูลอ้างอิง/ครบกำหนด
  const rightLines = [
    `เลขที่: ${receiptNo || "-"}`,
    `วันที่: ${fmtDate(issueDate)}`,
    `ครบกำหนดชำระ: ${fmtDate(contractStart)}`,
  ];

  const leftH  = pad*2 + leftLines.length*lineH + 2;
  const rightH = pad*2 + rightLines.length*lineH + 2;
  const boxH   = Math.max(leftH,rightH);

  doc.roundedRect(boxX, boxY, contentW, boxH, 6, 6);
  doc.setDrawColor(230); doc.line(boxX+leftW, boxY, boxX+leftW, boxY+boxH);

  doc.setFont(FAMILY,"normal"); doc.setFontSize(12);
  let ly=boxY+pad+6; leftLines.forEach(t => { doc.text(T(t), boxX + pad, ly); ly += lineH; });
  let ry=boxY+pad+6; rightLines.forEach(t => { doc.text(T(t), boxX + leftW + pad, ry); ry += lineH; });

  y = boxY + boxH + 16;

  /* ===== คำนวณยอด ===== */
  const subTotal=(items||[]).reduce((s,it)=> s + Number(it.qty??it.quantity??1)*Number(it.unitPrice??it.price??0), 0);
  const afterDiscount=Math.max(0, subTotal-Number(discount||0));
  const vat = vatEnabled ? Math.max(0, afterDiscount*Number(vatRate||0)) : 0;
  const grandTotal=afterDiscount+vat;
  const netTotal=Math.max(0, grandTotal-Number(alreadyPaid||0));

  /* ===== ตารางรายการ ===== */
  autoTable(doc,{
    startY: y,
    margin: { left: M, right: M },
    tableWidth: contentW,
    head: [["ลำดับ","จำนวน","รหัสสินค้า / รายละเอียดสินค้า","ราคา / หน่วย","จำนวนเงิน"]],
    body: (items||[]).length
      ? items.map((it,idx)=>{
          const qty=Number(it.qty??it.quantity??1);
          const unit=Number(it.unitPrice??it.price??0);
          const amt=qty*unit;
          const desc=String(it.description??it.name??"");
          return [String(idx+1), String(qty), desc, money(unit), money(amt)];
        })
      : [["-","-","-","-","-"]],
    styles: { font:FAMILY, fontSize:12, cellPadding:6, lineWidth:0.4, lineColor:[180,180,180], overflow:"linebreak" },
    headStyles: { font:FAMILY, fontStyle:"bold", fillColor:[220,220,220], textColor:[0,0,0], lineWidth:0.6 },
    alternateRowStyles: { fillColor:[248,248,248] },
    columnStyles: {
      0:{ halign:"center", cellWidth:38 },
      1:{ halign:"center", cellWidth:64 },
      3:{ halign:"right",  cellWidth:88 },
      4:{ halign:"right",  cellWidth:96 },
      2:{ cellWidth:"auto" },
    },
    theme:"grid",
  });
  const tableEndY = doc.lastAutoTable?.finalY || y;

  /* ===== หมายเหตุ (ซ้าย) + กล่องสรุป (ขวา) ===== */
  const totalsW = 240;
  const totalsX = W - M - totalsW;
  const rowH   = 24;

  let noteY = tableEndY + 12;
  const remarkW = totalsX - M - 12;

  doc.setFont(FAMILY, "normal"); doc.setFontSize(12);
  doc.text(T("หมายเหตุ:"), M, noteY);
  noteY += 16;

  const remarkBlockLines = Array.isArray(remarkLines) && remarkLines.length > 0
    ? remarkLines
    : (bankRemark ? [bankRemark] : DEFAULT_REMARK_LINES);

  remarkBlockLines.forEach(line => {
    noteY = textBlock(doc, line, M, noteY, remarkW);
    noteY += 2;
  });

  // จำนวนเงิน (ตัวอักษร)
  const amountInWords = bahtText(netTotal);
  const textLabel = `${amountInWords}`;

  const padX = 6, padY = 6;
  const lineHeight = 16;
  const boxWidth  = remarkW + padX * 2;
  const boxHeight = lineHeight + padY * 2;
  const boxLeft   = M - padX;
  const boxTop    = noteY - (lineHeight - 12) - padY;

  doc.setFillColor(142, 169, 219);
  doc.roundedRect(boxLeft, boxTop, boxWidth, boxHeight, 4, 4, "F");

  const centerX = boxLeft + boxWidth / 2;
  const centerY = boxTop  + boxHeight / 2;
  const lines   = doc.splitTextToSize(T(textLabel), remarkW);
  const totalH  = lines.length * lineHeight;

  doc.setFont(FAMILY, "bold");
  lines.forEach((ln, i) => {
    const yLine = centerY - totalH / 2 + (i + 0.5) * lineHeight;
    try {
      doc.text(T(ln), centerX, yLine, { align: "center", baseline: "middle" });
    } catch {
      const fs = doc.getFontSize();
      doc.text(T(ln), centerX, yLine + fs * 0.35, { align: "center" });
    }
  });
  doc.setFont(FAMILY, "normal");
  noteY = boxTop + boxHeight + 3;
  const noteEndY = noteY + 12;

  // กล่องสรุปด้านขวา
  let ty = tableEndY + 6;
  const rows = [
    ["รวม", money(subTotal), "normal"],
    ...(Number(discount) > 0 ? [["ส่วนลด", `-${money(discount)}`, "normal"]] : []),
    ["ภาษีมูลค่าเพิ่ม (VAT) ", (vatEnabled && Number(vatRate) > 0) ? money(vat) : "-", "normal"],
    ...(Number(alreadyPaid) > 0 ? [["หักมัดจำ", `-${money(alreadyPaid)}`, "highlight"]] : []),
    ["ราคาสุทธิ", money(netTotal), "bold"],
  ];

  rows.forEach(([label, val, style]) => {
    if (style === "highlight") { doc.setFillColor(200, 228, 245); doc.rect(totalsX, ty, totalsW, rowH, "F"); }
    else { doc.setDrawColor(230); doc.rect(totalsX, ty, totalsW, rowH); }

    const mid = totalsX + totalsW - 110;

    if (style === "note") {
      doc.setFont(FAMILY, "normal");
      doc.text(T(label), totalsX + 10, ty + 16);
    } else {
      doc.setFont(FAMILY, style === "bold" ? "bold" : "normal");
      doc.text(T(label), totalsX + 10, ty + 16);
      doc.text(T(val),   totalsX + totalsW - 10, ty + 16, { align: "right" });
      doc.setDrawColor(235); doc.line(mid, ty, mid, ty + rowH);
    }
    ty += rowH;
  });
  const totalsEndY = ty;

  // ดันบล็อกท้ายลงล่าง
  let y2 = Math.max(noteEndY, totalsEndY) + 16;
  const bottomMargin = M;
  const PAY_H = 88;
  const FOOTER_GAP = 90;
  const BLOCK_H = 12 + PAY_H + 16 + FOOTER_GAP;
  y2 = Math.max(y2, H - bottomMargin - BLOCK_H);

  // ข้อความรับเงิน + วิธีชำระ + เซ็นชื่อ
  doc.setFont(FAMILY,"normal");
  doc.text(T("ได้รับเงินดังรายการข้างต้นในใบเสร็จฯเรียบร้อย"), M, y2);

  const payY = y2 + 12;
  doc.roundedRect(M, payY, W - M*2, PAY_H, 6, 6);
  let py = payY + 20;
  doc.text(T("การชำระเงิน:"), M + 10, py);
  py += 18;
  doc.text(T("เช็คธนาคาร / สาขา: ____________________"), M + 28, py);
  py += 18;
  doc.text(T("เลขที่บัญชี: ____________________"), M + 28, py);
  py += 18;
  doc.text(T("ลงวันที่: ____________________"), M + 28, py);

  const signY = payY + PAY_H + 16;
  const colGap = 24;
  const signW  = (W - M * 2 - colGap) / 2;

  ["ผู้รับเงิน", "ผู้รับสินค้า"].forEach((label, i) => {
    const x = M + i * (signW + colGap);
    doc.line(x + 24, signY + 40, x + signW - 24, signY + 40);
    doc.text(T(label), x + signW / 2, signY + 58, { align: "center" });
  });

  doc.setFontSize(11); doc.setFont(FAMILY,"normal");
  doc.text(T(footerNotice), M, signY + FOOTER_GAP);

  // === โหมดส่งออก ===
  const fname = options.filename || `Receipt-${receiptNo || fmtDate(issueDate)}.pdf`;
  const ret = options.returnType || (options.autoSave === false ? 'blob' : 'save');

  switch (ret) {
    case 'blob':
      return doc.output('blob');
    case 'bloburl':
      return doc.output('bloburl');
    case 'arraybuffer':
      return doc.output('arraybuffer');
    case 'datauristring':
      return doc.output('datauristring');
    case 'save':
    default:
      doc.save(fname);
      return { filename: fname };
  }
}
