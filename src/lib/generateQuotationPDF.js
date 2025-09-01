// src/lib/generateQuotationPDF.js
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

async function addFontFromPublic(doc, publicPath, name, style = 'normal') {
  const res = await fetch(publicPath, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Font not found: ${publicPath} (${res.status})`);
  const buf = await res.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  const vfsName = `${name}-${style}.ttf`;
  doc.addFileToVFS(vfsName, base64);
  doc.addFont(vfsName, name, style);
}

export async function generateQuotationPDF(data) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  // ฝังฟอนต์จาก public/fonts
  await addFontFromPublic(doc, '/fonts/THSarabunNew.ttf', 'THSarabunNew', 'normal');
  await addFontFromPublic(doc, '/fonts/THSarabunNew-Bold.ttf', 'THSarabunNew', 'bold');

  // alias เผื่อโค้ดที่ยังเผลอเรียกชื่อเดิม
  doc.addFont('THSarabunNew-normal.ttf', 'THSarabun', 'normal');
  doc.addFont('THSarabunNew-bold.ttf',   'THSarabun', 'bold');

  doc.setFont('THSarabunNew', 'normal');
  doc.setFontSize(12);
  doc.setLineHeightFactor(1.35);

  const marginX = 36;
  let y = 48;

  // หัวเอกสาร
  doc.setFont('THSarabunNew', 'bold');
  doc.setFontSize(18);
  doc.text('Quotation', marginX, y);
  doc.setFont('THSarabunNew', 'normal');
  doc.setFontSize(12);
  y += 18;

  // ลูกค้า
  if (data.customerName) {
    doc.text(`ลูกค้า: ${data.customerName}`, marginX, y);
    y += 14;
  }
  if (data.phone) {
    doc.text(`โทร: ${data.phone}`, marginX, y);
    y += 14;
  }
  if (data.address) {
    doc.text(String(data.address), marginX, y);
    y += 14;
  }

  // ตารางรายการ
  const body = (data.items || []).map((it, i) => [
    i + 1,
    it.name || '',
    String(it.qty || 0),
    Number(it.price || 0).toLocaleString(),
    Number((it.qty || 0) * (it.price || 0)).toLocaleString(),
  ]);

  autoTable(doc, {
    startY: y + 8,
    head: [['#', 'รายการ', 'จำนวน', 'ราคา/หน่วย', 'ราคารวม']],
    body,
    styles: { font: 'THSarabunNew', fontStyle: 'normal', fontSize: 12, lineHeight: 1.35 },
    headStyles: { font: 'THSarabunNew', fontStyle: 'bold', fontSize: 12, fillColor: [37, 99, 235], textColor: 255 },
    columnStyles: { 0: { cellWidth: 24 }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    margin: { left: marginX, right: marginX },
  });

  const tableY = doc.lastAutoTable ? doc.lastAutoTable.finalY : (y + 80);

  // รวมยอด
  const total = Number(data.total || 0);
  const tX = 360, tW = 200;
  doc.text('ยอดสุทธิ', tX, tableY + 24);
  doc.text(total.toLocaleString(), tX + tW, tableY + 24, { align: 'right' });

  // หมายเหตุ
  let ny = tableY + 48;
  if (data.note) {
    doc.text('หมายเหตุ', marginX, ny);
    ny += 14;
    doc.text(String(data.note), marginX, ny);
  }

  doc.save(`Quotation_${data.phone || ''}_${Date.now()}.pdf`);
}
