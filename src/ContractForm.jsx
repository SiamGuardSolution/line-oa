// src/ContractForm.jsx
import React, { useState, useEffect } from "react";
import "./ContractForm.css";

const INITIAL = {
  name: "",
  phone: "",
  facebook: "",
  address: "",
  serviceType: "",
  servicePackage: "spray", // 'spray' | 'bait'
  startDate: "",
  endDate: "",
  serviceDate1: "",
  serviceDate2: "",
  lastServiceDate: "",
  note: ""
};

export default function ContractForm() {
  const [formData, setFormData] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  // ---------- helpers ----------
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

  const addDays = (dateStr, days) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d)) return "";
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // ---------- core recompute ----------
  const recomputeDates = (pkg, startDate, lastServiceDate) => {
    if (pkg === "spray") {
      const s1 = addMonths(startDate, 4);
      const s2 = addMonths(s1, 4);
      const end = addMonths(startDate, 12);
      setFormData((prev) => ({
        ...prev,
        serviceDate1: s1,
        serviceDate2: s2,
        endDate: end
      }));
    } else {
      // bait
      const base = lastServiceDate || startDate;
      const next = addDays(base, 15);
      const end = startDate ? addMonths(startDate, 3) : "";
      setFormData((prev) => ({
        ...prev,
        serviceDate1: next || "",
        serviceDate2: "", // ไม่ใช้งานใน bait
        endDate: end
      }));
    }
  };

  useEffect(() => {
    recomputeDates(formData.servicePackage, formData.startDate, formData.lastServiceDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.servicePackage, formData.startDate, formData.lastServiceDate]);

  // ---------- handlers ----------
  const handleChange = (e) => {
    if (!e?.target) return;
    const { name, value } = e.target;

    if (name === "phone") {
      const digits = normalizePhone(value);
      setFormData((prev) => ({ ...prev, phone: digits }));
      return;
    }

    if (name === "servicePackage") {
      // เคลียร์ค่าที่ไม่เกี่ยวของอีกแพ็กเกจ เพื่อเลี่ยงส่งค่าหลงเหลือ
      if (value === "spray") {
        setFormData((prev) => ({
          ...prev,
          servicePackage: value,
          lastServiceDate: "" // spray ไม่ใช้
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          servicePackage: value,
          serviceDate2: "" // bait ไม่ใช้
        }));
      }
      return;
    }

    if (name === "startDate") {
      setFormData((prev) => ({ ...prev, startDate: value }));
      return;
    }

    if (name === "lastServiceDate") {
      setFormData((prev) => ({ ...prev, lastServiceDate: value }));
      return;
    }

    // endDate ถูกคำนวณอัตโนมัติทั้งสองแพ็กเกจ
    if (name === "endDate") return;

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const pkgLabel =
        formData.servicePackage === "spray"
          ? "อัดน้ำยา+ฉีดพ่น 3,993 บาท/ปี"
          : "วางเหยื่อ 5,500 บาท";

      const payload = {
        ...formData,
        package: pkgLabel
      };

      const res = await fetch("/api/submit-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const text = await res.text();

      let data;
      try { data = JSON.parse(text); } catch { /* not json */ }

      if (!res.ok || data?.result !== "success") {
        console.error("Server response:", text);
        alert("ส่งข้อมูลไม่สำเร็จ: " + (data?.message || text || `HTTP ${res.status}`));
        return;
      }

      console.log("DEBUG from GAS:", data);
      alert("ส่งข้อมูลสัญญาเรียบร้อยแล้ว!");
    } catch (err) {
      console.error("เกิดข้อผิดพลาด:", err);
      alert("ส่งข้อมูลไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- UI ----------
  const pkg = formData.servicePackage;

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

        {/* Package */}
        <label>แพ็กเกจ</label>
        <select
          name="servicePackage"
          value={formData.servicePackage}
          onChange={handleChange}
        >
          <option value="spray">อัดน้ำยา+ฉีดพ่น 3,993 บาท/ปี</option>
          <option value="bait">วางเหยื่อ 5,500 บาท</option>
        </select>

        {/* วันที่เริ่ม ใช้ร่วมกัน */}
        <label htmlFor="startDate">วันที่เริ่มสัญญา</label>
        <input
          id="startDate"
          type="date"
          name="startDate"
          value={formData.startDate}
          onChange={handleChange}
        />

        {/* เฉพาะแพ็กเกจ "วางเหยื่อ" */}
        {pkg === "bait" && (
          <>
            <label>วันล่าสุด (ใช้คำนวณสำหรับแพ็กเกจวางเหยื่อ)</label>
            <input
              type="date"
              name="lastServiceDate"
              value={formData.lastServiceDate}
              onChange={handleChange}
            />

            <label htmlFor="serviceDate1">
              รอบบริการครั้งถัดไป (+15 วันจากวันล่าสุด/วันที่เริ่ม)
            </label>
            <input
              id="serviceDate1"
              type="date"
              name="serviceDate1"
              value={formData.serviceDate1}
              readOnly
            />

            <label htmlFor="endDate">
              วันที่สิ้นสุดสัญญา (ครบ 6 รอบใน 3 เดือน — คำนวณอัตโนมัติ)
            </label>
            <input
              id="endDate"
              type="date"
              name="endDate"
              value={formData.endDate}
              readOnly
            />
          </>
        )}

        {/* เฉพาะแพ็กเกจ "อัดน้ำยา+ฉีดพ่น" */}
        {pkg === "spray" && (
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
