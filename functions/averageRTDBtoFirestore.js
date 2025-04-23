// functions/averageRTDBtoFirestore.js

const admin = require('firebase-admin');
const fetch = require('node-fetch');

// โหลด service account key ของคุณ
const serviceAccount = require('./serviceAccountKey.json');

// — เรียก initializeApp ให้เรียบร้อยก่อนใช้งานทั้ง RTDB และ Firestore —
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://air-qulity-in-u-default-rtdb.asia-southeast1-firebasedatabase.app/'
});

/**
 * ดึง rainChance (optional) 
 * คุณสามารถลดส่วนนี้ออกได้ถ้าไม่ใช้
 */
async function fetchRainChance(retry = 1, delay = 1000) {
  const LAT = 13.85527, LON = 100.58532;
  const API_KEY = process.env.OPENWEATHER_API_KEY || 'e5d06f804986aee2b7fbef62dd81435d';
  const url = `https://api.openweathermap.org/data/2.5/onecall?lat=${LAT}&lon=${LON}&exclude=minutely,daily,alerts&appid=${API_KEY}&units=metric`;

  for (let attempt = 1; attempt <= retry; attempt++) {
    try {
      const res = await fetch(url);
      const json = await res.json();
      const pop = json.hourly?.[1]?.pop;
      if (typeof pop === 'number') {
        return Math.round(pop * 100);
      }
    } catch (e) {
      console.warn(`⚠️ fetchRainChance attempt ${attempt} failed:`, e.message);
    }
    await new Promise(r => setTimeout(r, delay));
  }
  return 0;
}

/**
 * อ่านข้อมูลจาก RTDB แล้วคำนวณเฉลี่ย
 * จากนั้นเขียนลง Firestore ที่ collection 'sensor_data' 
 * และเขียน rainChance เข้าไปใน field ด้วย (ถ้ามี)
 */
async function averageRTDBtoFirestore(dateString) {
  console.log(`🧪 START averageRTDBtoFirestore for ${dateString}`);

  // 1) อ่าน sensor data จาก RTDB
  const rtdbRef = admin.database().ref(`records/${dateString}/sensors`);
  const snapshot = await rtdbRef.once('value');
  const sensorData = snapshot.val();
  if (!sensorData) {
    console.error(`❌ ไม่พบข้อมูล RTDB ที่ path records/${dateString}/sensors`);
    return;
  }

  // 2) กำหนด map ของ field ที่จะคำนวณ
  const fields = {
    CO: 'co',
    CO2: 'co2',
    NH3: 'nh3',
    PM10: 'pm10',
    pm25: 'pm2_5',
    temperature: 'temperature',
  };

  // 3) คำนวณ sum และ count
  const sums = {}, counts = {};
  for (const key of Object.keys(fields)) {
    sums[key] = 0;
    counts[key] = 0;
  }

  for (const hourKey of Object.keys(sensorData)) {
    const reading = sensorData[hourKey];
    for (const [exportKey, sourceKey] of Object.entries(fields)) {
      const val = reading[sourceKey];
      const num = parseFloat(val);
      if (!isNaN(num)) {
        sums[exportKey] += num;
        counts[exportKey]++;
      }
    }
  }

  // 4) คำนวณ average และ build result object
  const result = { date: dateString };
  for (const key of Object.keys(fields)) {
    result[key] = counts[key] > 0
      ? parseFloat((sums[key] / counts[key]).toFixed(2))
      : null;
  }

  // 5) (Optional) ดึง rainChance แล้วใส่เข้าไปด้วย
  try {
    const rainChance = await fetchRainChance(2, 500);
    result.rainChance = rainChance;
  } catch (e) {
    console.warn('⚠️ fetchRainChance failed:', e.message);
  }

  // 6) เขียนลง Firestore
  try {
    await admin
      .firestore()
      .collection('sensor_data')
      .doc(dateString)
      .set(result, { merge: true });

    console.log('✅ เขียน Firestore สำเร็จ:', result);
  } catch (e) {
    console.error('❌ เขียน Firestore ผิดพลาด:', e);
  }
}

// ให้เรียกใช้ averageRTDBtoFirestore จากที่คุณต้องการ เช่น
// averageRTDBtoFirestore('2025-04-22');

module.exports = averageRTDBtoFirestore;
