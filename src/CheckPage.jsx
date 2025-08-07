import React, { useState } from 'react';
import './CheckPage.css'; // ✅ ใช้แบบธรรมดา

export default function CheckPage() {
  const [phone, setPhone] = useState('');
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://script.google.com/macros/s/AKfycbzjWbm1loGYp5EWtSbXxRouSzgHmQhxNrD_gdrOo8H7k1FBQOZIg_qIbTknfdbVSivm4A/exec?phone=${phone}`);
      const data = await res.json();
      setContract(data);
    } catch (err) {
      console.error('เกิดข้อผิดพลาด:', err);
    }
    setLoading(false);
  };

  return (
    <div className="container">
      <h2 className="title">ตรวจสอบข้อมูลสัญญา</h2>

      <div className="inputGroup">
        <input
          type="tel"
          placeholder="กรอกเบอร์โทร"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="input"
        />
        <button onClick={handleSearch} className="button">ค้นหา</button>
      </div>

      {loading && <p className="loading">กำลังค้นหา...</p>}

      {contract && !contract.error && (
        <div className="card">
          <h3>ข้อมูลสัญญา</h3>
          <p><strong>ชื่อ:</strong> {contract.name}</p>
          <p><strong>ที่อยู่:</strong> {contract.address}</p>
          <p><strong>Facebook:</strong> {contract.facebook}</p>
          <p><strong>เบอร์โทร:</strong> {contract.phone}</p>
          <p><strong>เริ่มสัญญา:</strong> {new Date(contract.startDate).toLocaleDateString()}</p>
          <p><strong>สิ้นสุดสัญญา:</strong> {new Date(contract.endDate).toLocaleDateString()}</p>
          <p><strong>รอบบริการถัดไป:</strong> {new Date(contract.nextService).toLocaleDateString()}</p>
          <p><strong>ประเภทบริการ:</strong> {contract.serviceType}</p>
          <p><strong>แพ็กเกจ:</strong> {contract.package}</p>
          {contract.note && <p><strong>📝 หมายเหตุ:</strong> {contract.note}</p>}
        </div>
      )}

      {contract?.error && (
        <p className="error">ไม่พบข้อมูลสำหรับเบอร์โทรนี้</p>
      )}
    </div>
  );
}
