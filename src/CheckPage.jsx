import React, { useState } from 'react';
import './CheckPage.css'; // ใช้ .css ธรรมดา ไม่ใช่ module

export default function CheckPage() {
  const [phone, setPhone] = useState('');
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    setLoading(true);
    setError('');
    setContracts([]);

    try {
      const res = await fetch(
        `https://script.google.com/macros/s/AKfycbzjWbm1loGYp5EWtSbXxRouSzgHmQhxNrD_gdrOo8H7k1FBQOZIg_qIbTknfdbVSivm4A/exec?phone=${phone}`
      );
      const data = await res.json();

      if (Array.isArray(data)) {
        setContracts(data);
      } else {
        setError('ไม่พบข้อมูลสำหรับเบอร์โทรนี้');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('เกิดข้อผิดพลาดในการดึงข้อมูล');
    }

    setLoading(false);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH');
  };

  const getStatus = (endDate) => {
    if (!endDate) return '-';
    const now = new Date();
    const end = new Date(endDate);
    return now <= end ? 'อยู่ในระยะประกัน' : 'หมดสัญญาแล้ว';
  };

  return (
    <div className="check-container">
      <h2>ตรวจสอบข้อมูลสัญญา</h2>

      <div className="input-group">
        <input
          type="tel"
          placeholder="กรอกเบอร์โทร"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="input"
        />
        <button onClick={handleSearch} className="button">
          ค้นหา
        </button>
      </div>

      {loading && <p className="loading">กำลังค้นหา...</p>}
      {error && <p className="error">{error}</p>}

      {contracts.map((contract, index) => (
        <div key={index} className="card">
          <h3>ข้อมูลสัญญา #{index + 1}</h3>
          <p><strong>ชื่อ:</strong> {contract.name}</p>
          <p><strong>เบอร์โทร:</strong> {contract.phone}</p>
          <p><strong>เริ่มสัญญา:</strong> {formatDate(contract.startDate)}</p>
          <p><strong>รอบบริการถัดไป:</strong> {formatDate(contract.nextService)}</p>
          <p><strong>สถานะ:</strong> {getStatus(contract.endDate)}</p>
          <p><strong>ที่อยู่:</strong> {contract.address}</p>
          <p><strong>Facebook:</strong> {contract.facebook}</p>
          <p><strong>ประเภทบริการ:</strong> {contract.serviceType}</p>
          <p><strong>แพ็กเกจ:</strong> {contract.package}</p>
          {contract.note && (
            <p><strong>หมายเหตุ:</strong> {contract.note}</p>
          )}
        </div>
      ))}
    </div>
  );
}
