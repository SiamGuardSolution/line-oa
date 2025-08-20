// src/ContractForm.jsx
import React, { useState } from "react";
import "./ContractForm.css";

/* ================= helpers ================= */
const INITIAL = {
  name: "",
  phone: "",                 // เก็บเป็นตัวเลขล้วน 0–9
  facebook: "",
  address: "",
  serviceType: "",
  servicePackage: "",        // 'spray' | 'bait' | 'mix'
  startDate: "",
  endDate: "",
  serviceDate1: "",
  serviceDate2: "",
  lastServiceDate: "",       // สำหรับวางเหยื่อ/ผสมผสาน (ไว้อ้างอิงกำหนดการ)
  note: ""
};

const normalizePhone = (val) => String(val || "").replace(/\D/g, "").slice(0, 10);
const formatThaiPhone = (digits) => {
  if (!digits) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0,3)}-${digits.slice(3)}`;
  return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
};
const toYMD = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};
const addMonths = (dateStr, n) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  const day = d.getDate();
  d.setMonth(d.getMonth() + n);
  if (d.getDate() < day) d.setDate(0);
  return toYMD(d);
};
/* =========================================== */

export default function ContractForm() {
  const [formData, setFormData] = useState(INITIAL);
  const [pkg, setPkg] = useState("");         // 'spray' | 'bait' | 'mix' | ""
  const [submitting, setSubmitting] = useState(false);

  /* ---------- sync & compute ---------- */
  function handlePackageChange(e) {
    const v = e.target.value; // 'spray' | 'bait' | 'mix'
    setPkg(v);
    setFormData((prev) => {
      const next = { ...prev, servicePackage: v };

      // คำนวณวันที่ตามแพ็กเกจ ถ้ามี startDate แล้ว
      if (prev.startDate) {
        if (v === "spray" || v === "mix") {
          const s1 = addMonths(prev.startDate, 4);
          const s2 = addMonths(s1, 4);
          const end = addMonths(prev.startDate, 12);
          next.serviceDate1 = s1;
          next.serviceDate2 = s2;
          next.endDate = end;
        } else if (v === "bait") {
          // bait: ไม่ใช้ serviceDate1/2 ในฟอร์ม, end = start + 3 เดือน (เป็นข้อมูลอ้างอิง)
          next.serviceDate1 = "";
          next.serviceDate2 = "";
          next.endDate = addMonths(prev.startDate, 3);
        }
      } else {
        // ล้างช่องวันที่ให้สะอาดเมื่อยังไม่เลือก startDate
        if (v === "spray" || v === "mix") {
          next.serviceDate1 = "";
          next.serviceDate2 = "";
          next.endDate = "";
        } else if (v === "bait") {
          next.serviceDate1 = "";
          next.serviceDate2 = "";
          next.endDate = "";
        }
      }
      return next;
    });
  }

  function handleStartDateChange(e) {
    const value = e.target.value;
    setFormData((prev) => {
      const next = { ...prev, startDate: value };
      if (pkg === "spray" || pkg === "mix") {
        const s1 = addMonths(value, 4);
        const s2 = addMonths(s1, 4);
        const end = addMonths(value, 12);
        next.serviceDate1 = s1;
        next.serviceDate2 = s2;
        next.endDate = end;
      } else if (pkg === "bait") {
        next.serviceDate1 = "";
        next.serviceDate2 = "";
        next.endDate = addMonths(value, 3); // อ้างอิงสิ้นสุด 3 เดือน
      }
      return next;
    });
  }

  function handleChange(e) {
    if (!e?.target) return;
    const { name, value } = e.target;

    if (name === "phone") {
      const digits = normalizePhone(value);
      setFormData((prev) => ({ ...prev, phone: digits }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  /* ---------- submit ---------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pkg) {
      alert("กรุณาเลือกแพ็กเกจ");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        // เผื่อฝั่ง GAS เดิมใช้คีย์ "package"
        package: formData.servicePackage
      };

      const res = await fetch("/api/submit-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const text = await res.text();

      let data;
      try { data = JSON.parse(text); } catch { /* not JSON */ }

      if (!res.ok || data?.result !== "success") {
        console.error("Server response:", text);
        alert("ส่งข้อมูลไม่สำเร็จ: " + (data?.message || text || `HTTP ${res.status}`));
        return;
      }

      alert("ส่งข้อมูลสัญญาเรียบร้อยแล้ว!");
      // รีเซ็ตฟอร์ม
      setPkg("");
      setFormData(INITIAL);
    } catch (err) {
      console.error("เกิดข้อผิดพลาด:", err);
      alert("ส่งข้อมูลไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------- render ---------- */
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
          type="tel"
          name="phone"
          placeholder="เบอร์โทร (0xx-xxx-xxxx)"
          value={formatThaiPhone(formData.phone)}
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

        {/* แพ็กเกจ */}
        <label>แพ็กเกจ</label>
        <select value={pkg} onChange={handlePackageChange} required>
          <option value="" disabled>— เลือกแพ็กเกจ —</option>
          <option value="spray">อัดน้ำยา+ฉีดพ่น 3,993 บาท/ปี</option>
          <option value="bait">วางเหยื่อ 5,500 บาท</option>
          <option value="mix">ผสมผสาน 8,500 บาท/ปี</option>
        </select>

        {/* วันเริ่มสัญญา */}
        <label htmlFor="startDate">วันที่เริ่มสัญญา</label>
        <input
          id="startDate"
          type="date"
          name="startDate"
          value={formData.startDate}
          onChange={handleStartDateChange}
          required
        />

        {/* เฉพาะ spray & mix: แสดงรอบบริการ 1/2 + สิ้นสุด */}
        {(pkg === "spray" || pkg === "mix") && (
          <>
            <label htmlFor="serviceDate1">รอบบริการครั้งที่ 1 (+4 เดือน)</label>
            <input
              id="serviceDate1"
              type="date"
              name="serviceDate1"
              value={formData.serviceDate1}
              readOnly
            />

            <label htmlFor="serviceDate2">รอบบริการครั้งที่ 2 (+4 เดือนจากครั้งที่ 1)</label>
            <input
              id="serviceDate2"
              type="date"
              name="serviceDate2"
              value={formData.serviceDate2}
              readOnly
            />

            <label htmlFor="endDate">วันที่สิ้นสุดสัญญา (+1 ปี)</label>
            <input
              id="endDate"
              type="date"
              name="endDate"
              value={formData.endDate}
              readOnly
            />
          </>
        )}

        {/* เฉพาะ bait & mix: ให้ระบุ “วันล่าสุด” เผื่อคำนวณรอบวางเหยื่อในระบบ */}
        {(pkg === "bait" || pkg === "mix") && (
          <>
            <label htmlFor="lastServiceDate">
              วันล่าสุด (ใช้คำนวณรอบวางเหยื่อ)
            </label>
            <input
              id="lastServiceDate"
              type="date"
              name="lastServiceDate"
              value={formData.lastServiceDate}
              onChange={handleChange}
            />

            {/* สิ้นสุดสัญญาอ้างอิงสำหรับ bait: +3 เดือนจากวันเริ่ม */}
            {pkg === "bait" && (
              <>
                <label htmlFor="endDateBait">วันที่สิ้นสุดสัญญา (ประมาณ +3 เดือน)</label>
                <input
                  id="endDateBait"
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  readOnly
                />
              </>
            )}
          </>
        )}

        <label htmlFor="note">หมายเหตุ</label>
        <textarea
          id="note"
          name="note"
          value={formData.note}
          onChange={handleChange}
          rows="3"
          placeholder="เช่น ลูกค้าต้องการช่างคนเดิม"
        />

        <button type="submit" disabled={submitting}>
          {submitting ? "กำลังส่ง..." : "ส่งข้อมูล"}
        </button>
      </form>
    </div>
  );
}
