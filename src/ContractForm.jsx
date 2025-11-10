// src/ContractForm.jsx (Lite + Dynamic schedule with add/remove)
import React, { useEffect, useMemo, useState } from "react";
import "./ContractForm.css";
import generateReceiptPDF from "./lib/generateReceiptPDF";
import generateContractPDF from "./lib/generateContractPDF";
import * as PKG from "./config/packages";

const API_URL = "/api/submit-contract";

/* ------------------------- Helpers ------------------------- */
const pkgLabel = (k) =>
  typeof PKG.getPackageLabel === "function"
    ? PKG.getPackageLabel(k)
    : (PKG.PACKAGE_LABEL?.[k] ?? String(k));

const pad2 = (n) => String(n).padStart(2, "0");
const toISO = (d) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return `${local.getUTCFullYear()}-${pad2(local.getUTCMonth() + 1)}-${pad2(local.getUTCDate())}`;
};
const digitsOnly = (s) => String(s || "").replace(/\D/g, "");
const taxIdDigits = (s) => digitsOnly(s).slice(0, 13);

const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
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
const addYears = (d, n) => addMonths(d, n * 12);

// YYYY-MM-DD → dd/MM/yyyy (ค.ศ.) | ถ้า dd/MM/yyyy และเป็น พ.ศ. (>2400) จะลด 543
function toCE_ddmmyyyy(raw) {
  if (!raw) return "";
  const s = String(raw).trim();
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    let y = parseInt(dmy[3], 10);
    if (y > 2400) y -= 543;
    const dd = String(dmy[1]).padStart(2, "0");
    const mm = String(dmy[2]).padStart(2, "0");
    return `${dd}/${mm}/${y}`;
  }
  return s;
}

/* -------------------- บริษัท & เอกสาร -------------------- */
const COMPANY = {
  name: "สยามการ์ด โซลูชั่น (ประเทศไทย) จำกัด",
  address: "99 หมู่ 17 ต.คลองหนึ่ง อ.คลองหลวง จ.ปทุมธานี 12120",
  phone: "063-364-5567, 088-792-4027"
  // taxId: "",
};
const makeReceiptNo = () => {
  const d = new Date();
  return `RC-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
};
const makeContractNo = () => {
  const d = new Date();
  return `CT-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
};

/* -------------------- เพดาน (สำหรับ map ลงคีย์ตอนบันทึก) -------------------- */
const SPRAY_MAX = 6;
const BAIT_MAX = 12;

/* -------------------- สูตรแพ็กเกจแบบง่าย -------------------- */
const PKG_FORMULA = {
  pipe3993:      { sprayCount: 3, sprayGapM: 3, baitIn: 0, baitInGapD: 15, baitOut: 0, baitOutGapM: 2 },
  bait5500_in:   { sprayCount: 0, sprayGapM: 3, baitIn: 5, baitInGapD: 15, baitOut: 0, baitOutGapM: 2 },
  bait5500_out:  { sprayCount: 0, sprayGapM: 3, baitIn: 0, baitInGapD: 15, baitOut: 6, baitOutGapM: 2 },
  bait5500_both: { sprayCount: 0, sprayGapM: 3, baitIn: 4, baitInGapD: 15, baitOut: 4, baitOutGapM: 2 },
  combo8500:     { sprayCount: 3, sprayGapM: 3, baitIn: 4, baitInGapD: 15, baitOut: 4, baitOutGapM: 2 }
};

/* -------------------- ฟอร์มเริ่มต้น -------------------- */
const emptyForm = {
  package: "pipe3993",
  name: "", address: "", facebook: "", phone: "", taxId: "",
  startDate: "", endDate: "", tech: "", note: "", status: "ใช้งานอยู่"
};

export default function ContractForm() {
  const [form, setForm] = useState({ ...emptyForm });

  // ตารางบริการแบบไดนามิก
  const [sprayDates, setSprayDates] = useState(["", "", ""]); // ['YYYY-MM-DD', ...]
  const [baitDates, setBaitDates] = useState(Array(6).fill("")); // ['YYYY-MM-DD', ...]

  // ส่วนลด/แอดออน
  const [discountValue, setDiscountValue] = useState("");
  const [addons, setAddons] = useState([{ name: "", qty: 1, price: 0 }]);

  // VAT (เฉพาะใบเสร็จ)
  const [receiptVatEnabled, setReceiptVatEnabled] = useState(false);
  const RECEIPT_VAT_RATE = 0.07;

  // UI
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: "", ok: false });

  // ราคาแพ็กเกจ
  const baseServicePrice = useMemo(() => {
    const fn = PKG.getPackagePrice;
    const map = PKG.PACKAGE_PRICE;
    const val = typeof fn === "function" ? fn(form.package) : map?.[form.package];
    return Number(val ?? 0);
  }, [form.package]);

  const setVal = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  // ยอดเงิน
  const itemsSubtotal = baseServicePrice;
  const addonsSubtotal = useMemo(
    () => (addons || []).reduce((sum, ad) => sum + Number(ad.qty || 0) * Number(ad.price || 0), 0),
    [addons]
  );
  const discountNum = discountValue === "" ? 0 : Number(discountValue);
  const netBeforeVat = Math.max(0, itemsSubtotal - discountNum + addonsSubtotal);

  const receiptVatAmount = receiptVatEnabled
    ? Math.round((netBeforeVat * RECEIPT_VAT_RATE + Number.EPSILON) * 100) / 100
    : 0;
  const receiptGrandTotal = Math.round((netBeforeVat + receiptVatAmount + Number.EPSILON) * 100) / 100;

  // เปลี่ยนแพ็กเกจแล้วเคลียร์ตารางบริการ (ให้สะอาด)
  useEffect(() => {
    setSprayDates(["", "", ""]);
    setBaitDates(Array(6).fill(""));
  }, [form.package]);

  // เลือกวันที่เริ่ม → สิ้นสุด +1 ปี อัตโนมัติ
  useEffect(() => {
    if (!form.startDate) return;
    const end = toISO(addYears(new Date(form.startDate), 1));
    if (form.endDate !== end) setVal("endDate", end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.startDate]);

  /* -------------------- เติมตารางอัตโนมัติจากแพ็กเกจ -------------------- */
  const fillScheduleByPackage = () => {
    if (!form.startDate) return alert("กรุณาเลือกวันที่เริ่มสัญญาก่อน");

    const f = PKG_FORMULA[form.package] || PKG_FORMULA.pipe3993;
    const start = new Date(form.startDate);

    // spray
    const sDates = [];
    for (let i = 0; i < Math.min(f.sprayCount, SPRAY_MAX); i++) {
      sDates.push(toISO(addMonths(start, i * f.sprayGapM)));
    }

    // bait: ภายในใช้วัน (gapD), ภายนอกใช้เดือน (gapM)
    const bDates = [];
    for (let i = 0; i < f.baitIn && bDates.length < BAIT_MAX; i++) {
      bDates.push(toISO(addDays(start, i * f.baitInGapD)));
    }
    for (let i = 0; i < f.baitOut && bDates.length < BAIT_MAX; i++) {
      bDates.push(toISO(addMonths(start, i * f.baitOutGapM)));
    }

    setSprayDates(sDates);
    setBaitDates(bDates);
  };

  /* -------------------- ตรวจความถูกต้อง -------------------- */
  const validate = () => {
    if (!form.name.trim()) return "กรุณากรอกชื่อลูกค้า";
    if (digitsOnly(form.phone).length < 9) return "กรุณากรอกเบอร์โทรให้ถูกต้อง";
    if (form.taxId && taxIdDigits(form.taxId).length !== 13)
      return "กรุณากรอกเลขประจำตัวผู้เสียภาษีให้ครบ 13 หลัก";
    if (!form.startDate) return "กรุณาเลือกวันที่เริ่มสัญญา";
    if (!form.endDate) return "กรุณาเลือกวันสิ้นสุดสัญญา";
    return "";
  };

  /* -------------------- PDF: ใบเสร็จ -------------------- */
  async function handleCreateReceiptPDF() {
    const startForPdf = toCE_ddmmyyyy(form.startDate);
    const pdfItems = [
      { description: `ค่าบริการแพ็กเกจ ${pkgLabel(form.package)}`, qty: 1, unitPrice: baseServicePrice },
      ...(addons || [])
        .filter((r) => r && (r.name || r.qty || r.price))
        .map((r) => ({
          description: r.name || "รายการเพิ่มเติม",
          qty: Number(r.qty || 0),
          unitPrice: Number(r.price || 0)
        }))
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
      discount: Number((discountValue === "" ? 0 : discountValue) || 0),
      vatEnabled: !!receiptVatEnabled,
      vatRate: receiptVatEnabled ? 0.07 : 0,
      alreadyPaid: 0,
      notes: form.note || "",
      contractStartDate: startForPdf
    };

    try {
      await generateReceiptPDF(payload, {
        filename: `Receipt-${payload.receiptNo}.pdf`,
        returnType: "save",
        forceReceiptDate: startForPdf
      });
    } catch (e) {
      console.error(e);
      alert("สร้างใบเสร็จไม่สำเร็จ: " + (e?.message || e));
    }
  }

  /* -------------------- PDF: สัญญา -------------------- */
  function buildContractPdfData() {
    const pkgName = pkgLabel(form.package);

    // สร้างตาราง schedule จาก state แบบไดนามิก
    const spraySchedule = sprayDates.map((d, i) =>
      d ? { round: i + 1, date: d, note: "Service Spray" } : null
    ).filter(Boolean);
    const baitSchedule = baitDates.map((d, i) =>
      d ? { round: i + 1, date: d, note: "Service Bait" } : null
    ).filter(Boolean);

    const data = {
      contractNumber: makeContractNo(),
      contractDate: new Date(),
      startDate: form.startDate,
      endDate: form.endDate,
      company: { name: COMPANY.name, address: COMPANY.address, phone: COMPANY.phone, taxId: COMPANY.taxId },
      client: {
        name: form.name,
        phone: digitsOnly(form.phone),
        address: form.address,
        facebook: form.facebook,
        taxId: taxIdDigits(form.taxId) || ""
      },
      service: {
        type: pkgName,
        packageName: pkgName,
        basePrice: baseServicePrice,
        addons: (addons || [])
          .filter((a) => a && (a.name || a.qty || a.price))
          .map((a) => ({
            name: a.name || "รายการเพิ่มเติม",
            price: Number(a.qty || 0) * Number(a.price || 0)
          }))
      },
      schedule: [...spraySchedule, ...baitSchedule],
      terms: [
        "วันที่ครบกำหนด คือ วันที่ที่ครบกำหนดบริการตามเงื่อนไข เป็นเพียงกำหนดการนัดหมายส่งงานเท่านั้น",
        "วันที่เข้าบริการ คือ วันที่เข้ารับบริการจริง ซึ่งทางบริษัทฯ ได้ทำการนัดหมายลูกค้าอย่างชัดเจน",
        "ตารางครบกำหนดด้านบนลูกค้าสามารถขอเปลี่ยนวันได้ด้วยตัวเองทาง Line Official Account หรือโทรนัดกับเจ้าหน้าที่ โดยปกติแล้วทางเราจะโทรนัดล่วงหน้าก่อนประมาณ 2–7 วัน",
        "หากเกิดความเสียหายจากการให้บริการ เช่น เจาะโดนท่อน้ำดี บริษัทฯจะรับผิดชอบซ่อมแซมให้ลูกค้าสูงสุด 5,000 บาท โดยสามารถหักจากค่าบริการที่ลูกค้าต้องชำระได้เลยและบริษัทฯจะจ่ายในส่วนที่เหลือ"
      ],
      signatures: { companyRep: form.tech || "", clientRep: form.name || "" }
    };
    return { data, fileName: `Contract_${data.contractNumber}.pdf` };
  }

  async function handleCreateContractPDFOnly() {
    const err = validate();
    if (err) {
      alert(err);
      return;
    }
    try {
      const { data, fileName } = buildContractPdfData();
      await generateContractPDF(data, { fileName });
    } catch (e) {
      console.error(e);
      alert("สร้างสัญญาไม่สำเร็จ: " + (e?.message || e));
    }
  }

  /* -------------------- บันทึกลง GAS -------------------- */
  const handleSubmitAndSave = async (e) => {
    e.preventDefault();
    setMsg({ text: "", ok: false });

    const err = validate();
    if (err) {
      setMsg({ text: err, ok: false });
      return;
    }

    // map sprayDates/baitDates → serviceSpray1..6, serviceBait1..12
    const sprayMap = {};
    for (let i = 0; i < SPRAY_MAX; i++) {
      sprayMap[`serviceSpray${i + 1}`] = sprayDates[i] || "";
    }
    const baitMap = {};
    for (let i = 0; i < BAIT_MAX; i++) {
      baitMap[`serviceBait${i + 1}`] = baitDates[i] || "";
    }

    const payload = {
      servicePackage: form.package,
      package: form.package,
      name: form.name,
      address: form.address,
      facebook: form.facebook,
      phone: digitsOnly(form.phone),
      taxId: taxIdDigits(form.taxId),
      startDate: form.startDate,
      endDate: form.endDate,
      tech: form.tech,
      note: form.note,
      status: form.status || "ใช้งานอยู่",

      // ยอด
      items: [{ name: `ค่าบริการแพ็กเกจ ${pkgLabel(form.package)}`, quantity: 1, price: baseServicePrice }],
      discount: discountValue === "" ? "" : Number(discountValue),
      addons,
      itemsSubtotal,
      addonsSubtotal,
      netBeforeVat,

      // แนบคีย์ตาราง (เต็มเพดาน) จาก state แบบไดนามิก
      ...sprayMap,
      ...baitMap,

      // JSON กำหนดการแบบง่าย
      serviceScheduleJson: JSON.stringify({
        startDate: form.startDate,
        endDate: form.endDate,
        spray: sprayDates.filter(Boolean),
        bait: baitDates.filter(Boolean)
      })
    };

    try {
      setLoading(true);
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const raw = await res.text();
      let json;
      try {
        json = JSON.parse(raw);
      } catch {
        json = { ok: res.ok, raw };
      }
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "save-failed");

      setMsg({ text: "บันทึกสำเร็จ", ok: true });
      // reset ฟอร์ม (คง package เดิม)
      setForm({ ...emptyForm, package: form.package });
      setDiscountValue("");
      setAddons([{ name: "", qty: 1, price: 0 }]);
      setSprayDates([]);
      setBaitDates([]);
    } catch (err2) {
      setMsg({ text: `บันทึกไม่สำเร็จ ${err2?.message || err2}`, ok: false });
    } finally {
      setLoading(false);
    }
  };

  /* -------------------- UI -------------------- */
  const pkgOptions = ["pipe3993", "bait5500_in", "bait5500_out", "bait5500_both", "combo8500"];

  // ปุ่มเพิ่ม/ลด รอบบริการ
  const addSpray = () => {
    if (sprayDates.length >= SPRAY_MAX) return;
    setSprayDates((arr) => [...arr, ""]);
  };
  const removeSpray = () => setSprayDates((arr) => arr.slice(0, Math.max(0, arr.length - 1)));
  const addBait = () => {
    if (baitDates.length >= BAIT_MAX) return;
    setBaitDates((arr) => [...arr, ""]);
  };
  const removeBait = () => setBaitDates((arr) => arr.slice(0, Math.max(0, arr.length - 1)));

  return (
    <div className="cf">
      <div className="cf__card">
        <div className="cf__chip">ฟอร์มสัญญา (Lite)</div>
        <h2 className="cf__title">บันทึกสัญญาลูกค้า + สร้าง PDF</h2>
        <p className="cf__subtitle">เพิ่ม/ลดรอบบริการได้ตามต้องการ หรือกด “เติมตารางอัตโนมัติจากแพ็กเกจ” แล้วแก้วันได้ทันที</p>

        {/* ปุ่ม PDF ด้านบน */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-secondary" onClick={handleCreateReceiptPDF}>
            สร้างใบเสร็จ (PDF)
          </button>
          <button type="button" className="btn" onClick={handleCreateContractPDFOnly}>
            สร้างสัญญา (PDF)
          </button>
        </div>

        <form onSubmit={handleSubmitAndSave} className="cf__form">
          {/* แพ็กเกจ + วันเริ่ม/สิ้นสุด */}
          <div className="cf__grid">
            <div className="cf__field">
              <label className="cf__label">แพ็กเกจ</label>
              <select className="cf__select" value={form.package} onChange={(e) => setVal("package", e.target.value)}>
                {pkgOptions.map((k) => (
                  <option key={k} value={k}>
                    {pkgLabel(k)}
                  </option>
                ))}
              </select>
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
              <label className="cf__label">วันสิ้นสุดสัญญา (+1 ปีอัตโนมัติ)</label>
              <input
                type="date"
                className="cf__input"
                value={form.endDate}
                onChange={(e) => setVal("endDate", e.target.value)}
              />
            </div>
          </div>

          <div className="cf-toolbar" style={{ marginTop: 12 }}>
            <div className="cf-toolbar__left">
              <button type="button" className="btn" onClick={fillScheduleByPackage}>
                เติมตารางอัตโนมัติจากแพ็กเกจ
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setSprayDates(["", "", ""]);
                  setBaitDates(Array(6).fill(""));
                }}
              >
                ล้างตาราง
              </button>
            </div>
            <div className="cf-toolbar__right">
              <span className="cf-chip">เริ่ม {form.startDate || "-"}</span>
              <span className="cf-chip cf-chip--muted">สิ้นสุด {form.endDate || "-"}</span>
            </div>
          </div>

          {/* ตารางบริการ (เพิ่ม/ลด) */}
          <fieldset className="cf__fieldset">
            <legend className="cf__legend">กำหนดการบริการ</legend>

            {/* Spray */}
            <div className="cf-panel">
              <div className="cf-panel__header">
                <h4 className="cf-group-title">Spray (สูงสุด {SPRAY_MAX})</h4>
                <div className="cf-actions-inline">
                  <button type="button" className="btn-outline" onClick={removeSpray} disabled={sprayDates.length === 0}>– ลด</button>
                  <div style={{ padding: "0 8px" }}>ใช้จริง: {sprayDates.length}/{SPRAY_MAX}</div>
                  <button type="button" className="btn-outline" onClick={addSpray} disabled={sprayDates.length >= SPRAY_MAX}>+ เพิ่ม</button>
                </div>
              </div>

              {sprayDates.length === 0 ? (
                <div className="cf-empty">ยังไม่มีรอบ Spray</div>
              ) : (
                <div className="service-grid">
                  {sprayDates.map((d, i) => (
                    <div className="round" key={`spr-${i}`}>
                      <div className="round__badge">#{i + 1}</div>
                      <label className="cf__label">Service Spray รอบที่ {i + 1}</label>
                      <input
                        type="date"
                        className="cf__input"
                        value={d || ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSprayDates((arr) => {
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

            {/* Bait */}
            <div className="cf-panel" style={{ marginTop: 16 }}>
              <div className="cf-panel__header">
                <h4 className="cf-group-title">Bait (สูงสุด {BAIT_MAX})</h4>
                <div className="cf-actions-inline">
                  <button type="button" className="btn-outline" onClick={removeBait} disabled={baitDates.length === 0}>– ลด</button>
                  <div style={{ padding: "0 8px" }}>ใช้จริง: {baitDates.length}/{BAIT_MAX}</div>
                  <button type="button" className="btn-outline" onClick={addBait} disabled={baitDates.length >= BAIT_MAX}>+ เพิ่ม</button>
                </div>
              </div>

              {baitDates.length === 0 ? (
                <div className="cf-empty">ยังไม่มีรอบ Bait</div>
              ) : (
                <div className="service-grid">
                  {baitDates.map((d, i) => (
                    <div className="round" key={`bait-${i}`}>
                      <div className="round__badge">#{i + 1}</div>
                      <label className="cf__label">Service Bait รอบที่ {i + 1}</label>
                      <input
                        type="date"
                        className="cf__input"
                        value={d || ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setBaitDates((arr) => {
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
          </fieldset>

          {/* ส่วนลด + Add-on */}
          <section className="cf-section" style={{ marginTop: 12 }}>
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
                    if (s === "") {
                      setDiscountValue("");
                    } else {
                      const v = Math.max(0, Number(s) || 0);
                      setDiscountValue(String(v));
                    }
                  }}
                  onWheel={(e) => e.currentTarget.blur()}
                />
                <span className="cf-unit">บาท</span>
              </div>
            </div>
          </section>

          <div className="section">
            <h3>ค่าบริการเพิ่มเติม (Add-on)</h3>
            {addons.map((row, i) => (
              <div key={i} className="addon-row">
                <input
                  type="text"
                  placeholder="ชื่อรายการ"
                  value={row.name}
                  onChange={(e) =>
                    setAddons((prev) => {
                      const next = [...prev];
                      next[i] = { ...next[i], name: e.target.value };
                      return next;
                    })
                  }
                />
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="จำนวน"
                  value={row.qty}
                  onChange={(e) =>
                    setAddons((prev) => {
                      const next = [...prev];
                      next[i] = { ...next[i], qty: Number(e.target.value || 0) };
                      return next;
                    })
                  }
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="ราคา/หน่วย"
                  value={row.price}
                  onChange={(e) =>
                    setAddons((prev) => {
                      const next = [...prev];
                      next[i] = { ...next[i], price: Number(e.target.value || 0) };
                      return next;
                    })
                  }
                />
                <div className="addon-amount">
                  {(Number(row.qty || 0) * Number(row.price || 0)).toLocaleString()}
                </div>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() =>
                    setAddons((prev) => prev.filter((_, idx) => idx !== i))
                  }
                >
                  ลบ
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-add"
              onClick={() => setAddons((prev) => [...prev, { name: "", qty: 1, price: 0 }])}
            >
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
                ค่าบริการเพิ่มเติม (Add-on): <b>+{addonsSubtotal.toLocaleString()}</b>
              </div>
              <hr />
              <div className="total-line">
                ราคาก่อนภาษี:{" "}
                <b>
                  {(
                    Math.round((netBeforeVat + Number.EPSILON) * 100) / 100
                  ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </b>
              </div>

              <label
                className="cf__checkbox"
                style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}
              >
                <input
                  type="checkbox"
                  checked={receiptVatEnabled}
                  onChange={(e) => setReceiptVatEnabled(e.target.checked)}
                />
                คิดภาษีมูลค่าเพิ่ม (VAT) 7% สำหรับ “ใบเสร็จ” ใบนี้
              </label>

              {receiptVatEnabled && (
                <div style={{ marginTop: 6 }}>
                  ภาษีมูลค่าเพิ่ม 7%:{" "}
                  <b>
                    {receiptVatAmount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </b>
                </div>
              )}

              <div className="total-line" style={{ marginTop: 6 }}>
                ยอดรวมสุทธิ (ใบเสร็จ):{" "}
                <b>
                  {receiptGrandTotal.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </b>
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
              <input
                className="cf__input"
                value={form.tech}
                onChange={(e) => setVal("tech", e.target.value)}
              />
            </div>
          </div>

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

          {/* Actions */}
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
                setDiscountValue("");
                setAddons([{ name: "", qty: 1, price: 0 }]);
                setSprayDates([]);
                setBaitDates([]);
              }}
            >
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
