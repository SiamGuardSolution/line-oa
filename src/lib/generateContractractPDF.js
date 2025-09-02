// src/lib/generateContractPDF.js
import jsPDF from 'jspdf';

// ถ้าโปรเจ็กต์คุณมีไฟล์ฟอนต์อยู่แล้ว (เช่น ../fonts/THSarabun) ให้ import ที่ entry (เช่น ContractForm.jsx) ตามเดิม
// import '../fonts/THSarabun';

const A4 = { w: 210, h: 297 };

const priceLine =
  `ราคาสุทธิ ${formatBaht(netPrice)} (รวมภาษีแล้ว)` +
  (discountValue > 0
    ? (discountType === 'percent'
        ? ` – ส่วนลด ${discountValue}%`
        : ` – ส่วนลด ${formatBaht(discountValue)}`)
    : '');

const contractForPDF = {
  ...contract,
  packageName: (PACKAGES?.[selectedPackage]?.label || selectedPackage),
  priceText: priceLine,
};

generateContractPDF(
  { company, customer, contract: contractForPDF, signatures },
  { qrDataUrl }
);

export function generateContractPDF(data, options = {}) {
  const {
    company = { name: 'Siam Guard Solution', address: '—', phone: '—', taxId: '—' },
    customer = { name: '—', phone: '—', address: '—' },
    contract = {
      number: '',
      startDate: '',
      endDate: '',
      signDate: '',
      serviceType: '',
      packageName: '',
      serviceScope: '',
      frequency: '',
      priceText: '',
      paymentTerm: 'ชำระเต็มจำนวนหลังรับบริการครั้งแรก',
      warranty: 'รับประกันตลอดอายุสัญญาตามเงื่อนไขบริษัท',
      extraNote: '',
    },
    signatures = { companySignDataUrl: null, customerSignDataUrl: null },
  } = data || {};

  const {
    logoDataUrl = null,
    qrDataUrl = null,
    brand = { primary: '#0ea5e9' },
  } = options;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // พยายามใช้ TH Sarabun ถ้ามี (จากไฟล์ฟอนต์เดิมของโปรเจกต์)
  try { doc.setFont('THSarabun'); } catch (e) { doc.setFont('Helvetica'); }

  const margin = { top: 18, right: 16, bottom: 18, left: 16 };
  const contentW = A4.w - margin.left - margin.right;
  let y = margin.top;

  const line = (len = contentW, offsetY = 3, color = '#e5e7eb') => {
    doc.setDrawColor(color); doc.setLineWidth(0.3);
    doc.line(margin.left, y + offsetY, margin.left + len, y + offsetY);
    y += offsetY + 2;
  };

  const title = (text) => { doc.setFontSize(22); doc.setTextColor(0,0,0); doc.text(text, A4.w/2, y, { align:'center' }); y += 8; };

  const paragraph = (text, opt = {}) => {
    const size = opt.size || 16; const lineH = opt.lineH || 7;
    doc.setFontSize(size);
    const wrapped = doc.splitTextToSize(text, contentW);
    wrapped.forEach(row => {
      if (y > A4.h - margin.bottom) { doc.addPage(); y = margin.top; }
      doc.text(row, margin.left, y); y += lineH;
    });
    y += 2;
  };

  const bullet = (text) => paragraph(`• ${text}`, { size: 16, lineH: 7 });

  const drawSignature = (caption, dataUrl) => {
    const boxH = 30, boxW = 70, startX = margin.left + 8;
    doc.setDrawColor('#9ca3af'); doc.rect(startX, y, boxW, boxH);
    if (dataUrl) { try { doc.addImage(dataUrl, 'PNG', startX+2, y+2, boxW-4, boxH-8, undefined, 'FAST'); } catch(e){} }
    doc.setFontSize(14); doc.text(`(ลงชื่อ) ${caption}`, startX, y + boxH + 7);
    doc.setDrawColor('#9ca3af'); doc.line(startX, y + boxH + 9, startX + boxW, y + boxH + 9);
    y += boxH + 16;
  };

  // Header
  if (logoDataUrl) doc.addImage(logoDataUrl, 'PNG', margin.left, y - 10, 24, 24);
  doc.setFontSize(18); doc.setTextColor(0,0,0);
  doc.text(company.name || 'Siam Guard Solution', margin.left + 30, y);
  doc.setFontSize(12); doc.setTextColor(80);
  doc.text([
    company.address || '—',
    `โทร. ${company.phone || '—'}`,
    `เลขประจำตัวผู้เสียภาษี: ${company.taxId || '—'}`
  ], margin.left + 30, y + 6);
  if (qrDataUrl) doc.addImage(qrDataUrl, 'PNG', A4.w - margin.right - 28, margin.top - 6, 28, 28);
  y += 14; line(contentW, 2, brand.primary);

  // Title
  title('สัญญาให้บริการกำจัดปลวก/แมลง');
  doc.setFontSize(14); doc.setTextColor(80);
  doc.text(`เลขที่สัญญา: ${contract.number || '—'}`, margin.left, y); y += 8; line();

  // Parties
  paragraph(
    `สัญญาฉบับนี้ทำขึ้น ณ วันที่ ${thaiDate(contract.signDate)} ระหว่าง ${company.name} (ต่อไปนี้เรียกว่า “ผู้ให้บริการ”) `
    + `และคุณ ${customer.name} โทร. ${customer.phone} ที่อยู่ ${customer.address} (ต่อไปนี้เรียกว่า “ผู้ว่าจ้าง”) `
    + `ซึ่งได้ตกลงทำสัญญากันดังต่อไปนี้`
  );

  // Service info
  bullet(`ประเภทบริการ: ${contract.serviceType || '—'}  /  แพ็กเกจ: ${contract.packageName || '—'}`);
  bullet(`ระยะเวลา: ${thaiDate(contract.startDate)} ถึง ${thaiDate(contract.endDate)} (รวม ${diffMonths(contract.startDate, contract.endDate)} เดือน)`);
  bullet(`ความถี่การบริการ: ${contract.frequency || '—'}`);
  bullet(`ค่าบริการ: ${contract.priceText || '—'}  เงื่อนไขชำระเงิน: ${contract.paymentTerm || '—'}`);
  if (contract.serviceScope) bullet(`ขอบเขตงาน: ${contract.serviceScope}`);
  if (contract.warranty)    bullet(`การรับประกัน: ${contract.warranty}`);
  if (contract.extraNote)   bullet(`หมายเหตุเพิ่มเติม: ${contract.extraNote}`);
  y += 2; line();

  // Clauses
  [
    'ผู้ให้บริการจะดำเนินงานตามมาตรฐานความปลอดภัย โดยใช้สารเคมี/ระบบที่ได้รับอนุญาตตามกฎหมาย',
    'ผู้ว่าจ้างอำนวยความสะดวกให้เข้าพื้นที่ตามนัด หากเลื่อนโปรดแจ้งล่วงหน้า 24 ชม.',
    'ระหว่างอายุสัญญา หากพบการระบาด ผู้ว่าจ้างร้องขอบริการแก้ไขได้ตามเงื่อนไขรับประกัน',
    'กรณีผิดนัดชำระ ผู้ให้บริการอาจเลื่อน/ระงับบริการจนกว่าจะชำระครบ',
    'คู่สัญญาเลิกสัญญาได้ หากอีกฝ่ายผิดสัญญาอย่างมีนัยสำคัญและไม่แก้ไขภายใน 15 วันนับแต่ได้รับแจ้ง',
    'สัญญานี้อยู่ภายใต้กฎหมายไทย และศาลไทยมีอำนาจ',
  ].forEach((c, i) => paragraph(`ข้อ ${i+1}. ${c}`));

  y += 2; line();

  // Signatures
  paragraph('ลงชื่อคู่สัญญา');
  drawSignature(`ผู้ว่าจ้าง (ลูกค้า): ${customer.name || ''}`, signatures.customerSignDataUrl);
  drawSignature(`ผู้ให้บริการ (บริษัท): ${company.name || ''}`, signatures.companySignDataUrl);

  doc.setFontSize(14);
  doc.text(`ลงนาม ณ วันที่ ${thaiDate(contract.signDate)}`, margin.left, y + 6);

  // ภาคผนวก (อ้างอิงไฟล์เจต.pdf)
  y += 14; paragraph('ภาคผนวก A – เอกสารแนบท้าย “เจต.pdf” ให้ถือเป็นส่วนหนึ่งของสัญญา', { size: 14 });

  const fileName = `CONTRACT-${contract.number || compactDate(contract.signDate)}-${sanitize(customer.name)}.pdf`;
  doc.save(fileName);
}

function thaiDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso); if (isNaN(d)) return iso;
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()+543}`;
}
function compactDate(iso){ if(!iso) return ''; const d=new Date(iso); if(isNaN(d))return''; const mm=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${d.getFullYear()}${mm}${dd}`; }
function diffMonths(a,b){ try{const d1=new Date(a), d2=new Date(b); return (d2.getFullYear()-d1.getFullYear())*12 + (d2.getMonth()-d1.getMonth()) + 1;}catch{return'-';} }
function sanitize(s=''){ return String(s).replace(/[^a-zA-Z0-9ก-๙\-_.]+/g,'_'); }

<div style={{border:'1px solid #e5e7eb', borderRadius:12, padding:16, marginTop:16}}>
  <h3 style={{margin:'0 0 12px 0'}}>สร้างสัญญา (PDF)</h3>

  {/* ข้อมูลลูกค้าแบบสั้น (ถ้าคุณมีฟิลด์เดิมอยู่แล้ว จะโยง state เดิมแทนได้ทันที) */}
  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
    <input placeholder="ชื่อลูกค้า" value={customerInfo.name}
           onChange={e=>setCustomerInfo(v=>({...v, name:e.target.value}))}/>
    <input placeholder="เบอร์โทร" value={customerInfo.phone}
           onChange={e=>setCustomerInfo(v=>({...v, phone:e.target.value}))}/>
  </div>
  <input style={{width:'100%', marginTop:8}} placeholder="ที่อยู่ลูกค้า"
         value={customerInfo.address}
         onChange={e=>setCustomerInfo(v=>({...v, address:e.target.value}))}/>

  {/* เมทาสัญญา */}
  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12}}>
    <input placeholder="เลขที่สัญญา" value={contractMeta.number}
           onChange={e=>setContractMeta(v=>({...v, number:e.target.value}))}/>
    <input type="date" placeholder="วันที่ลงนาม" value={contractMeta.signDate}
           onChange={e=>setContractMeta(v=>({...v, signDate:e.target.value}))}/>
    <input type="date" placeholder="เริ่มสัญญา" value={contractMeta.startDate}
           onChange={e=>setContractMeta(v=>({...v, startDate:e.target.value}))}/>
    <input type="date" placeholder="สิ้นสุดสัญญา" value={contractMeta.endDate}
           onChange={e=>setContractMeta(v=>({...v, endDate:e.target.value}))}/>
    <input placeholder="ประเภทบริการ (เช่น Spray/Bait/ผสมผสาน)" value={contractMeta.serviceType}
           onChange={e=>setContractMeta(v=>({...v, serviceType:e.target.value}))}/>
    <input placeholder="ชื่อแพ็กเกจ" value={contractMeta.packageName}
           onChange={e=>setContractMeta(v=>({...v, packageName:e.target.value}))}/>
    <input placeholder="ความถี่ (เช่น ทุก 45 วัน)" value={contractMeta.frequency}
           onChange={e=>setContractMeta(v=>({...v, frequency:e.target.value}))}/>
    <input placeholder="ค่าบริการ (เช่น 8,500 บาท/ปี)" value={contractMeta.priceText}
           onChange={e=>setContractMeta(v=>({...v, priceText:e.target.value}))}/>
  </div>
  <textarea style={{width:'100%', marginTop:8}} rows={3} placeholder="ขอบเขตงาน"
            value={contractMeta.serviceScope}
            onChange={e=>setContractMeta(v=>({...v, serviceScope:e.target.value}))}/>
  <textarea style={{width:'100%', marginTop:8}} rows={2} placeholder="หมายเหตุเพิ่มเติม"
            value={contractMeta.extraNote}
            onChange={e=>setContractMeta(v=>({...v, extraNote:e.target.value}))}/>

  {/* ลายเซ็น */}
  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12}}>
    <div>
      <div style={{fontWeight:700, marginBottom:6}}>ลายเซ็นลูกค้า</div>
      <SignatureCanvas ref={sigCustomerRef} penColor="#000"
        canvasProps={{ width: 320, height: 120, style:{border:'1px solid #e5e7eb', borderRadius:8, background:'#fff'} }} />
    </div>
    <div>
      <div style={{fontWeight:700, marginBottom:6}}>ลายเซ็นบริษัท</div>
      <SignatureCanvas ref={sigCompanyRef} penColor="#000"
        canvasProps={{ width: 320, height: 120, style:{border:'1px solid #e5e7eb', borderRadius:8, background:'#fff'} }} />
    </div>
  </div>

  <button type="button" onClick={handleGenerateContractPDF} style={{marginTop:12}}>
    สร้างสัญญา (PDF)
  </button>
</div>
