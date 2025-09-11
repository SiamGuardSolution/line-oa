// src/PayPage.js (เวอร์ชันเอาอัปโหลดสลิปออก + แจ้งทาง LINE)
import React, { useEffect, useState } from "react";

// ====== ตั้งค่าบริษัท/บัญชี (แก้ให้เป็นของจริง) ======
const BANK = {
  bankName: "กสิกรไทย (KBank)",
  accountName: "บจก. สยามการ์ด โซลูชั่น (ประเทศไทย)",
  accountNumber: "2018860778",        // <- เลขบัญชีธนาคาร
  promptpayId: "",                     // <- เบอร์/เลข PromptPay (เว้นว่างได้)
};

// ====== ตั้งค่า LINE OA ======
const LINE_OA_ID = "@siamguard";       // <- ใส่ LINE Official Account ID ของคุณ
const LINE_CHAT_URL = `https://line.me/R/ti/p/${encodeURIComponent(LINE_OA_ID)}`;

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
  const [qrDataUrl, setQrDataUrl] = useState("");

  // สร้าง QR พร้อมเพย์ (ถ้ากำหนด promptpayId)
  useEffect(() => {
    async function genQR() {
      if (!BANK.promptpayId) return;
      try {
        const { default: generatePayload } = await import("promptpay-qr");
        const { default: QRCode } = await import("qrcode");
        const amountNum = amt ? Number(amt) : undefined; // ไม่ใส่จำนวนได้
        const payload = generatePayload(BANK.promptpayId, { amount: amountNum });
        const url = await QRCode.toDataURL(payload);
        setQrDataUrl(url);
      } catch (e) {
        console.error("QR error:", e);
      }
    }
    genQR();
  }, [amt]);

  // ข้อความที่ให้ลูกค้า “ส่งใน LINE” (prefill)
  const buildLineMessage = () => {
    const lines = [
      "แจ้งชำระเงินผ่านบัญชีธนาคาร",
      ref ? `อ้างอิง: ${ref}` : "",
      amt ? `ยอดชำระ: ${baht(amt)} (${amt} บาท)` : "",
      payerName ? `ชื่อผู้โอน: ${payerName}` : "",
      phone ? `เบอร์โทร: ${phone}` : "",
    ].filter(Boolean);
    return lines.join("\n");
  };

  // เปิด LINE พร้อมข้อความ (บนมือถือเวิร์กที่สุด / desktop จะเปิดเว็บ LINE)
  const openLineWithText = () => {
    window.open(LINE_CHAT_URL, "_blank");
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.h1}>ชำระเงินผ่านบัญชีธนาคาร</h1>

        {/* ข้อมูลบัญชี */}
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
            <button onClick={() => copyText(BANK.accountNumber)} style={styles.copyBtn}>
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

        {/* PromptPay (ถ้ามี) */}
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
              * หากระบุพารามิเตอร์ ?amt= ในลิงก์ หน้านี้จะฝังจำนวนเงินให้ใน QR อัตโนมัติ
            </div>
          </div>
        )}

        {/* แบบฟอร์มสำหรับสร้าง "ข้อความแจ้งชำระ" เพื่อส่งใน LINE */}
        <div style={styles.section}>
          <div style={{ marginBottom: 10, fontWeight: 700 }}>แจ้งชำระผ่าน LINE</div>

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

          {/* ปุ่มการใช้งาน LINE */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
            <button
              type="button"
              onClick={openLineWithText}
              style={{ ...styles.primaryBtn, background: "#06c755" }}
              title="เปิดแชท LINE กับแอดมิน"
            >
              เปิด LINE เพื่อส่งสลิป
            </button>
            <button
              type="button"
              onClick={() => copyText(buildLineMessage())}
              style={styles.secondaryBtn}
              title="คัดลอกข้อความแจ้งชำระ"
            >
              คัดลอกข้อความแจ้งชำระ
            </button>
          </div>

          {/* ลิงก์สำรองไปหน้าแชท OA */}
          <div style={{ marginTop: 10 }}>
            <a href={LINE_CHAT_URL} target="_blank" rel="noreferrer" style={styles.link}>
              หรือกดเพื่อเปิดแชท LINE OA: {LINE_OA_ID}
            </a>
          </div>

          <div style={{ fontSize: 12, color: "#64748b", marginTop: 8, lineHeight: 1.5 }}>
            * ระบบนี้ย้ายไปยืนยันการชำระผ่าน LINE แล้ว —
            ลูกค้าสามารถ “ส่งสลิปและข้อความแจ้งชำระ” ให้แอดมินตรวจสอบในแชท LINE ได้เลย
          </div>
        </div>

        <div style={{ fontSize: 12, color: "#999", marginTop: 10 }}>
          ปัญหาใช้งานติดต่อไลน์ {LINE_OA_ID} หรือโทร 02-000-0000
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
    boxShadow: "0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(2,6,23,.06)",
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
  primaryBtn: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    background: "#2563eb",
    color: "#fff",
    fontWeight: 700,
    border: "none",
    cursor: "pointer",
  },
  secondaryBtn: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    background: "#fff",
    color: "#0f172a",
    fontWeight: 700,
    border: "1px solid #e5e7eb",
    cursor: "pointer",
  },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  link: { color: "#2563eb", textDecoration: "underline" },
};
