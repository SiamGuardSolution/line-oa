import React, { useState } from "react";
import "./ContractForm.css";

const ContractForm = () => {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    facebook: "",
    address: "",
    serviceType: "",
    package: "",
    startDate: "",
    endDate: "",
    nextServiceDate: ""
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
    await fetch("https://script.google.com/macros/s/AKfycbxXQVoFHRxLDpLq_2Rwc1i4QyG03_PKxFfLcbfo8T9avLEftOJZ9KQKQ-JULILKX2DYBg/exec", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    alert("ส่งข้อมูลสัญญาเรียบร้อยแล้ว!");
  } catch (error) {
    console.error("เกิดข้อผิดพลาด:", error);
    alert("ส่งข้อมูลไม่สำเร็จ");
  }
};

  return (
    <div className="contract-form-container">
      <h2>ฟอร์มกรอกข้อมูลสัญญา</h2>
      <form className="contract-form" onSubmit={handleSubmit}>
        <input type="text" name="name" placeholder="ชื่อ-นามสกุล" onChange={handleChange} required />
        <input type="tel" name="phone" placeholder="เบอร์โทร" onChange={handleChange} required />
        <input type="text" name="facebook" placeholder="Facebook ลูกค้า" onChange={handleChange} />
        <textarea name="address" placeholder="ที่อยู่ลูกค้า" rows="3" onChange={handleChange} />
        <input type="text" name="serviceType" placeholder="ประเภทบริการ" onChange={handleChange} />
        <input type="text" name="package" placeholder="แพ็กเกจ" onChange={handleChange} />
        <label>วันที่เริ่มสัญญา</label>
        <input type="date" name="startDate" onChange={handleChange} />
        <label>วันที่สิ้นสุดสัญญา</label>
        <input type="date" name="endDate" onChange={handleChange} />
        <label>รอบบริการถัดไป</label>
        <input type="date" name="nextServiceDate" onChange={handleChange} />
        <button type="submit">ส่งข้อมูล</button>
      </form>
    </div>
  );
};

export default ContractForm;
