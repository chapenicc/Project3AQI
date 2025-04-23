// predic.js
import { firestore } from './firebase.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

// ฟอร์แมตวันที่ “YYYY-MM-DD”
function getLocalDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ฟังก์ชันช่วยดึงข้อมูลพยากรณ์ทั้งหมดจาก Firestore
async function fetchPredictions() {
  const ref     = doc(firestore, "predictions", "next_5_days");
  const snap    = await getDoc(ref);
  return snap.exists() ? snap.data() : {};
}

// ดึงพยากรณ์ของวันพรุ่งนี้ พร้อม rainChance
export async function getTomorrowForecast() {
  const allData = await fetchPredictions();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const key = getLocalDateString(tomorrow);

  const entry = allData[key] ?? null;
  const rainChance = entry?.rainChance ?? null;

  return { date: key, forecast: entry, rainChance };
}

// ดึงพยากรณ์ 5 วันถัดไป พร้อม rainChance
export async function getNext5DaysForecast() {
  const allData = await fetchPredictions();
  const results = [];
  for (let i = 1; i <= 5; i++) {
    const dt = new Date();
    dt.setDate(dt.getDate() + i);
    const key = getLocalDateString(dt);

    const entry = allData[key] ?? null;
    const rainChance = entry?.rainChance ?? null;

    results.push({ date: key, forecast: entry, rainChance });
  }
  return results;
}

// สร้างคำแนะนำจากค่า forecast + rainChance
export function generateAdvice(item) {
  const pm25 = item.forecast?.pm25 ?? 0;
  const rain = item.rainChance ?? 0;
  let advice = "";

  if (pm25 >= 100)      advice += "ฝุ่นเยอะมาก ใส่แมสก์ด้วยนะ<br>";
  else if (pm25 >= 50)  advice += "มีฝุ่นพอควร แนะนำให้ใส่แมสก์<br>";
  else                  advice += "อากาศดี ฝุ่นน้อย<br>";

  if (rain >= 70)       advice += "ฝนตกหนักแน่ พกร่มด้วย!";
  else if (rain >= 40)  advice += "อาจมีฝนตก พกร่มไว้ก็ดี";
  else                  advice += "ไม่น่ามีฝน ออกไปข้างนอกได้สบาย~";

  return advice;
}