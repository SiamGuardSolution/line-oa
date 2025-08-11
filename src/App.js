import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import liff from '@line/liff';
import ContractForm from './ContractForm';
import CheckPage from './CheckPage';

console.log('✅ ServiceRecordForm loaded:', typeof ServiceRecordForm);

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    liff.init({ liffId: '2007877821-aLyD9LO7' })
      .then(() => {
        if (!liff.isLoggedIn()) {
          liff.login(); // พาไป Login ถ้ายังไม่ได้ login
        } else {
          setIsLoggedIn(true); // login แล้ว
        }
      })
      .catch(err => {
        console.error('LIFF init error', err);
      });
  }, []);

  if (!isLoggedIn) {
   return (
      <div style={{ textAlign: 'center', marginTop: '50px' }}>
        <p>กำลังเข้าสู่ระบบผ่าน LINE...</p>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<ContractForm />} />
        <Route path="/check" element={<CheckPage />} />
      </Routes>
    </Router>
  );
}

export default App;
