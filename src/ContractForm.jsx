// src/ContractForm.jsx
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
    nextServiceDate: "",
    note: ""
  });

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));

    console.log("formData.note:", formData.note);

  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch("https://script.google.com/macros/s/AKfycbzjWbm1loGYp5EWtSbXxRouSzgHmQhxNrD_gdrOo8H7k1FBQOZIg_qIbTknfdbVSivm4A/exec?path=contract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formData)
      })


      alert("ส่งข้อมูลสัญญาเรียบร้อยแล้ว!");
    } catch (error) {
      console.error("เกิดข้อผิดพลาด:", error);
      alert("ส่งข้อมูลไม่สำเร็จ");
    }
  };;

  return (
    <div className="contract-form-container">
      <h2>ฟอร์มกรอกข้อมูลสัญญา</h2>
      <form className="contract-form" onSubmit={handleSubmit}>
        <input type="text" name="name" placeholder="ชื่อ-นามสกุล" onChange={handleChange} required />
        <input type="text" name="phone" placeholder="เบอร์โทร" onChange={handleChange} required />
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

        {/* ✅ ต้องมาก่อนปุ่ม */}
        <label>หมายเหตุ</label>
        <textarea
          name="note"
          value={formData.note}
          onChange={handleChange}
          placeholder="ใส่หมายเหตุเพิ่มเติม เช่น ลูกค้าต้องการช่างคนเดิม"
          rows="3"
          style={{
            padding: '10px',
            borderRadius: '5px',
            border: '1px solid #ccc',
            width: '100%',
            marginBottom: '15px'
          }}
        >
        </textarea>
        <button type="submit">ส่งข้อมูล</button>
      </form>

    </div>
  );
};

export default ContractForm;
