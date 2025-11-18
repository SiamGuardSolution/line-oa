// src/ContractForm.jsx (Lite + Dynamic schedule with add/remove + Split Bait In/Out)
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

// ==== ใช้เฉพาะ export ที่มีจริงจาก ./config/packages ====
const pkgPrice = (k) => {
  // 1) ฟังก์ชัน (ถ้ามี)
  if (typeof PKG.getPackagePrice === "function") {
    const v = Number(PKG.getPackagePrice(k));
    if (Number.isFinite(v) && v >= 0) return v;
  }
  // 2) แม็ปคงที่
  const v2 = Number(PKG?.PACKAGE_PRICE?.[k]);
  if (Number.isFinite(v2) && v2 >= 0) return v2;

  // 3) ไม่เจอ → 0 และเตือนตอน dev
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn("[ContractForm] price not found for package:", k);
  }
  return 0;
};
const priceText = (n) =>
  Number(n || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const pad2 = (n) => String(n).padStart(2, "0");
const toISO = (d) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return `${local.getUTCFullYear()}-${pad2(
    local.getUTCMonth() + 1
  )}-${pad2(local.getUTCDate())}`;
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
  phone: "063-364-5567, 088-792-4027",
  // taxId: "",
};
const makeReceiptNo = () => {
  const d = new Date();
  return `RC-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(
    d.getDate()
  )}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
};
const makeContractNo = () => {
  const d = new Date();
  return `CT-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(
    d.getDate()
  )}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
};

/* -------------------- เพดาน map ลงคีย์ -------------------- */
const SPRAY_MAX = 6;
const BAIT_MAX = 12;

/* -------------------- สูตรแพ็กเกจแบบง่าย -------------------- */
const PKG_FORMULA = {
  pipe3993: {
    sprayCount: 4,          // ✅ pipe3993 ใช้ 4 รอบ (0, +3, +6, +9 เดือน)
    sprayGapM: 3,
    baitIn: 0,
    baitInGapD: 15,
    baitOut: 0,
    baitOutGapM: 2,
  },
  bait5500_in: {
    sprayCount: 3,
    sprayGapM: 3,
    baitIn: 5,
    baitInGapD: 15,
    baitOut: 0,
    baitOutGapM: 2,
  },
  bait5500_out: {
    sprayCount: 3,
    sprayGapM: 3,
    baitIn: 0,
    baitInGapD: 15,
    baitOut: 6,
    baitOutGapM: 2,
  },
  bait5500_both: {
    sprayCount: 3,
    sprayGapM: 3,
    baitIn: 4,
    baitInGapD: 15,
    baitOut: 4,
    baitOutGapM: 2,
  },
  combo8500: {
    sprayCount: 3,
    sprayGapM: 3,
    baitIn: 4,
    baitInGapD: 15,
    baitOut: 4,
    baitOutGapM: 2,
  },
};

/* -------------------- ฟอร์มเริ่มต้น -------------------- */
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
};

export default function ContractForm() {
  const [form, setForm] = useState({ ...emptyForm });

  // ตารางบริการ (ไดนามิก)
  const [sprayDates, setSprayDates] = useState(() =>
    // เริ่มต้นให้ตรงตามสูตรแพ็กเกจ (pipe3993 = 4 รอบ, อื่น ๆ = 3 รอบ)
    getDefaultSprayDates(emptyForm.package)
  );
  const [baitInDates, setBaitInDates] = useState([]); // ภายใน
  const [baitOutDates, setBaitOutDates] = useState([]); // ภายนอก

  // ส่วนลด/แอดออน
  const [discountValue, setDiscountValue] = useState("");
  const [addons, setAddons] = useState([{ name: "", qty: 1, price: 0 }]);

  // VAT (ใบเสร็จ)
  const [receiptVatEnabled, setReceiptVatEnabled] = useState(false);
  const RECEIPT_VAT_RATE = 0.07;

  // UI
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: "", ok: false });
  const [saveInfo, setSaveInfo] = useState(null);

  // ====== ฐานราคาจากแพ็กเกจ (ล็อกเป็น “ราคาพื้นฐาน” เสมอ) ======
  const baseServicePrice = useMemo(
    () => pkgPrice(form.package),
    [form.package]
  );
  const packageLabel = useMemo(
    () => pkgLabel(form.package),
    [form.package]
  );

  const setVal = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  // ====== ยอดเงิน (คงสูตร: ฐานราคา + Add-on − ส่วนลด) ======
  const itemsSubtotal = baseServicePrice;
  const addonsSubtotal = useMemo(
    () =>
      (addons || []).reduce(
        (sum, ad) =>
          sum + Number(ad.qty || 0) * Number(ad.price || 0),
        0
      ),
    [addons]
  );
  const discountNum = discountValue === "" ? 0 : Number(discountValue);
  const netBeforeVat = Math.max(
    0,
    itemsSubtotal + addonsSubtotal - discountNum
  );

  const receiptVatAmount = receiptVatEnabled
    ? Math.round(
        (netBeforeVat * RECEIPT_VAT_RATE + Number.EPSILON) * 100
      ) / 100
    : 0;
  const receiptGrandTotal =
    Math.round(
      (netBeforeVat + receiptVatAmount + Number.EPSILON) * 100
    ) / 100;

  /* -------------------- Utilities -------------------- */
  // กำหนดจำนวนช่อง Spray ตั้งต้นต่อแพ็กเกจ
  function getDefaultSprayDates(pkg) {
    const defCount =
      PKG_FORMULA[pkg]?.sprayCount ??
      PKG_FORMULA.pipe3993.sprayCount;
    return Array(Math.min(defCount, SPRAY_MAX)).fill("");
  }

  function clampBait(inArr, outArr) {
    const total = inArr.length + outArr.length;
    if (total <= BAIT_MAX) return [inArr, outArr];
    const overflow = total - BAIT_MAX;
    if (outArr.length >= overflow)
      return [inArr, outArr.slice(0, outArr.length - overflow)];
    const rest = overflow - outArr.length;
    return [inArr.slice(0, inArr.length - rest), []];
  }

  function resetBaitByPackage(pkg) {
    if (pkg === "bait5500_both" || pkg === "combo8500") {
      setBaitInDates(Array(3).fill(""));
      setBaitOutDates(Array(3).fill("")); // รวม 6
    } else if (pkg === "bait5500_in") {
      setBaitInDates(Array(6).fill(""));
      setBaitOutDates([]);
    } else if (pkg === "bait5500_out") {
      setBaitInDates([]);
      setBaitOutDates(Array(6).fill(""));
    } else {
      setBaitInDates([]);
      setBaitOutDates([]);
    }
  }

  // เปลี่ยนแพ็กเกจ → เซ็ตค่าตั้งต้นสปรินต์ตาราง
  useEffect(() => {
    setSprayDates(getDefaultSprayDates(form.package)); // ✅ ใช้สูตรแพ็กเกจ
    resetBaitByPackage(form.package);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!form.startDate)
      return alert("กรุณาเลือกวันที่เริ่มสัญญาก่อน");

    const f = PKG_FORMULA[form.package] || PKG_FORMULA.pipe3993;
    const start = new Date(form.startDate);

    // ✅ สำหรับแพ็กเกจ bait5500_in และ bait5500_both
    //    "ครั้งแรก" จะไม่มีการฉีดพ่น (มีเฉพาะงาน Bait)
    //    จึงให้เริ่มรอบฉีดพ่นจากช่วงที่ 2 เป็นต้นไป
    const skipFirstSpray =
      form.package === "bait5500_in" ||
      form.package === "bait5500_both";

    // NOTE:
    // ปุ่มนี้จะไม่เปลี่ยน "จำนวนรอบ" อีกต่อไป
    // ใช้จำนวนรอบตาม state ปัจจุบัน แล้วคำนวณ/เติมวันที่ให้ใหม่เท่านั้น

    // ---- Spray ----
    setSprayDates((prev) => {
      if (!prev || prev.length === 0) return prev;
      const next = [...prev];
      for (let i = 0; i < next.length; i++) {
        const roundIndex = skipFirstSpray ? i + 1 : i;
        next[i] = toISO(
          addMonths(start, roundIndex * (f.sprayGapM || 0))
        );
      }
      return next;
    });

    // ---- Bait – ภายใน ----
    setBaitInDates((prev) => {
      if (!prev || prev.length === 0) return prev;
      const next = [...prev];
      const gapD = f.baitInGapD || 0;
      for (let i = 0; i < next.length; i++) {
        next[i] = toISO(addDays(start, i * gapD));
      }
      return next;
    });

    // ---- Bait – ภายนอก ----
    setBaitOutDates((prev) => {
      if (!prev || prev.length === 0) return prev;
      const next = [...prev];
      const gapM = f.baitOutGapM || 0;
      for (let i = 0; i < next.length; i++) {
        next[i] = toISO(addMonths(start, i * gapM));
      }
      return next;
    });
  };

  /* -------------------- ตรวจความถูกต้อง -------------------- */
  const validate = () => {
    if (!form.name.trim()) return "กรุณากรอกชื่อลูกค้า";
    if (digitsOnly(form.phone).length < 9)
      return "กรุณากรอกเบอร์โทรให้ถูกต้อง";
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
      {
        description: `ค่าบริการแพ็กเกจ ${packageLabel}`,
        qty: 1,
        unitPrice: baseServicePrice,
      },
      ...(addons || [])
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
      discount: Number(
        (discountValue === "" ? 0 : discountValue) || 0
      ),
      vatEnabled: !!receiptVatEnabled,
      vatRate: receiptVatEnabled ? 0.07 : 0,
      alreadyPaid: 0,
      notes: form.note || "",
      contractStartDate: startForPdf,
      servicePackage: form.package,
    };

    try {
      await generateReceiptPDF(payload, {
        filename: `Receipt-${payload.receiptNo}.pdf`,
        returnType: "save",
        forceReceiptDate: startForPdf, // ให้วันในหัวใบเสร็จเท่ากับวันเริ่มสัญญา
      });
    } catch (e) {
      console.error(e);
      alert("สร้างใบเสร็จไม่สำเร็จ: " + (e?.message || e));
    }
  }

  /* -------------------- PDF: สัญญา -------------------- */
  function buildContractPdfData() {
    // Spray
    const spraySchedule = sprayDates
      .map((d, i) =>
        d
          ? {
              round: i + 1,
              date: d,
              // เดิม: "Service Spray"
              note: "บริการฉีดพ่น",
            }
          : null
      )
      .filter(Boolean);

    // Bait – ภายใน
    const baitInSchedule = baitInDates
      .map((d, i) =>
        d
          ? {
              round: i + 1,
              date: d,
              // เดิม: "Service Bait (Inside)"
              note: "บริการวางเหยื่อ (ภายใน)",
            }
          : null
      )
      .filter(Boolean);

    // Bait – ภายนอก
    const baitOutSchedule = baitOutDates
      .map((d, i) =>
        d
          ? {
              round: i + 1,
              date: d,
              // เดิม: "Service Bait (Outside)"
              note: "บริการวางเหยื่อ (ภายนอก)",
            }
          : null
      )
      .filter(Boolean);

    // ✅ เรียงลำดับให้ “วางเหยื่อ” มาก่อน “ฉีดพ่น” เสมอ
    const mergedSchedule = [
      ...baitInSchedule,
      ...baitOutSchedule,
      ...spraySchedule,
    ];

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
        type: packageLabel,
        packageName: packageLabel,
        basePrice: baseServicePrice,
        addons: (addons || [])
          .filter((a) => a && (a.name || a.qty || a.price))
          .map((a) => ({
            name: a.name || "รายการเพิ่มเติม",
            price:
              Number(a.qty || 0) * Number(a.price || 0),
          })),
      },
      // ใช้ mergedSchedule ที่เรียง Bait ก่อน Spray แล้ว
      schedule: mergedSchedule,
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

    return {
      data,
      fileName: `Contract_${data.contractNumber}.pdf`,
    };
  }

  async function handleCreateContractPDFOnly() {
    const err = validate();
    if (err) return alert(err);
    try {
      const { data, fileName } = buildContractPdfData();
      await generateContractPDF(data, { fileName });
    } catch (e) {
      console.error(e);
      alert("สร้างสัญญาไม่สำเร็จ: " + (e?.message || e));
    }
  }

  /* -------------------- บันทึกลง GAS (ผ่าน API ภายใน) -------------------- */
  const handleSubmitAndSave = async (e) => {
    e.preventDefault();
    setMsg({ text: "", ok: false });

    const err = validate();
    if (err) return setMsg({ text: err, ok: false });

    // map sprayDates → serviceSpray1..6
    const sprayMap = {};
    for (let i = 0; i < SPRAY_MAX; i++) {
      sprayMap[`serviceSpray${i + 1}`] = sprayDates[i] || "";
    }

    // รวม bait ภายใน+ภายนอก → serviceBait1..12 (legacy compat)
    const mergedBait = [...baitInDates, ...baitOutDates].slice(
      0,
      BAIT_MAX
    );
    const baitMap = {};
    for (let i = 0; i < BAIT_MAX; i++) {
      baitMap[`serviceBait${i + 1}`] = mergedBait[i] || "";
    }

    const payload = {
      // ===== meta/แพ็กเกจ & ราคา =====
      pkg: form.package,
      package: form.package,
      packageLabel,
      price: baseServicePrice,
      priceText: `${priceText(baseServicePrice)} บาท`,

      // ===== ลูกค้า & สัญญา =====
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

      // ===== ยอดเงิน =====
      items: [
        {
          name: `ค่าบริการแพ็กเกจ ${packageLabel}`,
          quantity: 1,
          price: baseServicePrice,
        },
      ],
      discount: discountValue === "" ? "" : Number(discountValue),
      addons,
      itemsSubtotal,
      addonsSubtotal,
      netBeforeVat,

      // ===== legacy fields =====
      ...sprayMap,
      ...baitMap,

      // ===== ตารางจริงแบบแยก in/out =====
      serviceScheduleJson: JSON.stringify({
        startDate: form.startDate,
        endDate: form.endDate,
        spray: sprayDates.filter(Boolean),
        baitIn: baitInDates.filter(Boolean),
        baitOut: baitOutDates.filter(Boolean),
        bait: [...baitInDates, ...baitOutDates].filter(Boolean), // compat
      }),
    };

    try {
      setLoading(true);

      // ✅ กันแขวนด้วย timeout 15s
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
        // credentials: "same-origin", // ถ้ามี auth cookie ให้เปิดใช้
      });
      clearTimeout(timer);

      const raw = await res.text();
      let json;
      try {
        json = JSON.parse(raw);
      } catch {
        json = { ok: res.ok, raw };
      }

      if (!res.ok || json?.ok === false) {
        throw new Error(
          json?.error || `save-failed (${res.status})`
        );
      }

      // ✅ เก็บข้อมูลชีต/แท็บ/แถวที่ถูกเขียนจริง (มาจาก GAS: ssUrl, ssId, sheet, row, build)
      setSaveInfo({
        ssUrl: json.ssUrl || "",
        ssId: json.ssId || "",
        sheet: json.sheet || "",
        row: json.row || 0,
        build: json.build || "",
      });

      // ✅ ข้อความสำเร็จ + แนบลิงก์ให้กดเปิดชีตได้ทันที
      const hint = json?.ssUrl
        ? ` (เปิดชีตจริงได้จากลิงก์ด้านล่าง)`
        : "";
      setMsg({ text: "บันทึกสำเร็จ" + hint, ok: true });

      // reset ฟอร์ม (คง package เดิม)
      setForm({ ...emptyForm, package: form.package });
      setDiscountValue("");
      setAddons([{ name: "", qty: 1, price: 0 }]);
      setSprayDates(getDefaultSprayDates(form.package)); // ✅ reset ตามแพ็กเกจ
      resetBaitByPackage(form.package);
    } catch (err2) {
      const hint =
        err2?.name === "AbortError"
          ? "คำขอหมดเวลา (timeout)"
          : err2?.message || err2;
      setMsg({
        text: `บันทึกไม่สำเร็จ (POST ${API_URL}) : ${hint}`,
        ok: false,
      });
      setSaveInfo(null);
    } finally {
      setLoading(false);
    }
  };

  /* -------------------- UI -------------------- */
  const pkgOptions = [
    "pipe3993",
    "bait5500_in",
    "bait5500_out",
    "bait5500_both",
    "combo8500",
  ];

  // ปุ่มเพิ่ม/ลด รอบบริการ
  const addSpray = () =>
    setSprayDates((arr) =>
      arr.length >= SPRAY_MAX ? arr : [...arr, ""]
    );
  const removeSpray = () =>
    setSprayDates((arr) =>
      arr.slice(0, Math.max(0, arr.length - 1))
    );

  const addBaitIn = () => {
    const nextIn = [...baitInDates, ""];
    const [inFixed, outFixed] = clampBait(nextIn, baitOutDates);
    setBaitInDates(inFixed);
    setBaitOutDates(outFixed);
  };
  const removeBaitIn = () =>
    setBaitInDates((a) =>
      a.slice(0, Math.max(0, a.length - 1))
    );

  const addBaitOut = () => {
    const nextOut = [...baitOutDates, ""];
    const [inFixed, outFixed] = clampBait(baitInDates, nextOut);
    setBaitInDates(inFixed);
    setBaitOutDates(outFixed);
  };
  const removeBaitOut = () =>
    setBaitOutDates((a) =>
      a.slice(0, Math.max(0, a.length - 1))
    );

  return (
    <div className="cf">
      <div className="cf__card">
        <div className="cf__chip">
          ฟอร์มสัญญา (Lite)
        </div>
        <h2 className="cf__title">
          บันทึกสัญญาลูกค้า + สร้าง PDF
        </h2>
        <p className="cf__subtitle">
          ตั้งฐานราคาจากแพ็กเกจ → เพิ่ม/ลดรอบบริการ → ใส่ส่วนลด/แอดออนได้ทันที
        </p>

        {/* ปุ่ม PDF ด้านบน */}
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCreateReceiptPDF}
          >
            สร้างใบเสร็จ (PDF)
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleCreateContractPDFOnly}
          >
            สร้างสัญญา (PDF)
          </button>
        </div>

        <form
          onSubmit={handleSubmitAndSave}
          className="cf__form"
        >
          {/* แพ็กเกจ + วันเริ่ม/สิ้นสุด */}
          <div className="cf__grid">
            <div className="cf__field">
              <label className="cf__label">แพ็กเกจ</label>
              <select
                className="cf__select"
                value={form.package}
                onChange={(e) =>
                  setVal("package", e.target.value)
                }
              >
                {pkgOptions.map((k) => (
                  <option key={k} value={k}>
                    {pkgLabel(k)}
                  </option>
                ))}
              </select>
              <div className="cf-hint">
                ราคาพื้นฐาน:{" "}
                <b>{priceText(baseServicePrice)}</b> บาท
              </div>
            </div>

            <div className="cf__field">
              <label className="cf__label">
                วันที่เริ่มสัญญา
              </label>
              <input
                type="date"
                className="cf__input"
                value={form.startDate}
                onChange={(e) =>
                  setVal("startDate", e.target.value)
                }
              />
            </div>

            <div className="cf__field">
              <label className="cf__label">
                วันสิ้นสุดสัญญา (+1 ปีอัตโนมัติ)
              </label>
              <input
                type="date"
                className="cf__input"
                value={form.endDate}
                onChange={(e) =>
                  setVal("endDate", e.target.value)
                }
              />
            </div>
          </div>

          <div
            className="cf-toolbar"
            style={{ marginTop: 12 }}
          >
            <div className="cf-toolbar__left">
              <button
                type="button"
                className="btn"
                onClick={fillScheduleByPackage}
              >
                เติมตารางอัตโนมัติจากแพ็กเกจ
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setSprayDates(getDefaultSprayDates(form.package)); // ✅ ล้างตามสูตร
                  resetBaitByPackage(form.package);
                }}
              >
                ล้างตาราง
              </button>
            </div>
            <div className="cf-toolbar__right">
              <span className="cf-chip">
                เริ่ม {form.startDate || "-"}
              </span>
              <span className="cf-chip cf-chip--muted">
                สิ้นสุด {form.endDate || "-"}
              </span>
            </div>
          </div>

          {/* ตารางบริการ */}
          <fieldset className="cf__fieldset">
            <legend className="cf__legend">
              กำหนดการบริการ
            </legend>

            {/* Spray */}
            <div className="cf-panel">
              <div className="cf-panel__header">
                <h4 className="cf-group-title">
                  Spray (สูงสุด {SPRAY_MAX})
                </h4>
                <div className="cf-actions-inline">
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={removeSpray}
                    disabled={sprayDates.length === 0}
                  >
                    – ลด
                  </button>
                  <div style={{ padding: "0 8px" }}>
                    ใช้จริง: {sprayDates.length}/{SPRAY_MAX}
                  </div>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={addSpray}
                    disabled={sprayDates.length >= SPRAY_MAX}
                  >
                    + เพิ่ม
                  </button>
                </div>
              </div>

              {sprayDates.length === 0 ? (
                <div className="cf-empty">
                  ยังไม่มีรอบ Spray
                </div>
              ) : (
                <div className="service-grid">
                  {sprayDates.map((d, i) => (
                    <div
                      className="round"
                      key={`spr-${i}`}
                    >
                      <div className="round__badge">
                        #{i + 1}
                      </div>
                      <label className="cf__label">
                        Spray รอบที่ {i + 1}
                      </label>
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

            {/* Bait Inside */}
            <div
              className="cf-panel"
              style={{ marginTop: 16 }}
            >
              <div className="cf-panel__header">
                <h4 className="cf-group-title">
                  Bait – ภายใน (สูงสุดรวม 12)
                </h4>
                <div className="cf-actions-inline">
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={removeBaitIn}
                    disabled={baitInDates.length === 0}
                  >
                    – ลด
                  </button>
                  <div style={{ padding: "0 8px" }}>
                    ใช้จริง: {baitInDates.length}
                  </div>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={addBaitIn}
                    disabled={
                      baitInDates.length +
                        baitOutDates.length >=
                      BAIT_MAX
                    }
                  >
                    + เพิ่ม
                  </button>
                </div>
              </div>

              {baitInDates.length === 0 ? (
                <div className="cf-empty">
                  ยังไม่มีรอบ Bait (ภายใน)
                </div>
              ) : (
                <div className="service-grid">
                  {baitInDates.map((d, i) => (
                    <div
                      className="round"
                      key={`baitIn-${i}`}
                    >
                      <div className="round__badge">
                        #{i + 1}
                      </div>
                      <label className="cf__label">
                        Bait (ภายใน) รอบที่ {i + 1}
                      </label>
                      <input
                        type="date"
                        className="cf__input"
                        value={d || ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setBaitInDates((arr) => {
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

            {/* Bait Outside */}
            <div
              className="cf-panel"
              style={{ marginTop: 16 }}
            >
              <div className="cf-panel__header">
                <h4 className="cf-group-title">
                  Bait – ภายนอก (สูงสุดรวม 12)
                </h4>
                <div className="cf-actions-inline">
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={removeBaitOut}
                    disabled={baitOutDates.length === 0}
                  >
                    – ลด
                  </button>
                  <div style={{ padding: "0 8px" }}>
                    ใช้จริง: {baitOutDates.length}
                  </div>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={addBaitOut}
                    disabled={
                      baitInDates.length +
                        baitOutDates.length >=
                      BAIT_MAX
                    }
                  >
                    + เพิ่ม
                  </button>
                </div>
              </div>

              {baitOutDates.length === 0 ? (
                <div className="cf-empty">
                  ยังไม่มีรอบ Bait (ภายนอก)
                </div>
              ) : (
                <div className="service-grid">
                  {baitOutDates.map((d, i) => (
                    <div
                      className="round"
                      key={`baitOut-${i}`}
                    >
                      <div className="round__badge">
                        #{i + 1}
                      </div>
                      <label className="cf__label">
                        Bait (ภายนอก) รอบที่ {i + 1}
                      </label>
                      <input
                        type="date"
                        className="cf__input"
                        value={d || ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setBaitOutDates((arr) => {
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
          <section
            className="cf-section"
            style={{ marginTop: 12 }}
          >
            <div
              className="cf-field"
              style={{ maxWidth: 360 }}
            >
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
                    if (s === "") setDiscountValue("");
                    else
                      setDiscountValue(
                        String(
                          Math.max(
                            0,
                            Number(s) || 0
                          )
                        )
                      );
                  }}
                  onWheel={(e) =>
                    e.currentTarget.blur()
                  }
                />
                <span className="cf-unit">บาท</span>
              </div>
            </div>
          </section>

          <div className="section">
            <h3>ค่าบริการเพิ่มเติม (Add-on)</h3>
            {addons.map((row, i) => (
              <div
                key={i}
                className="addon-row"
              >
                <input
                  type="text"
                  placeholder="ชื่อรายการ"
                  value={row.name}
                  onChange={(e) =>
                    setAddons((prev) => {
                      const next = [...prev];
                      next[i] = {
                        ...next[i],
                        name: e.target.value,
                      };
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
                      next[i] = {
                        ...next[i],
                        qty: Number(
                          e.target.value || 0
                        ),
                      };
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
                      next[i] = {
                        ...next[i],
                        price: Number(
                          e.target.value || 0
                        ),
                      };
                      return next;
                    })
                  }
                />
                <div className="addon-amount">
                  {(
                    Number(row.qty || 0) *
                    Number(row.price || 0)
                  ).toLocaleString()}
                </div>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() =>
                    setAddons((prev) =>
                      prev.filter(
                        (_, idx) => idx !== i
                      )
                    )
                  }
                >
                  ลบ
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-add"
              onClick={() =>
                setAddons((prev) => [
                  ...prev,
                  { name: "", qty: 1, price: 0 },
                ])
              }
            >
              ➕ เพิ่ม Add-on
            </button>

            <div className="totals">
              <div>
                ยอดบริการหลัก:{" "}
                <b>{itemsSubtotal.toLocaleString()}</b>
              </div>
              <div>
                ส่วนลด:{" "}
                <b>
                  -{discountNum.toLocaleString()}
                </b>
              </div>
              <div>
                ค่าบริการเพิ่มเติม (Add-on):{" "}
                <b>
                  +
                  {addonsSubtotal.toLocaleString()}
                </b>
              </div>
              <hr />
              <div className="total-line">
                ราคาก่อนภาษี:{" "}
                <b>
                  {(
                    Math.round(
                      (netBeforeVat +
                        Number.EPSILON) *
                        100
                    ) / 100
                  ).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </b>
              </div>

              <label
                className="cf__checkbox"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                <input
                  type="checkbox"
                  checked={receiptVatEnabled}
                  onChange={(e) =>
                    setReceiptVatEnabled(
                      e.target.checked
                    )
                  }
                />
                คิดภาษีมูลค่าเพิ่ม (VAT) 7% สำหรับ “ใบเสร็จ” ใบนี้
              </label>

              {receiptVatEnabled && (
                <div style={{ marginTop: 6 }}>
                  ภาษีมูลค่าเพิ่ม 7%:{" "}
                  <b>
                    {receiptVatAmount.toLocaleString(
                      undefined,
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }
                    )}
                  </b>
                </div>
              )}

              <div
                className="total-line"
                style={{ marginTop: 6 }}
              >
                ยอดรวมสุทธิ (ใบเสร็จ):{" "}
                <b>
                  {receiptGrandTotal.toLocaleString(
                    undefined,
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }
                  )}
                </b>
              </div>
            </div>
          </div>

          {/* ข้อมูลลูกค้า */}
          <div className="cf__grid">
            <div className="cf__field">
              <label className="cf__label">
                ชื่อลูกค้า
              </label>
              <input
                className="cf__input"
                value={form.name}
                onChange={(e) =>
                  setVal("name", e.target.value)
                }
              />
            </div>
            <div className="cf__field">
              <label className="cf__label">
                Facebook/Line
              </label>
              <input
                className="cf__input"
                value={form.facebook}
                onChange={(e) =>
                  setVal("facebook", e.target.value)
                }
              />
            </div>
            <div
              className="cf__field"
              style={{ gridColumn: "1 / -1" }}
            >
              <label className="cf__label">
                ที่อยู่
              </label>
              <input
                className="cf__input"
                value={form.address}
                onChange={(e) =>
                  setVal("address", e.target.value)
                }
              />
            </div>
            <div className="cf__field">
              <label className="cf__label">
                เลขประจำตัวผู้เสียภาษี
              </label>
              <input
                className="cf__input"
                placeholder="13 หลัก (ถ้ามี)"
                inputMode="numeric"
                value={form.taxId}
                onChange={(e) =>
                  setVal(
                    "taxId",
                    taxIdDigits(e.target.value)
                  )
                }
              />
            </div>
            <div className="cf__field">
              <label className="cf__label">
                เบอร์โทร
              </label>
              <input
                className="cf__input"
                value={form.phone}
                onChange={(e) =>
                  setVal("phone", e.target.value)
                }
                placeholder="0xx-xxx-xxxx"
              />
            </div>
            <div className="cf__field">
              <label className="cf__label">
                ผู้รับผิดชอบในการติดต่อลูกค้า
              </label>
              <input
                className="cf__input"
                value={form.tech}
                onChange={(e) =>
                  setVal("tech", e.target.value)
                }
              />
            </div>
          </div>

          {/* หมายเหตุ + สถานะ */}
          <div
            className="cf__field"
            style={{ marginTop: 12 }}
          >
            <label className="cf__label">
              หมายเหตุ
            </label>
            <textarea
              className="cf__textarea"
              value={form.note}
              onChange={(e) =>
                setVal("note", e.target.value)
              }
            />
          </div>
          <div
            className="cf__field"
            style={{ marginTop: 8 }}
          >
            <label className="cf__label">
              สถานะ
            </label>
            <select
              className="cf__select"
              value={form.status}
              onChange={(e) =>
                setVal("status", e.target.value)
              }
            >
              <option>ใช้งานอยู่</option>
              <option>หมดอายุ</option>
            </select>
          </div>

          {/* Actions */}
          <div className="cf__actions">
            <button
              type="submit"
              className="cf__btn cf__btn--primary"
              disabled={loading}
            >
              {loading
                ? "กำลังบันทึก..."
                : "บันทึกข้อมูลสัญญา"}
            </button>
            <button
              type="button"
              className="cf__btn"
              onClick={handleCreateContractPDFOnly}
            >
              ดาวน์โหลดสัญญา (PDF)
            </button>
            <button
              type="button"
              className="cf__btn cf__btn--ghost"
              onClick={() => {
                setForm({
                  ...emptyForm,
                  package: form.package,
                });
                setDiscountValue("");
                setAddons([
                  { name: "", qty: 1, price: 0 },
                ]);
                setSprayDates(getDefaultSprayDates(form.package)); // ✅ reset ตามสูตร
                resetBaitByPackage(form.package);
              }}
            >
              ล้างฟอร์ม
            </button>
          </div>

          {msg.text && (
            <p
              className={`cf__msg ${
                msg.ok ? "cf__msg--ok" : "cf__msg--err"
              }`}
            >
              {msg.text}
            </p>
          )}
          {saveInfo?.ssUrl && (
            <div
              className="cf__debug"
              style={{ marginTop: 8 }}
            >
              <div>
                ✅ เขียนลงแท็บ:{" "}
                <b>{saveInfo.sheet || "-"}</b> แถวที่:{" "}
                <b>{saveInfo.row || "-"}</b>
              </div>
              <div style={{ marginTop: 4 }}>
                <a
                  href={saveInfo.ssUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cf__link"
                >
                  เปิดชีตที่ถูกเขียนจริง
                </a>
                {saveInfo.build && (
                  <span
                    className="cf-chip cf-chip--muted"
                    style={{ marginLeft: 8 }}
                  >
                    build: {saveInfo.build}
                  </span>
                )}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
