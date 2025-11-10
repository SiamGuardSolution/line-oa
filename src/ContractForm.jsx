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

/* -----------------------------------------
 * โครง field แบบ Dynamic + เพดานสูงสุด
 * ----------------------------------------- */
const makeFields = (prefix, n, labelPrefix) =>
  Array.from({ length: n }, (_, i) => ({
    key: `${prefix}${i + 1}`,
    label: `${labelPrefix} รอบที่ ${i + 1}`,
  }));

// เพดานสูงสุดเพื่อรองรับรอบเพิ่มเติมตามเงื่อนไขใหม่
const SPRAY_STD_MAX = 6;  // รองรับมากสุด 6 ครั้ง/ปี
const BAIT_STD_MAX  = 12; // รองรับมากสุด 12 ครั้ง/ปี

const SPRAY_FIELDS = makeFields("serviceSpray", SPRAY_STD_MAX, "Service Spray");
const BAIT_FIELDS  = makeFields("serviceBait",  BAIT_STD_MAX,  "Service Bait");

/* -----------------------------------------
 * นิยามแพ็กเกจใหม่ตามโจทย์
 * - 3,993 : Spray 3 ครั้ง/ปี ห่าง 3 เดือน (ปรับได้)
 * - 5,500 : ย่อยเป็น bait ภายใน / ภายนอก / ทั้งสองแบบ
 * - 8,500 : รวม 3,993 + 5,500 (both)
 * ----------------------------------------- */
const PACKAGES = {
  pipe3993:      { groups: [{ type: "spray", title: "Service Spray", fields: SPRAY_FIELDS }] },
  bait5500_in:   { groups: [{ type: "bait",  title: "Service Bait",  fields: BAIT_FIELDS  }] },
  bait5500_out:  { groups: [{ type: "bait",  title: "Service Bait",  fields: BAIT_FIELDS  }] },
  bait5500_both: { groups: [{ type: "bait",  title: "Service Bait",  fields: BAIT_FIELDS  }] },
  combo8500:     { groups: [
    { type: "spray", title: "Service Spray", fields: SPRAY_FIELDS },
    { type: "bait",  title: "Service Bait",  fields: BAIT_FIELDS  },
  ]},
};

// ค่าเริ่มต้นของฟอร์ม
const emptyForm = {
  package: "pipe3993",
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

  // ใช้คำนวณ Spray ย้อนหลัง (สำหรับแพ็กเกจ 5,500 / 8,500)
  sprayStartOverride: "",
};

// ===== helpers =====

// YYYY-MM-DD → dd/MM/yyyy (ค.ศ.) | ถ้าเป็น dd/MM/yyyy อยู่แล้วและเป็น พ.ศ. (>2400) จะลด 543 ให้เป็น ค.ศ.
function toCE_ddmmyyyy(raw) {
  if (!raw) return "";
  const s = String(raw).trim();
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    let y = parseInt(dmy[3], 10);
    if (y > 2400) y -= 543; // พ.ศ. -> ค.ศ.
    const dd = String(dmy[1]).padStart(2, "0");
    const mm = String(dmy[2]).padStart(2, "0");
    return `${dd}/${mm}/${y}`;
  }
  return s;
}

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

const askConfirm = (msg) =>
  (typeof window !== "undefined" && typeof window.confirm === "function")
    ? window.confirm(msg)
    : true;

/* ===== Even Spacing (สำหรับปุ่มกระจายสเปรย์เท่าๆ กัน) ===== */
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

/** กระจาย N จุด โดยรวม "วันเริ่ม" และ "วันสิ้นสุด" ด้วย */
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

/* -----------------------------------------
 * คำนวณตารางบริการตาม “แพ็กเกจ + ตัวปรับ”
 * controls = {
 *   sprayCount, sprayGapMonths, sprayStartOverride,
 *   baitInCount, baitInGapDays,
 *   baitOutCount, baitOutGapMonths
 * }
 * ----------------------------------------- */
function computeSchedule(pkg, startStr, controls = {}) {
  if (!startStr) return {};
  const start = new Date(startStr);
  if (isNaN(start)) return {};

  const {
    sprayCount = 0,
    sprayGapMonths = 3,
    sprayStartOverride = "",

    baitInCount = 0,
    baitInGapDays = 15,

    baitOutCount = 0,
    baitOutGapMonths = 2,
  } = controls;

  const out = {};
  out.endDate = toISO(addYears(start, 1)); // +1 ปีอัตโนมัติ

  // ===== Spray schedule =====
  const sprayBase = sprayStartOverride ? new Date(sprayStartOverride) : start;
  if (!isNaN(sprayBase) && sprayCount > 0) {
    for (let i = 0; i < Math.min(sprayCount, SPRAY_STD_MAX); i++) {
      const d = addMonths(sprayBase, i * sprayGapMonths);
      out[`serviceSpray${i + 1}`] = toISO(d);
    }
  }

  // ===== Bait schedule (ภายใน: วัน) =====
  let baitIndex = 1;
  if (baitInCount > 0) {
    for (let i = 0; i < Math.min(baitInCount, BAIT_STD_MAX); i++) {
      const d = addDays(start, i * baitInGapDays);
      out[`serviceBait${baitIndex}`] = toISO(d);
      baitIndex++;
      if (baitIndex > BAIT_STD_MAX) break;
    }
  }

  // ===== Bait schedule (ภายนอก: เดือน) =====
  if (baitOutCount > 0) {
    for (let i = 0; i < Math.min(baitOutCount, BAIT_STD_MAX - (baitIndex - 1)); i++) {
      const d = addMonths(start, i * baitOutGapMonths);
      out[`serviceBait${baitIndex}`] = toISO(d);
      baitIndex++;
      if (baitIndex > BAIT_STD_MAX) break;
    }
  }

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
  const schedule = groups
    .flatMap((g) =>
      (g.fields || [])
        .map((f, idx) => {
          const dateStr = form[f.key];
          if (!dateStr) return null;
          return { round: idx + 1, date: dateStr, note: f.label || g.title || "" };
        })
        .filter(Boolean)
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
    const val = typeof fn === "function" ? fn(form.package) : map?.[form.package];
    return Number(val ?? 0);
  }, [form.package]);

  // ===== items สำหรับคิดยอด / ใบเสร็จ =====
  const items = useMemo(
    () => [{ name: `ค่าบริการแพ็กเกจ ${pkgLabel(form.package)}`, quantity: 1, price: baseServicePrice }],
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

  const pkgConf = PACKAGES[form.package] || PACKAGES["pipe3993"];
  const setVal = (k, v) => setForm((s) => ({ ...s, [k]: v }));
  const phoneDigits = (s) => digitsOnly(s);

  const [discountValue, setDiscountValue] = useState("");

  // ===== แท็บมุมมอง Service =====
  const hasSpray = form.package === "pipe3993" || form.package === "combo8500";
  const hasBait  = form.package.startsWith("bait5500") || form.package === "combo8500";
  const [activeTab, setActiveTab] = useState(hasSpray ? "spray" : "bait");

  useEffect(() => {
    setActiveTab(hasSpray ? "spray" : "bait");
  }, [form.package]); // eslint-disable-line

  // === ใบเสร็จ (Receipt) VAT ===
  const [receiptVatEnabled, setReceiptVatEnabled] = useState(false);
  const RECEIPT_VAT_RATE = 0.07;

  /* -----------------------------------------
   * ตัวปรับแพ็กเกจ (แก้ได้จาก UI)
   * ----------------------------------------- */
  // Spray
  const [sprayStdUsed, setSprayStdUsed] = useState(3);     // 3,993 และ 8,500 เริ่ม 3 รอบ/ปี
  const [sprayGapMonths, setSprayGapMonths] = useState(3); // ห่าง 3 เดือน
  const [sprayStartOverride, setSprayStartOverride] = useState("");

  // Bait (ภายใน)
  const [baitInUsed, setBaitInUsed] = useState(0);
  const [baitInGapDays, setBaitInGapDays] = useState(15);

  // Bait (ภายนอก)
  const [baitOutUsed, setBaitOutUsed] = useState(0);
  const [baitOutGapMonths, setBaitOutGapMonths] = useState(2);

  // ค่าเริ่มต้นของตัวปรับเมื่อสลับแพ็กเกจ
  useEffect(() => {
    switch (form.package) {
      case "pipe3993": // 3,993
        setSprayStdUsed(3);
        setSprayGapMonths(3);
        setBaitInUsed(0);
        setBaitOutUsed(0);
        setSprayStartOverride("");
        break;

      case "bait5500_in": // 5,500 - ภายใน
        setSprayStdUsed(0);          // ไม่บังคับสเปรย์ แต่สามารถเปิดใช้ภายหลังได้
        setSprayGapMonths(3);
        setBaitInUsed(5);            // เริ่มต้น 5 รอบ (แก้ได้)
        setBaitInGapDays(15);
        setBaitOutUsed(0);
        setBaitOutGapMonths(2);
        setSprayStartOverride("");   // ช่องแก้วันเริ่ม Spray ย้อนหลัง
        break;

      case "bait5500_out": // 5,500 - ภายนอก
        setSprayStdUsed(0);
        setSprayGapMonths(3);
        setBaitInUsed(0);
        setBaitOutUsed(6);           // ทุก 2 เดือน ครบปี ~6 รอบ (แก้ได้)
        setBaitOutGapMonths(2);
        setSprayStartOverride("");
        break;

      case "bait5500_both": // 5,500 - ทั้งสองแบบ
        setSprayStdUsed(0);
        setSprayGapMonths(3);
        setBaitInUsed(4);            // ภายใน 15 วัน/ครั้ง
        setBaitInGapDays(15);
        setBaitOutUsed(4);           // ภายนอก 2 เดือน/ครั้ง
        setBaitOutGapMonths(2);
        setSprayStartOverride("");
        break;

      case "combo8500": // 8,500 รวม
        setSprayStdUsed(3);          // ตาม 3,993
        setSprayGapMonths(3);
        setBaitInUsed(4);            // ตาม 5,500 (both) เวอร์ชันแก้ไข
        setBaitInGapDays(15);
        setBaitOutUsed(4);
        setBaitOutGapMonths(2);
        setSprayStartOverride("");
        break;

      default:
        break;
    }
  }, [form.package]);

  // ===== รอบบริการแบบยืดหยุ่น (รายการเติมมือ) =====
  const [sprayExtras, setSprayExtras] = useState([]); // ['YYYY-MM-DD', ...]
  const [baitExtras, setBaitExtras] = useState([]);   // ['YYYY-MM-DD', ...]

  // นับจำนวนครั้งจริง (มาตรฐานที่ใช้จริง + extras)
  const sprayCount = sprayStdUsed + sprayExtras.length;
  const baitCount  = (baitInUsed + baitOutUsed) + baitExtras.length;

  // เคลียร์คีย์ที่เกินจำนวนที่ใช้จริงเมื่อผู้ใช้ "ลดรอบ"
  useEffect(() => {
    // Spray
    setForm((s) => {
      const n = { ...s };
      for (let i = sprayStdUsed; i < SPRAY_STD_MAX; i++) {
        n[`serviceSpray${i + 1}`] = "";
      }
      return n;
    });
  }, [sprayStdUsed]);

  useEffect(() => {
    // Bait
    setForm((s) => {
      const n = { ...s };
      const limit = Math.min(BAIT_STD_MAX, baitInUsed + baitOutUsed);
      for (let i = limit; i < BAIT_STD_MAX; i++) {
        n[`serviceBait${i + 1}`] = "";
      }
      return n;
    });
  }, [baitInUsed, baitOutUsed]);

  // Auto-generate ตารางบริการ / endDate (ตามตัวปรับ)
  useEffect(() => {
    if (!form.startDate) return;

    const auto = computeSchedule(
      form.package,
      form.startDate,
      {
        sprayCount: Math.min(sprayStdUsed, SPRAY_STD_MAX),
        sprayGapMonths,
        sprayStartOverride,

        baitInCount:  Math.min(baitInUsed,  BAIT_STD_MAX),
        baitInGapDays,

        baitOutCount: Math.min(baitOutUsed, BAIT_STD_MAX),
        baitOutGapMonths,
      }
    );
    if (!Object.keys(auto).length) return;

    // เคารพจำนวนที่ใช้จริง + เคลียร์คีย์เกิน
    const patch = { ...auto };

    for (let i = Math.min(sprayStdUsed, SPRAY_STD_MAX); i < SPRAY_STD_MAX; i++) {
      patch[`serviceSpray${i + 1}`] = "";
    }
    for (let i = Math.min(baitInUsed + baitOutUsed, BAIT_STD_MAX); i < BAIT_STD_MAX; i++) {
      patch[`serviceBait${i + 1}`] = "";
    }

    setForm((s) => ({ ...s, ...patch }));
  }, [
    form.package,
    form.startDate,
    sprayStdUsed, sprayGapMonths, sprayStartOverride,
    baitInUsed, baitInGapDays,
    baitOutUsed, baitOutGapMonths
  ]);

  // ---- ปุ่ม: กระจาย (เฉพาะสเปรย์) เท่าๆ กัน รวมวันเริ่ม/สิ้นสุด ----
  const distributeSprayEqualFromStartEnd = () => {
    const start = form.startDate;
    const end = form.endDate || (form.startDate ? toISO(addYears(new Date(form.startDate), 1)) : "");
    if (!start || !end) {
      alert("กรุณากำหนดวันเริ่ม/สิ้นสุดสัญญาให้ครบก่อน");
      return;
    }

    const totalRounds = sprayStdUsed + sprayExtras.length; // รอบที่จะกระจายจริง
    if (totalRounds < 1) {
      alert("ต้องมีอย่างน้อย 1 รอบฉีดพ่นเพื่อกระจายระยะ");
      return;
    }

    const totalPoints = totalRounds + 2;
    const dates = evenSpacedDatesInclusive(start, end, totalPoints);
    const midDates = dates.slice(1, dates.length - 1);

    const patch = {};
    // เติมลงคีย์มาตรฐานตามจำนวนที่ใช้จริง
    SPRAY_FIELDS.slice(0, Math.min(sprayStdUsed, SPRAY_STD_MAX)).forEach((f, i) => {
      patch[f.key] = midDates[i] || "";
    });

    const extra = midDates.slice(sprayStdUsed);
    setSprayExtras(extra);

    setForm((s) => ({ ...s, ...patch, endDate: dates[dates.length - 1] || end }));
  };

  // ---- ปุ่ม: รีเซ็ตตามสูตรแพ็กเกจ (เคารพจำนวนที่ใช้จริง) ----
  const resetByPackageFormula = () => {
    if (!form.startDate) {
      alert("กรุณาเลือกวันที่เริ่มสัญญาก่อน");
      return;
    }
    const auto = computeSchedule(
      form.package,
      form.startDate,
      {
        sprayCount: Math.min(sprayStdUsed, SPRAY_STD_MAX),
        sprayGapMonths,
        sprayStartOverride,

        baitInCount:  Math.min(baitInUsed,  BAIT_STD_MAX),
        baitInGapDays,

        baitOutCount: Math.min(baitOutUsed, BAIT_STD_MAX),
        baitOutGapMonths,
      }
    );
    if (!Object.keys(auto).length) return;

    const patch = { ...auto };

    for (let i = Math.min(sprayStdUsed, SPRAY_STD_MAX); i < SPRAY_STD_MAX; i++) {
      patch[`serviceSpray${i + 1}`] = "";
    }
    for (let i = Math.min(baitInUsed + baitOutUsed, BAIT_STD_MAX); i < BAIT_STD_MAX; i++) {
      patch[`serviceBait${i + 1}`] = "";
    }

    setForm((s) => ({ ...s, ...patch }));
  };

  // ตรวจความถูกต้อง
  const validate = () => {
    if (!form.name.trim()) return "กรุณากรอกชื่อลูกค้า";
    if (phoneDigits(form.phone).length < 9) return "กรุณากรอกเบอร์โทรให้ถูกต้อง";
    if (form.taxId && taxIdDigits(form.taxId).length !== 13)
      return "กรุณากรอกเลขประจำตัวผู้เสียภาษีให้ครบ 13 หลัก";
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
    return Math.round(
      (Number(netBeforeVat || 0) + Number(receiptVatAmount || 0) + Number.EPSILON) * 100
    ) / 100;
  }, [netBeforeVat, receiptVatAmount]);

  // ===== ใบเสร็จ (PDF) =====
  async function handleCreateReceiptPDF() {
    // แปลง startDate จาก input (YYYY-MM-DD) → dd/MM/yyyy (ค.ศ.)
    const startForPdf = toCE_ddmmyyyy(form.startDate);

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
      discount: Number((discountValue === "" ? 0 : discountValue) || 0),

      vatEnabled: !!receiptVatEnabled,
      vatRate: receiptVatEnabled ? 0.07 : 0,

      alreadyPaid: 0,

      notes: form.note || "",
      bankRemark: COMPANY.bank
        ? `ธนาคาร${COMPANY.bank.name} ${COMPANY.bank.account}\n${COMPANY.bank.accountName}`
        : "",

      // ส่งวันเริ่มสัญญาเข้า payload ด้วย
      contractStartDate: startForPdf,
    };

    const filename = `Receipt-${payload.receiptNo}.pdf`;

    try {
      await generateReceiptPDF(payload, {
        filename,
        returnType: "save",
        forceReceiptDate: startForPdf,
      });
    } catch (e) {
      console.error(e);
      alert("สร้างใบเสร็จไม่สำเร็จ: " + (e?.message || e));
    }
  }

  // ===== สร้างสัญญา (PDF) =====
  async function handleCreateContractPDFOnly() {
    const err = validate();
    if (err) {
      alert(err);
      return;
    }
    const { data, fileName } = buildContractPdfData(form, pkgConf, baseServicePrice, addons);
    try {
      await generateContractPDF(data, { fileName });
    } catch (e) {
      console.error(e);
      alert("สร้างสัญญาไม่สำเร็จ: " + (e?.message || e));
    }
  }

  // ===== บันทึกลง GAS ผ่าน /api/submit-contract =====
  const isBaitLike = form.package.startsWith("bait") || form.package === "combo8500";

  const handleSubmitAndSave = async (e) => {
    e.preventDefault();
    setMsg({ text: "", ok: false });

    const err = validate();
    if (err) return setMsg({ text: err, ok: false });

    // เตรียมคีย์มาตรฐานตามจำนวนที่ใช้จริง (Dynamic)
    const sprayStdKeys = SPRAY_FIELDS.slice(0, Math.min(sprayStdUsed, SPRAY_STD_MAX)).map(f => f.key);
    const baitStdKeys  = BAIT_FIELDS.slice(0,
      Math.min(baitInUsed + baitOutUsed, BAIT_STD_MAX)
    ).map(f => f.key);

    // สร้างอ็อบเจ็กต์คีย์ตารางบริการแบบขยาย (serviceSpray1..6, serviceBait1..12)
    const serviceKeysExpanded = {};
    for (let i = 0; i < SPRAY_STD_MAX; i++) {
      const k = `serviceSpray${i + 1}`;
      serviceKeysExpanded[k] = form[k] || "";
    }
    for (let i = 0; i < BAIT_STD_MAX; i++) {
      const k = `serviceBait${i + 1}`;
      serviceKeysExpanded[k] = form[k] || "";
    }

    // เขียน payload สำหรับบันทึกชีต
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

      // แนบคีย์ตารางบริการแบบขยาย
      ...serviceKeysExpanded,

      // แนบ JSON รอบบริการทั้งหมด (อิง "มาตรฐานที่ใช้จริง" + extras)
      serviceScheduleJson: JSON.stringify({
        startDate: form.startDate,
        endDate: form.endDate,
        spray: [...sprayStdKeys.map((k) => form[k] || ""), ...sprayExtras].filter(Boolean),
        bait: isBaitLike
          ? [...baitStdKeys.map((k) => form[k] || ""), ...baitExtras].filter(Boolean)
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
      try {
        json = JSON.parse(raw);
      } catch {
        json = { ok: res.ok, raw };
      }

      if (!res.ok || json?.ok === false) throw new Error(json?.error || "save-failed");

      setMsg({ text: "บันทึกสำเร็จ", ok: true });

      // reset ฟอร์มหลังบันทึก (คง package เดิมไว้)
      setForm({ ...emptyForm, package: form.package });
      setAddons([{ name: "", qty: 1, price: 0 }]);
      setDiscountValue("");
      setSprayExtras([]);
      setBaitExtras([]);
      // รีเซ็ตตัวปรับตามแพ็กเกจผ่าน useEffect ของ package อยู่แล้ว
    } catch (err2) {
      setMsg({ text: `บันทึกไม่สำเร็จ ${err2?.message || err2}`, ok: false });
    } finally {
      setLoading(false);
    }
  };

  // รายการตัวเลือกแพ็กเกจ (ใหม่)
  const pkgOptions = ["pipe3993", "bait5500_in", "bait5500_out", "bait5500_both", "combo8500"];

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

          {/* ===== ตัวปรับแพ็กเกจ ===== */}
          <section className="cf-section" style={{ marginTop: 12 }}>
            <h3 style={{ marginBottom: 8 }}>ตัวปรับแพ็กเกจ</h3>

            {/* --- Spray controls --- */}
            {(hasSpray || form.package.startsWith("bait5500")) && (
              <div className="cf-grid-3">
                <div className="cf-field">
                  <label>จำนวนรอบ Spray/ปี</label>
                  <input
                    type="number"
                    className="cf-input"
                    min={0}
                    max={SPRAY_STD_MAX}
                    value={sprayStdUsed}
                    onChange={e => setSprayStdUsed(Math.max(0, Math.min(SPRAY_STD_MAX, Number(e.target.value || 0))))}
                    onWheel={e => e.currentTarget.blur()}
                  />
                  <div className="cf-hint">แพ็ก 3,993 และ 8,500 เริ่ม 3 รอบ/ปี — ปรับได้</div>
                </div>

                <div className="cf-field">
                  <label>ช่วงห่าง Spray (เดือน)</label>
                  <input
                    type="number"
                    className="cf-input"
                    min={1}
                    max={12}
                    value={sprayGapMonths}
                    onChange={e => setSprayGapMonths(Math.max(1, Math.min(12, Number(e.target.value || 0))))}
                    onWheel={e => e.currentTarget.blur()}
                  />
                </div>

                {(form.package.startsWith("bait5500") || form.package === "combo8500") && (
                  <div className="cf-field">
                    <label>เริ่มนับรอบ Spray (จริง) – ย้อนหลังได้</label>
                    <input
                      type="date"
                      className="cf-input"
                      value={sprayStartOverride}
                      onChange={e => setSprayStartOverride(e.target.value)}
                    />
                    <div className="cf-hint">สำหรับโปรฯ 5,500 และ 8,500 ที่วันเริ่ม Spray ไม่แน่นอน</div>
                  </div>
                )}
              </div>
            )}

            {/* --- Bait controls --- */}
            {hasBait && (
              <>
                <div className="cf-subtitle" style={{ marginTop: 12 }}>เหยื่อ (Bait)</div>
                <div className="cf-grid-4">
                  <div className="cf-field">
                    <label>เหยื่อ “ภายใน” — จำนวนรอบ</label>
                    <input
                      type="number"
                      className="cf-input"
                      min={0}
                      max={BAIT_STD_MAX}
                      value={baitInUsed}
                      onChange={e => setBaitInUsed(Math.max(0, Math.min(BAIT_STD_MAX, Number(e.target.value || 0))))}
                      onWheel={e => e.currentTarget.blur()}
                    />
                    <div className="cf-hint">ค่าตั้งต้น 15 วัน/ครั้ง</div>
                  </div>
                  <div className="cf-field">
                    <label>เหยื่อ “ภายใน” — ช่วงห่าง (วัน)</label>
                    <input
                      type="number"
                      className="cf-input"
                      min={1}
                      max={90}
                      value={baitInGapDays}
                      onChange={e => setBaitInGapDays(Math.max(1, Math.min(90, Number(e.target.value || 0))))}
                      onWheel={e => e.currentTarget.blur()}
                    />
                  </div>
                  <div className="cf-field">
                    <label>เหยื่อ “ภายนอก” — จำนวนรอบ</label>
                    <input
                      type="number"
                      className="cf-input"
                      min={0}
                      max={BAIT_STD_MAX}
                      value={baitOutUsed}
                      onChange={e => setBaitOutUsed(Math.max(0, Math.min(BAIT_STD_MAX, Number(e.target.value || 0))))}
                      onWheel={e => e.currentTarget.blur()}
                    />
                    <div className="cf-hint">ค่าตั้งต้น 2 เดือน/ครั้ง</div>
                  </div>
                  <div className="cf-field">
                    <label>เหยื่อ “ภายนอก” — ช่วงห่าง (เดือน)</label>
                    <input
                      type="number"
                      className="cf-input"
                      min={1}
                      max={12}
                      value={baitOutGapMonths}
                      onChange={e => setBaitOutGapMonths(Math.max(1, Math.min(12, Number(e.target.value || 0))))}
                      onWheel={e => e.currentTarget.blur()}
                    />
                  </div>
                </div>
              </>
            )}
          </section>

          {/* ส่วนลด */}
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

          {/* Add-ons */}
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
                <div className="addon-amount">{(row.qty * row.price).toLocaleString()}</div>
                <button type="button" className="btn-outline" onClick={() => removeAddonRow(i)}>
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

              {/* VAT toggle */}
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
                  <div>
                    ภาษีมูลค่าเพิ่ม 7%:{" "}
                    <b>
                      {receiptVatAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </b>
                  </div>
                </div>
              )}

              <div className="total-line" style={{ marginTop: 6 }}>
                ยอดรวมสุทธิ (ใบเสร็จ):{" "}
                <b>
                  {receiptGrandTotal.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </b>
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
                {hasSpray && <span className="cf-chip cf-chip--spray">Spray {sprayCount} ครั้ง</span>}
                {hasBait  && <span className="cf-chip cf-chip--bait">Bait {baitCount} ครั้ง</span>}
              </div>
            </div>

            {/* Tabs */}
            <div className="cf-tabs">
              {hasSpray && (
                <button
                  type="button"
                  className={`cf-tab ${activeTab === "spray" ? "cf-tab--active" : ""}`}
                  onClick={() => setActiveTab("spray")}
                >
                  Spray ({sprayCount})
                </button>
              )}
              {hasBait && (
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
            {hasSpray && activeTab === "spray" && (
              <div className="cf-panel">
                <div className="cf-panel__header">
                  <h4 className="cf-group-title">รอบมาตรฐาน</h4>
                  <div className="cf-actions-inline">
                    <button
                      type="button"
                      className="btn-outline"
                      disabled={sprayStdUsed === 0}
                      onClick={() => {
                        const hasData = SPRAY_FIELDS
                          .slice(sprayStdUsed - 1, sprayStdUsed)
                          .some(f => !!form[f.key]);
                        if (hasData && !askConfirm("ลดรอบมาตรฐาน: ข้อมูลรอบท้ายจะถูกลบออกจากแบบฟอร์ม")) return;
                        setSprayStdUsed((n) => Math.max(0, n - 1));
                      }}
                    >
                      – ลด
                    </button>
                    <div style={{ padding: "0 8px" }}>ใช้จริง: {sprayStdUsed}/{SPRAY_STD_MAX}</div>
                    <button
                      type="button"
                      className="btn-outline"
                      disabled={sprayStdUsed === SPRAY_STD_MAX}
                      onClick={() => setSprayStdUsed((n) => Math.min(SPRAY_STD_MAX, n + 1))}
                    >
                      + เพิ่ม
                    </button>
                  </div>
                </div>

                <div className="service-grid">
                  {SPRAY_FIELDS.slice(0, sprayStdUsed).map(({ key }, i) => (
                    <div className="round" key={key}>
                      <div className="round__badge">#{i + 1}</div>
                      <label className="cf__label">Service Spray รอบที่ {i + 1}</label>
                      <input
                        type="date"
                        className="cf__input"
                        value={form[key] || ""}
                        onChange={(e) => setVal(key, e.target.value)}
                      />
                    </div>
                  ))}
                  {sprayStdUsed === 0 && <div className="cf-empty">ไม่มีรอบมาตรฐาน</div>}
                </div>

                <div className="cf-panel__header">
                  <h4 className="cf-group-title">รอบเพิ่มเติม</h4>
                  <div className="cf-actions-inline">
                    <button
                      type="button"
                      className="btn-outline"
                      disabled={sprayExtras.length === 0}
                      onClick={() => setSprayExtras((ex) => ex.slice(0, Math.max(0, ex.length - 1)))}
                    >
                      – ลด
                    </button>
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => setSprayExtras((ex) => [...ex, ""])}
                    >
                      + เพิ่ม
                    </button>
                  </div>
                </div>

                {sprayExtras.length === 0 ? (
                  <div className="cf-empty">ยังไม่มีรอบเพิ่มเติม</div>
                ) : (
                  <div className="service-grid">
                    {sprayExtras.map((d, i) => (
                      <div className="round" key={`sprExtra-${i}`}>
                        <div className="round__badge">#{i + 1 + sprayStdUsed}</div>
                        <label className="cf__label">Spray เพิ่มเติม #{i + 1 + sprayStdUsed}</label>
                        <input
                          type="date"
                          className="cf__input"
                          value={d || ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setSprayExtras((arr) => {
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
            {hasBait && activeTab === "bait" && (
              <div className="cf-panel">
                <div className="cf-panel__header">
                  <h4 className="cf-group-title">รอบมาตรฐาน</h4>
                  <div className="cf-actions-inline">
                    <button
                      type="button"
                      className="btn-outline"
                      disabled={baitInUsed + baitOutUsed === 0}
                      onClick={() => {
                        const currentCount = baitInUsed + baitOutUsed;
                        const lastKey = `serviceBait${currentCount}`;
                        const hasData = !!form[lastKey];
                        if (hasData && !askConfirm("ลดรอบมาตรฐาน: ข้อมูลรอบท้ายจะถูกลบออกจากแบบฟอร์ม")) return;

                        // ลดจากฝั่งภายนอกก่อน ถ้ายังเหลือค่อยลดฝั่งภายใน
                        if (baitOutUsed > 0) setBaitOutUsed((n) => Math.max(0, n - 1));
                        else if (baitInUsed > 0) setBaitInUsed((n) => Math.max(0, n - 1));
                      }}
                    >
                      – ลด
                    </button>
                    <div style={{ padding: "0 8px" }}>
                      ใช้จริง: {baitInUsed + baitOutUsed}/{BAIT_STD_MAX}
                    </div>
                    <button
                      type="button"
                      className="btn-outline"
                      disabled={baitInUsed + baitOutUsed === BAIT_STD_MAX}
                      onClick={() => {
                        // เพิ่มฝั่งภายนอกก่อน เพื่อกระจายปีละ ~2 เดือน/ครั้ง
                        if (baitOutUsed < BAIT_STD_MAX) setBaitOutUsed((n) => Math.min(BAIT_STD_MAX, n + 1));
                      }}
                    >
                      + เพิ่ม
                    </button>
                  </div>
                </div>

                <div className="service-grid">
                  {BAIT_FIELDS.slice(0, Math.min(BAIT_STD_MAX, baitInUsed + baitOutUsed)).map(({ key, label }, idx) => (
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
                  {(baitInUsed + baitOutUsed) === 0 && <div className="cf-empty">ไม่มีรอบมาตรฐาน</div>}
                </div>

                <div className="cf-panel__header">
                  <h4 className="cf-group-title">รอบเพิ่มเติม</h4>
                  <div className="cf-actions-inline">
                    <button
                      type="button"
                      className="btn-outline"
                      disabled={baitExtras.length === 0}
                      onClick={() => setBaitExtras((ex) => ex.slice(0, Math.max(0, ex.length - 1)))}
                    >
                      – ลด
                    </button>
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => setBaitExtras((ex) => [...ex, ""])}
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
                        <div className="round__badge">#{i + 1 + baitInUsed + baitOutUsed}</div>
                        <label className="cf__label">Bait เพิ่มเติม #{i + 1 + baitInUsed + baitOutUsed}</label>
                        <input
                          type="date"
                          className="cf__input"
                          value={d || ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setBaitExtras((arr) => {
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

          {msg.text && <p className={`cf__msg ${msg.ok ? "cf__msg--ok" : "cf__msg--err"}`}>{msg.text}</p>}
        </form>
      </div>
    </div>
  );
}
