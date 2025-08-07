import React, { useState, useEffect, useCallback } from 'react';
import './CheckPage.css';

export default function CheckPage() {
  const [phone, setPhone] = useState('');
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState(null);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const fetchContracts = useCallback(async (phoneNumber) => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://script.google.com/macros/s/AKfycbzjWbm1loGYp5EWtSbXxRouSzgHmQhxNrD_gdrOo8H7k1FBQOZIg_qIbTknfdbVSivm4A/exec?phone=${phoneNumber}`
      );
      const data = await res.json();

      if (Array.isArray(data)) {
        setContracts(data);
      } else {
        setContracts([]);
      }

      sessionStorage.setItem('phone', phoneNumber);
    } catch (err) {
      console.error('เกิดข้อผิดพลาด:', err);
      setContracts([]);
    }
    setLoading(false);
  }, []);

  const handleSearch = useCallback(() => {
    if (phone.trim()) {
      fetchContracts(phone.trim());
    }
  }, [phone, fetchContracts]);

  useEffect(() => {
    const savedPhone = sessionStorage.getItem('phone');
    if (savedPhone) {
      setPhone(savedPhone);
      fetchContracts(savedPhone);
    }
  }, [fetchContracts]);

  const toggleExpand = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
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

      {!loading && contracts.length === 0 && phone && (
        <p className="error">ไม่พบข้อมูลสำหรับเบอร์โทรนี้</p>
      )}

      {contracts.map((contract, index) => (
        <div key={index} className="card">
          <h3>ข้อมูลสัญญา #{index + 1}</h3>
          <p><strong>ชื่อ:</strong> {contract.name}</p>
          <p><strong>เบอร์โทร:</strong> {contract.phone}</p>
          <p><strong>เริ่มสัญญา:</strong> {formatDate(contract.startDate)}</p>
          <p><strong>รอบบริการถัดไป:</strong> {formatDate(contract.nextService)}</p>
          <p><strong>สถานะ:</strong> {
            new Date() <= new Date(contract.endDate)
              ? 'อยู่ในระยะประกัน'
              : 'หมดสัญญาแล้ว'
          }</p>

          {expandedIndex === index && (
            <>
              <p><strong>ที่อยู่:</strong> {contract.address}</p>
              <p><strong>Facebook:</strong> {contract.facebook}</p>
              <p><strong>สิ้นสุดสัญญา:</strong> {formatDate(contract.endDate)}</p>
              <p><strong>ประเภทบริการ:</strong> {contract.serviceType}</p>
              <p><strong>แพ็กเกจ:</strong> {contract.package}</p>
              {contract.note && <p><strong>📝 หมายเหตุ:</strong> {contract.note}</p>}
            </>
          )}

          <button className="toggle-button" onClick={() => toggleExpand(index)}>
            {expandedIndex === index ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียดเต็ม'}
          </button>
        </div>
      ))}
    </div>
  );
}
