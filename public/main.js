import { getNext5DaysForecast, generateAdvice } from './predic.js';
import { FindSensors } from './firebase.js';

document.addEventListener('DOMContentLoaded', () => {
  const mapContainer = document.getElementById('mapContainer');
  const campusMap    = document.getElementById('campusMap');
  const infoBox      = document.getElementById('infoBox');

  // เพิ่ม listener ให้ทุก hotspot
  document.querySelectorAll('.hotspot').forEach(hot => {
    hot.addEventListener('click', e => {
      // อัปเดตกล่องข้อมูล
      const { name, info } = hot.dataset;
      infoBox.textContent = `${name} เป็น ${info}`;

      // คำนวณจุดคลิกบนแมพ
      const rect   = mapContainer.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      campusMap.style.transformOrigin = `${clickX}px ${clickY}px`;

      // ซูมเข้าเล็กน้อย
      campusMap.classList.add('zoomed');
      setTimeout(() => {
        campusMap.classList.remove('zoomed');
      }, 600);
    });
  });
});

function getDayLabel(dateString) {
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const date = new Date(dateString);
  return days[date.getDay()];
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
  
  
function startSensorSlider(intervalMs = 3000) {
const sliderItems = document.querySelectorAll('.slider-item');
if (sliderItems.length === 0) return;
  
    let currentIndex = 0;
  
    setInterval(() => {
      // ลบ active ทั้งหมดก่อน
      sliderItems.forEach(item => item.classList.remove('active'));
  
      // เพิ่ม active ให้ตัวใหม่
      currentIndex = (currentIndex + 1) % sliderItems.length;
      sliderItems[currentIndex].classList.add('active');
    }, intervalMs);
  }

export async function LoadForecast() {
  const forecastContainer = document.getElementById("forecastContainer");
  if (!forecastContainer) return;

  const data = await getNext5DaysForecast();
  forecastContainer.innerHTML = "";

  data.forEach(entry => {
    const dateKey = entry.date;
    const dayLabel = getDayLabel(dateKey);
    const item = entry.forecast;

    if (item) {
        console.log("🧪 item ที่จะใช้ pickIcon:", item);
        const iconName = item.icon || pickIcon(item);
        const iconSrc = `./png/${iconName}.png`;
        const advice = generateAdvice(item);
        const rainDisplay = formatNumber(item.rainChance * 10);

        forecastContainer.innerHTML += `
        <div class="forecast-item">
          <span><strong class="bold-blue">${dayLabel}</strong></span>
          <img src="${iconSrc}" alt="Weather Icon">
          <span><strong class="bold-blue">${formatNumber(item.temperature)}</strong>°C</span>
          <span>
            PM2.5: <strong class="bold-blue">${formatNumber(item.pm25)}</strong> µg/m³
          </span>
          <span>
            โอกาสที่ฝนจะตก: <strong class="bold-blue">${rainDisplay}</strong>%
          </span>
          <div class="weather-advice">${advice}</div>
        </div>
`;console.log("🧪 Forecast item:", item);
    } else {
      forecastContainer.innerHTML += `
        <div class="forecast-item">
          <span>${dayLabel}</span>
          <img src="./png/unknown.png" alt="No Data">
          <span>Temp: --°C</span>
          <span>PM2.5: -- µg/m³</span>
          <span>Rain: --%</span>
          <div class="weather-advice">⚠️ ไม่มีข้อมูลพยากรณ์</div>
        </div>
      `;
    }
  });
}

let tempChart = null;

function renderTemperatureChart() {
  const ctx = document.getElementById('temperatureChart').getContext('2d');

  const data = {
    labels: [],
    datasets: [{
      label: "Temperature (°C)",
      borderColor: "rgba(255,99,132,1)",
      backgroundColor: "rgba(255,99,132,0.2)",
      data: [],
      tension: 0.3
    }]
  };

  tempChart = new Chart(ctx, {
    type: 'line',
    data: data,
    options: {
      responsive: true,
      animation: false,
      scales: {
        x: {
          title: { display: true, text: 'Time' }
        },
        y: {
          title: { display: true, text: 'Temperature (°C)' }
        }
      }
    }
  });
}

function startRealtimeTemp() {
  const realtimeRef = ref(db, "/realtime/temp");

  onValue(realtimeRef, (snapshot) => {
    const tempValue = snapshot.val();
    const timeLabel = new Date().toLocaleTimeString();

    if (tempChart) {
      const chartData = tempChart.data;
      chartData.labels.push(timeLabel);
      chartData.datasets[0].data.push(tempValue ?? 0);

      // จำกัดข้อมูลไม่เกิน 20 จุด
      if (chartData.labels.length > 20) {
        chartData.labels.shift();
        chartData.datasets[0].data.shift();
      }

      tempChart.update();
    }
  });
}

window.onload = () => {
    FindSensors();
    LoadForecast();
    renderTemperatureChart();   // ⬅️ สร้างกราฟ
    startRealtimeTemp();        // ⬅️ ฟังข้อมูลอุณหภูมิ
    startSensorSlider();        // (ถ้ามี slider)
  };