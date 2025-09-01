// src/lib/generateQuotationPDF.js
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';     // v3+
import { addFont } from './addFont';

// นำเข้าพาธไฟล์ฟอนต์ (Webpack จะให้เป็น URL)
import THSarabunNewURL from '../assets/fonts/THSarabunNew.ttf';
import THSarabunNewBoldURL from '../assets/fonts/THSarabunNew-Bold.ttf';

export async function generateQuotationPDF(data) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  // ฝังฟอนต์ (ต้องทำก่อนพิมพ์ตัวอักษร)
  await addFont(doc, THSarabunNewURL, 'THSarabunNew', 'normal');
  await addFont(doc, THSarabunNewBoldURL, 'THSarabunNew', 'bold');

  // ตั้งค่าฟอนต์เริ่มต้น
  doc.setFont('THSarabunNew', 'normal');
  doc.setFontSize(14);
  doc.setLineHeightFactor(1.35);

  // ==== ตัวอย่างเนื้อหา ====
  doc.setFont('THSarabunNew', 'bold');
  doc.setFontSize(18);
  doc.text('Quotation', 40, 60);

  doc.setFont('THSarabunNew', 'normal');
  doc.setFontSize(14);
  doc.text(`ลูกค้า: ${data.customerName}`, 40, 90);
  doc.text(`เบอร์: ${data.phone}`, 40, 110);

  // ตารางด้วย AutoTable (ใช้ฟอนต์เดียวกัน)
  autoTable(doc, {
    head: [['รายการ', 'จำนวน', 'ราคา (บาท)']],
    body: data.items.map(i => [i.name, String(i.qty), i.price.toLocaleString()]),
    styles: { font: 'THSarabunNew', fontStyle: 'normal', fontSize: 12, cellPadding: 6, lineHeight: 1.35 },
    headStyles: { font: 'THSarabunNew', fontStyle: 'bold', fontSize: 12 },
    columnStyles: { 2: { halign: 'right' } },
    margin: { top: 140 },
  });

  const y = doc.lastAutoTable.finalY + 24;
  doc.text(`ราคารวมสุทธิ: ${data.total.toLocaleString()} บาท`, 40, y);

  doc.save(`Quotation_${data.phone}_${data.issueDate}.pdf`);
}
