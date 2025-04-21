// functions/index.js

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

admin.initializeApp();
const db = admin.firestore();

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || 'e5d06f804986aee2b7fbef62dd81435d';
const LAT = 13.85527;
const LON = 100.58532;

async function fetchRainChance() {
  const url =
    `https://api.openweathermap.org/data/2.5/onecall?` +
    `lat=${LAT}&lon=${LON}` +
    `&exclude=minutely,daily,alerts` +
    `&appid=${OPENWEATHER_API_KEY}` +
    `&units=metric`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenWeather API error: ${res.status}`);
  const json = await res.json();
  const pop = json.hourly?.[0]?.pop ?? 0;
  return Math.round(pop * 100);
}

// 1) Trigger เมื่อมี doc ใหม่
exports.onNewSensorData = onDocumentCreated(
  'sensor_data/{docId}',
  async (event) => {
    const snap = event.data;
    const chance = await fetchRainChance();
    console.log(`▶ [onCreate] Set rainChance=${chance}% for ${snap.ref.path}`);
    return snap.ref.update({ rainChance: chance });
  }
);

// 2) Scheduled “backfill” ทุกวันตี 1:05 เช็ค doc ที่ยังไม่มี rainChance แล้วอัปเดต
exports.backfillRainChance = onSchedule(
  'every day 01:05',
  { timeZone: 'Asia/Bangkok' },
  async () => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    const snapshot = await db.collection('sensor_data').get();

    const batch = db.batch();
    let updated = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      // ถ้ายังไม่มี field rainChance หรือเป็น null
      if (data.rainChance == null) {
        const chance = await fetchRainChance();
        batch.update(doc.ref, { rainChance: chance });
        updated++;
      }
    }

    if (updated > 0) {
      await batch.commit();
      console.log(`✅ Backfilled ${updated} documents up to ${today}`);
    } else {
      console.log(`ℹ️ No documents to backfill for ${today}`);
    }
  }
);
