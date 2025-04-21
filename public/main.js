import { getNext5DaysForecast, generateAdvice } from './predic.js';
import { FindSensors } from './firebase.js';

// ใส่ไว้ข้างบนสุดของไฟล์ main.js
/**
 * เปลี่ยนพื้นหลังของกล่อง main-weather ตามอุณหภูมิและโอกาสฝน
 * @param {{temperature: number, rainChance: number}} param0
 */

document.addEventListener('DOMContentLoaded', () => {
  const mapContainer = document.getElementById('mapContainer');
  const campusMap    = document.getElementById('campusMap');
  const infoBox      = document.getElementById('infoBox');

  // เพิ่ม listener ให้ทุก hotspot
  document.querySelectorAll('.hotspot').forEach(hot => {
    hot.addEventListener('click', e => {
      // แสดงข้อมูล
      infoBox.textContent = `${hot.dataset.name}: ${hot.dataset.info}`;
      infoBox.hidden = false;

      // วางตำแหน่ง infoBox
      const rect = mapContainer.getBoundingClientRect();
      infoBox.style.transform =
        `translate(${e.clientX - rect.left}px, ${e.clientY - rect.top}px)`;

      // ซูมที่จุดคลิก
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      campusMap.style.transformOrigin = `${x}px ${y}px`;
      campusMap.classList.add('zoomed');
      setTimeout(() => campusMap.classList.remove('zoomed'), 600);
    });
  });
});

function getDayLabel(dateString) {
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const date = new Date(dateString);
  return days[date.getDay()];
}


export async function LoadForecast() {
  const fc = document.getElementById("forecastContainer");
  if (!fc) return;

  const data = await getNext5DaysForecast();

  fc.innerHTML = ""; // ล้างก่อนแสดงใหม่

  data.forEach(entry => {
    const item = entry.forecast;
    const dayLabel = getDayLabel(entry.date);
    if (item) {
      const icon = item.icon || pickIcon(item);
      const rain = item.rainChance ?? item.rainchance ?? 0;
      fc.innerHTML += `
        <div class="forecast-item">
          <span><strong>${dayLabel}</strong></span>
          <img src="./png/${icon}.png" alt="${icon}" />
          <span><strong>${item.temperature.toFixed(2)}</strong>°C</span>
          <span>PM2.5: <strong>${item.pm25.toFixed(2)}</strong> µg/m³</span>
          <span>Rain: <strong>${rain.toFixed(1)*10}</strong>%</span>
        </div>
      `;
    } else {
      fc.innerHTML += `
        <div class="forecast-item">
          <span>${dayLabel}</span>
          <img src="./png/unknown.png" alt="No Data" />
          <span>--°C</span>
          <span>-- µg/m³</span>
          <span>--%</span>
        </div>
      `;
    }
  });
}


function formatNumber(value) {
  return typeof value === "number" ? value.toFixed(2) : "--";
}

function pickIcon(item) {
    if (!item || typeof item !== 'object') return "unknown";
  
    const temp = item.temperature ?? 0;
    const rain = item.rainChance ?? item.rainchance ?? 0; // รองรับทั้ง 2 แบบ
  
    // 🔴 ลำดับความสำคัญ: ฝน > ร้อน/หนาว > ปกติ
    if (rain >= 90) return "storm";      // ฝนตกหนักมาก  
    if (rain >= 70) return "rainy";       // ฝนตกหนัก
    if (rain >= 40) return "cloudy";      // มีเมฆหรือฝนปรอย
    if (temp >= 35) return "hot";         // ร้อนจัด
    if (temp <= 20) return "cold";        // หนาว
    return "sunny";                       // ปกติ
  }
  
  //slider//
  function startSensorSlider(ms = 3000) {
    const items = document.querySelectorAll('.slider-item');
    if (!items.length) return;
    let idx = 0;
    setInterval(() => {
      items.forEach(i=>i.classList.remove('active'));
      idx = (idx+1)%items.length;
      items[idx].classList.add('active');
    }, ms);
  }

// การเปลี่ยนค่าเมื่อคลิก
const slider = document.getElementById('slider');
const items = slider.querySelectorAll('.slider-item');
let currentIndex = 0;
    // เพิ่ม event listener สำหรับการคลิก
    slider.addEventListener('click', () => {
      // ลบ active จากไอเท็มเดิม
      items[currentIndex].classList.remove('active');

      // หาตำแหน่งไอเท็มถัดไป
      currentIndex = (currentIndex + 1) % items.length;

      // เพิ่ม active ให้กับไอเท็มถัดไป
      items[currentIndex].classList.add('active');
  });

window.onload = () => {
    FindSensors();
    LoadForecast();
    startRealtimeTemp();        // ⬅️ ฟังข้อมูลอุณหภูมิ
    startSensorSlider();        // (ถ้ามี slider)
  };