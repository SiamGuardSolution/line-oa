import React, { useState, useEffect, useCallback } from 'react';
import './CheckPage.css';
import liff from '@line/liff';

export default function CheckPage() {
  const [phone, setPhone] = useState('');
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(false);

  // 🟢 ตรวจสอบและดึงข้อมูลจาก Google Sheet
  const fetchContract = useCallback(async (phoneNumber) => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://script.google.com/macros/s/AKfycbzjWbm1loGYp5EWtSbXxRouSzgHmQhxNrD_gdrOo8H7k1FBQOZIg_qIbTknfdbVSivm4A/exec?phone=${phoneNumber}`
      );
      const data = await res.json();
      setContract(data);
      sessionStorage.setItem('phone', phoneNumber);
    } catch (err) {
      console.error('เกิดข้อผิดพลาด:', err);
    }
    setLoading(false);
  }, []);

  // 🔍 ค้นหาด้วยเบอร์
  const handleSearch = () => {
    const cleanedPhone = phone.trim();
    if (cleanedPhone) {
      fetchContract(cleanedPhone);
    }
  };

  // 🔁 เรียก LIFF และเก็บข้อมูลผู้ใช้
  useEffect(() => {
    const initLiff = async () => {
      try {
        await liff.init({ liffId: '2007877821-b3kqP26L' });

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const profile = await liff.getProfile();
        console.log('LINE profile:', profile);
        sessionStorage.setItem('lineUserId', profile.userId);
        sessionStorage.setItem('lineName', profile.displayName);
      } catch (err) {
        console.error('LIFF init failed', err);
      }
    };

    initLiff();
  }, []);

  // 🟡 โหลดข้อมูลจาก sessionStorage ถ้ามีเบอร์
  useEffect(() => {
    const savedPhone = sessionStorage.getItem('phone');
    if (savedPhone) {
      setPhone(savedPhone);
      fetchContract(savedPhone);
    }
  }, [fetchContract]);

  // 📅 แปลงวันที่ให้อ่านง่าย
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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
          <p><strong>เริ่มสัญญา:</strong> {formatDate(contract.startDate)}</p>
          <p><strong>รอบบริการถัดไป:</strong> {formatDate(contract.nextService)}</p>
          <p><strong>สถานะ:</strong> {
            new Date() <= new Date(contract.endDate)
              ? 'อยู่ในระยะประกัน'
              : 'หมดสัญญาแล้ว'
          }</p>
        </div>
      )}

      {contract?.error && (
        <p className="error">ไม่พบข้อมูลสำหรับเบอร์โทรนี้</p>
      )}
    </div>
  );
}
