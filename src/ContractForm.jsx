import React, { useState } from "react";
import "./ContractForm.css";

const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxvD66P9k2NxFOquKyYMvTXYf5xm-fhu36yZtEWARfyAZ4J7c1-SYMD6U4imW1f5hVC4A/exec"; // ใส่ของคุณ

const PACKAGES = {
  spray: {
    label: "ฉีดพ่น (Spray)",
    fields: [
      { key: "service1", label: "Service รอบที่ 1" },
      { key: "service2", label: "Service รอบที่ 2" },
    ],
  },
  bait: {
    label: "วางเหยื่อ (Bait)",
    fields: [
      { key: "service1", label: "Service รอบที่ 1" },
      { key: "service2", label: "Service รอบที่ 2" },
      { key: "service3", label: "Service รอบที่ 3" },
      { key: "service4", label: "Service รอบที่ 4" },
      { key: "service5", label: "Service รอบที่ 5" },
    ],
  },
  mix: {
    label: "ผสมผสาน (Mix)",
    fields: [
      { key: "serviceSpray1", label: "Service Spray รอบที่ 1" },
      { key: "serviceSpray2", label: "Service Spray รอบที่ 2" },
      { key: "serviceBait1", label: "Service Bait รอบที่ 1" },
      { key: "serviceBait2", label: "Service Bait รอบที่ 2" },
      { key: "serviceBait3", label: "Service Bait รอบที่ 3" },
      { key: "serviceBait4", label: "Service Bait รอบที่ 4" },
      { key: "serviceBait5", label: "Service Bait รอบที่ 5" },
    ],
  },
};

const emptyForm = {
  package: "spray",
  name: "",
  address: "",
  facebook: "",
  phone: "",
  startDate: "",
  endDate: "",
  tech: "",
  note: "",
  status: "ใช้งานอยู่",
};

export default function ContractForm() {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: "", ok: false });

  const pkgConf = PACKAGES[form.package];
  const setVal = (k, v) => setForm((s) => ({ ...s, [k]: v }));
  const phoneDigits = (s) => String(s || "").replace(/\D/g, "");

  const validate = () => {
    if (!form.name.trim()) return "กรุณากรอกชื่อลูกค้า";
    if (phoneDigits(form.phone).length < 9) return "กรุณากรอกเบอร์โทรให้ถูกต้อง";
    if (!form.startDate) return "กรุณาเลือกวันที่เริ่มสัญญา";
    if (!form.endDate) return "กรุณาเลือกวันสิ้นสุดสัญญา";
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg({ text: "", ok: false });

    const err = validate();
    if (err) return setMsg({ text: err, ok: false });

    const payload = {
      package: form.package,
      name: form.name,
      address: form.address,
      facebook: form.facebook,
      phone: phoneDigits(form.phone),
      startDate: form.startDate,
      endDate: form.endDate,
      tech: form.tech,
      note: form.note,
      status: form.status || "ใช้งานอยู่",
    };
    pkgConf.fields.forEach(({ key }) => (payload[key] = form[key] || ""));

    try {
      setLoading(true);
      const res = await fetch(`${GAS_WEBAPP_URL}?path=submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (json?.ok) {
        setMsg({ text: "บันทึกสำเร็จ ✅", ok: true });
        setForm({ ...emptyForm, package: form.package });
      } else {
        setMsg({ text: `บันทึกไม่สำเร็จ ❌ ${json?.error || ""}`, ok: false });
      }
    } catch (err2) {
      setMsg({ text: `บันทึกไม่สำเร็จ ❌ ${err2?.message || err2}`, ok: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cf">
      <div className="cf__card">
        <div className="cf__chip">บันทึกสัญญาลูกค้า</div>
        <h2 className="cf__title">ฟอร์มสัญญา</h2>
        <p className="cf__subtitle">กรอกข้อมูลลูกค้าและกำหนดการบริการตามแพ็กเกจ</p>

        <form onSubmit={handleSubmit} className="cf__form">
          {/* เลือกแพ็กเกจ */}
          <div className="cf__field">
            <label className="cf__label">แพ็กเกจ</label>
            <select
              className="cf__select"
              value={form.package}
              onChange={(e) => setVal("package", e.target.value)}
            >
              {Object.entries(PACKAGES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          {/* ข้อมูลลูกค้า */}
          <div className="cf__grid">
            <div className="cf__field">
              <label className="cf__label">ชื่อลูกค้า</label>
              <input className="cf__input" value={form.name} onChange={(e) => setVal("name", e.target.value)} />
            </div>
            <div className="cf__field">
              <label className="cf__label">Facebook</label>
              <input className="cf__input" value={form.facebook} onChange={(e) => setVal("facebook", e.target.value)} />
            </div>
            <div className="cf__field" style={{ gridColumn: "1 / -1" }}>
              <label className="cf__label">ที่อยู่</label>
              <input className="cf__input" value={form.address} onChange={(e) => setVal("address", e.target.value)} />
            </div>
            <div className="cf__field">
              <label className="cf__label">เบอร์โทร</label>
              <input className="cf__input" value={form.phone} onChange={(e) => setVal("phone", e.target.value)} placeholder="0xx-xxx-xxxx" />
            </div>
            <div className="cf__field">
              <label className="cf__label">ทีมที่รับผิดชอบ (เบอร์/รหัสทีม)</label>
              <input className="cf__input" value={form.tech} onChange={(e) => setVal("tech", e.target.value)} />
            </div>
            <div className="cf__field">
              <label className="cf__label">วันที่เริ่มสัญญา</label>
              <input type="date" className="cf__input" value={form.startDate} onChange={(e) => setVal("startDate", e.target.value)} />
            </div>
            <div className="cf__field">
              <label className="cf__label">วันสิ้นสุดสัญญา</label>
              <input type="date" className="cf__input" value={form.endDate} onChange={(e) => setVal("endDate", e.target.value)} />
            </div>
          </div>

          {/* วันที่บริการ ตามแพ็กเกจ */}
          <fieldset className="cf__fieldset">
            <legend className="cf__legend">กำหนดการบริการ</legend>
            <div className="cf__services">
              {pkgConf.fields.map(({ key, label }) => (
                <div className="cf__field" key={key}>
                  <label className="cf__label">{label}</label>
                  <input type="date" className="cf__input" value={form[key] || ""} onChange={(e) => setVal(key, e.target.value)} />
                </div>
              ))}
            </div>
          </fieldset>

          {/* หมายเหตุ + สถานะ */}
          <div className="cf__field" style={{ marginTop: 12 }}>
            <label className="cf__label">หมายเหตุ</label>
            <textarea className="cf__textarea" value={form.note} onChange={(e) => setVal("note", e.target.value)} />
          </div>
          <div className="cf__field" style={{ marginTop: 8 }}>
            <label className="cf__label">สถานะ</label>
            <select className="cf__select" value={form.status} onChange={(e) => setVal("status", e.target.value)}>
              <option>ใช้งานอยู่</option>
              <option>หมดอายุ</option>
            </select>
          </div>

          <div className="cf__actions">
            <button type="submit" className="cf__btn cf__btn--primary" disabled={loading}>
              {loading ? "กำลังบันทึก..." : "บันทึกข้อมูลสัญญา"}
            </button>
            <button type="button" className="cf__btn cf__btn--ghost" onClick={() => setForm({ ...emptyForm, package: form.package })}>
              ล้างฟอร์ม
            </button>
          </div>

          {msg.text && (
            <p className={`cf__msg ${msg.ok ? "cf__msg--ok" : "cf__msg--err"}`}>{msg.text}</p>
          )}
        </form>
      </div>
    </div>
  );
}
