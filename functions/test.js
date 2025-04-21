const admin = require('firebase-admin');
const fetch = require('node-fetch');

admin.initializeApp();
const db = admin.firestore();

const API_KEY = 'e5d06f804986aee2b7fbef62dd81435d';
const LAT = 13.85527;
const LON = 100.58532;

async function get5DayRainChance() {
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${LAT}&lon=${LON}&appid=${API_KEY}&units=metric`;
  const res = await fetch(url);
  const data = await res.json();

  const rainMap = {};
  for (const item of data.list) {
    const date = item.dt_txt.substring(0, 10);
    const pop = item.pop ?? 0;
    if (!rainMap[date]) rainMap[date] = [];
    rainMap[date].push(pop);
  }

  const result = {};
  for (const [date, pops] of Object.entries(rainMap)) {
    const avg = pops.reduce((a, b) => a + b, 0) / pops.length;
    result[date] = Math.round(avg * 100);
  }
  return result;
}

(async () => {
  const forecast = await get5DayRainChance();
  const today = new Date().toISOString().split('T')[0];
  const batch = db.batch();

  for (const [date, chance] of Object.entries(forecast)) {
    if (date <= today) {
      console.log(`⏭️ Skip ${date}`);
      continue;
    }
    const ref = db.collection('forecast_data').doc(date);
    batch.set(ref, { rainChance: chance }, { merge: true });
    console.log(`✅ Writing ${date}: ${chance}%`);
  }

  await batch.commit();
  console.log('🎯 Finished!');
})();
