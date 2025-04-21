const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const averageRTDBtoFirestore = require('./averageRTDBtoFirestore');

admin.initializeApp();
const db = admin.firestore();

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || 'e5d06f804986aee2b7fbef62dd81435d';
const LAT = 13.85527;
const LON = 100.58532;

// ✅ ฟังก์ชันดึง rainChance พร้อม retry
async function fetchRainChance(retry = 3) {
  const url = `https://api.openweathermap.org/data/2.5/onecall?lat=${LAT}&lon=${LON}&exclude=minutely,daily,alerts&appid=${OPENWEATHER_API_KEY}&units=metric`;

  for (let attempt = 1; attempt <= retry; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`API failed with status ${res.status}`);
      const json = await res.json();
      const pop = json.hourly?.[0]?.pop;

      if (typeof pop === 'number') {
        const percent = Math.round(pop * 100);
        console.log(`✅ [RainChance] Attempt ${attempt}: ${percent}%`);
        return percent;
      }
    } catch (err) {
      console.log(`❌ API error: ${err.message}`);
    }

    console.log(`⏳ [RainChance] Attempt ${attempt}: retrying in 1 min...`);
    await new Promise(resolve => setTimeout(resolve, 60000));
  }

  console.log('❌ [RainChance] fallback to 0');
  return 0;
}

// 1) ฟังก์ชันเมื่อมี document ใหม่ใน sensor_data → เพิ่ม rainChance
exports.onNewSensorData = onDocumentCreated('sensor_data/{docId}', async (event) => {
  const snap = event.data;
  const chance = await fetchRainChance();
  console.log(`▶ [onCreate] Set rainChance=${chance}% for ${snap.ref.path}`);
  return snap.ref.update({ rainChance: chance });
});

// 2) ฟังก์ชัน Backfill หากยังไม่มี rainChance ใน document
exports.backfillRainChance = onSchedule('every day 06:00', { timeZone: 'Asia/Bangkok' }, async () => {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const snapshot = await db.collection('sensor_data').get();
  const batch = db.batch();
  let updated = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
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
});

// 3) ฟังก์ชันคำนวณค่าเฉลี่ยจาก RTDB → Firestore ทุกวันตอน 02:00
exports.dailyAverageToFirestore = onSchedule('every day 02:00', { timeZone: 'Asia/Bangkok' }, async () => {
  const today = new Date(new Date().getTime() - (1000 * 60 * 60 * 7));
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const dateStr = yesterday.toISOString().split('T')[0];

  console.log(`🕑 Calculating average for: ${dateStr}`);
  await averageRTDBtoFirestore(dateStr);
});
