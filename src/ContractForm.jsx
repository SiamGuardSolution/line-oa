// src/ContractForm.jsx
import React, { useState } from "react";
import "./ContractForm.css";

const INITIAL = {
  name: "",
  phone: "",
  facebook: "",
  address: "",
  serviceType: "",
  servicePackage: "",   // ใช้คีย์นี้ให้ตรงกับ state
  startDate: "",
  endDate: "",
  nextServiceDate: "",
  note: ""
};

export default function ContractForm() {
  const [formData, setFormData] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    // กันพังกรณีถูกเรียกโดยไม่มี event ที่ถูกต้อง
    if (!e || !e.target) return;
    const { name, value } = e.target;
    if (!name) return;

    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/submit-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ถ้าฝั่ง GAS ยังรองรับ key ชื่อ "package" อยู่ เรา map ให้ด้วย
        body: JSON.stringify({
          ...formData,
          package: formData.servicePackage
        }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch (_) {}

      if (!res.ok) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      // กรณี GAS ตอบ { result: "success" }
      if (data?.result === "success" || res.ok) {
        alert("ส่งข้อมูลสัญญาเรียบร้อยแล้ว!");
        setFormData(INITIAL); // รีเซ็ตฟอร์ม
      } else {
        alert("ส่งข้อมูลไม่สำเร็จ: " + JSON.stringify(data));
      }
    } catch (error) {
      console.error("เกิดข้อผิดพลาด:", error);
      alert("ส่งข้อมูลไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="contract-form-container">
      <h2>ฟอร์มกรอกข้อมูลสัญญา</h2>
      <form className="contract-form" onSubmit={handleSubmit}>
        <input
          type="text"
          name="name"
          placeholder="ชื่อ-นามสกุล"
          value={formData.name}
          onChange={handleChange}
          required
        />
        <input
          type="text"
          name="phone"
          placeholder="เบอร์โทร"
          value={formData.phone}
          onChange={handleChange}
          required
        />
        <input
          type="text"
          name="facebook"
          placeholder="Facebook ลูกค้า"
          value={formData.facebook}
          onChange={handleChange}
        />
        <textarea
          name="address"
          placeholder="ที่อยู่ลูกค้า"
          rows="3"
          value={formData.address}
          onChange={handleChange}
        />
        <input
          type="text"
          name="serviceType"
          placeholder="ประเภทบริการ"
          value={formData.serviceType}
          onChange={handleChange}
        />
        {/* เปลี่ยน name ให้ตรงกับ state */}
        <input
          type="text"
          name="servicePackage"
          placeholder="แพ็กเกจ"
          value={formData.servicePackage}
          onChange={handleChange}
        />

        <label htmlFor="startDate">วันที่เริ่มสัญญา</label>
        <input
          id="startDate"
          type="date"
          name="startDate"
          value={formData.startDate}
          onChange={handleChange}
        />

        <label htmlFor="endDate">วันที่สิ้นสุดสัญญา</label>
        <input
          id="endDate"
          type="date"
          name="endDate"
          value={formData.endDate}
          onChange={handleChange}
        />

        <label htmlFor="nextServiceDate">รอบบริการถัดไป</label>
        <input
          id="nextServiceDate"
          type="date"
          name="nextServiceDate"
          value={formData.nextServiceDate}
          onChange={handleChange}
        />

        <label htmlFor="note">หมายเหตุ</label>
        <textarea
          id="note"
          name="note"
          value={formData.note}
          onChange={handleChange}
          placeholder="ใส่หมายเหตุเพิ่มเติม เช่น ลูกค้าต้องการช่างคนเดิม"
          rows="3"
          style={{
            padding: "10px",
            borderRadius: "5px",
            border: "1px solid #ccc",
            width: "100%",
            marginBottom: "15px"
          }}
        />

        <button type="submit" disabled={submitting}>
          {submitting ? "กำลังส่ง..." : "ส่งข้อมูล"}
        </button>
      </form>
    </div>
  );
}
