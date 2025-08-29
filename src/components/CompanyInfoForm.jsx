// components/CompanyInfoForm.jsx
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from './CompanyInfoForm.module.css';

export default function CompanyInfoForm() {
  const router = useRouter();
  const [showTaxIdInPdf, setShowTaxIdInPdf] = useState(true);
  const [company, setCompany] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    taxId: '',
    logoUrl: '',
    bankAccounts: [{ bank: '', accountNo: '', accountName: '' }],
  });

  // Load saved
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = sessionStorage.getItem('companyInfo');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setCompany(prev => ({ ...prev, ...parsed }));
        if (typeof parsed.showTaxIdInPdf === 'boolean') setShowTaxIdInPdf(parsed.showTaxIdInPdf);
      } catch {}
    }
  }, []);

  const onChange = (key, value) => setCompany({ ...company, [key]: value });

  const updateBank = (idx, key, value) => {
    const next = [...company.bankAccounts];
    next[idx] = { ...next[idx], [key]: value };
    setCompany({ ...company, bankAccounts: next });
  };

  const addBank = () => setCompany({ ...company, bankAccounts: [...company.bankAccounts, { bank:'', accountNo:'', accountName:'' }] });
  const delBank = (idx) => setCompany({ ...company, bankAccounts: company.bankAccounts.filter((_,i)=>i!==idx) });

  const handleSave = () => {
    if (typeof window === 'undefined') return;
    const payload = { ...company, showTaxIdInPdf };
    sessionStorage.setItem('companyInfo', JSON.stringify(payload));
    router.push('/quotation-form');
  };

  return (
    <div className={styles.companyFormContainer}>
      <div className={`${styles.companyForm} ${styles.card}`}>
        <h1 className={styles.formTitle}>ข้อมูลบริษัท</h1>
        <p className={styles.formDesc}>ตั้งค่าเอกสารครั้งเดียว ใช้กับใบเสนอราคา/ใบกำกับ/ใบเสร็จได้ทั้งหมด</p>

        <div className={styles.field}>
          <label className={styles.label}>ชื่อบริษัท/ร้าน</label>
          <input className={styles.input} value={company.name} onChange={e=>onChange('name', e.target.value)} placeholder="เช่น Siam Guard Solution Co., Ltd."/>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>ที่อยู่</label>
          <textarea className={styles.textarea} value={company.address} onChange={e=>onChange('address', e.target.value)} placeholder="เลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์"/>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>โทรศัพท์</label>
            <input className={styles.input} value={company.phone} onChange={e=>onChange('phone', e.target.value)} placeholder="0x-xxx-xxxx"/>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>อีเมล</label>
            <input className={styles.input} value={company.email} onChange={e=>onChange('email', e.target.value)} placeholder="contact@company.com"/>
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>เลขผู้เสียภาษี</label>
            <input className={styles.input} value={company.taxId} onChange={e=>onChange('taxId', e.target.value)} placeholder="13 หลัก"/>
            <div className={styles.switchRow}>
              <input type="checkbox" id="showtax" checked={showTaxIdInPdf} onChange={e=>setShowTaxIdInPdf(e.target.checked)} />
              <label htmlFor="showtax" className={styles.label}>แสดงเลขผู้เสียภาษีใน PDF</label>
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>ลิงก์โลโก้ (PNG)</label>
            <input className={styles.input} value={company.logoUrl} onChange={e=>onChange('logoUrl', e.target.value)} placeholder="https://.../logo.png"/>
            <span className={styles.hint}>ถ้าเว้นไว้ จะใช้ชื่อบริษัทแทนโลโก้</span>
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.label}>บัญชีรับโอน</h3>
          <div className={styles.card}>
            {company.bankAccounts.map((b, idx)=>(
              <div className={styles.bankRow} key={idx}>
                <input className={styles.input} placeholder="ธนาคาร" value={b.bank} onChange={e=>updateBank(idx,'bank', e.target.value)} />
                <input className={styles.input} placeholder="เลขที่บัญชี" value={b.accountNo} onChange={e=>updateBank(idx,'accountNo', e.target.value)} />
                <input className={styles.input} placeholder="ชื่อบัญชี" value={b.accountName} onChange={e=>updateBank(idx,'accountName', e.target.value)} />
                <button className={`${styles.button} ${styles.delBtn}`} onClick={()=>delBank(idx)}>ลบ</button>
              </div>
            ))}
            <button className={`${styles.button} ${styles.addBtn}`} onClick={addBank}>+ เพิ่มบัญชี</button>
          </div>
        </div>

        <div className={styles.buttonBar}>
          <button className={`${styles.button} ${styles.secondary}`} onClick={()=>router.push('/quotation-form')}>ไปหน้าใบเสนอราคา</button>
          <button className={`${styles.button} ${styles.primary}`} onClick={handleSave}>💾 บันทึกข้อมูลบริษัท</button>
        </div>
      </div>
    </div>
  );
}