import { getNext5DaysForecast, generateAdvice, getTomorrowForecast } from './predic.js';
import { FindSensors } from './firebase.js';

// เปลี่ยนพื้นหลังตามอุณหภูมิและโอกาสฝน
function pickBackgroundClass({ temperature = 0, rainChance = 0 }) {
  if (rainChance >= 70) return 'rainy';      // ฝนตกหนัก
  if (rainChance >= 40) return 'cloudy';     // มีเมฆหรือฝนปรอย
  if (temperature >= 35) return 'hot';      // ร้อนจัด
  if (temperature <= 20) return 'cold';     // หนาว
  return 'sunny';                            // ปกติ
}

// ฟังก์ชันดึงค่า CO, CO2, PM2.5, RainChance, Temperature ของวันพรุ่งนี้
async function displayTomorrowValues() {
  try {
    const { forecast } = await getTomorrowForecast();
    console.log('Tomorrow forecast:', forecast);

    // mapping selectors กับ keys
    const mapping = [
      { selector: '.pm25-tomorrow',      key: 'pm25' },
      { selector: '.rainChance-tomorrow', key: 'rainChance' },
      { selector: '.temperature-tomorrow',key: 'temperature' },
    ];

    mapping.forEach(({ selector, key }) => {
      const el = document.querySelector(selector);
      if (!el) return;
      const raw = forecast?.[key];
      el.textContent = typeof raw === 'number' ? raw.toFixed(1) : '--';
    });

    // เปลี่ยนคลาสพื้นหลังของการ์ดหลัก
    const container = document.querySelector('.predic-card.main-predic');
    if (container) {
      container.classList.remove('sunny','rainy','cloudy','hot','cold');
      const bgClass = pickBackgroundClass({
        temperature: forecast?.temperature,
        rainChance: forecast?.rainChance
      });
      container.classList.add(bgClass);
    }
  } catch (err) {
    console.error('Error in displayTomorrowValues:', err);
  }
}

// เมื่อโหลดหน้า และเรียกใช้งานฟังก์ชันต่างๆ
window.addEventListener('load', () => {
  FindSensors();           // ดึงข้อมูลเซนเซอร์เรียลไทม์
  LoadForecast();          // ดึงพยากรณ์ 5 วัน
  startSensorSlider();     // สไลด์เซนเซอร์ (ถ้ามี)
  displayTomorrowValues(); // ดึงและอัปเดตค่าพรุ่งนี้ + background
});

// --- โค้ดเดิมส่วนอื่นๆ ไม่เปลี่ยน ---
document.addEventListener('DOMContentLoaded', () => {
  const mapContainer = document.getElementById('mapContainer');
  const campusMap    = document.getElementById('campusMap');
  const infoBox      = document.getElementById('infoBox');

  document.querySelectorAll('.hotspot').forEach(hot => {
    hot.addEventListener('click', e => {
      infoBox.textContent = `${hot.dataset.name}: ${hot.dataset.info}`;
      infoBox.hidden = false;
      const rect = mapContainer.getBoundingClientRect();
      infoBox.style.transform =
        `translate(${e.clientX - rect.left}px, ${e.clientY - rect.top}px)`;
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      campusMap.style.transformOrigin = `${x}px ${y}px`;
      campusMap.classList.add('zoomed');
      setTimeout(() => campusMap.classList.remove('zoomed'), 600);
    });
  });
});

function getDayLabel(dateString) {
  const days = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
  return days[new Date(dateString).getDay()];
}

export async function LoadForecast() {
  const fc = document.getElementById("forecastContainer");
  if (!fc) return;

  const data = await getNext5DaysForecast();
  fc.innerHTML = "";

  data.forEach(({ date, forecast, rainChance }) => {
    const dayLabel = getDayLabel(date);

    if (forecast) {
      const temp   = forecast.temperature ?? 0;
      const pm25   = forecast.pm25        ?? 0;
      const icon   = forecast.icon        || pickIcon({ temperature: temp, rainChance });
      const rainPct = rainChance         ?? 0;

      fc.innerHTML += `
        <div class="forecast-item">
          <span><strong>${dayLabel}</strong></span>
          <img src="./png/${icon}.png" alt="${icon}" />
          <span><strong>${temp.toFixed(2)}</strong>°C</span>
          <span>PM2.5: <strong>${pm25.toFixed(0)}</strong> µg/m³</span>
          <span>Rain: <strong>${rainPct}</strong>%</span>
        </div>`;
    } else {
      fc.innerHTML += `
        <div class="forecast-item">
          <span><strong>${dayLabel}</strong></span>
          <img src="./png/unknown.png" alt="No Data" />
          <span>--°C</span>
          <span>-- µg/m³</span>
          <span>--%</span>
        </div>`;
    }
  });
}

function formatNumber(value) {
  return typeof value === "number" ? value.toFixed(2) : "--";
}

function pickIcon(item) {
  if (!item || typeof item !== 'object') return "unknown";
  const temp = item.temperature ?? 0;
  const rain = item.rainChance ?? item.rainchance ?? 0;
  if (rain >= 90) return "storm";
  if (rain >= 70) return "rainy";
  if (rain >= 40) return "cloudy";
  if (temp >= 35) return "hot";
  if (temp <= 20) return "cold";
  return "sunny";
}

// slider //
function startSensorSlider(ms = 3000) {
  const items = document.querySelectorAll('.slider-item');
  if (!items.length) return;
  let idx = 0;
  setInterval(() => {
    items.forEach(i => i.classList.remove('active'));
    idx = (idx + 1) % items.length;
    items[idx].classList.add('active');
  }, ms);
}

const slider = document.getElementById('slider');
const items = slider?.querySelectorAll('.slider-item') || [];
let currentIndex = 0;
if (slider) {
  slider.addEventListener('click', () => {
    items[currentIndex].classList.remove('active');
    currentIndex = (currentIndex + 1) % items.length;
    items[currentIndex].classList.add('active');
  });
}

window.addEventListener('load', () => {
  FindSensors();
  LoadForecast();
  startSensorSlider();        // (ถ้ามี slider)
  displayTomorrowValues();
});