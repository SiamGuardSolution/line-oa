// src/ContractForm.jsx
import React, { useState } from "react";
import "./ContractForm.css";

const INITIAL = {
  name: "",
  phone: "",
  facebook: "",
  address: "",
  serviceType: "",
  servicePackage: "",
  startDate: "",
  endDate: "",
  serviceDate1: "",
  serviceDate2: "",
  note: ""
};

export default function ContractForm() {
  const [formData, setFormData] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  const normalizePhone = (val) => val.replace(/\D/g, "").slice(0, 10);
  const formatThaiPhone = (digits) => {
    if (!digits) return "";
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0,3)}-${digits.slice(3)}`;
    return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
  };
  const addMonths = (dateStr, n) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d)) return "";
    const day = d.getDate();
    d.setMonth(d.getMonth() + n);
    if (d.getDate() < day) d.setDate(0);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleChange = (e) => {
    if (!e?.target) return;
    const { name, value } = e.target;

    if (name === "phone") {
      const digits = normalizePhone(value);
      setFormData((prev) => ({ ...prev, phone: digits }));
      return;
    }

    if (name === "startDate") {
      const s1 = addMonths(value, 4);
      const s2 = addMonths(s1, 4);
      const end = addMonths(value, 12);
      setFormData((prev) => ({
        ...prev,
        startDate: value,
        serviceDate1: s1,
        serviceDate2: s2,
        endDate: end
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        // เผื่อฝั่ง GAS เดิมเคยใช้ชื่อ "package"
        package: formData.servicePackage
      };

      const res = await fetch("/api/submit-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const text = await res.text();

      let data;
      try { data = JSON.parse(text); } catch { /* ไม่ใช่ JSON */ }

      if (!res.ok || data?.result !== "success") {
        console.error("Server response:", text);
        alert("ส่งข้อมูลไม่สำเร็จ: " + (data?.message || text || `HTTP ${res.status}`));
        return;
      }

      console.log("DEBUG from GAS:", data); // จะเห็น sheetUrl/sheetName/row
      alert("ส่งข้อมูลสัญญาเรียบร้อยแล้ว!");
    } catch (err) {
      console.error("เกิดข้อผิดพลาด:", err);
      alert("ส่งข้อมูลไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="contract-form-container">
      <h2>ฟอร์มกรอกข้อมูลสัญญา</h2>
      <form className="contract-form" onSubmit={handleSubmit}>
        <input type="text" name="name" placeholder="ชื่อ-นามสกุล" value={formData.name} onChange={handleChange} required />
        <input type="tel" name="phone" placeholder="เบอร์โทร (0xx-xxx-xxxx)" value={formatThaiPhone(formData.phone)} onChange={handleChange} required />
        <input type="text" name="facebook" placeholder="Facebook ลูกค้า" value={formData.facebook} onChange={handleChange} />
        <textarea name="address" placeholder="ที่อยู่ลูกค้า" rows="3" value={formData.address} onChange={handleChange} />
        <input type="text" name="serviceType" placeholder="ประเภทบริการ" value={formData.serviceType} onChange={handleChange} />
        <input type="text" name="servicePackage" placeholder="แพ็กเกจ" value={formData.servicePackage} onChange={handleChange} />

        <label htmlFor="startDate">วันที่เริ่มสัญญา</label>
        <input id="startDate" type="date" name="startDate" value={formData.startDate} onChange={handleChange} />

        <label htmlFor="serviceDate1">รอบบริการครั้งที่ 1 (+4 เดือน)</label>
        <input id="serviceDate1" type="date" name="serviceDate1" value={formData.serviceDate1} readOnly />

        <label htmlFor="serviceDate2">รอบบริการครั้งที่ 2 (+4 เดือนจากครั้งที่ 1)</label>
        <input id="serviceDate2" type="date" name="serviceDate2" value={formData.serviceDate2} readOnly />

        <label htmlFor="endDate">วันที่สิ้นสุดสัญญา (+1 ปี)</label>
        <input id="endDate" type="date" name="endDate" value={formData.endDate} readOnly />

        <label htmlFor="note">หมายเหตุ</label>
        <textarea id="note" name="note" value={formData.note} onChange={handleChange} rows="3" placeholder="เช่น ลูกค้าต้องการช่างคนเดิม" />

        <button type="submit" disabled={submitting}>{submitting ? "กำลังส่ง..." : "ส่งข้อมูล"}</button>
      </form>
    </div>
  );
}
