const admin = require('firebase-admin');
const fetch = require('node-fetch');

async function fetchRainChance(retry = 1, delay = 1000) {
  const LAT = 13.85527;
  const LON = 100.58532;
  const API_KEY = process.env.OPENWEATHER_API_KEY || 'e5d06f804986aee2b7fbef62dd81435d';
  const url = `https://api.openweathermap.org/data/2.5/onecall?lat=${LAT}&lon=${LON}&exclude=minutely,daily,alerts&appid=${API_KEY}&units=metric`;

  for (let attempt = 1; attempt <= retry; attempt++) {
    const res = await fetch(url);
    const json = await res.json();
    const pop = json.hourly?.[1]?.pop; // ใช้ hourly[1] เพื่อความเสถียร

    if (typeof pop === 'number') {
      const percent = Math.round(pop * 100);
      console.log(`✅ [RainChance] Attempt ${attempt}: ${percent}%`);
      return percent;
    }

    console.log(`⏳ [RainChance] Attempt ${attempt}: retrying in ${delay}ms...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  console.log('❌ [RainChance] fallback to 0');
  return 0;
}

async function averageRTDBtoFirestore(dateString) {
  console.log(`🧪 START averageRTDBtoFirestore for ${dateString}`);

  const rtdbRef = admin.database().ref(`records/${dateString}/sensors`);
  const snapshot = await rtdbRef.once('value');
  const sensorData = snapshot.val();

  if (!sensorData) {
    console.log(`❌ ไม่พบข้อมูล RTDB สำหรับ ${dateString}`);
    return;
  }

  const fields = {
    CO: 'co',
    CO2: 'co2',
    NH3: 'nh3',
    PM10: 'pm10',
    pm25: 'pm2_5',
    temperature: 'temperature',
  };

  const sums = {}, counts = {};
  Object.keys(fields).forEach(key => {
    sums[key] = 0;
    counts[key] = 0;
  });

  for (const hour in sensorData) {
    const reading = sensorData[hour];
    Object.entries(fields).forEach(([exportKey, sourceKey]) => {
      const val = reading[sourceKey];
      if (val !== undefined && val !== null && val !== '' && val !== '-') {
        const parsed = parseFloat(val);
        if (!isNaN(parsed)) {
          sums[exportKey] += parsed;
          counts[exportKey]++;
        }
      }
    });
  }

  const result = {};
  Object.keys(fields).forEach(key => {
    result[key] = counts[key] > 0 ? parseFloat((sums[key] / counts[key]).toFixed(2)) : null;
  });

  result.date = dateString;

  await admin.firestore().collection('sensor_data').doc(dateString).set(result);
  console.log(`✅ อัปโหลดสำเร็จ:`, result);
}

module.exports = averageRTDBtoFirestore;
