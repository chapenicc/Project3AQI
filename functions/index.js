// functions/index.js

const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin        = require('firebase-admin');
const fetch        = require('node-fetch');

admin.initializeApp();
const db  = admin.firestore();
const LAT = 13.85527;
const LON = 100.58532;

// ใส่ API key ของคุณตรงนี้เลย
const API_KEY = "e5d06f804986aee2b7fbef62dd81435d";

/**
 * ดึงข้อมูลสภาพอากาศ 5 วันถัดไปจาก One Call API (รวม rainChance)
 */
async function get5DayWeatherData() {
  const url = `https://api.openweathermap.org/data/2.5/onecall`
    + `?lat=${LAT}&lon=${LON}`
    + `&exclude=current,minutely,hourly,alerts`
    + `&appid=${API_KEY}`
    + `&units=metric`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenWeather API error: ${res.status}`);
  const { daily } = await res.json();

  return daily.slice(1, 6).reduce((acc, day) => {
    const date = new Date(day.dt * 1000)
      .toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

    acc[date] = {
      temperature: day.temp.day,
      feelsLike:   day.feels_like.day,
      humidity:    day.humidity,
      windSpeed:   day.wind_speed,
      description: day.weather?.[0]?.description || null,
      // เพิ่ม rainChance
      rainChance: Math.round((day.pop || 0) * 100)
    };
    return acc;
  }, {});
}

exports.saveRainChanceForecast = onSchedule(
  'every day 06:00',
  { timeZone: 'Asia/Bangkok' },
  async () => {
    try {
      console.log('⏳ Fetching weather + rainChance…');
      const forecast = await get5DayWeatherData();
      console.log('🔍 Dates:', Object.keys(forecast));

      const batch = db.batch();
      for (const [date, data] of Object.entries(forecast)) {
        const ref = db.collection('forecast_data').doc(date);
        batch.set(ref, data, { merge: true });
        console.log(`📦 ${date}:`, data);
      }
      await batch.commit();
      console.log('✅ forecast_data saved');
    } catch (e) {
      console.error('❌ saveRainChanceForecast failed:', e);
    }
  }
);

exports.saveWeatherForecast = onSchedule(
  'every day 06:10',
  { timeZone: 'Asia/Bangkok' },
  async () => {
    // … โค้ดเดิมของ saveWeatherForecast …
  }
);
