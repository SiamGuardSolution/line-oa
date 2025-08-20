// ContractForm.jsx
import React, { useState, useMemo } from "react";
import "./ContractForm.css";

const INITIAL = {
  name: "",
  phone: "",
  facebook: "",
  address: "",
  serviceType: "",
  servicePackage: "",      // เก็บ label/ข้อความเดิมจากผู้ใช้ (ถ้าต้องการ)
  startDate: "",
  endDate: "",
  serviceDate1: "",
  serviceDate2: "",
  note: "",
  lastServiceDate: ""      // สำหรับ bait/mix
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
const addDays = (dateStr, n) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  d.setDate(d.getDate() + n);
  return toYMD(d);
};

// แปะ label ตาม code
const pkgLabel = (code) =>
  code === "mix" ? "ผสมผสาน 8,500 บาท/ปี"
  : code === "bait" ? "วางเหยื่อ 5,500 บาท"
  : "อัดน้ำยา+ฉีดพ่น 3,993 บาท/ปี";

export default function ContractForm() {
  const [formData, setFormData] = useState(INITIAL);
  const [pkg, setPkg] = useState("spray");           // 'spray' | 'bait' | 'mix'
  const [submitting, setSubmitting] = useState(false);

  // auto-calc เมื่อเปลี่ยน startDate
  const handleChange = (e) => {
    if (!e?.target) return;
    const { name, value } = e.target;

    if (name === "phone") {
      const digits = normalizePhone(value);
      setFormData((prev) => ({ ...prev, phone: digits }));
      return;
    }

    if (name === "startDate") {
      // คำนวณสำหรับ spray/mix
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

  // สรุป preview ของ bait (ทุก 20 วัน × 6) สำหรับ mix/bait
  const baitPreview = useMemo(() => {
    const base = formData.lastServiceDate || formData.startDate;
    if (!base) return [];
    return Array.from({ length: 6 }).map((_, i) => addDays(base, 20 * (i + 1)));
  }, [formData.lastServiceDate, formData.startDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        // เก็บ code/label ให้ชัดเจน
        servicePackageCode: pkg,                 // 'spray' | 'bait' | 'mix'
        servicePackageLabel: pkgLabel(pkg),
        package: pkg,                            // เผื่อฝั่ง GAS เดิมใช้ "package"
        lastServiceDate: formData.lastServiceDate || "",

        // เคส mix/spray: เรามี serviceDate1/2 + endDate (12 เดือน)
        // เคส bait: ช่องพวกนี้อาจไม่ถูกใช้ที่ฝั่งอ่าน แต่เก็บไม่เสียหาย (เราจะ render ตาม pkg)
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
        <select value={pkg} onChange={(e) => setPkg(e.target.value)}>
          <option value="spray">อัดน้ำยา+ฉีดพ่น 3,993 บาท/ปี</option>
          <option value="bait">วางเหยื่อ 5,500 บาท</option>
          <option value="mix">ผสมผสาน 8,500 บาท/ปี</option>
        </select>

        {/* วันที่เริ่มสัญญา */}
        <label htmlFor="startDate">วันที่เริ่มสัญญา</label>
        <input
          id="startDate"
          type="date"
          name="startDate"
          value={formData.startDate}
          onChange={handleChange}
        />

        {/* ฟิลด์สำหรับ SPRAY และ MIX: แสดงรอบ 1/2 และสิ้นสุด +1 ปี */}
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

        {/* ฟิลด์สำหรับ BAIT และ MIX: วันล่าสุด + preview ทุก 20 วัน × 6 */}
        {(pkg === "bait" || pkg === "mix") && (
          <>
            <label>วันล่าสุด (ใช้คำนวณรอบบริการสำหรับวางเหยื่อ)</label>
            <input
              type="date"
              name="lastServiceDate"
              value={formData.lastServiceDate}
              onChange={handleChange}
            />
            <div className="hint">
              รอบบริการวางเหยื่อ: ทุก 20 วัน จำนวน 6 ครั้ง
              {baitPreview.length ? (
                <ul style={{ marginTop: 6 }}>
                  {baitPreview.map((d, i) => (
                    <li key={i}>ครั้งที่ {i + 1}: {d}</li>
                  ))}
                </ul>
              ) : null}
            </div>
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
