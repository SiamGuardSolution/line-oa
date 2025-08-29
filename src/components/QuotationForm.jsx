// components/QuotationForm.jsx
import React, { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import registerTHSarabun from '../fonts/THSarabun';
import { useRouter } from 'next/router';
import SignatureCanvas from 'react-signature-canvas';
import styles from './QuotationForm.module.css';

export default function QuotationForm() {
  const router = useRouter();
  const signRef = useRef(null);

  const [docType, setDocType] = useState('ใบเสนอราคา');
  const [docNo, setDocNo] = useState('');
  const [docDate, setDocDate] = useState(new Date().toISOString().slice(0,10));

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');

  const [items, setItems] = useState([{ name:'', quantity:1, price:0 }]);
  const [vatEnabled, setVatEnabled] = useState(true);
  const [vatRate, setVatRate] = useState(7);
  const [notes, setNotes] = useState(['ราคานี้รวมค่าเดินทางแล้ว']);

  const [company, setCompany] = useState(null);

  // Load company info (and guard SSR)
  useEffect(()=>{
    if (typeof window === 'undefined') return;
    const raw = sessionStorage.getItem('companyInfo');
    if (!raw) {
      // if no company yet, go set it up
      router.push('/company-form');
      return;
    }
    try {
      const data = JSON.parse(raw);
      setCompany(data);
    } catch {
      router.push('/company-form');
    }
  }, []);

  // Generate default doc no when docType/date changes
  useEffect(()=>{
    const prefix = ({
      'ใบเสนอราคา':'QT',
      'ใบแจ้งหนี้':'IN',
      'ใบเสร็จรับเงิน':'RN',
      'ใบกำกับภาษี':'TAX',
      'ใบส่งของ':'DN',
    })[docType] || 'DOC';
    const ymd = docDate.replace(/-/g,'');
    const rand = Math.random().toString(36).slice(2,6).toUpperCase();
    setDocNo(`${prefix}-${ymd}-${rand}`);
  }, [docType, docDate]);

  const addItem = ()=> setItems([...items, { name:'', quantity:1, price:0 }]);
  const delItem = (idx)=> setItems(items.filter((_,i)=>i!==idx));
  const setItem = (idx, key, value)=>{
    const next = [...items];
    next[idx] = { ...next[idx], [key]: value };
    setItems(next);
  };

  const subTotal = items.reduce((s,it)=> s + (Number(it.quantity)||0)*(Number(it.price)||0), 0);
  const vatAmount = vatEnabled ? subTotal * (Number(vatRate)||0)/100 : 0;
  const grandTotal = subTotal + vatAmount;

  const clearCache = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('companyInfo');
    }
    setClientName(''); setClientPhone(''); setClientAddress('');
    setItems([{ name:'', quantity:1, price:0 }]);
    setNotes(['ราคานี้รวมค่าเดินทางแล้ว']);
  };

  const generatePDF = () => {
    if (!company) {
      alert('กรุณากรอกข้อมูลบริษัทก่อน');
      return;
    }
    const doc = new jsPDF({ unit: 'pt', format:'a4' });

    // Try register THSarabun (no-op by default unless you swap fonts file)
    try { registerTHSarabun(); } catch {}
    // If THSarabun is registered, use it; otherwise helvetica
    const fonts = doc.getFontList ? Object.keys(doc.getFontList()) : [];
    const useTH = fonts.map(f=>f.toLowerCase()).includes('thsarabun');
    if (useTH) doc.setFont('THSarabun'); else doc.setFont('helvetica');
    doc.setFontSize(12);

    // Header
    const marginX = 36;
    let y = 40;
    if (company.logoUrl) {
      // draw image if possible (must be CORS-permitted dataURL)
      // We'll skip fetch here to avoid CORS; user can paste dataURL directly
      if (company.logoUrl.startsWith('data:image')) {
        try { doc.addImage(company.logoUrl, 'PNG', marginX, y-8, 120, 40); } catch {}
      }
    }

    doc.setFontSize(20);
    doc.text(docType, 560, y, { align:'right' });
    doc.setFontSize(12);

    // Company Block
    y += 12;
    doc.text(company.name || '', marginX, y);
    y += 16;
    const compLines = [company.address, `โทร: ${company.phone||''}  อีเมล: ${company.email||''}`];
    if (company.showTaxIdInPdf && company.taxId) compLines.push(`เลขผู้เสียภาษี: ${company.taxId}`);
    compLines.forEach(line=>{ if (line) { doc.text(String(line), marginX, y); y+=14; } });

    // Meta
    y = 96;
    doc.text(`เลขที่เอกสาร: ${docNo}`, 560, y, { align:'right' });
    y += 16;
    doc.text(`วันที่: ${docDate}`, 560, y, { align:'right' });

    // Client Block
    y += 28;
    doc.setFontSize(14); doc.text('ลูกค้า', marginX, y); doc.setFontSize(12);
    y += 16;
    const clientLines = [clientName, clientAddress, clientPhone && `โทร: ${clientPhone}`].filter(Boolean);
    clientLines.forEach(line=>{ doc.text(String(line), marginX, y); y+=14; });

    // Items table
    const body = items.map((it, i)=>[i+1, it.name, String(it.quantity||0), String(it.price||0), (Number(it.quantity||0)*Number(it.price||0)).toFixed(2)]);
    autoTable(doc, {
      startY: y + 8,
      head: [['#','รายการ','จำนวน','ราคา/หน่วย','ราคารวม']],
      body,
      styles:{ font: useTH ? 'THSarabun' : undefined, fontSize: 12 },
      headStyles:{ fillColor:[37,99,235], textColor:255 },
      columnStyles:{ 0:{cellWidth:24}, 2:{cellWidth:64, halign:'right'}, 3:{cellWidth:80, halign:'right'}, 4:{cellWidth:90, halign:'right'} },
      margin:{ left: marginX, right: marginX },
    });
    let tableY = doc.lastAutoTable ? doc.lastAutoTable.finalY : (y+80);

    // Totals
    const tX = 360, tW = 200;
    doc.text('รวมย่อย', tX, tableY + 24);
    doc.text(subTotal.toFixed(2), tX + tW, tableY + 24, { align:'right' });
    if (vatEnabled) {
      doc.text(`VAT ${vatRate}%`, tX, tableY + 24 + 16);
      doc.text(vatAmount.toFixed(2), tX + tW, tableY + 24 + 16, { align:'right' });
    }
    doc.setFontSize(14);
    doc.text('ยอดสุทธิ', tX, tableY + 24 + (vatEnabled? 32:16));
    doc.text(grandTotal.toFixed(2), tX + tW, tableY + 24 + (vatEnabled? 32:16), { align:'right' });
    doc.setFontSize(12);

    // Notes
    let ny = tableY + 24 + (vatEnabled? 48:32) + 18;
    doc.text('หมายเหตุ', marginX, ny);
    ny += 8;
    notes.filter(Boolean).forEach((n,i)=>{ doc.text(`• ${n}`, marginX, ny + i*14); });
    ny += notes.length*14 + 12;

    // Signature
    doc.text('ลายเซ็นลูกค้า', marginX, ny);
    const sigData = (signRef.current && !signRef.current.isEmpty()) ? signRef.current.getTrimmedCanvas().toDataURL('image/png') : null;
    if (sigData) {
      try { doc.addImage(sigData, 'PNG', marginX, ny+6, 160, 60); } catch {}
    } else {
      doc.text('(ยังไม่ลงนาม)', marginX, ny+40);
    }

    // Footer bank accounts
    ny += 90;
    if (company.bankAccounts && company.bankAccounts.length) {
      doc.text('บัญชีรับโอน', marginX, ny);
      company.bankAccounts.forEach((b, i)=>{
        const line = [b.bank, b.accountNo, b.accountName].filter(Boolean).join(' • ');
        if (line) doc.text(`- ${line}`, marginX, ny + 16 + i*14);
      });
    }

    doc.save(`${docNo}.pdf`);
  };

  return (
    <div className={styles.quotationContainer}>
      <div className={styles.quotationCard}>
        <div className={styles.header}>
          <h1>สร้างเอกสาร</h1>
          <div className={styles.controls}>
            <button className={`${styles.button} ${styles.gray}`} onClick={()=>router.push('/company-form')}>🔧 แก้ข้อมูลบริษัท</button>
            <button className={`${styles.button} ${styles.blue}`} onClick={generatePDF}>📄 สร้าง PDF</button>
            <button className={`${styles.button} ${styles.lightgray}`} onClick={clearCache}>🗑 ล้างข้อมูล</button>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.row}>
            <div>
              <label className={styles.label}>ประเภทเอกสาร</label>
              <select className={styles.select} value={docType} onChange={e=>setDocType(e.target.value)}>
                <option>ใบเสนอราคา</option>
                <option>ใบแจ้งหนี้</option>
                <option>ใบเสร็จรับเงิน</option>
                <option>ใบกำกับภาษี</option>
                <option>ใบส่งของ</option>
              </select>
            </div>
            <div>
              <label className={styles.label}>เลขที่เอกสาร (ปรับได้)</label>
              <input className={styles.input} value={docNo} onChange={e=>setDocNo(e.target.value)} />
            </div>
          </div>
          <div className={styles.row}>
            <div>
              <label className={styles.label}>วันที่</label>
              <input type="date" className={styles.input} value={docDate} onChange={e=>setDocDate(e.target.value)} />
            </div>
            <div>
              <label className={styles.label}>ลูกค้า</label>
              <input className={styles.input} value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="ชื่อผู้ติดต่อ/บริษัทลูกค้า" />
            </div>
          </div>
          <div className={styles.row}>
            <div>
              <label className={styles.label}>โทรศัพท์ลูกค้า</label>
              <input className={styles.input} value={clientPhone} onChange={e=>setClientPhone(e.target.value)} placeholder="0x-xxx-xxxx" />
            </div>
            <div>
              <label className={styles.label}>ที่อยู่ลูกค้า</label>
              <input className={styles.input} value={clientAddress} onChange={e=>setClientAddress(e.target.value)} placeholder="สำหรับพิมพ์ในเอกสาร" />
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <h3>รายการสินค้า/บริการ</h3>
            <button className={styles.button} onClick={addItem}>+ เพิ่มรายการ</button>
          </div>
          <table className={styles.itemsTable}>
            <thead className={styles.itemsHead}>
              <tr><th>#</th><th>รายการ</th><th>จำนวน</th><th>ราคา/หน่วย</th><th>รวม</th><th></th></tr>
            </thead>
            <tbody>
              {items.map((it, idx)=>(
                <tr key={idx} className={styles.itemRow}>
                  <td>{idx+1}</td>
                  <td><input className={styles.itemInput} value={it.name} onChange={e=>setItem(idx,'name', e.target.value)} placeholder="เช่น อัดท่อ + ฉีดพ่น 1 ปี"/></td>
                  <td><input className={styles.itemInput} type="number" min="0" value={it.quantity} onChange={e=>setItem(idx,'quantity', Number(e.target.value))}/></td>
                  <td><input className={styles.itemInput} type="number" min="0" step="0.01" value={it.price} onChange={e=>setItem(idx,'price', Number(e.target.value))}/></td>
                  <td style={{textAlign:'right'}}>{((Number(it.quantity)||0)*(Number(it.price)||0)).toFixed(2)}</td>
                  <td><button className={styles.button} onClick={()=>delItem(idx)}>ลบ</button></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={styles.row} style={{marginTop:12}}>
            <div>
              <label className={styles.label}>หมายเหตุ</label>
              <textarea className={styles.textarea} value={notes.join('\n')} onChange={e=>setNotes(e.target.value.split('\n'))} placeholder="พิมพ์ 1 บรรทัดต่อ 1 ข้อความ"/>
            </div>
            <div className={`${styles.totals} ${styles.calc}`}>
              <div className={styles.totalRow}><span>รวมย่อย</span><strong>{subTotal.toFixed(2)}</strong></div>
              <div className={styles.totalRow}>
                <label><input type="checkbox" checked={vatEnabled} onChange={e=>setVatEnabled(e.target.checked)} /> รวม VAT</label>
                <div>
                  {vatEnabled && <input type="number" className={styles.input} style={{width:70}} value={vatRate} onChange={e=>setVatRate(Number(e.target.value))}/>}
                </div>
              </div>
              {vatEnabled && <div className={styles.totalRow}><span>VAT {vatRate}%</span><strong>{vatAmount.toFixed(2)}</strong></div>}
              <div className={styles.totalRow}><span>ยอดสุทธิ</span><strong>{grandTotal.toFixed(2)}</strong></div>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h3>ลายเซ็นลูกค้า (ไม่บังคับ)</h3>
          <div className={styles.signatureWrap}>
            <div className={styles.signBox}>
              <SignatureCanvas ref={signRef} penColor="white" backgroundColor="#0b1220" canvasProps={{ width: 360, height: 140 }}/>
            </div>
            <div className={styles.controls}>
              <button className={styles.button} onClick={()=>signRef.current?.clear()}>ล้างลายเซ็น</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}