// src/lib/generateContractPDF.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
// ถ้ามีไฟล์ฟอนต์ TH Sarabun อยู่แล้วให้ import มาด้วย (ไม่บังคับ)
// import "../fonts/THSarabun"; 

/** helper: วันที่แบบไทย */
function formatThaiDate(d){
  try{
    const date = (d instanceof Date) ? d : new Date(d);
    const months = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()+543}`;
  }catch(_){ return String(d||""); }
}

/**
 * สร้าง PDF สัญญาและบันทึกไฟล์
 * @param {Object} data – ข้อมูลสัญญา
 * {
 *   contractNumber, contractDate, startDate, endDate,
 *   company: { name, address, phone, taxId },
 *   client:  { name, phone, address, facebook },
 *   service: { type, packageName, basePrice, addons: [{name, price}] },
 *   schedule: [{round, date, note}],
 *   terms: [ "ข้อกำหนด...", "ข้อกำหนด..." ],
 *   signatures: { companyRep, clientRep }
 * }
 * @param {Object} opts – ตัวเลือก { fileName }
 */
export default function generateContractPDF(data={}, opts={}){
  const {
    contractNumber = "",
    contractDate   = new Date(),
    startDate,
    endDate,
    company = {},
    client  = {},
    service = {},
    schedule = [],
    terms = [],
    signatures = {},
  } = data;

  const fileName = opts.fileName || `Contract_${contractNumber || Date.now()}.pdf`;

  const doc = new jsPDF({ unit:"pt", format:"a4" });
  const pageWidth  = doc.internal.pageSize.getWidth();
  const marginL = 48, marginR = 48, marginT = 56;
  let y = marginT;

  // ฟอนต์ – ถ้ามี TH Sarabun ให้ setFont("THSarabun"); (คอมเมนต์ไว้ให้)
  // doc.setFont("THSarabun");
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(12);

  /** Header */
  doc.setFontSize(18);
  doc.setFont(undefined, "bold");
  doc.text("สัญญาบริการกำจัดปลวก", pageWidth/2, y, { align: "center" });
  doc.setFontSize(11);
  doc.setFont(undefined, "normal");
  y += 22;

  // Company + Contract info (สองคอลัมน์)
  const leftColX  = marginL;
  const rightColX = pageWidth/2 + 10;

  doc.setFont(undefined, "bold");
  doc.text("ผู้ให้บริการ", leftColX, y);
  doc.setFont(undefined, "normal");
  const compLines = [
    company.name || "บริษัท",
    company.address || "",
    (company.phone ? `โทร: ${company.phone}` : ""),
    (company.taxId ? `เลขประจำตัวผู้เสียภาษี: ${company.taxId}` : "")
  ].filter(Boolean);
  compLines.forEach((t,i)=>doc.text(t, leftColX, y+16+16*i));

  doc.setFont(undefined, "bold");
  doc.text("ข้อมูลสัญญา", rightColX, y);
  doc.setFont(undefined, "normal");
  const contrLines = [
    `เลขที่สัญญา: ${contractNumber || "-"}`,
    `วันที่ทำสัญญา: ${formatThaiDate(contractDate)}`,
    `เริ่มให้บริการ: ${formatThaiDate(startDate || "-")}`,
    `สิ้นสุดสัญญา: ${formatThaiDate(endDate || "-")}`,
  ];
  contrLines.forEach((t,i)=>doc.text(t, rightColX, y+16+16*i));

  y += 16*(Math.max(compLines.length, contrLines.length)+2);

  // Client
  doc.setFont(undefined, "bold");
  doc.text("ผู้รับบริการ", leftColX, y);
  doc.setFont(undefined, "normal");
  const clientLines = [
    client.name ? `ชื่อ: ${client.name}` : "",
    client.address ? `ที่อยู่: ${client.address}` : "",
    client.phone ? `โทร: ${client.phone}` : "",
    client.facebook ? `Facebook: ${client.facebook}` : ""
  ].filter(Boolean);
  clientLines.forEach((t,i)=>doc.text(t, leftColX, y+16+16*i));
  y += 16*(clientLines.length+1);

  // Service summary
  doc.setFont(undefined, "bold");
  doc.text("รายละเอียดบริการ/แพ็กเกจ", leftColX, y);
  doc.setFont(undefined, "normal");
  const s = service || {};
  const addons = Array.isArray(s.addons) ? s.addons : [];
  const serviceLines = [
    s.type ? `ประเภทบริการ: ${s.type}` : "",
    s.packageName ? `แพ็กเกจ: ${s.packageName}` : "",
    (s.basePrice != null) ? `ราคาแพ็กเกจ: ${Number(s.basePrice).toLocaleString()} บาท` : ""
  ].filter(Boolean);
  serviceLines.forEach((t,i)=>doc.text(t, leftColX, y+16+16*i));
  y += 16*(serviceLines.length+1);

  if (addons.length){
    autoTable(doc, {
      startY: y,
      margin: { left: marginL, right: marginR },
      head: [["รายการเสริม (Add-on)", "ราคา (บาท)"]],
      body: addons.map(a=>[a.name, (a.price!=null? Number(a.price).toLocaleString() : "-")]),
      styles: { font: "Helvetica", fontSize: 11, cellPadding: 6 },
      headStyles: { fillColor: [240,240,240] },
      theme: "grid",
    });
    y = doc.lastAutoTable.finalY + 12;
  }

  // Service schedule
  if (schedule.length){
    doc.setFont(undefined, "bold");
    doc.text("ตารางรอบบริการ", leftColX, y);
    doc.setFont(undefined, "normal");
    y += 8;

    autoTable(doc, {
      startY: y,
      margin: { left: marginL, right: marginR },
      head: [["รอบที่", "วันที่", "หมายเหตุ"]],
      body: schedule.map(sv=>[
        sv.round ?? "",
        formatThaiDate(sv.date || ""),
        sv.note || ""
      ]),
      styles: { font: "Helvetica", fontSize: 11, cellPadding: 6 },
      headStyles: { fillColor: [240,240,240] },
      theme: "grid",
      didDrawPage: data=>{
        // footer page number
        const str = `หน้า ${data.pageNumber}`;
        doc.setFontSize(10);
        doc.text(str, pageWidth - marginR, doc.internal.pageSize.getHeight() - 24, { align: "right" });
      }
    });
    y = doc.lastAutoTable.finalY + 12;
  }

  // Terms & Conditions
  if (terms.length){
    doc.setFont(undefined, "bold");
    doc.text("ข้อกำหนดและเงื่อนไข", leftColX, y);
    doc.setFont(undefined, "normal");
    y += 10;

    const maxWidth = pageWidth - marginL - marginR;
    terms.forEach((t, idx)=>{
      const numbered = `${idx+1}. ${t}`;
      const lines = doc.splitTextToSize(numbered, maxWidth);
      // ขึ้นหน้าใหม่ถ้าพื้นที่ไม่พอ
      const needH = lines.length*14 + 6;
      const pageH  = doc.internal.pageSize.getHeight();
      if (y + needH > pageH - 96){
        doc.addPage();
        y = marginT;
      }
      doc.text(lines, leftColX, y);
      y += lines.length*14 + 6;
    });
  }

  // Signatures
  const pageH = doc.internal.pageSize.getHeight();
  if (y < pageH - 180) y = pageH - 180; // ดันลงล่างสวยๆ

  const sigBoxW = (pageWidth - marginL - marginR - 24) / 2;
  const boxY = y;

  // ฝั่งบริษัท
  doc.rect(marginL, boxY, sigBoxW, 120);
  doc.text("ลงชื่อผู้แทนบริษัท", marginL + 12, boxY + 18);
  doc.text("(.................................................)", marginL + 12, boxY + 90);
  if (signatures.companyRep) doc.text(`ชื่อ: ${signatures.companyRep}`, marginL + 12, boxY + 108);

  // ฝั่งลูกค้า
  const rightX = marginL + sigBoxW + 24;
  doc.rect(rightX, boxY, sigBoxW, 120);
  doc.text("ลงชื่อลูกค้า/ผู้ว่าจ้าง", rightX + 12, boxY + 18);
  doc.text("(.................................................)", rightX + 12, boxY + 90);
  if (signatures.clientRep) doc.text(`ชื่อ: ${signatures.clientRep}`, rightX + 12, boxY + 108);

  // บันทึกไฟล์
  doc.save(fileName);
}
