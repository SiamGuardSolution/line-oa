import React, { useEffect, useState } from "react";
import "./ContractForm.css";
import { generateQuotationPDF } from "./lib/generateQuotationPDF";
import './fonts/THSarabun';

// ใส่ URL เว็บแอป/พร็อกซีของคุณ (ชี้ไป Apps Script หรือ API ของคุณ)
const API_URL = "/api/submit-contract";

const QUOTE_PRICE = {
  spray: 2882,    // ฉีดพ่นรายปี
  bait: 5500,     // วางเหยื่อ
  mix: 8500,      // ผสมผสาน
};
const getPriceByPackage = (pkg) => Number(QUOTE_PRICE[pkg] ?? 0);
const toISODate = (d = new Date()) => new Date(d).toISOString().slice(0,10);

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
  // service fields จะถูกเติมให้อัตโนมัติจาก useEffect
};

// ===== helpers สำหรับคำนวณวันที่ =====
const pad2 = (n) => String(n).padStart(2, "0");
const toISO = (d) => {
  // คืนค่า yyyy-mm-dd (แก้ timezone offset ให้ไม่เพี้ยน)
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return `${local.getUTCFullYear()}-${pad2(local.getUTCMonth() + 1)}-${pad2(local.getUTCDate())}`;
};
const daysInMonth = (y, m0) => new Date(y, m0 + 1, 0).getDate();
const addMonths = (d, m) => {
  const y = d.getFullYear();
  const m0 = d.getMonth() + m;
  const ty = Math.floor(y + m0 / 12);
  const tm = ((m0 % 12) + 12) % 12;
  const last = daysInMonth(ty, tm);
  const day = Math.min(d.getDate(), last);
  return new Date(ty, tm, day);
};
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addYears = (d, n) => addMonths(d, n * 12);

// คำนวณตารางบริการตามแพ็กเกจ
function computeSchedule(pkg, startStr) {
  if (!startStr) return {};
  const start = new Date(startStr);
  if (isNaN(start)) return {};

  const out = {};
  // วันสิ้นสุดสัญญา = +1 ปี
  out.endDate = toISO(addYears(start, 1));

  if (pkg === "spray") {
    const s1 = addMonths(start, 4);
    const s2 = addMonths(s1, 4);
    out.service1 = toISO(s1);
    out.service2 = toISO(s2);
  } else if (pkg === "bait") {
    const b1 = addDays(start, 20);
    const b2 = addDays(b1, 20);
    const b3 = addDays(b2, 20);
    const b4 = addDays(b3, 20);
    const b5 = addDays(b4, 20);
    out.service1 = toISO(b1);
    out.service2 = toISO(b2);
    out.service3 = toISO(b3);
    out.service4 = toISO(b4);
    out.service5 = toISO(b5);
  } else if (pkg === "mix") {
    // Spray part
    const s1 = addMonths(start, 4);
    const s2 = addMonths(s1, 4);
    out.serviceSpray1 = toISO(s1);
    out.serviceSpray2 = toISO(s2);
    // Bait part
    const b1 = addDays(start, 20);
    const b2 = addDays(b1, 20);
    const b3 = addDays(b2, 20);
    const b4 = addDays(b3, 20);
    const b5 = addDays(b4, 20);
    out.serviceBait1 = toISO(b1);
    out.serviceBait2 = toISO(b2);
    out.serviceBait3 = toISO(b3);
    out.serviceBait4 = toISO(b4);
    out.serviceBait5 = toISO(b5);
  }
  return out;
}

export default function ContractForm() {
  const [form, setForm] = useState({ ...emptyForm });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: "", ok: false });

  const pkgConf = PACKAGES[form.package] || PACKAGES["spray"];
  const setVal = (k, v) => setForm((s) => ({ ...s, [k]: v }));
  const phoneDigits = (s) => String(s || "").replace(/\D/g, "");

  // === คำนวณอัตโนมัติเมื่อ startDate หรือ package เปลี่ยน ===
  useEffect(() => {
    if (!form.startDate) return;
    const auto = computeSchedule(form.package, form.startDate);
    if (Object.keys(auto).length) setForm((s) => ({ ...s, ...auto }));
  }, [form.package, form.startDate]);

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
    // เติมช่อง service ให้ครบตามแพ็กเกจ
    (pkgConf.fields || []).forEach(({ key }) => (payload[key] = form[key] || ""));

    try {
      setLoading(true);
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // พยายามอ่าน JSON หากไม่ได้เป็น JSON จะเก็บข้อความดิบไว้ช่วยดีบัก
      const raw = await res.text();
      let json;
      try { json = JSON.parse(raw); } catch { json = { ok: res.ok, raw }; }

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "save-failed");
      }

      // ✅ บันทึกสำเร็จ
      setMsg({ text: "บันทึกสำเร็จ", ok: true });

      // ✅ เตรียมข้อมูลสำหรับ PDF แล้วสร้าง (ถ้าพังจะไม่กระทบผลบันทึก)
      try {
        const serviceLabel = PACKAGES[form.package]?.label || form.package;
        const price = getPriceByPackage(form.package);

        const pdfData = {
          // ส่วนหัวลูกค้า
          customerName: payload.name,
          phone: payload.phone,
          address: payload.address,
          facebook: payload.facebook,

          // รายละเอียดสัญญา
          serviceType: serviceLabel,     // เช่น "ฉีดพ่น (Spray)"
          package: payload.package,      // ใช้ key raw ไว้เผื่อ logic อื่น
          startDate: payload.startDate,
          endDate: payload.endDate,
          status: payload.status,
          note: payload.note,

          // วันที่ออกเอกสาร
          issueDate: toISODate(),

          // ตารางรายการ + ยอดรวม (รูปแบบที่ generateQuotationPDF ต้องการ)
          items: [
            { name: `${serviceLabel}`, qty: 1, price },
          ],
          total: price,
        };

        await generateQuotationPDF(pdfData); // ต้อง await เพื่อรอฝังฟอนต์ให้เสร็จ
      } catch (pdfErr) {
        console.warn("PDF generation failed:", pdfErr);
        setMsg({
          text: "บันทึกสำเร็จ แต่สร้าง PDF ไม่สำเร็จ (" + (pdfErr?.message || pdfErr) + ")",
          ok: true,
        });
      }

      // ล้างฟอร์ม แต่คงแพ็กเกจเดิมไว้ให้ผู้ใช้
      setForm({ ...emptyForm, package: form.package });
    } catch (err2) {
      setMsg({ text: `บันทึกไม่สำเร็จ ${err2?.message || err2}`, ok: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cf">
      <div className="cf__card">
        <div className="cf__chip">ฟอร์มสัญญา</div>
        <h2 className="cf__title">บันทึกสัญญาลูกค้า</h2>
        <p className="cf__subtitle">กรอกข้อมูลลูกค้าและกำหนดการบริการตามแพ็กเกจ ระบบจะคำนวณให้อัตโนมัติ</p>

        <form onSubmit={handleSubmit} className="cf__form">
          {/* แพ็กเกจ */}
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
              <label className="cf__label">Facebook/Line</label>
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
              <label className="cf__label">ผู้รับผิดชอบในการติดต่อลูกค้า</label>
              <input className="cf__input" value={form.tech} onChange={(e) => setVal("tech", e.target.value)} />
            </div>

            <div className="cf__field">
              <label className="cf__label">วันที่เริ่มสัญญา</label>
              <input type="date" className="cf__input" value={form.startDate} onChange={(e) => setVal("startDate", e.target.value)} />
            </div>
            <div className="cf__field">
              <label className="cf__label">วันสิ้นสุดสัญญา (อัตโนมัติ +1 ปี)</label>
              <input type="date" className="cf__input" value={form.endDate} onChange={(e) => setVal("endDate", e.target.value)} />
            </div>
          </div>

          {/* ตารางบริการ */}
          <fieldset className="cf__fieldset">
            <legend className="cf__legend">กำหนดการบริการ</legend>
            <div className="cf__services">
              {pkgConf.fields.map(({ key, label }) => (
                <div className="cf__field" key={key}>
                  <label className="cf__label">{label}</label>
                  <input
                    type="date"
                    className="cf__input"
                    value={form[key] || ""}
                    onChange={(e) => setVal(key, e.target.value)}
                  />
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
              {loading ? "กำลังบันทึก..." : "บันทึกและสร้างสัญญา"}
            </button>
            <button
              type="button"
              className="cf__btn cf__btn--ghost"
              onClick={() => setForm({ ...emptyForm, package: form.package })}
            >
              ล้างฟอร์ม
            </button>
          </div>

          {msg.text && (
            <p className={`cf__msg ${msg.ok ? "cf__msg--ok" : "cf__msg--err"}`}>
              {msg.text}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
