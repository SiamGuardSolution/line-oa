// src/lib/generateQuotationPDF.js
import { jsPDF } from "jspdf";
import "jspdf-autotable";

// ---- ช่วยโหลดฟอนต์จาก public/fonts แล้วแปลงเป็น base64 ----
const toBase64 = (ab) => {
  const CHUNK = 0x8000;
  const bytes = new Uint8Array(ab);
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
};

const fontUrl = (name) => `${process.env.PUBLIC_URL || ""}/fonts/${name}`;

async function ensureSarabun(doc) {
  // โหลด Regular
  const regResp = await fetch(fontUrl("Sarabun-Regular.ttf"));
  if (!regResp.ok) throw new Error("ไม่พบไฟล์ฟอนต์ Sarabun-Regular.ttf ใน public/fonts");
  const regB64 = toBase64(await regResp.arrayBuffer());
  doc.addFileToVFS("Sarabun-Regular.ttf", regB64);
  doc.addFont("Sarabun-Regular.ttf", "Sarabun", "normal");

  // โหลด Bold (ถ้ามี)
  try {
    const boldResp = await fetch(fontUrl("Sarabun-Bold.ttf"));
    if (boldResp.ok) {
      const boldB64 = toBase64(await boldResp.arrayBuffer());
      doc.addFileToVFS("Sarabun-Bold.ttf", boldB64);
      doc.addFont("Sarabun-Bold.ttf", "Sarabun", "bold");
    }
  } catch (_) {}

  doc.setFont("Sarabun", "normal");
}

// ---- ยูทิลเดิมของคุณ (คงไว้) ----
const fmt = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const priceOf = (serviceType = "", pkg = "") => {
  const text = `${serviceType} ${pkg}`;
  if (/อัดท่อ/.test(text)) return 3993;
  if (/ฉีดพ่น/.test(text)) return 2882;
  return 0;
};

// ---- ฟังก์ชันหลัก: เปลี่ยนเป็น async เพื่อรอโหลดฟอนต์ ----
export async function generateQuotationPDF(form) {
  const doc = new jsPDF({ unit: "pt" });

  // โหลด/ลงทะเบียนฟอนต์ Sarabun ก่อนพิมพ์
  await ensureSarabun(doc);

  const companyName = "Siam Guard Solution";
  const today = new Date();
  const fileName =
    `Quotation_${form.phone || "unknown"}_` +
    `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}.pdf`;

  // Header
  doc.setFont("Sarabun", "bold");
  doc.setFontSize(16);
  doc.text("ใบเสนอราคา (Quotation)", 40, 40);

  doc.setFont("Sarabun", "normal");
  doc.setFontSize(11);
  doc.text(companyName, 40, 60);

  // Customer
  const custY = 90;
  doc.setFontSize(12);
  doc.text("ข้อมูลลูกค้า", 40, custY);
  doc.setFontSize(10);
  doc.text(`ชื่อ-นามสกุล: ${form.name || "-"}`, 40, custY + 18);
  doc.text(`เบอร์โทร: ${form.phone || "-"}`, 40, custY + 36);
  doc.text(`ที่อยู่: ${form.address || "-"}`, 40, custY + 54);
  doc.text(`Facebook/Line: ${form.facebook || "-"}`, 40, custY + 72);

  // Service
  const svcY = custY + 110;
  doc.setFontSize(12);
  doc.text("รายละเอียดบริการ", 40, svcY);
  doc.setFontSize(10);
  doc.text(`ประเภทบริการ: ${form.serviceType || "-"}`, 40, svcY + 18);
  doc.text(`แพ็กเกจ: ${form.package || "-"}`, 40, svcY + 36);
  doc.text(`วันเริ่มสัญญา: ${fmt(form.startDate)}`, 40, svcY + 54);
  doc.text(`วันสิ้นสุดสัญญา: ${fmt(form.endDate)}`, 40, svcY + 72);
  if (form.nextServiceDate) doc.text(`รอบบริการถัดไป: ${fmt(form.nextServiceDate)}`, 40, svcY + 90);

  // Items table
  const unitPrice = priceOf(form.serviceType, form.package);
  const rows = [[`${form.serviceType || ""} - ${form.package || ""}`, 1, unitPrice.toLocaleString(), unitPrice.toLocaleString()]];
  doc.autoTable({
    head: [["รายการ", "จำนวน", "ราคาต่อหน่วย (บาท)", "ราคารวม (บาท)"]],
    body: rows,
    startY: svcY + 110,
    styles: { font: "Sarabun", fontStyle: "normal", fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [230, 230, 230], font: "Sarabun", fontStyle: "bold" },
  });

  // Summary
  const endY = doc.lastAutoTable.finalY || svcY + 110;
  const subtotal = unitPrice;
  const vat = 0;
  const total = subtotal + vat;

  doc.setFontSize(11);
  doc.text(`ราคารวมย่อย: ${subtotal.toLocaleString()} บาท`, 320, endY + 24);
  doc.text(`ภาษีมูลค่าเพิ่ม: ${vat.toLocaleString()} บาท`, 320, endY + 42);
  doc.setFont("Sarabun", "bold");
  doc.setFontSize(12);
  doc.text(`รวมทั้งสิ้น: ${total.toLocaleString()} บาท`, 320, endY + 64);

  // Notes
  doc.setFont("Sarabun", "normal");
  doc.setFontSize(10);
  doc.text("เงื่อนไข:", 40, endY + 24);
  doc.text("- ใบเสนอราคามีอายุ 7 วันนับจากวันที่ออกเอกสาร", 40, endY + 40);
  doc.text("- กำหนดการเข้าบริการยืนยันอีกครั้งหลังชำระเงิน/มัดจำ", 40, endY + 56);
  if (form.note) {
    // ตัดบรรทัดอัตโนมัติเพื่อกันข้อความยาวล้น
    const lines = doc.splitTextToSize(`หมายเหตุ: ${form.note}`, 500);
    doc.text(lines, 40, endY + 76);
  }

  doc.save(fileName);
}
