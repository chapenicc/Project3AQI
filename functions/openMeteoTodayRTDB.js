// functions/openMeteoTodayRTDB.js

const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

// โหลด service account key ของคุณ
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // แก้เป็น URL ของ Realtime Database โปรเจกต์คุณ
  databaseURL: 'https://air-qulity-in-u-default-rtdb.asia-southeast1.firebasedatabase.app/'
});

const rtdb = admin.database();

const LAT = 13.85527;
const LON = 100.58532;

/** ดึง rain probability ของวันนี้จาก Open‑Meteo */
async function fetchTodayRain() {
  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${LAT}&longitude=${LON}` +
    `&daily=precipitation_probability_max` +
    `&start_date=${dateStr}&end_date=${dateStr}` +
    `&timezone=Asia%2FBangkok`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo API error: ${res.status}`);
  const data = await res.json();

  console.log('🔍 Open-Meteo raw daily:', data.daily);
  const rainArr = data.daily.precipitation_probability_max || [];
  const rainChance = rainArr[0] != null
    ? Math.round(rainArr[0])
    : 0;

  return { date: dateStr, rainChance };
}

/** เขียน rainChance วันนี้ลง RTDB */
async function updateTodayToRTDB(timeLabel) {
  try {
    console.log(`▶ [${timeLabel}] Fetching rainChance…`);
    const { date, rainChance } = await fetchTodayRain();
    const path = `/realtime/rainChance`;

    console.log(`▶ Writing to RTDB at ${path}:`, rainChance);
    await rtdb.ref(path).set({
      rainChance,
      updatedAt: admin.database.ServerValue.TIMESTAMP
    });
    console.log('✅ RTDB write successful');
  } catch (err) {
    console.error('❌ Error in updateTodayToRTDB:', err);
  }
}

// Scheduler: เรียกทุกเช้า 06:00 (Asia/Bangkok)
exports.syncTodayRain = onSchedule(
  'every day 06:00',
  { timeZone: 'Asia/Bangkok' },
  () => updateTodayToRTDB('06:00')
);
