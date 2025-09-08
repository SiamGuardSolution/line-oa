// src/ContractForm.jsx
import React, { useEffect, useState } from "react";
import "./ContractForm.css";
import generateReceiptPDF from "./lib/generateReceiptPDF";

// ===== API endpoint (proxy ไป Apps Script หรือ API ของคุณ) =====
const API_URL = "/api/submit-contract";

// ราคาพื้นฐานแต่ละแพ็กเกจ
const BASE_PRICES = { spray: 3993, bait: 5500, mix: 8500 };

// ข้อมูลบริษัทสำหรับใบเสร็จ (แก้ให้เป็นของจริงได้)
const COMPANY = {
  name: "Siam Guard",
  address: "",
  phone: "",
  taxId: "",
};

// อัตราภาษี (ใบเสร็จทั่วไปอาจไม่คิด VAT) — ถ้าต้องการ 7% เปลี่ยนเป็น 0.07
const VAT_RATE = 0;

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

// ===== helpers วันที่ =====
const pad2 = (n) => String(n).padStart(2, "0");
const toISO = (d) => {
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
  out.endDate = toISO(addYears(start, 1)); // +1 ปี

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
    const s1 = addMonths(start, 4);
    const s2 = addMonths(s1, 4);
    out.serviceSpray1 = toISO(s1);
    out.serviceSpray2 = toISO(s2);

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

  // ราคาแพ็กเกจตามที่เลือก
  const baseServicePrice = React.useMemo(
    () => BASE_PRICES[form.package] ?? 0,
    [form.package]
  );

  // รายการฐานเพื่อส่งให้ backend (คงโครง items ไว้)
  const items = React.useMemo(
    () => [
      {
        name: `ค่าบริการแพ็กเกจ ${PACKAGES[form.package]?.label || ""}`,
        quantity: 1,
        price: baseServicePrice,
      },
    ],
    [form.package, baseServicePrice]
  );

  // ยอดบริการหลัก = ราคาแพ็กเกจ
  const itemsSubtotal = baseServicePrice;

  const [addons, setAddons] = useState([{ name: "", qty: 1, price: 0 }]);
  const addAddonRow = () => setAddons((rows) => [...rows, { name: "", qty: 1, price: 0 }]);
  const removeAddonRow = (i) => setAddons((rows) => rows.filter((_, idx) => idx !== i));
  const onAddonChange = (i, field, value) => {
    setAddons((rows) => {
      const next = [...rows];
      next[i] = {
        ...next[i],
        [field]: field === "qty" || field === "price" ? Number(value || 0) : value,
      };
      return next;
    });
  };

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: "", ok: false });

  const pkgConf = PACKAGES[form.package] || PACKAGES["spray"];
  const setVal = (k, v) => setForm((s) => ({ ...s, [k]: v }));
  const phoneDigits = (s) => String(s || "").replace(/\D/g, "");

  // ส่วนลดให้เริ่มว่าง (ไม่ส่ง 0 เพื่อกัน Google Sheet แปลงเป็นวันที่)
  const [discountValue, setDiscountValue] = React.useState("");

  // auto-compute schedule เมื่อเปลี่ยน startDate/package
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

  const addonsSubtotal = (addons || []).reduce(
    (sum, ad) => sum + Number(ad.qty || 0) * Number(ad.price || 0),
    0
  );

  const discountNum = discountValue === "" ? 0 : Number(discountValue);
  // ราคาสุทธิ = ยอดบริการหลัก - ส่วนลด + Add-on
  const netBeforeVat = itemsSubtotal - discountNum + addonsSubtotal;

  // ===== เลขใบเสร็จอัตโนมัติ (ถ้าไม่มีระบบเลขเอกสาร) =====
  const makeReceiptNo = () => {
    const d = new Date();
    return `RC-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
  };

  // ===== สร้างใบเสร็จ (PDF) =====
  function handleCreateReceiptPDF() {
    // รวมรายการ: แพ็กเกจหลัก + Add-on
    const pdfItems = [
      {
        description: `ค่าบริการแพ็กเกจ ${PACKAGES[form.package]?.label || ""}`,
        qty: 1,
        unitPrice: baseServicePrice,
      },
      ...addons
        .filter((r) => r && (r.name || r.qty || r.price))
        .map((r) => ({
          description: r.name || "รายการเพิ่มเติม",
          qty: Number(r.qty || 0),
          unitPrice: Number(r.price || 0),
        })),
    ];

    const payload = {
      // บริษัท
      companyName: COMPANY.name,
      companyAddress: COMPANY.address,
      companyPhone: COMPANY.phone,
      companyTaxId: COMPANY.taxId,

      // ลูกค้า
      clientName: form.name || "",
      clientPhone: phoneDigits(form.phone) || "",
      clientAddress: form.address || "",

      // เอกสาร
      receiptNo: makeReceiptNo(),
      issueDate: new Date(),

      // รายการ + สรุปยอด
      items: pdfItems,
      discount: discountNum,
      vatRate: VAT_RATE,
      alreadyPaid: 0,

      // หมายเหตุ
      notes: form.note || "",
    };

    generateReceiptPDF(payload);
  }

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

      items,
      discount: discountValue === "" ? "" : Number(discountValue),
      addons,
      itemsSubtotal,
      addonsSubtotal,
      netBeforeVat,
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

      const raw = await res.text();
      let json;
      try {
        json = JSON.parse(raw);
      } catch {
        json = { ok: res.ok, raw };
      }

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "save-failed");
      }

      setMsg({ text: "บันทึกสำเร็จ", ok: true });
      setForm({ ...emptyForm, package: form.package });
      setAddons([{ name: "", qty: 1, price: 0 }]);
      setDiscountValue("");
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
        <p className="cf__subtitle">
          กรอกข้อมูลลูกค้าและกำหนดการบริการตามแพ็กเกจ ระบบจะคำนวณให้อัตโนมัติ
        </p>

        <button type="button" className="btn btn-secondary" onClick={handleCreateReceiptPDF}>
          สร้างใบเสร็จ (PDF)
        </button>

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
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          <section className="cf-section">
            <div className="cf-field" style={{ maxWidth: 360 }}>
              <label>ส่วนลด</label>
              <div className="cf-input-inline">
                <input
                  type="number"
                  className="cf-input"
                  placeholder="0"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={discountValue}
                  onChange={(e) => {
                    const s = e.target.value;
                    if (s === "") return setDiscountValue("");
                    const v = Math.max(0, Number(s) || 0);
                    setDiscountValue(String(v));
                  }}
                  onWheel={(e) => e.currentTarget.blur()}
                />
                <span className="cf-unit">บาท</span>
              </div>
              <div className="cf-hint">กรอกจำนวนเงินส่วนลด (บาท)</div>
            </div>
          </section>

          <div className="section">
            <h3>ค่าบริการเพิ่มเติม (Add-on)</h3>

            {addons.map((row, i) => (
              <div key={i} className="addon-row">
                <input
                  type="text"
                  placeholder="ชื่อรายการ (เช่น ค่าน้ำยาเพิ่ม, พื้นที่เกิน)"
                  value={row.name}
                  onChange={(e) => onAddonChange(i, "name", e.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="จำนวน"
                  value={row.qty}
                  onChange={(e) => onAddonChange(i, "qty", e.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="ราคา/หน่วย"
                  value={row.price}
                  onChange={(e) => onAddonChange(i, "price", e.target.value)}
                />
                <div className="addon-amount">
                  {(row.qty * row.price).toLocaleString()}
                </div>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => removeAddonRow(i)}
                >
                  ลบ
                </button>
              </div>
            ))}

            <button type="button" className="btn-add" onClick={addAddonRow}>
              ➕ เพิ่ม Add-on
            </button>

            <div className="totals">
              <div>
                ยอดบริการหลัก: <b>{itemsSubtotal.toLocaleString()}</b>
              </div>
              <div>
                ส่วนลด: <b>-{discountNum.toLocaleString()}</b>
              </div>
              <div>
                ค่าบริการเพิ่มเติม (Add-on):{" "}
                <b>+{addonsSubtotal.toLocaleString()}</b>
              </div>
              <hr />
              <div className="total-line">
                ราคาสุทธิ: <b>{netBeforeVat.toLocaleString()}</b>
              </div>
            </div>
          </div>

          {/* ข้อมูลลูกค้า */}
          <div className="cf__grid">
            <div className="cf__field">
              <label className="cf__label">ชื่อลูกค้า</label>
              <input
                className="cf__input"
                value={form.name}
                onChange={(e) => setVal("name", e.target.value)}
              />
            </div>
            <div className="cf__field">
              <label className="cf__label">Facebook/Line</label>
              <input
                className="cf__input"
                value={form.facebook}
                onChange={(e) => setVal("facebook", e.target.value)}
              />
            </div>
            <div className="cf__field" style={{ gridColumn: "1 / -1" }}>
              <label className="cf__label">ที่อยู่</label>
              <input
                className="cf__input"
                value={form.address}
                onChange={(e) => setVal("address", e.target.value)}
              />
            </div>
            <div className="cf__field">
              <label className="cf__label">เบอร์โทร</label>
              <input
                className="cf__input"
                value={form.phone}
                onChange={(e) => setVal("phone", e.target.value)}
                placeholder="0xx-xxx-xxxx"
              />
            </div>
            <div className="cf__field">
              <label className="cf__label">ผู้รับผิดชอบในการติดต่อลูกค้า</label>
              <input
                className="cf__input"
                value={form.tech}
                onChange={(e) => setVal("tech", e.target.value)}
              />
            </div>

            <div className="cf__field">
              <label className="cf__label">วันที่เริ่มสัญญา</label>
              <input
                type="date"
                className="cf__input"
                value={form.startDate}
                onChange={(e) => setVal("startDate", e.target.value)}
              />
            </div>
            <div className="cf__field">
              <label className="cf__label">วันสิ้นสุดสัญญา (อัตโนมัติ +1 ปี)</label>
              <input
                type="date"
                className="cf__input"
                value={form.endDate}
                onChange={(e) => setVal("endDate", e.target.value)}
              />
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
            <textarea
              className="cf__textarea"
              value={form.note}
              onChange={(e) => setVal("note", e.target.value)}
            />
          </div>
          <div className="cf__field" style={{ marginTop: 8 }}>
            <label className="cf__label">สถานะ</label>
            <select
              className="cf__select"
              value={form.status}
              onChange={(e) => setVal("status", e.target.value)}
            >
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
