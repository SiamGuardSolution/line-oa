import React, { useState, useEffect } from 'react';
import './CheckPage.css';
import liff from '@line/liff';

export default function CheckPage() {
  const [phone, setPhone] = useState('');
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true); // 👈 แสดงสถานะกำลังเข้าสู่ระบบ

  // 📦 ตรวจสอบ session และดึงโปรไฟล์ใหม่ถ้าจำเป็น
  useEffect(() => {
    const initLiff = async () => {
      try {
        await liff.init({ liffId: '2007877821-b3kqP26L' }); // 🔁 ใส่ LIFF ID จริง

        if (!liff.isLoggedIn()) {
          liff.login(); // 🔁 Redirect ไป login
          return;
        }

        // ✅ หาก login แล้ว แต่ยังไม่มี sessionStorage → ดึงโปรไฟล์ใหม่
        const storedUserId = sessionStorage.getItem('lineUserId');
        if (!storedUserId) {
          const profile = await liff.getProfile();
          sessionStorage.setItem('lineUserId', profile.userId);
          sessionStorage.setItem('lineName', profile.displayName);
          console.log('LINE profile loaded:', profile);
        }

        // 🔁 โหลดเบอร์ที่เคยกรอกไว้
        const savedPhone = sessionStorage.getItem('phone');
        if (savedPhone) {
          setPhone(savedPhone);
          fetchContract(savedPhone);
        }
      } catch (err) {
        console.error('LIFF init failed:', err);
      } finally {
        setInitializing(false);
      }
    };

    initLiff();
  }, []);

  // 📡 เรียกข้อมูลจาก Google Apps Script
  const fetchContract = async (phoneNumber) => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://script.google.com/macros/s/AKfycbzjWbm1loGYp5EWtSbXxRouSzgHmQhxNrD_gdrOo8H7k1FBQOZIg_qIbTknfdbVSivm4A/exec?phone=${phoneNumber}`
      );
      const data = await res.json();
      setContract(data);
      sessionStorage.setItem('phone', phoneNumber);
    } catch (err) {
      console.error('เกิดข้อผิดพลาดในการดึงข้อมูล:', err);
    }
    setLoading(false);
  };

  const handleSearch = () => {
    if (!phone) return;
    fetchContract(phone);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH');
  };

  // 🔄 กรณีกำลัง Login ผ่าน LINE
  if (initializing) {
    return (
      <div className="check-container">
        <p>กำลังเข้าสู่ระบบผ่าน LINE...</p>
      </div>
    );
  }

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
