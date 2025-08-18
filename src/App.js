// src/App.js
import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import liff from "@line/liff";
import ContractForm from "./ContractForm";
import CheckPage from "./CheckPage";

export default function App() {
  const [authReady, setAuthReady] = useState(false); // พร้อมเรนเดอร์หรือยัง
  const [isLoggedIn, setIsLoggedIn] = useState(false); // สถานะ LIFF (เฉพาะหน้าที่บังคับ)

  useEffect(() => {
    const isCheckPage = window.location.pathname.startsWith("/check");

    // หน้าตรวจสอบสัญญา: ไม่ต้องบังคับ LIFF
    if (isCheckPage) {
      setAuthReady(true);
      return;
    }

    // หน้าอื่น ๆ: ใช้ LIFF ตามเดิม
    (async () => {
      try {
        await liff.init({ liffId: "2007877821-aLyD9LO7", withLoginOnExternalBrowser: true });
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return; // จะ redirect ไป login
        }
        setIsLoggedIn(true);
      } catch (err) {
        console.warn("LIFF init error:", err);
        // ถ้าอยากให้เข้าใช้งานต่อได้แม้ LIFF พัง ให้ setIsLoggedIn(true)
        // setIsLoggedIn(true);
      } finally {
        setAuthReady(true);
      }
    })();
  }, []);

  // ระหว่างรอ init เท่านั้นค่อยขึ้นข้อความโหลด
  if (!authReady) {
    return (
      <div style={{ textAlign: "center", marginTop: 50 }}>
        <p>กำลังเข้าสู่ระบบผ่าน LINE...</p>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* /check ไม่ต้องล็อกอิน */}
        <Route path="/check" element={<CheckPage />} />

        {/* หน้าอื่นต้องล็อกอินผ่าน LINE */}
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
  );
}
