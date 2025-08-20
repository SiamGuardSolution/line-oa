// src/ContractForm.jsx
import React, { useState, useEffect } from "react";
import "./ContractForm.css";

const INITIAL = {
  name: "",
  phone: "",
  facebook: "",
  address: "",
  serviceType: "",
  servicePackage: "3993", // 'spray' | 'bait'
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
    if (pkg === "3993") {
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
      const next = addDays(base, 20);
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
      if (value === "3993") {
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
        formData.servicePackage === "3993"
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
      {/* การ์ด: ข้อมูลลูกค้า */}
      <div className="card">
        <h3>ข้อมูลลูกค้า</h3>
        <div className="form-group">
          <label>ชื่อ–นามสกุล</label>
          <input
            type="text"
            name="name"
            placeholder="เช่น สมชาย ใจดี"
            autoComplete="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="row cols-2">
          <div className="form-group">
            <label>เบอร์โทร</label>
            <input
              type="tel"
              name="phone"
              inputMode="numeric"
              placeholder="0xx-xxx-xxxx"
              autoComplete="tel"
              value={formatThaiPhone(formData.phone)}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Facebook ลูกค้า</label>
            <input
              type="text"
              name="facebook"
              placeholder="URL / ชื่อบัญชี"
              value={formData.facebook}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-group">
          <label>ที่อยู่ลูกค้า</label>
          <textarea
            name="address"
            placeholder="บ้านเลขที่, ซอย, ถนน, เขต/อำเภอ, จังหวัด"
            rows="3"
            autoComplete="street-address"
            value={formData.address}
            onChange={handleChange}
          />
        </div>
      </div>

      {/* การ์ด: รายละเอียดบริการ */}
      <div className="card grid-2">
        <h3 className="grid-span-2">รายละเอียดบริการ</h3>

        <div className="form-group">
          <label>ประเภทบริการ</label>
          <input
            type="text"
            name="serviceType"
            placeholder="เช่น กำจัดปลวก"
            value={formData.serviceType}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label>แพ็กเกจ</label>
          <select
            name="servicePackage"
            value={formData.servicePackage}
            onChange={handleChange}
          >
            <option value="3993">อัดน้ำยา+ฉีดพ่น 3,993 บาท/ปี</option>
            <option value="5500">วางเหยื่อ 5,500 บาท</option>
          </select>
        </div>

        <div className="form-group">
          <label>วันที่เริ่มสัญญา</label>
          <input
            id="startDate"
            type="date"
            name="startDate"
            value={formData.startDate}
            onChange={handleChange}
          />
        </div>

        {/* เฉพาะแพ็กเกจวางเหยื่อ */}
        {pkg === "5500" && (
          <div className="form-group">
            <label>วันล่าสุด (คำนวณรอบถัดไป)</label>
            <input
              type="date"
              name="lastServiceDate"
              value={formData.lastServiceDate}
              onChange={handleChange}
            />
            <div className="helper">ถ้าเว้นว่าง ระบบจะอ้างอิงวันที่เริ่มสัญญา</div>
          </div>
        )}
      </div>

      {/* การ์ด: กำหนดการ (แสดงเฉพาะของแพ็กเกจที่เลือก) */}
      <div className="card grid-2">
        <h3 className="grid-span-2">กำหนดการ</h3>

        {/* spray */}
        {pkg === "3993" && (
          <>
            <div className="form-group">
              <label>รอบบริการครั้งที่ 1 (+4 เดือน)</label>
              <input
                id="serviceDate1"
                type="date"
                name="serviceDate1"
                value={formData.serviceDate1}
                readOnly
              />
            </div>

            <div className="form-group">
              <label>รอบบริการครั้งที่ 2 (+4 เดือนจากครั้งที่ 1)</label>
              <input
                id="serviceDate2"
                type="date"
                name="serviceDate2"
                value={formData.serviceDate2}
                readOnly
              />
            </div>

            <div className="form-group grid-span-2">
              <label>วันที่สิ้นสุดสัญญา (+1 ปี)</label>
              <input
                id="endDate"
                type="date"
                name="endDate"
                value={formData.endDate}
                readOnly
              />
            </div>
          </>
        )}

        {/* bait */}
        {pkg === "5500" && (
          <>
            <div className="form-group">
              <label>รอบบริการครั้งถัดไป (+20 วัน)</label>
              <input
                id="serviceDate1"
                type="date"
                name="serviceDate1"
                value={formData.serviceDate1}
                readOnly
              />
            </div>

            <div className="form-group grid-span-2">
              <label>วันที่สิ้นสุดสัญญา (ครบ 6 รอบใน 3 เดือน)</label>
              <input
                id="endDate"
                type="date"
                name="endDate"
                value={formData.endDate}
                readOnly
              />
            </div>
          </>
        )}
      </div>

      {/* การ์ด: หมายเหตุ */}
      <div className="card">
        <div className="form-group">
          <label>หมายเหตุ</label>
          <textarea
            id="note"
            name="note"
            value={formData.note}
            onChange={handleChange}
            rows="3"
            placeholder="เช่น ลูกค้าต้องการช่างคนเดิม"
          />
        </div>
      </div>

      {/* Sticky submit */}
      <div className="form-actions">
        <div className="bar">
          <button type="submit" disabled={submitting}>
            {submitting ? "กำลังส่ง..." : "ส่งข้อมูล"}
          </button>
        </div>
      </div>
    </form>
  </div>
);
}
