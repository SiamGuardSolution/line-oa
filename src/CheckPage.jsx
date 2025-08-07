import React, { useState, useEffect } from 'react';
import './CheckPage.css';

export default function CheckPage() {
  const [phone, setPhone] = useState('');
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(false);

  // ✅ โหลดข้อมูลจาก sessionStorage ถ้ามี
  useEffect(() => {
    const savedPhone = sessionStorage.getItem('phone');
    if (savedPhone) {
      setPhone(savedPhone);
      fetchContract(savedPhone);
    }
  }, []);

  const fetchContract = async (phoneNumber) => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://script.google.com/macros/s/AKfycbzjWbm1loGYp5EWtSbXxRouSzgHmQhxNrD_gdrOo8H7k1FBQOZIg_qIbTknfdbVSivm4A/exec?phone=${phoneNumber}`
      );
      const data = await res.json();
      setContract(data);
    } catch (err) {
      console.error('เกิดข้อผิดพลาด:', err);
    }
    setLoading(false);
  };

  const handleSearch = async () => {
    sessionStorage.setItem('phone', phone); // ✅ บันทึกเบอร์ไว้
    fetchContract(phone);
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
        <button onClick={handleSearch} className="button">ค้นหา</button>
      </div>

      {loading && <p className="loading">กำลังค้นหา...</p>}

      {contract && !contract.error && (
        <div className="card">
          <h3>ข้อมูลสัญญา</h3>
          <p><strong>ชื่อ:</strong> {contract.name}</p>
          <p><strong>เบอร์โทร:</strong> {contract.phone}</p>
          <p><strong>เริ่มสัญญา:</strong> {contract.startDate}</p>
          <p><strong>รอบบริการถัดไป:</strong> {contract.nextService}</p>
          <p><strong>สถานะ:</strong> {/* แสดงสถานะจากวันที่ */}</p>
        </div>
      )}

      {contract?.error && (
        <p className="error">ไม่พบข้อมูลสำหรับเบอร์โทรนี้</p>
      )}
    </div>
  );
}
