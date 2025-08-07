// CheckPage.jsx
import React, { useState } from 'react';

export default function CheckPage() {
  const [phone, setPhone] = useState('');
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    const res = await fetch(`https://script.google.com/macros/s/AKfycbzjWbm1loGYp5EWtSbXxRouSzgHmQhxNrD_gdrOo8H7k1FBQOZIg_qIbTknfdbVSivm4A/exec?phone=${phone}`);
    const data = await res.json();
    setContract(data);
    setLoading(false);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>ตรวจสอบข้อมูลสัญญา</h2>
      <input
        type="tel"
        placeholder="กรอกเบอร์โทรศัพท์"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        style={{ padding: 10, width: '100%', marginBottom: 10 }}
      />
      <button onClick={handleSearch} style={{ padding: 10 }}>ค้นหา</button>

      {loading && <p>กำลังค้นหา...</p>}

      {contract && !contract.error && (
        <div style={{ marginTop: 20 }}>
          <p><strong>ชื่อ:</strong> {contract.name}</p>
          <p><strong>เริ่มสัญญา:</strong> {contract.startDate}</p>
          <p><strong>รอบบริการถัดไป:</strong> {contract.nextServiceDate}</p>
          <p><strong>สถานะ:</strong> {contract.status}</p>
          <p><strong>หมายเหตุ:</strong> {contract.note}</p>
        </div>
      )}

      {contract?.error && <p style={{ color: 'red' }}>{contract.error}</p>}
    </div>
  );
}
