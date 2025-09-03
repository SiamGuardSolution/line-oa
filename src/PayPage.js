// src/PayPage.js ที่ใช้ในปัจจุบัน
import React, { useEffect, useState } from "react";

// ====== ตั้งค่าบริษัท/บัญชี (แก้ให้เป็นของจริง) ======
const BANK = {
  bankName: "กสิกรไทย (KBank)",
  accountName: "บจก. สยามการ์ด โซลูชั่น (ประเทศไทย)",
  accountNumber: "2018860778",       // <- เลขบัญชีธนาคาร
  promptpayId: "",            // <- เบอร์/เลข PromptPay (เว้นว่างได้)
};

// ====== ตั้งค่าปลายทางรับสลิป (Apps Script Web App) ======
const PAYMENT_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxti7VyIYTDO3RR41bVmfQ7h5WZZZjy69r0KYYSEZyxRR7mvyCHbZGqacxnNM2tBBKYzw/exec"; // แก้เป็นของจริง

// แนะนำเก็บใน .env แล้วอ้างผ่านตัวแปรแวดล้อม
const PAYMENT_SECRET = process.env.REACT_APP_PAYMENT_SECRET || "MbJS5BkxZl8Yf253ayib8LDpLMAZpnrjqNubRhWrouu6b";


// ====== util ======
const baht = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(
    Number(n || 0)
  );

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    alert("คัดลอกแล้ว");
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    alert("คัดลอกแล้ว");
  }
};

export default function PayPage() {
  // รับค่า ref และ amt จาก query string
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref") || "";
  const amt = params.get("amt") || "";

  const [payerName, setPayerName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState(ref ? `ชำระค่าอ้างอิง ${ref}` : "");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  // สร้าง QR พร้อมเพย์ (ถ้ากำหนด promptpayId)
  useEffect(() => {
    async function genQR() {
      if (!BANK.promptpayId) return;
      try {
        const { default: generatePayload } = await import("promptpay-qr");
        const { default: QRCode } = await import("qrcode");
        const amountNum = amt ? Number(amt) : undefined; // ไม่ใส่จำนวนได้
        const payload = generatePayload(BANK.promptpayId, {
          amount: amountNum,
        });
        const url = await QRCode.toDataURL(payload);
        setQrDataUrl(url);
      } catch (e) {
        console.error("QR error:", e);
      }
    }
    genQR();
  }, [amt]);

  const MAX_FILE_MB = 8;
  const ALLOW_TYPES = ["image/png","image/jpeg","image/webp","application/pdf"];

  // แสดงตัวอย่างสลิป
  const onChooseFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      alert(`ไฟล์ใหญ่เกิน ${MAX_FILE_MB}MB`);
      return;
    }
    if (!ALLOW_TYPES.includes(f.type)) {
      alert("รองรับเฉพาะ PNG/JPG/WEBP/PDF");
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result?.toString() || "");
    reader.readAsDataURL(f);
  };

  // อัปโหลดสลิป
  const submit = async (e) => {
    e.preventDefault();
    if (!file) {
      alert("โปรดเลือกไฟล์สลิปก่อน");
      return;
    }
    setSubmitting(true);
    try {
      // อ่านไฟล์เป็น base64
      const base64 = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = rej;
        fr.readAsDataURL(file); // data:image/...;base64,XXXX
      });

      const payload = {
        action: "uploadSlip",
        secret: PAYMENT_SECRET,
        ref,                  // หมายเลขอ้างอิง/เลขสัญญา
        amount: amt || "",    // จำนวนเงิน
        payerName,
        phone,
        note,
        bankName: BANK.bankName,
        accountName: BANK.accountName,
        accountNumber: BANK.accountNumber,
        promptpayId: BANK.promptpayId || "",
        fileName: file.name,
        fileBase64: base64,   // ส่งเป็น base64 ให้ Apps Script แปลงต่อ
        timestamp: new Date().toISOString(),
      };

      const r = await fetch(PAYMENT_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await r.json().catch(() => ({}));
      if (r.ok && data?.ok) {
        alert("อัปโหลดสลิปเรียบร้อย ขอบคุณครับ");
        // reset
        setFile(null);
        setPreviewUrl("");
        console.log("Saved:", data);
      } else {
        console.error("Upload failed:", data);
        alert("อัปโหลดไม่สำเร็จ กรุณาลองใหม่");
      }
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการอัปโหลด");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.h1}>ชำระเงินผ่านบัญชีธนาคาร</h1>

        <div style={styles.section}>
          <div style={styles.rowBetween}>
            <div>
              <div style={styles.label}>ธนาคาร</div>
              <div style={styles.value}>{BANK.bankName}</div>
            </div>
          </div>

          <div style={styles.rowBetween}>
            <div>
              <div style={styles.label}>ชื่อบัญชี</div>
              <div style={styles.value}>{BANK.accountName}</div>
            </div>
          </div>

          <div style={styles.rowBetween}>
            <div>
              <div style={styles.label}>เลขที่บัญชี</div>
              <div style={styles.value}>{BANK.accountNumber}</div>
            </div>
            <button
              onClick={() => copyText(BANK.accountNumber)}
              style={styles.copyBtn}
            >
              คัดลอก
            </button>
          </div>

          {(amt || ref) && (
            <div style={{ marginTop: 12, background: "#f7fafc", padding: 12, borderRadius: 10 }}>
              {amt && (
                <div style={styles.rowBetween}>
                  <div>
                    <div style={styles.label}>จำนวนที่ต้องชำระ</div>
                    <div style={{ ...styles.value, fontWeight: 700 }}>{baht(amt)}</div>
                  </div>
                  <button onClick={() => copyText(amt)} style={styles.copyBtn}>
                    คัดลอกจำนวน
                  </button>
                </div>
              )}
              {ref && (
                <div style={{ marginTop: 8 }}>
                  <div style={styles.label}>อ้างอิง</div>
                  <div style={styles.value}>{ref}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {BANK.promptpayId && (
          <div style={styles.section}>
            <div style={styles.label}>พร้อมเพย์ (PromptPay)</div>
            <div style={styles.value}>ID: {BANK.promptpayId}</div>
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="PromptPay QR"
                style={{ width: 220, height: 220, marginTop: 12 }}
              />
            ) : (
              <div style={{ color: "#666", marginTop: 8 }}>กำลังสร้าง QR…</div>
            )}
            <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
              * QR นี้ฝังจำนวนเงินอัตโนมัติหากระบุ ?amt= ในลิงก์
            </div>
          </div>
        )}

        <form onSubmit={submit} style={styles.section}>
          <div style={styles.label}>อัปโหลดสลิปโอนเงิน</div>

          <div style={styles.grid2}>
            <div>
              <label style={styles.smallLabel}>ชื่อผู้โอน (ออกใบเสร็จ)</label>
              <input
                type="text"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                placeholder="เช่น นายกำจัดปลวก สยามการ์ด"
                style={styles.input}
              />
            </div>

            <div>
              <label style={styles.smallLabel}>เบอร์โทรผู้โอน</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0812345678"
                style={styles.input}
              />
            </div>
          </div>

          <div>
            <label style={styles.smallLabel}>หมายเหตุ</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น ชำระงวดแรก / ค่าอ้างอิง #1234"
              style={styles.input}
            />
          </div>

          <div style={{ marginTop: 10 }}>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={onChooseFile}
              style={styles.file}
            />
            {previewUrl && (
              <img
                src={previewUrl}
                alt="สลิปตัวอย่าง"
                style={{ marginTop: 10, maxWidth: "100%", borderRadius: 10, border: "1px solid #eee" }}
              />
            )}
          </div>

          <button type="submit" disabled={submitting} style={styles.primaryBtn}>
            {submitting ? "กำลังอัปโหลด..." : "ส่งสลิป"}
          </button>
        </form>

        <div style={{ fontSize: 12, color: "#999", marginTop: 10 }}>
          ปัญหาใช้งานติดต่อไลน์ @siamguard หรือโทร 02-000-0000
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: "100vh",
    background: "#f1f5f9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 720,
    background: "#fff",
    borderRadius: 16,
    padding: 20,
    boxShadow:
      "0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(2,6,23,.06)",
  },
  h1: { fontSize: 22, fontWeight: 800, margin: 0, marginBottom: 8 },
  section: {
    marginTop: 16,
    border: "1px solid #eef2f7",
    borderRadius: 12,
    padding: 14,
    background: "#fff",
  },
  rowBetween: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  label: { fontSize: 13, color: "#64748b" },
  smallLabel: { fontSize: 13, color: "#64748b", display: "block", marginBottom: 6 },
  value: { fontSize: 16, color: "#0f172a" },
  copyBtn: {
    border: "1px solid #dbe3f1",
    padding: "6px 10px",
    borderRadius: 8,
    background: "#fff",
    cursor: "pointer",
  },
  input: {
    width: "100%",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "10px 12px",
    outline: "none",
  },
  file: { display: "block" },
  primaryBtn: {
    marginTop: 12,
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    background: "#2563eb",
    color: "#fff",
    fontWeight: 700,
    border: "none",
    cursor: "pointer",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
};
