// ServiceRecordForm.jsx
import React, { useState } from "react";
import'./ServiceRecordForm.css';

export default function ServiceRecordForm() {
  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    serviceDate: new Date().toISOString().slice(0, 10), // default = วันนี้
    technician: '',
    serviceNote: ''
  });

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch('https://script.google.com/macros/s/AKfycbzjWbm1loGYp5EWtSbXxRouSzgHmQhxNrD_gdrOo8H7k1FBQOZIg_qIbTknfdbVSivm4A/exec?path=service-record', {
        method: 'POST',
        mode: "cors",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'สมหญิง',
          phone: '0891234567',
          serviceDate: '2025-08-08',
          technician: 'ช่างแซม',
          serviceNote: 'ตรวจสอบแล้ว ไม่พบปัญหา',
        }),
      });
      alert('บันทึกเรียบร้อยแล้ว!');
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาด');
    }
  };

  return (
    <div className="service-form-container">
      <h2>บันทึกการให้บริการ</h2>
      <form onSubmit={handleSubmit} className="service-form">
        <input name="customerName" type="text" placeholder="ชื่อลูกค้า" onChange={handleChange} required />
        <input name="phone" type="tel" placeholder="เบอร์โทรลูกค้า" onChange={handleChange} required />
        <input name="serviceDate" type="date" value={formData.serviceDate} onChange={handleChange} />
        <input name="technician" type="text" placeholder="ชื่อช่างผู้ให้บริการ" onChange={handleChange} />
        <textarea name="serviceNote" placeholder="หมายเหตุ (ถ้ามี)" onChange={handleChange} rows="3"></textarea>
        <button type="submit">บันทึก</button>
      </form>
    </div>
  );
}
