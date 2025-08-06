import React, { useEffect, useState } from 'react';
import liff from '@line/liff';
import ContractForm from './ContractForm';

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

  return (
    <div>
      {isLoggedIn ? <ContractForm /> : <p>กำลังเข้าสู่ระบบผ่าน LINE...</p>}
    </div>
  );
}

export default App;
