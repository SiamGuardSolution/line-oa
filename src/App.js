// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import liff from "@line/liff";

import "./App.css";
import ContractForm from "./ContractForm";
import CheckPage from "./CheckPage";
import PayPage from "./PayPage";
import ServiceReportPage from "./ServiceReportPage.jsx";


/** ---------- DEV BYPASS (เปิดโหมด mock ด้วย ?mock=1 หรือ .env: REACT_APP_BYPASS_LINE=1) ---------- */
function computeDevBypass() {
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const isDev = process.env.NODE_ENV === "development";
  const qs = new URLSearchParams(window.location.search);

  // toggle ผ่าน query
  if (qs.get("mock") === "1") sessionStorage.setItem("mock", "1");
  if (qs.get("mock") === "0") sessionStorage.removeItem("mock");

  const isMock =
    sessionStorage.getItem("mock") === "1" ||
    process.env.REACT_APP_BYPASS_LINE === "1";

  return isLocal && isDev && isMock;
}
const DEV_BYPASS = computeDevBypass();
/** ----------------------------------------------------------------------------------------------- */

export default function App() {
  const [authReady, setAuthReady] = React.useState(false); // พร้อมเรนเดอร์หรือยัง
  const [isLoggedIn, setIsLoggedIn] = React.useState(false); // สถานะล็อกอิน (โฮมเพจเท่านั้น)

  React.useEffect(() => {
    // <-- เปลี่ยนจาก isCheckPage เป็น isPublic ครอบทั้ง /check และ /pay
    const path = window.location.pathname;
    const isPublic = ["/check", "/pay", "/reports"].some((p) => path.startsWith(p));

    // 1) โหมด Dev Bypass: ไม่เรียก LIFF เลย
    if (DEV_BYPASS) {
      setIsLoggedIn(true);
      setAuthReady(true);
      return;
    }

    // 2) หน้า public ไม่บังคับล็อกอิน
    if (isPublic) {
      setAuthReady(true);
      return;
    }

    // 3) หน้าอื่น ๆ ใช้ LIFF ปกติ
    (async () => {
      try {
        await liff.init({
          liffId: "2007877821-aLyD9LO7",
          withLoginOnExternalBrowser: true,
        });

        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return; // จะ redirect ไปหน้า login ของ LINE
        }

        setIsLoggedIn(true);
      } catch (err) {
        console.warn("LIFF init error:", err);
        // ถ้าต้องการให้เข้าต่อได้แม้ LIFF พัง ให้ปลดคอมเมนต์บรรทัดถัดไป
        // setIsLoggedIn(true);
      } finally {
        setAuthReady(true);
      }
    })();
  }, []);

  // ระหว่างรอ init เท่านั้น แสดงข้อความโหลด
  if (!authReady) {
    return (
      <div style={{ textAlign: "center", marginTop: 50 }}>
        <p>กำลังเข้าสู่ระบบผ่าน LINE...</p>
      </div>
    );
  }

  return (
    <>
      {/* แถบแจ้งโหมด DEV */}
      {DEV_BYPASS && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            padding: "8px 12px",
            background: "#111",
            color: "#fff",
            zIndex: 9999,
          }}
        >
          DEV MOCK MODE – ข้าม LINE Login แล้ว
          <button
            onClick={() => {
              sessionStorage.removeItem("mock");
              window.location.href = "/?mock=0";
            }}
            style={{ marginLeft: 12 }}
          >
            ออกจากโหมดนี้
          </button>
        </div>
      )}

      <div style={{ marginTop: DEV_BYPASS ? 44 : 0 }} />

      <Router>
        <Routes>
          {/* public */}
          <Route path="/check" element={<CheckPage />} />
          <Route path="/pay" element={<PayPage />} />
          <Route path="/reports" element={<ServiceReportPage />} />            {/* รายการรวม (ถ้ามี) */}
          <Route path="/reports/:serviceId" element={<ServiceReportPage />} /> {/* ใหม่ */}
          <Route path="/report-view/:serviceId" element={<ServiceReportPage />} /> {/* เดิม */}

          {/* require LINE login */}
          <Route
            path="/"
            element={
              isLoggedIn ? (
                <ContractForm />
              ) : (
                <div style={{ textAlign: "center", marginTop: 50 }}>
                  <p>กรุณาเข้าสู่ระบบผ่าน LINE</p>
                </div>
              )
            }
          />
        </Routes>
      </Router>
    </>
  );
}
