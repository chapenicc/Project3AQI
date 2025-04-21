// predic.js
import { firestore } from './firebase.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

// ฟอร์แมตวันที่ให้อยู่ในรูป "YYYY-MM-DD"
function getLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ฟังก์ชัน: ดึงข้อมูลพยากรณ์ของวันพรุ่งนี้
export async function getTomorrowForecast() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const key = getLocalDateString(tomorrow);

  const docRef = doc(firestore, "predictions", "next_5_days");
  const snapshot = await getDoc(docRef);

  if (snapshot.exists()) {
    const data = snapshot.data();
    return { date: key, forecast: data[key] || null };
  } else {
    console.warn("⚠️ ไม่พบ document 'next_5_days'");
    return { date: key, forecast: null };
  }
}

// ฟังก์ชัน: ดึงข้อมูลพยากรณ์ 5 วันถัดไป
export async function getNext5DaysForecast() {
  const docRef = doc(firestore, "predictions", "next_5_days");
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    console.warn("⚠️ ไม่พบ document 'next_5_days'");
    return [];
  }

  const data = snapshot.data();
  const results = [];

  for (let i = 1; i <= 5; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const key = getLocalDateString(date);
    results.push({ date: key, forecast: data[key] || null });
  }

  return results;
}

export function generateAdvice(item) {
    let advice = "";

    if (item.pm25 >= 100) {
        advice += "ฝุ่นเยอะมาก ใส่แมสก์ด้วยนะ<br>";
    } else if (item.pm25 >= 50) {
        advice += "มีฝุ่นพอควร แนะนำให้ใส่แมสก์<br>";
    } else {
        advice += "อากาศดี ฝุ่นน้อย<br>";
    }

    if (item.rainChance >= 70) {
        advice += "ฝนตกหนักแน่ พกร่มด้วย!";
    } else if (item.rainChance >= 40) {
        advice += "อาจมีฝนตก พกร่มไว้ก็ดี";
    } else {
        advice += "ไม่น่ามีฝน ออกไปข้างนอกได้สบาย~";
    }

    return advice;
}