// src/ContractForm.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./ContractForm.css";
import generateReceiptPDF from "./lib/generateReceiptPDF";
import generateContractPDF from "./lib/generateContractPDF";
import * as PKG from "./config/packages";

const API_URL = "/api/submit-contract";

// helper ปลอดภัย กรณี build แคช export เพี้ยน
const pkgLabel = (k) =>
  typeof PKG.getPackageLabel === "function"
    ? PKG.getPackageLabel(k)
    : (PKG.PACKAGE_LABEL?.[k] ?? String(k));

// ===== ข้อมูลบริษัท =====
const COMPANY = {
  name: "สยามการ์ด โซลูชั่น (ประเทศไทย) จำกัด",
  address: "99 หมู่ 17 ต.คลองหนึ่ง อ.คลองหลวง จ.ปทุมธานี 12120",
  phone: "063-364-5567, 088-792-4027",
  // taxId: "",
  // bank: { name: "", account: "", accountName: "" },
};

// ---------- โครง groups ----------
const SPRAY_FIELDS = [
  { key: "serviceSpray1", label: "Service Spray รอบที่ 1" },
  { key: "serviceSpray2", label: "Service Spray รอบที่ 2" },
];

const BAIT_FIELDS = [
  { key: "serviceBait1", label: "Service Bait รอบที่ 1" },
  { key: "serviceBait2", label: "Service Bait รอบที่ 2" },
  { key: "serviceBait3", label: "Service Bait รอบที่ 3" },
  { key: "serviceBait4", label: "Service Bait รอบที่ 4" },
  { key: "serviceBait5", label: "Service Bait รอบที่ 5" },
];

const PACKAGES = {
  spray: {
    groups: [{ type: "spray", title: "Service Spray", fields: SPRAY_FIELDS }],
  },
  bait: {
    groups: [
      { type: "spray", title: "Service Spray", fields: SPRAY_FIELDS },
      { type: "bait", title: "Service Bait", fields: BAIT_FIELDS },
    ],
  },
  mix: {
    groups: [
      { type: "spray", title: "Service Spray", fields: SPRAY_FIELDS },
      { type: "bait", title: "Service Bait", fields: BAIT_FIELDS },
    ],
  },
};

const emptyForm = {
  package: "spray",
  name: "",
  address: "",
  facebook: "",
  phone: "",
  taxId: "",
  startDate: "",
  endDate: "",
  tech: "",
  note: "",
  status: "ใช้งานอยู่",
};

// ===== helpers =====
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

/* ===== Even Spacing ===== */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDateOnly(d) {
  const dd = d instanceof Date ? d : new Date(d);
  return new Date(dd.getFullYear(), dd.getMonth(), dd.getDate());
}
function iso(d) {
  if (!d || isNaN(new Date(d))) return "";
  const z = toDateOnly(d);
  const mm = String(z.getMonth() + 1).padStart(2, "0");
  const dd = String(z.getDate()).padStart(2, "0");
  return `${z.getFullYear()}-${mm}-${dd}`;
}

/** กระจาย N จุดโดยเว้นช่วงเท่ากันแบบรวม "วันเริ่ม" และ "วันสิ้นสุด" */
function evenSpacedDatesInclusive(start, end, n) {
  const s = toDateOnly(start);
  const e = toDateOnly(end);
  if (!(s instanceof Date) || isNaN(s) || !(e instanceof Date) || isNaN(e) || n <= 0) return [];
  if (n === 1) return [iso(s)];
  const spanDays = Math.round((e - s) / MS_PER_DAY);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = Math.round((i * spanDays) / (n - 1));
    out.push(iso(new Date(s.getTime() + t * MS_PER_DAY)));
  }
  return out;
}

const digitsOnly = (s) => String(s || "").replace(/\D/g, "");
const taxIdDigits = (s) => digitsOnly(s).slice(0, 13);

// คำนวณตารางบริการตามแพ็กเกจ
function computeSchedule(pkg, startStr) {
  if (!startStr) return {};
  const start = new Date(startStr);
  if (isNaN(start)) return {};

  const out = {};
  out.endDate = toISO(addYears(start, 1)); // +1 ปี

  const s1 = addMonths(start, 4);
  const s2 = addMonths(s1, 4);

  if (pkg === "spray") {
    out.serviceSpray1 = toISO(s1);
    out.serviceSpray2 = toISO(s2);
    return out;
  }

  // bait & mix มีทั้ง Spray + Bait
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

  return out;
}

// ====== สร้างเลขเอกสาร ======
const makeReceiptNo = () => {
  const d = new Date();
  return `RC-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
};
const makeContractNo = () => {
  const d = new Date();
  return `CT-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
};

// ====== payload สำหรับ generateContractPDF ======
function buildContractPdfData(form, pkgConf, baseServicePrice, addons) {
  const groups = pkgConf.groups || [{ title: "", fields: pkgConf.fields || [] }];
  const schedule = groups.flatMap((g) =>
    (g.fields || []).map((f, idx) => {
      const dateStr = form[f.key];
      if (!dateStr) return null;
      return { round: idx + 1, date: dateStr, note: f.label || g.title || "" };
    }).filter(Boolean)
  );

  const pkgName = pkgLabel(form.package);

  const data = {
    contractNumber: makeContractNo(),
    contractDate: new Date(),
    startDate: form.startDate,
    endDate: form.endDate,

    company: {
      name: COMPANY.name,
      address: COMPANY.address,
      phone: COMPANY.phone,
      taxId: COMPANY.taxId,
    },

    client: {
      name: form.name,
      phone: digitsOnly(form.phone),
      address: form.address,
      facebook: form.facebook,
      taxId: taxIdDigits(form.taxId) || "",
    },

    service: {
      type: pkgName,
      packageName: pkgName,
      basePrice: baseServicePrice,
      addons: (addons || [])
        .filter((r) => r && (r.name || r.qty || r.price))
        .map((r) => ({ name: r.name || "รายการเพิ่มเติม", price: Number(r.price || 0) * Number(r.qty || 0) })),
    },

    schedule,

    terms: [
      "วันที่ครบกำหนด คือ วันที่ที่ครบกำหนดบริการตามเงื่อนไข เป็นเพียงกำหนดการนัดหมายส่งงานเท่านั้น",
      "วันที่เข้าบริการ คือ วันที่เข้ารับบริการจริง ซึ่งทางบริษัทฯ ได้ทำการนัดหมายลูกค้าอย่างชัดเจน",
      "ตารางครบกำหนดด้านบนลูกค้าสามารถขอเปลี่ยนวันได้ด้วยตัวเองทาง Line Official Account หรือโทรนัดกับเจ้าหน้าที่ โดยปกติแล้วทางเราจะโทรนัดล่วงหน้าก่อนประมาณ 2–7 วัน",
      "หากเกิดความเสียหายจากการให้บริการ เช่น เจาะโดนท่อน้ำดี บริษัทฯจะรับผิดชอบซ่อมแซมให้ลูกค้าสูงสุด 5,000 บาท โดยสามารถหักจากค่าบริการที่ลูกค้าต้องชำระได้เลยและบริษัทฯจะจ่ายในส่วนที่เหลือ",
    ],

    signatures: {
      companyRep: form.tech || "",
      clientRep: form.name || "",
    },
  };

  return { data, fileName: `Contract_${data.contractNumber}.pdf` };
}

export default function ContractForm() {
  const [form, setForm] = useState({ ...emptyForm });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: "", ok: false });

  const baseServicePrice = useMemo(() => {
    const fn = PKG.getPackagePrice;
    const map = PKG.PACKAGE_PRICE;
    const val = (typeof fn === "function") ? fn(form.package) : map?.[form.package];
    return Number(val ?? 0);
  }, [form.package]);

  // ===== items สำหรับคิดยอด / ใบเสร็จ =====
  const items = useMemo(
    () => [
      { name: `ค่าบริการแพ็กเกจ ${pkgLabel(form.package)}`, quantity: 1, price: baseServicePrice },
    ],
    [form.package, baseServicePrice]
  );
  const itemsSubtotal = baseServicePrice;

  // ===== Add-ons =====
  const [addons, setAddons] = useState([{ name: "", qty: 1, price: 0 }]);
  const addAddonRow = () => setAddons((rows) => [...rows, { name: "", qty: 1, price: 0 }]);
  const removeAddonRow = (i) => setAddons((rows) => rows.filter((_, idx) => idx !== i));
  const onAddonChange = (i, field, value) => {
    setAddons((rows) => {
      const next = [...rows];
      next[i] = { ...next[i], [field]: field === "qty" || field === "price" ? Number(value || 0) : value };
      return next;
    });
  };

  const pkgConf = PACKAGES[form.package] || PACKAGES["spray"];
  const setVal = (k, v) => setForm((s) => ({ ...s, [k]: v }));
  const phoneDigits = (s) => digitsOnly(s);

  const [discountValue, setDiscountValue] = useState("");

  // แท็บสำหรับสลับมุมมอง Service
  const [activeTab, setActiveTab] = useState(form.package === "bait" ? "bait" : "spray");
  useEffect(() => {
    setActiveTab(form.package === "bait" ? "bait" : "spray");
  }, [form.package]);

  // === ใบเสร็จ (Receipt) VAT ===
  const [receiptVatEnabled, setReceiptVatEnabled] = useState(false);
  const RECEIPT_VAT_RATE = 0.07;

  // ===== รอบบริการแบบยืดหยุ่น =====
  const [sprayExtras, setSprayExtras] = useState([]); // ['YYYY-MM-DD', ...]
  const [baitExtras, setBaitExtras]   = useState([]); // ['YYYY-MM-DD', ...]

  const sprayFixedCount = 2;
  const baitFixedCount  = 5;
  const sprayCount = sprayFixedCount + sprayExtras.length;
  const baitCount  = baitFixedCount  + baitExtras.length;

  // Auto-generate ตารางบริการ / endDate
  useEffect(() => {
    if (!form.startDate) return;
    const auto = computeSchedule(form.package, form.startDate);
    if (Object.keys(auto).length) setForm((s) => ({ ...s, ...auto }));
  }, [form.package, form.startDate]);

  // ---- ปุ่ม: กระจาย (เฉพาะสเปรย์) ----
  const distributeSprayEqualFromStartEnd = () => {
    const start = form.startDate;
    const end   = form.endDate || (form.startDate ? toISO(addYears(new Date(form.startDate), 1)) : "");
    if (!start || !end) {
      alert("กรุณากำหนดวันเริ่ม/สิ้นสุดสัญญาให้ครบก่อน");
      return;
    }
    const totalPoints = sprayCount + 2;
    if (totalPoints < 3) { alert("จำนวนรอบฉีดพ่นต้องไม่น้อยกว่า 1"); return; }
    const dates = evenSpacedDatesInclusive(start, end, totalPoints);
    const midDates = dates.slice(1, dates.length - 1);

    const patch = {};
    patch.serviceSpray1 = midDates[0] || "";
    patch.serviceSpray2 = midDates[1] || "";
    const extra = midDates.slice(2);
    setSprayExtras(extra);

    setForm((s) => ({ ...s, ...patch, endDate: dates[dates.length - 1] || end }));
  };

  // ---- ปุ่ม: รีเซ็ตตามสูตรแพ็กเกจ ----
  const resetByPackageFormula = () => {
    if (!form.startDate) { alert("กรุณาเลือกวันที่เริ่มสัญญาก่อน"); return; }
    const auto = computeSchedule(form.package, form.startDate);
    if (Object.keys(auto).length) setForm((s) => ({ ...s, ...auto }));
  };

  // ตรวจความถูกต้อง
  const validate = () => {
    if (!form.name.trim()) return "กรุณากรอกชื่อลูกค้า";
    if (phoneDigits(form.phone).length < 9) return "กรุณากรอกเบอร์โทรให้ถูกต้อง";
    if (form.taxId && taxIdDigits(form.taxId).length !== 13) return "กรุณากรอกเลขประจำตัวผู้เสียภาษีให้ครบ 13 หลัก";
    if (!form.startDate) return "กรุณาเลือกวันที่เริ่มสัญญา";
    if (!form.endDate) return "กรุณาเลือกวันสิ้นสุดสัญญา";
    return "";
  };

  const addonsSubtotal = useMemo(
    () => (addons || []).reduce((sum, ad) => sum + Number(ad.qty || 0) * Number(ad.price || 0), 0),
    [addons]
  );

  const discountNum = discountValue === "" ? 0 : Number(discountValue);
  const netBeforeVat = itemsSubtotal - discountNum + addonsSubtotal;

  // ====== พรีวิว VAT/Grand total สำหรับ "ใบเสร็จ"
  const receiptVatAmount = useMemo(() => {
    if (!receiptVatEnabled) return 0;
    const amt = Number(netBeforeVat || 0) * RECEIPT_VAT_RATE;
    return Math.round((amt + Number.EPSILON) * 100) / 100;
  }, [receiptVatEnabled, netBeforeVat, RECEIPT_VAT_RATE]);

  const receiptGrandTotal = useMemo(() => {
    return Math.round(((Number(netBeforeVat || 0) + Number(receiptVatAmount || 0)) + Number.EPSILON) * 100) / 100;
  }, [netBeforeVat, receiptVatAmount]);

  // ===== ใบเสร็จ (PDF) =====
  async function handleCreateReceiptPDF() {
    const pdfItems = [
      { description: `ค่าบริการแพ็กเกจ ${pkgLabel(form.package)}`, qty: 1, unitPrice: baseServicePrice },
      ...addons
        .filter((r) => r && (r.name || r.qty || r.price))
        .map((r) => ({
          description: r.name || "รายการเพิ่มเติม",
          qty: Number(r.qty || 0),
          unitPrice: Number(r.price || 0),
        })),
    ];

    const payload = {
      companyName: COMPANY.name,
      companyAddress: COMPANY.address,
      companyPhone: COMPANY.phone,
      companyTaxId: COMPANY.taxId,

      customerCode: "",
      clientName: form.name || "",
      clientPhone: digitsOnly(form.phone) || "",
      clientAddress: form.address || "",
      clientTaxId: taxIdDigits(form.taxId) || "",

      receiptNo: makeReceiptNo(),
      issueDate: new Date(),
      poNumber: "",
      termDays: 0,

      items: pdfItems,
      discount: Number(discountNum || 0),

      vatEnabled: receiptVatEnabled,
      vatRate: receiptVatEnabled ? 0.07 : 0,

      alreadyPaid: 0,

      notes: form.note || "",
      bankRemark: COMPANY.bank
        ? `ธนาคาร${COMPANY.bank.name} ${COMPANY.bank.account}\n${COMPANY.bank.accountName}`
        : "",
    };

    try {
      await generateReceiptPDF(payload);
    } catch (e) {
      console.error(e);
      alert("สร้างใบเสร็จไม่สำเร็จ: " + (e?.message || e));
    }
  }

  // ===== สร้างสัญญา (PDF) =====
  async function handleCreateContractPDFOnly() {
    const err = validate();
    if (err) { alert(err); return; }
    const { data, fileName } = buildContractPdfData(form, pkgConf, baseServicePrice, addons);
    try {
      await generateContractPDF(data, { fileName });
    } catch (e) {
      console.error(e);
      alert("สร้างสัญญาไม่สำเร็จ: " + (e?.message || e));
    }
  }

  // ===== บันทึกลง GAS ผ่าน /api/submit-contract =====
  const isBaitLike = form.package === "bait" || form.package === "mix";

  const handleSubmitAndSave = async (e) => {
    e.preventDefault();
    setMsg({ text: "", ok: false });

    const err = validate();
    if (err) return setMsg({ text: err, ok: false });

    // เขียน payload สำหรับบันทึกชีต (ไม่พึ่งชีต Contract)
    const payload = {
      servicePackage: form.package,
      package: form.package,
      name: form.name,
      address: form.address,
      facebook: form.facebook,
      phone: phoneDigits(form.phone),
      taxId: taxIdDigits(form.taxId),
      startDate: form.startDate,
      endDate: form.endDate,
      tech: form.tech,
      note: form.note,
      status: form.status || "ใช้งานอยู่",

      // สรุปยอด
      items,
      discount: discountValue === "" ? "" : Number(discountValue),
      addons,
      itemsSubtotal,
      addonsSubtotal,
      netBeforeVat,

      // เขียนคีย์ตารางบริการตรง ๆ (ให้ GAS map ไปชีต Spray/Bait/Mix ตามที่คุณทำไว้)
      serviceSpray1: form.serviceSpray1 || "",
      serviceSpray2: form.serviceSpray2 || "",
      serviceBait1:  form.serviceBait1  || "",
      serviceBait2:  form.serviceBait2  || "",
      serviceBait3:  form.serviceBait3  || "",
      serviceBait4:  form.serviceBait4  || "",
      serviceBait5:  form.serviceBait5  || "",

      // แนบ JSON รอบบริการทั้งหมด (รวม extras)
      serviceScheduleJson: JSON.stringify({
        startDate: form.startDate,
        endDate:   form.endDate,
        spray: [
          form.serviceSpray1 || "",
          form.serviceSpray2 || "",
          ...sprayExtras
        ].filter(Boolean),
        bait: isBaitLike
          ? [
              form.serviceBait1 || "", form.serviceBait2 || "", form.serviceBait3 || "",
              form.serviceBait4 || "", form.serviceBait5 || "",
              ...baitExtras
            ].filter(Boolean)
          : [],
      }),
    };

    try {
      setLoading(true);
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const raw = await res.text();
      let json;
      try { json = JSON.parse(raw); } catch { json = { ok: res.ok, raw }; }

      if (!res.ok || json?.ok === false) throw new Error(json?.error || "save-failed");

      setMsg({ text: "บันทึกสำเร็จ", ok: true });

      // reset ฟอร์มหลังบันทึก
      setForm({ ...emptyForm, package: form.package });
      setAddons([{ name: "", qty: 1, price: 0 }]);
      setDiscountValue("");
      setSprayExtras([]);
      setBaitExtras([]);

    } catch (err2) {
      setMsg({ text: `บันทึกไม่สำเร็จ ${err2?.message || err2}`, ok: false });
    } finally {
      setLoading(false);
    }
  };

  const pkgOptions = Object.keys(PACKAGES);

  return (
    <div className="cf">
      <div className="cf__card">
        <div className="cf__chip">ฟอร์มสัญญา</div>
        <h2 className="cf__title">บันทึกสัญญาลูกค้า + สร้าง PDF</h2>
        <p className="cf__subtitle">บันทึกข้อมูลสัญญา</p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-secondary" onClick={handleCreateReceiptPDF}>
            สร้างใบเสร็จ (PDF)
          </button>
          <button type="button" className="btn" onClick={handleCreateContractPDFOnly}>
            สร้างสัญญา (PDF)
          </button>
        </div>

        <form onSubmit={handleSubmitAndSave} className="cf__form">
          {/* แพ็กเกจ */}
          <div className="cf__field">
            <label className="cf__label">แพ็กเกจ</label>
            <select
              className="cf__select"
              value={form.package}
              onChange={(e) => setVal("package", e.target.value)}
            >
              {pkgOptions.map((k) => (
                <option key={k} value={k}>
                  {pkgLabel(k)}
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
                <button type="button" className="btn-outline" onClick={() => removeAddonRow(i)}>
                  ลบ
                </button>
              </div>
            ))}
            <button type="button" className="btn-add" onClick={addAddonRow}>
              ➕ เพิ่ม Add-on
            </button>

            <div className="totals">
              <div>ยอดบริการหลัก: <b>{itemsSubtotal.toLocaleString()}</b></div>
              <div>ส่วนลด: <b>-{discountNum.toLocaleString()}</b></div>
              <div>ค่าบริการเพิ่มเติม (Add-on): <b>+{addonsSubtotal.toLocaleString()}</b></div>
              <hr />
              <div className="total-line">ราคาก่อนภาษี: <b>{(Math.round((netBeforeVat + Number.EPSILON) * 100) / 100).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</b></div>

              {/* ✅ สวิตช์ VAT สำหรับ "ใบเสร็จ" */}
              <label className="cf__checkbox" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={receiptVatEnabled}
                  onChange={(e) => setReceiptVatEnabled(e.target.checked)}
                />
                คิดภาษีมูลค่าเพิ่ม (VAT) 7% สำหรับ “ใบเสร็จ” ใบนี้
              </label>

              {receiptVatEnabled && (
                <div style={{ marginTop: 6 }}>
                  <div>ภาษีมูลค่าเพิ่ม 7%: <b>{receiptVatAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</b></div>
                </div>
              )}

              <div className="total-line" style={{ marginTop: 6 }}>
                ยอดรวมสุทธิ (ใบเสร็จ): <b>{receiptGrandTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</b>
              </div>
            </div>
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

            {/* เลขผู้เสียภาษี */}
            <div className="cf__field">
              <label className="cf__label">เลขประจำตัวผู้เสียภาษี</label>
              <input
                className="cf__input"
                placeholder="13 หลัก (ถ้ามี)"
                inputMode="numeric"
                value={form.taxId}
                onChange={(e) => setVal("taxId", taxIdDigits(e.target.value))}
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

            {/* Toolbar */}
            <div className="cf-toolbar">
              <div className="cf-toolbar__left">
                <button type="button" className="btn" onClick={distributeSprayEqualFromStartEnd}>
                  กระจาย (เฉพาะสเปรย์) เท่าๆ กัน • นับวันเริ่ม/สิ้นสุดด้วย
                </button>
                <button type="button" className="btn btn-secondary" onClick={resetByPackageFormula}>
                  รีเซ็ตตามสูตรแพ็กเกจ
                </button>
              </div>
              <div className="cf-toolbar__right">
                <span className="cf-chip">เริ่ม {form.startDate || "-"}</span>
                <span className="cf-chip cf-chip--muted">สิ้นสุด {form.endDate || "-"}</span>
                <span className="cf-chip cf-chip--spray">Spray {sprayCount} ครั้ง</span>
                {(form.package === "bait" || form.package === "mix") && (
                  <span className="cf-chip cf-chip--bait">Bait {baitCount} ครั้ง</span>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="cf-tabs">
              <button
                type="button"
                className={`cf-tab ${activeTab === "spray" ? "cf-tab--active" : ""}`}
                onClick={() => setActiveTab("spray")}
              >
                Spray ({sprayCount})
              </button>
              {(form.package === "bait" || form.package === "mix") && (
                <button
                  type="button"
                  className={`cf-tab ${activeTab === "bait" ? "cf-tab--active" : ""}`}
                  onClick={() => setActiveTab("bait")}
                >
                  Bait ({baitCount})
                </button>
              )}
            </div>

            {/* === SPRAY PANEL === */}
            {activeTab === "spray" && (
              <div className="cf-panel">
                <h4 className="cf-group-title">รอบมาตรฐาน</h4>
                <div className="service-grid">
                  <div className="round">
                    <div className="round__badge">#1</div>
                    <label className="cf__label">Service Spray รอบที่ 1</label>
                    <input
                      type="date"
                      className="cf__input"
                      value={form.serviceSpray1 || ""}
                      onChange={(e) => setVal("serviceSpray1", e.target.value)}
                    />
                  </div>

                  <div className="round">
                    <div className="round__badge">#2</div>
                    <label className="cf__label">Service Spray รอบที่ 2</label>
                    <input
                      type="date"
                      className="cf__input"
                      value={form.serviceSpray2 || ""}
                      onChange={(e) => setVal("serviceSpray2", e.target.value)}
                    />
                  </div>
                </div>

                <div className="cf-panel__header">
                  <h4 className="cf-group-title">รอบเพิ่มเติม</h4>
                  <div className="cf-actions-inline">
                    <button
                      type="button"
                      className="btn-outline"
                      disabled={sprayExtras.length === 0}
                      onClick={() => setSprayExtras(ex => ex.slice(0, Math.max(0, ex.length - 1)))}
                    >– ลด</button>
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => setSprayExtras(ex => [...ex, ""])}
                    >+ เพิ่ม</button>
                  </div>
                </div>

                {sprayExtras.length === 0 ? (
                  <div className="cf-empty">ยังไม่มีรอบเพิ่มเติม</div>
                ) : (
                  <div className="service-grid">
                    {sprayExtras.map((d, i) => (
                      <div className="round" key={`sprExtra-${i}`}>
                        <div className="round__badge">#{i + 3}</div>
                        <label className="cf__label">Spray เพิ่มเติม #{i + 3}</label>
                        <input
                          type="date"
                          className="cf__input"
                          value={d || ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setSprayExtras(arr => {
                              const next = [...arr];
                              next[i] = v;
                              return next;
                            });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* === BAIT PANEL === */}
            {(form.package === "bait" || form.package === "mix") && activeTab === "bait" && (
              <div className="cf-panel">
                <h4 className="cf-group-title">รอบมาตรฐาน</h4>
                <div className="service-grid">
                  {BAIT_FIELDS.map(({ key, label }, idx) => (
                    <div className="round" key={key}>
                      <div className="round__badge">#{idx + 1}</div>
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

                <div className="cf-panel__header">
                  <h4 className="cf-group-title">รอบเพิ่มเติม</h4>
                  <div className="cf-actions-inline">
                    <button
                      type="button"
                      className="btn-outline"
                      disabled={baitExtras.length === 0}
                      onClick={() => setBaitExtras(ex => ex.slice(0, Math.max(0, ex.length - 1)))}
                    >
                      – ลด
                    </button>
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => setBaitExtras(ex => [...ex, ""])}
                    >
                      + เพิ่ม
                    </button>
                  </div>
                </div>

                {baitExtras.length === 0 ? (
                  <div className="cf-empty">ยังไม่มีรอบเพิ่มเติม</div>
                ) : (
                  <div className="service-grid">
                    {baitExtras.map((d, i) => (
                      <div className="round" key={`baitExtra-${i}`}>
                        <div className="round__badge">#{i + 6}</div>
                        <label className="cf__label">Bait เพิ่มเติม #{i + 6}</label>
                        <input
                          type="date"
                          className="cf__input"
                          value={d || ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setBaitExtras(arr => {
                              const next = [...arr];
                              next[i] = v;
                              return next;
                            });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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
            <button type="button" className="cf__btn" onClick={handleCreateContractPDFOnly}>
              ดาวน์โหลดสัญญา (PDF)
            </button>
            <button
              type="button"
              className="cf__btn cf__btn--ghost"
              onClick={() => {
                setForm({ ...emptyForm, package: form.package });
                setAddons([{ name: "", qty: 1, price: 0 }]);
                setDiscountValue("");
                setSprayExtras([]);
                setBaitExtras([]);
              }}
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
